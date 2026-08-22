import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { getWeatherData } from '../services/weatherService.js';
import { config } from '../config/index.js';

const router = express.Router();

// GET /api/weather
router.get('/', authenticateToken, async (req, res) => {
  const lat = parseFloat(req.query.lat) || config.site.latitude;
  const lon = parseFloat(req.query.lon) || config.site.longitude;

  try {
    const data = await getWeatherData(lat, lon);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des données météo.' });
  }
});

export default router;
