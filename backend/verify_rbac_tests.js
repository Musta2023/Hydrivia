import express from 'express';
import http from 'http';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import axios from 'axios';
import prisma from './src/database/index.js';
import { config } from './src/config/index.js';

// Route imports
import authRoutes from './src/routes/auth.js';
import usersRoutes from './src/routes/users.js';
import zonesRoutes from './src/routes/zones.js';
import tankRoutes from './src/routes/tank.js';
import pumpRoutes from './src/routes/pump.js';
import analyticsRoutes from './src/routes/analytics.js';
import weatherRoutes from './src/routes/weather.js';
import soilRoutes from './src/routes/soil.js';
import alertsRoutes from './src/routes/alerts.js';
import logsRoutes from './src/routes/logs.js';
import emergencyRoutes from './src/routes/emergency.js';
import aiAnalysisRoutes from './src/routes/aiAnalysis.js';

function createTestServer() {
  const app = express();
  app.use(cors({ origin: '*' }));
  app.use(express.json());

  app.use('/api/auth', authRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/zones', zonesRoutes);
  app.use('/api/tank', tankRoutes);
  app.use('/api/pump', pumpRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/weather', weatherRoutes);
  app.use('/api/soil', soilRoutes);
  app.use('/api/alerts', alertsRoutes);
  app.use('/api/logs', logsRoutes);
  app.use('/api/emergency', emergencyRoutes);
  app.use('/api/ai-analysis', aiAnalysisRoutes);

  return http.createServer(app);
}

async function runTests() {
  console.log('====================================================');
  console.log('  🧪 HYDRIVIA RBAC AUTOMATED TEST SUITE');
  console.log('====================================================\n');

  const server = createTestServer();
  await new Promise((resolve) => server.listen(0, resolve));
  const testPort = server.address().port;
  const BASE_URL = `http://localhost:${testPort}/api`;
  console.log(`[INIT] In-process test server running on port ${testPort}\n`);

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // 1. Verify Database Migration & Existing Admin
    console.log('[TEST GROUP 1] Database & Migration Verification');
    const adminUser = await prisma.user.findFirst({
      where: { email: config.admin.email }
    });
    assert(adminUser !== null, `Existing admin user (${config.admin.email}) exists in DB`);
    assert(adminUser.role === 'ADMIN', `Existing admin has role 'ADMIN'`);

    // 2. Admin Login
    console.log('\n[TEST GROUP 2] Authentication & Token Issuance');
    const adminLoginRes = await axios.post(`${BASE_URL}/auth/login`, {
      email: config.admin.email,
      password: config.admin.password
    });
    assert(adminLoginRes.status === 200, 'Admin login succeeded (HTTP 200)');
    const adminToken = adminLoginRes.data.token;
    assert(!!adminToken, 'Admin JWT token received');
    const decodedAdminToken = jwt.verify(adminToken, config.jwtSecret);
    assert(decodedAdminToken.role === 'ADMIN', 'Admin JWT payload contains role: ADMIN');

    // 3. User Provisioning via /api/users (Admin-only)
    console.log('\n[TEST GROUP 3] User Management & Provisioning (/api/users)');
    const testOperatorEmail = `test_operator_${Date.now()}@hydrivia.local`;
    const testOperatorPass = 'OperatorPass123!';

    const createUserRes = await axios.post(
      `${BASE_URL}/users`,
      {
        email: testOperatorEmail,
        password: testOperatorPass,
        role: 'OPERATOR'
      },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    assert(createUserRes.status === 201, 'Admin created new OPERATOR user (HTTP 201)');
    assert(createUserRes.data.user.role === 'OPERATOR', 'Created user has role OPERATOR');
    const createdUserId = createUserRes.data.user.id;

    // Verify list users as Admin
    const listUsersRes = await axios.get(`${BASE_URL}/users`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(listUsersRes.status === 200, 'Admin can list users (HTTP 200)');
    assert(Array.isArray(listUsersRes.data.users) && listUsersRes.data.users.length >= 2, 'User list contains users');

    // 4. Operator Login
    console.log('\n[TEST GROUP 4] Operator Authentication');
    const opLoginRes = await axios.post(`${BASE_URL}/auth/login`, {
      email: testOperatorEmail,
      password: testOperatorPass
    });
    assert(opLoginRes.status === 200, 'Operator login succeeded (HTTP 200)');
    const opToken = opLoginRes.data.token;
    const decodedOpToken = jwt.verify(opToken, config.jwtSecret);
    assert(decodedOpToken.role === 'OPERATOR', 'Operator JWT payload contains role: OPERATOR');

    // 5. Operator Blocked from User Management
    console.log('\n[TEST GROUP 5] Operator Restriction on User Management');
    try {
      await axios.get(`${BASE_URL}/users`, {
        headers: { Authorization: `Bearer ${opToken}` }
      });
      assert(false, 'Operator accessing GET /api/users should be rejected');
    } catch (err) {
      assert(err.response?.status === 403, 'Operator blocked from GET /api/users (HTTP 403 Forbidden)');
    }

    try {
      await axios.post(
        `${BASE_URL}/users`,
        { email: 'hack@test.com', password: 'password123', role: 'ADMIN' },
        { headers: { Authorization: `Bearer ${opToken}` } }
      );
      assert(false, 'Operator creating user should be rejected');
    } catch (err) {
      assert(err.response?.status === 403, 'Operator blocked from POST /api/users (HTTP 403 Forbidden)');
    }

    // 6. Test Read Endpoints with Operator Token (All must return 200)
    console.log('\n[TEST GROUP 6] Operator Read-Only Access (HTTP 200 Expected)');
    const readEndpoints = [
      '/auth/me',
      '/zones',
      '/zones/1',
      '/tank',
      '/pump',
      '/analytics/consumption',
      '/weather',
      '/soil',
      '/alerts',
      '/logs',
      '/emergency/status',
      '/ai-analysis',
      '/ai-analysis/latest'
    ];

    for (const ep of readEndpoints) {
      try {
        const res = await axios.get(`${BASE_URL}${ep}`, {
          headers: { Authorization: `Bearer ${opToken}` }
        });
        assert(res.status === 200, `Operator read GET ${ep} -> HTTP 200 OK`);
      } catch (err) {
        assert(false, `Operator read GET ${ep} failed: ${err.message}`);
      }
    }

    // 7. Verify Privacy Redaction on /api/logs for Operator
    console.log('\n[TEST GROUP 7] Privacy Redaction on Audit Logs for Operator');
    const opLogsRes = await axios.get(`${BASE_URL}/logs`, {
      headers: { Authorization: `Bearer ${opToken}` }
    });
    const opLogs = opLogsRes.data.logs;
    const userEmailsExposed = opLogs.some(
      (l) => l.user_email && l.user_email !== 'Système' && !l.user_email.includes('[Masqué')
    );
    assert(!userEmailsExposed, 'Operator logs response redacts user identifying emails');

    const adminLogsRes = await axios.get(`${BASE_URL}/logs`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const adminLogs = adminLogsRes.data.logs;
    const adminHasFullEmails = adminLogs.some((l) => l.user_email && l.user_email.includes('@'));
    assert(adminHasFullEmails, 'Admin logs response retains full user emails');

    // 8. Test Mutating Endpoints with Operator Token (All must return 403)
    console.log('\n[TEST GROUP 8] Operator Action Blocking (HTTP 403 Forbidden Expected)');
    const actionEndpoints = [
      { method: 'post', path: '/zones/1/command', data: { wateringL: 10, targetSoilMoisturePct: 50 } },
      { method: 'post', path: '/zones/1/toggle', data: { action: 'ON' } },
      { method: 'post', path: '/emergency/stop', data: {} },
      { method: 'post', path: '/emergency/resume', data: {} },
      { method: 'patch', path: '/alerts/1/resolve', data: {} },
      { method: 'delete', path: '/alerts', data: {} },
      { method: 'patch', path: `/users/${createdUserId}/role`, data: { role: 'ADMIN' } },
      { method: 'delete', path: `/users/${createdUserId}`, data: {} }
    ];

    for (const act of actionEndpoints) {
      try {
        await axios({
          method: act.method,
          url: `${BASE_URL}${act.path}`,
          data: act.data,
          headers: { Authorization: `Bearer ${opToken}` }
        });
        assert(false, `Operator ${act.method.toUpperCase()} ${act.path} should have returned 403`);
      } catch (err) {
        assert(
          err.response?.status === 403,
          `Operator blocked on ${act.method.toUpperCase()} ${act.path} -> HTTP 403 Forbidden`
        );
      }
    }

    // 9. Test Mutating Endpoints with Admin Token (All must succeed)
    console.log('\n[TEST GROUP 9] Admin Action Execution (HTTP 200/201 Expected)');
    try {
      const zoneCmdRes = await axios.post(
        `${BASE_URL}/zones/1/command`,
        { wateringL: 15, targetSoilMoisturePct: 55 },
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      assert(zoneCmdRes.status === 200, 'Admin POST /api/zones/1/command -> HTTP 200 OK');
    } catch (err) {
      assert(false, `Admin POST /api/zones/1/command failed: ${err.message}`);
    }

    try {
      const emergStopRes = await axios.post(
        `${BASE_URL}/emergency/stop`,
        {},
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      assert(emergStopRes.status === 200, 'Admin POST /api/emergency/stop -> HTTP 200 OK');

      const emergResumeRes = await axios.post(
        `${BASE_URL}/emergency/resume`,
        {},
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      assert(emergResumeRes.status === 200, 'Admin POST /api/emergency/resume -> HTTP 200 OK');
    } catch (err) {
      assert(false, `Admin emergency controls failed: ${err.message}`);
    }

    // 10. Self-password change for Operator
    console.log('\n[TEST GROUP 10] Operator Self-Password Change');
    try {
      const selfPassRes = await axios.post(
        `${BASE_URL}/auth/change-password`,
        {
          currentPassword: testOperatorPass,
          newPassword: 'OperatorNewPass456!'
        },
        { headers: { Authorization: `Bearer ${opToken}` } }
      );
      assert(selfPassRes.status === 200, 'Operator can change their own password (HTTP 200 OK)');
    } catch (err) {
      assert(false, `Operator password change failed: ${err.message}`);
    }

    // 11. M2M Webhook Authentication (/api/ai-analysis unauthenticated by JWT)
    console.log('\n[TEST GROUP 11] M2M AI-Analysis Webhook Isolation');
    try {
      const aiWebhookRes = await axios.post(
        `${BASE_URL}/ai-analysis`,
        {
          timestamp: new Date().toISOString(),
          decisionStatus: 'IRRIGATE',
          confidencePct: 92,
          decisionSummary: 'Automated test agro-climatic inference'
        },
        {
          headers: {
            'x-fusionai-secret': config.fusionAiSecret,
            'idempotency-key': `test-ai-${Date.now()}`
          }
        }
      );
      assert(
        aiWebhookRes.status === 200 || aiWebhookRes.status === 201,
        'M2M AI Webhook POST /api/ai-analysis succeeds with shared secret (No user JWT required)'
      );
    } catch (err) {
      assert(false, `M2M Webhook failed: ${err.message}`);
    }

    // 12. Cleanup test operator
    console.log('\n[TEST GROUP 12] Cleanup');
    const deleteOpRes = await axios.delete(`${BASE_URL}/users/${createdUserId}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(deleteOpRes.status === 200, 'Admin deleted test operator account (HTTP 200 OK)');

    console.log('\n====================================================');
    console.log(`  🏁 TEST SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

    server.close();
    process.exit(failed === 0 ? 0 : 1);
  } catch (err) {
    console.error('Fatal test error:', err);
    server.close();
    process.exit(1);
  }
}

runTests();
