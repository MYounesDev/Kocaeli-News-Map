'use client';

import { BarChart3, MapPin, Newspaper, TrendingUp } from 'lucide-react';
import type { StatsResponse } from '@/types/api';
import { getCategoryConfig } from '@/types/api';

interface StatsPanelProps {
  stats: StatsResponse | null;
  isLoading?: boolean;
}

export default function StatsPanel({ stats, isLoading }: StatsPanelProps) {
  if (isLoading) {
    return (
      <div className="glass-panel rounded-xl p-4 space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-[#58a6ff]" />
          <span className="text-sm font-semibold text-[#e6edf3]">İstatistikler</span>
        </div>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-6 bg-[#21262d] rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const topCategories = Object.entries(stats.by_category)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const topSources = Object.entries(stats.by_source)
    .sort((a, b) => b[1] - a[1]);

  const topDistricts = Object.entries(stats.by_district)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const maxCatCount = topCategories[0]?.[1] ?? 1;
  const maxSrcCount = topSources[0]?.[1] ?? 1;
  const maxDistCount = topDistricts[0]?.[1] ?? 1;

  return (
    <div className="glass-panel flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#30363d]">
        <BarChart3 className="w-4 h-4 text-[#58a6ff]" />
        <span className="text-sm font-semibold text-[#e6edf3]">İstatistikler</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Total */}
        <div className="flex items-center gap-3 bg-[#1f6feb]/10 border border-[#1f6feb]/30 rounded-lg p-3">
          <div className="w-10 h-10 rounded-lg bg-[#1f6feb]/20 flex items-center justify-center">
            <Newspaper className="w-5 h-5 text-[#58a6ff]" />
          </div>
          <div>
            <div className="text-2xl font-bold text-[#e6edf3]">{stats.total_articles.toLocaleString('tr-TR')}</div>
            <div className="text-xs text-[#8b949e]">Toplam Haber</div>
          </div>
        </div>

        {/* By Category */}
        <StatGroup title="Haber Türü" icon={<TrendingUp className="w-3.5 h-3.5 text-[#58a6ff]" />}>
          {topCategories.map(([cat, count]) => {
            const cfg = getCategoryConfig(cat);
            const pct = Math.round((count / maxCatCount) * 100);
            return (
              <div key={cat} className="space-y-1">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.color }} />
                    <span className="text-xs text-[#c9d1d9]">{cfg.label}</span>
                  </div>
                  <span className="text-xs font-mono text-[#58a6ff]">{count}</span>
                </div>
                <div className="h-1.5 bg-[#21262d] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: cfg.color }}
                  />
                </div>
              </div>
            );
          })}
        </StatGroup>

        {/* By Source */}
        <StatGroup title="Kaynak" icon={<Newspaper className="w-3.5 h-3.5 text-[#58a6ff]" />}>
          {topSources.map(([source, count]) => {
            const pct = Math.round((count / maxSrcCount) * 100);
            return (
              <div key={source} className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#c9d1d9] truncate max-w-[140px]">{source}</span>
                  <span className="text-xs font-mono text-[#58a6ff]">{count}</span>
                </div>
                <div className="h-1.5 bg-[#21262d] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#1f6feb] transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </StatGroup>

        {/* By District */}
        <StatGroup title="İlçe" icon={<MapPin className="w-3.5 h-3.5 text-[#58a6ff]" />}>
          {topDistricts.map(([district, count]) => {
            const pct = Math.round((count / maxDistCount) * 100);
            return (
              <div key={district} className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#c9d1d9]">{district}</span>
                  <span className="text-xs font-mono text-[#58a6ff]">{count}</span>
                </div>
                <div className="h-1.5 bg-[#21262d] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#10b981] transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </StatGroup>
      </div>
    </div>
  );
}

function StatGroup({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <span className="text-xs font-semibold text-[#8b949e] uppercase tracking-wider">{title}</span>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
