'use client';

import { useState, useEffect } from 'react';
import { Map, Activity, PanelLeft, PanelRight, PanelRightOpen } from 'lucide-react';
import { getHealth } from '@/services/api';

interface HeaderProps {
  leftOpen: boolean;
  rightOpen: boolean;
  onToggleLeft: () => void;
  onToggleRight: () => void;
  articleCount?: number;
}

export default function Header({
  leftOpen,
  rightOpen,
  onToggleLeft,
  onToggleRight,
  articleCount,
}: HeaderProps) {
  const [health, setHealth] = useState<{ status: string; database: string } | null>(null);

  useEffect(() => {
    getHealth()
      .then(h => setHealth(h))
      .catch(() => setHealth({ status: 'error', database: 'disconnected' }));
  }, []);

  const isHealthy = health?.status === 'ok';

  return (
    <header className="glass-panel border-b border-[#30363d] flex items-center justify-between px-4 py-2.5 z-50 flex-shrink-0">
      {/* Left: Logo + Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleLeft}
          className={`p-1.5 rounded-lg transition-colors ${leftOpen ? 'text-[#58a6ff] bg-[#1f6feb]/20' : 'text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d]'}`}
          aria-label={leftOpen ? 'Sol paneli kapat' : 'Sol paneli aç'}
          title={leftOpen ? 'Filtreleri kapat' : 'Filtreleri aç'}
        >
          <PanelLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#1f6feb] flex items-center justify-center">
            <Map className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-[#e6edf3] leading-none">Kocaeli Haber Haritası</h1>
            <p className="text-[10px] text-[#8b949e] mt-0.5">Yerel haberleri haritada keşfet</p>
          </div>
        </div>
      </div>

      {/* Center: Stats */}
      {articleCount !== undefined && (
        <div className="hidden md:flex items-center gap-6">
          <StatChip label="Haber" value={articleCount.toLocaleString('tr-TR')} color="text-[#58a6ff]" />
        </div>
      )}

      {/* Right: Status + toggle */}
      <div className="flex items-center gap-3">
        {/* DB Health */}
        <div className="hidden sm:flex items-center gap-1.5">
          <Activity className={`w-3.5 h-3.5 ${isHealthy ? 'text-[#10b981]' : health === null ? 'text-[#8b949e] animate-pulse' : 'text-[#ef4444]'}`} />
          <span className={`text-[10px] font-medium ${isHealthy ? 'text-[#10b981]' : health === null ? 'text-[#8b949e]' : 'text-[#ef4444]'}`}>
            {health === null ? 'Bağlanıyor...' : isHealthy ? 'Canlı' : 'Hata'}
          </span>
        </div>

        <div className="w-px h-4 bg-[#30363d]" />

        <button
          onClick={onToggleRight}
          className={`p-1.5 rounded-lg transition-colors ${rightOpen ? 'text-[#58a6ff] bg-[#1f6feb]/20' : 'text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d]'}`}
          aria-label={rightOpen ? 'Sağ paneli kapat' : 'Sağ paneli aç'}
          title={rightOpen ? 'İstatistikleri kapat' : 'İstatistikleri aç'}
        >
          {rightOpen ? <PanelRight className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
}

function StatChip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="text-center">
      <div className={`text-sm font-bold ${color}`}>{value}</div>
      <div className="text-[10px] text-[#8b949e]">{label}</div>
    </div>
  );
}
