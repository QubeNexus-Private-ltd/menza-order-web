import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Search,
  LocateFixed,
  PowerOff,
  MapPin,
  X,
  Loader2,
  Navigation,
} from 'lucide-react';

export interface ExploreMapCoords {
  lat: number;
  lng: number;
  label: string;
}

export interface ExploreMapSearchProps {
  coords: ExploreMapCoords | null;
  detectingGps: boolean;
  restaurantCount: number;
  loadingRestaurants: boolean;
  onSelectMapLocation: (loc: { lat: number; lng: number; label: string; city?: string }) => void;
  onDetectGps: () => void;
  onDisconnectGps: () => void;
  onClose: () => void;
}

interface PlaceSearchResult {
  place_id: number | string;
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    suburb?: string;
    neighbourhood?: string;
    city?: string;
    town?: string;
    village?: string;
    state_district?: string;
    state?: string;
  };
}

const DEFAULT_INDIA_CENTER: [number, number] = [22.9734, 78.6569];
const DEFAULT_INDIA_ZOOM = 5;
const SEARCH_RADIUS_METERS = 15000;

function escapeHtml(text: string): string {
  return String(text || '').replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return ch;
    }
  });
}

function createSearchPinIcon(label: string) {
  const safeLabel = escapeHtml(label || 'Search Area');
  return L.divIcon({
    className: 'menza-explore-map-pin',
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);">
        <div style="background:#D33401;color:#fff;font-size:11px;font-weight:800;padding:3px 8px;border-radius:999px;white-space:nowrap;box-shadow:0 3px 10px rgba(0,0,0,0.28);margin-bottom:3px;max-width:160px;overflow:hidden;text-overflow:ellipsis;">
          ${safeLabel}
        </div>
        <svg width="28" height="34" viewBox="0 0 24 30" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 3px 5px rgba(0,0,0,0.32));">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 8.25 12 18 12 18s12-9.75 12-18c0-6.63-5.37-12-12-12z" fill="#D33401"/>
          <circle cx="12" cy="11.5" r="4.5" fill="#ffffff"/>
        </svg>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

function formatShortPlaceLabel(addr: PlaceSearchResult['address'], fallbackDisplay?: string): {
  label: string;
  city: string;
} {
  const city =
    addr?.city ||
    addr?.town ||
    addr?.village ||
    addr?.state_district ||
    '';
  const area = addr?.suburb || addr?.neighbourhood || '';
  if (area && city && area.toLowerCase() !== city.toLowerCase()) {
    return { label: `${area}, ${city}`, city };
  }
  if (city) {
    return { label: city, city };
  }
  if (fallbackDisplay) {
    const firstPart = fallbackDisplay.split(',')[0]?.trim();
    if (firstPart) return { label: firstPart, city: firstPart };
  }
  return { label: 'Pinned Map Area', city: '' };
}

/**
 * Interactive Leaflet map panel for searching cities/areas and pinning a location
 * to discover nearby restaurants without modifying backend discovery logic.
 */
export default function ExploreMapSearch({
  coords,
  detectingGps,
  restaurantCount,
  loadingRestaurants,
  onSelectMapLocation,
  onDetectGps,
  onDisconnectGps,
  onClose,
}: ExploreMapSearchProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const selectCallbackRef = useRef(onSelectMapLocation);

  const [placeQuery, setPlaceQuery] = useState('');
  const [searchingPlaces, setSearchingPlaces] = useState(false);
  const [placeResults, setPlaceResults] = useState<PlaceSearchResult[]>([]);
  const [searchError, setSearchError] = useState('');

  useEffect(() => {
    selectCallbackRef.current = onSelectMapLocation;
  }, [onSelectMapLocation]);

  const reverseGeocodeAndNotify = async (lat: number, lng: number) => {
    const roundedLat = Number(lat.toFixed(6));
    const roundedLng = Number(lng.toFixed(6));
    const fallbackLabel = `Map Pin (${roundedLat.toFixed(2)}, ${roundedLng.toFixed(2)})`;

    selectCallbackRef.current({
      lat: roundedLat,
      lng: roundedLng,
      label: fallbackLabel,
    });

    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(roundedLat)}&lon=${encodeURIComponent(roundedLng)}`,
        { headers: { Accept: 'application/json' } }
      );
      if (resp.ok) {
        const data = await resp.json();
        const { label, city } = formatShortPlaceLabel(data?.address, data?.display_name);
        selectCallbackRef.current({
          lat: roundedLat,
          lng: roundedLng,
          label,
          city,
        });
      }
    } catch {
      // Keep fallback coordinate label when reverse geocoding is offline
    }
  };

  // Initialize Leaflet map once
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const initialCenter: [number, number] = coords
      ? [coords.lat, coords.lng]
      : DEFAULT_INDIA_CENTER;
    const initialZoom = coords ? 11 : DEFAULT_INDIA_ZOOM;

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: initialZoom,
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      reverseGeocodeAndNotify(e.latlng.lat, e.latlng.lng);
    });

    mapRef.current = map;
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 120);

    return () => {
      clearTimeout(timer);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
  }, []);

  // Sync pin & 15km radius circle with current coords (or clear when disconnected)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!coords || !Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      if (circleRef.current) {
        circleRef.current.remove();
        circleRef.current = null;
      }
      map.setView(DEFAULT_INDIA_CENTER, DEFAULT_INDIA_ZOOM, { animate: true });
      return;
    }

    const latLng: [number, number] = [coords.lat, coords.lng];

    if (!markerRef.current) {
      const marker = L.marker(latLng, {
        draggable: true,
        icon: createSearchPinIcon(coords.label),
      }).addTo(map);

      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        reverseGeocodeAndNotify(pos.lat, pos.lng);
      });

      markerRef.current = marker;
    } else {
      markerRef.current.setLatLng(latLng);
      markerRef.current.setIcon(createSearchPinIcon(coords.label));
    }

    if (!circleRef.current) {
      circleRef.current = L.circle(latLng, {
        radius: SEARCH_RADIUS_METERS,
        color: '#D33401',
        weight: 1.5,
        opacity: 0.65,
        fillColor: '#D33401',
        fillOpacity: 0.08,
        interactive: false,
      }).addTo(map);
    } else {
      circleRef.current.setLatLng(latLng);
    }

    map.setView(latLng, Math.max(map.getZoom(), 11), { animate: true });
    map.invalidateSize();
  }, [coords?.lat, coords?.lng, coords?.label]);

  const handleSearchPlace = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = placeQuery.trim();
    if (!q) {
      setSearchError('Enter a city, area, or landmark to locate on the map.');
      setPlaceResults([]);
      return;
    }
    setSearchingPlaces(true);
    setSearchError('');
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&q=${encodeURIComponent(q)}`,
        { headers: { Accept: 'application/json' } }
      );
      if (!resp.ok) throw new Error('Place search failed');
      const results: PlaceSearchResult[] = await resp.json();
      if (!Array.isArray(results) || results.length === 0) {
        setPlaceResults([]);
        setSearchError(`No map locations found for "${q}". Try another city or area.`);
      } else {
        setPlaceResults(results);
      }
    } catch {
      setPlaceResults([]);
      setSearchError('Unable to search map locations right now. You can still tap directly on the map.');
    } finally {
      setSearchingPlaces(false);
    }
  };

  const handlePickSearchResult = (item: PlaceSearchResult) => {
    const lat = Number(Number(item.lat).toFixed(6));
    const lng = Number(Number(item.lon).toFixed(6));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const { label, city } = formatShortPlaceLabel(item.address, item.display_name);
    onSelectMapLocation({ lat, lng, label, city });
    setPlaceResults([]);
    setSearchError('');
  };

  return (
    <div className="bg-white rounded-2xl border border-[#EAE5DC] shadow-sm overflow-hidden flex flex-col">
      {/* Map Header Bar */}
      <div className="px-4 py-3 bg-[#FFFDF9] border-b border-[#EAE5DC] flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#FFF1EC] border border-[#FFD8CB] text-[#D33401] flex items-center justify-center shrink-0">
            <Navigation className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-extrabold text-[#18181B] truncate">
              Search on Map
            </h3>
            <p className="text-[11px] text-slate-500 truncate">
              {coords
                ? `${loadingRestaurants ? 'Searching' : `${restaurantCount} found`} within 15 km of ${coords.label}`
                : 'GPS disconnected — search a city or tap anywhere on the map'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onDetectGps}
            disabled={detectingGps}
            className="h-8 px-3 rounded-lg bg-[#FFF1EC] hover:bg-[#FFE4DA] border border-[#FFD8CB] text-[#D33401] text-[11px] font-extrabold flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            {detectingGps ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <LocateFixed className="w-3.5 h-3.5" />
            )}
            <span>{detectingGps ? 'Locating...' : 'Use GPS'}</span>
          </button>

          {coords && (
            <button
              type="button"
              onClick={onDisconnectGps}
              className="h-8 px-3 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-[11px] font-extrabold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <PowerOff className="w-3.5 h-3.5" />
              <span>Turn Off GPS</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label="Close map search"
            className="h-8 w-8 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-600 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Place Search Input */}
      <div className="p-3 bg-white border-b border-[#F4F1EA] relative z-20">
        <form onSubmit={handleSearchPlace} className="flex items-center gap-2">
          <div className="relative flex-1 flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              value={placeQuery}
              onChange={(e) => {
                setPlaceQuery(e.target.value);
                if (searchError) setSearchError('');
              }}
              placeholder="Search city, area, or landmark on map (e.g. Bhopal, Indiranagar)..."
              className="w-full h-10 pl-10 pr-8 rounded-xl bg-[#FAF7F2] border border-[#E4E0D8] text-xs sm:text-sm text-[#18181B] placeholder:text-slate-400 focus:border-[#D33401] focus:bg-white transition-colors outline-none"
            />
            {placeQuery && (
              <button
                type="button"
                onClick={() => {
                  setPlaceQuery('');
                  setPlaceResults([]);
                  setSearchError('');
                }}
                aria-label="Clear map search"
                className="absolute right-2.5 p-1 rounded-full hover:bg-zinc-200/70 text-slate-400 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={searchingPlaces}
            className="h-10 px-4 rounded-xl bg-[#18181B] hover:bg-zinc-800 text-white text-xs font-extrabold flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
          >
            {searchingPlaces ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            <span>Find</span>
          </button>
        </form>

        {searchError && (
          <p className="text-[11px] font-semibold text-amber-700 mt-2 px-1">{searchError}</p>
        )}

        {placeResults.length > 0 && (
          <div className="mt-2 rounded-xl border border-[#EAE5DC] bg-white divide-y divide-[#F4F1EA] shadow-md max-h-48 overflow-y-auto">
            {placeResults.map((item) => (
              <button
                key={item.place_id}
                type="button"
                onClick={() => handlePickSearchResult(item)}
                className="w-full text-left px-3 py-2.5 hover:bg-[#FFF8F5] flex items-start gap-2.5 cursor-pointer transition-colors"
              >
                <MapPin className="w-4 h-4 text-[#D33401] shrink-0 mt-0.5" />
                <span className="text-xs text-[#18181B] font-medium leading-snug line-clamp-2">
                  {item.display_name}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Interactive Leaflet Map Canvas (isolated z-0 stacking context so controls never overlap sticky header) */}
      <div className="relative z-0 isolate w-full h-[270px] sm:h-[320px] bg-[#ECE8E1]">
        <div ref={mapContainerRef} className="w-full h-full" />
      </div>

      {/* Map Footer Hint */}
      <div className="px-4 py-2.5 bg-[#FAF7F2] border-t border-[#EAE5DC] flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
        <span>Tap anywhere on the map or drag the pin to search restaurants around that spot.</span>
        {coords && (
          <span className="font-mono text-[10.5px] text-slate-600">
            {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
          </span>
        )}
      </div>
    </div>
  );
}
