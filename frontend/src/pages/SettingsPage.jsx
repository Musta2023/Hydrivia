import React, { useState } from 'react';
import {
  Settings,
  Shield,
  Radio,
  MapPin,
  Save,
  CheckCircle2,
  Lock,
  Cpu,
  Server
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../services/api';

export default function SettingsPage() {
  const { user } = useAuth();
  const { mqttConnected } = useSocket();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passMsg, setPassMsg] = useState({ type: '', text: '' });
  const [loadingPass, setLoadingPass] = useState(false);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPassMsg({ type: '', text: '' });

    if (newPassword !== confirmPassword) {
      setPassMsg({ type: 'error', text: 'Les nouveaux mots de passe ne correspondent pas.' });
      return;
    }

    setLoadingPass(true);
    try {
      const res = await api.post('/auth/change-password', { currentPassword, newPassword });
      setPassMsg({ type: 'success', text: res.data.message || 'Mot de passe modifié avec succès.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPassMsg({ type: 'error', text: err.response?.data?.error || 'Erreur modification mot de passe.' });
    } finally {
      setLoadingPass(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="glass-panel rounded-2xl p-6">
        <h2 className="text-lg font-bold text-hydra-textMain flex items-center gap-2">
          <Settings className="w-5 h-5 text-hydra-neon" />
          Paramètres & Configuration Système
        </h2>
        <p className="text-xs text-hydra-textMuted mt-1">
          Gestion des identifiants, paramètres de géolocalisation et diagnostic des connexions.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: MQTT & IoT Hardware Information */}
        <div className="space-y-6">
          {/* MQTT Status Card */}
          <div className="glass-panel rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-hydra-textMain uppercase tracking-wider flex items-center gap-2">
              <Radio className="w-4 h-4 text-hydra-neon" />
              Connexion Broker HiveMQ Cloud
            </h3>

            <div className="space-y-3 text-xs font-mono">
              <div className="flex items-center justify-between p-3 rounded-xl bg-hydra-dark/70 border border-hydra-border">
                <span className="text-hydra-textMuted">Serveur Broker :</span>
                <span className="text-hydra-textMain font-bold">6c645ee758...hivemq.cloud</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-hydra-dark/70 border border-hydra-border">
                <span className="text-hydra-textMuted">Port & Protocole :</span>
                <span className="text-hydra-neon font-bold">8883 (TLS / MQTTS)</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-hydra-dark/70 border border-hydra-border">
                <span className="text-hydra-textMuted">Statut Connexion :</span>
                <span className={`px-2.5 py-0.5 rounded-full font-bold ${mqttConnected ? 'bg-hydra-neon/20 text-hydra-neon' : 'bg-hydra-alert/20 text-hydra-alert'}`}>
                  {mqttConnected ? 'ACTIF (CONNECTÉ)' : 'HORS LIGNE'}
                </span>
              </div>
            </div>
          </div>

          {/* ESP32 Hardware Specs */}
          <div className="glass-panel rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-hydra-textMain uppercase tracking-wider flex items-center gap-2">
              <Cpu className="w-4 h-4 text-hydra-neon" />
              Spécifications Matérielles ESP32
            </h3>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between py-2 border-b border-hydra-border/60">
                <span className="text-hydra-textMuted">Identifiant Appareil :</span>
                <span className="font-mono font-bold text-hydra-textMain">hydrivia-esp32-01</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-hydra-border/60">
                <span className="text-hydra-textMuted">Capacité Réservoir :</span>
                <span className="font-mono font-bold text-hydra-textMain">7 000 Litres</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-hydra-border/60">
                <span className="text-hydra-textMuted">Débit Pompe Principal :</span>
                <span className="font-mono font-bold text-hydra-neon">30.0 L/min (0.5 L/s)</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-hydra-textMuted">Capteurs & Vannes :</span>
                <span className="font-mono text-hydra-textMain">Zone 1 (Tomate), Zone 2 (Menthe), Zone 3 (Oignon)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Security & Password */}
        <div className="space-y-6">
          {/* Change Password Card */}
          <div className="glass-panel rounded-2xl p-6">
            <h3 className="text-sm font-bold text-hydra-textMain uppercase tracking-wider mb-4 flex items-center gap-2">
              <Lock className="w-4 h-4 text-hydra-neon" />
              Sécurité du Compte Administrateur
            </h3>

            {passMsg.text && (
              <div
                className={`mb-4 p-3 rounded-xl text-xs flex items-center gap-2 ${
                  passMsg.type === 'success'
                    ? 'bg-hydra-neon/20 border border-hydra-neon text-hydra-neon'
                    : 'bg-hydra-alert/20 border border-hydra-alert text-hydra-alert'
                }`}
              >
                {passMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                <span>{passMsg.text}</span>
              </div>
            )}

            <form onSubmit={handlePasswordChange} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-hydra-textMuted uppercase mb-1">
                  Mot de passe actuel
                </label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-hydra-dark/80 border border-hydra-border focus:border-hydra-neon rounded-xl p-3 text-sm text-hydra-textMain outline-none font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-hydra-textMuted uppercase mb-1">
                  Nouveau mot de passe
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Au moins 6 caractères"
                  className="w-full bg-hydra-dark/80 border border-hydra-border focus:border-hydra-neon rounded-xl p-3 text-sm text-hydra-textMain outline-none font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-hydra-textMuted uppercase mb-1">
                  Confirmer le nouveau mot de passe
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Répétez le nouveau mot de passe"
                  className="w-full bg-hydra-dark/80 border border-hydra-border focus:border-hydra-neon rounded-xl p-3 text-sm text-hydra-textMain outline-none font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={loadingPass}
                className="w-full neon-button py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg mt-2"
              >
                <Save className="w-4 h-4" />
                <span>{loadingPass ? 'Modification en cours...' : 'METTRE À JOUR LE MOT DE PASSE'}</span>
              </button>
            </form>
          </div>

          {/* GPS Coordinates */}
          <div className="glass-panel rounded-2xl p-6 space-y-3">
            <h3 className="text-sm font-bold text-hydra-textMain uppercase tracking-wider flex items-center gap-2">
              <MapPin className="w-4 h-4 text-hydra-neon" />
              Coordonnées GPS de la Parcelle
            </h3>
            <p className="text-xs text-hydra-textMuted">
              Utilisées pour interroger les modèles Open-Meteo et SoilGrids.
            </p>

            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-3 bg-hydra-dark/80 rounded-xl border border-hydra-border">
                <span className="text-hydra-textMuted block">Latitude</span>
                <span className="font-bold text-hydra-textMain">33.5731 °N</span>
              </div>
              <div className="p-3 bg-hydra-dark/80 rounded-xl border border-hydra-border">
                <span className="text-hydra-textMuted block">Longitude</span>
                <span className="font-bold text-hydra-textMain">-7.5898 °W</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
