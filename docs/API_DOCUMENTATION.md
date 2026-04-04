# Kocaeli News Map — Backend API Documentation

> **Base URL (Production):** `https://kocaeli-news-map.vercel.app`
> **Framework:** Python FastAPI, deployed on Vercel (serverless)
> **Database:** MongoDB Atlas (async via Motor)
> **CORS:** All origins allowed (`*`)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture Overview](#2-architecture-overview)
3. [Data Model](#3-data-model)
4. [API Endpoints Reference](#4-api-endpoints-reference)
   - [Health Endpoints](#41-health-endpoints)
   - [News CRUD Endpoints](#42-news-crud-endpoints)
   - [Filter/Lookup Endpoints](#43-filterlookup-endpoints)
   - [Statistics Endpoint](#44-statistics-endpoint)
   - [Scraper Endpoints](#45-scraper-endpoints)
5. [Filtering & Pagination Deep Dive](#5-filtering--pagination-deep-dive)
6. [Frontend Integration Guide](#6-frontend-integration-guide)
7. [Google Maps Integration Notes](#7-google-maps-integration-notes)
8. [Error Handling](#8-error-handling)
9. [Available News Categories](#9-available-news-categories)
10. [Available News Sources](#10-available-news-sources)

---

## 1. Project Overview

This API serves the **Kocaeli Local News Map** project — a system that:

1. **Scrapes** local news from 5 Kocaeli news websites automatically
2. **Preprocesses** the text (HTML cleanup, normalization, boilerplate removal)
3. **Classifies** each article into a news category (e.g., `guncel`, `spor`, `ekonomi`)
4. **Extracts locations** from article text (district/neighborhood names in Kocaeli)
5. **Geocodes** extracted locations to latitude/longitude coordinates using Google Geocoding API
6. **Detects duplicates** across sources using sentence-transformer embeddings (≥90% similarity = same article)
7. **Stores** everything in MongoDB
8. **Serves** the data via this REST API for a frontend that visualizes news on **Google Maps**

### What the Frontend Must Do

- Display a **Google Map** centered on Kocaeli (approx. `40.7654, 29.9408`)
- Place **markers** on the map for each news article that has coordinates (`latitude` / `longitude`)
- Use **different marker colors/icons** based on the article's `category`
- Show an **info window** when a marker is clicked (title, date, source, link to original article)
- Provide **filter controls** for: category, district, date range, source, and text search
- Apply filters **dynamically** without full page reload
- Show **statistics** (total articles, breakdown by category/source/district)
- Allow the user to **trigger scraping** and monitor its progress

---

## 2. Architecture Overview

```
Frontend (Next.js)
    │
    ▼ HTTP (JSON)
┌─────────────────────────────────────────────────┐
│  FastAPI Backend (Vercel Serverless)             │
│                                                  │
│  GET  /                    → Health check        │
│  GET  /api/health          → DB health check     │
│                                                  │
│  GET  /api/news            → List articles       │
│  GET  /api/news/{id}       → Single article      │
│  GET  /api/news/categories → Distinct categories │
│  GET  /api/news/districts  → Distinct districts  │
│  GET  /api/news/sources    → Distinct sources    │
│  GET  /api/news/stats      → Aggregated stats    │
│  DELETE /api/news/all      → Delete all articles │
│                                                  │
│  POST /api/scrape          → Trigger scraping    │
│  GET  /api/scrape/status   → Scraping status     │
└─────────────────────────────────────────────────┘
    │
    ▼
  MongoDB Atlas (kocaeli_news database, "news" collection)
```

---

## 3. Data Model

### 3.1 News Article (as returned by the API)

Every article returned by the API follows this exact schema:

```typescript
interface NewsArticle {
  id: string;                    // MongoDB ObjectId as string (e.g., "660e1a2b3f...")
  title: string;                 // Article headline
  content: string;               // Cleaned article body text (no HTML, no boilerplate)
  category: string;              // News category (e.g., "guncel", "spor", "ekonomi")
  location_text: string | null;  // Extracted location name (e.g., "Gebze", "İzmit, Kocaeli") — null if no location found
  latitude: number | null;       // Geocoded latitude — null if geocoding failed or no location
  longitude: number | null;      // Geocoded longitude — null if geocoding failed or no location
  published_at: string;          // ISO 8601 datetime string (e.g., "2026-04-01T21:46:00")
  source_name: string;           // Name of the news source (e.g., "Çağdaş Kocaeli")
  source_url: string;            // Direct URL to the original article on the source website
  sources: NewsSource[];         // Array of ALL sources that reported this same news (for duplicates merged together)
  created_at: string | null;     // ISO 8601 datetime when the article was saved to our database
}

interface NewsSource {
  name: string;  // Source display name (e.g., "Çağdaş Kocaeli")
  url: string;   // Direct link to the article on that source
}
```

### 3.2 Key Data Rules

| Field | Notes |
|---|---|
| `id` | Always a 24-character hex string (MongoDB ObjectId) |
| `latitude` / `longitude` | **Both are `null`** if the article has no mappable location. **Only show markers for articles where both are non-null** |
| `sources` | When the same event is reported by multiple news sites, they are merged into one article. The `sources` array contains ALL of them. `source_name` and `source_url` hold the primary (first) source. |
| `category` | Always lowercase Turkish — e.g., `"guncel"`, `"polis"`, `"siyaset"` (no special chars like ğ, ş in category keys) |
| `content` | Pre-cleaned text. No HTML tags. May be long (full article body) |
| `published_at` | UTC datetime in ISO 8601 format |

---

## 4. API Endpoints Reference

### 4.1 Health Endpoints

#### `GET /`

Simple health check. Use this to verify the API is reachable.

**Request:**
```
GET https://kocaeli-news-map.vercel.app/
```

**Response (`200 OK`):**
```json
{
  "status": "ok",
  "service": "Kocaeli News Map API",
  "version": "1.0.0"
}
```

---

#### `GET /api/health`

Detailed health check including database connectivity status.

**Request:**
```
GET https://kocaeli-news-map.vercel.app/api/health
```

**Response (`200 OK`):**
```json
{
  "status": "ok",
  "database": "connected"
}
```

If the database is down:
```json
{
  "status": "degraded",
  "database": "error: <error message>"
}
```

---

### 4.2 News CRUD Endpoints

#### `GET /api/news` — List Articles (with filters & pagination)

This is the **primary endpoint** the frontend will use most. It returns a paginated, filtered list of articles sorted by `published_at` descending (newest first).

**Request:**
```
GET https://kocaeli-news-map.vercel.app/api/news
```

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `category` | `string` | No | — | Filter by exact category name (e.g., `guncel`, `spor`) |
| `district` | `string` | No | — | Filter by location text (case-insensitive regex match, e.g., `Gebze`) |
| `source` | `string` | No | — | Filter by exact source name (e.g., `Çağdaş Kocaeli`) |
| `start_date` | `string` | No | — | Start of date range, format `YYYY-MM-DD` (e.g., `2026-04-01`) |
| `end_date` | `string` | No | — | End of date range, format `YYYY-MM-DD` (e.g., `2026-04-03`) |
| `search` | `string` | No | — | Free-text search in title AND content (case-insensitive regex) |
| `page` | `integer` | No | `1` | Page number (starts at 1) |
| `limit` | `integer` | No | `20` | Items per page (min: 1, max: 100) |

**All filters can be combined.** For example, to get page 2 of sports news in Gebze from April 2026:

```
GET /api/news?category=spor&district=Gebze&start_date=2026-04-01&end_date=2026-04-30&page=2&limit=10
```

**Response (`200 OK`):**

```typescript
interface NewsListResponse {
  articles: NewsArticle[];  // Array of articles for the current page
  total: number;            // Total number of articles matching the filters
  page: number;             // Current page number
  limit: number;            // Items per page
  total_pages: number;      // Total number of pages (ceil(total / limit))
}
```

**Example Response:**
```json
{
  "articles": [
    {
      "id": "660e1a2b3f4a5b6c7d8e9f00",
      "title": "Gebze'de trafik kazası: 3 yaralı",
      "content": "Gebze ilçesinde meydana gelen trafik kazasında 3 kişi yaralandı. Kaza, D-100 karayolu üzerinde...",
      "category": "guncel",
      "location_text": "Gebze",
      "latitude": 40.8027,
      "longitude": 29.4307,
      "published_at": "2026-04-03T14:30:00",
      "source_name": "Çağdaş Kocaeli",
      "source_url": "https://www.cagdaskocaeli.com.tr/haber/12345/gebzede-trafik-kazasi",
      "sources": [
        {
          "name": "Çağdaş Kocaeli",
          "url": "https://www.cagdaskocaeli.com.tr/haber/12345/gebzede-trafik-kazasi"
        },
        {
          "name": "Özgür Kocaeli",
          "url": "https://www.ozgurkocaeli.com.tr/haber/67890/gebzede-kaza"
        }
      ],
      "created_at": "2026-04-03T15:00:00"
    }
  ],
  "total": 47,
  "page": 1,
  "limit": 20,
  "total_pages": 3
}
```

**Empty Result:**
```json
{
  "articles": [],
  "total": 0,
  "page": 1,
  "limit": 20,
  "total_pages": 1
}
```

---

#### `GET /api/news/{article_id}` — Get Single Article

Retrieve a single article by its MongoDB ObjectId.

**Request:**
```
GET https://kocaeli-news-map.vercel.app/api/news/660e1a2b3f4a5b6c7d8e9f00
```

**Response (`200 OK`):**
```json
{
  "id": "660e1a2b3f4a5b6c7d8e9f00",
  "title": "Gebze'de trafik kazası: 3 yaralı",
  "content": "Gebze ilçesinde meydana gelen...",
  "category": "guncel",
  "location_text": "Gebze",
  "latitude": 40.8027,
  "longitude": 29.4307,
  "published_at": "2026-04-03T14:30:00",
  "source_name": "Çağdaş Kocaeli",
  "source_url": "https://www.cagdaskocaeli.com.tr/haber/12345/gebzede-trafik-kazasi",
  "sources": [
    { "name": "Çağdaş Kocaeli", "url": "https://www.cagdaskocaeli.com.tr/haber/12345/gebzede-trafik-kazasi" }
  ],
  "created_at": "2026-04-03T15:00:00"
}
```

**Error Responses:**

- `400 Bad Request` — Invalid article ID format
  ```json
  { "detail": "Invalid article ID format" }
  ```
- `404 Not Found` — Article does not exist
  ```json
  { "detail": "Article not found" }
  ```

---

#### `DELETE /api/news/all` — Delete All Articles

⚠️ **Destructive operation.** Removes ALL articles from the database. Intended for admin use (re-scraping with clean data).

**Request:**
```
DELETE https://kocaeli-news-map.vercel.app/api/news/all
```

**Response (`200 OK`):**
```json
{
  "deleted_count": 142,
  "message": "Successfully deleted 142 articles."
}
```

---

### 4.3 Filter/Lookup Endpoints

These endpoints provide the **distinct values** currently in the database. Use them to **populate filter dropdowns** in the frontend UI.

#### `GET /api/news/categories` — Get All Categories

Returns all distinct `category` values from stored articles, sorted alphabetically.

**Request:**
```
GET https://kocaeli-news-map.vercel.app/api/news/categories
```

**Response (`200 OK`):**
```json
["ekonomi", "egitim", "guncel", "polis", "saglik", "siyaset", "spor", "teknoloji", "yasam"]
```

**Type:** `string[]`

> **Frontend usage:** Populate the category filter dropdown with these values. Display with the first letter capitalized (e.g., `"guncel"` → `"Güncel"`). See [Section 9](#9-available-news-categories) for the display name mapping.

---

#### `GET /api/news/districts` — Get All Districts

Returns all distinct `location_text` values (districts/neighborhoods), sorted alphabetically. Null values are excluded.

**Request:**
```
GET https://kocaeli-news-map.vercel.app/api/news/districts
```

**Response (`200 OK`):**
```json
["Başiskele", "Çayırova", "Darıca", "Derince", "Dilovası", "Gebze", "Gölcük", "İzmit", "Kandıra", "Karamürsel", "Kartepe", "Kocaeli", "Körfez"]
```

**Type:** `string[]`

> **Frontend usage:** Populate the district/location filter dropdown. These are Turkish location names and should be displayed as-is.

---

#### `GET /api/news/sources` — Get All Sources

Returns all distinct `source_name` values, sorted alphabetically.

**Request:**
```
GET https://kocaeli-news-map.vercel.app/api/news/sources
```

**Response (`200 OK`):**
```json
["Bizim Yaka", "Çağdaş Kocaeli", "Özgür Kocaeli", "Ses Kocaeli", "Yeni Kocaeli"]
```

**Type:** `string[]`

> **Frontend usage:** Populate the source filter dropdown. These are the 5 scraped news websites.

---

### 4.4 Statistics Endpoint

#### `GET /api/news/stats` — Get Aggregated Statistics

Returns aggregate counts grouped by category, source, and district. Useful for dashboard/sidebar widgets.

**Request:**
```
GET https://kocaeli-news-map.vercel.app/api/news/stats
```

**Response (`200 OK`):**

```typescript
interface StatsResponse {
  total_articles: number;            // Total number of articles in the database
  by_category: Record<string, number>; // Article count per category
  by_source: Record<string, number>;   // Article count per source
  by_district: Record<string, number>; // Article count per district/location
}
```

**Example Response:**
```json
{
  "total_articles": 342,
  "by_category": {
    "guncel": 120,
    "polis": 45,
    "spor": 38,
    "ekonomi": 35,
    "siyaset": 30,
    "yasam": 28,
    "egitim": 20,
    "saglik": 15,
    "teknoloji": 11
  },
  "by_source": {
    "Çağdaş Kocaeli": 95,
    "Özgür Kocaeli": 82,
    "Ses Kocaeli": 70,
    "Yeni Kocaeli": 55,
    "Bizim Yaka": 40
  },
  "by_district": {
    "İzmit": 85,
    "Gebze": 62,
    "Darıca": 30,
    "Gölcük": 25,
    "Körfez": 20,
    "Derince": 18,
    "Kartepe": 15,
    "Çayırova": 12,
    "Kandıra": 10,
    "Dilovası": 8,
    "Karamürsel": 7,
    "Başiskele": 5
  }
}
```

> **Frontend usage:** Display these stats in a sidebar or dashboard panel. Can be used to show charts/badges. The `by_category` object keys match the values returned by `/api/news/categories`.

---

### 4.5 Scraper Endpoints

These endpoints let the frontend trigger and monitor the news scraping pipeline.

> ⚠️ **IMPORTANT:** On Vercel serverless, background tasks are terminated once the HTTP response is sent. Scraping should ideally be triggered from a local machine or a long-running server. The API will accept the request but may not complete the full scraping process on Vercel. The read endpoints (GET) work perfectly on Vercel.

#### `POST /api/scrape` — Trigger Scraping

Starts the scraping pipeline as a background task.

**Request:**
```
POST https://kocaeli-news-map.vercel.app/api/scrape
Content-Type: application/json

{
  "days": 3,
  "sources": ["all"]
}
```

**Request Body:**

```typescript
interface ScrapeRequest {
  days?: number;       // Number of days to scrape (1–30, default: 3)
  sources?: string[];  // Source names or ["all"] (default: ["all"])
}
```

**Valid source names for the `sources` array:**

| Key | News Source |
|---|---|
| `"cagdaskocaeli"` | Çağdaş Kocaeli |
| `"ozgurkocaeli"` | Özgür Kocaeli |
| `"seskocaeli"` | Ses Kocaeli |
| `"bizimyaka"` | Bizim Yaka |
| `"yenikocaeli"` | Yeni Kocaeli |
| `"all"` | All of the above |

**Example — scrape last 5 days from 2 specific sources:**
```json
{
  "days": 5,
  "sources": ["cagdaskocaeli", "yenikocaeli"]
}
```

**Response (`200 OK`):**
```json
{
  "is_running": true,
  "message": "Scraping started for 3 days from ['all']",
  "articles_scraped": 0,
  "articles_saved": 0,
  "errors": []
}
```

**If scraping is already in progress:**
```json
{
  "is_running": true,
  "message": "Scraping is already in progress. Please wait.",
  "articles_scraped": 45,
  "articles_saved": 12,
  "errors": []
}
```

---

#### `GET /api/scrape/status` — Check Scraping Status

Poll this endpoint to monitor scraping progress. Useful for showing a progress indicator in the frontend.

**Request:**
```
GET https://kocaeli-news-map.vercel.app/api/scrape/status
```

**Response (`200 OK`):**

```typescript
interface ScrapeStatusResponse {
  is_running: boolean;        // true if scraping is currently in progress
  message: string;            // Human-readable status message
  articles_scraped: number;   // Total articles scraped from all sources
  articles_saved: number;     // Articles saved (after dedup and processing)
  errors: string[];           // List of error messages (if any)
}
```

**Example — scraping in progress:**
```json
{
  "is_running": true,
  "message": "Processing articles... (45/120)",
  "articles_scraped": 120,
  "articles_saved": 32,
  "errors": []
}
```

**Example — scraping completed:**
```json
{
  "is_running": false,
  "message": "Completed! Scraped 120, saved 85 new articles (35 skipped as already scraped).",
  "articles_scraped": 120,
  "articles_saved": 85,
  "errors": []
}
```

**Example — idle (no scraping has been triggered):**
```json
{
  "is_running": false,
  "message": "Idle",
  "articles_scraped": 0,
  "articles_saved": 0,
  "errors": []
}
```

---

## 5. Filtering & Pagination Deep Dive

### 5.1 How Filters Work

All filters on `GET /api/news` are applied server-side as a MongoDB query. They are **AND-combined** — using multiple filters narrows the results.

| Filter | Match Type | Example |
|---|---|---|
| `category` | Exact match | `?category=spor` → only `"spor"` articles |
| `district` | Case-insensitive regex | `?district=Gebze` → matches `"Gebze"`, `"Gebze, Kocaeli"`, etc. |
| `source` | Exact match | `?source=Çağdaş Kocaeli` |
| `start_date` | `>=` comparison | `?start_date=2026-04-01` → articles from April 1st onwards |
| `end_date` | `<=` comparison (inclusive, end of day) | `?end_date=2026-04-03` → up to and including April 3rd 23:59:59 |
| `search` | Case-insensitive regex on `title` OR `content` | `?search=deprem` → articles mentioning "deprem" anywhere |

### 5.2 Pagination

- Results are sorted by `published_at` **descending** (newest first)
- Default: page 1, 20 items per page
- Maximum: 100 items per page
- The response always includes `total`, `page`, `limit`, and `total_pages` for building pagination UI

**Frontend pagination logic:**
```javascript
// Fetch page
const response = await fetch(`${BASE_URL}/api/news?page=${currentPage}&limit=${itemsPerPage}`);
const data = await response.json();

// data.total       → total matching articles
// data.total_pages → number of pages
// data.page        → current page
// data.articles    → articles for this page
```

### 5.3 Getting ALL Articles for the Map

To load **all articles for map markers** (without pagination), you can request a high limit:

```
GET /api/news?limit=100&page=1
```

If `total > 100`, you need to paginate through all pages:
```javascript
async function fetchAllArticles(filters = {}) {
  const params = new URLSearchParams({ limit: '100', ...filters });
  let allArticles = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    params.set('page', String(page));
    const res = await fetch(`${BASE_URL}/api/news?${params}`);
    const data = await res.json();
    allArticles.push(...data.articles);
    totalPages = data.total_pages;
    page++;
  }

  return allArticles;
}
```

### 5.4 Getting Only Mappable Articles

The API does not have a dedicated filter for "has coordinates". You must filter client-side:

```javascript
const mappableArticles = articles.filter(a => a.latitude !== null && a.longitude !== null);
```

---

## 6. Frontend Integration Guide

### 6.1 API Client Setup

```javascript
const API_BASE_URL = 'https://kocaeli-news-map.vercel.app';

// Generic fetch helper
async function apiGet(endpoint, params = {}) {
  const url = new URL(`${API_BASE_URL}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url.toString());
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  return response.json();
}

async function apiPost(endpoint, body = {}) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  return response.json();
}

async function apiDelete(endpoint) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  return response.json();
}
```

### 6.2 Typical Frontend Data Flow

```
Page Load
    │
    ├─► GET /api/news/categories   → populate category dropdown
    ├─► GET /api/news/districts    → populate district dropdown
    ├─► GET /api/news/sources      → populate source dropdown
    ├─► GET /api/news/stats        → display statistics sidebar/dashboard
    └─► GET /api/news?limit=100    → load articles → filter for lat/lng → place markers
         │
         User applies filter
         │
         └─► GET /api/news?category=spor&district=Gebze&limit=100
                  → update markers on map
                  → update article list
```

### 6.3 Example: Fetching Filtered News

```javascript
// Fetch news with all current filter values
async function fetchNews({ category, district, source, startDate, endDate, search, page = 1, limit = 20 }) {
  return apiGet('/api/news', {
    category,
    district,
    source,
    start_date: startDate,   // NOTE: snake_case in API
    end_date: endDate,       // NOTE: snake_case in API
    search,
    page,
    limit,
  });
}

// Usage
const result = await fetchNews({
  category: 'spor',
  district: 'Gebze',
  startDate: '2026-04-01',
  endDate: '2026-04-03',
  page: 1,
  limit: 50,
});
// result.articles → array of NewsArticle
// result.total    → total matching count
```

### 6.4 Example: Populating Filter Dropdowns

```javascript
async function loadFilters() {
  const [categories, districts, sources] = await Promise.all([
    apiGet('/api/news/categories'),
    apiGet('/api/news/districts'),
    apiGet('/api/news/sources'),
  ]);

  // categories = ["ekonomi", "egitim", "guncel", ...]
  // districts  = ["Başiskele", "Çayırova", "Darıca", ...]
  // sources    = ["Bizim Yaka", "Çağdaş Kocaeli", ...]

  return { categories, districts, sources };
}
```

### 6.5 Example: Triggering Scraping & Polling Status

```javascript
// Start scraping
async function startScraping(days = 3, sources = ['all']) {
  return apiPost('/api/scrape', { days, sources });
}

// Poll for progress
async function pollScrapeStatus(onUpdate, intervalMs = 2000) {
  const poll = setInterval(async () => {
    const status = await apiGet('/api/scrape/status');
    onUpdate(status);

    if (!status.is_running) {
      clearInterval(poll);
    }
  }, intervalMs);
}

// Usage
await startScraping(3);
pollScrapeStatus((status) => {
  console.log(status.message);
  // Update progress bar: status.articles_scraped, status.articles_saved
  // Show errors if any: status.errors
});
```

---

## 7. Google Maps Integration Notes

### 7.1 Map Center

Kocaeli province center coordinates:
```javascript
const KOCAELI_CENTER = { lat: 40.7654, lng: 29.9408 };
const DEFAULT_ZOOM = 10;
```

### 7.2 Marker Placement

Only place markers for articles with valid coordinates:
```javascript
const markers = articles
  .filter(article => article.latitude !== null && article.longitude !== null)
  .map(article => ({
    position: { lat: article.latitude, lng: article.longitude },
    title: article.title,
    category: article.category,
    articleData: article,
  }));
```

### 7.3 Category → Marker Color/Icon Mapping

Each category should have a distinct marker color. Suggested mapping:

```javascript
const CATEGORY_COLORS = {
  guncel:    '#EF4444', // Red
  polis:     '#3B82F6', // Blue
  siyaset:   '#8B5CF6', // Purple
  egitim:    '#F59E0B', // Amber
  ekonomi:   '#10B981', // Emerald
  yasam:     '#EC4899', // Pink
  saglik:    '#06B6D4', // Cyan
  teknoloji: '#6366F1', // Indigo
  spor:      '#F97316', // Orange
};

// Default for unknown categories
const DEFAULT_COLOR = '#6B7280'; // Gray
```

### 7.4 Info Window Content

When a marker is clicked, show an info window with:

```javascript
function createInfoWindowContent(article) {
  // Format the date for display
  const date = new Date(article.published_at).toLocaleDateString('tr-TR', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  // List all sources if the article was reported by multiple outlets
  const sourceLinks = article.sources.map(s =>
    `<a href="${s.url}" target="_blank" rel="noopener">${s.name}</a>`
  ).join(', ');

  return `
    <div>
      <h3>${article.title}</h3>
      <p><strong>Tarih:</strong> ${date}</p>
      <p><strong>Kategori:</strong> ${article.category}</p>
      <p><strong>Konum:</strong> ${article.location_text || '—'}</p>
      <p><strong>Kaynak:</strong> ${sourceLinks}</p>
      <a href="${article.source_url}" target="_blank" rel="noopener">Habere Git →</a>
    </div>
  `;
}
```

---

## 8. Error Handling

### 8.1 HTTP Status Codes

| Status | Meaning | When It Occurs |
|---|---|---|
| `200` | Success | All successful requests |
| `400` | Bad Request | Invalid article ID format, invalid date format |
| `404` | Not Found | Article ID does not exist in database |
| `422` | Validation Error | Invalid query parameter types (FastAPI auto-validation) |
| `500` | Internal Server Error | Unexpected server errors |

### 8.2 Error Response Format

**Standard errors (400, 404):**
```json
{
  "detail": "Human-readable error message"
}
```

**Validation errors (422):**
```json
{
  "detail": [
    {
      "loc": ["query", "page"],
      "msg": "ensure this value is greater than or equal to 1",
      "type": "value_error.number.not_ge"
    }
  ]
}
```

### 8.3 Frontend Error Handling Pattern

```javascript
try {
  const data = await apiGet('/api/news', { category: 'spor' });
  // Handle success
} catch (error) {
  // error.message will contain the detail string
  console.error('API Error:', error.message);
  // Show user-friendly error message in UI
}
```

---

## 9. Available News Categories

The system classifies news into these categories. Use this mapping for display labels in the frontend:

| API Value (key) | Turkish Display Name | English Equivalent |
|---|---|---|
| `guncel` | Güncel | Current/Breaking News |
| `polis` | Polis / Adliye | Police / Crime |
| `siyaset` | Siyaset | Politics |
| `egitim` | Eğitim | Education |
| `ekonomi` | Ekonomi | Economy / Finance |
| `yasam` | Yaşam | Lifestyle |
| `saglik` | Sağlık | Health |
| `teknoloji` | Teknoloji | Technology |
| `spor` | Spor | Sports |

> **Note:** Additional categories may appear if the source websites have extra categories (e.g., `kultur-sanat`, `cevre`). Always handle unknown categories gracefully with a default color/icon.

---

## 10. Available News Sources

The 5 Kocaeli local news websites that are scraped:

| Source Name (as in API) | Website URL | Scraper Key |
|---|---|---|
| Çağdaş Kocaeli | https://www.cagdaskocaeli.com.tr | `cagdaskocaeli` |
| Özgür Kocaeli | https://www.ozgurkocaeli.com.tr | `ozgurkocaeli` |
| Ses Kocaeli | https://www.seskocaeli.com | `seskocaeli` |
| Bizim Yaka | https://www.bizimyaka.com | `bizimyaka` |
| Yeni Kocaeli | https://www.yenikocaeli.com | `yenikocaeli` |

> The "Scraper Key" is what you pass in the `sources` array when calling `POST /api/scrape`.

---

## Appendix A: Quick Reference — All Endpoints

| Method | Path | Description | Auth |
|---|---|---|---|
| `GET` | `/` | Health check | None |
| `GET` | `/api/health` | DB health check | None |
| `GET` | `/api/news` | List/filter/search articles (paginated) | None |
| `GET` | `/api/news/categories` | Get all distinct categories | None |
| `GET` | `/api/news/districts` | Get all distinct districts | None |
| `GET` | `/api/news/sources` | Get all distinct sources | None |
| `GET` | `/api/news/stats` | Get aggregated statistics | None |
| `GET` | `/api/news/{article_id}` | Get single article by ID | None |
| `DELETE` | `/api/news/all` | Delete all articles | None (⚠️ admin) |
| `POST` | `/api/scrape` | Trigger scraping pipeline | None |
| `GET` | `/api/scrape/status` | Check scraping progress | None |

---

## Appendix B: TypeScript Types (Copy-Paste Ready)

```typescript
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
  days?: number;       // 1–30, default 3
  sources?: string[];  // source keys or ["all"]
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
  start_date?: string;  // YYYY-MM-DD
  end_date?: string;    // YYYY-MM-DD
  search?: string;
  page?: number;
  limit?: number;
}
```

---

## Appendix C: Map Coordinates for Kocaeli Districts

For reference — approximate central coordinates where markers for each known district tend to appear:

| District | Latitude | Longitude |
|---|---|---|
| İzmit | 40.7654 | 29.9408 |
| Gebze | 40.8027 | 29.4307 |
| Darıca | 40.7692 | 29.3722 |
| Gölcük | 40.7167 | 29.8333 |
| Körfez | 40.7500 | 29.7667 |
| Derince | 40.7533 | 29.8158 |
| Kartepe | 40.6833 | 30.0500 |
| Çayırova | 40.8261 | 29.3750 |
| Dilovası | 40.7833 | 29.5333 |
| Kandıra | 41.0703 | 30.1525 |
| Karamürsel | 40.6900 | 29.6167 |
| Başiskele | 40.7200 | 29.9600 |

---
