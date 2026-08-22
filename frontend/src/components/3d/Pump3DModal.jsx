import React from 'react';
import { Settings, X, Gauge, Zap, Flame, Activity, ShieldAlert, Power } from 'lucide-react';
import { cn } from '../../utils/cn';

export default function Pump3DModal({
  isOpen,
  onClose,
  pumpData,
  zonesData,
  onTogglePump,
}) {
  if (!isOpen) return null;

  const isPumpOn = pumpData?.pump === 'ON';
  const anyValveOpen = Object.values(zonesData || {}).some((z) => z.valve === 'ON' || z.watering_active);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="glass-panel bg-hydra-dark/95 border border-hydra-border/90 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl text-hydra-textMain">
        {/* Header */}
        <div className="p-5 border-b border-hydra-border/80 flex items-center justify-between bg-hydra-dark">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-hydra-neon/15 border border-hydra-neon/40 flex items-center justify-center text-xl text-hydra-neon shadow-[0_0_15px_rgba(0,255,136,0.25)]">
              ⚙️
            </div>
            <div>
              <h2 className="text-base font-extrabold text-hydra-textMain">Groupe Motopompe Principal</h2>
              <p className="text-xs text-hydra-textMuted font-mono">Centrifuge 750W • Débit nominal 30 L/min</p>
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
          {/* Status Banner & Action */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-hydra-darkest/90 border border-hydra-border shadow-inner">
            <div>
              <div className="text-[10px] text-hydra-textMuted uppercase font-bold">État actuel de la motopompe</div>
              <div className="text-base font-black text-hydra-textMain flex items-center gap-2 mt-0.5">
                <span className={cn('w-2.5 h-2.5 rounded-full', isPumpOn ? 'bg-hydra-neon animate-pulse shadow-[0_0_8px_#00ff88]' : 'bg-hydra-textDim')} />
                <span>{isPumpOn ? 'EN MARCHE (IRRIGATION)' : 'EN VEILLE (STANDBY)'}</span>
              </div>
            </div>

            <button
              onClick={onTogglePump}
              className={cn(
                'px-4 py-2.5 rounded-xl font-extrabold text-xs uppercase tracking-wide transition-all flex items-center gap-2 shadow-lg',
                isPumpOn
                  ? 'bg-hydra-alert hover:bg-hydra-alertGlow text-white shadow-[0_0_15px_rgba(255,59,59,0.3)]'
                  : 'neon-button text-hydra-darkest'
              )}
            >
              <Power className="w-3.5 h-3.5" />
              <span>{isPumpOn ? 'Arrêter Pompe' : 'Démarrer Pompe'}</span>
            </button>
          </div>

          {/* Safety Interlock Logic Banner */}
          {!anyValveOpen && isPumpOn && (
            <div className="p-3.5 rounded-2xl bg-hydra-alert/15 border border-hydra-alert/40 text-hydra-alert text-[11px] flex items-start gap-2.5 animate-pulse">
              <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-extrabold">Avertissement de sécurité hydraulique</div>
                <div className="text-hydra-textMuted mt-0.5">
                  La pompe est active alors qu'aucune vanne n'est ouverte (risque de surpression en boucle fermée).
                </div>
              </div>
            </div>
          )}

          {/* Gauges Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-hydra-dark/70 border border-hydra-border rounded-2xl p-3.5 text-center">
              <div className="text-hydra-textMuted text-[10px] uppercase font-bold flex items-center justify-center gap-1">
                <Gauge className="w-3 h-3 text-cyan-400" />
                <span>Débit Réel</span>
              </div>
              <div className="font-mono text-base font-extrabold text-cyan-300 mt-1">
                {isPumpOn ? '30.0' : '0.0'} L/min
              </div>
            </div>
            <div className="bg-hydra-dark/70 border border-hydra-border rounded-2xl p-3.5 text-center">
              <div className="text-hydra-textMuted text-[10px] uppercase font-bold flex items-center justify-center gap-1">
                <Activity className="w-3 h-3 text-hydra-neon" />
                <span>Pression Circuit</span>
              </div>
              <div className="font-mono text-base font-extrabold text-hydra-neon mt-1">
                {isPumpOn ? '2.4' : '0.0'} bar
              </div>
            </div>
            <div className="bg-hydra-dark/70 border border-hydra-border rounded-2xl p-3.5 text-center">
              <div className="text-hydra-textMuted text-[10px] uppercase font-bold flex items-center justify-center gap-1">
                <Zap className="w-3 h-3 text-yellow-400" />
                <span>Puissance</span>
              </div>
              <div className="font-mono text-base font-extrabold text-yellow-300 mt-1">
                {isPumpOn ? '750' : '0'} W
              </div>
            </div>
          </div>

          {/* Health & Diagnostic Specs */}
          <div className="bg-hydra-dark/70 border border-hydra-border rounded-2xl p-4 space-y-2 text-hydra-textMuted font-mono">
            <div className="font-bold text-hydra-textMain mb-1">Télémétrie d'état machine</div>
            <div className="flex justify-between">
              <span>Heures de fonctionnement totales :</span>
              <span className="text-hydra-textMain font-bold">142 h</span>
            </div>
            <div className="flex justify-between">
              <span>Température moteur :</span>
              <span className="text-hydra-textMain font-bold">34.2 °C</span>
            </div>
            <div className="flex justify-between">
              <span>Vibration de palier :</span>
              <span className="text-hydra-neon font-bold">1.2 mm/s (Normal)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
