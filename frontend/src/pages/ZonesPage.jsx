import React, { useState, useEffect } from 'react';
import {
  Sprout,
  Play,
  Square,
  Send,
  Droplets,
  Gauge,
  Clock,
  History,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import CircularGauge from '../components/common/CircularGauge';
import StatusBadge from '../components/common/StatusBadge';

export default function ZonesPage() {
  const { telemetry, sendCommand, toggleZone, emergencyStopped } = useSocket();
  const { isAdmin, isOperator } = useAuth();
  const [selectedZone, setSelectedZone] = useState(1);
  const [wateringL, setWateringL] = useState(50);
  const [targetMoisture, setTargetMoisture] = useState(55);
  const [zoneDetails, setZoneDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');

  const currentZone = telemetry.zones?.[selectedZone] || {
    id: selectedZone,
    plant: ['Tomate', 'Menthe', 'Oignon'][selectedZone - 1],
    soil_humidity: 45,
    valve: 'OFF',
    watering_active: false
  };

  useEffect(() => {
    async function loadZoneDetails() {
      try {
        const res = await api.get(`/zones/${selectedZone}`);
        setZoneDetails(res.data);
      } catch (err) {
        console.error('Error fetching zone details:', err);
      }
    }
    loadZoneDetails();
  }, [selectedZone, currentZone.soil_humidity, currentZone.valve]);

  const handleCustomCommand = async (e) => {
    e.preventDefault();
    if (emergencyStopped) return;
    setLoading(true);
    setActionSuccess('');

    try {
      await sendCommand(selectedZone, {
        wateringL: parseFloat(wateringL),
        targetSoilMoisturePct: parseFloat(targetMoisture)
      });
      setActionSuccess(`Commande envoyée : ${wateringL} L vers ${currentZone.plant} (Cible: ${targetMoisture}%)`);
      setTimeout(() => setActionSuccess(''), 4000);
    } catch (err) {
      alert('Erreur envoi commande : ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const isWatering = currentZone.valve === 'ON' || currentZone.watering_active;

  // Chart data formatting
  const chartData = (zoneDetails?.history || []).map((h) => ({
    time: new Date(h.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    humidity: h.soil_humidity
  }));

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Zone Selector Tabs */}
      <div className="flex items-center gap-3 overflow-x-auto pb-1">
        {[1, 2, 3].map((zId) => {
          const z = telemetry.zones?.[zId] || { plant: ['Tomate', 'Menthe', 'Oignon'][zId - 1], valve: 'OFF' };
          const isSelected = selectedZone === zId;
          const isActive = z.valve === 'ON';

          return (
            <button
              key={zId}
              onClick={() => setSelectedZone(zId)}
              className={`flex items-center gap-3 px-5 py-3 rounded-2xl border text-sm font-bold tracking-wide transition-all ${
                isSelected
                  ? 'bg-hydra-card border-hydra-neon text-hydra-neon shadow-[0_0_20px_rgba(0,255,136,0.18)]'
                  : 'glass-panel text-hydra-textMuted hover:text-hydra-textMain hover:border-hydra-borderHighlight'
              }`}
            >
              <div
                className={`w-3 h-3 rounded-full ${
                  isActive ? 'bg-hydra-neon animate-ping' : 'bg-hydra-textDim'
                }`}
              />
              <span>Zone {zId} — {z.plant}</span>
              <StatusBadge status={z.valve} label={isActive ? 'EN ARROSAGE' : 'ARRÊT'} className="ml-1 text-[10px]" />
            </button>
          );
        })}
      </div>

      {/* Main Zone Controller Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Live Moisture Gauge & Direct Valve Toggle (5 cols) */}
        <div className="lg:col-span-5 glass-panel rounded-2xl p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-hydra-textMain">
                Zone {selectedZone} — {currentZone.plant}
              </h2>
              <p className="text-xs text-hydra-textMuted font-mono">
                Électrovanne GPIO dédiée
              </p>
            </div>
            <StatusBadge status={currentZone.valve} label={isWatering ? 'ACTIF' : 'INACTIF'} />
          </div>

          <div className="my-6 flex justify-center">
            <CircularGauge
              value={currentZone.soil_humidity || 0}
              max={100}
              size={210}
              strokeWidth={14}
              unit="%"
              label="Humidité du sol actuelle"
              sublabel={`Cible : ${targetMoisture}%`}
              color={(currentZone.soil_humidity || 0) < 30 ? '#ffaa00' : '#00ff88'}
            />
          </div>

          {/* Quick Manual Toggle Buttons */}
          <div className="pt-4 border-t border-hydra-border space-y-3">
            <div className="flex items-center justify-between text-xs text-hydra-textMuted">
              <span>Contrôle vanne direct :</span>
              <span className="font-mono font-bold text-hydra-textMain">
                {isWatering ? 'OUVERTE (Débit 30 L/min)' : 'FERMÉE'}
              </span>
            </div>

            {isAdmin ? (
              <button
                onClick={() => toggleZone(selectedZone, isWatering ? 'OFF' : 'ON')}
                disabled={emergencyStopped}
                className={`w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition shadow-lg ${
                  isWatering
                    ? 'bg-hydra-alert text-white hover:bg-hydra-alert/80 shadow-[0_0_20px_rgba(255,59,59,0.3)]'
                    : 'neon-button'
                }`}
              >
                {isWatering ? (
                  <>
                    <Square className="w-4 h-4" />
                    <span>ARRÊTER L'IRRIGATION (ZONE {selectedZone})</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    <span>DÉMARRER IRRIGATION MANUELLE</span>
                  </>
                )}
              </button>
            ) : (
              <div className="p-3 bg-hydra-dark/60 rounded-xl border border-hydra-border text-center text-xs font-mono text-hydra-textMuted">
                <span>🔒 Bascule manuelle réservée à l'administrateur</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Custom Watering Command Form (7 cols) */}
        <div className="lg:col-span-7 glass-panel rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-hydra-textMain uppercase tracking-wider flex items-center gap-2">
                <Droplets className="w-4 h-4 text-hydra-neon" />
                Commande d'Arrosage MQTT Personnalisée
              </h3>
              <span className="text-xs font-mono text-hydra-neon bg-hydra-neon/10 px-2.5 py-1 rounded-lg border border-hydra-neon/30">
                Zone {selectedZone} — {currentZone.plant}
              </span>
            </div>
            <p className="text-xs text-hydra-textMuted mb-6">
              Transmet la charge utile <code className="text-hydra-textMain bg-hydra-dark px-1.5 py-0.5 rounded font-mono">{"{ wateringL, targetSoilMoisturePct }"}</code> vers le topic <code className="text-hydra-neon font-mono">hydrivia/zones/{selectedZone}/command</code>.
            </p>

            {actionSuccess && (
              <div className="mb-4 p-3 bg-hydra-neon/20 border border-hydra-neon/40 rounded-xl text-hydra-neon text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{actionSuccess}</span>
              </div>
            )}

            {isOperator && (
              <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs flex items-center gap-2 font-mono">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-400" />
                <span>Mode Opérateur (Lecture Seule) : L'envoi de commandes MQTT vers les actionneurs est verrouillé.</span>
              </div>
            )}

            <form onSubmit={handleCustomCommand} className="space-y-5">
              {/* Volume in Liters Slider & Input */}
              <div className="p-4 rounded-xl bg-hydra-dark/70 border border-hydra-border space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-semibold text-hydra-textMuted uppercase flex items-center gap-2">
                    <Droplets className="w-4 h-4 text-hydra-neon" />
                    Volume d'eau requis (wateringL)
                  </label>
                  <span className="text-base font-mono font-bold text-hydra-neon">
                    {wateringL} Litres
                  </span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="500"
                  step="5"
                  disabled={!isAdmin}
                  value={wateringL}
                  onChange={(e) => setWateringL(Number(e.target.value))}
                  className="w-full accent-hydra-neon bg-hydra-border rounded-lg h-2 cursor-pointer disabled:opacity-50"
                />
                <div className="flex justify-between text-[10px] text-hydra-textDim font-mono">
                  <span>Min: 5 L</span>
                  <span>Temps estimé : {(wateringL / 30).toFixed(1)} min à 30 L/min</span>
                  <span>Max: 500 L</span>
                </div>
              </div>

              {/* Target Soil Moisture Slider & Input */}
              <div className="p-4 rounded-xl bg-hydra-dark/70 border border-hydra-border space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-semibold text-hydra-textMuted uppercase flex items-center gap-2">
                    <Gauge className="w-4 h-4 text-hydra-neon" />
                    Humidité du sol cible (targetSoilMoisturePct)
                  </label>
                  <span className="text-base font-mono font-bold text-hydra-neon">
                    {targetMoisture} %
                  </span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="90"
                  step="1"
                  disabled={!isAdmin}
                  value={targetMoisture}
                  onChange={(e) => setTargetMoisture(Number(e.target.value))}
                  className="w-full accent-hydra-neon bg-hydra-border rounded-lg h-2 cursor-pointer disabled:opacity-50"
                />
                <div className="flex justify-between text-[10px] text-hydra-textDim font-mono">
                  <span>20% (Sec)</span>
                  <span>Recommandé pour {currentZone.plant} : 50% - 65%</span>
                  <span>90% (Saturé)</span>
                </div>
              </div>

              {/* Submit Button */}
              {isAdmin ? (
                <button
                  type="submit"
                  disabled={loading || emergencyStopped}
                  className="w-full neon-button py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg"
                >
                  <Send className="w-4 h-4" />
                  <span>{loading ? 'Transmission en cours...' : `ENVOYER COMMANDE MQTT — ZONE ${selectedZone}`}</span>
                </button>
              ) : (
                <div className="w-full py-3.5 rounded-xl text-xs font-mono font-bold flex items-center justify-center gap-2 bg-hydra-dark/60 border border-hydra-border text-hydra-textMuted cursor-not-allowed">
                  <span>🔒 Commande MQTT désactivée en mode Opérateur</span>
                </div>
              )}
            </form>
          </div>

          <div className="mt-4 pt-3 border-t border-hydra-border/60 flex items-center justify-between text-[11px] text-hydra-textDim font-mono">
            <span>Arrêt automatique dès que le volume ou l'humidité cible est atteint.</span>
          </div>
        </div>
      </div>

      {/* Moisture History Line Chart for Selected Zone */}
      <div className="glass-panel rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-hydra-textMain uppercase tracking-wider flex items-center gap-2">
            <History className="w-4 h-4 text-hydra-neon" />
            Évolution de l'humidité du sol — 24 Dernières Heures ({currentZone.plant})
          </h3>
          <span className="text-xs font-mono text-hydra-textMuted">Télémétrie en %</span>
        </div>

        <div className="h-64 w-full">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
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
                />
                <Line
                  type="monotone"
                  dataKey="humidity"
                  name="Humidité sol"
                  stroke="#00ff88"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 6, fill: '#00ff88', stroke: '#070a09' }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-hydra-textMuted font-mono">
              Enregistrement de l'historique en cours...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
