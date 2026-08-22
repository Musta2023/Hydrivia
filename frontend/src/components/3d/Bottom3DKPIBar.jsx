import React from 'react';
import {
  Thermometer,
  Droplets,
  Gauge,
  Sun,
  Activity,
  Radio,
  Wifi,
  Power,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { cn } from '../../utils/cn';

export default function Bottom3DKPIBar({
  telemetry,
  mqttConnected,
  onToggleValve,
  onTogglePump,
  onResetCamera,
  onSelectZone,
}) {
  const env = telemetry?.environment || { temperature: 24.2, air_humidity: 58.5 };
  const pump = telemetry?.pump || { pump: 'OFF', flow_rate: 30 };
  const tank = telemetry?.tank || { water_level: 75.0, volume_liters: 5250, capacity_liters: 7000 };
  const zones = telemetry?.zones || {
    1: { id: 1, plant: 'Tomate', soil_humidity: 45, valve: 'OFF' },
    2: { id: 2, plant: 'Menthe', soil_humidity: 52, valve: 'OFF' },
    3: { id: 3, plant: 'Oignon', soil_humidity: 38, valve: 'OFF' },
  };

  const activeZonesCount = Object.values(zones).filter(
    (z) => z.valve === 'ON' || z.watering_active
  ).length;

  return (
    <div className="w-full bg-hydra-darkest/85 backdrop-blur-xl border-t border-hydra-border/70 px-4 py-2.5 flex items-center justify-between gap-3 select-none z-20 shrink-0 text-hydra-textMain shadow-[0_-8px_32px_rgba(0,0,0,0.6)]">
      {/* 1. MÉTÉO & ENVIRONNEMENT */}
      <div className="flex-1 bg-hydra-card/40 hover:bg-hydra-card/70 border border-hydra-border/50 rounded-xl px-3 py-2 transition-all flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-yellow-500/15 border border-yellow-500/30 flex items-center justify-center text-yellow-400 text-sm">
          <Sun className="w-4 h-4" />
        </div>
        <div className="flex flex-col">
          <div className="text-[9px] uppercase font-bold tracking-wider text-hydra-textMuted">
            MÉTÉO & AIR
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs font-mono font-bold text-white flex items-center gap-1">
              <Thermometer className="w-3 h-3 text-rose-400" />
              {env.temperature} °C
            </span>
            <span className="text-hydra-border">•</span>
            <span className="text-xs font-mono font-bold text-cyan-400 flex items-center gap-1">
              <Droplets className="w-3 h-3 text-cyan-400" />
              {env.air_humidity} %
            </span>
            <span className="text-hydra-border hidden sm:inline">•</span>
            <span className="text-[10px] font-mono text-hydra-textMuted hidden sm:inline">
              1013 hPa
            </span>
          </div>
        </div>
      </div>

      {/* 2. RÉSERVOIR D'EAU */}
      <div className="flex-1 bg-hydra-card/40 hover:bg-hydra-card/70 border border-hydra-border/50 rounded-xl px-3 py-2 transition-all flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 text-sm">
          💧
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex justify-between items-center text-[9px] uppercase font-bold tracking-wider text-hydra-textMuted">
            <span>RÉSERVOIR</span>
            <span className="font-mono text-cyan-400">{Number(tank.water_level).toFixed(1)} %</span>
          </div>
          <div className="w-full h-1 bg-hydra-border/80 rounded-full overflow-hidden mt-1">
            <div
              className="h-full bg-cyan-400 rounded-full transition-all"
              style={{ width: `${Math.min(100, Math.max(0, tank.water_level))}%` }}
            />
          </div>
          <div className="text-[10px] font-mono text-hydra-textMuted mt-0.5 truncate">
            {tank.volume_liters} L / {tank.capacity_liters} L
          </div>
        </div>
      </div>

      {/* 3. MOTOPOMPE & ÉTAT HYDRAULIQUE */}
      <div className="flex-1 bg-hydra-card/40 hover:bg-hydra-card/70 border border-hydra-border/50 rounded-xl px-3 py-2 transition-all flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all',
              pump.pump === 'ON'
                ? 'bg-hydra-neon/20 border border-hydra-neon/50 text-hydra-neon shadow-[0_0_10px_rgba(0,255,136,0.3)]'
                : 'bg-hydra-dark border border-hydra-border text-hydra-textDim'
            )}
          >
            ⚙️
          </div>
          <div className="flex flex-col">
            <div className="text-[9px] uppercase font-bold tracking-wider text-hydra-textMuted">
              POMPE 750W
            </div>
            <div className="text-[11px] font-mono font-bold flex items-center gap-1.5 mt-0.5">
              <span
                className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  pump.pump === 'ON' ? 'bg-hydra-neon animate-pulse' : 'bg-hydra-textDim'
                )}
              />
              <span className={pump.pump === 'ON' ? 'text-hydra-neon' : 'text-hydra-textDim'}>
                {pump.pump === 'ON' ? 'ACTIVE (30 L/MIN)' : 'EN VEILLE'}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={onTogglePump}
          className={cn(
            'px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1',
            pump.pump === 'ON'
              ? 'bg-hydra-alert/20 text-hydra-alert hover:bg-hydra-alert/30 border border-hydra-alert/40'
              : 'bg-hydra-neon/20 text-hydra-neon hover:bg-hydra-neon/30 border border-hydra-neon/40'
          )}
        >
          <Power className="w-3 h-3" />
          <span>{pump.pump === 'ON' ? 'STOP' : 'START'}</span>
        </button>
      </div>

      {/* 4. VANNES PARCELLES (1, 2, 3) */}
      <div className="flex-1 bg-hydra-card/40 hover:bg-hydra-card/70 border border-hydra-border/50 rounded-xl px-3 py-2 transition-all flex items-center justify-between gap-2">
        <div className="flex flex-col min-w-0">
          <div className="text-[9px] uppercase font-bold tracking-wider text-hydra-textMuted">
            VANNES ({activeZonesCount}/3 ON)
          </div>
          <div className="flex items-center gap-1 mt-1">
            {[1, 2, 3].map((zId) => {
              const z = zones[zId] || { id: zId, valve: 'OFF' };
              const isOn = z.valve === 'ON' || z.watering_active;
              return (
                <button
                  key={zId}
                  onClick={() => onToggleValve && onToggleValve(zId)}
                  className={cn(
                    'px-2 py-0.5 rounded font-mono text-[10px] font-bold transition-all border cursor-pointer',
                    isOn
                      ? 'bg-hydra-neon/20 text-hydra-neon border-hydra-neon/50 shadow-[0_0_8px_rgba(0,255,136,0.25)]'
                      : 'bg-hydra-dark/80 text-hydra-textDim border-hydra-border/60 hover:text-hydra-textMain'
                  )}
                  title={`Basculer Vanne Zone ${zId}`}
                >
                  V{zId} {isOn ? 'ON' : 'OFF'}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 5. LIAISON IOT & RÉINITIALISATION */}
      <div className="flex items-center gap-2">
        <div className="bg-hydra-card/40 border border-hydra-border/50 rounded-xl px-3 py-2 flex flex-col justify-between">
          <div className="text-[9px] uppercase font-bold tracking-wider text-hydra-textMuted flex items-center gap-1">
            <Radio className="w-3 h-3 text-hydra-neon" />
            <span>ESP32</span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 text-[10px] font-mono font-bold">
            <span
              className={cn(
                'w-1.5 h-1.5 rounded-full',
                mqttConnected ? 'bg-hydra-neon animate-pulse' : 'bg-hydra-alert'
              )}
            />
            <span className={mqttConnected ? 'text-hydra-neon' : 'text-hydra-alert'}>
              {mqttConnected ? 'MQTTS TLS' : 'HORS LIGNE'}
            </span>
          </div>
        </div>

        <button
          onClick={onResetCamera}
          className="p-2.5 rounded-xl bg-hydra-card/40 hover:bg-hydra-card border border-hydra-border/50 text-hydra-textMuted hover:text-hydra-neon transition-colors cursor-pointer"
          title="Réinitialiser la caméra 3D"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
