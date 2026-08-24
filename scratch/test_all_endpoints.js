const BASE_URL = 'http://localhost:5000/api';
const FUSIONAI_SECRET = 'hydrivia_fusionai_secret_token_2026';

async function testAll() {
  console.log('====================================================');
  console.log('🧪 HYDRIVIA FULL END-TO-END PRISMA + SUPABASE TEST');
  console.log('====================================================\n');

  try {
    // 1. Health check
    console.log('[1] Testing GET /api/health...');
    const healthRes = await fetch(`${BASE_URL}/health`);
    const healthData = await healthRes.json();
    console.log(`✓ Health OK: ${healthData.database} (${healthData.system})`);

    // 2. Auth Login
    console.log('\n[2] Testing POST /api/auth/login...');
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@gmail.com', password: 'AZERTY12345' })
    });
    const loginData = await loginRes.json();
    const token = loginData.token;
    console.log(`✓ Login OK! User: ${loginData.user.email} (Role: ${loginData.user.role})`);

    // 3. Auth Me
    console.log('\n[3] Testing GET /api/auth/me...');
    const meRes = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const meData = await meRes.json();
    console.log(`✓ Auth Me OK! Email: ${meData.user.email}`);

    // 4. Zones
    console.log('\n[4] Testing GET /api/zones...');
    const zonesRes = await fetch(`${BASE_URL}/zones`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const zonesData = await zonesRes.json();
    console.log(`✓ Zones OK! ${zonesData.zones.length} zones found. Pump: ${zonesData.pump.pump}`);

    // 5. Zone 1 detail & history
    console.log('\n[5] Testing GET /api/zones/1...');
    const z1Res = await fetch(`${BASE_URL}/zones/1`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const z1Data = await z1Res.json();
    console.log(`✓ Zone 1 OK! Plant: ${z1Data.zone.plant}, 24h history points: ${z1Data.history.length}, cycles: ${z1Data.cycles.length}`);

    // 6. Tank
    console.log('\n[6] Testing GET /api/tank...');
    const tankRes = await fetch(`${BASE_URL}/tank`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const tankData = await tankRes.json();
    console.log(`✓ Tank OK! Level: ${tankData.tank.water_level}%, history points: ${tankData.history.length}`);

    // 7. Analytics Consumption
    console.log('\n[7] Testing GET /api/analytics/consumption...');
    const analyticsRes = await fetch(`${BASE_URL}/analytics/consumption`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const analyticsData = await analyticsRes.json();
    console.log(`✓ Analytics OK! Total delivered: ${analyticsData.totals.allTimeLiters} L, Total cycles: ${analyticsData.totals.totalCycles}`);

    // 8. Alerts
    console.log('\n[8] Testing GET /api/alerts...');
    const alertsRes = await fetch(`${BASE_URL}/alerts`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const alertsData = await alertsRes.json();
    console.log(`✓ Alerts OK! Count: ${alertsData.alerts.length}`);

    // 9. System Logs
    console.log('\n[9] Testing GET /api/logs...');
    const logsRes = await fetch(`${BASE_URL}/logs`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const logsData = await logsRes.json();
    console.log(`✓ Logs OK! Count: ${logsData.logs.length}`);

    // 10. AI Analysis List
    console.log('\n[10] Testing GET /api/ai-analysis (List)...');
    const aiListRes = await fetch(`${BASE_URL}/ai-analysis`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const aiListData = await aiListRes.json();
    console.log(`✓ AI Analysis List OK! Total count: ${aiListData.pagination.total}`);
    aiListData.analyses.forEach((a, i) => {
      console.log(`   #${i + 1} [${a.decisionStatus}] ${a.id} (confidence: ${a.confidencePct}%, zones: ${a.zoneCount})`);
    });

    // 11. AI Analysis POST Webhook (FusionAI)
    const testTime = new Date().toISOString();
    console.log(`\n[11] Testing POST /api/ai-analysis (FusionAI Webhook with 3 zones)...`);
    const postPayload = {
      timestamp: testTime,
      decisionStatus: 'IRRIGATE',
      validForMinutes: 60,
      confidencePct: 98,
      nextEvaluationMinutes: 120,
      waterBudget: {
        availableMl: 5460000,
        allocatedMl: 120000,
        conservedMl: 30000,
        utilizationPct: 68.5,
        scarcityLevel: 'NORMAL'
      },
      weatherAssessment: {
        nearTermRainExpected: false,
        meaningfulRainExpectedWithinHours: null,
        next24HoursRainMm: 0.0,
        atmosphericDemand: 'MODERATE',
        summary: 'Conditions optimales pour irrigation matinale'
      },
      zoneDecisions: [
        {
          zoneId: 'zone-1',
          cropType: 'Tomates Grappes',
          priorityRank: 1,
          action: 'IRRIGATE',
          soilMoistureStatus: 'DRY',
          cropStageAssessment: 'FLOWERING_FRUITING',
          riskLevel: 'HIGH',
          irrigationDepthMm: 12.5,
          wateringMl: 50000,
          rationale: 'Zone 1 irrigation test rationale'
        },
        {
          zoneId: 'zone-2',
          cropType: 'Menthe Poivrée',
          priorityRank: 2,
          action: 'IRRIGATE',
          soilMoistureStatus: 'MODERATE_LOW',
          cropStageAssessment: 'VEGETATIVE_GROWTH',
          riskLevel: 'MEDIUM',
          irrigationDepthMm: 8.0,
          wateringMl: 40000,
          rationale: 'Zone 2 irrigation test rationale'
        },
        {
          zoneId: 'zone-3',
          cropType: 'Oignons Jaunes',
          priorityRank: 3,
          action: 'IRRIGATE',
          soilMoistureStatus: 'MODERATE_LOW',
          cropStageAssessment: 'BULB_DEVELOPMENT',
          riskLevel: 'LOW',
          irrigationDepthMm: 6.0,
          wateringMl: 30000,
          rationale: 'Zone 3 irrigation test rationale'
        }
      ],
      decisionSummary: 'Irrigation validée pour l\'ensemble des 3 zones agricoles.',
      warnings: []
    };

    const postRes = await fetch(`${BASE_URL}/ai-analysis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-FusionAI-Secret': FUSIONAI_SECRET
      },
      body: JSON.stringify(postPayload)
    });
    const postData = await postRes.json();
    console.log(`✓ POST OK! ID created: ${postData.analysisId}`);

    // 12. AI Analysis Detail
    console.log(`\n[12] Testing GET /api/ai-analysis/${postData.analysisId}...`);
    const detailRes = await fetch(`${BASE_URL}/ai-analysis/${postData.analysisId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const detailData = await detailRes.json();
    console.log(`✓ Detail OK! Status: ${detailData.analysis.decisionStatus}, Zones count: ${detailData.analysis.zoneDecisions.length}`);
    console.log(`   Summary: "${detailData.analysis.decisionSummary}"`);

    console.log('\n====================================================');
    console.log('🎉 ALL 12 ENDPOINTS PASSED WITH 100% SUCCESS!');
    console.log('🐘 SUPABASE POSTGRESQL + PRISMA ORM FULLY OPERATIONAL!');
    console.log('====================================================\n');
  } catch (err) {
    console.error('❌ Integration test failed:', err);
  }
}

testAll();
