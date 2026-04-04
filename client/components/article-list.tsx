'use client';

import { MapPin, Calendar, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import type { NewsArticle, NewsListResponse } from '@/types/api';
import { getCategoryConfig } from '@/types/api';

interface ArticleListProps {
  data: NewsListResponse | null;
  isLoading?: boolean;
  onPageChange: (page: number) => void;
  onArticleClick?: (article: NewsArticle) => void;
  selectedArticleId?: string | null;
}

export default function ArticleList({
  data,
  isLoading,
  onPageChange,
  onArticleClick,
  selectedArticleId,
}: ArticleListProps) {
  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('tr-TR', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Loading state */}
      {isLoading && (
        <div className="flex-1 p-3 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-[#1c2128] rounded-lg p-3 space-y-2 animate-pulse">
              <div className="h-3 bg-[#21262d] rounded w-1/4" />
              <div className="h-4 bg-[#21262d] rounded w-full" />
              <div className="h-4 bg-[#21262d] rounded w-3/4" />
              <div className="h-3 bg-[#21262d] rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* Articles */}
      {!isLoading && data && (
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {data.articles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <div className="text-4xl mb-3">🔍</div>
              <p className="text-sm text-[#8b949e]">Haber bulunamadı</p>
              <p className="text-xs text-[#8b949e] mt-1">Filtrelerinizi değiştirmeyi deneyin</p>
            </div>
          ) : (
            data.articles.map(article => {
              const cfg = getCategoryConfig(article.category);
              const isSelected = selectedArticleId === article.id;
              const hasPinpoint = article.latitude !== null && article.longitude !== null;

              return (
                <article
                  key={article.id}
                  className={`group rounded-lg p-3 cursor-pointer transition-all border ${
                    isSelected
                      ? 'bg-[#1f6feb]/10 border-[#1f6feb]/50 shadow-[0_0_0_1px_#1f6feb30]'
                      : 'bg-[#1c2128] border-transparent hover:border-[#30363d] hover:bg-[#21262d]'
                  }`}
                  onClick={() => onArticleClick?.(article)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && onArticleClick?.(article)}
                  aria-selected={isSelected}
                  aria-label={article.title}
                >
                  {/* Category + Location row */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: cfg.color + '25', color: cfg.color }}
                    >
                      {cfg.label}
                    </span>
                    <div className="flex items-center gap-2">
                      {hasPinpoint && (
                        <span title="Haritada göster">
                          <MapPin className="w-3 h-3 text-[#10b981]" />
                        </span>
                      )}
                      {article.location_text && (
                        <span className="text-[10px] text-[#8b949e] truncate max-w-[80px]">
                          {article.location_text}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="text-xs font-medium text-[#e6edf3] line-clamp-2 leading-relaxed mb-2 group-hover:text-white transition-colors">
                    {article.title}
                  </h3>

                  {/* Footer */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 text-[10px] text-[#8b949e]">
                      <Calendar className="w-3 h-3" />
                      {formatDate(article.published_at)}
                    </div>
                    <a
                      href={article.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[10px] text-[#58a6ff] hover:text-[#79b8ff] transition-colors"
                      onClick={e => e.stopPropagation()}
                      aria-label={`${article.source_name} - Habere git`}
                    >
                      {article.source_name}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  {/* Multiple sources badge */}
                  {article.sources.length > 1 && (
                    <div className="mt-2 text-[10px] text-[#8b949e] bg-[#21262d] rounded px-2 py-1">
                      +{article.sources.length - 1} kaynak daha
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
      )}

      {/* Pagination */}
      {!isLoading && data && data.total_pages > 1 && (
        <div className="border-t border-[#30363d] px-3 py-2">
          <div className="flex items-center justify-between">
            <button
              onClick={() => onPageChange(data.page - 1)}
              disabled={data.page <= 1}
              className="flex items-center gap-1 text-xs text-[#8b949e] hover:text-[#e6edf3] disabled:opacity-30 disabled:cursor-not-allowed transition-colors px-2 py-1 rounded hover:bg-[#21262d]"
              aria-label="Önceki sayfa"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Önceki
            </button>

            <span className="text-xs text-[#8b949e]">
              <span className="text-[#e6edf3] font-medium">{data.page}</span>
              {' / '}
              {data.total_pages}
            </span>

            <button
              onClick={() => onPageChange(data.page + 1)}
              disabled={data.page >= data.total_pages}
              className="flex items-center gap-1 text-xs text-[#8b949e] hover:text-[#e6edf3] disabled:opacity-30 disabled:cursor-not-allowed transition-colors px-2 py-1 rounded hover:bg-[#21262d]"
              aria-label="Sonraki sayfa"
            >
              Sonraki
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
