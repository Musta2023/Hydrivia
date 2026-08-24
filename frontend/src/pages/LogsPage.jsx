import React, { useState, useEffect } from 'react';
import {
  ScrollText,
  RefreshCw,
  Terminal,
  User,
  Clock,
  ShieldAlert,
  Zap,
  Activity
} from 'lucide-react';
import api from '../services/api';

export default function LogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/logs');
      setLogs(res.data.logs || []);
    } catch (err) {
      console.error('Error loading logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const getEventBadgeClass = (type) => {
    if (type.includes('URGENCE') || type.includes('ERROR') || type.includes('FAIL')) {
      return 'bg-hydra-alert/20 text-hydra-alert border-hydra-alert/40';
    }
    if (type.includes('IRRIGATION') || type.includes('CONNEXION') || type.includes('SUCCESS')) {
      return 'bg-hydra-neon/20 text-hydra-neon border-hydra-neon/40';
    }
    return 'bg-hydra-border text-hydra-textMuted border-hydra-borderHighlight';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel rounded-2xl p-6">
        <div>
          <h2 className="text-lg font-bold text-hydra-textMain flex items-center gap-2">
            <ScrollText className="w-5 h-5 text-hydra-neon" />
            Journal d'Audit & Événements Système
          </h2>
          <p className="text-xs text-hydra-textMuted mt-1">
            Traçabilité complète des actions administratives, commandes MQTT, états de pompe et incidents de sécurité.
          </p>
        </div>

        <button
          onClick={loadLogs}
          className="neon-button px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Actualiser le journal</span>
        </button>
      </div>

      {/* Terminal Log Viewer */}
      <div className="glass-panel rounded-2xl p-6">
        <div className="flex items-center justify-between pb-4 border-b border-hydra-border mb-4 text-xs font-mono text-hydra-textMuted">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-hydra-neon" />
            <span>CONSOLE D'AUDIT (PostgreSQL / Supabase)</span>
          </div>
          <span>{logs.length} entrées enregistrées</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-hydra-border text-hydra-textDim">
                <th className="pb-3 font-semibold">HORODATAGE</th>
                <th className="pb-3 font-semibold">ÉVÉNEMENT</th>
                <th className="pb-3 font-semibold">DESCRIPTION</th>
                <th className="pb-3 font-semibold">UTILISATEUR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hydra-border/40">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-hydra-dark/60 transition">
                  <td className="py-3 text-hydra-textMuted whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString('fr-FR')}
                  </td>
                  <td className="py-3">
                    <span className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold ${getEventBadgeClass(log.event_type)}`}>
                      {log.event_type}
                    </span>
                  </td>
                  <td className="py-3 text-hydra-textMain font-sans pr-4">
                    {log.description}
                  </td>
                  <td className="py-3 text-hydra-neon whitespace-nowrap font-sans">
                    {log.user_email || 'Système'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
