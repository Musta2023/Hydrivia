import React from 'react';
import { cn } from '../../utils/cn';

export default function StatCard({
  title,
  value,
  unit = '',
  subtitle,
  icon: Icon,
  trend,
  trendPositive,
  status,
  className,
  highlight = false,
  alert = false
}) {
  return (
    <div
      className={cn(
        'glass-panel rounded-xl p-5 relative overflow-hidden transition-all duration-300',
        'glass-panel-hover',
        highlight && 'border-hydra-neon/40 shadow-[0_0_20px_rgba(0,255,136,0.12)]',
        alert && 'border-hydra-alert/40 shadow-[0_0_20px_rgba(255,59,59,0.15)]',
        className
      )}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-xs font-semibold text-hydra-textMuted uppercase tracking-wider">
          {title}
        </span>
        {Icon && (
          <div
            className={cn(
              'p-2 rounded-lg',
              alert ? 'bg-hydra-alert/15 text-hydra-alert' :
              highlight ? 'bg-hydra-neon/15 text-hydra-neon' :
              'bg-hydra-border/60 text-hydra-textMuted'
            )}
          >
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>

      {/* Main Value */}
      <div className="flex items-baseline gap-1.5 mb-1">
        <span
          className={cn(
            'text-2xl lg:text-3xl font-bold font-mono tracking-tight',
            alert ? 'text-hydra-alert' :
            highlight ? 'text-hydra-neon' :
            'text-hydra-textMain'
          )}
        >
          {value}
        </span>
        {unit && (
          <span className="text-sm font-sans font-medium text-hydra-textMuted">
            {unit}
          </span>
        )}
      </div>

      {/* Subtitle / Trend */}
      <div className="flex items-center justify-between text-xs mt-2">
        {subtitle && (
          <span className="text-hydra-textMuted font-medium truncate">
            {subtitle}
          </span>
        )}
        {trend && (
          <span
            className={cn(
              'font-mono font-semibold ml-auto',
              trendPositive ? 'text-hydra-neon' : 'text-hydra-alert'
            )}
          >
            {trend}
          </span>
        )}
      </div>

      {/* Subtle bottom glow line */}
      {highlight && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-hydra-neon to-transparent opacity-75" />
      )}
      {alert && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-hydra-alert to-transparent opacity-75" />
      )}
    </div>
  );
}
