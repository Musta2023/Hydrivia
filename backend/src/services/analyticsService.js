import db from '../database/index.js';

export function getConsumptionAnalytics() {
  // 1. Totals
  const todayTotal = db.prepare(`
    SELECT COALESCE(SUM(delivered_liters), 0) as total, COALESCE(SUM(requested_liters), 0) as requested
    FROM irrigation_cycles
    WHERE date(start_time) = date('now') OR date(start_time) >= date('now', 'start of day')
  `).get();

  const weekTotal = db.prepare(`
    SELECT COALESCE(SUM(delivered_liters), 0) as total, COALESCE(SUM(requested_liters), 0) as requested
    FROM irrigation_cycles
    WHERE date(start_time) >= date('now', '-7 days')
  `).get();

  const monthTotal = db.prepare(`
    SELECT COALESCE(SUM(delivered_liters), 0) as total, COALESCE(SUM(requested_liters), 0) as requested
    FROM irrigation_cycles
    WHERE date(start_time) >= date('now', 'start of month')
  `).get();

  const allTimeTotal = db.prepare(`
    SELECT COALESCE(SUM(delivered_liters), 0) as total, COUNT(*) as cyclesCount
    FROM irrigation_cycles
  `).get();

  // 2. Consumption by Zone
  const zoneStats = db.prepare(`
    SELECT 
      zone_id, 
      plant, 
      COALESCE(SUM(delivered_liters), 0) as total_delivered,
      COALESCE(SUM(requested_liters), 0) as total_requested,
      COUNT(*) as cycles_count
    FROM irrigation_cycles
    GROUP BY zone_id, plant
    ORDER BY zone_id ASC
  `).all();

  // 3. Daily history (past 14 days)
  const dailyHistory = db.prepare(`
    SELECT 
      DATE(start_time) as date,
      zone_id,
      plant,
      COALESCE(SUM(delivered_liters), 0) as delivered,
      COALESCE(SUM(requested_liters), 0) as requested
    FROM irrigation_cycles
    WHERE start_time >= DATE('now', '-14 days')
    GROUP BY DATE(start_time), zone_id
    ORDER BY date ASC
  `).all();

  // Format daily history into chart format: { date, Tomate, Menthe, Oignon, total }
  const datesMap = {};
  dailyHistory.forEach(row => {
    if (!datesMap[row.date]) {
      datesMap[row.date] = { date: row.date, Tomate: 0, Menthe: 0, Oignon: 0, totalDelivered: 0, totalRequested: 0 };
    }
    if (row.zone_id === 1) datesMap[row.date].Tomate = parseFloat(row.delivered.toFixed(1));
    if (row.zone_id === 2) datesMap[row.date].Menthe = parseFloat(row.delivered.toFixed(1));
    if (row.zone_id === 3) datesMap[row.date].Oignon = parseFloat(row.delivered.toFixed(1));
    datesMap[row.date].totalDelivered += row.delivered;
    datesMap[row.date].totalRequested += row.requested;
  });

  const chartData = Object.values(datesMap).map(d => ({
    ...d,
    totalDelivered: parseFloat(d.totalDelivered.toFixed(1)),
    totalRequested: parseFloat(d.totalRequested.toFixed(1))
  }));

  // 4. Recent completed cycles
  const recentCycles = db.prepare(`
    SELECT * FROM irrigation_cycles
    ORDER BY start_time DESC
    LIMIT 20
  `).all();

  return {
    totals: {
      todayLiters: parseFloat(todayTotal.total.toFixed(1)),
      todayRequestedLiters: parseFloat(todayTotal.requested.toFixed(1)),
      weekLiters: parseFloat(weekTotal.total.toFixed(1)),
      weekRequestedLiters: parseFloat(weekTotal.requested.toFixed(1)),
      monthLiters: parseFloat(monthTotal.total.toFixed(1)),
      monthRequestedLiters: parseFloat(monthTotal.requested.toFixed(1)),
      allTimeLiters: parseFloat(allTimeTotal.total.toFixed(1)),
      totalCycles: allTimeTotal.cyclesCount
    },
    byZone: zoneStats.map(z => ({
      zoneId: z.zone_id,
      plant: z.plant,
      deliveredLiters: parseFloat(z.total_delivered.toFixed(1)),
      requestedLiters: parseFloat(z.total_requested.toFixed(1)),
      cyclesCount: z.cycles_count,
      efficiencyPct: z.total_requested > 0 ? parseFloat(((z.total_delivered / z.total_requested) * 100).toFixed(1)) : 100
    })),
    dailyChart: chartData,
    recentCycles
  };
}

export function generateCSVExport() {
  const rows = db.prepare(`
    SELECT 
      id,
      start_time,
      end_time,
      zone_id,
      plant,
      requested_liters,
      delivered_liters,
      target_soil_moisture,
      status,
      reason
    FROM irrigation_cycles
    ORDER BY start_time DESC
  `).all();

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

  rows.forEach(r => {
    const line = [
      r.id,
      r.start_time || '',
      r.end_time || '',
      r.zone_id,
      `"${r.plant}"`,
      r.requested_liters,
      r.delivered_liters,
      r.target_soil_moisture,
      `"${r.status}"`,
      `"${(r.reason || '').replace(/"/g, '""')}"`
    ];
    csvLines.push(line.join(';'));
  });

  return csvLines.join('\n');
}
