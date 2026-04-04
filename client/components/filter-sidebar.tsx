'use client';

import { useState, useEffect } from 'react';
import { Search, X, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { getCategoryConfig, CATEGORY_CONFIG } from '@/types/api';
import type { NewsFilters } from '@/types/api';

interface FilterSidebarProps {
  filters: NewsFilters;
  onChange: (filters: NewsFilters) => void;
  categories: string[];
  districts: string[];
  sources: string[];
  totalResults: number;
  isLoading?: boolean;
}

export default function FilterSidebar({
  filters,
  onChange,
  categories,
  districts,
  sources,
  totalResults,
  isLoading,
}: FilterSidebarProps) {
  const [localSearch, setLocalSearch] = useState(filters.search ?? '');
  const [expandedSections, setExpandedSections] = useState({
    category: true,
    district: true,
    source: true,
    date: false,
  });

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== filters.search) {
        onChange({ ...filters, search: localSearch || undefined, page: 1 });
      }
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localSearch]);

  const hasActiveFilters = !!(
    filters.category || filters.district || filters.source ||
    filters.start_date || filters.end_date || filters.search
  );

  const clearAll = () => {
    setLocalSearch('');
    onChange({ page: 1, limit: filters.limit });
  };

  const toggleSection = (key: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const setFilter = (key: keyof NewsFilters, value: string | undefined) => {
    onChange({ ...filters, [key]: value || undefined, page: 1 });
  };

  return (
    <aside className="glass-panel flex flex-col h-full overflow-hidden" aria-label="Filtreler">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#30363d]">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[#58a6ff]" />
          <span className="text-sm font-semibold text-[#e6edf3]">Filtreler</span>
          {hasActiveFilters && (
            <span className="text-xs bg-[#1f6feb] text-white px-2 py-0.5 rounded-full">Aktif</span>
          )}
        </div>
        {hasActiveFilters && (
          <button
            onClick={clearAll}
            className="text-xs text-[#8b949e] hover:text-[#ef4444] transition-colors flex items-center gap-1"
            aria-label="Tüm filtreleri temizle"
          >
            <X className="w-3 h-3" />
            Temizle
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Results count */}
        <div className="text-xs text-[#8b949e] text-center py-1">
          {isLoading ? (
            <span className="animate-pulse">Yükleniyor...</span>
          ) : (
            <span><strong className="text-[#58a6ff]">{totalResults}</strong> haber bulundu</span>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8b949e]" />
          <input
            type="text"
            placeholder="Haber ara..."
            value={localSearch}
            onChange={e => setLocalSearch(e.target.value)}
            className="w-full bg-[#21262d] border border-[#30363d] rounded-lg pl-9 pr-4 py-2 text-sm text-[#e6edf3] placeholder-[#8b949e] focus:outline-none focus:border-[#58a6ff] focus:ring-1 focus:ring-[#58a6ff]/30 transition-all"
          />
          {localSearch && (
            <button
              onClick={() => setLocalSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8b949e] hover:text-[#e6edf3]"
              aria-label="Aramayı temizle"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Category Filter */}
        <FilterSection
          title="Haber Türü"
          expanded={expandedSections.category}
          onToggle={() => toggleSection('category')}
        >
          <div className="flex flex-wrap gap-2">
            {categories.map(cat => {
              const cfg = getCategoryConfig(cat);
              const isSelected = filters.category === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setFilter('category', isSelected ? undefined : cat)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border"
                  style={{
                    backgroundColor: isSelected ? cfg.color : 'transparent',
                    borderColor: cfg.color,
                    color: isSelected ? cfg.textColor : cfg.color,
                  }}
                  aria-pressed={isSelected}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: cfg.color, opacity: isSelected ? 0 : 1 }}
                  />
                  {cfg.label}
                </button>
              );
            })}
          </div>
        </FilterSection>

        {/* District Filter */}
        <FilterSection
          title="İlçe / Konum"
          expanded={expandedSections.district}
          onToggle={() => toggleSection('district')}
        >
          <select
            value={filters.district ?? ''}
            onChange={e => setFilter('district', e.target.value)}
            className="w-full bg-[#21262d] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-[#e6edf3] focus:outline-none focus:border-[#58a6ff] transition-all"
            aria-label="İlçe seç"
          >
            <option value="">Tüm İlçeler</option>
            {districts.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </FilterSection>

        {/* Source Filter */}
        <FilterSection
          title="Haber Kaynağı"
          expanded={expandedSections.source}
          onToggle={() => toggleSection('source')}
        >
          <div className="space-y-1.5">
            {sources.map(source => {
              const isSelected = filters.source === source;
              return (
                <button
                  key={source}
                  onClick={() => setFilter('source', isSelected ? undefined : source)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all border ${
                    isSelected
                      ? 'bg-[#1f6feb]/20 border-[#1f6feb] text-[#58a6ff]'
                      : 'border-transparent text-[#8b949e] hover:bg-[#21262d] hover:text-[#e6edf3]'
                  }`}
                  aria-pressed={isSelected}
                >
                  {source}
                </button>
              );
            })}
          </div>
        </FilterSection>

        {/* Date Filter */}
        <FilterSection
          title="Tarih Aralığı"
          expanded={expandedSections.date}
          onToggle={() => toggleSection('date')}
        >
          <div className="space-y-2">
            <div>
              <label className="text-xs text-[#8b949e] mb-1 block">Başlangıç</label>
              <input
                type="date"
                value={filters.start_date ?? ''}
                onChange={e => setFilter('start_date', e.target.value)}
                className="w-full bg-[#21262d] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-[#e6edf3] focus:outline-none focus:border-[#58a6ff] transition-all"
              />
            </div>
            <div>
              <label className="text-xs text-[#8b949e] mb-1 block">Bitiş</label>
              <input
                type="date"
                value={filters.end_date ?? ''}
                onChange={e => setFilter('end_date', e.target.value)}
                className="w-full bg-[#21262d] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-[#e6edf3] focus:outline-none focus:border-[#58a6ff] transition-all"
              />
            </div>
          </div>
        </FilterSection>
      </div>
    </aside>
  );
}

function FilterSection({
  title,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-[#30363d] rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-[#1c2128] hover:bg-[#21262d] transition-colors"
        aria-expanded={expanded}
      >
        <span className="text-xs font-semibold text-[#e6edf3] uppercase tracking-wider">{title}</span>
        {expanded ? (
          <ChevronUp className="w-3.5 h-3.5 text-[#8b949e]" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-[#8b949e]" />
        )}
      </button>
      {expanded && (
        <div className="p-3 bg-[#161b22]">
          {children}
        </div>
      )}
    </div>
  );
}
