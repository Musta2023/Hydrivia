import prisma from '../database/index.js';
import { broadcast } from './socketService.js';

/**
 * Centralized Alert Manager for HYDRIVIA Smart Irrigation System
 * 
 * Supports:
 * - Sources: 'HYDRIVIA', 'AI', 'MQTT', 'SYSTEM'
 * - Categories: 'WATER', 'PUMP', 'VALVE', 'SENSOR', 'API', 'CONNECTION', 'DATABASE'
 * - Severities: 'info', 'warning', 'error', 'critical'
 * - Smart Deduplication: Updates existing active alerts of the same (source, category, type, zoneId)
 * - Auto-resolution: Marks alerts as 'resolved' when condition recovers
 */

export async function createAlert({
  source = 'HYDRIVIA',
  category = 'SYSTEM',
  type = 'alert',
  severity = 'info',
  message = '',
  deviceId = null,
  zoneId = null,
  value = null,
  threshold = null,
  metadata = null
}) {
  try {
    const parsedZoneId = zoneId ? parseInt(zoneId, 10) : null;
    const parsedValue = value !== null && value !== undefined ? parseFloat(value) : null;
    const parsedThreshold = threshold !== null && threshold !== undefined ? parseFloat(threshold) : null;

    // Deduplication check: Is there already an active alert with the exact same (source, type, zoneId)?
    const existingActive = await prisma.alert.findFirst({
      where: {
        source,
        type,
        zoneId: parsedZoneId,
        status: 'active'
      },
      orderBy: { createdAt: 'desc' }
    });

    if (existingActive) {
      // Refresh existing active alert with updated value/message
      const updated = await prisma.alert.update({
        where: { id: existingActive.id },
        data: {
          severity,
          message: message || existingActive.message,
          value: parsedValue,
          threshold: parsedThreshold,
          metadata: metadata || existingActive.metadata
        }
      });

      broadcast('alert:update', {
        ...updated,
        timestampMs: updated.createdAt.getTime()
      });

      return updated;
    }

    // Create new alert row
    const newAlert = await prisma.alert.create({
      data: {
        source,
        category,
        type,
        severity,
        message,
        deviceId,
        zoneId: parsedZoneId,
        value: parsedValue,
        threshold: parsedThreshold,
        status: 'active',
        metadata: metadata || undefined,
        createdAt: new Date()
      }
    });

    broadcast('alert:new', {
      ...newAlert,
      timestampMs: newAlert.createdAt.getTime()
    });

    console.log(`[ALERT] [${source}/${category}] [${severity.toUpperCase()}] ${type}: ${message}`);
    return newAlert;
  } catch (error) {
    console.error('[ALERT-MANAGER] Error creating alert:', error.message);
    return null;
  }
}

/**
 * Resolve active alerts matching specific criteria (e.g. Tank level back to normal)
 */
export async function resolveAlerts({ source, category, type, zoneId = null }) {
  try {
    const where = { status: 'active' };
    if (source) where.source = source;
    if (category) where.category = category;
    if (type) where.type = type;
    if (zoneId !== null) where.zoneId = parseInt(zoneId, 10);

    const activeAlerts = await prisma.alert.findMany({ where });
    if (activeAlerts.length === 0) return 0;

    const resolvedAt = new Date();
    await prisma.alert.updateMany({
      where: { id: { in: activeAlerts.map(a => a.id) } },
      data: {
        status: 'resolved',
        resolvedAt
      }
    });

    activeAlerts.forEach((a) => {
      broadcast('alert:resolved', {
        id: a.id,
        type: a.type,
        resolvedAt: resolvedAt.toISOString()
      });
    });

    console.log(`[ALERT-MANAGER] Resolved ${activeAlerts.length} alert(s) for [${source || '*'}/${type || '*'}]`);
    return activeAlerts.length;
  } catch (error) {
    console.error('[ALERT-MANAGER] Error resolving alerts:', error.message);
    return 0;
  }
}

/**
 * Manually resolve a single alert by ID
 */
export async function resolveAlertById(id) {
  try {
    const alertId = parseInt(id, 10);
    const resolvedAt = new Date();
    const updated = await prisma.alert.update({
      where: { id: alertId },
      data: {
        status: 'resolved',
        resolvedAt
      }
    });

    broadcast('alert:resolved', {
      id: updated.id,
      type: updated.type,
      resolvedAt: resolvedAt.toISOString()
    });

    return updated;
  } catch (error) {
    console.error('[ALERT-MANAGER] Error resolving alert by id:', error.message);
    throw error;
  }
}
