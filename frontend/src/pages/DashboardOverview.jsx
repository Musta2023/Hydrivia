import React, { useMemo } from 'react';
import {
  Activity,
  Box,
  Droplets,
  Thermometer,
  Wind,
  Sprout,
  AlertTriangle,
  Play,
  Square,
  Zap,
  ArrowUpRight,
  ShieldAlert
} from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import StatCard from '../components/common/StatCard';
import CircularGauge from '../components/common/CircularGauge';
import StatusBadge from '../components/common/StatusBadge';

export default function DashboardOverview({ onNavigate }) {
  const { telemetry, mqttConnected, recentAlert, emergencyStopped, toggleZone, consumption } = useSocket();

  const { zones = {}, pump = {}, tank = {}, environment = {} } = telemetry;
  const isPumpRunning = pump.pump === 'ON';
  const activeValvesCount = Object.values(zones).filter(z => z.valve === 'ON').length;

  // Water consumption totals from real-time socket data
  const cTotals = consumption?.totals || {};
  const todayL = (cTotals.todayLiters || 0);
  const weekL = (cTotals.weekLiters || 0);
  const flowRate = isPumpRunning ? 30 : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 3D Digital Twin Quick Access Banner */}
      <div className="glass-panel p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-hydra-neon/30 bg-gradient-to-r from-hydra-neon/10 via-hydra-dark to-hydra-dark shadow-[0_0_20px_rgba(0,255,136,0.08)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-hydra-neon/20 border border-hydra-neon/50 flex items-center justify-center text-hydra-neon shadow-[0_0_15px_rgba(0,255,136,0.3)]">
            <Box className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-hydra-textMain flex items-center gap-2">
              Jumeau Numérique 3D Interactif
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-hydra-neon/20 text-hydra-neon border border-hydra-neon/40">
                TEMPS RÉEL
              </span>
            </h3>
            <p className="text-xs text-hydra-textMuted mt-0.5">
              Explorez l'exploitation en 3D temps réel, inspectez les parcelles et pilotez le système hydraulique.
            </p>
          </div>
        </div>
        <button
          onClick={() => onNavigate('3d')}
          className="neon-button px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 flex-shrink-0"
        >
          <span>Ouvrir la Vue 3D</span>
          <ArrowUpRight className="w-4 h-4" />
        </button>
      </div>
      {/* Emergency Stopped Banner */}
      {emergencyStopped && (
        <div className="p-4 bg-hydra-alert/20 border-2 border-hydra-alert rounded-2xl flex items-center justify-between gap-4 shadow-[0_0_30px_rgba(255,59,59,0.3)] animate-pulse">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-hydra-alert text-white rounded-xl">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-hydra-alert text-base tracking-wide">
                ARRÊT D'URGENCE ACTIF
              </h3>
              <p className="text-xs text-hydra-textMain">
                Toutes les vannes sont fermées et la pompe est désactivée pour des raisons de sécurité.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('zones')}
            className="px-4 py-2 bg-hydra-alert text-white font-bold text-xs rounded-xl hover:bg-hydra-alert/80 transition"
          >
            Gérer les vannes
          </button>
        </div>
      )}

      {/* Critical / High Alert Banner */}
      {recentAlert && (recentAlert.severity === 'high' || recentAlert.severity === 'critical') && (
        <div className="p-4 bg-hydra-alert/15 border border-hydra-alert/40 rounded-2xl flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-hydra-alert flex-shrink-0 animate-bounce" />
          <div className="flex-1 text-xs">
            <span className="font-bold text-hydra-alert uppercase tracking-wider mr-2">
              [{recentAlert.type}]
            </span>
            <span className="text-hydra-textMain">{recentAlert.message}</span>
          </div>
        </div>
      )}

      {/* Top Main KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Pompe Statut */}
        <StatCard
          title="Pompe Principale"
          value={isPumpRunning ? 'ACTIVE' : 'EN ATTENTE'}
          subtitle="Débit nominal : 30 L/min"
          icon={Activity}
          highlight={isPumpRunning}
          className={isPumpRunning ? 'ring-1 ring-hydra-neon' : ''}
        />

        {/* 2. Volume Réservoir */}
        <StatCard
          title="Volume d'eau utile"
          value={tank.volume_liters !== undefined ? tank.volume_liters.toFixed(0) : '5250'}
          unit="L"
          subtitle={`Capacité totale : ${tank.capacity_liters || 7000} L`}
          icon={Droplets}
          highlight={tank.water_level > 30}
          alert={tank.critical}
        />

        {/* 3. Température BME280 */}
        <StatCard
          title="Température Ambiante"
          value={environment.temperature !== undefined ? environment.temperature.toFixed(1) : '24.0'}
          unit="°C"
          subtitle="Capteur I2C BME280"
          icon={Thermometer}
        />

        {/* 4. Humidité de l'Air */}
        <StatCard
          title="Humidité de l'air"
          value={environment.air_humidity !== undefined ? environment.air_humidity.toFixed(1) : '58.0'}
          unit="%"
          subtitle="Humidité relative externe"
          icon={Wind}
        />
      </div>

      {/* Water Consumption Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Consommation Aujourd'hui"
          value={todayL.toFixed(1)}
          unit="L"
          subtitle={`Demande : ${(cTotals.todayRequestedLiters || todayL).toFixed(1)} L`}
          icon={Droplets}
          highlight={todayL > 0}
        />
        <StatCard
          title="Consommation 7 Jours"
          value={weekL.toFixed(1)}
          unit="L"
          subtitle="Cumul hebdomadaire"
          icon={Droplets}
        />
        <StatCard
          title="Débit Actuel"
          value={flowRate}
          unit="L/min"
          subtitle={isPumpRunning ? 'Pompe en marche' : 'Pompe à l\'arrêt'}
          icon={Zap}
          highlight={isPumpRunning}
          className={isPumpRunning ? 'ring-1 ring-hydra-neon' : ''}
        />
      </div>

      {/* Center Grid: Tank Gauge & 3 Irrigation Zones */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Water Tank Circular Gauge (4 cols) */}
        <div className="lg:col-span-4 glass-panel rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold tracking-wider uppercase text-hydra-textMain flex items-center gap-2">
              <Droplets className="w-4 h-4 text-hydra-neon" />
              Niveau du Réservoir
            </h2>
            <StatusBadge
              status={tank.critical ? 'critical' : tank.low ? 'low' : 'NORMAL'}
              label={tank.critical ? 'CRITIQUE' : tank.low ? 'BAS' : 'OPTIMAL'}
            />
          </div>

          <div className="my-auto py-4 flex justify-center">
            <CircularGauge
              value={tank.water_level || 0}
              max={100}
              size={190}
              strokeWidth={14}
              unit="%"
              sublabel={`${(tank.volume_liters || 0).toFixed(0)} L disponibles`}
              color={tank.critical ? '#ff3b3b' : tank.low ? '#ffaa00' : '#00ff88'}
            />
          </div>

          <div className="pt-4 border-t border-hydra-border/60 grid grid-cols-2 gap-3 text-xs">
            <div className="p-2.5 rounded-xl bg-hydra-dark/60 border border-hydra-border">
              <span className="text-hydra-textMuted block text-[11px]">Seuil Bas</span>
              <span className="font-mono font-bold text-hydra-warning">30% (2100 L)</span>
            </div>
            <div className="p-2.5 rounded-xl bg-hydra-dark/60 border border-hydra-border">
              <span className="text-hydra-textMuted block text-[11px]">Seuil Critique</span>
              <span className="font-mono font-bold text-hydra-alert">20% (1400 L)</span>
            </div>
          </div>
        </div>

        {/* Right: The 3 Zones Overview Cards (8 cols) */}
        <div className="lg:col-span-8 glass-panel rounded-2xl p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold tracking-wider uppercase text-hydra-textMain flex items-center gap-2">
                <Sprout className="w-4 h-4 text-hydra-neon" />
                Vannes & Humidité des Sols (3 Zones)
              </h2>
              <p className="text-xs text-hydra-textMuted mt-0.5">
                Capteurs capacitifs étalonnés (Zone 1 Tomate, Zone 2 Menthe, Zone 3 Oignon)
              </p>
            </div>
            <button
              onClick={() => onNavigate('zones')}
              className="text-xs font-semibold text-hydra-neon hover:underline flex items-center gap-1"
            >
              <span>Contrôle détaillé</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-auto py-2">
            {[1, 2, 3].map((zoneId) => {
              const zone = zones[zoneId] || { id: zoneId, plant: ['Tomate', 'Menthe', 'Oignon'][zoneId - 1], soil_humidity: 45, valve: 'OFF' };
              const isOpen = zone.valve === 'ON';

              return (
                <div
                  key={zoneId}
                  className={`p-4 rounded-xl border transition-all duration-200 ${
                    isOpen
                      ? 'bg-hydra-neon/10 border-hydra-neon/40 shadow-[0_0_15px_rgba(0,255,136,0.15)]'
                      : 'bg-hydra-dark/60 border-hydra-border hover:border-hydra-borderHighlight'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-mono font-bold text-hydra-textMuted uppercase">
                      Zone {zoneId}
                    </span>
                    <StatusBadge status={zone.valve} label={isOpen ? 'VANNE ON' : 'VANNE OFF'} />
                  </div>

                  <div className="text-base font-bold text-hydra-textMain mb-3 flex items-center gap-1.5">
                    <span>{zone.plant}</span>
                  </div>

                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs text-hydra-textMuted">Humidité sol :</span>
                    <span className="text-lg font-mono font-bold text-hydra-neon">
                      {(zone.soil_humidity || 0).toFixed(1)}%
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-hydra-dark h-2 rounded-full overflow-hidden border border-hydra-border mb-4">
                    <div
                      className="h-full bg-gradient-to-r from-hydra-neonDim to-hydra-neon transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(0, zone.soil_humidity || 0))}%` }}
                    />
                  </div>

                  {/* Quick Action button */}
                  <button
                    onClick={() => toggleZone(zoneId, isOpen ? 'OFF' : 'ON')}
                    disabled={emergencyStopped}
                    className={`w-full py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                      isOpen
                        ? 'bg-hydra-alert/20 text-hydra-alert hover:bg-hydra-alert/30 border border-hydra-alert/40'
                        : 'bg-hydra-border text-hydra-textMain hover:bg-hydra-neon hover:text-hydra-darkest border border-hydra-borderHighlight'
                    }`}
                  >
                    {isOpen ? (
                      <>
                        <Square className="w-3.5 h-3.5" />
                        <span>Fermer vanne</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" />
                        <span>Ouvrir vanne</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-3 border-t border-hydra-border/60 flex items-center justify-between text-xs text-hydra-textMuted font-mono">
            <span>RÈGLE DE SÉCURITÉ : TOUTES VANNES OFF ➔ POMPE ARRÊTÉE</span>
            <span className="text-hydra-neon font-bold">{activeValvesCount} vanne(s) active(s)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
