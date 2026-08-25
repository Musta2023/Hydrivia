import React, { useState } from 'react';
import { AlertOctagon, ShieldAlert, X, Power, CheckCircle, Lock } from 'lucide-react';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';

export default function EmergencyModal({ isOpen, onClose }) {
  const { triggerEmergency, resumeSystem, emergencyStopped } = useSocket();
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleConfirmStop = async () => {
    if (!isAdmin) {
      alert('Action réservée aux administrateurs.');
      return;
    }
    setLoading(true);
    try {
      await triggerEmergency();
      setSuccessMsg('ARRÊT D\'URGENCE ENVOYÉ : Pompe et toutes les vannes coupées.');
      setTimeout(() => {
        setLoading(false);
        setSuccessMsg('');
        onClose();
      }, 1500);
    } catch (err) {
      setLoading(false);
      alert('Erreur lors de l\'arrêt d\'urgence: ' + err.message);
    }
  };

  const handleResume = async () => {
    setLoading(true);
    try {
      await resumeSystem();
      setSuccessMsg('Système réactivé en mode normal.');
      setTimeout(() => {
        setLoading(false);
        setSuccessMsg('');
        onClose();
      }, 1200);
    } catch (err) {
      setLoading(false);
      alert('Erreur lors de la reprise: ' + err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg glass-panel rounded-2xl border border-hydra-alert/50 shadow-[0_0_50px_rgba(255,59,59,0.35)] p-6 overflow-hidden">
        {/* Glow Header */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-hydra-alert to-transparent" />

        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-4 right-4 text-hydra-textMuted hover:text-hydra-textMain p-1 rounded-lg hover:bg-hydra-border transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Icon & Title */}
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 bg-hydra-alert/20 text-hydra-alert rounded-2xl border border-hydra-alert/40 shadow-[0_0_20px_rgba(255,59,59,0.4)]">
            <AlertOctagon className="w-8 h-8 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-hydra-textMain tracking-wide">
              {emergencyStopped ? 'Système Actuellement Arrêté' : 'Procédure d\'Arrêt d\'Urgence'}
            </h2>
            <p className="text-xs text-hydra-textMuted font-mono">
              SÉCURITÉ MATÉRIELLE & HYDRAULIQUE
            </p>
          </div>
        </div>

        {/* Success message banner */}
        {successMsg && (
          <div className="mb-4 p-3 bg-hydra-neon/20 border border-hydra-neon/40 rounded-xl text-hydra-neon text-sm flex items-center gap-2">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Content Body */}
        {!emergencyStopped ? (
          <div className="space-y-4 mb-6 text-sm text-hydra-textMuted">
            <p className="text-hydra-textMain font-medium">
              Êtes-vous certain de vouloir couper immédiatement l'alimentation de la pompe et fermer toutes les électrovannes ?
            </p>
            <div className="p-3.5 bg-hydra-dark/80 rounded-xl border border-hydra-border space-y-2 text-xs">
              <div className="flex items-center gap-2 text-hydra-alert">
                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                <span>Arrêt immédiat de la pompe de 30 L/min</span>
              </div>
              <div className="flex items-center gap-2 text-hydra-alert">
                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                <span>Fermeture forcée des 3 zones (Tomate, Menthe, Oignon)</span>
              </div>
              <div className="flex items-center gap-2 text-hydra-textMuted">
                <Power className="w-4 h-4 flex-shrink-0" />
                <span>Enregistrement automatique au journal de sécurité</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 mb-6 text-sm text-hydra-textMuted">
            <p className="text-hydra-alert font-medium">
              Le système est actuellement en statut verrouillé <span className="font-mono">[ARRÊT D'URGENCE]</span>.
            </p>
            <p>
              Toutes les vannes sont maintenues fermées et la pompe est désactivée. Cliquez ci-dessous pour réinitialiser et autoriser à nouveau les commandes d'irrigation.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-hydra-border">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-hydra-textMuted hover:text-hydra-textMain hover:bg-hydra-border/60 transition"
          >
            Annuler
          </button>

          {!emergencyStopped ? (
            <button
              onClick={handleConfirmStop}
              disabled={loading}
              className="px-6 py-2.5 emergency-button rounded-xl text-sm font-bold flex items-center gap-2"
            >
              <AlertOctagon className="w-4 h-4" />
              {loading ? 'Arrêt en cours...' : 'CONFIRMER L\'ARRÊT'}
            </button>
          ) : (
            <button
              onClick={handleResume}
              disabled={loading}
              className="px-6 py-2.5 neon-button rounded-xl text-sm font-bold flex items-center gap-2"
            >
              <Power className="w-4 h-4" />
              {loading ? 'Réactivation...' : 'RÉACTIVER LE SYSTÈME'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
