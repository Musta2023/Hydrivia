import React, { useState, useEffect } from 'react';
import {
  Layers,
  FlaskConical,
  Droplet,
  Leaf,
  MapPin,
  Info,
  CheckCircle2,
  HelpCircle
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import api from '../services/api';
import StatCard from '../components/common/StatCard';
import StatusBadge from '../components/common/StatusBadge';

export default function SoilPage() {
  const [soil, setSoil] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSoil() {
      try {
        const res = await api.get('/soil');
        setSoil(res.data);
      } catch (err) {
        console.error('Error fetching soil data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadSoil();
  }, []);

  const texture = soil?.texture || { clayPct: 28.5, sandPct: 37.2, siltPct: 34.3, type: 'Limono-Argileux', description: 'Sol équilibré' };
  const chemistry = soil?.chemistry || { ph: 7.2, phCategory: 'Neutre', organicMatterPct: 3.3, organicCarbonGPerKg: 19.2 };
  const waterProps = soil?.waterProperties || { fieldCapacityPct: 32.5, drainageCategory: 'Modéré', irrigationAdvice: 'Arrosage régulier' };

  const texturePieData = [
    { name: 'Argile (Clay)', value: texture.clayPct, color: '#ffaa00' },
    { name: 'Sable (Sand)', value: texture.sandPct, color: '#00b4d8' },
    { name: 'Limon (Silt)', value: texture.siltPct, color: '#00ff88' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-hydra-neon/15 text-hydra-neon border border-hydra-neon/30">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-hydra-textMain">
              Analyse Pédologique du Sol (SoilGrids ISRIC)
            </h2>
            <p className="text-xs text-hydra-textMuted flex items-center gap-1.5 mt-0.5">
              <MapPin className="w-3.5 h-3.5 text-hydra-neon" />
              <span>{soil?.siteName || 'Station HYDRIVIA'} ({soil?.coordinates?.latitude}, {soil?.coordinates?.longitude})</span>
            </p>
          </div>
        </div>

        <div className="text-xs font-mono text-hydra-textMuted bg-hydra-dark/80 px-3 py-1.5 rounded-xl border border-hydra-border">
          Base ISRIC SoilGrids v2.0
        </div>
      </div>

      {/* Main Soil KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Type de Texture"
          value={texture.type}
          subtitle="Classification granulométrique"
          icon={Layers}
          highlight
        />
        <StatCard
          title="pH de l'Eau (pH H₂O)"
          value={chemistry.ph}
          unit=""
          subtitle={`Catégorie : ${chemistry.phCategory}`}
          icon={FlaskConical}
        />
        <StatCard
          title="Capacité au Champ (Rétention)"
          value={waterProps.fieldCapacityPct}
          unit="% vol"
          subtitle={`Drainage : ${waterProps.drainageCategory}`}
          icon={Droplet}
        />
        <StatCard
          title="Matière Organique"
          value={chemistry.organicMatterPct}
          unit="%"
          subtitle={`Carbone organique : ${chemistry.organicCarbonGPerKg} g/kg`}
          icon={Leaf}
        />
      </div>

      {/* Texture Breakdown & Agronomic Interpretation Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Texture Pie Chart (5 cols) */}
        <div className="lg:col-span-5 glass-panel rounded-2xl p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-hydra-textMain uppercase tracking-wider">
              Répartition Granulométrique (%)
            </h3>
            <span className="text-xs font-mono text-hydra-neon">0 - 15 cm</span>
          </div>

          <div className="h-64 w-full flex items-center justify-center my-auto">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={texturePieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {texturePieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="#0d1311" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#121a17',
                    borderColor: '#00ff88',
                    borderRadius: '12px',
                    color: '#e0ece6',
                    fontSize: '12px',
                    fontFamily: 'monospace'
                  }}
                  itemStyle={{ color: '#e0ece6' }}
                  labelStyle={{ color: '#8da89c' }}
                  formatter={(val, name) => [`${val}%`, name]}
                />
                <Legend
                  wrapperStyle={{ fontSize: '12px', fontFamily: 'monospace', color: '#e0ece6' }}
                  formatter={(value) => <span style={{ color: '#e0ece6' }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="pt-3 border-t border-hydra-border/60 text-xs text-hydra-textMuted font-mono text-center">
            Texture dominante : <span className="text-hydra-neon font-bold">{texture.type}</span>
          </div>
        </div>

        {/* Right: Agronomic Context & Irrigation Guidance (7 cols) */}
        <div className="lg:col-span-7 glass-panel rounded-2xl p-6 flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-sm font-bold text-hydra-textMain uppercase tracking-wider mb-2 flex items-center gap-2">
              <Info className="w-4 h-4 text-hydra-neon" />
              Recommandations Agronomiques Liées au Sol
            </h3>
            <p className="text-xs text-hydra-textMuted mb-4">
              Données contextuelles issues des modèles numériques globaux pour ajuster les seuils d'arrosage.
            </p>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl bg-hydra-dark/70 border border-hydra-border">
                <span className="font-bold text-hydra-neon block mb-1">
                  1. Rétention d'eau & Capacité au champ ({waterProps.fieldCapacityPct}%)
                </span>
                <p className="text-hydra-textMuted leading-relaxed">
                  {texture.description} La capacité au champ de {waterProps.fieldCapacityPct}% indique que le sol conserve l'eau efficacement. Éviter d'arroser au-delà de 70% d'humidité pour prévenir l'asphyxie racinaire.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-hydra-dark/70 border border-hydra-border">
                <span className="font-bold text-hydra-neon block mb-1">
                  2. Contexte pour les cultures HYDRIVIA
                </span>
                <ul className="text-hydra-textMuted space-y-1 list-disc list-inside">
                  <li><strong className="text-hydra-textMain">Tomate (Zone 1)</strong> : Cible idéale 50-60%. Sensible aux à-coups hydriques.</li>
                  <li><strong className="text-hydra-textMain">Menthe (Zone 2)</strong> : Cible idéale 55-65%. Sol frais et riche apprécié.</li>
                  <li><strong className="text-hydra-textMain">Oignon (Zone 3)</strong> : Cible idéale 40-50%. Craint l'excès d'humidité en fin de cycle.</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-hydra-border/60 flex items-center justify-between text-[11px] text-hydra-textDim font-mono">
            <span>ISRIC — World Soil Information (REST API v2.0)</span>
            <span className="text-hydra-neon font-bold">Profil Valide</span>
          </div>
        </div>
      </div>
    </div>
  );
}
