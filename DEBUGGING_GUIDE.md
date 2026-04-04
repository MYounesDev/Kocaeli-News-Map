# Debugging Guide: Map & Location Issues

## Quick Checklist

### 1. Frontend (Client)
- [ ] Check `.env.local` has `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` set
- [ ] API key must have **Maps JavaScript API** enabled in Google Cloud Console
- [ ] Run: `npm run dev` and check browser console for errors
- [ ] Expected: "Harita yükleniyor..." loading spinner

### 2. Backend (Server)  
- [ ] Check `.env` has `GOOGLE_MAPS_API_KEY` set
- [ ] **CRITICAL:** API key must have **Geocoding API** enabled in Google Cloud Console
- [ ] Run: `python main.py` and check logs for geocoding messages
- [ ] Use diagnostic endpoint: `GET /api/test-geocoding?location=Gebze%2C%20Kocaeli`

### 3. Data Verification
- [ ] Scrape articles: `POST /api/scrape` with `{"days": 1}`
- [ ] Check response articles for `latitude` and `longitude` (should NOT be null)
- [ ] Check database: articles should have lat/lng populated

## Diagnostic Endpoints

### Test Geocoding
```bash
curl "http://localhost:8000/api/test-geocoding?location=Gebze%2C%20Kocaeli"
```

### Test Google Maps Key (Frontend)
After `npm run dev`, in browser console:
```javascript
console.log(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)
```

## Expected Flow

1. Scraper extracts location text: "Gebze, Kocaeli" ✓
2. Geocoder calls Google API with that text ✓
3. Google API returns lat/lng coordinates ✓
4. Article saved with latitude & longitude ✓
5. Frontend loads articles with lat/lng ✓
6. Map displays markers ✓

## Common Errors

### "All articles have latitude: null"
→ Google Geocoding API not enabled OR key is invalid

### "Map not rendering (blank)"
→ `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` not set OR Maps API not enabled

### "Markers not showing even with data"
→ Frontend-side issue, check browser DevTools
