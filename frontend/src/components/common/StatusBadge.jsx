import React from 'react';
import { cn } from '../../utils/cn';

export default function StatusBadge({ status, label, className }) {
  const isPositive = status === 'ON' || status === 'active' || status === 'NORMAL' || status === 'info' || status === 'completed';
  const isNegative = status === 'OFF' || status === 'inactive' || status === 'EMERGENCY_STOPPED' || status === 'critical' || status === 'high';
  const isWarning = status === 'medium' || status === 'WARNING' || status === 'low';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide uppercase',
        isPositive && 'bg-hydra-neon/15 text-hydra-neon border border-hydra-neon/30',
        isNegative && 'bg-hydra-alert/15 text-hydra-alert border border-hydra-alert/30',
        isWarning && 'bg-hydra-warning/15 text-hydra-warning border border-hydra-warning/30',
        !isPositive && !isNegative && !isWarning && 'bg-hydra-border text-hydra-textMuted border border-hydra-borderHighlight',
        className
      )}
    >
      <span
        className={cn(
          'w-1.5 h-1.5 rounded-full',
          isPositive && 'bg-hydra-neon shadow-[0_0_8px_#00ff88]',
          isNegative && 'bg-hydra-alert shadow-[0_0_8px_#ff3b3b]',
          isWarning && 'bg-hydra-warning shadow-[0_0_8px_#ffaa00]',
          !isPositive && !isNegative && !isWarning && 'bg-hydra-textDim'
        )}
      />
      {label || status}
    </span>
  );
}
