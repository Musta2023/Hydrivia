import React, { useState } from 'react';
import { Sprout, Droplets, Gauge, X, Play, Square, Layers, Flame } from 'lucide-react';
import { cn } from '../../utils/cn';

// Générateur de cellules spatiales SoilGrids 4x6
const generateSpatialCells = (zoneId, baseMoisture) => {
  const cells = [];
  const rows = 4;
  const cols = 6;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const variation = Math.sin(r * 1.5 + c) * 3.5;
      const moisture = Math.max(10, Math.min(95, Number((baseMoisture + variation).toFixed(1))));
      cells.push({
        id: `z${zoneId}-r${r}-c${c}`,
        row: r,
        col: c,
        moisturePct: moisture,
        temperatureC: Number((22.4 + r * 0.2).toFixed(1)),
        depthCm: 20,
        nitrogenPpm: 45 + ((r + c) % 10),
        phosphorusPpm: 28 + ((r * c) % 8),
        potassiumPpm: 180 + ((r + c * 2) % 20),
      });
    }
  }
  return cells;
};

export default function Zone3DDrawer({
  zoneId,
  zoneData,
  onClose,
  onStartIrrigation,
  onToggleValve,
}) {
  const [customWaterL, setCustomWaterL] = useState(50);
  const [targetMoisture, setTargetMoisture] = useState(zoneData?.target_moisture || 50);
  const [selectedCell, setSelectedCell] = useState(null);

  if (!zoneId) return null;

  const cropIcons = { 1: '🍅', 2: '🌿', 3: '🧅' };
  const cropNames = { 1: 'Tomate Maraîchère', 2: 'Menthe Douce', 3: 'Oignon Jaune' };
  const soilTypes = {
    1: 'Limoneux-Argileux (SoilGrids ISRIC)',
    2: 'Humifère Léger (SoilGrids ISRIC)',
    3: 'Sableux-Limoneux (SoilGrids ISRIC)',
  };

  const plantName = zoneData?.plant || cropNames[zoneId] || `Zone ${zoneId}`;
  const moisture = Number(zoneData?.soil_humidity || 45.0);
  const valveState = zoneData?.valve || 'OFF';
  const isIrrigating = valveState === 'ON' || zoneData?.watering_active;
  const durationSec = Math.round((customWaterL / 30) * 60);

  const gridCells = generateSpatialCells(zoneId, moisture);

  const getCellColor = (m) => {
    if (m < 25) return 'bg-rose-950/70 border-rose-600/70 text-rose-300';
    if (m < 35) return 'bg-amber-950/70 border-amber-600/70 text-amber-300';
    if (m < 60) return 'bg-emerald-950/70 border-emerald-500/70 text-emerald-300';
    return 'bg-cyan-950/70 border-cyan-500/70 text-cyan-300';
  };

  return (
    <div className="fixed inset-y-0 right-0 w-96 md:w-[460px] glass-panel border-l border-hydra-border/90 backdrop-blur-2xl shadow-2xl z-40 flex flex-col justify-between overflow-hidden text-hydra-textMain animate-in slide-in-from-right duration-300">
      {/* En-tête */}
      <div className="p-5 border-b border-hydra-border/80 flex items-center justify-between bg-hydra-dark/90">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-hydra-neon/15 border border-hydra-neon/40 flex items-center justify-center text-2xl shadow-[0_0_15px_rgba(0,255,136,0.2)]">
            {cropIcons[zoneId] || '🌱'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-hydra-textMain">Zone {zoneId}</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-hydra-border text-hydra-neon">
                {plantName}
              </span>
            </div>
            <div className="text-xs text-hydra-textMuted font-medium">{soilTypes[zoneId]}</div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-8 h-8 rounded-xl bg-hydra-dark hover:bg-hydra-border border border-hydra-border text-hydra-textMuted hover:text-hydra-textMain flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Corps du Drawer */}
      <div className="p-5 space-y-5 overflow-y-auto flex-1 text-xs">
        {/* Cartes KPI rapides */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-hydra-dark/80 border border-hydra-border/80 rounded-2xl p-4 shadow-md">
            <div className="text-[10px] uppercase font-bold text-hydra-textMuted flex items-center gap-1">
              <Droplets className="w-3.5 h-3.5 text-hydra-neon" />
              <span>Humidité du Sol</span>
            </div>
            <div className="flex items-baseline gap-1 mt-1.5">
              <span className="text-2xl font-black text-hydra-neon">{moisture.toFixed(1)}%</span>
              <span className="text-[11px] text-hydra-textMuted">/ Cible {targetMoisture}%</span>
            </div>
            <div className="w-full h-2 bg-hydra-border rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-hydra-neon transition-all duration-500 rounded-full shadow-[0_0_8px_#00ff88]"
                style={{ width: `${Math.min(100, moisture)}%` }}
              />
            </div>
          </div>

          <div className="bg-hydra-dark/80 border border-hydra-border/80 rounded-2xl p-4 shadow-md">
            <div className="text-[10px] uppercase font-bold text-hydra-textMuted flex items-center gap-1">
              <Gauge className="w-3.5 h-3.5 text-cyan-400" />
              <span>Vanne & Irrigation</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span
                className={cn(
                  'px-2.5 py-1 rounded-lg text-xs font-bold font-mono uppercase',
                  valveState === 'ON'
                    ? 'bg-hydra-neon/20 text-hydra-neon border border-hydra-neon/40'
                    : 'bg-hydra-alert/20 text-hydra-alert border border-hydra-alert/40'
                )}
              >
                Vanne {valveState}
              </span>
              <span
                className={cn(
                  'px-2 py-1 rounded-lg text-xs font-bold uppercase',
                  isIrrigating
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 animate-pulse'
                    : 'bg-hydra-dark text-hydra-textDim'
                )}
              >
                {isIrrigating ? 'Arrosage' : 'En veille'}
              </span>
            </div>
            <div className="text-[10px] text-hydra-textMuted mt-2">Débit : 30 L/min nominal</div>
          </div>
        </div>

        {/* Consigne d'humidité cible */}
        <div className="bg-hydra-dark/70 border border-hydra-border rounded-2xl p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-hydra-textMain">Consigne d'humidité cible</span>
            <span className="font-mono font-extrabold text-hydra-neon text-sm">{targetMoisture}%</span>
          </div>
          <input
            type="range"
            min="20"
            max="80"
            step="5"
            value={targetMoisture}
            onChange={(e) => setTargetMoisture(Number(e.target.value))}
            className="w-full accent-hydra-neon cursor-pointer h-1.5 bg-hydra-border rounded-lg"
          />
          <div className="flex justify-between text-[10px] text-hydra-textMuted font-mono">
            <span>20% (Sec)</span>
            <span>50% (Optimal)</span>
            <span>80% (Humide)</span>
          </div>
        </div>

        {/* Grille spatiale 4x6 SoilGrids */}
        <div className="bg-hydra-dark/70 border border-hydra-border rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-hydra-textMain flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-hydra-neon" />
                <span>Grille spatiale du sol (SoilGrids)</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-hydra-neon/15 text-hydra-neon border border-hydra-neon/30 font-mono font-bold">
                  4x6 Tuiles
                </span>
              </div>
              <div className="text-[10px] text-hydra-textMuted mt-0.5">
                Données pédologiques satellitaires et sonde IoT
              </div>
            </div>
          </div>

          <div className="grid grid-cols-6 gap-1.5 p-2.5 bg-hydra-darkest rounded-xl border border-hydra-border">
            {gridCells.map((cell) => {
              const isSelected = selectedCell?.id === cell.id;
              return (
                <button
                  key={cell.id}
                  onClick={() => setSelectedCell(cell)}
                  className={cn(
                    'h-9 rounded-lg border flex flex-col items-center justify-center transition-all',
                    getCellColor(cell.moisturePct),
                    isSelected && 'ring-2 ring-hydra-neon scale-105 z-10'
                  )}
                  title={`Ligne ${cell.row + 1}, Col ${cell.col + 1} : ${cell.moisturePct}%`}
                >
                  <span className="text-[10px] font-mono font-bold">{Math.round(cell.moisturePct)}%</span>
                </button>
              );
            })}
          </div>

          {selectedCell && (
            <div className="p-3 bg-hydra-darkest/90 rounded-xl border border-hydra-border text-[11px] space-y-1.5 animate-in fade-in">
              <div className="font-bold text-hydra-textMain flex justify-between">
                <span>Tuile [{selectedCell.row + 1}, {selectedCell.col + 1}]</span>
                <span className="font-mono text-hydra-neon">{selectedCell.moisturePct}% Humidité</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-[10px] text-hydra-textMuted font-mono pt-1">
                <div>Azote (N) : <strong className="text-hydra-textMain">{selectedCell.nitrogenPpm} ppm</strong></div>
                <div>Phosphore (P) : <strong className="text-hydra-textMain">{selectedCell.phosphorusPpm} ppm</strong></div>
                <div>Potassium (K) : <strong className="text-hydra-textMain">{selectedCell.potassiumPpm} ppm</strong></div>
              </div>
            </div>
          )}
        </div>

        {/* Déclenchement d'arrosage */}
        <div className="bg-hydra-dark/70 border border-hydra-border rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-hydra-textMain">Commande d'irrigation</span>
            <span className="text-[11px] text-hydra-textMuted font-mono">Durée est. : <strong>{durationSec}s</strong></span>
          </div>

          <div className="flex gap-2">
            {[30, 50, 100, 200].map((liters) => (
              <button
                key={liters}
                onClick={() => setCustomWaterL(liters)}
                className={cn(
                  'flex-1 py-1.5 rounded-xl border text-xs font-mono font-bold transition-all',
                  customWaterL === liters
                    ? 'bg-hydra-neon/20 text-hydra-neon border-hydra-neon/60 shadow-[0_0_10px_rgba(0,255,136,0.2)]'
                    : 'bg-hydra-dark hover:bg-hydra-border/60 text-hydra-textMuted border-hydra-border'
                )}
              >
                {liters} L
              </button>
            ))}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => {
                if (onStartIrrigation) {
                  onStartIrrigation(zoneId, customWaterL, targetMoisture);
                }
              }}
              className="flex-1 py-2.5 rounded-xl neon-button flex items-center justify-center gap-2 text-xs font-extrabold uppercase tracking-wide"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Lancer ({customWaterL} L)</span>
            </button>

            <button
              onClick={() => onToggleValve && onToggleValve(zoneId)}
              className={cn(
                'px-4 py-2.5 rounded-xl border font-bold text-xs flex items-center gap-1.5 transition-colors',
                valveState === 'ON'
                  ? 'bg-hydra-alert/20 text-hydra-alert border-hydra-alert/40 hover:bg-hydra-alert/30'
                  : 'bg-hydra-dark hover:bg-hydra-border text-hydra-textMuted border-hydra-border'
              )}
            >
              <Square className="w-3.5 h-3.5" />
              <span>{valveState === 'ON' ? 'Fermer Vanne' : 'Ouvrir'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
