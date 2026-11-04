import React from 'react';

/**
 * Standardized KPI Metric Card Component
 * Implements KSYN's vertical flow layout with clean typography,
 * category icon, primary value, context subtext, and optional badge.
 */
export default function KpiCard({
  label,
  value,
  valueColor = 'text-white',
  icon,
  iconBg = 'bg-[#1C1C1C]',
  subtext,
  badge
}) {
  return (
    <div className="bg-[#121212] border border-[#262626] rounded-xl p-5 flex flex-col justify-between min-h-[140px] hover:border-[#383838] transition-colors">
      {/* Top Row: Label & Category Icon */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
          {label}
        </span>
        <div className={`p-2 rounded-lg ${iconBg || 'bg-[#1C1C1C]'} shrink-0`}>
          {icon}
        </div>
      </div>

      {/* Middle Row: Primary Value */}
      <div className="my-2">
        <div className={`text-2xl sm:text-3xl font-black font-mono tracking-tight whitespace-nowrap ${valueColor || 'text-white'}`}>
          {value}
        </div>
      </div>

      {/* Bottom Row: Context / Helper Subtext */}
      <div className="flex items-center justify-between text-xs text-gray-400 gap-2">
        <span className="truncate">{subtext}</span>
        {badge && (
          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#1F1F1F] text-gray-300 border border-[#333] shrink-0">
            {badge}
          </span>
        )}
      </div>
    </div>
  );
}
