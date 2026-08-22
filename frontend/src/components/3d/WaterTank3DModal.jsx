import React, { useState } from 'react';
import { Droplets, X, Thermometer, Activity, Waves } from 'lucide-react';
import { cn } from '../../utils/cn';

export default function WaterTank3DModal({
  isOpen,
  onClose,
  tankData,
}) {
  const [simulatedRefill, setSimulatedRefill] = useState(0);

  if (!isOpen) return null;

  const capacityL = tankData?.capacity_liters || 7000;
  const currentVolumeL = (tankData?.volume_liters || 5250) + simulatedRefill;
  const levelPct = Math.min(100, Number(((currentVolumeL / capacityL) * 100).toFixed(1)));

  const status = levelPct < 20 ? 'CRITIQUE' : levelPct < 40 ? 'BAS' : 'NORMAL';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="glass-panel bg-hydra-dark/95 border border-hydra-border/90 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl text-hydra-textMain">
        {/* Header */}
        <div className="p-5 border-b border-hydra-border/80 flex items-center justify-between bg-hydra-dark">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center text-xl text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.25)]">
              💧
            </div>
            <div>
              <h2 className="text-base font-extrabold text-hydra-textMain">Réservoir d'Eau Principal</h2>
              <p className="text-xs text-hydra-textMuted font-mono">Capacité 7 000 Litres • Suivi ultrasonique IoT HC-SR04</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-hydra-dark hover:bg-hydra-border border border-hydra-border text-hydra-textMuted hover:text-hydra-textMain flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 text-xs">
          {/* Main Visual Level Meter */}
          <div className="bg-hydra-darkest/90 border border-hydra-border rounded-2xl p-5 flex items-center gap-6 shadow-inner">
            <div className="w-20 h-32 bg-hydra-dark border border-hydra-border rounded-xl relative overflow-hidden flex flex-col justify-end">
              <div
                className="w-full bg-gradient-to-t from-hydra-neonDim via-hydra-neon to-cyan-400 transition-all duration-700 relative"
                style={{ height: `${levelPct}%` }}
              >
                <div className="absolute inset-x-0 top-0 h-1.5 bg-white/70 animate-pulse" />
              </div>
              <div className="absolute inset-0 flex items-center justify-center font-mono font-black text-sm text-hydra-textMain drop-shadow-md">
                {levelPct}%
              </div>
            </div>

            <div className="flex-1 space-y-2.5">
              <div className="flex justify-between">
                <span className="text-hydra-textMuted">Volume d'eau actuel :</span>
                <span className="font-mono font-black text-base text-hydra-neon">{currentVolumeL} L</span>
              </div>
              <div className="flex justify-between">
                <span className="text-hydra-textMuted">Capacité nominale :</span>
                <span className="font-mono font-bold text-hydra-textMain">{capacityL} L</span>
              </div>
              <div className="flex justify-between">
                <span className="text-hydra-textMuted">Statut de la réserve :</span>
                <span
                  className={cn(
                    'font-mono font-bold',
                    status === 'NORMAL' ? 'text-hydra-neon' : status === 'BAS' ? 'text-hydra-warning' : 'text-hydra-alert'
                  )}
                >
                  {status}
                </span>
              </div>
            </div>
          </div>

          {/* Water Quality Telemetry */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-hydra-dark/70 border border-hydra-border rounded-2xl p-3.5 text-center">
              <div className="text-hydra-textMuted text-[10px] uppercase font-bold flex items-center justify-center gap-1">
                <Thermometer className="w-3 h-3 text-rose-400" />
                <span>Température</span>
              </div>
              <div className="font-mono text-base font-extrabold text-hydra-textMain mt-1">19.8 °C</div>
            </div>
            <div className="bg-hydra-dark/70 border border-hydra-border rounded-2xl p-3.5 text-center">
              <div className="text-hydra-textMuted text-[10px] uppercase font-bold flex items-center justify-center gap-1">
                <Activity className="w-3 h-3 text-hydra-neon" />
                <span>Potentiel pH</span>
              </div>
              <div className="font-mono text-base font-extrabold text-hydra-neon mt-1">6.8 pH</div>
            </div>
            <div className="bg-hydra-dark/70 border border-hydra-border rounded-2xl p-3.5 text-center">
              <div className="text-hydra-textMuted text-[10px] uppercase font-bold flex items-center justify-center gap-1">
                <Waves className="w-3 h-3 text-cyan-400" />
                <span>Turbidité</span>
              </div>
              <div className="font-mono text-base font-extrabold text-cyan-300 mt-1">1.2 NTU</div>
            </div>
          </div>

          {/* Simulation ravitaillement */}
          <div className="bg-hydra-dark/70 border border-hydra-border rounded-2xl p-4 space-y-3">
            <div className="font-bold text-hydra-textMain">Ravitaillement de la réserve</div>
            <div className="flex gap-2">
              {[200, 500, 1000].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setSimulatedRefill((prev) => prev + amt)}
                  className="flex-1 py-2 rounded-xl bg-hydra-dark hover:bg-hydra-border/60 text-cyan-300 font-mono font-bold border border-hydra-border transition-colors shadow-sm"
                >
                  +{amt} L
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
