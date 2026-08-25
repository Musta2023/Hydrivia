import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import prisma from '../database/index.js';
import { resolveAlertById } from '../services/alertService.js';

const router = express.Router();

// GET /api/alerts - List alerts with rich filtering
router.get('/', authenticateToken, async (req, res) => {
  try {
    const {
      source,
      category,
      severity,
      status,
      zoneId,
      limit = 50
    } = req.query;

    const where = {};
    if (source && source !== 'all') where.source = source;
    if (category && category !== 'all') where.category = category;
    if (severity && severity !== 'all') where.severity = severity;
    if (status && status !== 'all') where.status = status;
    if (zoneId && zoneId !== 'all') where.zoneId = parseInt(zoneId, 10);

    const alerts = await prisma.alert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit, 10) || 50
    });

    const serializedAlerts = alerts.map((a) => ({
      id: a.id,
      source: a.source,
      category: a.category,
      type: a.type,
      severity: a.severity,
      message: a.message,
      deviceId: a.deviceId,
      zoneId: a.zoneId,
      value: a.value,
      threshold: a.threshold,
      status: a.status,
      metadata: a.metadata,
      created_at: a.createdAt.toISOString(),
      createdAt: a.createdAt.toISOString(),
      resolved_at: a.resolvedAt ? a.resolvedAt.toISOString() : null,
      resolvedAt: a.resolvedAt ? a.resolvedAt.toISOString() : null,
      timestampMs: a.timestampMs ? Number(a.timestampMs) : a.createdAt.getTime()
    }));

    res.json({ alerts: serializedAlerts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/alerts/:id/resolve - Resolve an active alert (ADMIN only)
router.patch('/:id/resolve', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const resolved = await resolveAlertById(id);
    res.json({ message: 'Alerte résolue avec succès.', alert: resolved });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/alerts - Clear alerts history (ADMIN only)
router.delete('/', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    await prisma.alert.deleteMany();
    res.json({ message: 'Historique des alertes effacé.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
