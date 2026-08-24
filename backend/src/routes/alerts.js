import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import prisma from '../database/index.js';

const router = express.Router();

// GET /api/alerts - List alerts with filtering
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { severity, limit = 50 } = req.query;

    const where = {};
    if (severity && severity !== 'all') {
      where.severity = severity;
    }

    const alerts = await prisma.alert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit, 10) || 50
    });

    const serializedAlerts = alerts.map((a) => ({
      ...a,
      timestampMs: a.timestampMs ? Number(a.timestampMs) : null
    }));

    res.json({ alerts: serializedAlerts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/alerts - Clear alerts history
router.delete('/', authenticateToken, async (req, res) => {
  try {
    await prisma.alert.deleteMany();
    res.json({ message: 'Historique des alertes effacé.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
