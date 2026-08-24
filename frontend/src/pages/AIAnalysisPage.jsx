import React, { useState, useEffect } from 'react';
import {
  Brain,
  ArrowLeft,
  RefreshCw,
  Clock,
  Sparkles,
  CloudRain,
  Droplets,
  AlertTriangle,
  CheckCircle2,
  Filter,
  Layers,
  Gauge,
  HelpCircle,
  Calendar,
  AlertCircle,
  Play,
  Activity
} from 'lucide-react';
import api from '../services/api';
import StatusBadge from '../components/common/StatusBadge';
import { useSocket } from '../context/SocketContext';
import { cn } from '../utils/cn';

// Helper: Map raw enum decisionStatus to French badge styling & label
function getStatusConfig(status) {
  const s = (status || '').toUpperCase();
  switch (s) {
    case 'IRRIGATE':
    case 'IRRIGATE_NOW':
    case 'EXECUTING':
      return { label: 'IRRIGATION REQUISE', status: 'ON', color: 'text-hydra-neon bg-hydra-neon/15 border-hydra-neon/30' };
    case 'APPROVED':
    case 'COMPLETED':
      return { label: 'APPROUVÉ / COMPLÉTÉ', status: 'completed', color: 'text-hydra-neon bg-hydra-neon/15 border-hydra-neon/30' };
    case 'DEFER':
    case 'PROPOSED':
      return { label: 'IRRIGATION DIFFÉRÉE', status: 'medium', color: 'text-hydra-warning bg-hydra-warning/15 border-hydra-warning/30' };
    case 'NO_IRRIGATION':
      return { label: 'PAS D\'IRRIGATION', status: 'info', color: 'text-cyan-400 bg-cyan-500/15 border-cyan-500/30' };
    case 'REJECTED':
      return { label: 'REJETÉ', status: 'critical', color: 'text-hydra-alert bg-hydra-alert/15 border-hydra-alert/30' };
    default:
      return { label: status || 'INCONNU', status: 'info', color: 'text-hydra-textMuted bg-hydra-dark border-hydra-border' };
  }
}

// Helper: Map Zone Action
function getZoneActionConfig(action) {
  const a = (action || '').toUpperCase();
  if (a === 'IRRIGATE' || a === 'IRRIGATE_NOW') {
    return { label: 'IRRIGATION REQUISE', color: 'text-hydra-neon bg-hydra-neon/15 border-hydra-neon/30' };
  }
  if (a === 'DEFER') {
    return { label: 'DIFFÉRÉ', color: 'text-hydra-warning bg-hydra-warning/15 border-hydra-warning/30' };
  }
  if (a === 'NO_IRRIGATION') {
    return { label: 'PAS D\'IRRIGATION', color: 'text-cyan-400 bg-cyan-500/15 border-cyan-500/30' };
  }
  return { label: action || 'INCONNU', color: 'text-hydra-textMuted bg-hydra-dark border-hydra-border' };
}

// Helper: Map Zone ID string to numeric 1, 2, 3
function resolveZoneNumber(zoneId) {
  if (!zoneId) return 1;
  const str = String(zoneId).trim().toUpperCase();
  if (str.includes('1') || str === 'Z001' || str === 'ZONE-1') return 1;
  if (str.includes('2') || str === 'Z002' || str === 'ZONE-2') return 2;
  if (str.includes('3') || str === 'Z003' || str === 'ZONE-3') return 3;
  return 1;
}

// Helper: Format relative time in French
function formatRelativeTime(isoString) {
  if (!isoString) return 'inconnu';
  const now = new Date();
  const date = new Date(isoString);
  const diffMinutes = Math.floor((now - date) / (1000 * 60));

  if (diffMinutes < 1) return "à l'instant";
  if (diffMinutes < 60) return `il y a ${diffMinutes} min`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `il y a ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  return `il y a ${diffDays} j`;
}

export default function AIAnalysisPage() {
  const { telemetry, sendCommand, emergencyStopped } = useSocket();
  const [selectedId, setSelectedId] = useState(null);
  const [executingZone, setExecutingZone] = useState(null);
  const [zoneCommandSuccess, setZoneCommandSuccess] = useState('');

  // List View State
  const [analyses, setAnalyses] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState(null);
  const [filter, setFilter] = useState('all');

  // Detail View State
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState(null);

  // 1. Fetch List
  const fetchAnalyses = async () => {
    setLoadingList(true);
    setListError(null);
    try {
      const res = await api.get('/ai-analysis?limit=50');
      setAnalyses(res.data.analyses || []);
    } catch (err) {
      console.error('Error loading AI analyses:', err);
      setListError('Impossible de charger les analyses IA. Vérifiez la connexion backend.');
    } finally {
      setLoadingList(false);
    }
  };

  // 2. Fetch Detail
  const fetchDetail = async (id) => {
    setLoadingDetail(true);
    setDetailError(null);
    setDetail(null);
    try {
      const res = await api.get(`/ai-analysis/${id}`);
      setDetail(res.data.analysis);
    } catch (err) {
      console.error('Error loading AI analysis detail:', err);
      if (err.response && err.response.status === 404) {
        setDetailError("Cette analyse n'est plus disponible.");
      } else {
        setDetailError("Impossible de charger le détail de cette analyse.");
      }
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    fetchAnalyses();
  }, []);

  useEffect(() => {
    if (selectedId) {
      fetchDetail(selectedId);
    }
  }, [selectedId]);

  // Filter logic
  const filteredAnalyses = analyses.filter((item) => {
    if (filter === 'irrigate') {
      return ['IRRIGATE', 'EXECUTING', 'COMPLETED', 'APPROVED'].includes(item.decisionStatus);
    }
    if (filter === 'defer') {
      return ['DEFER', 'PROPOSED'].includes(item.decisionStatus);
    }
    if (filter === 'no_irrigation') {
      return ['NO_IRRIGATION', 'REJECTED'].includes(item.decisionStatus);
    }
    return true;
  });

  const latestAnalysis = analyses[0];

  // =========================================================================
  // DETAIL VIEW
  // =========================================================================
  if (selectedId) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        {/* Back navigation header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSelectedId(null)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-hydra-dark border border-hydra-border hover:border-hydra-neon text-hydra-textMain hover:text-hydra-neon text-xs font-semibold transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>← Retour aux analyses</span>
          </button>

          {detail && (
            <span className="font-mono text-[11px] text-hydra-textMuted bg-hydra-dark/80 px-3 py-1 rounded-lg border border-hydra-border">
              ID: {detail.id}
            </span>
          )}
        </div>

        {/* Loading Skeleton for Detail */}
        {loadingDetail && (
          <div className="glass-panel rounded-2xl p-8 space-y-6 animate-pulse">
            <div className="h-8 bg-hydra-border/50 rounded-xl w-1/3" />
            <div className="h-20 bg-hydra-border/30 rounded-xl w-full" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="h-40 bg-hydra-border/30 rounded-xl" />
              <div className="h-40 bg-hydra-border/30 rounded-xl" />
            </div>
          </div>
        )}

        {/* Detail Error State */}
        {detailError && !loadingDetail && (
          <div className="glass-panel rounded-2xl p-12 text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-hydra-alert mx-auto animate-pulse" />
            <h3 className="text-base font-bold text-hydra-textMain">{detailError}</h3>
            <button
              onClick={() => setSelectedId(null)}
              className="px-5 py-2.5 rounded-xl bg-hydra-neon text-hydra-darkest font-bold text-xs shadow-[0_0_15px_rgba(0,255,136,0.3)] transition"
            >
              Retour aux analyses
            </button>
          </div>
        )}

        {/* Full Detail Render */}
        {detail && !loadingDetail && (
          <div className="space-y-6">
            {/* Top Overview Banner */}
            <div className="glass-panel rounded-2xl p-6 border-l-4 border-l-hydra-neon space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Brain className="w-5 h-5 text-hydra-neon" />
                    <h2 className="text-lg font-bold text-hydra-textMain">
                      Rapport d'Analyse IA
                    </h2>
                    <span
                      title={`Code brut: ${detail.decisionStatus}`}
                      className={cn('px-3 py-1 rounded-full text-xs font-bold font-mono border', getStatusConfig(detail.decisionStatus).color)}
                    >
                      {getStatusConfig(detail.decisionStatus).label}
                    </span>
                  </div>
                  <p className="text-xs text-hydra-textMuted flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(detail.timestamp).toLocaleString('fr-FR', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>

                {/* Score indicators */}
                <div className="flex items-center gap-4 text-xs font-mono">
                  <div className="bg-hydra-dark/80 px-4 py-2.5 rounded-xl border border-hydra-border text-center">
                    <span className="block text-[10px] text-hydra-textMuted uppercase">Indice Confiance</span>
                    <span className="text-base font-extrabold text-hydra-neon">{detail.confidencePct ?? 0}%</span>
                  </div>
                  <div className="bg-hydra-dark/80 px-4 py-2.5 rounded-xl border border-hydra-border text-center">
                    <span className="block text-[10px] text-hydra-textMuted uppercase">Validité</span>
                    <span className="text-base font-extrabold text-hydra-textMain">{detail.validForMinutes ?? 60} min</span>
                  </div>
                  <div className="bg-hydra-dark/80 px-4 py-2.5 rounded-xl border border-hydra-border text-center">
                    <span className="block text-[10px] text-hydra-textMuted uppercase">Prochaine Eval</span>
                    <span className="text-base font-extrabold text-hydra-textMain">{detail.nextEvaluationMinutes ?? 120} min</span>
                  </div>
                </div>
              </div>

              {/* Decision Summary Box */}
              <div className="p-4 rounded-xl bg-hydra-dark/60 border border-hydra-borderHighlight">
                <h4 className="text-xs font-mono font-bold text-hydra-neon uppercase mb-1 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Résumé exécutif de la décision
                </h4>
                <p className="text-xs text-hydra-textMain leading-relaxed">
                  {detail.decisionSummary}
                </p>
              </div>
            </div>

            {/* Grid: Water Budget & Weather Assessment */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Section: Budget en Eau */}
              <div className="glass-panel rounded-2xl p-6 space-y-4">
                <h3 className="text-sm font-bold text-hydra-textMain flex items-center gap-2 border-b border-hydra-border pb-3">
                  <Droplets className="w-4 h-4 text-cyan-400" />
                  Budget & Ressources en Eau
                </h3>

                {detail.waterBudget ? (
                  <div className="space-y-3 text-xs">
                    {(() => {
                      const wb = detail.waterBudget || {};
                      const availL = wb.availableL !== undefined ? wb.availableL : ((wb.availableMl || 0) / 1000);
                      const allocL = wb.allocatedL !== undefined ? wb.allocatedL : ((wb.allocatedMl || 0) / 1000);
                      const consL = wb.conservedL !== undefined ? wb.conservedL : ((wb.conservedMl || 0) / 1000);

                      return (
                        <>
                          <div className="flex justify-between items-center py-1.5 border-b border-hydra-border/50">
                            <span className="text-hydra-textMuted">Eau disponible :</span>
                            <span className="font-mono font-bold text-hydra-textMain">
                              {availL.toLocaleString('fr-FR')} Litres
                            </span>
                          </div>
                          <div className="flex justify-between items-center py-1.5 border-b border-hydra-border/50">
                            <span className="text-hydra-textMuted">Eau allouée (ce cycle) :</span>
                            <span className="font-mono font-bold text-hydra-neon">
                              {allocL.toLocaleString('fr-FR')} Litres
                            </span>
                          </div>
                          <div className="flex justify-between items-center py-1.5 border-b border-hydra-border/50">
                            <span className="text-hydra-textMuted">Eau conservée :</span>
                            <span className="font-mono font-bold text-cyan-400">
                              {consL.toLocaleString('fr-FR')} Litres
                            </span>
                          </div>
                          <div className="flex justify-between items-center py-1.5 border-b border-hydra-border/50">
                            <span className="text-hydra-textMuted">Taux d'utilisation :</span>
                            <span className="font-mono font-bold text-hydra-textMain">
                              {wb.utilizationPct ?? 0}%
                            </span>
                          </div>
                          <div className="flex justify-between items-center py-1.5">
                            <span className="text-hydra-textMuted">Niveau de rareté :</span>
                            <span className="font-mono font-bold px-2 py-0.5 rounded bg-hydra-dark border border-hydra-border text-hydra-neon">
                              {wb.scarcityLevel || 'NORMAL'}
                            </span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  <p className="text-xs text-hydra-textMuted">Aucune donnée de budget eau disponible.</p>
                )}
              </div>

              {/* Section: Analyse Météo */}
              <div className="glass-panel rounded-2xl p-6 space-y-4">
                <h3 className="text-sm font-bold text-hydra-textMain flex items-center gap-2 border-b border-hydra-border pb-3">
                  <CloudRain className="w-4 h-4 text-blue-400" />
                  Analyse Météorologique
                </h3>

                {detail.weatherAssessment ? (
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between items-center py-1.5 border-b border-hydra-border/50">
                      <span className="text-hydra-textMuted">Pluie imminente :</span>
                      <span className={cn('font-bold', detail.weatherAssessment.nearTermRainExpected ? 'text-hydra-warning' : 'text-hydra-textMain')}>
                        {detail.weatherAssessment.nearTermRainExpected ? 'Oui 🌧️' : 'Non ☀️'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1.5 border-b border-hydra-border/50">
                      <span className="text-hydra-textMuted">Précipitations sous (heures) :</span>
                      <span className="font-mono font-bold text-hydra-textMain">
                        {detail.weatherAssessment.meaningfulRainExpectedWithinHours !== null
                          ? `${detail.weatherAssessment.meaningfulRainExpectedWithinHours} h`
                          : 'Aucune'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1.5 border-b border-hydra-border/50">
                      <span className="text-hydra-textMuted">Pluie prévue (24h) :</span>
                      <span className="font-mono font-bold text-blue-400">
                        {detail.weatherAssessment.next24HoursRainMm ?? 0} mm
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1.5 border-b border-hydra-border/50">
                      <span className="text-hydra-textMuted">Demande atmosphérique (ETD) :</span>
                      <span className="font-mono font-bold text-hydra-textMain">
                        {detail.weatherAssessment.atmosphericDemand || 'MODERATE'}
                      </span>
                    </div>
                    <div className="pt-1">
                      <span className="block text-hydra-textMuted mb-1">Avis météo :</span>
                      <p className="text-xs text-hydra-textMain/90 italic bg-hydra-dark/60 p-2.5 rounded-lg border border-hydra-border">
                        "{detail.weatherAssessment.summary}"
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-hydra-textMuted">Aucune évaluation météo enregistrée.</p>
                )}
              </div>
            </div>

            {/* Section: Décisions par Zone */}
            <div className="glass-panel rounded-2xl p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-hydra-border pb-3">
                <h3 className="text-sm font-bold text-hydra-textMain flex items-center gap-2">
                  <Layers className="w-4 h-4 text-hydra-neon" />
                  <span>Décisions d'Irrigation par Zone</span>
                </h3>
                <span className="text-xs font-mono text-hydra-textMuted flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-hydra-neon animate-pulse" />
                  Synchronisé avec les capteurs en direct ({detail.zoneDecisions ? detail.zoneDecisions.length : 0} zones)
                </span>
              </div>

              {zoneCommandSuccess && (
                <div className="p-3 rounded-xl bg-hydra-neon/15 border border-hydra-neon/30 text-xs font-bold text-hydra-neon flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{zoneCommandSuccess}</span>
                </div>
              )}

              {Array.isArray(detail.zoneDecisions) && detail.zoneDecisions.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {detail.zoneDecisions.map((z, idx) => {
                    const zoneNum = resolveZoneNumber(z.zoneId);
                    const liveZone = telemetry.zones?.[zoneNum];
                    const actionCfg = getZoneActionConfig(z.action);
                    const volumeLiters = z.wateringL !== undefined
                      ? z.wateringL
                      : (z.wateringMl !== undefined ? (z.wateringMl / 1000) : 0);

                    const riskStr = (z.riskLevel || '').toUpperCase();
                    const isIrrigateAction = (z.action || '').toUpperCase().includes('IRRIGATE');
                    const isWateringLive = liveZone?.valve === 'ON' || liveZone?.watering_active;

                    return (
                      <div
                        key={z.zoneId || idx}
                        className="p-4 rounded-xl bg-hydra-dark/70 border border-hydra-border hover:border-hydra-neon/40 transition space-y-3 flex flex-col justify-between"
                      >
                        <div className="space-y-3">
                          {/* Zone Card Header */}
                          <div className="flex items-center justify-between border-b border-hydra-border/60 pb-2">
                            <div>
                              <h4 className="text-xs font-bold text-hydra-textMain uppercase tracking-wider flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-hydra-neon" />
                                {z.zoneId} — {z.cropType || liveZone?.plant || `Zone ${zoneNum}`}
                              </h4>
                              <span className="text-[10px] font-mono text-hydra-textMuted">
                                Priorité #{z.priorityRank ?? (idx + 1)}
                              </span>
                            </div>
                            <span className={cn('px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono border', actionCfg.color)}>
                              {actionCfg.label}
                            </span>
                          </div>

                          {/* Live Sensor Sync Indicator */}
                          {liveZone && (
                            <div className="p-2.5 rounded-lg bg-hydra-darkest/70 border border-hydra-border/60 space-y-1 text-[11px] font-mono">
                              <div className="flex justify-between items-center">
                                <span className="text-hydra-textMuted flex items-center gap-1">
                                  <Activity className="w-3 h-3 text-cyan-400" />
                                  Humidité capteur direct :
                                </span>
                                <span className="font-extrabold text-cyan-400">
                                  {liveZone.soil_humidity?.toFixed(1) ?? '--'}%
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-hydra-textMuted">Vanne physique :</span>
                                <span className={cn('font-bold', isWateringLive ? 'text-hydra-neon' : 'text-hydra-textMuted')}>
                                  {isWateringLive ? 'OUVERTE (En cours 💧)' : 'FERMÉE'}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* AI Recommendation Metrics */}
                          <div className="space-y-1.5 text-[11px] font-mono">
                            <div className="flex justify-between">
                              <span className="text-hydra-textMuted">Diagnostic humidité IA :</span>
                              <span className="text-hydra-textMain font-bold uppercase">{z.soilMoistureStatus || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-hydra-textMuted">Stade culture :</span>
                              <span className="text-hydra-textMain capitalize">{z.cropStageAssessment || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-hydra-textMuted">Niveau risque :</span>
                              <span className={cn('font-bold uppercase', 
                                riskStr === 'CRITICAL' || riskStr === 'HIGH' ? 'text-hydra-alert' :
                                riskStr === 'MEDIUM' || riskStr === 'MODERATE' ? 'text-hydra-warning' : 'text-hydra-neon'
                              )}>
                                {z.riskLevel || 'FAIBLE'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-hydra-textMuted">Profondeur d'eau :</span>
                              <span className="text-hydra-textMain">{z.irrigationDepthMm ?? 0} mm</span>
                            </div>
                            <div className="flex justify-between pt-1 border-t border-hydra-border/40">
                              <span className="text-hydra-textMuted">Volume recommandé :</span>
                              <span className="text-hydra-neon font-extrabold text-xs">
                                {volumeLiters.toLocaleString('fr-FR')} Litres
                              </span>
                            </div>
                          </div>

                          {/* Full un-truncated rationale */}
                          <div className="pt-2 border-t border-hydra-border/50 text-[11px]">
                            <span className="block text-[10px] font-mono font-bold text-hydra-textMuted uppercase mb-1">
                              Justification IA :
                            </span>
                            <p className="text-hydra-textMain/90 leading-relaxed bg-hydra-darkest/60 p-2.5 rounded-lg border border-hydra-border">
                              {z.rationale || 'Aucune justification explicite fournie.'}
                            </p>
                          </div>
                        </div>

                        {/* Direct Action Button if Irrigation Recommended */}
                        {isIrrigateAction && (
                          <div className="pt-3 border-t border-hydra-border/40">
                            <button
                              disabled={emergencyStopped || executingZone === zoneNum || isWateringLive}
                              onClick={async () => {
                                if (emergencyStopped) return;
                                setExecutingZone(zoneNum);
                                setZoneCommandSuccess('');
                                try {
                                  await sendCommand(zoneNum, {
                                    wateringL: volumeLiters || 30,
                                    targetSoilMoisturePct: 60
                                  });
                                  setZoneCommandSuccess(`Commande d'irrigation de ${volumeLiters} L transmise à la Zone ${zoneNum} (${liveZone?.plant || z.cropType}) !`);
                                  setTimeout(() => setZoneCommandSuccess(''), 5000);
                                } catch (err) {
                                  alert(`Erreur : ${err.message}`);
                                } finally {
                                  setExecutingZone(null);
                                }
                              }}
                              className={cn(
                                'w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold font-mono transition',
                                isWateringLive
                                  ? 'bg-hydra-neon/20 text-hydra-neon border border-hydra-neon/40 cursor-default'
                                  : 'bg-hydra-neon text-hydra-darkest hover:shadow-[0_0_15px_#00ff88]'
                              )}
                            >
                              <Play className={`w-3.5 h-3.5 ${isWateringLive ? 'animate-pulse' : ''}`} />
                              <span>
                                {isWateringLive 
                                  ? 'Arrosage en cours...' 
                                  : executingZone === zoneNum 
                                    ? 'Envoi en cours...' 
                                    : `Appliquer l'arrosage (${volumeLiters} L)`}
                              </span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-hydra-textMuted py-4">Aucune décision de zone enregistrée pour cette analyse.</p>
              )}
            </div>

            {/* Section: Alertes & Avertissements */}
            <div className="glass-panel rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-hydra-textMain flex items-center gap-2 border-b border-hydra-border pb-3">
                <AlertTriangle className="w-4 h-4 text-hydra-warning" />
                Alertes & Avertissements Système
              </h3>

              {Array.isArray(detail.warnings) && detail.warnings.length > 0 ? (
                <div className="space-y-2">
                  {detail.warnings.map((warn, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-3 rounded-xl bg-hydra-warning/10 border border-hydra-warning/30 text-xs text-hydra-warning font-medium"
                    >
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{warn}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-hydra-neon bg-hydra-neon/10 p-3.5 rounded-xl border border-hydra-neon/20">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Aucun avertissement particulier émis lors de cette analyse.</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // LIST VIEW (TASK/HISTORY LIST)
  // =========================================================================
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel rounded-2xl p-6">
        <div>
          <h2 className="text-lg font-bold text-hydra-textMain flex items-center gap-2">
            <Brain className="w-5 h-5 text-hydra-neon" />
            Analyse IA — Historique des Décisions
          </h2>
          <p className="text-xs text-hydra-textMuted mt-1">
            Historique chronologique des recommandations d'irrigation générées par le workflow FusionAI.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchAnalyses}
            title="Rafraîchir la liste"
            className="p-2.5 rounded-xl bg-hydra-dark border border-hydra-border hover:border-hydra-neon text-hydra-textMuted hover:text-hydra-neon transition"
          >
            <RefreshCw className={`w-4 h-4 ${loadingList ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Lightweight Summary Bar */}
      <div className="glass-panel rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-hydra-textMain">
            <Layers className="w-4 h-4 text-hydra-neon" />
            <span>Total analyses: <strong className="text-hydra-neon">{analyses.length}</strong></span>
          </div>
          {latestAnalysis && (
            <div className="hidden sm:flex items-center gap-2 text-hydra-textMuted border-l border-hydra-border pl-4">
              <Clock className="w-3.5 h-3.5 text-hydra-neon" />
              <span>Dernière analyse: <strong className="text-hydra-textMain">{formatRelativeTime(latestAnalysis.timestamp)}</strong></span>
            </div>
          )}
        </div>

        <div className="text-[11px] text-hydra-textMuted flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-hydra-warning" />
          <span>Cliquez sur une analyse pour afficher le rapport détaillé</span>
        </div>
      </div>

      {/* Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-mono">
        <span className="text-hydra-textDim flex items-center gap-1 mr-2 font-sans font-semibold">
          <Filter className="w-3.5 h-3.5" />
          Filtrer :
        </span>
        {[
          { id: 'all', label: 'Toutes' },
          { id: 'irrigate', label: 'Irrigation Requise' },
          { id: 'defer', label: 'Irrigation Différée' },
          { id: 'no_irrigation', label: 'Pas d\'Irrigation' }
        ].map((btn) => (
          <button
            key={btn.id}
            onClick={() => setFilter(btn.id)}
            className={`px-3.5 py-1.5 rounded-xl border transition ${
              filter === btn.id
                ? 'bg-hydra-neon text-hydra-darkest font-bold shadow-[0_0_12px_#00ff88]'
                : 'glass-panel text-hydra-textMuted hover:text-hydra-textMain hover:border-hydra-borderHighlight'
            }`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Error state */}
      {listError && (
        <div className="glass-panel rounded-2xl p-8 text-center space-y-4 border-hydra-alert/40">
          <AlertCircle className="w-10 h-10 text-hydra-alert mx-auto animate-pulse" />
          <p className="text-sm font-semibold text-hydra-textMain">{listError}</p>
          <button
            onClick={fetchAnalyses}
            className="px-4 py-2 rounded-xl bg-hydra-neon text-hydra-darkest font-bold text-xs shadow-[0_0_12px_#00ff88]"
          >
            Réessayer
          </button>
        </div>
      )}

      {/* Loading Skeletons */}
      {loadingList && !listError && (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="glass-panel rounded-2xl p-5 h-24 animate-pulse flex items-center justify-between">
              <div className="space-y-2 w-2/3">
                <div className="h-4 bg-hydra-border/50 rounded w-1/4" />
                <div className="h-3 bg-hydra-border/30 rounded w-3/4" />
              </div>
              <div className="h-6 bg-hydra-border/40 rounded-full w-24" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loadingList && !listError && filteredAnalyses.length === 0 && (
        <div className="glass-panel rounded-2xl py-14 px-6 text-center space-y-3">
          <Brain className="w-12 h-12 text-hydra-textMuted mx-auto opacity-50" />
          <h3 className="text-base font-bold text-hydra-textMain">Aucune analyse IA disponible</h3>
          <p className="text-xs text-hydra-textMuted max-w-md mx-auto">
            Aucune décision d'irrigation n'a encore été reçue de FusionAI pour ce filtre. Les nouvelles analyses apparaîtront automatiquement ici dès leur réception.
          </p>
        </div>
      )}

      {/* Task Cards List */}
      {!loadingList && !listError && filteredAnalyses.length > 0 && (
        <div className="space-y-3">
          {filteredAnalyses.map((item) => {
            const statusCfg = getStatusConfig(item.decisionStatus);

            // Check if analysis is fresh (< 15 mins old)
            const isRecent = item.timestamp
              ? (Date.now() - new Date(item.timestamp).getTime()) < 15 * 60 * 1000
              : false;

            return (
              <div
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                className="glass-panel hover:bg-hydra-dark/80 rounded-2xl p-5 border border-hydra-border hover:border-hydra-neon/50 cursor-pointer transition-all duration-200 group flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative"
              >
                {/* Left section: Time, Status, Summary */}
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Status Badge */}
                    <span
                      title={`Statut brut: ${item.decisionStatus}`}
                      className={cn('px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono border', statusCfg.color)}
                    >
                      {statusCfg.label}
                    </span>

                    {/* Freshness Badge */}
                    {isRecent && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-hydra-neon text-hydra-darkest animate-pulse shadow-[0_0_8px_#00ff88]">
                        NOUVEAU
                      </span>
                    )}

                    {/* Date / Time */}
                    <span className="text-xs font-mono text-hydra-textMuted flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(item.timestamp).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>

                  {/* Decision Summary */}
                  <p className="text-xs font-medium text-hydra-textMain group-hover:text-hydra-neon transition-colors line-clamp-2">
                    {item.decisionSummary}
                  </p>
                </div>

                {/* Right section: Metrics & Actions */}
                <div className="flex items-center gap-4 border-t sm:border-t-0 border-hydra-border/60 pt-3 sm:pt-0 text-xs font-mono">
                  <div className="text-right">
                    <span className="block text-[10px] text-hydra-textMuted uppercase">Confiance</span>
                    <span className="text-sm font-extrabold text-hydra-neon">
                      {item.confidencePct ?? 0}%
                    </span>
                  </div>

                  <div className="text-right border-l border-hydra-border pl-3">
                    <span className="block text-[10px] text-hydra-textMuted uppercase">Zones</span>
                    <span className="text-sm font-bold text-hydra-textMain">
                      {item.zoneCount ?? 0}
                    </span>
                  </div>

                  <div className="text-right border-l border-hydra-border pl-3 hidden md:block">
                    <span className="block text-[10px] text-hydra-textMuted uppercase">Prochaine eval</span>
                    <span className="text-xs font-semibold text-hydra-textMuted">
                      {item.nextEvaluationMinutes ?? 120}m
                    </span>
                  </div>

                  {/* Arrow indicator */}
                  <div className="pl-2 text-hydra-textMuted group-hover:text-hydra-neon group-hover:translate-x-1 transition-transform">
                    →
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
