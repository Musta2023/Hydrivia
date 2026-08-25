import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
  const [alerts, setAlerts] = useState([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [latestAiAnalysis, setLatestAiAnalysis] = useState(null);
  const [staleData, setStaleData] = useState(false);
  const [consumption, setConsumption] = useState({
    totals: { todayLiters: 0, todayRequestedLiters: 0, weekLiters: 0, monthLiters: 0, allTimeLiters: 0, totalCycles: 0 },
    byZone: [],
    dailyChart: [],
    recentCycles: []
  });

  const fetchConsumption = useCallback(async () => {
    try {
      const res = await api.get('/analytics/consumption');
      setConsumption(res.data);
    } catch (err) {
      console.warn('Consumption fetch warning:', err.message);
    }
  }, []);

  const fetchAlerts = useCallback(async () => {
    setAlertsLoading(true);
    try {
      const res = await api.get('/alerts?limit=50');
      if (res.data && res.data.alerts) {
        setAlerts(res.data.alerts);
        if (res.data.alerts.length > 0 && !recentAlert) {
          const activeHigh = res.data.alerts.find(a => a.status === 'active' && (a.severity === 'critical' || a.severity === 'high'));
          if (activeHigh) setRecentAlert(activeHigh);
        }
      }
    } catch (err) {
      console.warn('Alerts fetch warning:', err.message);
    } finally {
      setAlertsLoading(false);
    }
  }, [recentAlert]);

  const fetchLatestAi = useCallback(async () => {
    try {
      const res = await api.get('/ai-analysis/latest');
      if (res.data && res.data.analysis) {
        setLatestAiAnalysis(res.data.analysis);
      }
    } catch (err) {
      console.warn('Latest AI analysis fetch warning:', err.message);
    }
  }, []);

  const resolveAlert = async (alertId) => {
    try {
      const res = await api.patch(`/alerts/${alertId}/resolve`);
      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, status: 'resolved', resolved_at: new Date().toISOString() } : a));
      return res.data;
    } catch (err) {
      console.error('Error resolving alert:', err);
      throw err;
    }
  };

  useEffect(() => {
    // Initial fetch of live status from REST API
    async function fetchInitialStatus() {
      try {
        const [zonesRes, tankRes, emergRes, analyticsRes, alertsRes, aiRes] = await Promise.all([
          api.get('/zones').catch(() => ({ data: { zones: [] } })),
          api.get('/tank').catch(() => ({ data: {} })),
          api.get('/emergency/status').catch(() => ({ data: { emergencyStopped: false } })),
          api.get('/analytics/consumption').catch(() => ({ data: null })),
          api.get('/alerts?limit=50').catch(() => ({ data: { alerts: [] } })),
          api.get('/ai-analysis/latest').catch(() => ({ data: { analysis: null } }))
        ]);
        
        if (zonesRes.data && zonesRes.data.zones) {
          const zMap = {};
          zonesRes.data.zones.forEach(z => { zMap[z.id] = z; });
          
          setTelemetry(prev => ({
            ...prev,
            zones: zMap,
            pump: zonesRes.data.pump || prev.pump,
            tank: tankRes.data?.tank || prev.tank,
            lastSeen: zonesRes.data.lastSeen || Date.now()
          }));
        }

        if (emergRes.data) {
          setEmergencyStopped(emergRes.data.emergencyStopped);
        }
        if (analyticsRes && analyticsRes.data) {
          setConsumption(analyticsRes.data);
        }
        if (alertsRes.data && alertsRes.data.alerts) {
          setAlerts(alertsRes.data.alerts);
          const activeHigh = alertsRes.data.alerts.find(a => a.status === 'active' && (a.severity === 'critical' || a.severity === 'high'));
          if (activeHigh) setRecentAlert(activeHigh);
        }
        if (aiRes.data && aiRes.data.analysis) {
          setLatestAiAnalysis(aiRes.data.analysis);
        }
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
      if (data.consumption) {
        setConsumption(prev => ({ ...prev, totals: data.consumption }));
      }
      setTelemetry(prev => ({ ...prev, lastSeen: Date.now() }));
      setStaleData(false);
    });

    newSocket.on('consumption:update', (analyticsData) => {
      setConsumption(analyticsData);
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

    // Real-time Centralized Alerts Event Handlers
    newSocket.on('alert:new', (alertData) => {
      setRecentAlert(alertData);
      setAlerts(prev => {
        const exists = prev.some(a => a.id === alertData.id);
        if (exists) return prev.map(a => a.id === alertData.id ? alertData : a);
        return [alertData, ...prev];
      });
      if (alertData.type === 'watering_complete' || alertData.type === 'all_zones_complete') {
        fetchConsumption();
      }
    });

    newSocket.on('alert:update', (alertData) => {
      setAlerts(prev => prev.map(a => a.id === alertData.id ? { ...a, ...alertData } : a));
    });

    newSocket.on('alert:resolved', (resolvedData) => {
      setAlerts(prev => prev.map(a => a.id === resolvedData.id ? { ...a, status: 'resolved', resolved_at: resolvedData.resolvedAt } : a));
      setRecentAlert(prev => prev && prev.id === resolvedData.id ? null : prev);
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
      alerts,
      alertsLoading,
      latestAiAnalysis,
      staleData,
      emergencyStopped,
      consumption,
      refreshConsumption: fetchConsumption,
      refreshAlerts: fetchAlerts,
      refreshLatestAi: fetchLatestAi,
      resolveAlert,
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
