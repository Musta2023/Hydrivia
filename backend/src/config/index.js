import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT, 10) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'hydrivia_jwt_default_secret_key_2026',
  fusionAiSecret: process.env.FUSIONAI_WEBHOOK_SECRET || process.env.AI_WORKFLOW_SECRET || 'hydrivia_fusionai_secret_token_2026',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:r4es4xFzB7NCJEv5@db.dofpsqocufwbfosxblil.supabase.co:5432/postgres?sslmode=require',
  
  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@gmail.com',
    password: process.env.ADMIN_PASSWORD || 'AZERTY12345'
  },
  
  mqtt: {
    server: process.env.MQTT_SERVER || '6c645ee7581940979e4996096a09b2e7.s1.eu.hivemq.cloud',
    port: parseInt(process.env.MQTT_PORT, 10) || 8883,
    protocol: process.env.MQTT_PROTOCOL || 'mqtts',
    username: process.env.MQTT_USERNAME || 'Mustapha2323',
    password: process.env.MQTT_PASSWORD || 'AZERTY12345',
    clientId: process.env.MQTT_CLIENT_ID || `hydrivia-gateway-${Math.random().toString(16).substring(2, 8)}`,
    simulate: process.env.MQTT_SIMULATE === 'true'
  },
  
  site: {
    name: process.env.SITE_NAME || 'Station Agricole HYDRIVIA - Parcelle 1',
    latitude: parseFloat(process.env.SITE_LATITUDE) || 33.5731,
    longitude: parseFloat(process.env.SITE_LONGITUDE) || -7.5898
  }
};
