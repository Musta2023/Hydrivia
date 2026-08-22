import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Download,
  Calendar,
  Droplets,
  CheckCircle2,
  TrendingUp,
  Percent,
  Sprout
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import api from '../services/api';
import StatCard from '../components/common/StatCard';
import StatusBadge from '../components/common/StatusBadge';

export default function ConsumptionPage() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    async function loadAnalytics() {
      try {
        const res = await api.get('/analytics/consumption');
        setAnalytics(res.data);
      } catch (err) {
        console.error('Error fetching analytics:', err);
      } finally {
        setLoading(false);
      }
    }
    loadAnalytics();
  }, []);

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const response = await api.get('/analytics/export-csv', { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `hydrivia_consommation_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert('Erreur lors du téléchargement CSV : ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  const totals = analytics?.totals || {
    todayLiters: 0,
    weekLiters: 0,
    monthLiters: 0,
    allTimeLiters: 0,
    totalCycles: 0
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header with CSV Export Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel rounded-2xl p-6">
        <div>
          <h2 className="text-lg font-bold text-hydra-textMain flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-hydra-neon" />
            Bilan & Consommation d'Eau d'Irrigation
          </h2>
          <p className="text-xs text-hydra-textMuted mt-1">
            Agrégation précise des volumes distribués par électrovanne et comparaison réel vs cible.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          disabled={exporting}
          className="neon-button px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 self-start sm:self-auto shadow-lg"
        >
          <Download className="w-4 h-4" />
          <span>{exporting ? 'Exportation en cours...' : 'EXPORTER L\'HISTORIQUE (CSV)'}</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Consommation Aujourd'hui"
          value={totals.todayLiters.toFixed(1)}
          unit="L"
          subtitle={`Demande : ${totals.todayRequestedLiters || totals.todayLiters} L`}
          icon={Droplets}
          highlight
        />
        <StatCard
          title="Consommation 7 Jours"
          value={totals.weekLiters.toFixed(1)}
          unit="L"
          subtitle="Cumul hebdomadaire"
          icon={Calendar}
        />
        <StatCard
          title="Consommation du Mois"
          value={totals.monthLiters.toFixed(1)}
          unit="L"
          subtitle="Cumul mensuel en cours"
          icon={TrendingUp}
        />
        <StatCard
          title="Cycles d'Arrosage"
          value={totals.totalCycles}
          unit="cycles"
          subtitle={`Total : ${totals.allTimeLiters.toFixed(0)} L distribués`}
          icon={CheckCircle2}
        />
      </div>

      {/* Consumption Bar Chart comparing Actual vs Requested */}
      <div className="glass-panel rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-hydra-textMain uppercase tracking-wider">
              Consommation par Zone & Jour (14 Derniers Jours)
            </h3>
            <p className="text-xs text-hydra-textMuted mt-0.5">
              Volume réel distribué (Litres) par culture
            </p>
          </div>
          <div className="text-xs font-mono text-hydra-neon bg-hydra-neon/10 px-3 py-1 rounded-lg border border-hydra-neon/30">
            Litres (L)
          </div>
        </div>

        <div className="h-80 w-full">
          {analytics?.dailyChart?.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.dailyChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2e28" />
                <XAxis dataKey="date" stroke="#526b60" fontSize={11} />
                <YAxis stroke="#526b60" fontSize={11} unit=" L" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#121a17',
                    borderColor: '#00ff88',
                    borderRadius: '12px',
                    color: '#e0ece6',
                    fontSize: '12px',
                    fontFamily: 'monospace'
                  }}
                />
                <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }} />
                <Bar dataKey="Tomate" fill="#00ff88" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Menthe" fill="#00b4d8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Oignon" fill="#ffaa00" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-hydra-textMuted font-mono">
              Chargement des données...
            </div>
          )}
        </div>
      </div>

      {/* Breakdown per Zone Table */}
      <div className="glass-panel rounded-2xl p-6">
        <h3 className="text-sm font-bold text-hydra-textMain uppercase tracking-wider mb-4 flex items-center gap-2">
          <Sprout className="w-4 h-4 text-hydra-neon" />
          Rendement & Efficacité par Culture
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-hydra-border text-hydra-textMuted">
                <th className="pb-3 font-semibold">ZONE</th>
                <th className="pb-3 font-semibold">CULTURE</th>
                <th className="pb-3 font-semibold">VOLUME DEMANDÉ</th>
                <th className="pb-3 font-semibold">VOLUME LIVRÉ</th>
                <th className="pb-3 font-semibold">NB CYCLES</th>
                <th className="pb-3 font-semibold">EFFICACITÉ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hydra-border/60">
              {(analytics?.byZone || []).map((z) => (
                <tr key={z.zoneId} className="hover:bg-hydra-dark/40 transition">
                  <td className="py-3 font-bold text-hydra-neon">Zone {z.zoneId}</td>
                  <td className="py-3 font-sans font-semibold text-hydra-textMain">{z.plant}</td>
                  <td className="py-3 text-hydra-textMuted">{z.requestedLiters} L</td>
                  <td className="py-3 text-hydra-textMain font-bold">{z.deliveredLiters} L</td>
                  <td className="py-3 text-hydra-textMuted">{z.cyclesCount}</td>
                  <td className="py-3">
                    <span className="px-2 py-0.5 rounded-full bg-hydra-neon/15 text-hydra-neon border border-hydra-neon/30 font-bold">
                      {z.efficiencyPct}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
