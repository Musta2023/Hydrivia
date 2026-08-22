import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { liveState } from '../services/mqttService.js';
import db from '../database/index.js';

const router = express.Router();

// GET /api/tank - Get tank state and historical water levels
router.get('/', authenticateToken, (req, res) => {
  const period = req.query.period || '24h'; // '24h', '7d', '30d'
  let timeClause = "-24 hours";
  if (period === '7d') timeClause = "-7 days";
  if (period === '30d') timeClause = "-30 days";

  const history = db.prepare(`
    SELECT timestamp, water_level, volume_liters
    FROM sensor_readings
    WHERE timestamp >= datetime('now', '${timeClause}')
    ORDER BY timestamp ASC
  `).all();

  res.json({
    tank: liveState.tank,
    history,
    flowRateLPerMin: 30.0,
    criticalThresholdPct: 20.0,
    lowThresholdPct: 30.0
  });
});

export default router;
