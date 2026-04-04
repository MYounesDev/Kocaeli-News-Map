# Environment Setup Guide — Google Maps Integration

## The Core Problem

Your articles have `latitude: null` and `longitude: null` because:
1. **Backend**: Not configured to geocode locations
2. **Frontend**: Map not loading because Google Maps API key is missing

## Solution Checklist

### Step 1: Get Google Maps API Keys

You need **TWO** API keys (both can be the same):
- One for **Backend** (Geocoding API)
- One for **Frontend** (Maps JavaScript API)

#### Create/Find Your Keys:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Go to **APIs & Services → Credentials**
4. Click **+ Create Credentials → API Key**
5. Note the key (you may need to restrict it to your domain later)

#### Enable Required APIs:
In **APIs & Services → Library**, search and enable:
- ✅ **Maps JavaScript API** (for frontend)
- ✅ **Geocoding API** (for backend)

### Step 2: Configure Backend

**File:** `server/.env`

```env
MONGODB_URI=mongodb+srv://admin:yh805522@cluster000.32mwlq1.mongodb.net/?appName=Cluster000
DATABASE_NAME=kocaeli_news
GOOGLE_MAPS_API_KEY=YOUR_API_KEY_HERE
DEFAULT_SCRAPE_DAYS=3
EMBEDDING_MODEL=paraphrase-multilingual-MiniLM-L12-v2
SIMILARITY_THRESHOLD=0.90
```

**Replace:** `YOUR_API_KEY_HERE` with your actual API key

### Step 3: Configure Frontend

**File:** `client/.env.local`

```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=YOUR_API_KEY_HERE
```

**Replace:** `YOUR_API_KEY_HERE` with your actual API key (same or different from backend)

### Step 4: Restart Services

```bash
# Backend
cd server
python main.py

# Frontend (in new terminal)
cd client
npm run dev
```

## Verification Steps

### 1. Test Backend Geocoding

```bash
# Test if geocoding works
curl "http://localhost:8000/api/news/test-geocoding?location=Gebze%2C%20Kocaeli"
```

**Expected response:**
```json
{
  "status": "SUCCESS",
  "location": "Gebze, Kocaeli",
  "latitude": 40.7969,
  "longitude": 29.4328,
  "formatted_address": "Gebze, Kocaeli, Turkey"
}
```

**If you get error about API key:**
```json
{
  "error": "GOOGLE_MAPS_API_KEY not configured in .env",
  "status": "FAILED",
  "suggestion": "Set GOOGLE_MAPS_API_KEY in server/.env"
}
```
→ Add the key to `server/.env`

### 2. Test Location Extraction

```bash
curl "http://localhost:8000/api/news/test-location-extraction?text=Incident%20happened%20in%20Gebze%20today"
```

**Expected:** Successfully extracts "Gebze"

### 3. Check Geocoding Statistics

```bash
curl "http://localhost:8000/api/news/stats-location-data"
```

**Expected:**
```json
{
  "total_articles": 450,
  "with_location_text": 350,
  "with_latitude_longitude": 350,
  "with_location_text_but_no_coords": 0,
  "percentage_geocoded": "77.8%",
  "status": "OK"
}
```

**If coordinates are missing:**
- Check backend logs for geocoding errors
- Verify Geocoding API is enabled in Google Cloud
- Run scraper again: `POST /api/scrape` with `{"days": 1}`

### 4. Test Frontend Map

1. Browser console (F12): Look for messages like:
   - ✅ `Google Maps API already loaded`
   - ✅ `Google Maps script loaded successfully`
   - ✅ `Google Maps initialized successfully`
   - 📍 `Map articles: 450 total, 350 mappable (77.8%)`

2. Or error messages:
   - ❌ `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set!`
   - ❌ `Google Maps API not loaded`

### 5. Full Data Flow Test

```bash
# 1. Clear old data
curl -X DELETE "http://localhost:8000/api/news/all"

# 2. Trigger scrape (takes ~30 seconds)
curl -X POST "http://localhost:8000/api/scrape" \
  -H "Content-Type: application/json" \
  -d '{"days": 1, "sources": ["cagdaskocaeli", "ozgurkocaeli"]}'

# 3. Check geocoding progress
curl "http://localhost:8000/api/news/stats-location-data"

# 4. View articles in browser
# Should see them in "Haberler" tab and on the map
```

## Troubleshooting

### Problem: Map is blank, no errors in console

**Cause:** NEXT_PUBLIC_GOOGLE_MAPS_API_KEY not set

**Fix:**
```bash
# Check if .env.local exists
cat client/.env.local

# If missing or empty, create it:
echo 'NEXT_PUBLIC_API_URL=http://localhost:8000' > client/.env.local
echo 'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=YOUR_KEY' >> client/.env.local

# Then restart: npm run dev
```

### Problem: Map loads but no markers show

**Cause:** Articles don't have `latitude` and `longitude`

**Fix:**
```bash
# Check statistics
curl "http://localhost:8000/api/news/stats-location-data"

# If with_latitude_longitude = 0:
# 1. Check backend logs for geocoding errors
# 2. Verify Geocoding API enabled in Google Cloud
# 3. Run scraper again
curl -X POST "http://localhost:8000/api/scrape" \
  -H "Content-Type: application/json" \
  -d '{"days": 1}'
```

### Problem: "Geocoding API not enabled"

**Fix:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Search for "Geocoding API"
3. Click **Enable**

### Problem: API Key authentication errors

**Fix:**  
1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Find your API key
3. Click on it to edit
4. Under "API restrictions", ensure both APIs are in the list:
   - Maps JavaScript API
   - Geocoding API
5. Restart backend: `python main.py`

## What the System Does Now

With proper setup:

1. **Scraper runs** → Finds news articles
2. **Location extraction** → Finds "Gebze", "İzmit", etc. in text
3. **Geocoding** → Converts "Gebze" → 40.7969°N, 29.4328°E
4. **Database stores** → Saves with coordinates
5. **Frontend requests** → Gets articles with lat/lng
6. **Map displays** → Shows markers on map 🗺️
7. **User clicks marker** → Shows article info window

## Still Having Issues?

Check the browser console (F12) for diagnostic messages. Each message starting with:
- ✅ = Success
- ⚠️ = Warning (might work anyway)
- ❌ = Error (something is broken)
- 📍 = Info (helpful context)
- 📡 = Loading in progress

If you see multiple ❌ errors, check:
1. `server/.env` has `GOOGLE_MAPS_API_KEY`
2. `client/.env.local` has `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
3. Both APIs enabled in Google Cloud Console
4. API keys are valid and not restricted improperly
