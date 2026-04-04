'use client';

import { useState, useEffect, useCallback } from 'react';
import { Play, Square, RefreshCw, ChevronDown, ChevronUp, AlertCircle, CheckCircle } from 'lucide-react';
import { startScraping, getScrapeStatus } from '@/services/api';
import type { ScrapeStatusResponse } from '@/types/api';

const SOURCE_OPTIONS = [
  { key: 'all', label: 'Tümü' },
  { key: 'cagdaskocaeli', label: 'Çağdaş Kocaeli' },
  { key: 'ozgurkocaeli', label: 'Özgür Kocaeli' },
  { key: 'seskocaeli', label: 'Ses Kocaeli' },
  { key: 'bizimyaka', label: 'Bizim Yaka' },
  { key: 'yenikocaeli', label: 'Yeni Kocaeli' },
];

interface ScraperPanelProps {
  onComplete?: () => void;
}

export default function ScraperPanel({ onComplete }: ScraperPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [days, setDays] = useState(3);
  const [selectedSources, setSelectedSources] = useState<string[]>(['all']);
  const [status, setStatus] = useState<ScrapeStatusResponse | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pollStatus = useCallback(async () => {
    try {
      const s = await getScrapeStatus();
      setStatus(s);
      if (!s.is_running && s.articles_saved > 0) {
        onComplete?.();
      }
      return s.is_running;
    } catch {
      return false;
    }
  }, [onComplete]);

  // Poll while running
  useEffect(() => {
    if (!status?.is_running) return;
    const interval = setInterval(async () => {
      const running = await pollStatus();
      if (!running) clearInterval(interval);
    }, 2500);
    return () => clearInterval(interval);
  }, [status?.is_running, pollStatus]);

  // Initial status check
  useEffect(() => {
    pollStatus();
  }, [pollStatus]);

  const handleStart = async () => {
    setIsStarting(true);
    setError(null);
    try {
      const sources = selectedSources.includes('all') ? ['all'] : selectedSources;
      const result = await startScraping({ days, sources });
      setStatus(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scraping başlatılamadı');
    } finally {
      setIsStarting(false);
    }
  };

  const toggleSource = (key: string) => {
    if (key === 'all') {
      setSelectedSources(['all']);
      return;
    }
    setSelectedSources(prev => {
      const withoutAll = prev.filter(s => s !== 'all');
      if (withoutAll.includes(key)) {
        const next = withoutAll.filter(s => s !== key);
        return next.length === 0 ? ['all'] : next;
      }
      return [...withoutAll, key];
    });
  };

  const progress = status?.articles_scraped
    ? Math.min(100, Math.round((status.articles_saved / Math.max(status.articles_scraped, 1)) * 100))
    : 0;

  return (
    <div className="glass-panel rounded-xl overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={() => setIsExpanded(p => !p)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#1c2128] transition-colors"
        aria-expanded={isExpanded}
        aria-controls="scraper-panel-content"
      >
        <div className="flex items-center gap-2">
          <RefreshCw className={`w-4 h-4 text-[#58a6ff] ${status?.is_running ? 'animate-spin' : ''}`} />
          <span className="text-sm font-semibold text-[#e6edf3]">Haber Topla</span>
          {status?.is_running && (
            <span className="text-xs bg-[#f97316]/20 text-[#f97316] border border-[#f97316]/30 px-2 py-0.5 rounded-full">
              Çalışıyor
            </span>
          )}
          {!status?.is_running && status?.articles_saved > 0 && status?.message !== 'Idle' && (
            <span className="text-xs bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/30 px-2 py-0.5 rounded-full">
              Tamamlandı
            </span>
          )}
        </div>
        {isExpanded ? <ChevronUp className="w-4 h-4 text-[#8b949e]" /> : <ChevronDown className="w-4 h-4 text-[#8b949e]" />}
      </button>

      {/* Status bar (always visible when running) */}
      {status?.is_running && (
        <div className="px-4 pb-2">
          <div className="flex justify-between text-xs text-[#8b949e] mb-1">
            <span className="truncate max-w-[200px]">{status.message}</span>
            <span className="text-[#58a6ff] font-mono ml-2 flex-shrink-0">
              {status.articles_saved}/{status.articles_scraped}
            </span>
          </div>
          <div className="h-1.5 bg-[#21262d] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#58a6ff] rounded-full transition-all duration-500 animate-pulse"
              style={{ width: status.articles_scraped > 0 ? `${progress}%` : '30%' }}
            />
          </div>
        </div>
      )}

      {/* Expanded content */}
      {isExpanded && (
        <div id="scraper-panel-content" className="border-t border-[#30363d] p-4 space-y-4">
          {/* Status card */}
          {status && !status.is_running && status.message !== 'Idle' && (
            <div className={`rounded-lg p-3 flex items-start gap-2 text-xs ${
              status.errors.length > 0
                ? 'bg-[#f85149]/10 border border-[#f85149]/30 text-[#f85149]'
                : 'bg-[#10b981]/10 border border-[#10b981]/30 text-[#10b981]'
            }`}>
              {status.errors.length > 0 ? (
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              ) : (
                <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              )}
              <span className="leading-relaxed">{status.message}</span>
            </div>
          )}

          {error && (
            <div className="rounded-lg p-3 bg-[#f85149]/10 border border-[#f85149]/30 text-[#f85149] text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {/* Days selector */}
          <div>
            <label className="text-xs font-medium text-[#8b949e] uppercase tracking-wider mb-2 block">
              Kaç gün geriye gidin?
            </label>
            <div className="flex gap-2">
              {[1, 3, 7, 14, 30].map(d => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                    days === d
                      ? 'bg-[#1f6feb] border-[#1f6feb] text-white'
                      : 'border-[#30363d] text-[#8b949e] hover:border-[#58a6ff] hover:text-[#e6edf3] bg-transparent'
                  }`}
                  aria-pressed={days === d}
                >
                  {d}g
                </button>
              ))}
            </div>
          </div>

          {/* Source selector */}
          <div>
            <label className="text-xs font-medium text-[#8b949e] uppercase tracking-wider mb-2 block">
              Kaynaklar
            </label>
            <div className="flex flex-wrap gap-1.5">
              {SOURCE_OPTIONS.map(src => {
                const isSelected = selectedSources.includes(src.key);
                return (
                  <button
                    key={src.key}
                    onClick={() => toggleSource(src.key)}
                    className={`px-2.5 py-1 rounded-lg text-xs transition-all border ${
                      isSelected
                        ? 'bg-[#1f6feb]/20 border-[#1f6feb] text-[#58a6ff]'
                        : 'border-[#30363d] text-[#8b949e] hover:border-[#30363d] hover:text-[#e6edf3] bg-transparent'
                    }`}
                    aria-pressed={isSelected}
                  >
                    {src.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action button */}
          <button
            onClick={handleStart}
            disabled={isStarting || status?.is_running}
            className={`w-full py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
              status?.is_running
                ? 'bg-[#f97316]/20 border border-[#f97316]/30 text-[#f97316] cursor-wait'
                : 'bg-[#1f6feb] hover:bg-[#388bfd] text-white disabled:opacity-50 disabled:cursor-not-allowed'
            }`}
          >
            {status?.is_running ? (
              <>
                <Square className="w-4 h-4 animate-pulse" />
                Çalışıyor...
              </>
            ) : isStarting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Başlatılıyor...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Haberleri Topla
              </>
            )}
          </button>

          {/* Note */}
          <p className="text-[10px] text-[#8b949e] leading-relaxed">
            Not: Vercel serverless ortamında toplama işlemi kısmen çalışabilir. Tam çalışma için yerel ortam önerilir.
          </p>
        </div>
      )}
    </div>
  );
}
