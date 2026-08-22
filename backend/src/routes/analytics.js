import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { getConsumptionAnalytics, generateCSVExport } from '../services/analyticsService.js';

const router = express.Router();

// GET /api/analytics/consumption
router.get('/consumption', authenticateToken, (req, res) => {
  try {
    const data = getConsumptionAnalytics();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/analytics/export-csv - Download water consumption history as CSV
router.get('/export-csv', authenticateToken, (req, res) => {
  try {
    const csvContent = generateCSVExport();
    const filename = `hydrivia_consommation_eau_${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csvContent); // UTF-8 BOM for Excel compatibility
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la génération du fichier CSV.' });
  }
});

export default router;
