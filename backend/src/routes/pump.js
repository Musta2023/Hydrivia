import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { liveState } from '../services/mqttService.js';

const router = express.Router();

// GET /api/pump
router.get('/', authenticateToken, (req, res) => {
  res.json({
    pump: liveState.pump,
    zonesOpen: Object.values(liveState.zones).filter(z => z.valve === 'ON').length,
    systemStatus: liveState.systemStatus
  });
});

export default router;
