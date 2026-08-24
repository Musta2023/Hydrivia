import mqtt from 'mqtt';
import { config } from '../config/index.js';
import { broadcast, registerMqttStatusProvider } from './socketService.js';
import prisma from '../database/index.js';
import { getConsumptionAnalytics } from './analyticsService.js';

let mqttClient = null;

// Track active cycles in memory to accurately calculate delivered water volume
const activeCycles = {};

// In-Memory Live State Cache
export const liveState = {
  connected: false,
  lastSeen: Date.now(),
  emergencyStopped: false,
  systemStatus: 'NORMAL', // 'NORMAL', 'IRRIGATING', 'EMERGENCY_STOPPED', 'WARNING'
  
  zones: {
    1: { id: 1, plant: 'Tomate', soil_humidity: 45.0, valve: 'OFF', watering_active: false, target_moisture: 50, target_liters: 0, delivered_liters: 0, progress_pct: 0 },
    2: { id: 2, plant: 'Menthe', soil_humidity: 52.0, valve: 'OFF', watering_active: false, target_moisture: 50, target_liters: 0, delivered_liters: 0, progress_pct: 0 },
    3: { id: 3, plant: 'Oignon', soil_humidity: 38.0, valve: 'OFF', watering_active: false, target_moisture: 50, target_liters: 0, delivered_liters: 0, progress_pct: 0 }
  },
  
  pump: {
    pump: 'OFF',
    water_level: 75.0,
    volume_liters: 5250.0,
    timestamp_ms: Date.now()
  },
  
  tank: {
    water_level: 75.0,
    volume_liters: 5250.0,
    capacity_liters: 7000.0,
    critical: false,
    low: false,
    timestamp_ms: Date.now()
  },
  
  environment: {
    temperature: 24.2,
    air_humidity: 58.5,
    timestamp_ms: Date.now()
  },
  
  activeAlert: null
};

export function initMQTT() {
  const brokerUrl = `${config.mqtt.protocol}://${config.mqtt.server}:${config.mqtt.port}`;
  console.log(`[MQTT] Tentative de connexion au broker: ${brokerUrl}`);

  const options = {
    clientId: config.mqtt.clientId,
    username: config.mqtt.username,
    password: config.mqtt.password,
    clean: true,
    connectTimeout: 8000,
    reconnectPeriod: 5000,
    rejectUnauthorized: false
  };

  try {
    mqttClient = mqtt.connect(brokerUrl, options);

    // Allow Socket.IO to query current MQTT status for late-joining clients
    registerMqttStatusProvider(() => ({
      connected: liveState.connected,
      broker: config.mqtt.server
    }));

    mqttClient.on('connect', () => {
      console.log('[MQTT] Connecté avec succès à HiveMQ Cloud TLS.');
      liveState.connected = true;
      broadcast('mqtt:status', { connected: true, broker: config.mqtt.server });

      // S'abonner aux topics HYDRIVIA
      const topics = [
        'hydrivia/zones/1/state',
        'hydrivia/zones/2/state',
        'hydrivia/zones/3/state',
        'hydrivia/pump/state',
        'hydrivia/tank/state',
        'hydrivia/environment/state',
        'hydrivia/snapshot',
        'hydrivia/alerts'
      ];

      mqttClient.subscribe(topics, (err) => {
        if (err) {
          console.error('[MQTT] Erreur d\'abonnement aux topics:', err);
        } else {
          console.log('[MQTT] Abonné avec succès aux topics de télémétrie.');
        }
      });
    });

    mqttClient.on('message', async (topic, messageBuffer) => {
      try {
        const payloadStr = messageBuffer.toString();
        const payload = JSON.parse(payloadStr);
        await handleIncomingMessage(topic, payload);
      } catch (err) {
        console.error(`[MQTT] Erreur de parsing JSON sur ${topic}:`, err.message);
      }
    });

    mqttClient.on('error', (err) => {
      console.warn('[MQTT] Avertissement/Erreur de connexion:', err.message);
      liveState.connected = false;
      broadcast('mqtt:status', { connected: false, error: err.message });
    });

    mqttClient.on('offline', () => {
      console.log('[MQTT] Client déconnecté (offline).');
      liveState.connected = false;
      broadcast('mqtt:status', { connected: false });
    });

  } catch (error) {
    console.error('[MQTT] Exception lors de l\'initialisation MQTT:', error.message);
  }

  // Si le simulateur est activé ou en secours de développement
  if (config.mqtt.simulate) {
    console.log('[SIMULATOR] Mode simulation IoT activé.');
    startSimulator();
  }
}

async function handleIncomingMessage(topic, payload) {
  liveState.lastSeen = Date.now();

  // Zone State (hydrivia/zones/X/state)
  const zoneMatch = topic.match(/^hydrivia\/zones\/(\d+)\/state$/);
  if (zoneMatch) {
    const zoneId = parseInt(zoneMatch[1], 10);
    if (liveState.zones[zoneId]) {
      const prevValve = liveState.zones[zoneId].valve;
      const newValve = payload.valve || prevValve;

      // 1. If valve switched to ON -> Start tracking active cycle
      if (prevValve !== 'ON' && newValve === 'ON') {
        activeCycles[zoneId] = {
          startTime: Date.now(),
          zoneId,
          plant: payload.plant || liveState.zones[zoneId].plant,
          requestedLiters: liveState.zones[zoneId].target_liters || 30,
          targetSoilMoisture: liveState.zones[zoneId].target_moisture || 50
        };
        liveState.zones[zoneId].watering_active = true;
      }

      // 2. If valve switched to OFF -> Finalize cycle & calculate delivered volume
      if (prevValve === 'ON' && newValve === 'OFF' && activeCycles[zoneId]) {
        const cycle = activeCycles[zoneId];
        const elapsedMs = Math.max(1000, Date.now() - cycle.startTime);
        const elapsedMin = elapsedMs / 60000;
        let deliveredLiters = parseFloat((elapsedMin * 30.0).toFixed(1));
        if (cycle.requestedLiters > 0 && deliveredLiters > cycle.requestedLiters * 1.05) {
          deliveredLiters = cycle.requestedLiters;
        }
        if (deliveredLiters <= 0) deliveredLiters = 0.5;

        try {
          const startTime = new Date(Date.now() - elapsedMs);
          await prisma.irrigationCycle.create({
            data: {
              zoneId,
              plant: cycle.plant,
              requestedLiters: cycle.requestedLiters,
              targetSoilMoisture: cycle.targetSoilMoisture,
              deliveredLiters,
              startTime,
              endTime: new Date(),
              status: 'completed',
              reason: 'Cycle terminé avec succès'
            }
          });
          console.log(`[CONSUMPTION] Cycle enregistré: Zone ${zoneId} (${cycle.plant}) = ${deliveredLiters} L livrés.`);
        } catch (err) {
          console.error('[DB] Erreur enregistrement cycle irrigation:', err.message);
        }

        delete activeCycles[zoneId];
        liveState.zones[zoneId].watering_active = false;
        liveState.zones[zoneId].delivered_liters = deliveredLiters;

        // Broadcast live updated consumption to all clients
        try {
          const freshAnalytics = await getConsumptionAnalytics();
          broadcast('consumption:update', freshAnalytics);
        } catch (e) {}
      }

      liveState.zones[zoneId] = {
        ...liveState.zones[zoneId],
        ...payload,
        soil_humidity: payload.soil_humidity !== undefined ? payload.soil_humidity : liveState.zones[zoneId].soil_humidity,
        valve: newValve
      };
      broadcast('telemetry:zone', { zoneId, data: liveState.zones[zoneId] });
      checkSystemStatus();
    }
    return;
  }

  // Pump State (hydrivia/pump/state)
  if (topic === 'hydrivia/pump/state') {
    liveState.pump = { ...liveState.pump, ...payload };
    broadcast('telemetry:pump', liveState.pump);
    checkSystemStatus();
    return;
  }

  // Tank State (hydrivia/tank/state)
  if (topic === 'hydrivia/tank/state') {
    liveState.tank = { ...liveState.tank, ...payload };
    broadcast('telemetry:tank', liveState.tank);
    return;
  }

  // Environment State (hydrivia/environment/state)
  if (topic === 'hydrivia/environment/state') {
    liveState.environment = { ...liveState.environment, ...payload };
    broadcast('telemetry:environment', liveState.environment);
    return;
  }

  // Snapshot (hydrivia/snapshot)
  if (topic === 'hydrivia/snapshot') {
    if (payload.zones && Array.isArray(payload.zones)) {
      payload.zones.forEach((z) => {
        if (liveState.zones[z.id]) {
          liveState.zones[z.id] = { ...liveState.zones[z.id], ...z };
        }
      });
    }
    if (payload.tank) liveState.tank = { ...liveState.tank, ...payload.tank };
    if (payload.environment) liveState.environment = { ...liveState.environment, ...payload.environment };

    // Persist snapshot reading in DB
    try {
      await prisma.sensorReading.create({
        data: {
          zone1Soil: liveState.zones[1].soil_humidity,
          zone2Soil: liveState.zones[2].soil_humidity,
          zone3Soil: liveState.zones[3].soil_humidity,
          waterLevel: liveState.tank.water_level,
          volumeLiters: liveState.tank.volume_liters,
          temperature: liveState.environment.temperature,
          airHumidity: liveState.environment.air_humidity,
          pumpRunning: liveState.pump.pump === 'ON',
          valve1: liveState.zones[1].valve === 'ON',
          valve2: liveState.zones[2].valve === 'ON',
          valve3: liveState.zones[3].valve === 'ON'
        }
      });
    } catch (dbErr) {
      console.error('[DB] Erreur lors de l\'enregistrement du snapshot:', dbErr.message);
    }

    try {
      const consumptionSummary = (await getConsumptionAnalytics()).totals;
      broadcast('telemetry:snapshot', { ...liveState, consumption: consumptionSummary });
    } catch (e) {
      broadcast('telemetry:snapshot', liveState);
    }
    return;
  }

  // Alerts (hydrivia/alerts)
  if (topic === 'hydrivia/alerts') {
    liveState.activeAlert = payload;
    
    // Check if watering completed alert was received
    if (payload.type === 'watering_complete' || payload.type === 'all_zones_complete') {
      for (const zId of Object.keys(activeCycles)) {
        const cycle = activeCycles[zId];
        const elapsedMs = Math.max(1000, Date.now() - cycle.startTime);
        let deliveredLiters = parseFloat(((elapsedMs / 60000) * 30.0).toFixed(1));
        if (cycle.requestedLiters > 0 && deliveredLiters > cycle.requestedLiters) {
          deliveredLiters = cycle.requestedLiters;
        }
        if (deliveredLiters <= 0) deliveredLiters = 0.5;

        try {
          const startTime = new Date(Date.now() - elapsedMs);
          await prisma.irrigationCycle.create({
            data: {
              zoneId: cycle.zoneId,
              plant: cycle.plant,
              requestedLiters: cycle.requestedLiters,
              targetSoilMoisture: cycle.targetSoilMoisture,
              deliveredLiters,
              startTime,
              endTime: new Date(),
              status: 'completed',
              reason: payload.message || 'Objectif atteint'
            }
          });
        } catch (err) {}
        delete activeCycles[zId];
      }

      try {
        const freshAnalytics = await getConsumptionAnalytics();
        broadcast('consumption:update', freshAnalytics);
      } catch (e) {}
    }

    try {
      await prisma.alert.create({
        data: {
          type: payload.type || 'alert',
          severity: payload.severity || 'info',
          message: payload.message || 'Alerte reçue',
          timestampMs: BigInt(payload.timestamp_ms || Date.now()),
          createdAt: new Date()
        }
      });
    } catch (err) {
      console.error('[DB] Erreur insertion alerte:', err.message);
    }

    broadcast('alert:new', payload);
  }
}

function checkSystemStatus() {
  if (liveState.emergencyStopped) {
    liveState.systemStatus = 'EMERGENCY_STOPPED';
    return;
  }
  const isAnyValveOn = Object.values(liveState.zones).some(z => z.valve === 'ON');
  const isPumpOn = liveState.pump.pump === 'ON';
  if (isPumpOn || isAnyValveOn) {
    liveState.systemStatus = 'IRRIGATING';
  } else if (liveState.tank.critical) {
    liveState.systemStatus = 'WARNING';
  } else {
    liveState.systemStatus = 'NORMAL';
  }
}

// Publish Zone Command
export async function sendZoneCommand(zoneId, { wateringL, targetSoilMoisturePct }) {
  const topic = `hydrivia/zones/${zoneId}/command`;
  const payload = {
    wateringL: parseFloat(wateringL) || 0,
    targetSoilMoisturePct: parseFloat(targetSoilMoisturePct) || 0
  };

  console.log(`[MQTT] Publication commande Zone ${zoneId} -> ${JSON.stringify(payload)}`);
  
  if (mqttClient && mqttClient.connected) {
    mqttClient.publish(topic, JSON.stringify(payload), { qos: 0 });
  }

  // Update in-memory & simulate response if offline
  if (payload.wateringL > 0) {
    liveState.zones[zoneId].watering_active = true;
    liveState.zones[zoneId].target_liters = payload.wateringL;
    liveState.zones[zoneId].target_moisture = payload.targetSoilMoisturePct;
    liveState.zones[zoneId].valve = 'ON';
    liveState.pump.pump = 'ON';
    liveState.emergencyStopped = false;
    checkSystemStatus();

    // Log irrigation start
    try {
      await prisma.systemLog.create({
        data: {
          eventType: 'IRRIGATION_START',
          description: `Commande envoyée Zone ${zoneId} (${liveState.zones[zoneId].plant}): ${payload.wateringL} L, humidité cible: ${payload.targetSoilMoisturePct}%`,
          userEmail: 'admin@gmail.com'
        }
      });
    } catch (e) {}
  } else {
    liveState.zones[zoneId].watering_active = false;
    liveState.zones[zoneId].valve = 'OFF';
    checkSystemStatus();
  }

  broadcast('telemetry:snapshot', liveState);
  return true;
}

// Emergency Stop
export async function triggerEmergencyStop(userEmail = 'admin@gmail.com') {
  console.log('[EMERGENCY] DÉCLENCHEMENT DE L\'ARRÊT D\'URGENCE !');
  liveState.emergencyStopped = true;
  liveState.systemStatus = 'EMERGENCY_STOPPED';

  // Publish OFF to all zones
  [1, 2, 3].forEach((z) => {
    const topic = `hydrivia/zones/${z}/command`;
    const payload = JSON.stringify({ wateringL: 0, targetSoilMoisturePct: 0 });
    if (mqttClient && mqttClient.connected) {
      mqttClient.publish(topic, payload, { qos: 1 });
    }
    liveState.zones[z].valve = 'OFF';
    liveState.zones[z].watering_active = false;
  });

  liveState.pump.pump = 'OFF';

  // Log emergency stop
  try {
    await prisma.systemLog.create({
      data: {
        eventType: 'ARRET_URGENCE',
        description: "Déclenchement immédiat de l'arrêt d'urgence : Pompe et toutes les vannes fermées.",
        userEmail
      }
    });

    await prisma.alert.create({
      data: {
        type: 'emergency_stop',
        severity: 'critical',
        message: "Arrêt d'urgence déclenché par l'administrateur. Toutes les vannes et la pompe sont coupées.",
        timestampMs: BigInt(Date.now()),
        createdAt: new Date()
      }
    });
  } catch (err) {
    console.error('[DB] Erreur log arret d\'urgence:', err);
  }

  broadcast('emergency:triggered', { timestamp: Date.now(), user: userEmail });
  broadcast('telemetry:snapshot', liveState);
  return true;
}

// Resume Normal Operation
export async function resumeOperation(userEmail = 'admin@gmail.com') {
  console.log('[SYSTEM] Reprise du mode normal.');
  liveState.emergencyStopped = false;
  checkSystemStatus();

  try {
    await prisma.systemLog.create({
      data: {
        eventType: 'SYSTEM_RESUME',
        description: 'Reprise normale du système après arrêt.',
        userEmail
      }
    });
  } catch (err) {}

  broadcast('emergency:resumed', { timestamp: Date.now() });
  broadcast('telemetry:snapshot', liveState);
  return true;
}

// Built-in Simulator for robust testability
function startSimulator() {
  setInterval(async () => {
    if (liveState.emergencyStopped) return;

    liveState.lastSeen = Date.now();
    
    // Fluctuate temperature & humidity slightly
    liveState.environment.temperature = parseFloat((23 + Math.sin(Date.now() / 60000) * 4 + (Math.random() - 0.5) * 0.4).toFixed(1));
    liveState.environment.air_humidity = parseFloat((55 + Math.cos(Date.now() / 60000) * 8 + (Math.random() - 0.5) * 0.5).toFixed(1));

    // For active watering zones, increase soil moisture & decrease tank
    for (const z of [1, 2, 3]) {
      const zone = liveState.zones[z];
      if (zone.watering_active && zone.valve === 'ON') {
        zone.soil_humidity = Math.min(100, parseFloat((zone.soil_humidity + 1.2).toFixed(1)));
        liveState.tank.volume_liters = Math.max(0, parseFloat((liveState.tank.volume_liters - 0.5).toFixed(1)));
        liveState.tank.water_level = parseFloat(((liveState.tank.volume_liters / liveState.tank.capacity_liters) * 100).toFixed(1));
        
        // Check target moisture reached
        if (zone.target_moisture > 0 && zone.soil_humidity >= zone.target_moisture) {
          zone.watering_active = false;
          zone.valve = 'OFF';
          
          const alertMsg = `Objectif d'humidité atteint (${zone.soil_humidity}%) pour Zone ${z} (${zone.plant}).`;
          await handleIncomingMessage('hydrivia/alerts', {
            type: 'watering_complete',
            severity: 'info',
            message: alertMsg,
            timestamp_ms: Date.now()
          });
        }
      }
    }

    // Check if pump should be OFF when all valves closed
    const anyValve = Object.values(liveState.zones).some(z => z.valve === 'ON');
    liveState.pump.pump = anyValve ? 'ON' : 'OFF';
    checkSystemStatus();

    broadcast('telemetry:snapshot', liveState);
  }, 2500);
}
