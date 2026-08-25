import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { triggerEmergencyStop, resumeOperation, liveState } from '../services/mqttService.js';

const router = express.Router();

// POST /api/emergency/stop - Trigger immediate Emergency Shutdown (ADMIN only)
router.post('/stop', authenticateToken, requireRole('ADMIN'), (req, res) => {
  const userEmail = req.user?.email || 'admin@gmail.com';
  triggerEmergencyStop(userEmail);
  res.json({
    message: 'ARRÊT D\'URGENCE DÉCLENCHÉ AVEC SUCCÈS. Pompe et vannes arrêtées.',
    systemStatus: liveState.systemStatus,
    emergencyStopped: liveState.emergencyStopped
  });
});

// POST /api/emergency/resume - Resume normal operation (ADMIN only)
router.post('/resume', authenticateToken, requireRole('ADMIN'), (req, res) => {
  const userEmail = req.user?.email || 'admin@gmail.com';
  resumeOperation(userEmail);
  res.json({
    message: 'Système réactivé en mode normal.',
    systemStatus: liveState.systemStatus,
    emergencyStopped: liveState.emergencyStopped
  });
});

// GET /api/emergency/status
router.get('/status', authenticateToken, (req, res) => {
  res.json({
    emergencyStopped: liveState.emergencyStopped,
    systemStatus: liveState.systemStatus
  });
});

export default router;
