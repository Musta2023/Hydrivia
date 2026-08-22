import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import db from '../database/index.js';

const router = express.Router();

// GET /api/logs - List system audit logs
router.get('/', authenticateToken, (req, res) => {
  const { limit = 100 } = req.query;

  try {
    const logs = db.prepare('SELECT * FROM system_logs ORDER BY created_at DESC LIMIT ?').all(parseInt(limit, 10));
    res.json({ logs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
