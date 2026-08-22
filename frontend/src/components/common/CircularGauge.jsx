import React from 'react';

export default function CircularGauge({
  value = 0,
  max = 100,
  size = 140,
  strokeWidth = 10,
  unit = '%',
  label = '',
  color = '#00ff88',
  sublabel = ''
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center relative select-none">
      <div style={{ width: size, height: size }} className="relative flex items-center justify-center">
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#1e2e28"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Progress circle with glow */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            style={{
              transition: 'stroke-dashoffset 0.8s ease-in-out',
              filter: `drop-shadow(0 0 6px ${color}88)`
            }}
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-bold font-mono text-hydra-textMain tracking-tight">
            {typeof value === 'number' ? value.toFixed(1) : value}
            <span className="text-sm font-sans font-normal text-hydra-textMuted ml-0.5">{unit}</span>
          </span>
          {sublabel && (
            <span className="text-[11px] text-hydra-textDim font-medium mt-0.5">
              {sublabel}
            </span>
          )}
        </div>
      </div>
      {label && (
        <span className="text-xs font-medium text-hydra-textMuted mt-2 tracking-wide uppercase">
          {label}
        </span>
      )}
    </div>
  );
}
