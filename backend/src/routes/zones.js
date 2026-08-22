import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { liveState, sendZoneCommand } from '../services/mqttService.js';
import db from '../database/index.js';

const router = express.Router();

// GET /api/zones - Get live status of all 3 zones
router.get('/', authenticateToken, (req, res) => {
  res.json({
    zones: Object.values(liveState.zones),
    pump: liveState.pump,
    lastSeen: liveState.lastSeen,
    emergencyStopped: liveState.emergencyStopped
  });
});

// GET /api/zones/:id - Get specific zone details and history
router.get('/:id', authenticateToken, (req, res) => {
  const zoneId = parseInt(req.params.id, 10);
  if (![1, 2, 3].includes(zoneId)) {
    return res.status(404).json({ error: 'Zone introuvable. Utilisez 1, 2 ou 3.' });
  }

  // Get past 24h soil moisture history for this zone
  const history = db.prepare(`
    SELECT timestamp, zone${zoneId}_soil as soil_humidity, pump_running, valve${zoneId} as valve
    FROM sensor_readings
    WHERE timestamp >= datetime('now', '-24 hours')
    ORDER BY timestamp ASC
  `).all();

  // Get recent irrigation cycles for this zone
  const cycles = db.prepare(`
    SELECT * FROM irrigation_cycles
    WHERE zone_id = ?
    ORDER BY start_time DESC
    LIMIT 10
  `).all(zoneId);

  res.json({
    zone: liveState.zones[zoneId],
    history,
    cycles
  });
});

// POST /api/zones/:id/command - Send automated or manual watering command
router.post('/:id/command', authenticateToken, (req, res) => {
  const zoneId = parseInt(req.params.id, 10);
  if (![1, 2, 3].includes(zoneId)) {
    return res.status(404).json({ error: 'Zone introuvable.' });
  }

  if (liveState.emergencyStopped) {
    return res.status(400).json({ error: 'Système en arrêt d\'urgence. Réactivez le système avant d\'envoyer une commande.' });
  }

  const { wateringL, targetSoilMoisturePct } = req.body;

  if (wateringL === undefined && targetSoilMoisturePct === undefined) {
    return res.status(400).json({ error: 'Paramètres wateringL ou targetSoilMoisturePct requis.' });
  }

  sendZoneCommand(zoneId, {
    wateringL: parseFloat(wateringL) || 0,
    targetSoilMoisturePct: parseFloat(targetSoilMoisturePct) || 0
  });

  res.json({
    message: `Commande envoyée à la Zone ${zoneId} (${liveState.zones[zoneId].plant})`,
    zone: liveState.zones[zoneId]
  });
});

// POST /api/zones/:id/toggle - Quick manual toggle ON/OFF
router.post('/:id/toggle', authenticateToken, (req, res) => {
  const zoneId = parseInt(req.params.id, 10);
  if (![1, 2, 3].includes(zoneId)) {
    return res.status(404).json({ error: 'Zone introuvable.' });
  }

  if (liveState.emergencyStopped) {
    return res.status(400).json({ error: 'Système en arrêt d\'urgence.' });
  }

  const { action } = req.body; // 'ON' or 'OFF'
  const isStart = action === 'ON';

  sendZoneCommand(zoneId, {
    wateringL: isStart ? 30 : 0, // Default 30L for manual on
    targetSoilMoisturePct: isStart ? 60 : 0
  });

  res.json({
    message: `Vanne Zone ${zoneId} ${isStart ? 'OUVERTE' : 'FERMÉE'}`,
    zone: liveState.zones[zoneId]
  });
});

export default router;
