import prisma from '../database/index.js';

export async function getConsumptionAnalytics() {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // 1. Totals Aggregations
  const [todayAgg, weekAgg, monthAgg, allTimeAgg, totalCycles] = await Promise.all([
    prisma.irrigationCycle.aggregate({
      where: { startTime: { gte: startOfToday } },
      _sum: { deliveredLiters: true, requestedLiters: true }
    }),
    prisma.irrigationCycle.aggregate({
      where: { startTime: { gte: sevenDaysAgo } },
      _sum: { deliveredLiters: true, requestedLiters: true }
    }),
    prisma.irrigationCycle.aggregate({
      where: { startTime: { gte: startOfMonth } },
      _sum: { deliveredLiters: true, requestedLiters: true }
    }),
    prisma.irrigationCycle.aggregate({
      _sum: { deliveredLiters: true }
    }),
    prisma.irrigationCycle.count()
  ]);

  // 2. Consumption by Zone
  const zoneCycles = await prisma.irrigationCycle.groupBy({
    by: ['zoneId', 'plant'],
    _sum: { deliveredLiters: true, requestedLiters: true },
    _count: { id: true },
    orderBy: { zoneId: 'asc' }
  });

  const byZone = zoneCycles.map((z) => {
    const delivered = z._sum.deliveredLiters || 0;
    const requested = z._sum.requestedLiters || 0;
    return {
      zoneId: z.zoneId,
      plant: z.plant,
      deliveredLiters: parseFloat(delivered.toFixed(1)),
      requestedLiters: parseFloat(requested.toFixed(1)),
      cyclesCount: z._count.id,
      efficiencyPct: requested > 0 ? parseFloat(((delivered / requested) * 100).toFixed(1)) : 100
    };
  });

  // 3. Daily history (past 14 days)
  const fourteenDaysCycles = await prisma.irrigationCycle.findMany({
    where: { startTime: { gte: fourteenDaysAgo } },
    orderBy: { startTime: 'asc' }
  });

  const datesMap = {};
  fourteenDaysCycles.forEach((cycle) => {
    const dateStr = cycle.startTime.toISOString().split('T')[0];
    if (!datesMap[dateStr]) {
      datesMap[dateStr] = {
        date: dateStr,
        Tomate: 0,
        Menthe: 0,
        Oignon: 0,
        totalDelivered: 0,
        totalRequested: 0
      };
    }

    const del = cycle.deliveredLiters || 0;
    const req = cycle.requestedLiters || 0;

    if (cycle.zoneId === 1) datesMap[dateStr].Tomate += del;
    if (cycle.zoneId === 2) datesMap[dateStr].Menthe += del;
    if (cycle.zoneId === 3) datesMap[dateStr].Oignon += del;

    datesMap[dateStr].totalDelivered += del;
    datesMap[dateStr].totalRequested += req;
  });

  const dailyChart = Object.values(datesMap).map((d) => ({
    date: d.date,
    Tomate: parseFloat(d.Tomate.toFixed(1)),
    Menthe: parseFloat(d.Menthe.toFixed(1)),
    Oignon: parseFloat(d.Oignon.toFixed(1)),
    totalDelivered: parseFloat(d.totalDelivered.toFixed(1)),
    totalRequested: parseFloat(d.totalRequested.toFixed(1))
  }));

  // 4. Recent completed cycles
  const recentCycles = await prisma.irrigationCycle.findMany({
    orderBy: { startTime: 'desc' },
    take: 20
  });

  return {
    totals: {
      todayLiters: parseFloat((todayAgg._sum.deliveredLiters || 0).toFixed(1)),
      todayRequestedLiters: parseFloat((todayAgg._sum.requestedLiters || 0).toFixed(1)),
      weekLiters: parseFloat((weekAgg._sum.deliveredLiters || 0).toFixed(1)),
      weekRequestedLiters: parseFloat((weekAgg._sum.requestedLiters || 0).toFixed(1)),
      monthLiters: parseFloat((monthAgg._sum.deliveredLiters || 0).toFixed(1)),
      monthRequestedLiters: parseFloat((monthAgg._sum.requestedLiters || 0).toFixed(1)),
      allTimeLiters: parseFloat((allTimeAgg._sum.deliveredLiters || 0).toFixed(1)),
      totalCycles
    },
    byZone,
    dailyChart,
    recentCycles: recentCycles.map((c) => ({
      id: c.id,
      zone_id: c.zoneId,
      plant: c.plant,
      requested_liters: c.requestedLiters,
      delivered_liters: c.deliveredLiters,
      target_soil_moisture: c.targetSoilMoisture,
      start_time: c.startTime.toISOString(),
      end_time: c.endTime ? c.endTime.toISOString() : null,
      status: c.status,
      reason: c.reason
    }))
  };
}

export async function generateCSVExport() {
  const rows = await prisma.irrigationCycle.findMany({
    orderBy: { startTime: 'desc' }
  });

  const headers = [
    'ID',
    'Date_Debut',
    'Date_Fin',
    'Zone_ID',
    'Plante',
    'Volume_Demande_L',
    'Volume_Livre_L',
    'Humidite_Cible_Pct',
    'Statut',
    'Raison'
  ];

  const csvLines = [headers.join(';')];

  rows.forEach((r) => {
    const line = [
      r.id,
      r.startTime ? r.startTime.toISOString() : '',
      r.endTime ? r.endTime.toISOString() : '',
      r.zoneId,
      `"${r.plant}"`,
      r.requestedLiters ?? '',
      r.deliveredLiters ?? '',
      r.targetSoilMoisture ?? '',
      `"${r.status}"`,
      `"${(r.reason || '').replace(/"/g, '""')}"`
    ];
    csvLines.push(line.join(';'));
  });

  return csvLines.join('\n');
}
