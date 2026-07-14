# 🗺️ Kocaeli News Map

An interactive map that scrapes local Kocaeli news sources, extracts the locations mentioned in each article, geocodes them, and plots them on a live map — so you can see what's happening, where, at a glance.

**Live demo:** [kocaeli-news-map.vercel.app](https://kocaeli-news-map.vercel.app)

---

## ✨ Features

- 📰 **Automated scraping** of local Kocaeli news sources (e.g. Çağdaş Kocaeli, Özgür Kocaeli)
- 📍 **Location extraction** — detects place names (Gebze, İzmit, etc.) mentioned in article text
- 🌍 **Geocoding** — converts extracted place names into latitude/longitude via the Google Geocoding API
- 🗺️ **Interactive map** — dark-styled Google Map with color-coded markers by news category (e.g. red = police/crime, yellow = sports)
- 🧭 **Article ↔ map sync** — selecting an article in the list pans the map to its location; clicking a marker opens the article info window
- 🧠 **Duplicate detection** — uses multilingual sentence embeddings to avoid saving near-duplicate articles
- 🧪 **Diagnostic endpoints** — built-in routes to test geocoding, location extraction, and view geocoding coverage stats

---

## 🏗️ Tech Stack

| Layer      | Technology |
|------------|------------|
| Frontend   | Next.js (TypeScript), Google Maps JavaScript API |
| Backend    | Python (FastAPI-style app), Google Geocoding API |
| Database   | MongoDB |
| NLP        | `sentence-transformers` (`paraphrase-multilingual-MiniLM-L12-v2`) for similarity-based deduplication |
| Deployment | Vercel (frontend) |

---

## 📁 Project Structure

```
Kocaeli-News-Map/
├── client/                  # Next.js frontend
│   ├── components/
│   │   └── news-map.tsx     # Google Maps integration & marker logic
│   └── .env.local           # Frontend environment variables
├── server/                  # Python backend
│   ├── app/
│   │   ├── routers/
│   │   │   └── news.py      # News, scraping & diagnostic API routes
│   │   └── services/
│   │       └── geocoder.py  # Geocoding logic
│   ├── main.py               # App entry point
│   └── .env                  # Backend environment variables
├── docs/                     # Additional project documentation
├── ENV_SETUP_GUIDE.md         # Step-by-step Google Maps / env setup guide
├── DEBUGGING_GUIDE.md         # Troubleshooting reference
├── FIX_SUMMARY.md             # Notes on map/location fixes
└── test_diagnostic.py         # Standalone diagnostic script
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Python 3.10+
- A MongoDB instance (local or Atlas)
- A Google Cloud project with the **Maps JavaScript API** and **Geocoding API** enabled

### 1. Clone the repository

```bash
git clone https://github.com/MYounesDev/Kocaeli-News-Map.git
cd Kocaeli-News-Map
```

### 2. Configure environment variables

**`server/.env`**

```env
MONGODB_URI=your_mongodb_connection_string
DATABASE_NAME=kocaeli_news
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
DEFAULT_SCRAPE_DAYS=3
EMBEDDING_MODEL=paraphrase-multilingual-MiniLM-L12-v2
SIMILARITY_THRESHOLD=0.90
```

**`client/.env.local`**

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

> ⚠️ You need two enabled APIs on your Google Cloud key: **Maps JavaScript API** (frontend) and **Geocoding API** (backend). See [`ENV_SETUP_GUIDE.md`](./ENV_SETUP_GUIDE.md) for the full walkthrough.

### 3. Run the backend

```bash
cd server
pip install -r requirements.txt
python main.py
```

The API will be available at `http://localhost:8000`.

### 4. Run the frontend

```bash
cd client
npm install
npm run dev
```

The app will be available at `http://localhost:3000`.

---

## 🔌 Key API Endpoints

| Method | Endpoint | Description |
|--------|----------|--------------|
| `POST` | `/api/scrape` | Triggers the scraper (`{"days": 1, "sources": [...]}`) |
| `GET`  | `/api/news` | Fetch scraped news articles |
| `DELETE` | `/api/news/all` | Clear stored articles |
| `GET`  | `/api/news/test-geocoding?location=...` | Test geocoding for a given location string |
| `GET`  | `/api/news/test-location-extraction?text=...` | Test location extraction from raw text |
| `GET`  | `/api/news/stats-location-data` | View geocoding coverage statistics |

Example:

```bash
curl "http://localhost:8000/api/news/stats-location-data"
```

```json
{
  "total_articles": 450,
  "with_location_text": 350,
  "with_latitude_longitude": 350,
  "percentage_geocoded": "77.8%",
  "status": "OK"
}
```

---

## 🔄 How It Works

1. **Scraper** collects articles from configured Kocaeli news sources.
2. **Location extraction** scans article text for place names (e.g. "Gebze", "İzmit").
3. **Geocoding** converts each place name into coordinates via the Google Geocoding API.
4. **Deduplication** compares new articles against existing ones using sentence embeddings, discarding near-duplicates above the similarity threshold.
5. **Storage** — articles (with coordinates, category, and metadata) are saved to MongoDB.
6. **Frontend** fetches articles from the API and renders them as color-coded markers on an interactive map.
7. **Interaction** — clicking a marker or list item surfaces the article and centers the map on its location.

---

## 🐞 Troubleshooting

- Map renders blank → check `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in `client/.env.local`
- No markers appear → check `GOOGLE_MAPS_API_KEY` in `server/.env` and confirm the Geocoding API is enabled
- Run `python test_diagnostic.py` for an automated environment check

See [`DEBUGGING_GUIDE.md`](./DEBUGGING_GUIDE.md) and [`ENV_SETUP_GUIDE.md`](./ENV_SETUP_GUIDE.md) for detailed guidance.

---
