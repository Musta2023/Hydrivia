import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import db from '../database/index.js';

const router = express.Router();

// GET /api/alerts - List alerts with filtering
router.get('/', authenticateToken, (req, res) => {
  const { severity, limit = 50 } = req.query;

  let query = 'SELECT * FROM alerts';
  const params = [];

  if (severity && severity !== 'all') {
    query += ' WHERE severity = ?';
    params.push(severity);
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(parseInt(limit, 10));

  try {
    const alerts = db.prepare(query).all(...params);
    res.json({ alerts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/alerts - Clear alerts history
router.delete('/', authenticateToken, (req, res) => {
  try {
    db.prepare('DELETE FROM alerts').run();
    res.json({ message: 'Historique des alertes effacé.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
