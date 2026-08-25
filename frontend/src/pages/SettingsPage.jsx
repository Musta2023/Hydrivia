import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings,
  Shield,
  Radio,
  MapPin,
  Save,
  CheckCircle2,
  Lock,
  Cpu,
  Users,
  UserPlus,
  Trash2,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../services/api';

export default function SettingsPage() {
  const { user, isAdmin, isOperator } = useAuth();
  const { mqttConnected } = useSocket();

  // Self Password Change State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passMsg, setPassMsg] = useState({ type: '', text: '' });
  const [loadingPass, setLoadingPass] = useState(false);

  // User Management State (Admin only)
  const [usersList, setUsersList] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('OPERATOR');
  const [userActionMsg, setUserActionMsg] = useState({ type: '', text: '' });
  const [creatingUser, setCreatingUser] = useState(false);

  const fetchUsers = useCallback(async () => {
    if (!isAdmin) return;
    setLoadingUsers(true);
    try {
      const res = await api.get('/users');
      setUsersList(res.data.users || []);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoadingUsers(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin, fetchUsers]);

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

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setUserActionMsg({ type: '', text: '' });
    setCreatingUser(true);

    try {
      const res = await api.post('/users', {
        email: newUserEmail,
        password: newUserPassword,
        role: newUserRole
      });
      setUserActionMsg({ type: 'success', text: res.data.message || 'Compte créé avec succès.' });
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserRole('OPERATOR');
      fetchUsers();
    } catch (err) {
      setUserActionMsg({ type: 'error', text: err.response?.data?.error || 'Erreur lors de la création.' });
    } finally {
      setCreatingUser(false);
    }
  };

  const handleToggleRole = async (targetUser) => {
    const nextRole = targetUser.role === 'ADMIN' ? 'OPERATOR' : 'ADMIN';
    if (!window.confirm(`Changer le rôle de ${targetUser.email} en ${nextRole} ?`)) return;

    try {
      await api.patch(`/users/${targetUser.id}/role`, { role: nextRole });
      fetchUsers();
    } catch (err) {
      alert('Erreur modification rôle: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDeleteUser = async (targetUser) => {
    if (!window.confirm(`Voulez-vous vraiment supprimer le compte ${targetUser.email} ?`)) return;

    try {
      await api.delete(`/users/${targetUser.id}`);
      fetchUsers();
    } catch (err) {
      alert('Erreur suppression compte: ' + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="glass-panel rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-hydra-textMain flex items-center gap-2">
            <Settings className="w-5 h-5 text-hydra-neon" />
            Paramètres & Configuration Système
          </h2>
          <p className="text-xs text-hydra-textMuted mt-1">
            Gestion des identifiants, sécurité RBAC, paramètres de géolocalisation et diagnostic IoT.
          </p>
        </div>

        {isOperator && (
          <div className="px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-mono">
            <span>🔒 Mode Opérateur (Paramètres système restreints)</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Hardware & GPS Info */}
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

        {/* Right Column: Security & RBAC User Management */}
        <div className="space-y-6">
          {/* Change Password Card (Self-service for both ADMIN & OPERATOR) */}
          <div className="glass-panel rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-hydra-textMain uppercase tracking-wider flex items-center gap-2">
                <Lock className="w-4 h-4 text-hydra-neon" />
                Sécurité du Compte Personnel
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-hydra-dark border border-hydra-border text-hydra-neon">
                {user?.role || 'USER'}
              </span>
            </div>

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

          {/* User Management Section (ADMIN ONLY) */}
          {isAdmin ? (
            <div className="glass-panel rounded-2xl p-6 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-hydra-border">
                <h3 className="text-sm font-bold text-hydra-textMain uppercase tracking-wider flex items-center gap-2">
                  <Users className="w-4 h-4 text-hydra-neon" />
                  Gestion des Utilisateurs & Rôles (RBAC)
                </h3>
                <button
                  onClick={fetchUsers}
                  title="Rafraîchir"
                  className="p-1.5 rounded-lg bg-hydra-dark border border-hydra-border hover:border-hydra-neon text-hydra-textMuted hover:text-hydra-neon transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingUsers ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* Create User Form */}
              <form onSubmit={handleCreateUser} className="p-4 rounded-xl bg-hydra-dark/60 border border-hydra-border space-y-3 text-xs">
                <div className="font-semibold text-hydra-textMain flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5 text-hydra-neon" />
                  <span>Ajouter un nouvel utilisateur</span>
                </div>

                {userActionMsg.text && (
                  <div className={`p-2 rounded-lg text-xs ${userActionMsg.type === 'success' ? 'bg-hydra-neon/20 text-hydra-neon' : 'bg-hydra-alert/20 text-hydra-alert'}`}>
                    {userActionMsg.text}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="email"
                    required
                    placeholder="Email utilisateur"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    className="bg-hydra-dark border border-hydra-border rounded-lg p-2 text-hydra-textMain outline-none focus:border-hydra-neon"
                  />
                  <input
                    type="password"
                    required
                    placeholder="Mot de passe (≥ 6 car.)"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    className="bg-hydra-dark border border-hydra-border rounded-lg p-2 text-hydra-textMain outline-none focus:border-hydra-neon"
                  />
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value)}
                    className="bg-hydra-dark border border-hydra-border rounded-lg p-2 text-hydra-textMain outline-none focus:border-hydra-neon font-mono"
                  >
                    <option value="OPERATOR">OPERATOR (Lecture seule)</option>
                    <option value="ADMIN">ADMIN (Contrôle total)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={creatingUser}
                  className="w-full neon-button py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{creatingUser ? 'Création...' : 'Créer le compte'}</span>
                </button>
              </form>

              {/* Users List Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-hydra-border text-hydra-textDim">
                      <th className="pb-2">EMAIL</th>
                      <th className="pb-2">RÔLE</th>
                      <th className="pb-2 text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hydra-border/40">
                    {usersList.map((u) => {
                      const isSelf = u.id === user?.id;
                      const isUAdmin = u.role === 'ADMIN';

                      return (
                        <tr key={u.id} className="hover:bg-hydra-dark/60 transition">
                          <td className="py-2.5 text-hydra-textMain font-sans">
                            {u.email}
                            {isSelf && <span className="ml-1.5 text-[10px] text-hydra-neon font-mono">(Vous)</span>}
                          </td>
                          <td className="py-2.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isUAdmin
                                ? 'bg-hydra-neon/20 text-hydra-neon border border-hydra-neon/40'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            }`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="py-2.5 text-right space-x-2">
                            {!isSelf && (
                              <>
                                <button
                                  onClick={() => handleToggleRole(u)}
                                  className="px-2 py-1 rounded bg-hydra-dark border border-hydra-border hover:border-hydra-neon text-hydra-textMuted hover:text-hydra-neon text-[10px] transition"
                                  title="Changer de rôle"
                                >
                                  {isUAdmin ? '➔ Opérateur' : '➔ Admin'}
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(u)}
                                  className="p-1 rounded bg-hydra-dark border border-hydra-border hover:border-hydra-alert text-hydra-textMuted hover:text-hydra-alert transition"
                                  title="Supprimer l'utilisateur"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="glass-panel rounded-2xl p-6 border border-hydra-border/60 text-xs text-hydra-textMuted space-y-2">
              <div className="flex items-center gap-2 text-amber-400 font-semibold">
                <AlertCircle className="w-4 h-4" />
                <span>Gestion des Comptes Utilisateurs</span>
              </div>
              <p>
                Vous êtes connecté en tant qu'<strong>Opérateur</strong>. La création de nouveaux comptes et l'attribution des privilèges système sont réservées aux administrateurs.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
