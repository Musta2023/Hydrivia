import React from 'react';
import { Thermometer, Droplets, Gauge, Sun, CloudRain, Radio, Wifi, Activity, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { cn } from '../../utils/cn';

export default function Right3DPanel({
  telemetry,
  mqttConnected,
  onToggleValve,
  onTogglePump,
  onSelectZone,
}) {
  const env = telemetry?.environment || { temperature: 24.2, air_humidity: 58.5 };
  const pump = telemetry?.pump || { pump: 'OFF' };
  const zones = telemetry?.zones || {
    1: { id: 1, plant: 'Tomate', soil_humidity: 45, valve: 'OFF' },
    2: { id: 2, plant: 'Menthe', soil_humidity: 52, valve: 'OFF' },
    3: { id: 3, plant: 'Oignon', soil_humidity: 38, valve: 'OFF' },
  };

  return (
    <aside className="w-80 glass-panel border-l border-hydra-border/80 p-5 flex flex-col justify-between overflow-y-auto select-none z-20 shrink-0 text-hydra-textMain rounded-2xl">
      <div className="space-y-6">
        {/* INFORMATIONS GLOBALES */}
        <div>
          <h3 className="text-[11px] font-extrabold tracking-wider text-hydra-textMuted uppercase mb-3 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-hydra-neon" />
            <span>INFORMATIONS GLOBALES</span>
          </h3>
          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between p-2 rounded-xl bg-hydra-dark/60 border border-hydra-border/60">
              <span className="flex items-center gap-2 text-hydra-textMuted">
                <Thermometer className="w-3.5 h-3.5 text-rose-400" />
                <span>Température Air</span>
              </span>
              <span className="font-mono font-bold text-hydra-textMain">{env.temperature} °C</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-hydra-dark/60 border border-hydra-border/60">
              <span className="flex items-center gap-2 text-hydra-textMuted">
                <Droplets className="w-3.5 h-3.5 text-cyan-400" />
                <span>Humidité Air</span>
              </span>
              <span className="font-mono font-bold text-hydra-textMain">{env.air_humidity} %</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-hydra-dark/60 border border-hydra-border/60">
              <span className="flex items-center gap-2 text-hydra-textMuted">
                <Gauge className="w-3.5 h-3.5 text-amber-400" />
                <span>Pression Atmos.</span>
              </span>
              <span className="font-mono font-bold text-hydra-textMain">1013 hPa</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-hydra-dark/60 border border-hydra-border/60">
              <span className="flex items-center gap-2 text-hydra-textMuted">
                <Sun className="w-3.5 h-3.5 text-yellow-400" />
                <span>Ensoleillement</span>
              </span>
              <span className="font-mono font-bold text-hydra-textMain">42 500 lux</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-hydra-dark/60 border border-hydra-border/60">
              <span className="flex items-center gap-2 text-hydra-textMuted">
                <CloudRain className="w-3.5 h-3.5 text-blue-400" />
                <span>Précipitations 24h</span>
              </span>
              <span className="font-mono font-bold text-hydra-textMain">0.0 mm</span>
            </div>
          </div>
        </div>

        <div className="h-px bg-hydra-border/80" />

        {/* ÉTAT DU SYSTÈME */}
        <div>
          <h3 className="text-[11px] font-extrabold tracking-wider text-hydra-textMuted uppercase mb-3">
            ÉTAT DU SYSTÈME & COMMANDES
          </h3>
          <div className="space-y-2.5 text-xs">
            {/* Pompe principale */}
            <div className="flex items-center justify-between p-2 rounded-xl bg-hydra-dark/60 border border-hydra-border/60">
              <button
                onClick={onTogglePump}
                className="flex items-center gap-2 text-hydra-textMain hover:text-hydra-neon transition-colors text-left"
              >
                <span>⚙️</span>
                <span className="font-semibold">Pompe principale</span>
              </button>
              <button
                onClick={onTogglePump}
                className={cn(
                  'font-mono text-xs font-bold flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all',
                  pump.pump === 'ON'
                    ? 'text-hydra-neon bg-hydra-neon/15 border border-hydra-neon/40 shadow-[0_0_8px_rgba(0,255,136,0.2)]'
                    : 'text-hydra-textDim bg-hydra-border/40 border border-hydra-border'
                )}
              >
                <span className={cn('w-1.5 h-1.5 rounded-full', pump.pump === 'ON' ? 'bg-hydra-neon animate-pulse' : 'bg-hydra-textDim')} />
                <span>{pump.pump === 'ON' ? 'ON (30L/MIN)' : 'EN VEILLE'}</span>
              </button>
            </div>

            {/* Vannes 1, 2, 3 */}
            {[1, 2, 3].map((zId) => {
              const zone = zones[zId] || { id: zId, plant: `Zone ${zId}`, valve: 'OFF' };
              const isOn = zone.valve === 'ON' || zone.watering_active;
              return (
                <div key={zId} className="flex items-center justify-between p-2 rounded-xl bg-hydra-dark/60 border border-hydra-border/60">
                  <button
                    onClick={() => onSelectZone && onSelectZone(zId)}
                    className="flex items-center gap-2 text-hydra-textMain hover:text-hydra-neon transition-colors text-left"
                  >
                    <span>🚰</span>
                    <span>Zone {zId} ({zone.plant || `Zone ${zId}`})</span>
                  </button>
                  <button
                    onClick={() => onToggleValve && onToggleValve(zId)}
                    className={cn(
                      'font-mono text-xs font-bold flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all',
                      isOn
                        ? 'text-hydra-neon bg-hydra-neon/15 border border-hydra-neon/40 shadow-[0_0_8px_rgba(0,255,136,0.2)]'
                        : 'text-hydra-alert bg-hydra-alert/15 border border-hydra-alert/40'
                    )}
                  >
                    <span className={cn('w-1.5 h-1.5 rounded-full', isOn ? 'bg-hydra-neon' : 'bg-hydra-alert')} />
                    <span>{isOn ? 'OUVERTE' : 'FERMÉE'}</span>
                  </button>
                </div>
              );
            })}

            {/* Broker MQTT & Wi-Fi */}
            <div className="flex items-center justify-between pt-1 text-xs">
              <span className="flex items-center gap-2 text-hydra-textMuted">
                <Radio className="w-3.5 h-3.5 text-hydra-neon" />
                <span>Broker MQTT TLS</span>
              </span>
              <span className={cn('font-mono font-bold', mqttConnected ? 'text-hydra-neon' : 'text-hydra-alert')}>
                {mqttConnected ? 'EN LIGNE' : 'HORS LIGNE'}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-hydra-textMuted">
                <Wifi className="w-3.5 h-3.5 text-hydra-neon" />
                <span>Wi-Fi ESP32</span>
              </span>
              <span className="font-mono font-bold text-hydra-neon">CONNECTÉ</span>
            </div>
          </div>
        </div>

        <div className="h-px bg-hydra-border/80" />

        {/* LÉGENDE */}
        <div>
          <h3 className="text-[11px] font-extrabold tracking-wider text-hydra-textMuted uppercase mb-3">
            LÉGENDE VISUELLE
          </h3>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-hydra-neon shadow-[0_0_6px_#00ff88]" />
              <span className="text-hydra-textMuted">Zone saine</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-hydra-warning shadow-[0_0_6px_#ffaa00]" />
              <span className="text-hydra-textMuted">Besoin d'eau</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-hydra-alert shadow-[0_0_6px_#ff3b3b]" />
              <span className="text-hydra-textMuted">Sol critique</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#00e5ff]" />
              <span className="text-hydra-textMuted">Débit d'eau</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span className="text-hydra-textMuted">Vanne ON</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span className="text-hydra-textMuted">Vanne OFF</span>
            </div>
          </div>
        </div>
      </div>

      {/* Guide interactif */}
      <div className="pt-4 border-t border-hydra-border/80 text-center flex items-center justify-center gap-2 text-hydra-textMuted text-xs font-medium">
        <span>🖱️</span>
        <span>Cliquez sur une zone 3D pour ouvrir son analyse</span>
      </div>
    </aside>
  );
}
