import type {
  NewsListResponse,
  NewsArticle,
  StatsResponse,
  ScrapeRequest,
  ScrapeStatusResponse,
  HealthResponse,
  NewsFilters,
} from '@/types/api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

// ─── Generic Helpers ───

async function apiGet<T>(endpoint: string, params: Record<string, string | number | undefined | null> = {}): Promise<T> {
  const url = new URL(`${API_BASE_URL}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url.toString(), { cache: 'no-store' });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

async function apiPost<T>(endpoint: string, body: unknown = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

async function apiDelete<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'DELETE',
    cache: 'no-store',
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

// ─── Health ───

export async function getHealth(): Promise<HealthResponse> {
  return apiGet<HealthResponse>('/api/health');
}

// ─── News ───

export async function getNews(filters: NewsFilters = {}): Promise<NewsListResponse> {
  return apiGet<NewsListResponse>('/api/news', {
    category: filters.category,
    district: filters.district,
    source: filters.source,
    start_date: filters.start_date,
    end_date: filters.end_date,
    search: filters.search,
    page: filters.page,
    limit: filters.limit,
  });
}

export async function getArticle(id: string): Promise<NewsArticle> {
  return apiGet<NewsArticle>(`/api/news/${id}`);
}

export async function deleteAllArticles(): Promise<{ deleted_count: number; message: string }> {
  return apiDelete(`/api/news/all`);
}

/** Fetch ALL articles for map display — handles pagination automatically */
export async function fetchAllMapArticles(filters: Omit<NewsFilters, 'page' | 'limit'> = {}): Promise<NewsArticle[]> {
  const limit = 100;
  let allArticles: NewsArticle[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const data = await getNews({ ...filters, page, limit });
    allArticles = allArticles.concat(data.articles);
    totalPages = data.total_pages;
    page++;
  }

  return allArticles;
}

// ─── Filters / Lookups ───

export async function getCategories(): Promise<string[]> {
  return apiGet<string[]>('/api/news/categories');
}

export async function getDistricts(): Promise<string[]> {
  return apiGet<string[]>('/api/news/districts');
}

export async function getSources(): Promise<string[]> {
  return apiGet<string[]>('/api/news/sources');
}

export async function getStats(): Promise<StatsResponse> {
  return apiGet<StatsResponse>('/api/news/stats');
}

// ─── Scraper ───

export async function startScraping(request: ScrapeRequest = {}): Promise<ScrapeStatusResponse> {
  return apiPost<ScrapeStatusResponse>('/api/scrape', {
    days: request.days ?? 3,
    sources: request.sources ?? ['all'],
  });
}

export async function getScrapeStatus(): Promise<ScrapeStatusResponse> {
  return apiGet<ScrapeStatusResponse>('/api/scrape/status');
}
