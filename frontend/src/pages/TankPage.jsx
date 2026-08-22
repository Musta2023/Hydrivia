import React, { useState, useEffect } from 'react';
import {
  Droplets,
  AlertTriangle,
  Activity,
  History,
  TrendingDown,
  ShieldCheck,
  Zap
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { useSocket } from '../context/SocketContext';
import api from '../services/api';
import CircularGauge from '../components/common/CircularGauge';
import StatusBadge from '../components/common/StatusBadge';
import StatCard from '../components/common/StatCard';

export default function TankPage() {
  const { telemetry } = useSocket();
  const [period, setPeriod] = useState('24h');
  const [tankHistory, setTankHistory] = useState([]);

  const tank = telemetry.tank || {
    water_level: 75,
    volume_liters: 5250,
    capacity_liters: 7000,
    critical: false,
    low: false
  };

  useEffect(() => {
    async function loadHistory() {
      try {
        const res = await api.get(`/tank?period=${period}`);
        setTankHistory(res.data.history || []);
      } catch (err) {
        console.error('Error fetching tank history:', err);
      }
    }
    loadHistory();
  }, [period, tank.water_level]);

  const chartData = tankHistory.map((h) => ({
    time: period === '24h'
      ? new Date(h.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      : new Date(h.timestamp).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
    level: h.water_level,
    volume: h.volume_liters
  }));

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Niveau Actuel"
          value={(tank.water_level || 0).toFixed(1)}
          unit="%"
          subtitle="Capteur ultrason US-100"
          icon={Droplets}
          highlight={!tank.low && !tank.critical}
          alert={tank.critical}
        />
        <StatCard
          title="Volume d'eau"
          value={(tank.volume_liters || 0).toFixed(0)}
          unit="L"
          subtitle="Capacité max : 7 000 Litres"
          icon={Activity}
        />
        <StatCard
          title="Débit Pompe de Sortie"
          value="30.0"
          unit="L/min"
          subtitle="1.8 m³/heure nominal"
          icon={Zap}
          highlight={telemetry.pump?.pump === 'ON'}
        />
        <StatCard
          title="Autonomie Estimée"
          value={( (tank.volume_liters || 0) / 120 ).toFixed(1)}
          unit="Jours"
          subtitle="Sur base 120 L/jour moyen"
          icon={TrendingDown}
        />
      </div>

      {/* Center Layout: Gauge Details & Threshold Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Visual Tank Meter (5 cols) */}
        <div className="lg:col-span-5 glass-panel rounded-2xl p-6 flex flex-col items-center justify-between">
          <div className="w-full flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-hydra-textMain uppercase tracking-wider flex items-center gap-2">
              <Droplets className="w-4 h-4 text-hydra-neon" />
              Jauge du Réservoir
            </h3>
            <StatusBadge
              status={tank.critical ? 'critical' : tank.low ? 'low' : 'NORMAL'}
              label={tank.critical ? 'CRITIQUE' : tank.low ? 'BAS' : 'NORMAL'}
            />
          </div>

          <div className="my-6">
            <CircularGauge
              value={tank.water_level || 0}
              max={100}
              size={220}
              strokeWidth={16}
              unit="%"
              sublabel={`${(tank.volume_liters || 0).toFixed(0)} / 7000 L`}
              color={tank.critical ? '#ff3b3b' : tank.low ? '#ffaa00' : '#00ff88'}
            />
          </div>

          {/* Safety Threshold Visualizer */}
          <div className="w-full pt-4 border-t border-hydra-border space-y-2.5 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-hydra-dark/70 border border-hydra-border">
              <span className="flex items-center gap-2 text-hydra-neon">
                <ShieldCheck className="w-4 h-4" />
                <span>Niveau Normal (&gt; 30%)</span>
              </span>
              <span className="font-mono font-bold text-hydra-textMain">&gt; 2 100 L</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-hydra-dark/70 border border-hydra-warning/30 text-hydra-warning">
              <span className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                <span>Seuil Bas (30%) — Alerte</span>
              </span>
              <span className="font-mono font-bold">2 100 L</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-hydra-dark/70 border border-hydra-alert/30 text-hydra-alert">
              <span className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                <span>Seuil Critique (20%) — Arrêt forcé</span>
              </span>
              <span className="font-mono font-bold">1 400 L</span>
            </div>
          </div>
        </div>

        {/* Right Column: Historical Level Area Chart (7 cols) */}
        <div className="lg:col-span-7 glass-panel rounded-2xl p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-hydra-textMain uppercase tracking-wider flex items-center gap-2">
              <History className="w-4 h-4 text-hydra-neon" />
              Évolution du Niveau d'Eau
            </h3>
            {/* Period Selector Tabs */}
            <div className="flex items-center gap-1 bg-hydra-dark p-1 rounded-xl border border-hydra-border text-xs font-mono">
              {['24h', '7d', '30d'].map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1 rounded-lg transition ${
                    period === p
                      ? 'bg-hydra-neon text-hydra-darkest font-bold shadow-[0_0_10px_#00ff88]'
                      : 'text-hydra-textMuted hover:text-hydra-textMain'
                  }`}
                >
                  {p.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Area Chart */}
          <div className="h-72 w-full my-auto">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="tankLevelGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00ff88" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#00ff88" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2e28" />
                  <XAxis dataKey="time" stroke="#526b60" fontSize={11} />
                  <YAxis domain={[0, 100]} stroke="#526b60" fontSize={11} unit="%" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#121a17',
                      borderColor: '#00ff88',
                      borderRadius: '12px',
                      color: '#e0ece6',
                      fontSize: '12px',
                      fontFamily: 'monospace'
                    }}
                    formatter={(val, name) => [`${val}% (${((val / 100) * 7000).toFixed(0)} L)`, 'Niveau d\'eau']}
                  />
                  <Area
                    type="monotone"
                    dataKey="level"
                    stroke="#00ff88"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#tankLevelGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-hydra-textMuted font-mono">
                Chargement des données...
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-hydra-border/60 flex items-center justify-between text-xs text-hydra-textMuted font-mono">
            <span>CALIBRATION DU RÉSERVOIR : 180.69 CM = 0% | 1.21 CM = 100%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
