import express from 'express';
import http from 'http';
import cors from 'cors';
import { config } from './config/index.js';
import { initDatabase } from './database/index.js';
import { initSocket } from './services/socketService.js';
import { initMQTT } from './services/mqttService.js';

// Route imports
import authRoutes from './routes/auth.js';
import zonesRoutes from './routes/zones.js';
import tankRoutes from './routes/tank.js';
import pumpRoutes from './routes/pump.js';
import analyticsRoutes from './routes/analytics.js';
import weatherRoutes from './routes/weather.js';
import soilRoutes from './routes/soil.js';
import alertsRoutes from './routes/alerts.js';
import logsRoutes from './routes/logs.js';
import emergencyRoutes from './routes/emergency.js';

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());

// Initialize Core Subsystems
initDatabase();
initSocket(server);
initMQTT();

// API Routes Mounting
app.use('/api/auth', authRoutes);
app.use('/api/zones', zonesRoutes);
app.use('/api/tank', tankRoutes);
app.use('/api/pump', pumpRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/soil', soilRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/emergency', emergencyRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    system: 'HYDRIVIA Smart Irrigation Gateway',
    timestamp: new Date().toISOString(),
    env: config.nodeEnv
  });
});

// Start Server
const PORT = config.port;
server.listen(PORT, () => {
  console.log();
  console.log('====================================================');
  console.log(`  🌿 HYDRIVIA Backend Gateway lancé sur le port ${PORT}`);
  console.log(`  🔗 API: http://localhost:${PORT}/api/health`);
  console.log(`  🔐 Mode: ${config.nodeEnv}`);
  console.log('====================================================');
  console.log();
});
