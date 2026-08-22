import React from 'react';
import {
  LayoutDashboard,
  Box,
  Sprout,
  Droplets,
  BarChart3,
  CloudRain,
  Layers,
  Bell,
  ScrollText,
  Settings,
  LogOut,
  Radio
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { cn } from '../../utils/cn';

const NAV_ITEMS = [
  { id: 'overview', label: 'Vue d\'ensemble', icon: LayoutDashboard },
  { id: '3d', label: 'Visualisation 3D', icon: Box },
  { id: 'zones', label: 'Zones & Cultures', icon: Sprout },
  { id: 'tank', label: 'Réservoir d\'eau', icon: Droplets },
  { id: 'consumption', label: 'Consommation', icon: BarChart3 },
  { id: 'weather', label: 'Météo (Open-Meteo)', icon: CloudRain },
  { id: 'soil', label: 'Sol (SoilGrids)', icon: Layers },
  { id: 'alerts', label: 'Alertes & Sécurité', icon: Bell },
  { id: 'logs', label: 'Journal Système', icon: ScrollText },
  { id: 'settings', label: 'Paramètres', icon: Settings },
];

export default function Sidebar({ activeTab, onTabChange }) {
  const { logout } = useAuth();
  const { telemetry, mqttConnected } = useSocket();

  // Count active valves
  const activeValvesCount = Object.values(telemetry.zones || {}).filter(z => z.valve === 'ON').length;

  return (
    <aside className="w-64 glass-panel border-r border-hydra-border/80 flex flex-col h-screen fixed top-0 left-0 z-40 select-none">
      {/* Brand Header */}
      <div className="h-16 flex items-center gap-3 px-5 border-b border-hydra-border/80">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-hydra-neon to-hydra-neonDim flex items-center justify-center text-hydra-darkest font-extrabold text-lg shadow-[0_0_15px_rgba(0,255,136,0.5)]">
          H
        </div>
        <div>
          <h1 className="text-base font-extrabold tracking-wider text-hydra-textMain flex items-center gap-1.5">
            HYDRIVIA
            <span className="w-1.5 h-1.5 rounded-full bg-hydra-neon animate-pulse shadow-[0_0_6px_#00ff88]" />
          </h1>
          <p className="text-[10px] font-mono text-hydra-textMuted uppercase tracking-widest">
            SMART IRRIGATION
          </p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 group text-left relative',
                isActive
                  ? 'bg-hydra-neon/15 text-hydra-neon border border-hydra-neon/30 shadow-[0_0_15px_rgba(0,255,136,0.12)]'
                  : 'text-hydra-textMuted hover:text-hydra-textMain hover:bg-hydra-dark/60'
              )}
            >
              {/* Active left indicator */}
              {isActive && (
                <span className="absolute left-0 top-2 bottom-2 w-1 bg-hydra-neon rounded-r-full shadow-[0_0_8px_#00ff88]" />
              )}

              <Icon
                className={cn(
                  'w-4 h-4 flex-shrink-0 transition-transform group-hover:scale-110',
                  isActive ? 'text-hydra-neon' : 'text-hydra-textMuted group-hover:text-hydra-textMain'
                )}
              />
              <span className="flex-1 truncate">{item.label}</span>

              {/* Special badges */}
              {item.id === 'zones' && activeValvesCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-hydra-neon text-hydra-darkest animate-pulse">
                  {activeValvesCount} ON
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* System Mini Status Card */}
      <div className="p-3 mx-3 mb-3 rounded-xl bg-hydra-dark/90 border border-hydra-border text-xs space-y-2">
        <div className="flex items-center justify-between text-[11px] text-hydra-textMuted font-mono">
          <span>BROKER MQTT</span>
          <span className={cn('flex items-center gap-1 font-bold', mqttConnected ? 'text-hydra-neon' : 'text-hydra-alert')}>
            <Radio className="w-3 h-3 animate-pulse" />
            {mqttConnected ? 'EN LIGNE' : 'HORS LIGNE'}
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px] text-hydra-textMuted font-mono">
          <span>POMPE 30L/MIN</span>
          <span className={cn('font-bold', telemetry.pump.pump === 'ON' ? 'text-hydra-neon animate-pulse' : 'text-hydra-textDim')}>
            {telemetry.pump.pump}
          </span>
        </div>
      </div>

      {/* Logout Button */}
      <div className="p-3 border-t border-hydra-border/80">
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-hydra-textMuted hover:text-hydra-alert hover:bg-hydra-alert/10 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Déconnexion</span>
        </button>
      </div>
    </aside>
  );
}
