import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { liveState, sendZoneCommand } from '../services/mqttService.js';
import prisma from '../database/index.js';

const router = express.Router();

// GET /api/zones - Get live status of all 3 zones with DB Zone info
router.get('/', authenticateToken, async (req, res) => {
  try {
    const dbZones = await prisma.zone.findMany({
      orderBy: { id: 'asc' }
    });

    // Merge live telemetry with canonical Zone metadata
    const zones = dbZones.map((z) => {
      const live = liveState.zones[z.id] || {};
      return {
        ...live,
        id: z.id,
        name: z.name,
        plant: z.plant,
        enabled: z.enabled
      };
    });

    res.json({
      zones,
      pump: liveState.pump,
      lastSeen: liveState.lastSeen,
      emergencyStopped: liveState.emergencyStopped
    });
  } catch (error) {
    // Fallback to liveState if DB query fails
    res.json({
      zones: Object.values(liveState.zones),
      pump: liveState.pump,
      lastSeen: liveState.lastSeen,
      emergencyStopped: liveState.emergencyStopped
    });
  }
});

// GET /api/zones/:id - Get specific zone details, history and relational cycles
router.get('/:id', authenticateToken, async (req, res) => {
  const zoneId = parseInt(req.params.id, 10);
  if (![1, 2, 3].includes(zoneId)) {
    return res.status(404).json({ error: 'Zone introuvable. Utilisez 1, 2 ou 3.' });
  }

  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Get canonical zone record
    const dbZone = await prisma.zone.findUnique({
      where: { id: zoneId }
    });

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

    // Get recent irrigation cycles for this zone with relational AI analysis
    const cycles = await prisma.irrigationCycle.findMany({
      where: { zoneId },
      include: {
        aiAnalysis: {
          select: {
            id: true,
            decisionStatus: true,
            confidencePct: true
          }
        }
      },
      orderBy: { startTime: 'desc' },
      take: 10
    });

    const currentZone = {
      ...(liveState.zones[zoneId] || {}),
      id: zoneId,
      name: dbZone?.name || `Zone ${zoneId}`,
      plant: dbZone?.plant || liveState.zones[zoneId]?.plant || 'Plante',
      enabled: dbZone?.enabled ?? true
    };

    res.json({
      zone: currentZone,
      history,
      cycles: cycles.map((c) => ({
        id: c.id,
        zone_id: c.zoneId,
        plant: c.plant,
        requested_liters: c.requestedLiters,
        delivered_liters: c.deliveredLiters,
        target_soil_moisture: c.targetSoilMoisture,
        start_time: c.startTime.toISOString(),
        end_time: c.endTime ? c.endTime.toISOString() : null,
        status: c.status,
        reason: c.reason,
        ai_analysis_id: c.aiAnalysisId,
        aiAnalysis: c.aiAnalysis
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/zones/:id/command - Send automated or manual watering command (ADMIN only)
router.post('/:id/command', authenticateToken, requireRole('ADMIN'), (req, res) => {
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

  const userEmail = req.user?.email || 'admin@gmail.com';
  sendZoneCommand(zoneId, {
    wateringL: parseFloat(wateringL) || 0,
    targetSoilMoisturePct: parseFloat(targetSoilMoisturePct) || 0
  }, userEmail);

  res.json({
    message: `Commande envoyée à la Zone ${zoneId} (${liveState.zones[zoneId].plant})`,
    zone: liveState.zones[zoneId]
  });
});

// POST /api/zones/:id/toggle - Quick manual toggle ON/OFF (ADMIN only)
router.post('/:id/toggle', authenticateToken, requireRole('ADMIN'), (req, res) => {
  const zoneId = parseInt(req.params.id, 10);
  if (![1, 2, 3].includes(zoneId)) {
    return res.status(404).json({ error: 'Zone introuvable.' });
  }

  if (liveState.emergencyStopped) {
    return res.status(400).json({ error: 'Système en arrêt d\'urgence.' });
  }

  const { action } = req.body; // 'ON' or 'OFF'
  const isStart = action === 'ON';
  const userEmail = req.user?.email || 'admin@gmail.com';

  sendZoneCommand(zoneId, {
    wateringL: isStart ? 30 : 0, // Default 30L for manual on
    targetSoilMoisturePct: isStart ? 60 : 0
  }, userEmail);

  res.json({
    message: `Vanne Zone ${zoneId} ${isStart ? 'OUVERTE' : 'FERMÉE'}`,
    zone: liveState.zones[zoneId]
  });
});

export default router;
