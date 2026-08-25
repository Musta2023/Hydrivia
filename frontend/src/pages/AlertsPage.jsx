import React, { useState, useMemo } from 'react';
import {
  Bell,
  AlertTriangle,
  Info,
  ShieldAlert,
  Trash2,
  Filter,
  CheckCircle2,
  RefreshCw,
  Brain,
  Radio,
  Cpu,
  Droplets,
  Check,
  ExternalLink,
  Sparkles
} from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/common/StatusBadge';
import api from '../services/api';

// Helper: Format relative time in French
function formatRelativeTime(isoString) {
  if (!isoString) return '';
  const now = new Date();
  const date = new Date(isoString);
  const diffMinutes = Math.floor((now - date) / (1000 * 60));

  if (diffMinutes < 1) return "À l'instant";
  if (diffMinutes < 60) return `Il y a ${diffMinutes} min`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Il y a ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  return `Il y a ${diffDays} j`;
}

export default function AlertsPage({ onNavigate }) {
  const { alerts = [], refreshAlerts, resolveAlert, alertsLoading } = useSocket();
  const { isAdmin, isOperator } = useAuth();
  const [sourceFilter, setSourceFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [resolvingId, setResolvingId] = useState(null);

  const handleClearAlerts = async () => {
    if (window.confirm("Voulez-vous vraiment effacer l'historique des alertes ?")) {
      try {
        await api.delete('/alerts');
        if (refreshAlerts) refreshAlerts();
      } catch (err) {
        alert('Erreur: ' + err.message);
      }
    }
  };

  const handleResolve = async (id) => {
    setResolvingId(id);
    try {
      await resolveAlert(id);
    } catch (err) {
      console.error('Error resolving alert:', err);
    } finally {
      setResolvingId(null);
    }
  };

  const getSeverityIcon = (sev) => {
    switch (sev) {
      case 'critical':
      case 'high':
        return <ShieldAlert className="w-5 h-5 text-hydra-alert animate-pulse" />;
      case 'medium':
        return <AlertTriangle className="w-5 h-5 text-hydra-warning" />;
      case 'info':
      default:
        return <CheckCircle2 className="w-5 h-5 text-hydra-neon" />;
    }
  };

  const renderSourceBadge = (source, category) => {
    const s = (source || '').toUpperCase();
    const c = (category || '').toUpperCase();

    if (s === 'AI' || c === 'AI') {
      return (
        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center gap-1">
          <Brain className="w-3 h-3 text-cyan-400" />
          IA FUSIONAI
        </span>
      );
    }
    if (s === 'MQTT' || c === 'CONNECTION') {
      return (
        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-purple-500/20 text-purple-400 border border-purple-500/40 flex items-center gap-1">
          <Radio className="w-3 h-3 text-purple-400" />
          MQTT BROKER
        </span>
      );
    }
    if (s === 'HYDRIVIA' || c === 'WATER' || c === 'PUMP' || c === 'VALVE') {
      return (
        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-hydra-neon/20 text-hydra-neon border border-hydra-neon/40 flex items-center gap-1">
          <Droplets className="w-3 h-3 text-hydra-neon" />
          HYDRIVIA SÉCURITÉ
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1">
        <Cpu className="w-3 h-3 text-emerald-400" />
        SYSTÈME
      </span>
    );
  };

  // Filtered alerts
  const filteredAlerts = useMemo(() => {
    return alerts.filter((al) => {
      // Source filter
      if (sourceFilter === 'ai' && al.source?.toUpperCase() !== 'AI' && al.category?.toUpperCase() !== 'AI') {
        return false;
      }
      if (sourceFilter === 'water' && al.category?.toUpperCase() !== 'WATER' && al.category?.toUpperCase() !== 'VALVE' && al.category?.toUpperCase() !== 'PUMP') {
        return false;
      }
      if (sourceFilter === 'mqtt' && al.source?.toUpperCase() !== 'MQTT' && al.category?.toUpperCase() !== 'CONNECTION') {
        return false;
      }
      if (sourceFilter === 'system' && al.source?.toUpperCase() !== 'SYSTEM') {
        return false;
      }

      // Severity filter
      if (severityFilter !== 'all' && al.severity !== severityFilter) {
        return false;
      }

      // Status filter
      if (statusFilter === 'active' && al.status !== 'active') {
        return false;
      }
      if (statusFilter === 'resolved' && al.status !== 'resolved') {
        return false;
      }

      return true;
    });
  }, [alerts, sourceFilter, severityFilter, statusFilter]);

  // Counts for tabs
  const aiCount = useMemo(() => alerts.filter((a) => a.source?.toUpperCase() === 'AI' || a.category?.toUpperCase() === 'AI').length, [alerts]);
  const waterCount = useMemo(() => alerts.filter((a) => a.category?.toUpperCase() === 'WATER' || a.category?.toUpperCase() === 'VALVE' || a.category?.toUpperCase() === 'PUMP').length, [alerts]);
  const mqttCount = useMemo(() => alerts.filter((a) => a.source?.toUpperCase() === 'MQTT' || a.category?.toUpperCase() === 'CONNECTION').length, [alerts]);
  const activeCount = useMemo(() => alerts.filter((a) => a.status === 'active').length, [alerts]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel rounded-2xl p-6 border border-hydra-borderHighlight/40">
        <div>
          <h2 className="text-lg font-extrabold text-hydra-textMain flex items-center gap-2">
            <Bell className="w-5 h-5 text-hydra-neon" />
            <span>Centre d'Alertes & Sécurité</span>
            {activeCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-hydra-alert/20 text-hydra-alert border border-hydra-alert/40 animate-pulse">
                {activeCount} active{activeCount > 1 ? 's' : ''}
              </span>
            )}
          </h2>
          <p className="text-xs text-hydra-textMuted mt-1">
            Flux chronologique unifié des événements physiques, alertes météo et décisions de sécurité FusionAI.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refreshAlerts && refreshAlerts()}
            title="Rafraîchir"
            className="p-2.5 rounded-xl bg-hydra-dark border border-hydra-border hover:border-hydra-neon text-hydra-textMuted hover:text-hydra-neon transition"
          >
            <RefreshCw className={`w-4 h-4 ${alertsLoading ? 'animate-spin' : ''}`} />
          </button>
          {isAdmin && (
            <button
              onClick={handleClearAlerts}
              className="px-4 py-2.5 rounded-xl bg-hydra-dark border border-hydra-border hover:border-hydra-alert text-hydra-textMuted hover:text-hydra-alert text-xs font-semibold flex items-center gap-2 transition"
            >
              <Trash2 className="w-4 h-4" />
              <span>Effacer l'historique</span>
            </button>
          )}
        </div>
      </div>

      {/* Source Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-mono">
        <span className="text-hydra-textDim flex items-center gap-1 mr-2 font-sans font-semibold">
          <Filter className="w-3.5 h-3.5" />
          Source :
        </span>
        {[
          { id: 'all', label: `Toutes (${alerts.length})` },
          { id: 'ai', label: `IA FusionAI (${aiCount})`, icon: Brain },
          { id: 'water', label: `Hydraulique & Cuve (${waterCount})`, icon: Droplets },
          { id: 'mqtt', label: `Réseau MQTT (${mqttCount})`, icon: Radio },
          { id: 'system', label: `Système`, icon: Cpu }
        ].map((tab) => {
          const IconComp = tab.icon;
          const isSelected = sourceFilter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSourceFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl border flex items-center gap-1.5 transition whitespace-nowrap ${
                isSelected
                  ? tab.id === 'ai'
                    ? 'bg-cyan-500 text-hydra-darkest font-bold shadow-[0_0_12px_#06b6d4] border-cyan-400'
                    : 'bg-hydra-neon text-hydra-darkest font-bold shadow-[0_0_12px_#00ff88] border-hydra-neon'
                  : 'glass-panel text-hydra-textMuted hover:text-hydra-textMain hover:border-hydra-borderHighlight'
              }`}
            >
              {IconComp && <IconComp className="w-3.5 h-3.5" />}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Secondary Filter: Severity & Status */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-hydra-dark/60 border border-hydra-border text-xs font-mono">
        {/* Severity Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-hydra-textMuted font-sans font-medium mr-1">Sévérité :</span>
          {[
            { id: 'all', label: 'Toutes' },
            { id: 'critical', label: 'Critiques' },
            { id: 'high', label: 'Hautes' },
            { id: 'medium', label: 'Moyennes' },
            { id: 'info', label: 'Informatives' }
          ].map((btn) => (
            <button
              key={btn.id}
              onClick={() => setSeverityFilter(btn.id)}
              className={`px-2.5 py-1 rounded-lg border transition ${
                severityFilter === btn.id
                  ? 'bg-hydra-borderHighlight text-hydra-textMain font-bold border-hydra-neon/50'
                  : 'bg-hydra-dark text-hydra-textMuted hover:text-hydra-textMain border-hydra-border'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-2">
          <span className="text-hydra-textMuted font-sans font-medium mr-1">Statut :</span>
          {[
            { id: 'all', label: 'Tous' },
            { id: 'active', label: 'Actifs' },
            { id: 'resolved', label: 'Résolus' }
          ].map((btn) => (
            <button
              key={btn.id}
              onClick={() => setStatusFilter(btn.id)}
              className={`px-2.5 py-1 rounded-lg border transition ${
                statusFilter === btn.id
                  ? 'bg-hydra-neon/20 text-hydra-neon font-bold border-hydra-neon/50'
                  : 'bg-hydra-dark text-hydra-textMuted hover:text-hydra-textMain border-hydra-border'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Alerts Timeline List */}
      <div className="glass-panel rounded-2xl p-6">
        {filteredAlerts.length > 0 ? (
          <div className="space-y-3">
            {filteredAlerts.map((al) => {
              const isAI = al.source?.toUpperCase() === 'AI' || al.category?.toUpperCase() === 'AI';
              const isCritical = al.severity === 'critical' || al.severity === 'high';
              const isResolved = al.status === 'resolved';

              return (
                <div
                  key={al.id}
                  className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-start justify-between gap-4 transition-all ${
                    isResolved
                      ? 'bg-hydra-dark/40 border-hydra-border/60 opacity-60'
                      : isCritical
                      ? 'bg-hydra-alert/10 border-hydra-alert/40 shadow-[0_0_15px_rgba(255,59,59,0.15)]'
                      : isAI
                      ? 'bg-cyan-500/10 border-cyan-500/30'
                      : al.severity === 'medium'
                      ? 'bg-hydra-warning/10 border-hydra-warning/30'
                      : 'bg-hydra-dark/60 border-hydra-border'
                  }`}
                >
                  <div className="flex items-start gap-4 flex-1">
                    <div className="p-2 rounded-xl bg-hydra-dark/80 border border-current flex-shrink-0 mt-0.5">
                      {isResolved ? (
                        <CheckCircle2 className="w-5 h-5 text-hydra-neon" />
                      ) : (
                        getSeverityIcon(al.severity)
                      )}
                    </div>

                    <div className="space-y-1 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {renderSourceBadge(al.source, al.category)}
                          <StatusBadge status={al.severity} />
                          <span className="font-mono text-xs font-bold text-hydra-textMain">
                            [{al.type}]
                          </span>
                          {al.zoneId && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-hydra-border text-hydra-textMuted border border-hydra-borderHighlight">
                              Zone {al.zoneId}
                            </span>
                          )}
                          {isResolved && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-hydra-neon/15 text-hydra-neon border border-hydra-neon/30">
                              RÉSOLU
                            </span>
                          )}
                        </div>

                        <span className="text-[11px] font-mono text-hydra-textMuted">
                          {new Date(al.createdAt || al.created_at).toLocaleString('fr-FR')} (
                          {formatRelativeTime(al.createdAt || al.created_at)})
                        </span>
                      </div>

                      <p className="text-xs text-hydra-textMain/90 leading-relaxed">
                        {al.message}
                      </p>

                      {al.resolvedAt && (
                        <p className="text-[11px] font-mono text-hydra-textDim pt-1">
                          ✓ Résolu le {new Date(al.resolvedAt).toLocaleString('fr-FR')}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right Action buttons */}
                  <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                    {isAI && onNavigate && (
                      <button
                        onClick={() => onNavigate('ai-analysis')}
                        className="px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 border border-cyan-500/40 text-xs font-bold flex items-center gap-1.5 transition"
                      >
                        <Brain className="w-3.5 h-3.5" />
                        <span>Rapport IA</span>
                      </button>
                    )}

                    {!isResolved && isAdmin && (
                      <button
                        onClick={() => handleResolve(al.id)}
                        disabled={resolvingId === al.id}
                        className="px-3 py-1.5 rounded-lg bg-hydra-dark border border-hydra-border hover:border-hydra-neon hover:text-hydra-neon text-hydra-textMuted text-xs font-semibold flex items-center gap-1.5 transition"
                        title="Acquitter et résoudre cette alerte"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{resolvingId === al.id ? 'Résolution...' : 'Résoudre'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-12 flex flex-col items-center justify-center text-center text-hydra-textMuted">
            <CheckCircle2 className="w-12 h-12 text-hydra-neon mb-3 animate-pulse" />
            <p className="text-sm font-semibold text-hydra-textMain">Aucune alerte à afficher</p>
            <p className="text-xs text-hydra-textDim font-mono mt-1">
              Tous les paramètres physiques et prédictions IA fonctionnent normalement.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
