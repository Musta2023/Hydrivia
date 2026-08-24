import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { liveState, sendZoneCommand } from '../services/mqttService.js';
import prisma from '../database/index.js';

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
router.get('/:id', authenticateToken, async (req, res) => {
  const zoneId = parseInt(req.params.id, 10);
  if (![1, 2, 3].includes(zoneId)) {
    return res.status(404).json({ error: 'Zone introuvable. Utilisez 1, 2 ou 3.' });
  }

  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Get past 24h sensor readings
    const rawReadings = await prisma.sensorReading.findMany({
      where: {
        timestamp: { gte: twentyFourHoursAgo }
      },
      orderBy: { timestamp: 'asc' }
    });

    const history = rawReadings.map((r) => ({
      timestamp: r.timestamp.toISOString(),
      soil_humidity: zoneId === 1 ? r.zone1Soil : zoneId === 2 ? r.zone2Soil : r.zone3Soil,
      pump_running: r.pumpRunning ? 1 : 0,
      valve: (zoneId === 1 ? r.valve1 : zoneId === 2 ? r.valve2 : r.valve3) ? 1 : 0
    }));

    // Get recent irrigation cycles for this zone
    const cycles = await prisma.irrigationCycle.findMany({
      where: { zoneId },
      orderBy: { startTime: 'desc' },
      take: 10
    });

    res.json({
      zone: liveState.zones[zoneId],
      history,
      cycles
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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
