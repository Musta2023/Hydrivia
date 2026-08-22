import React, { useState, useEffect } from 'react';
import {
  Bell,
  AlertTriangle,
  Info,
  ShieldAlert,
  Trash2,
  Filter,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import api from '../services/api';
import StatusBadge from '../components/common/StatusBadge';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/alerts?severity=${filter}`);
      setAlerts(res.data.alerts || []);
    } catch (err) {
      console.error('Error loading alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, [filter]);

  const handleClearAlerts = async () => {
    if (window.confirm('Voulez-vous vraiment effacer l\'historique des alertes ?')) {
      try {
        await api.delete('/alerts');
        setAlerts([]);
      } catch (err) {
        alert('Erreur: ' + err.message);
      }
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

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel rounded-2xl p-6">
        <div>
          <h2 className="text-lg font-bold text-hydra-textMain flex items-center gap-2">
            <Bell className="w-5 h-5 text-hydra-neon" />
            Centre d'Alertes & Sécurité
          </h2>
          <p className="text-xs text-hydra-textMuted mt-1">
            Flux chronologique des événements système, avertissements de niveau d'eau et notifications d'irrigation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadAlerts}
            title="Rafraîchir"
            className="p-2.5 rounded-xl bg-hydra-dark border border-hydra-border hover:border-hydra-neon text-hydra-textMuted hover:text-hydra-neon transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleClearAlerts}
            className="px-4 py-2.5 rounded-xl bg-hydra-dark border border-hydra-border hover:border-hydra-alert text-hydra-textMuted hover:text-hydra-alert text-xs font-semibold flex items-center gap-2 transition"
          >
            <Trash2 className="w-4 h-4" />
            <span>Effacer l'historique</span>
          </button>
        </div>
      </div>

      {/* Filter Severity Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-mono">
        <span className="text-hydra-textDim flex items-center gap-1 mr-2 font-sans font-semibold">
          <Filter className="w-3.5 h-3.5" />
          Filtrer :
        </span>
        {[
          { id: 'all', label: 'Toutes' },
          { id: 'critical', label: 'Critiques' },
          { id: 'high', label: 'Hautes' },
          { id: 'medium', label: 'Moyennes' },
          { id: 'info', label: 'Informatives' }
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

      {/* Alerts Timeline List */}
      <div className="glass-panel rounded-2xl p-6">
        {alerts.length > 0 ? (
          <div className="space-y-3">
            {alerts.map((al) => (
              <div
                key={al.id}
                className={`p-4 rounded-xl border flex items-start gap-4 transition-all ${
                  al.severity === 'critical' || al.severity === 'high'
                    ? 'bg-hydra-alert/10 border-hydra-alert/40 shadow-[0_0_15px_rgba(255,59,59,0.15)]'
                    : al.severity === 'medium'
                    ? 'bg-hydra-warning/10 border-hydra-warning/30'
                    : 'bg-hydra-dark/60 border-hydra-border'
                }`}
              >
                <div className="p-2 rounded-xl bg-hydra-dark/80 border border-current flex-shrink-0">
                  {getSeverityIcon(al.severity)}
                </div>

                <div className="flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={al.severity} />
                      <span className="font-mono text-xs font-bold text-hydra-textMain">
                        [{al.type}]
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-hydra-textMuted">
                      {new Date(al.created_at).toLocaleString('fr-FR')}
                    </span>
                  </div>
                  <p className="text-xs text-hydra-textMain/90 mt-1 leading-relaxed">
                    {al.message}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 flex flex-col items-center justify-center text-center text-hydra-textMuted">
            <CheckCircle2 className="w-12 h-12 text-hydra-neon mb-3 animate-pulse" />
            <p className="text-sm font-semibold text-hydra-textMain">Aucune alerte à afficher</p>
            <p className="text-xs text-hydra-textDim font-mono mt-1">Tous les paramètres système fonctionnent normalement.</p>
          </div>
        )}
      </div>
    </div>
  );
}
