'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import Header from '@/components/header';
import FilterSidebar from '@/components/filter-sidebar';
import StatsPanel from '@/components/stats-panel';
import ArticleList from '@/components/article-list';
import ScraperPanel from '@/components/scraper-panel';
import CategoryLegend from '@/components/category-legend';
import { getNews, getCategories, getDistricts, getSources, getStats, fetchAllMapArticles } from '@/services/api';
import type { NewsArticle, NewsListResponse, StatsResponse, NewsFilters } from '@/types/api';
import { ListFilter, Layers } from 'lucide-react';

// Dynamically import the map (no SSR) so window.google is available
const NewsMap = dynamic(() => import('@/components/news-map'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#0d1117]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-[#1f6feb] border-t-transparent rounded-full animate-spin" />
        <p className="text-[#8b949e] text-sm">Harita yükleniyor...</p>
      </div>
    </div>
  ),
});

type RightTab = 'list' | 'stats';

export default function HomePage() {
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [rightTab, setRightTab] = useState<RightTab>('list');

  // Filter state
  const [filters, setFilters] = useState<NewsFilters>({ page: 1, limit: 20 });

  // API data
  const [listData, setListData] = useState<NewsListResponse | null>(null);
  const [mapArticles, setMapArticles] = useState<NewsArticle[]>([]);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [sources, setSources] = useState<string[]>([]);

  // Loading states
  const [listLoading, setListLoading] = useState(true);
  const [mapLoading, setMapLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);

  // Selected article for map sync
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);

  // Fetch filter options once
  useEffect(() => {
    Promise.all([getCategories(), getDistricts(), getSources()])
      .then(([cats, dists, srcs]) => {
        setCategories(cats);
        setDistricts(dists);
        setSources(srcs);
      })
      .catch(console.error);
  }, []);

  // Fetch stats once (and after scraper completes)
  const fetchStats = useCallback(() => {
    setStatsLoading(true);
    getStats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setStatsLoading(false));
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Fetch paginated list when filters change
  useEffect(() => {
    setListLoading(true);
    getNews(filters)
      .then(data => setListData(data))
      .catch(console.error)
      .finally(() => setListLoading(false));
  }, [filters]);

  // Fetch all map articles when filters (minus pagination) change
  const mapFilterRef = useRef<string>('');
  useEffect(() => {
    const { page: _p, limit: _l, ...mapFilters } = filters;
    const key = JSON.stringify(mapFilters);
    if (key === mapFilterRef.current) return;
    mapFilterRef.current = key;

    setMapLoading(true);
    fetchAllMapArticles(mapFilters)
      .then(articles => setMapArticles(articles))
      .catch(console.error)
      .finally(() => setMapLoading(false));
  }, [filters]);

  const handleFiltersChange = (newFilters: NewsFilters) => {
    setFilters(newFilters);
    setSelectedArticleId(null);
  };

  const handlePageChange = (page: number) => {
    setFilters(prev => ({ ...prev, page }));
  };

  const handleArticleClick = (article: NewsArticle) => {
    setSelectedArticleId(article.id);
    if (article.latitude && article.longitude) {
      // Map will react via prop
    }
  };

  const handleMarkerClick = (article: NewsArticle) => {
    setSelectedArticleId(article.id);
    setRightTab('list');
    setRightOpen(true);
  };

  const handleScraperComplete = () => {
    // Refresh all data after scraping
    fetchStats();
    getNews(filters).then(setListData).catch(console.error);
    Promise.all([getCategories(), getDistricts(), getSources()]).then(([c, d, s]) => {
      setCategories(c); setDistricts(d); setSources(s);
    });
    const { page: _p, limit: _l, ...mf } = filters;
    fetchAllMapArticles(mf).then(setMapArticles).catch(console.error);
  };

  const mappableCount = mapArticles.filter(a => a.latitude !== null && a.longitude !== null).length;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#0d1117]">
      {/* Header */}
      <Header
        leftOpen={leftOpen}
        rightOpen={rightOpen}
        onToggleLeft={() => setLeftOpen(p => !p)}
        onToggleRight={() => setRightOpen(p => !p)}
        articleCount={listData?.total}
      />

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Sidebar — Filters */}
        <aside
          className={`flex-shrink-0 z-30 transition-all duration-300 ease-in-out overflow-hidden ${
            leftOpen ? 'w-72' : 'w-0'
          }`}
          aria-hidden={!leftOpen}
        >
          <div className="w-72 h-full">
            <div className="h-full flex flex-col gap-3 p-3">
              <div className="flex-1 rounded-xl overflow-hidden">
                <FilterSidebar
                  filters={filters}
                  onChange={handleFiltersChange}
                  categories={categories}
                  districts={districts}
                  sources={sources}
                  totalResults={listData?.total ?? 0}
                  isLoading={listLoading}
                />
              </div>
              <ScraperPanel onComplete={handleScraperComplete} />
            </div>
          </div>
        </aside>

        {/* Map */}
        <main className="flex-1 relative overflow-hidden" aria-label="Haber haritası">
          <NewsMap
            articles={mapArticles}
            onMarkerClick={handleMarkerClick}
            selectedArticleId={selectedArticleId}
          />

          {/* Map overlay: loading */}
          {mapLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0d1117]/60 backdrop-blur-sm z-10">
              <div className="glass-panel rounded-xl px-6 py-4 flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-[#58a6ff] border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-[#e6edf3]">Harita güncelleniyor...</span>
              </div>
            </div>
          )}

          {/* Bottom overlay: Legend + marker count */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2">
            <CategoryLegend />
            <div className="glass-panel rounded-full px-4 py-1.5 text-xs text-[#8b949e] text-center">
              <span className="text-[#10b981] font-semibold">{mappableCount}</span> haber haritada gösteriliyor
            </div>
          </div>

          {/* Mobile right-panel toggle */}
          <button
            onClick={() => setRightOpen(p => !p)}
            className="absolute top-4 right-4 z-20 glass-panel rounded-lg p-2.5 md:hidden"
            aria-label="Haber listesini aç"
          >
            <Layers className="w-5 h-5 text-[#58a6ff]" />
          </button>
        </main>

        {/* Right Sidebar — List + Stats */}
        <aside
          className={`flex-shrink-0 z-30 transition-all duration-300 ease-in-out overflow-hidden ${
            rightOpen ? 'w-80' : 'w-0'
          }`}
          aria-hidden={!rightOpen}
        >
          <div className="w-80 h-full">
            <div className="h-full flex flex-col p-3 gap-0">
              {/* Tab switcher */}
              <div className="glass-panel rounded-t-xl border-b-0 px-3 pt-3 pb-0 flex-shrink-0">
                <div className="flex rounded-lg bg-[#21262d] p-1 gap-1">
                  <TabButton
                    active={rightTab === 'list'}
                    onClick={() => setRightTab('list')}
                    icon={<ListFilter className="w-3.5 h-3.5" />}
                    label="Haberler"
                    count={listData?.total}
                  />
                  <TabButton
                    active={rightTab === 'stats'}
                    onClick={() => setRightTab('stats')}
                    icon={<Layers className="w-3.5 h-3.5" />}
                    label="İstatistik"
                  />
                </div>
                <div className="h-3" />
              </div>

              {/* Panel content */}
              <div className="flex-1 glass-panel rounded-b-xl overflow-hidden border-t-0">
                {rightTab === 'list' ? (
                  <ArticleList
                    data={listData}
                    isLoading={listLoading}
                    onPageChange={handlePageChange}
                    onArticleClick={handleArticleClick}
                    selectedArticleId={selectedArticleId}
                  />
                ) : (
                  <StatsPanel stats={stats} isLoading={statsLoading} />
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all ${
        active
          ? 'bg-[#1f6feb] text-white shadow-sm'
          : 'text-[#8b949e] hover:text-[#e6edf3]'
      }`}
      aria-selected={active}
      role="tab"
    >
      {icon}
      {label}
      {count !== undefined && count > 0 && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20' : 'bg-[#21262d] text-[#8b949e]'}`}>
          {count > 999 ? `${Math.floor(count / 1000)}k` : count}
        </span>
      )}
    </button>
  );
}
