'use client';

import { useEffect, useRef } from 'react';
import type { NewsArticle } from '@/types/api';
import { KOCAELI_CENTER, DEFAULT_ZOOM, getCategoryConfig } from '@/types/api';

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    google: any;
  }
}

interface NewsMapProps {
  articles: NewsArticle[];
  onMarkerClick?: (article: NewsArticle) => void;
  selectedArticleId?: string | null;
  apiKey?: string;
}

const DARK_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#1a1f2e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1f2e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8b949e' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d333b' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8b949e' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d1b2a' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4a5568' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#1c2333' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#6b7280' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1a2d1a' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#30363d' }] },
  { featureType: 'administrative.land_parcel', elementType: 'labels.text.fill', stylers: [{ color: '#6b7280' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2d333b' }] },
  { featureType: 'transit.station', elementType: 'labels.text.fill', stylers: [{ color: '#8b949e' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#c9d1d9' }] },
];

function createMarkerSvg(color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
    <path d="M14 0C6.268 0 0 6.268 0 14c0 9.75 14 22 14 22s14-12.25 14-22C28 6.268 21.732 0 14 0z" fill="${color}"/>
    <circle cx="14" cy="14" r="6" fill="white" opacity="0.9"/>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('tr-TR', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function createInfoWindowContent(article: NewsArticle): string {
  const cfg = getCategoryConfig(article.category);
  const date = formatDate(article.published_at);
  const sourceLinks = article.sources
    .map(s => `<a href="${s.url}" target="_blank" rel="noopener noreferrer" style="color:#58a6ff;text-decoration:underline;">${s.name}</a>`)
    .join(' · ');

  return `
    <div style="font-family:'Inter',sans-serif;max-width:300px;padding:4px 2px;background:#161b22;color:#e6edf3;border-radius:8px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <span style="background:${cfg.color};color:${cfg.textColor};padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">${cfg.label}</span>
        ${article.location_text ? `<span style="color:#8b949e;font-size:11px;">${article.location_text}</span>` : ''}
      </div>
      <h3 style="margin:0 0 8px;font-size:14px;font-weight:600;color:#e6edf3;line-height:1.4;">${article.title}</h3>
      <p style="margin:0 0 10px;font-size:12px;color:#8b949e;">${date}</p>
      <p style="margin:0 0 10px;font-size:11px;color:#8b949e;">Kaynak: ${sourceLinks}</p>
      <a href="${article.source_url}" target="_blank" rel="noopener noreferrer"
        style="display:inline-block;background:#1f6feb;color:#fff;padding:6px 14px;border-radius:6px;text-decoration:none;font-size:12px;font-weight:500;">
        Habere Git &rarr;
      </a>
    </div>
  `;
}

export default function NewsMap({ articles, onMarkerClick, selectedArticleId, apiKey }: NewsMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const infoWindowRef = useRef<any>(null);
  const mapReadyRef = useRef(false);

  // Stable refs so closures always see the latest values
  const articlesRef = useRef<NewsArticle[]>(articles);
  const onMarkerClickRef = useRef(onMarkerClick);
  useEffect(() => { articlesRef.current = articles; }, [articles]);
  useEffect(() => { onMarkerClickRef.current = onMarkerClick; }, [onMarkerClick]);

  // Place (or re-place) all markers using the latest articles ref
  function placeMarkers() {
    const map = mapInstanceRef.current;
    if (!map || !window.google?.maps) return;

    // Clear old markers
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    if (infoWindowRef.current) {
      infoWindowRef.current.close();
      infoWindowRef.current = null;
    }

    const mappable = articlesRef.current.filter(
      (a) => a.latitude !== null && a.longitude !== null
    );

    mappable.forEach((article) => {
      const cfg = getCategoryConfig(article.category);
      const marker = new window.google.maps.Marker({
        position: { lat: article.latitude!, lng: article.longitude! },
        map,
        title: article.title,
        icon: {
          url: createMarkerSvg(cfg.color),
          scaledSize: new window.google.maps.Size(28, 36),
          anchor: new window.google.maps.Point(14, 36),
        },
      });

      marker.addListener('click', () => {
        if (infoWindowRef.current) infoWindowRef.current.close();
        infoWindowRef.current = new window.google.maps.InfoWindow({
          content: createInfoWindowContent(article),
        });
        infoWindowRef.current.open(map, marker);
        onMarkerClickRef.current?.(article);
      });

      markersRef.current.push(marker);
    });
  }

  // Initialize the map exactly once
  function initMap() {
    if (!mapRef.current || mapInstanceRef.current) return;
    if (!window.google?.maps?.Map) return;

    const map = new window.google.maps.Map(mapRef.current, {
      center: KOCAELI_CENTER,
      zoom: DEFAULT_ZOOM,
      styles: DARK_STYLE,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      gestureHandling: 'greedy',
    });

    mapInstanceRef.current = map;
    mapReadyRef.current = true;
    placeMarkers();
  }

  // Load Google Maps script once on mount using loading=async (no callback)
  useEffect(() => {
    // Already bootstrapped — init immediately
    if (window.google?.maps?.Map) {
      initMap();
      return;
    }

    // Script tag already in DOM — wait for it to finish loading
    const existing = document.getElementById('google-maps-script') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', initMap);
      return () => existing.removeEventListener('load', initMap);
    }

    // First mount — inject script with loading=async and NO callback
    const key = apiKey || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
    const script = document.createElement('script');
    script.id = 'google-maps-script';
    // loading=async is required by Google; we do NOT use &callback= with it
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&language=tr&region=TR&v=weekly`;
    script.async = true;
    script.addEventListener('load', initMap);
    document.head.appendChild(script);

    return () => script.removeEventListener('load', initMap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-place markers whenever articles change (after map is ready)
  useEffect(() => {
    articlesRef.current = articles;
    if (mapReadyRef.current && mapInstanceRef.current) {
      placeMarkers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articles]);

  // Pan to selected article
  useEffect(() => {
    if (!selectedArticleId || !mapInstanceRef.current) return;
    const article = articles.find((a) => a.id === selectedArticleId);
    if (article?.latitude && article?.longitude) {
      mapInstanceRef.current.panTo({ lat: article.latitude, lng: article.longitude });
      mapInstanceRef.current.setZoom(14);
    }
  }, [selectedArticleId, articles]);

  return (
    <div
      ref={mapRef}
      className="w-full h-full"
      aria-label="Kocaeli Haber Haritası"
      role="application"
    />
  );
}
