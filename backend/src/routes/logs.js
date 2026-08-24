import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import prisma from '../database/index.js';

const router = express.Router();

// GET /api/logs - List system audit logs
router.get('/', authenticateToken, async (req, res) => {
  const { limit = 100 } = req.query;

  try {
    const logs = await prisma.systemLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit, 10) || 100
    });
    res.json({ logs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
