import React, { createContext, useContext, useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import api from '../services/api';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [mqttConnected, setMqttConnected] = useState(false);
  const [emergencyStopped, setEmergencyStopped] = useState(false);
  
  // Real-time Telemetry State
  const [telemetry, setTelemetry] = useState({
    zones: {
      1: { id: 1, plant: 'Tomate', soil_humidity: 45.0, valve: 'OFF', watering_active: false, target_moisture: 50, target_liters: 0 },
      2: { id: 2, plant: 'Menthe', soil_humidity: 52.0, valve: 'OFF', watering_active: false, target_moisture: 50, target_liters: 0 },
      3: { id: 3, plant: 'Oignon', soil_humidity: 38.0, valve: 'OFF', watering_active: false, target_moisture: 50, target_liters: 0 }
    },
    pump: { pump: 'OFF', water_level: 75.0, volume_liters: 5250.0 },
    tank: { water_level: 75.0, volume_liters: 5250.0, capacity_liters: 7000.0, critical: false, low: false },
    environment: { temperature: 24.2, air_humidity: 58.5 },
    lastSeen: Date.now()
  });

  const [recentAlert, setRecentAlert] = useState(null);
  const [staleData, setStaleData] = useState(false);

  useEffect(() => {
    // Initial fetch of live status from REST API
    async function fetchInitialStatus() {
      try {
        const [zonesRes, tankRes, emergRes] = await Promise.all([
          api.get('/zones'),
          api.get('/tank'),
          api.get('/emergency/status')
        ]);
        
        const zMap = {};
        zonesRes.data.zones.forEach(z => { zMap[z.id] = z; });
        
        setTelemetry(prev => ({
          ...prev,
          zones: zMap,
          pump: zonesRes.data.pump || prev.pump,
          tank: tankRes.data.tank || prev.tank,
          lastSeen: zonesRes.data.lastSeen || Date.now()
        }));

        setEmergencyStopped(emergRes.data.emergencyStopped);
      } catch (err) {
        console.warn('Initial fetch warning:', err.message);
      }
    }
    fetchInitialStatus();

    // Connect Socket.IO
    const newSocket = io({
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000
    });

    newSocket.on('connect', () => {
      console.log('[WS] Connecté au serveur Gateway');
      setWsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('[WS] Déconnecté');
      setWsConnected(false);
      setMqttConnected(false);
    });

    newSocket.on('mqtt:status', (status) => {
      setMqttConnected(status.connected);
    });

    newSocket.on('telemetry:snapshot', (data) => {
      if (data.zones) setTelemetry(prev => ({ ...prev, zones: data.zones }));
      if (data.pump) setTelemetry(prev => ({ ...prev, pump: data.pump }));
      if (data.tank) setTelemetry(prev => ({ ...prev, tank: data.tank }));
      if (data.environment) setTelemetry(prev => ({ ...prev, environment: data.environment }));
      if (data.emergencyStopped !== undefined) setEmergencyStopped(data.emergencyStopped);
      setTelemetry(prev => ({ ...prev, lastSeen: Date.now() }));
      setStaleData(false);
    });

    newSocket.on('telemetry:zone', ({ zoneId, data }) => {
      setTelemetry(prev => ({
        ...prev,
        zones: { ...prev.zones, [zoneId]: data },
        lastSeen: Date.now()
      }));
      setStaleData(false);
    });

    newSocket.on('telemetry:pump', (pumpData) => {
      setTelemetry(prev => ({ ...prev, pump: pumpData, lastSeen: Date.now() }));
    });

    newSocket.on('telemetry:tank', (tankData) => {
      setTelemetry(prev => ({ ...prev, tank: tankData, lastSeen: Date.now() }));
    });

    newSocket.on('telemetry:environment', (envData) => {
      setTelemetry(prev => ({ ...prev, environment: envData, lastSeen: Date.now() }));
    });

    newSocket.on('alert:new', (alertData) => {
      setRecentAlert(alertData);
    });

    newSocket.on('emergency:triggered', () => {
      setEmergencyStopped(true);
    });

    newSocket.on('emergency:resumed', () => {
      setEmergencyStopped(false);
    });

    setSocket(newSocket);

    // Stale data watchdog timer
    const staleInterval = setInterval(() => {
      setTelemetry(current => {
        if (Date.now() - current.lastSeen > 60000) {
          setStaleData(true);
        } else {
          setStaleData(false);
        }
        return current;
      });
    }, 10000);

    return () => {
      clearInterval(staleInterval);
      newSocket.close();
    };
  }, []);

  // Quick Action methods
  const triggerEmergency = async () => {
    try {
      const res = await api.post('/emergency/stop');
      setEmergencyStopped(true);
      return res.data;
    } catch (err) {
      console.error('Emergency stop error:', err);
      throw err;
    }
  };

  const resumeSystem = async () => {
    try {
      const res = await api.post('/emergency/resume');
      setEmergencyStopped(false);
      return res.data;
    } catch (err) {
      console.error('Resume error:', err);
      throw err;
    }
  };

  const sendCommand = async (zoneId, { wateringL, targetSoilMoisturePct }) => {
    const res = await api.post(`/zones/${zoneId}/command`, { wateringL, targetSoilMoisturePct });
    return res.data;
  };

  const toggleZone = async (zoneId, action) => {
    const res = await api.post(`/zones/${zoneId}/toggle`, { action });
    return res.data;
  };

  return (
    <SocketContext.Provider value={{
      socket,
      wsConnected,
      mqttConnected,
      telemetry,
      recentAlert,
      staleData,
      emergencyStopped,
      triggerEmergency,
      resumeSystem,
      sendCommand,
      toggleZone
    }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}
