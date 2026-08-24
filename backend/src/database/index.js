import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { config } from '../config/index.js';

export const prisma = new PrismaClient({
  log: config.nodeEnv === 'development' ? ['warn', 'error'] : ['error']
});

export async function initDatabase() {
  try {
    // 1. Seed default admin user if not present
    const adminExists = await prisma.user.findUnique({
      where: { email: config.admin.email }
    });

    if (!adminExists) {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(config.admin.password, salt);
      await prisma.user.create({
        data: {
          email: config.admin.email,
          passwordHash,
          role: 'admin'
        }
      });
      console.log(`[DB-Prisma] Admin user created in Supabase: ${config.admin.email}`);
    }

    // 2. Seed initial sample historical data if empty
    const readingCount = await prisma.sensorReading.count();
    if (readingCount === 0) {
      await seedInitialHistory();
    }

    // 3. Seed sample AI analyses if empty
    const aiAnalysisCount = await prisma.aIAnalysis.count();
    if (aiAnalysisCount === 0) {
      await seedAiAnalyses();
    }

    console.log('[DB-Prisma] Connected to Supabase PostgreSQL via Prisma ORM successfully.');
  } catch (error) {
    console.error('[DB-Prisma] Error during database initialization:', error.message);
  }
}

async function seedInitialHistory() {
  console.log('[DB-Prisma] Seeding realistic historical data into Supabase...');
  const now = Date.now();
  const plants = ['Tomate', 'Menthe', 'Oignon'];

  const readings = [];
  for (let i = 24; i >= 0; i--) {
    const t = new Date(now - i * 3600 * 1000);
    const temp = parseFloat((22 + Math.sin(i / 3) * 5 + (Math.random() - 0.5) * 2).toFixed(1));
    const hum = parseFloat((55 + Math.cos(i / 3) * 12 + (Math.random() - 0.5) * 3).toFixed(1));
    const z1 = parseFloat((45 + Math.sin(i / 4) * 8 + (Math.random() - 0.5) * 2).toFixed(1));
    const z2 = parseFloat((52 + Math.cos(i / 4) * 10 + (Math.random() - 0.5) * 2).toFixed(1));
    const z3 = parseFloat((38 + Math.sin(i / 3) * 6 + (Math.random() - 0.5) * 2).toFixed(1));
    const level = parseFloat((78 - i * 0.4 + (Math.random() - 0.5)).toFixed(1));
    const volume = parseFloat(((level / 100) * 7000).toFixed(1));

    readings.push({
      timestamp: t,
      zone1Soil: z1,
      zone2Soil: z2,
      zone3Soil: z3,
      waterLevel: level,
      volumeLiters: volume,
      temperature: temp,
      airHumidity: hum,
      pumpRunning: false,
      valve1: false,
      valve2: false,
      valve3: false
    });
  }

  for (const r of readings) {
    await prisma.sensorReading.create({ data: r });
  }

  // Seed past 7 days of completed irrigation cycles
  for (let d = 7; d >= 1; d--) {
    for (let z = 1; z <= 3; z++) {
      const startTime = new Date(now - d * 24 * 3600 * 1000 + z * 3600 * 1000);
      const endTime = new Date(now - d * 24 * 3600 * 1000 + z * 3600 * 1000 + 12 * 60 * 1000);
      const reqL = [40, 30, 50][z - 1];
      const delL = parseFloat((reqL + (Math.random() - 0.5) * 4).toFixed(1));
      
      await prisma.irrigationCycle.create({
        data: {
          zoneId: z,
          plant: plants[z - 1],
          requestedLiters: reqL,
          targetSoilMoisture: 55,
          deliveredLiters: delL,
          startTime,
          endTime,
          status: 'completed',
          reason: 'Objectif volume atteint'
        }
      });
    }
  }

  // Seed alerts
  await prisma.alert.createMany({
    data: [
      {
        type: 'system_boot',
        severity: 'info',
        message: 'Système HYDRIVIA initialisé et connecté au broker MQTT.',
        timestampMs: BigInt(now - 24 * 3600 * 1000),
        createdAt: new Date(now - 24 * 3600 * 1000)
      },
      {
        type: 'watering_complete',
        severity: 'info',
        message: "Cycle d'irrigation terminé avec succès pour Zone 1 (Tomate) : 40.0 L livrés.",
        timestampMs: BigInt(now - 12 * 3600 * 1000),
        createdAt: new Date(now - 12 * 3600 * 1000)
      },
      {
        type: 'water_level_normal',
        severity: 'info',
        message: 'Niveau du réservoir optimal : 78% (5460 L).',
        timestampMs: BigInt(now - 6 * 3600 * 1000),
        createdAt: new Date(now - 6 * 3600 * 1000)
      }
    ]
  });

  // Seed system logs
  await prisma.systemLog.createMany({
    data: [
      {
        eventType: 'CONNEXION',
        description: 'Connexion réussie au broker HiveMQ Cloud TLS',
        userEmail: 'system',
        createdAt: new Date(now - 24 * 3600 * 1000)
      },
      {
        eventType: 'IRRIGATION_AUTO',
        description: 'Départ irrigation programmée Zone 1 (40L, cible 55%)',
        userEmail: 'admin@gmail.com',
        createdAt: new Date(now - 12 * 3600 * 1000)
      },
      {
        eventType: 'SYSTEM_START',
        description: 'Démarrage du serveur Gateway HYDRIVIA',
        userEmail: 'system',
        createdAt: new Date(now)
      }
    ]
  });

  console.log('[DB-Prisma] Telemetry and historical data seeded.');
}

async function seedAiAnalyses() {
  console.log('[DB-Prisma] Seeding sample FusionAI analyses...');
  const now = Date.now();

  const samples = [
    {
      id: 'ai-analysis-20260823-210000',
      timestamp: new Date(now - 15 * 60 * 1000),
      decisionStatus: 'IRRIGATE',
      validForMinutes: 60,
      confidencePct: 94,
      nextEvaluationMinutes: 120,
      waterBudget: {
        availableL: 5460,
        allocatedL: 120,
        conservedL: 30,
        utilizationPct: 68.5,
        scarcityLevel: 'NORMAL'
      },
      weatherAssessment: {
        nearTermRainExpected: false,
        meaningfulRainExpectedWithinHours: null,
        next24HoursRainMm: 0.0,
        atmosphericDemand: 'MODERATE',
        summary: 'Ciel dégagé, température en hausse à 26°C. Aucune précipitation prévue sous 48h.'
      },
      zoneDecisions: [
        {
          zoneId: 'zone-1',
          cropType: 'Tomates Grappes',
          priorityRank: 1,
          action: 'IRRIGATE',
          soilMoistureStatus: 'CRITICAL_LOW',
          cropStageAssessment: 'FLOWERING_FRUITING',
          riskLevel: 'HIGH',
          irrigationDepthMm: 12.5,
          wateringL: 50,
          rationale: 'Humidité du sol à 34% (seuil critique 40%). Stade de floraison nécessitant un apport hydrique régulier pour éviter la chute des fleurs.'
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
          wateringL: 40,
          rationale: "Humidité du sol à 42%. Apport recommandé pour maintenir l'évapotranspiration optimale."
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
          wateringL: 30,
          rationale: 'Humidité à 44%. Irrigation légère ciblée pour soutenir le grossissement des bulbes.'
        }
      ],
      decisionSummary: 'Irrigation immédiate recommandée pour toutes les zones. Priorité haute sur la Zone 1 (Tomates).',
      warnings: ['Réserve en eau optimale à 78%', 'Evapotranspiration élevée prévue entre 12h et 16h'],
      createdAt: new Date(now - 15 * 60 * 1000)
    },
    {
      id: 'ai-analysis-20260823-180000',
      timestamp: new Date(now - 3 * 3600 * 1000),
      decisionStatus: 'DEFER',
      validForMinutes: 180,
      confidencePct: 88,
      nextEvaluationMinutes: 180,
      waterBudget: {
        availableL: 5500,
        allocatedL: 0,
        conservedL: 120,
        utilizationPct: 45.0,
        scarcityLevel: 'LOW'
      },
      weatherAssessment: {
        nearTermRainExpected: true,
        meaningfulRainExpectedWithinHours: 4,
        next24HoursRainMm: 14.5,
        atmosphericDemand: 'LOW',
        summary: 'Averse modérée attendue dans 4 heures (estimée à 14.5 mm de pluie).'
      },
      zoneDecisions: [
        {
          zoneId: 'zone-1',
          cropType: 'Tomates Grappes',
          priorityRank: 1,
          action: 'DEFER',
          soilMoistureStatus: 'ADEQUATE',
          cropStageAssessment: 'FLOWERING_FRUITING',
          riskLevel: 'LOW',
          irrigationDepthMm: 0,
          wateringL: 0,
          rationale: "L'humidité actuelle (52%) est suffisante pour patienter jusqu'aux précipitations prévues."
        },
        {
          zoneId: 'zone-2',
          cropType: 'Menthe Poivrée',
          priorityRank: 2,
          action: 'DEFER',
          soilMoistureStatus: 'OPTIMAL',
          cropStageAssessment: 'VEGETATIVE_GROWTH',
          riskLevel: 'LOW',
          irrigationDepthMm: 0,
          wateringL: 0,
          rationale: 'Humidité optimale (58%). Averse imminente suffira amplement.'
        },
        {
          zoneId: 'zone-3',
          cropType: 'Oignons Jaunes',
          priorityRank: 3,
          action: 'DEFER',
          soilMoistureStatus: 'ADEQUATE',
          cropStageAssessment: 'BULB_DEVELOPMENT',
          riskLevel: 'LOW',
          irrigationDepthMm: 0,
          wateringL: 0,
          rationale: 'Humidité suffisante à 50%. Irrigation différée en attente des pluies.'
        }
      ],
      decisionSummary: "Report de l'irrigation sur les 3 zones en raison d'une pluie significative imminente (14.5mm prévus).",
      warnings: ["Risque potentiel d'engorgement si irrigation déclenchée avant la pluie"],
      createdAt: new Date(now - 3 * 3600 * 1000)
    },
    {
      id: 'ai-analysis-20260823-120000',
      timestamp: new Date(now - 9 * 3600 * 1000),
      decisionStatus: 'NO_IRRIGATION',
      validForMinutes: 360,
      confidencePct: 96,
      nextEvaluationMinutes: 360,
      waterBudget: {
        availableL: 5600,
        allocatedL: 0,
        conservedL: 150,
        utilizationPct: 30.0,
        scarcityLevel: 'LOW'
      },
      weatherAssessment: {
        nearTermRainExpected: false,
        meaningfulRainExpectedWithinHours: null,
        next24HoursRainMm: 0.0,
        atmosphericDemand: 'LOW',
        summary: 'Conditions fraîches et humides suite aux précipitations de la nuit.'
      },
      zoneDecisions: [
        {
          zoneId: 'zone-1',
          cropType: 'Tomates Grappes',
          priorityRank: 1,
          action: 'NO_IRRIGATION',
          soilMoistureStatus: 'SATURATED',
          cropStageAssessment: 'FLOWERING_FRUITING',
          riskLevel: 'NONE',
          irrigationDepthMm: 0,
          wateringL: 0,
          rationale: "Humidité du sol élevée (68%). Aucun besoin en eau."
        },
        {
          zoneId: 'zone-2',
          cropType: 'Menthe Poivrée',
          priorityRank: 2,
          action: 'NO_IRRIGATION',
          soilMoistureStatus: 'SATURATED',
          cropStageAssessment: 'VEGETATIVE_GROWTH',
          riskLevel: 'NONE',
          irrigationDepthMm: 0,
          wateringL: 0,
          rationale: 'Sol saturé à 72%. Irrigation inutile.'
        },
        {
          zoneId: 'zone-3',
          cropType: 'Oignons Jaunes',
          priorityRank: 3,
          action: 'NO_IRRIGATION',
          soilMoistureStatus: 'OPTIMAL',
          cropStageAssessment: 'BULB_DEVELOPMENT',
          riskLevel: 'NONE',
          irrigationDepthMm: 0,
          wateringL: 0,
          rationale: 'Humidité optimale à 64%. Aucun apport nécessaire.'
        }
      ],
      decisionSummary: "Aucune irrigation nécessaire pour l'ensemble des 3 zones. Les niveaux d'humidité dépassent les cibles.",
      warnings: [],
      createdAt: new Date(now - 9 * 3600 * 1000)
    }
  ];

  for (const s of samples) {
    await prisma.aIAnalysis.create({
      data: s
    });
  }

  console.log('[DB-Prisma] AI analyses seeded.');
}

export default prisma;
