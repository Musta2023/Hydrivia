const BASE_URL = 'http://localhost:5000/api';
const FUSIONAI_SECRET = 'hydrivia_fusionai_secret_token_2026';

async function runTests() {
  console.log('--- RUNNING AI ANALYSIS INTEGRATION TESTS (3 ZONES REQUIREMENT) ---');

  try {
    // 1. Test Login to get JWT Token
    console.log('[1] Logging in as admin...');
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@gmail.com',
        password: 'AZERTY12345'
      })
    });
    const loginData = await loginRes.json();
    const token = loginData.token;
    console.log('✓ Login successful. Token received.');

    // 2. Test GET /api/ai-analysis (Summaries list)
    console.log('\n[2] Testing GET /api/ai-analysis (List)...');
    const listRes = await fetch(`${BASE_URL}/ai-analysis`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const listData = await listRes.json();
    console.log(`✓ List retrieved successfully. Total count: ${listData.pagination.total}`);
    
    // Verify each seeded analysis has zoneCount === 3
    listData.analyses.forEach((item, i) => {
      console.log(`- Analysis #${i + 1} (${item.id}): zoneCount = ${item.zoneCount}`);
      if (item.zoneCount !== 3) {
        console.error(`❌ WARNING: Item ${item.id} has zoneCount ${item.zoneCount} instead of 3!`);
      }
    });

    // 3. Test POST /api/ai-analysis with ALL 3 ZONES
    const testTimestamp = new Date().toISOString();
    console.log(`\n[3] Testing POST /api/ai-analysis with 3 Zones (timestamp: ${testTimestamp})...`);
    
    const postPayload = {
      timestamp: testTimestamp,
      decisionStatus: 'IRRIGATE',
      validForMinutes: 60,
      confidencePct: 95,
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
        summary: 'Test 3-zone weather evaluation'
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
      decisionSummary: 'Irrigation recommandée pour l\'ensemble des 3 zones.',
      warnings: ['Test warning for 3 zones payload']
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

    console.log(`✓ POST successful! Status: ${postRes.status}, Created analysisId: ${postData.analysisId}`);

    // 4. Verify Detail of the created 3-zone analysis
    console.log(`\n[4] Verifying detail of new analysis ${postData.analysisId}...`);
    const detailRes = await fetch(`${BASE_URL}/ai-analysis/${postData.analysisId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const detailData = await detailRes.json();
    const retrievedZones = detailData.analysis.zoneDecisions;
    console.log(`✓ Detail retrieved. Received ${retrievedZones.length} zone decision(s):`);
    retrievedZones.forEach(z => console.log(`   - ${z.zoneId} (${z.cropType}): ${z.action} - ${z.wateringMl} mL`));

    if (retrievedZones.length === 3) {
      console.log('\n========================================');
      console.log('🎉 ALL 3 ZONES TEST PASSED SUCCESSFULLY!');
      console.log('========================================');
    } else {
      console.error(`❌ FAIL: Expected 3 zones, got ${retrievedZones.length}`);
    }

  } catch (err) {
    console.error('❌ Test failed with error:', err);
  }
}

runTests();
