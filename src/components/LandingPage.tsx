import React, { useEffect, useState, useCallback } from 'react';
import {
  QrCode,
  Utensils,
  AlertCircle,
  Camera,
  Bike,
  ShoppingBag,
  Clock,
  ShieldCheck,
  Tag,
  ChevronRight,
  Sparkles,
  ArrowRight,
  Receipt,
  ClipboardPaste,
  Link2,
  MapPin,
  Search,
  LocateFixed,
  Star,
  Store,
  X,
  Loader2,
} from 'lucide-react';
import * as api from '../services/api';
import { NearbyRestaurantCard } from '../types';

export interface LandingPageProps {
  onOpenScanner: () => void;
  isInvalidRestaurant?: boolean;
  activeOrder?: any;
  onTrackOrder?: (orderId: string | number) => void;
  onExploreDelivery?: () => void;
  onOpenLinkOrCode?: (rawInput: string) => boolean | Promise<boolean>;
  onSelectRestaurant?: (encryptedRestaurantId: string) => void | Promise<void>;
}

type OrderModeKey = 'dinein' | 'delivery' | 'takeaway';
type DietaryFilter = 'all' | 'veg' | 'nonveg';
type ServiceFilter = 'all' | 'delivery' | 'dinein';

const MODE_CONFIG: Record<
  OrderModeKey,
  {
    label: string;
    badge: string;
    title: string;
    hint: string;
    accentHex: string;
    panelBgClass: string;
    badgeTextClass: string;
    ctaLabel: string;
  }
> = {
  dinein: {
    label: 'Dine-In',
    badge: 'AT YOUR TABLE',
    title: 'Scan your table QR',
    hint: 'Browse the live menu, customize spice levels, call your waiter & pay directly from your seat.',
    accentHex: '#D33401',
    panelBgClass: 'bg-[#FFF1EC]',
    badgeTextClass: 'text-[#D33401]',
    ctaLabel: 'Scan Table QR Code',
  },
  delivery: {
    label: 'Delivery',
    badge: 'DIRECT SELF-DELIVERY',
    title: 'Order at true menu prices',
    hint: 'Explore nearby restaurants above or paste a shared Menza link below — zero 30% app markups.',
    accentHex: '#2563EB',
    panelBgClass: 'bg-blue-50',
    badgeTextClass: 'text-blue-600',
    ctaLabel: 'Scan Restaurant QR',
  },
  takeaway: {
    label: 'Takeaway',
    badge: 'SKIP THE COUNTER LINE',
    title: 'Pre-order & pick up hot',
    hint: 'Open the restaurant menu via QR or shared link, place your order ahead, and collect fresh from the counter.',
    accentHex: '#059669',
    panelBgClass: 'bg-emerald-50',
    badgeTextClass: 'text-emerald-600',
    ctaLabel: 'Scan Counter QR',
  },
};

function DietaryBadge({ dietaryType }: { dietaryType?: string | null }) {
  const lower = String(dietaryType || '').toLowerCase();
  const isPureVeg = lower === 'veg' || lower === 'pureveg' || lower === 'pure veg';
  const isNonVeg = lower === 'nonveg' || lower === 'non-veg' || lower === 'non veg';

  if (isPureVeg) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-[10px] font-extrabold text-emerald-700">
        <span className="w-2.5 h-2.5 rounded-[3px] border border-emerald-600 flex items-center justify-center">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
        </span>
        Pure Veg
      </span>
    );
  }

  if (isNonVeg) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50 border border-red-200 text-[10px] font-extrabold text-red-700">
        <span className="w-2.5 h-2.5 rounded-[3px] border border-red-600 flex items-center justify-center">
          <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
        </span>
        Non-Veg
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-[10px] font-bold text-amber-800">
      Veg &amp; Non-Veg
    </span>
  );
}

export default function LandingPage({
  onOpenScanner,
  isInvalidRestaurant = false,
  activeOrder,
  onTrackOrder,
  onOpenLinkOrCode,
  onSelectRestaurant,
}: LandingPageProps) {
  const [selectedMode, setSelectedMode] = useState<OrderModeKey>('dinein');
  const [linkInput, setLinkInput] = useState('');
  const [linkError, setLinkError] = useState('');
  const [submittingLink, setSubmittingLink] = useState(false);

  // Discovery, GPS & Filter state
  const [coords, setCoords] = useState<{ lat: number; lng: number; label: string } | null>(() => {
    const cached = api.getLastCustomerLocation();
    return cached ? { lat: cached.lat, lng: cached.lng, label: cached.label || cached.city || 'Saved GPS' } : null;
  });
  const [detectingGps, setDetectingGps] = useState(false);
  const [gpsStatusMsg, setGpsStatusMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [dietaryFilter, setDietaryFilter] = useState<DietaryFilter>('all');
  const [serviceFilter, setServiceFilter] = useState<ServiceFilter>('all');
  const [nearbyList, setNearbyList] = useState<NearbyRestaurantCard[]>([]);
  const [loadingNearby, setLoadingNearby] = useState(true);
  const [recentRestaurants, setRecentRestaurants] = useState<any[]>(() => api.getRecentRestaurants());

  const currentMode = MODE_CONFIG[selectedMode];
  const activeOrderId = activeOrder?.orderId || activeOrder?.id;

  // Debounce search query
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 320);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Refresh recent list when landing mounts
  useEffect(() => {
    setRecentRestaurants(api.getRecentRestaurants());
  }, []);

  // Silently check existing browser geolocation permission
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.permissions || !navigator.geolocation) return;
    navigator.permissions
      .query({ name: 'geolocation' as PermissionName })
      .then((res) => {
        if (res.state === 'granted') {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const next = {
                lat: Number(pos.coords.latitude.toFixed(6)),
                lng: Number(pos.coords.longitude.toFixed(6)),
                label: 'Nearby GPS',
              };
              setCoords(next);
              api.saveLastCustomerLocation(next);
            },
            () => {},
            { timeout: 6000, maximumAge: 120000 }
          );
        }
      })
      .catch(() => {});
  }, []);

  const handleDetectLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsStatusMsg('Location detection is unavailable in this browser.');
      return;
    }
    setDetectingGps(true);
    setGpsStatusMsg('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = {
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
          label: 'Current GPS',
        };
        setCoords(next);
        api.saveLastCustomerLocation(next);
        setDetectingGps(false);
        setGpsStatusMsg('');
      },
      (err) => {
        setDetectingGps(false);
        setGpsStatusMsg(
          err?.code === 1
            ? 'Location permission denied. Showing available restaurants by name & city.'
            : 'Could not lock GPS right now. Showing available restaurants.'
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  // Fetch nearby restaurants whenever filters or location change
  useEffect(() => {
    let active = true;
    setLoadingNearby(true);
    api
      .getNearbyRestaurants({
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        radiusKm: 15,
        dietary: dietaryFilter,
        mode: serviceFilter,
        q: debouncedQuery,
        page: 1,
        pageSize: 20,
      })
      .then((res: any) => {
        if (!active) return;
        const list = Array.isArray(res?.items) ? res.items : [];
        setNearbyList(list);
      })
      .catch(() => {
        if (active) setNearbyList([]);
      })
      .finally(() => {
        if (active) setLoadingNearby(false);
      });
    return () => {
      active = false;
    };
  }, [coords?.lat, coords?.lng, dietaryFilter, serviceFilter, debouncedQuery]);

  const handleOpenRestaurant = async (encRestId: string) => {
    if (!encRestId) return;
    if (typeof onSelectRestaurant === 'function') {
      await onSelectRestaurant(encRestId);
    } else if (typeof onOpenLinkOrCode === 'function') {
      await onOpenLinkOrCode(encRestId);
    }
  };

  const handleSubmitLink = async (e?: React.FormEvent, valueOverride?: string) => {
    if (e) e.preventDefault();
    const raw = (valueOverride ?? linkInput).trim();
    if (!raw) {
      setLinkError('Please paste a restaurant link or enter a store ID.');
      return;
    }
    setLinkError('');
    if (typeof onOpenLinkOrCode === 'function') {
      setSubmittingLink(true);
      try {
        const ok = await onOpenLinkOrCode(raw);
        if (!ok) {
          setLinkError('Could not recognize a restaurant ID in that text.');
        }
      } finally {
        setSubmittingLink(false);
      }
    } else {
      onOpenScanner();
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          setLinkInput(text.trim());
          setLinkError('');
        } else {
          setLinkError('Clipboard is empty. Copy a Menza link first or scan a QR.');
        }
      } else {
        setLinkError('Clipboard access unavailable. Please paste directly into the box.');
      }
    } catch {
      setLinkError('Please allow clipboard access or paste directly into the box.');
    }
  };

  const handlePartnerContact = () => {
    const text = encodeURIComponent(
      'Hi Menza Team, I am a restaurant owner interested in partnering for 0% commission QR ordering & direct delivery.'
    );
    window.open(`https://wa.me/918109538213?text=${text}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#18181B] flex flex-col justify-between pb-24 md:pb-0">
      {/* Sticky Top Bar with GPS Location Pill */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#EAE5DC] px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#D33401] flex items-center justify-center shadow-sm shrink-0">
              <Utensils className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <span className="text-lg sm:text-xl font-extrabold tracking-tight text-[#18181B] block leading-none truncate">
                Menza<span className="text-[#D33401]">Order</span>
              </span>
              <span className="hidden sm:block text-[10px] font-bold text-zinc-500 tracking-wider uppercase mt-0.5">
                Direct Dining &amp; Delivery
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleDetectLocation}
              disabled={detectingGps}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold transition-colors cursor-pointer ${
                coords
                  ? 'bg-[#FFF1EC] border-[#FFD8CB] text-[#D33401]'
                  : 'bg-zinc-100 hover:bg-zinc-200 border-zinc-200 text-zinc-700'
              }`}
            >
              {detectingGps ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <MapPin className="w-3.5 h-3.5 shrink-0" />
              )}
              <span className="max-w-[115px] truncate">
                {detectingGps ? 'Locating...' : coords ? coords.label : 'Detect GPS'}
              </span>
            </button>

            {activeOrderId ? (
              <button
                onClick={() => onTrackOrder && onTrackOrder(activeOrderId)}
                className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-full text-xs font-extrabold transition-colors cursor-pointer shrink-0"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                <span className="truncate max-w-[100px]">Track #{activeOrderId}</span>
                <ChevronRight className="w-3.5 h-3.5 shrink-0" />
              </button>
            ) : (
              <span className="hidden sm:inline-block px-2.5 py-1 rounded-full bg-[#FFF1EC] border border-[#FFD8CB] text-[#D33401] text-[11px] font-extrabold shrink-0">
                0% Markup
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-5 sm:py-7 flex flex-col gap-6">
        {/* Invalid Restaurant Banner */}
        {isInvalidRestaurant && (
          <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="text-xs text-red-900 leading-relaxed">
              <span className="font-extrabold text-sm block mb-0.5">Menu link expired or invalid</span>
              Pick a restaurant below, scan a fresh table QR code, or paste an updated link.
            </div>
          </div>
        )}

        {/* Active Order Resume Card */}
        {activeOrderId && (
          <button
            onClick={() => onTrackOrder && onTrackOrder(activeOrderId)}
            className="w-full text-left flex items-center justify-between gap-3 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 rounded-2xl p-3.5 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 text-emerald-700" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-emerald-950 truncate">
                  Order #{activeOrderId} is {activeOrder?.orderStatus || 'Active'}
                </p>
                <p className="text-xs text-emerald-700 truncate">
                  Tap to view live kitchen progress &amp; bill
                </p>
              </div>
            </div>
            <span className="flex items-center gap-1 bg-emerald-700 text-white px-3 py-2 rounded-xl text-xs font-extrabold shrink-0">
              <span>Track</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </button>
        )}

        {/* Search & Dietary / Service Discovery Strip */}
        <section className="flex flex-col gap-3">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search restaurants, cuisines, or city..."
              className="w-full h-12 pl-10 pr-10 rounded-2xl bg-white border border-[#EAE5DC] text-sm text-[#18181B] placeholder:text-slate-400 shadow-xs focus:border-[#D33401] outline-none"
            />
            {searchQuery.length > 0 && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-3 p-1 rounded-full hover:bg-zinc-100 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {/* Dietary Chips */}
            {(
              [
                { id: 'all', label: 'All Food' },
                { id: 'veg', label: 'Pure Veg' },
                { id: 'nonveg', label: 'Non-Veg' },
              ] as { id: DietaryFilter; label: string }[]
            ).map((f) => {
              const active = dietaryFilter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setDietaryFilter(f.id)}
                  className={`h-9 px-3.5 rounded-full text-xs font-extrabold flex items-center gap-1.5 shrink-0 border transition-colors cursor-pointer ${
                    active
                      ? f.id === 'veg'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : f.id === 'nonveg'
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-[#18181B] text-white border-[#18181B]'
                      : 'bg-white text-zinc-700 border-[#EAE5DC] hover:bg-zinc-50'
                  }`}
                >
                  {f.id === 'veg' && (
                    <span className={`w-2.5 h-2.5 rounded-[3px] border flex items-center justify-center ${active ? 'border-white' : 'border-emerald-600'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-white' : 'bg-emerald-600'}`} />
                    </span>
                  )}
                  {f.id === 'nonveg' && (
                    <span className={`w-2.5 h-2.5 rounded-[3px] border flex items-center justify-center ${active ? 'border-white' : 'border-red-600'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-white' : 'bg-red-600'}`} />
                    </span>
                  )}
                  <span>{f.label}</span>
                </button>
              );
            })}

            <span className="h-5 w-px bg-[#E4E0D8] shrink-0 mx-0.5" />

            {/* Service Mode Chips */}
            <button
              type="button"
              onClick={() => setServiceFilter(serviceFilter === 'delivery' ? 'all' : 'delivery')}
              className={`h-9 px-3.5 rounded-full text-xs font-extrabold flex items-center gap-1.5 shrink-0 border transition-colors cursor-pointer ${
                serviceFilter === 'delivery'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-zinc-700 border-[#EAE5DC] hover:bg-zinc-50'
              }`}
            >
              <Bike className="w-3.5 h-3.5" />
              <span>Delivery</span>
            </button>

            <button
              type="button"
              onClick={() => setServiceFilter(serviceFilter === 'dinein' ? 'all' : 'dinein')}
              className={`h-9 px-3.5 rounded-full text-xs font-extrabold flex items-center gap-1.5 shrink-0 border transition-colors cursor-pointer ${
                serviceFilter === 'dinein'
                  ? 'bg-[#D33401] text-white border-[#D33401]'
                  : 'bg-white text-zinc-700 border-[#EAE5DC] hover:bg-zinc-50'
              }`}
            >
              <Utensils className="w-3.5 h-3.5" />
              <span>Dine-In</span>
            </button>
          </div>

          {gpsStatusMsg && (
            <p className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5">
              {gpsStatusMsg}
            </p>
          )}
        </section>

        {/* Recently Visited Strip */}
        {recentRestaurants.length > 0 && (
          <section className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between px-0.5">
              <h2 className="text-sm font-extrabold text-[#18181B]">Recently Visited</h2>
              <span className="text-[11px] font-bold text-slate-500">Order Again</span>
            </div>
            <div className="flex items-stretch gap-2.5 overflow-x-auto pb-1">
              {recentRestaurants.map((rec: any) => (
                <button
                  key={rec.encryptedRestaurantId || rec.restaurantId}
                  type="button"
                  onClick={() => handleOpenRestaurant(rec.encryptedRestaurantId)}
                  className="min-w-[205px] max-w-[225px] bg-white hover:border-[#D33401] border border-[#EAE5DC] rounded-2xl p-3 flex items-center gap-3 text-left shrink-0 transition-colors cursor-pointer shadow-xs"
                >
                  <div className="w-11 h-11 rounded-xl bg-[#FFF1EC] border border-[#FFD8CB] overflow-hidden flex items-center justify-center shrink-0">
                    {rec.logoUrl ? (
                      <img src={rec.logoUrl} alt={rec.restaurantName} className="w-full h-full object-cover" />
                    ) : (
                      <Store className="w-5 h-5 text-[#D33401]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-extrabold text-[#18181B] truncate">{rec.restaurantName}</p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {rec.city || (rec.isDeliveryEnabled ? 'Delivery & Dine-In' : 'Dine-In')}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Nearby & Featured Restaurants Grid */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2 px-0.5">
            <div>
              <h2 className="text-base sm:text-lg font-black text-[#18181B] tracking-tight">
                {coords ? 'Restaurants Near You' : 'Explore Restaurants'}
              </h2>
              <p className="text-[11px] text-slate-500">
                {coords
                  ? 'Sorted by straight-line distance from your location'
                  : 'Tap Detect GPS to sort by exact distance & delivery availability'}
              </p>
            </div>
            {!coords && (
              <button
                type="button"
                onClick={handleDetectLocation}
                disabled={detectingGps}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#D33401] hover:opacity-95 text-white text-xs font-extrabold shrink-0 cursor-pointer"
              >
                <LocateFixed className="w-3.5 h-3.5" />
                <span>Use GPS</span>
              </button>
            )}
          </div>

          {loadingNearby ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {[1, 2, 3, 4].map((idx) => (
                <div key={idx} className="bg-white rounded-3xl border border-[#EAE5DC] p-4 animate-pulse">
                  <div className="h-32 rounded-2xl bg-zinc-100 mb-3" />
                  <div className="h-4 w-2/3 bg-zinc-100 rounded mb-2" />
                  <div className="h-3 w-1/2 bg-zinc-100 rounded" />
                </div>
              ))}
            </div>
          ) : nearbyList.length === 0 ? (
            <div className="bg-white rounded-3xl border border-[#EAE5DC] p-6 text-center flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#FFF1EC] flex items-center justify-center text-[#D33401]">
                <Store className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-extrabold text-[#18181B]">No matching restaurants found nearby</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  Try clearing your search or dietary filters, or scan a restaurant QR code directly.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
                {(dietaryFilter !== 'all' || serviceFilter !== 'all' || searchQuery) && (
                  <button
                    type="button"
                    onClick={() => {
                      setDietaryFilter('all');
                      setServiceFilter('all');
                      setSearchQuery('');
                    }}
                    className="px-3.5 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-xs font-extrabold text-zinc-800 cursor-pointer"
                  >
                    Clear Filters
                  </button>
                )}
                <button
                  type="button"
                  onClick={onOpenScanner}
                  className="px-3.5 py-2 rounded-xl bg-[#D33401] text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Scan Table QR</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {nearbyList.map((rest) => {
                const imgSrc = rest.bannerImageUrl || rest.logoUrl;
                const isOpen = rest.isOpen !== false;
                const hasDist = typeof rest.distanceKm === 'number' && !isNaN(rest.distanceKm);
                const cuisinesText = Array.isArray(rest.cuisines) && rest.cuisines.length > 0
                  ? rest.cuisines.slice(0, 3).join(' · ')
                  : rest.city || 'Multi-Cuisine Kitchen';

                return (
                  <button
                    key={rest.restaurantId || rest.encryptedRestaurantId}
                    type="button"
                    onClick={() => handleOpenRestaurant(rest.encryptedRestaurantId)}
                    className="group text-left bg-white hover:border-[#D33401] rounded-3xl border border-[#EAE5DC] overflow-hidden shadow-xs transition-all cursor-pointer flex flex-col"
                  >
                    {/* Visual Banner */}
                    <div className="relative h-36 bg-gradient-to-br from-[#FFF1EC] via-[#FAF7F2] to-[#EAE5DC] overflow-hidden">
                      {imgSrc ? (
                        <img
                          src={imgSrc}
                          alt={rest.restaurantName}
                          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="w-14 h-14 rounded-2xl bg-white/90 border border-[#FFD8CB] flex items-center justify-center shadow-xs">
                            <Utensils className="w-6 h-6 text-[#D33401]" />
                          </div>
                        </div>
                      )}

                      {/* Top Overlays */}
                      <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold tracking-wide uppercase backdrop-blur-md ${
                            isOpen
                              ? 'bg-emerald-900/85 text-emerald-100'
                              : 'bg-zinc-900/80 text-zinc-200'
                          }`}
                        >
                          {isOpen ? 'Open Now' : rest.operatingStatus || 'Closed'}
                        </span>

                        {Number(rest.ratingCount || 0) > 0 && Number(rest.ratingAvg || 0) > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/95 text-[11px] font-extrabold text-[#18181B] shadow-xs">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                            <span>{Number(rest.ratingAvg).toFixed(1)}</span>
                          </span>
                        )}
                      </div>

                      {hasDist && (
                        <span className="absolute bottom-2.5 right-3 px-2.5 py-1 rounded-full bg-zinc-900/80 text-white text-[11px] font-bold backdrop-blur-md">
                          {Number(rest.distanceKm).toFixed(1)} km away
                        </span>
                      )}
                    </div>

                    {/* Restaurant Body */}
                    <div className="p-4 flex-1 flex flex-col justify-between gap-2.5">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm sm:text-base font-black text-[#18181B] leading-snug line-clamp-1">
                            {rest.restaurantName}
                          </h3>
                          <DietaryBadge dietaryType={rest.dietaryType} />
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{cuisinesText}</p>
                        {rest.address && (
                          <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{rest.address}</p>
                        )}
                      </div>

                      {/* Service & Fee Tags */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[#F4F1EA]">
                        {rest.isDeliveryEnabled ? (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10.5px] font-extrabold ${
                              hasDist && rest.isWithinDeliveryRadius === false
                                ? 'bg-zinc-100 text-zinc-500'
                                : 'bg-blue-50 text-blue-700'
                            }`}
                          >
                            <Bike className="w-3 h-3" />
                            <span>
                              {hasDist && rest.isWithinDeliveryRadius === false
                                ? `Beyond ${rest.deliveryRadiusKm || 5}km zone`
                                : Number(rest.deliveryFee || 0) > 0
                                ? `Delivery ₹${rest.deliveryFee}`
                                : 'Free Delivery'}
                            </span>
                          </span>
                        ) : null}

                        {rest.isDineInEnabled !== false && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#FFF1EC] text-[#D33401] text-[10.5px] font-extrabold">
                            <Utensils className="w-3 h-3" />
                            <span>Dine-In</span>
                          </span>
                        )}

                        <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-bold text-slate-500">
                          <Clock className="w-3 h-3" />
                          <span>~{rest.avgPrepTimeMinutes || 20}m</span>
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Responsive Split Hero + Interactive Mode Card */}
        <section className="grid grid-cols-1 md:grid-cols-12 gap-5 md:gap-7 items-center pt-1">
          {/* Editorial Hero Copy */}
          <div className="md:col-span-5 text-center md:text-left px-1 md:px-0">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF1EC] border border-[#FFD8CB] text-[#D33401] text-[10px] font-extrabold uppercase tracking-wider mb-3">
              <Sparkles className="w-3 h-3" />
              <span>Straight From The Kitchen</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#18181B] tracking-tight leading-tight">
              Fresh food,{' '}
              <span className="text-[#D33401]">real menu prices.</span>
            </h1>
            <p className="text-sm text-zinc-600 mt-2.5 leading-relaxed max-w-md mx-auto md:mx-0">
              Order at your table with zero wait time, or enjoy self-delivery at actual restaurant rates.
            </p>
          </div>

          {/* Interactive Mode Switcher & Link Card */}
          <div className="md:col-span-7 bg-white rounded-3xl border border-[#EAE5DC] p-4 sm:p-5 shadow-xs flex flex-col gap-3.5">
            {/* Segmented Mode Tabs */}
            <div className="grid grid-cols-3 bg-[#F4F1EA] rounded-xl p-1 gap-1" role="tablist">
              {(['dinein', 'delivery', 'takeaway'] as OrderModeKey[]).map((key) => {
                const cfg = MODE_CONFIG[key];
                const active = selectedMode === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setSelectedMode(key)}
                    className={`min-h-[42px] px-2 rounded-lg flex items-center justify-center gap-1.5 text-xs transition-all cursor-pointer ${
                      active
                        ? 'bg-white text-[#18181B] font-extrabold shadow-xs'
                        : 'text-slate-500 font-semibold hover:text-zinc-800'
                    }`}
                  >
                    {key === 'dinein' && (
                      <QrCode className="w-3.5 h-3.5 shrink-0" style={{ color: active ? cfg.accentHex : undefined }} />
                    )}
                    {key === 'delivery' && (
                      <Bike className="w-3.5 h-3.5 shrink-0" style={{ color: active ? cfg.accentHex : undefined }} />
                    )}
                    {key === 'takeaway' && (
                      <ShoppingBag className="w-3.5 h-3.5 shrink-0" style={{ color: active ? cfg.accentHex : undefined }} />
                    )}
                    <span className="truncate">{cfg.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Active Mode Details */}
            <div className={`${currentMode.panelBgClass} rounded-2xl p-4`}>
              <span className={`text-[10px] font-extrabold tracking-wider uppercase block ${currentMode.badgeTextClass}`}>
                {currentMode.badge}
              </span>
              <h2 className="text-lg font-extrabold text-[#18181B] mt-0.5 tracking-tight">
                {currentMode.title}
              </h2>
              <p className="text-xs text-zinc-600 mt-1 leading-relaxed">
                {currentMode.hint}
              </p>

              {/* Desktop/Tablet Inline Primary CTA (Phones use Thumb Dock below) */}
              <button
                type="button"
                onClick={onOpenScanner}
                style={{ backgroundColor: currentMode.accentHex }}
                className="hidden md:flex mt-3.5 w-full h-12 rounded-xl text-white font-extrabold text-sm items-center justify-center gap-2 shadow-sm hover:opacity-95 active:scale-[0.99] transition-all cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>{currentMode.ctaLabel}</span>
              </button>
            </div>

            {/* Quick Link / Store Code Form */}
            <form onSubmit={(e) => handleSubmitLink(e)} className="flex flex-col gap-2">
              <label htmlFor="menza-link-input" className="flex items-center gap-1.5 text-xs font-bold text-zinc-700">
                <Link2 className="w-3.5 h-3.5 text-slate-500" />
                <span>Have a menu link or store ID?</span>
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  id="menza-link-input"
                  type="text"
                  value={linkInput}
                  onChange={(e) => {
                    setLinkInput(e.target.value);
                    if (linkError) setLinkError('');
                  }}
                  placeholder="Paste link or ID (e.g. mzs_...)"
                  className="flex-1 min-w-0 h-11 px-3 rounded-xl bg-[#FAF7F2] border border-[#E4E0D8] text-xs sm:text-sm text-[#18181B] placeholder:text-slate-400 focus:border-[#D33401] outline-none"
                />
                <button
                  type="button"
                  onClick={handlePasteFromClipboard}
                  className="h-11 px-3 rounded-xl bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 text-xs font-bold text-zinc-700 flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
                >
                  <ClipboardPaste className="w-3.5 h-3.5" />
                  <span>Paste</span>
                </button>
                <button
                  type="submit"
                  disabled={submittingLink}
                  aria-label="Open menu link"
                  className={`w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0 cursor-pointer transition-colors ${
                    linkInput.trim() ? 'bg-[#18181B] hover:bg-zinc-800' : 'bg-slate-400'
                  }`}
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
              {linkError && (
                <p className="text-xs font-semibold text-red-600">{linkError}</p>
              )}
            </form>
          </div>
        </section>

        {/* Compact Responsive 2x2 / 4-col Value Bento */}
        <section className="flex flex-col gap-2.5">
          <h3 className="text-sm font-extrabold text-zinc-700 px-0.5">
            Why diners prefer MenzaOrder
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
            <div className="bg-white rounded-2xl border border-[#EAE5DC] p-3.5 flex flex-col gap-1.5">
              <div className="w-8 h-8 rounded-lg bg-[#FFF1EC] text-[#D33401] flex items-center justify-center">
                <Tag className="w-4 h-4" />
              </div>
              <h4 className="text-xs sm:text-sm font-extrabold text-[#18181B]">Real Menu Prices</h4>
              <p className="text-[11px] sm:text-xs text-slate-500 leading-snug">
                Pay printed restaurant rates — zero 30% app markups.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-[#EAE5DC] p-3.5 flex flex-col gap-1.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
              <h4 className="text-xs sm:text-sm font-extrabold text-[#18181B]">Live Kitchen Sync</h4>
              <p className="text-[11px] sm:text-xs text-slate-500 leading-snug">
                Real-time preparation updates directly from the chef.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-[#EAE5DC] p-3.5 flex flex-col gap-1.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h4 className="text-xs sm:text-sm font-extrabold text-[#18181B]">Secure Online Checkout</h4>
              <p className="text-[11px] sm:text-xs text-slate-500 leading-snug">
                Fast, verified UPI, card, and NetBanking payments via Razorpay &amp; Cashfree.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-[#EAE5DC] p-3.5 flex flex-col gap-1.5">
              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                <Receipt className="w-4 h-4" />
              </div>
              <h4 className="text-xs sm:text-sm font-extrabold text-[#18181B]">5% Delivery GST</h4>
              <p className="text-[11px] sm:text-xs text-slate-500 leading-snug">
                Self-delivery saves you 18% aggregator delivery tax.
              </p>
            </div>
          </div>
        </section>

        {/* Subtle Partner Callout */}
        <button
          type="button"
          onClick={handlePartnerContact}
          className="w-full text-left bg-white hover:bg-zinc-50 border border-[#EAE5DC] rounded-2xl p-3.5 flex items-center justify-between gap-3 transition-colors cursor-pointer"
        >
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-extrabold text-[#18181B]">Own a restaurant or cafe?</p>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
              Launch 0%-commission QR dining &amp; direct delivery
            </p>
          </div>
          <span className="flex items-center gap-1 bg-[#FFF1EC] text-[#D33401] px-3 py-2 rounded-xl text-xs font-extrabold shrink-0">
            <span>Partner</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </button>

        <p className="text-[11px] text-slate-400 text-center">
          © 2026 MenzaOrder · Direct Restaurant Tech
        </p>
      </main>

      {/* Mobile Thumb-Zone Sticky Bottom Dock */}
      <div
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#EAE5DC] px-4 pt-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]"
        style={{ paddingBottom: 'max(14px, env(safe-area-inset-bottom, 14px))' }}
      >
        <button
          type="button"
          onClick={onOpenScanner}
          style={{ backgroundColor: currentMode.accentHex }}
          className="w-full h-13 rounded-2xl text-white font-extrabold text-sm flex items-center justify-center gap-2.5 shadow-md active:scale-[0.98] transition-all cursor-pointer"
        >
          <Camera className="w-5 h-5" />
          <span>{currentMode.ctaLabel}</span>
        </button>
      </div>
    </div>
  );
}
