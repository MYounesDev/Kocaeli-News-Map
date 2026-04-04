// ─── API Response Types ───

export interface NewsSource {
  name: string;
  url: string;
}

export interface NewsArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  location_text: string | null;
  latitude: number | null;
  longitude: number | null;
  published_at: string;
  source_name: string;
  source_url: string;
  sources: NewsSource[];
  created_at: string | null;
}

export interface NewsListResponse {
  articles: NewsArticle[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface StatsResponse {
  total_articles: number;
  by_category: Record<string, number>;
  by_source: Record<string, number>;
  by_district: Record<string, number>;
}

export interface ScrapeRequest {
  days?: number;
  sources?: string[];
}

export interface ScrapeStatusResponse {
  is_running: boolean;
  message: string;
  articles_scraped: number;
  articles_saved: number;
  errors: string[];
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  database: string;
}

// ─── Filter Parameters ───

export interface NewsFilters {
  category?: string;
  district?: string;
  source?: string;
  start_date?: string;
  end_date?: string;
  search?: string;
  page?: number;
  limit?: number;
}

// ─── Category Config ───

export interface CategoryConfig {
  label: string;
  color: string;
  textColor: string;
}

export const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  guncel:    { label: 'Güncel',    color: '#ef4444', textColor: '#fff' },
  polis:     { label: 'Polis',     color: '#3b82f6', textColor: '#fff' },
  siyaset:   { label: 'Siyaset',   color: '#8b5cf6', textColor: '#fff' },
  egitim:    { label: 'Eğitim',    color: '#f59e0b', textColor: '#000' },
  ekonomi:   { label: 'Ekonomi',   color: '#10b981', textColor: '#fff' },
  yasam:     { label: 'Yaşam',     color: '#ec4899', textColor: '#fff' },
  saglik:    { label: 'Sağlık',    color: '#06b6d4', textColor: '#fff' },
  teknoloji: { label: 'Teknoloji', color: '#6366f1', textColor: '#fff' },
  spor:      { label: 'Spor',      color: '#f97316', textColor: '#fff' },
};

export const DEFAULT_CATEGORY_COLOR = '#6b7280';

export function getCategoryConfig(category: string): CategoryConfig {
  return CATEGORY_CONFIG[category] ?? { label: category.charAt(0).toUpperCase() + category.slice(1), color: DEFAULT_CATEGORY_COLOR, textColor: '#fff' };
}

export const KOCAELI_CENTER = { lat: 40.7654, lng: 29.9408 };
export const DEFAULT_ZOOM = 10;
