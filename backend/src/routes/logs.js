import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import prisma from '../database/index.js';

const router = express.Router();

// GET /api/logs - List system audit logs with relational user
router.get('/', authenticateToken, async (req, res) => {
  const { limit = 100 } = req.query;

  try {
    const logs = await prisma.systemLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit, 10) || 100,
      include: {
        user: {
          select: { id: true, email: true }
        }
      }
    });

    const isOperator = req.user?.role === 'OPERATOR';

    // Serialize: redact user-identifying data for OPERATOR role
    const serialized = logs.map((log) => {
      if (isOperator) {
        return {
          id: log.id,
          event_type: log.eventType,
          description: log.description,
          user_email: log.userEmail === 'system' ? 'Système' : '[Masqué - Admin]',
          user_id: null,
          user: null,
          created_at: log.createdAt.toISOString()
        };
      }

      return {
        id: log.id,
        event_type: log.eventType,
        description: log.description,
        user_email: log.userEmail || (log.user ? log.user.email : null) || 'Système',
        user_id: log.userId,
        user: log.user,
        created_at: log.createdAt.toISOString()
      };
    });

    res.json({ logs: serialized });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
