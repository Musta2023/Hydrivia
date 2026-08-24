import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { liveState } from '../services/mqttService.js';
import prisma from '../database/index.js';

const router = express.Router();

// GET /api/tank - Get tank state and historical water levels
router.get('/', authenticateToken, async (req, res) => {
  try {
    const period = req.query.period || '24h'; // '24h', '7d', '30d'
    const now = Date.now();
    let durationMs = 24 * 60 * 60 * 1000;
    if (period === '7d') durationMs = 7 * 24 * 60 * 60 * 1000;
    if (period === '30d') durationMs = 30 * 24 * 60 * 60 * 1000;

    const sinceDate = new Date(now - durationMs);

    const rows = await prisma.sensorReading.findMany({
      where: {
        timestamp: { gte: sinceDate }
      },
      orderBy: { timestamp: 'asc' },
      select: {
        timestamp: true,
        waterLevel: true,
        volumeLiters: true
      }
    });

    const history = rows.map((r) => ({
      timestamp: r.timestamp.toISOString(),
      water_level: r.waterLevel,
      volume_liters: r.volumeLiters
    }));

    res.json({
      tank: liveState.tank,
      history,
      flowRateLPerMin: 30.0,
      criticalThresholdPct: 20.0,
      lowThresholdPct: 30.0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
