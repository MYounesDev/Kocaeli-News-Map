'use client';

import { CATEGORY_CONFIG } from '@/types/api';

export default function CategoryLegend() {
  return (
    <div className="glass-panel rounded-xl px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
      {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
        <div key={key} className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.color }} />
          <span className="text-[10px] text-[#8b949e] whitespace-nowrap">{cfg.label}</span>
        </div>
      ))}
    </div>
  );
}
