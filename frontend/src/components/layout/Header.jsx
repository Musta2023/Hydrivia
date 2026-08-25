import React, { useState, useEffect } from 'react';
import { Wifi, AlertOctagon, User, LogOut, Clock, ShieldAlert, Cpu } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import EmergencyModal from './EmergencyModal';
import { cn } from '../../utils/cn';

export default function Header({ activeTab, onNavigate }) {
  const { user, role, isAdmin, isOperator, logout } = useAuth();
  const { mqttConnected, wsConnected, emergencyStopped, staleData } = useSocket();
  const [time, setTime] = useState(new Date());
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedTime = time.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const formattedDate = time.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });

  const userInitials = (user?.email || 'AD').slice(0, 2).toUpperCase();

  return (
    <>
      <header className="sticky top-0 z-30 h-16 glass-panel border-b border-hydra-border/80 px-4 lg:px-8 flex items-center justify-between gap-4">
        {/* Left: Active view title & Station info */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-lg bg-hydra-dark/80 border border-hydra-border text-xs font-mono text-hydra-neon">
            <Cpu className="w-3.5 h-3.5" />
            <span>ESP32-01</span>
          </div>

          {isOperator && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-mono font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span>MODE OPÉRATEUR (LECTURE SEULE)</span>
            </div>
          )}

          {staleData && (
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-hydra-warning/20 border border-hydra-warning/40 text-hydra-warning text-xs font-medium animate-pulse">
              <span>⚠️ Données non actualisées</span>
            </div>
          )}

          {emergencyStopped && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-hydra-alert/25 border border-hydra-alert text-hydra-alert text-xs font-bold animate-pulse shadow-[0_0_15px_rgba(255,59,59,0.5)]">
              <ShieldAlert className="w-4 h-4" />
              <span>SYSTÈME ARRÊTÉ</span>
            </div>
          )}
        </div>

        {/* Right: Status Pills, Clock, Emergency Stop, User */}
        <div className="flex items-center gap-3 lg:gap-5">
          {/* Live Clock */}
          <div className="hidden md:flex items-center gap-2 text-xs font-mono text-hydra-textMuted bg-hydra-dark/60 px-3 py-1.5 rounded-lg border border-hydra-border">
            <Clock className="w-3.5 h-3.5 text-hydra-neon" />
            <span className="capitalize">{formattedDate}</span>
            <span className="text-hydra-textMain font-semibold">{formattedTime}</span>
          </div>

          {/* MQTT & Wi-Fi Connection Pill */}
          <div
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-all',
              mqttConnected
                ? 'bg-hydra-neon/10 border-hydra-neon/30 text-hydra-neon'
                : 'bg-hydra-alert/10 border-hydra-alert/30 text-hydra-alert'
            )}
            title={mqttConnected ? 'Connecté à HiveMQ Cloud TLS' : 'Déconnecté du broker MQTT'}
          >
            <span className="relative flex h-2 w-2">
              {mqttConnected && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-hydra-neon opacity-75"></span>
              )}
              <span
                className={cn(
                  'relative inline-flex rounded-full h-2 w-2',
                  mqttConnected ? 'bg-hydra-neon' : 'bg-hydra-alert'
                )}
              ></span>
            </span>
            <Wifi className="w-3.5 h-3.5" />
            <span className="hidden sm:inline font-mono">
              {mqttConnected ? 'MQTT CONNECTÉ' : 'MQTT DÉCONNECTÉ'}
            </span>
          </div>

          {/* Emergency Stop Button (Admin only) */}
          {isAdmin ? (
            <button
              onClick={() => setShowEmergencyModal(true)}
              className={cn(
                'emergency-button px-3.5 py-1.5 lg:px-4 lg:py-2 rounded-xl text-xs lg:text-sm flex items-center gap-2 transition-transform',
                emergencyStopped && 'ring-2 ring-hydra-alert animate-pulse'
              )}
            >
              <AlertOctagon className="w-4 h-4 flex-shrink-0" />
              <span className="tracking-wide uppercase">
                {emergencyStopped ? 'STATUT ARRÊT' : 'ARRÊT D\'URGENCE'}
              </span>
            </button>
          ) : (
            <div
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-mono border flex items-center gap-1.5',
                emergencyStopped
                  ? 'bg-hydra-alert/20 border-hydra-alert/40 text-hydra-alert font-bold animate-pulse'
                  : 'bg-hydra-dark/60 border-hydra-border text-hydra-textMuted opacity-75'
              )}
              title="Action réservée aux administrateurs"
            >
              <AlertOctagon className="w-3.5 h-3.5 text-hydra-alert" />
              <span>{emergencyStopped ? 'ARRÊT D\'URGENCE ACTIF' : 'ARRÊT : ADMIN REQUIS'}</span>
            </div>
          )}

          {/* User & Logout */}
          <div className="flex items-center gap-2 pl-2 border-l border-hydra-border">
            <div
              title={`${user?.email || 'Utilisateur'} (${role || 'USER'})`}
              className={cn(
                'w-8 h-8 rounded-full border flex items-center justify-center font-bold text-xs font-mono cursor-default',
                isAdmin
                  ? 'bg-hydra-neon/20 border-hydra-neon/40 text-hydra-neon shadow-[0_0_10px_rgba(0,255,136,0.2)]'
                  : 'bg-amber-500/20 border-amber-500/40 text-amber-400'
              )}
            >
              {userInitials}
            </div>
            <button
              onClick={logout}
              title="Se déconnecter"
              className="p-1.5 text-hydra-textMuted hover:text-hydra-alert hover:bg-hydra-border/60 rounded-lg transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Emergency Modal Component */}
      <EmergencyModal
        isOpen={showEmergencyModal}
        onClose={() => setShowEmergencyModal(false)}
      />
    </>
  );
}
