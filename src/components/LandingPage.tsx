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
  Map as MapIcon,
  PowerOff,
} from 'lucide-react';
import * as api from '../services/api';
import { NearbyRestaurantCard } from '../types';
import ExploreMapSearch from './ExploreMapSearch';

const GPS_DISCONNECTED_KEY = 'menza_gps_disconnected';

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

const TEMPORARY_RESTAURANT_PHOTOS = [
  '/images/restaurants/restaurant-indian-veg.jpg',
  '/images/restaurants/restaurant-tandoor-grill.jpg',
  '/images/restaurants/restaurant-cafe-bistro.jpg',
  '/images/restaurants/restaurant-dining-ambience.jpg',
  '/images/restaurants/restaurant-fine-dining.jpg',
  '/images/restaurants/restaurant-modern-kitchen.jpg',
] as const;

function cleanImageUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (
    !trimmed ||
    trimmed.toLowerCase() === 'null' ||
    trimmed.toLowerCase() === 'undefined' ||
    trimmed === api.IMAGE_NOT_AVAILABLE
  ) {
    return '';
  }
  return trimmed;
}

function getTemporaryRestaurantPhoto(rest: NearbyRestaurantCard, index: number): string {
  const nameAndCuisines = [
    rest.restaurantName || '',
    ...(Array.isArray(rest.cuisines) ? rest.cuisines : []),
  ]
    .join(' ')
    .toLowerCase();
  const dietary = String(rest.dietaryType || '').toLowerCase();

  if (/(cafe|caffee|coffee|bakery|pizza|bistro|pasta|dessert|tea|brew)/.test(nameAndCuisines)) {
    return index % 2 === 0
      ? '/images/restaurants/restaurant-cafe-bistro.jpg'
      : '/images/restaurants/restaurant-modern-kitchen.jpg';
  }
  if (dietary === 'veg' || dietary === 'pureveg' || dietary === 'pure veg') {
    return '/images/restaurants/restaurant-indian-veg.jpg';
  }
  if (
    dietary === 'nonveg' ||
    dietary === 'non-veg' ||
    dietary === 'non veg' ||
    /(biryani|tandoor|grill|kebab|mughlai|barbecue|bbq)/.test(nameAndCuisines)
  ) {
    return '/images/restaurants/restaurant-tandoor-grill.jpg';
  }

  const seed = Number(rest.restaurantId || 0) > 0 ? Number(rest.restaurantId) + index : index;
  return TEMPORARY_RESTAURANT_PHOTOS[Math.abs(seed) % TEMPORARY_RESTAURANT_PHOTOS.length];
}

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
    panelBgClass: 'bg-[#FFF3EE] border border-[#FFDCD0]',
    badgeTextClass: 'text-[#D33401]',
    ctaLabel: 'Scan Table QR Code',
  },
  delivery: {
    label: 'Delivery',
    badge: 'DIRECT SELF-DELIVERY',
    title: 'Order at true menu prices',
    hint: 'Explore nearby restaurants below or paste a shared Menza link — zero 30% app markups.',
    accentHex: '#2563EB',
    panelBgClass: 'bg-blue-50/90 border border-blue-100',
    badgeTextClass: 'text-blue-600',
    ctaLabel: 'Scan Restaurant QR',
  },
  takeaway: {
    label: 'Takeaway',
    badge: 'SKIP THE COUNTER LINE',
    title: 'Pre-order & pick up hot',
    hint: 'Open the restaurant menu via QR or shared link, place your order ahead, and collect fresh from the counter.',
    accentHex: '#059669',
    panelBgClass: 'bg-emerald-50/90 border border-emerald-100',
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
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-[10px] font-extrabold text-emerald-700 shrink-0">
        <span className="w-2.5 h-2.5 rounded-[3px] border border-emerald-600 flex items-center justify-center">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
        </span>
        Pure Veg
      </span>
    );
  }

  if (isNonVeg) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50 border border-red-200 text-[10px] font-extrabold text-red-700 shrink-0">
        <span className="w-2.5 h-2.5 rounded-[3px] border border-red-600 flex items-center justify-center">
          <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
        </span>
        Non-Veg
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-[10px] font-bold text-amber-800 shrink-0">
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
    if (typeof localStorage !== 'undefined' && localStorage.getItem(GPS_DISCONNECTED_KEY) === 'true') {
      return null;
    }
    const cached = api.getLastCustomerLocation();
    return cached ? { lat: cached.lat, lng: cached.lng, label: cached.label || cached.city || 'Saved GPS' } : null;
  });
  const [detectingGps, setDetectingGps] = useState(false);
  const [gpsStatusMsg, setGpsStatusMsg] = useState('');
  const [showMapSearch, setShowMapSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [dietaryFilter, setDietaryFilter] = useState<DietaryFilter>('all');
  const [serviceFilter, setServiceFilter] = useState<ServiceFilter>('all');
  const [nearbyList, setNearbyList] = useState<NearbyRestaurantCard[]>([]);
  const [loadingNearby, setLoadingNearby] = useState(true);
  const [recentRestaurants, setRecentRestaurants] = useState<any[]>(() => api.getRecentRestaurants());
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

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

  // Silently check existing browser geolocation permission unless user explicitly turned GPS off
  useEffect(() => {
    if (typeof localStorage !== 'undefined' && localStorage.getItem(GPS_DISCONNECTED_KEY) === 'true') {
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.permissions || !navigator.geolocation) return;
    navigator.permissions
      .query({ name: 'geolocation' as PermissionName })
      .then((res) => {
        if (typeof localStorage !== 'undefined' && localStorage.getItem(GPS_DISCONNECTED_KEY) === 'true') {
          return;
        }
        if (res.state === 'granted') {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              if (typeof localStorage !== 'undefined' && localStorage.getItem(GPS_DISCONNECTED_KEY) === 'true') {
                return;
              }
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
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(GPS_DISCONNECTED_KEY);
      } catch {}
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

  const handleDisconnectGps = useCallback(() => {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(GPS_DISCONNECTED_KEY, 'true');
      } catch {}
    }
    api.clearLastCustomerLocation();
    setDetectingGps(false);
    setCoords(null);
    setGpsStatusMsg('');
  }, []);

  const handleSelectMapLocation = useCallback((loc: { lat: number; lng: number; label: string; city?: string }) => {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(GPS_DISCONNECTED_KEY);
      } catch {}
    }
    const next = {
      lat: Number(loc.lat.toFixed(6)),
      lng: Number(loc.lng.toFixed(6)),
      label: loc.label || loc.city || 'Map Pin',
    };
    setCoords(next);
    api.saveLastCustomerLocation({ ...next, city: loc.city || '' });
    setGpsStatusMsg('');
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

  const markImageFailed = (key: string) => {
    setFailedImages((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#18181B] flex flex-col justify-between pt-16 pb-24 md:pb-8">
      {/* Fixed Top Bar - Always stays pinned while the page scrolls */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-b border-[#EAE5DC] shadow-[0_1px_8px_rgba(24,24,27,0.04)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#E24410] to-[#B82D01] flex items-center justify-center shadow-sm shrink-0">
              <Utensils className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <span className="text-lg sm:text-xl font-black tracking-tight text-[#18181B] block leading-none truncate">
                Menza<span className="text-[#D33401]">Order</span>
              </span>
              <span className="hidden sm:block text-[10px] font-bold text-zinc-500 tracking-widest uppercase mt-1">
                Direct Dining &amp; Delivery
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {coords ? (
              <button
                type="button"
                onClick={handleDisconnectGps}
                title="Disconnect current GPS"
                aria-label={`Disconnect ${coords.label}`}
                className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full border bg-[#FFF1EC] hover:bg-red-50 border-[#FFD8CB] hover:border-red-200 text-[#D33401] hover:text-red-700 text-xs font-bold transition-all cursor-pointer shadow-2xs"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 group-hover:bg-red-500 shrink-0 transition-colors" />
                <span className="max-w-[115px] truncate">{coords.label}</span>
                <span className="w-4 h-4 rounded-full bg-white/80 group-hover:bg-red-100 flex items-center justify-center shrink-0">
                  <X className="w-3 h-3" />
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleDetectLocation}
                disabled={detectingGps}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-xs font-bold transition-all cursor-pointer bg-zinc-50 hover:bg-zinc-100 border-[#E4E0D8] text-zinc-700"
              >
                {detectingGps ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                ) : (
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                )}
                <span className="max-w-[120px] truncate">
                  {detectingGps ? 'Locating...' : 'Detect GPS'}
                </span>
              </button>
            )}

            {activeOrderId ? (
              <button
                onClick={() => onTrackOrder && onTrackOrder(activeOrderId)}
                className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-3.5 py-2 rounded-full text-xs font-extrabold transition-colors cursor-pointer shrink-0"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                <span className="truncate max-w-[105px]">Track #{activeOrderId}</span>
                <ChevronRight className="w-3.5 h-3.5 shrink-0" />
              </button>
            ) : (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FFF1EC] border border-[#FFD8CB] text-[#D33401] text-[11px] font-extrabold shrink-0">
                <Tag className="w-3 h-3" />
                0% Markup
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-7 sm:gap-9">
        {/* Invalid Restaurant Banner */}
        {isInvalidRestaurant && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3 shadow-2xs">
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
            className="w-full text-left flex items-center justify-between gap-4 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 rounded-2xl p-4 transition-colors cursor-pointer shadow-2xs"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 text-emerald-700" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-emerald-950 truncate">
                  Order #{activeOrderId} is {activeOrder?.orderStatus || 'Active'}
                </p>
                <p className="text-xs text-emerald-700 truncate mt-0.5">
                  Tap to view live kitchen progress &amp; bill
                </p>
              </div>
            </div>
            <span className="flex items-center gap-1 bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-extrabold shrink-0 shadow-xs">
              <span>Track</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </button>
        )}

        {/* Hero Showcase + Interactive Mode Switcher */}
        <section className="bg-gradient-to-br from-white via-[#FFFDF9] to-[#FFF4EC] rounded-3xl border border-[#EAE5DC] p-5 sm:p-7 lg:p-8 shadow-sm">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
            {/* Editorial Hero Copy */}
            <div className="lg:col-span-5 text-center lg:text-left flex flex-col items-center lg:items-start">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF1EC] border border-[#FFD8CB] text-[#D33401] text-[10.5px] font-extrabold uppercase tracking-wider mb-3.5">
                <Sparkles className="w-3 h-3" />
                <span>Straight From The Kitchen</span>
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-[34px] font-black text-[#18181B] tracking-tight leading-[1.15]">
                Fresh food,{' '}
                <span className="text-[#D33401]">real menu prices.</span>
              </h1>
              <p className="text-sm sm:text-[15px] text-zinc-600 mt-3 leading-relaxed max-w-md">
                Order at your table with zero wait time, or enjoy self-delivery at actual restaurant rates.
              </p>

              <div className="mt-5 flex flex-wrap items-center justify-center lg:justify-start gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-[#EAE5DC] text-[11px] font-bold text-zinc-700 shadow-2xs">
                  <Tag className="w-3 h-3 text-[#D33401]" />
                  Zero 30% Markups
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-[#EAE5DC] text-[11px] font-bold text-zinc-700 shadow-2xs">
                  <Clock className="w-3 h-3 text-blue-600" />
                  Live Kitchen Sync
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-[#EAE5DC] text-[11px] font-bold text-zinc-700 shadow-2xs">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  Verified Payments
                </span>
              </div>
            </div>

            {/* Interactive Mode Switcher & Link Card */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-[#EAE5DC] p-4 sm:p-5 shadow-xs flex flex-col gap-4">
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
                      className={`min-h-[42px] px-2.5 rounded-lg flex items-center justify-center gap-1.5 text-xs transition-all cursor-pointer ${
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
              <div className={`${currentMode.panelBgClass} rounded-xl p-4 sm:p-5 transition-colors`}>
                <span className={`text-[10px] font-extrabold tracking-wider uppercase block ${currentMode.badgeTextClass}`}>
                  {currentMode.badge}
                </span>
                <h2 className="text-lg font-extrabold text-[#18181B] mt-1 tracking-tight">
                  {currentMode.title}
                </h2>
                <p className="text-xs sm:text-[13px] text-zinc-600 mt-1.5 leading-relaxed">
                  {currentMode.hint}
                </p>

                {/* Desktop/Tablet Inline Primary CTA (Phones use Thumb Dock below) */}
                <button
                  type="button"
                  onClick={onOpenScanner}
                  style={{ backgroundColor: currentMode.accentHex }}
                  className="hidden md:flex mt-4 w-full h-11 rounded-xl text-white font-extrabold text-sm items-center justify-center gap-2 shadow-sm hover:opacity-95 active:scale-[0.99] transition-all cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>{currentMode.ctaLabel}</span>
                </button>
              </div>

              {/* Quick Link / Store Code Form */}
              <form onSubmit={(e) => handleSubmitLink(e)} className="flex flex-col gap-2 pt-0.5">
                <label htmlFor="menza-link-input" className="flex items-center gap-1.5 text-xs font-bold text-zinc-700">
                  <Link2 className="w-3.5 h-3.5 text-slate-500" />
                  <span>Have a menu link or store ID?</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="menza-link-input"
                    type="text"
                    value={linkInput}
                    onChange={(e) => {
                      setLinkInput(e.target.value);
                      if (linkError) setLinkError('');
                    }}
                    placeholder="Paste link or ID (e.g. mzs_...)"
                    className="flex-1 min-w-0 h-11 px-3.5 rounded-xl bg-[#FAF7F2] border border-[#E4E0D8] text-xs sm:text-sm text-[#18181B] placeholder:text-slate-400 focus:border-[#D33401] focus:bg-white transition-colors outline-none"
                  />
                  <button
                    type="button"
                    onClick={handlePasteFromClipboard}
                    className="h-11 px-3.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 border border-[#E4E0D8] text-xs font-bold text-zinc-700 flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
                  >
                    <ClipboardPaste className="w-3.5 h-3.5" />
                    <span>Paste</span>
                  </button>
                  <button
                    type="submit"
                    disabled={submittingLink}
                    aria-label="Open menu link"
                    className={`w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0 cursor-pointer transition-colors ${
                      linkInput.trim() ? 'bg-[#18181B] hover:bg-zinc-800' : 'bg-slate-400 hover:bg-slate-500'
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
          </div>
        </section>

        {/* Search & Dietary / Service Discovery Toolbar */}
        <section className="bg-white rounded-2xl border border-[#EAE5DC] p-3.5 sm:p-4 shadow-xs flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 flex items-center min-w-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-4 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search restaurants, cuisines, or city..."
                className="w-full h-12 pl-11 pr-10 rounded-xl bg-[#FAF7F2] border border-[#E4E0D8] text-sm text-[#18181B] placeholder:text-slate-400 focus:border-[#D33401] focus:bg-white transition-colors outline-none"
              />
              {searchQuery.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute right-3 p-1.5 rounded-full hover:bg-zinc-200/70 text-slate-500 cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowMapSearch((prev) => !prev)}
              aria-expanded={showMapSearch}
              className={`h-12 px-3.5 sm:px-4 rounded-xl border text-xs sm:text-sm font-extrabold flex items-center gap-2 shrink-0 cursor-pointer transition-all ${
                showMapSearch
                  ? 'bg-[#18181B] text-white border-[#18181B] shadow-xs'
                  : 'bg-[#FFF1EC] hover:bg-[#FFE4DA] text-[#D33401] border-[#FFD8CB]'
              }`}
            >
              <MapIcon className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">{showMapSearch ? 'Hide Map' : 'Search Map'}</span>
              <span className="sm:hidden">{showMapSearch ? 'Hide' : 'Map'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-0.5 no-scrollbar">
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
                  className={`h-9 px-3.5 rounded-full text-xs font-extrabold flex items-center gap-1.5 shrink-0 border transition-all cursor-pointer ${
                    active
                      ? f.id === 'veg'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                        : f.id === 'nonveg'
                        ? 'bg-red-600 text-white border-red-600 shadow-2xs'
                        : 'bg-[#18181B] text-white border-[#18181B] shadow-2xs'
                      : 'bg-[#FAF7F2] text-zinc-700 border-[#E4E0D8] hover:bg-zinc-100'
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

            <span className="h-5 w-px bg-[#E4E0D8] shrink-0 mx-1" />

            {/* Service Mode Chips */}
            <button
              type="button"
              onClick={() => setServiceFilter(serviceFilter === 'delivery' ? 'all' : 'delivery')}
              className={`h-9 px-3.5 rounded-full text-xs font-extrabold flex items-center gap-1.5 shrink-0 border transition-all cursor-pointer ${
                serviceFilter === 'delivery'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                  : 'bg-[#FAF7F2] text-zinc-700 border-[#E4E0D8] hover:bg-zinc-100'
              }`}
            >
              <Bike className="w-3.5 h-3.5" />
              <span>Delivery</span>
            </button>

            <button
              type="button"
              onClick={() => setServiceFilter(serviceFilter === 'dinein' ? 'all' : 'dinein')}
              className={`h-9 px-3.5 rounded-full text-xs font-extrabold flex items-center gap-1.5 shrink-0 border transition-all cursor-pointer ${
                serviceFilter === 'dinein'
                  ? 'bg-[#D33401] text-white border-[#D33401] shadow-2xs'
                  : 'bg-[#FAF7F2] text-zinc-700 border-[#E4E0D8] hover:bg-zinc-100'
              }`}
            >
              <Utensils className="w-3.5 h-3.5" />
              <span>Dine-In</span>
            </button>
          </div>

          {gpsStatusMsg && (
            <p className="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2">
              {gpsStatusMsg}
            </p>
          )}
        </section>

        {/* Recently Visited Strip */}
        {recentRestaurants.length > 0 && (
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-0.5">
              <h2 className="text-sm sm:text-base font-black text-[#18181B] tracking-tight">Recently Visited</h2>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Order Again</span>
            </div>
            <div className="flex items-stretch gap-3 overflow-x-auto pb-1 no-scrollbar">
              {recentRestaurants.map((rec: any, recIdx: number) => {
                const recKey = `rec-${rec.encryptedRestaurantId || rec.restaurantId || recIdx}`;
                const rawRecLogo = cleanImageUrl(rec.logoUrl);
                const useFallbackRecLogo = !rawRecLogo || Boolean(failedImages[recKey]);
                const recLogoSrc = useFallbackRecLogo
                  ? '/images/restaurants/default-restaurant-logo.svg'
                  : rawRecLogo;
                return (
                  <button
                    key={rec.encryptedRestaurantId || rec.restaurantId || recIdx}
                    type="button"
                    onClick={() => handleOpenRestaurant(rec.encryptedRestaurantId)}
                    className="min-w-[225px] max-w-[250px] bg-white hover:border-[#D33401]/60 hover:shadow-sm border border-[#EAE5DC] rounded-2xl p-3 flex items-center gap-3 text-left shrink-0 transition-all cursor-pointer shadow-2xs"
                  >
                    <div className="w-12 h-12 rounded-xl bg-[#FFF1EC] border border-[#FFD8CB] overflow-hidden flex items-center justify-center shrink-0">
                      <img
                        src={recLogoSrc}
                        alt={rec.restaurantName || 'Restaurant logo'}
                        onError={() => {
                          if (!useFallbackRecLogo) {
                            markImageFailed(recKey);
                          }
                        }}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-extrabold text-[#18181B] truncate">{rec.restaurantName}</p>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {rec.city || (rec.isDeliveryEnabled ? 'Delivery & Dine-In' : 'Dine-In')}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Interactive Map Search Panel */}
        {showMapSearch && (
          <ExploreMapSearch
            coords={coords}
            detectingGps={detectingGps}
            restaurantCount={nearbyList.length}
            loadingRestaurants={loadingNearby}
            onSelectMapLocation={handleSelectMapLocation}
            onDetectGps={handleDetectLocation}
            onDisconnectGps={handleDisconnectGps}
            onClose={() => setShowMapSearch(false)}
          />
        )}

        {/* Nearby & Featured Restaurants Grid */}
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3 px-0.5">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg sm:text-xl font-black text-[#18181B] tracking-tight">
                  {coords ? 'Restaurants Near You' : 'Explore Restaurants'}
                </h2>
                {!loadingNearby && nearbyList.length > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full bg-white border border-[#EAE5DC] text-[11px] font-bold text-slate-600 shadow-2xs">
                    {nearbyList.length} {nearbyList.length === 1 ? 'place' : 'places'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {coords
                  ? `Showing results near ${coords.label} · Click Turn Off GPS to view all restaurants`
                  : 'Tap Use GPS or Search on Map to sort by distance & delivery availability'}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowMapSearch((prev) => !prev)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-extrabold cursor-pointer shadow-2xs transition-colors ${
                  showMapSearch
                    ? 'bg-[#18181B] text-white border-[#18181B]'
                    : 'bg-white hover:bg-zinc-50 text-zinc-800 border-[#EAE5DC]'
                }`}
              >
                <MapIcon className="w-3.5 h-3.5" />
                <span>{showMapSearch ? 'Hide Map' : 'Search on Map'}</span>
              </button>

              {coords ? (
                <button
                  type="button"
                  onClick={handleDisconnectGps}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-extrabold cursor-pointer transition-colors"
                >
                  <PowerOff className="w-3.5 h-3.5" />
                  <span>Turn Off GPS</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleDetectLocation}
                  disabled={detectingGps}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#D33401] hover:bg-[#b82d01] text-white text-xs font-extrabold cursor-pointer shadow-xs transition-colors"
                >
                  <LocateFixed className="w-3.5 h-3.5" />
                  <span>Use GPS</span>
                </button>
              )}
            </div>
          </div>

          {loadingNearby ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3, 4, 5, 6].map((idx) => (
                <div key={idx} className="bg-white rounded-2xl border border-[#EAE5DC] overflow-hidden animate-pulse">
                  <div className="aspect-[16/10] bg-zinc-100" />
                  <div className="p-4 flex flex-col gap-2.5">
                    <div className="h-4 w-2/3 bg-zinc-100 rounded" />
                    <div className="h-3 w-1/2 bg-zinc-100 rounded" />
                    <div className="h-6 w-full bg-zinc-50 rounded mt-2" />
                  </div>
                </div>
              ))}
            </div>
          ) : nearbyList.length === 0 ? (
            <div className="bg-white rounded-3xl border border-[#EAE5DC] p-8 text-center flex flex-col items-center gap-3.5 shadow-xs">
              <div className="w-14 h-14 rounded-2xl bg-[#FFF1EC] border border-[#FFD8CB] flex items-center justify-center text-[#D33401]">
                <Store className="w-6 h-6" />
              </div>
              <div>
                <p className="text-base font-extrabold text-[#18181B]">No matching restaurants found nearby</p>
                <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-md mx-auto">
                  Try clearing your search or dietary filters, or scan a restaurant QR code directly.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2.5 mt-1">
                {(dietaryFilter !== 'all' || serviceFilter !== 'all' || searchQuery) && (
                  <button
                    type="button"
                    onClick={() => {
                      setDietaryFilter('all');
                      setServiceFilter('all');
                      setSearchQuery('');
                    }}
                    className="px-4 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-xs font-extrabold text-zinc-800 cursor-pointer transition-colors"
                  >
                    Clear Filters
                  </button>
                )}
                <button
                  type="button"
                  onClick={onOpenScanner}
                  className="px-4 py-2.5 rounded-xl bg-[#D33401] hover:bg-[#b82d01] text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Scan Table QR</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {nearbyList.map((rest, idx) => {
                const rawImgSrc =
                  cleanImageUrl(rest.bannerImageUrl) || cleanImageUrl(rest.logoUrl);
                const imgKey = `${rest.restaurantId || rest.encryptedRestaurantId || idx}:${rawImgSrc || 'none'}`;
                const useFallbackPhoto = !rawImgSrc || Boolean(failedImages[imgKey]);
                const fallbackPhoto = getTemporaryRestaurantPhoto(rest, idx);
                const imgSrc = useFallbackPhoto ? fallbackPhoto : rawImgSrc;

                const isOpen = rest.isOpen !== false;
                const hasDist = typeof rest.distanceKm === 'number' && !isNaN(rest.distanceKm);
                const cuisinesText =
                  Array.isArray(rest.cuisines) && rest.cuisines.length > 0
                    ? rest.cuisines.slice(0, 3).join(' · ')
                    : rest.city || 'Multi-Cuisine Kitchen';

                return (
                  <button
                    key={rest.restaurantId || rest.encryptedRestaurantId || idx}
                    type="button"
                    onClick={() => handleOpenRestaurant(rest.encryptedRestaurantId)}
                    className="group text-left bg-white hover:border-[#D33401]/60 rounded-2xl border border-[#EAE5DC] overflow-hidden shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer flex flex-col h-full"
                  >
                    {/* Visual Banner */}
                    <div className="relative aspect-[16/10] w-full bg-[#F3EFE8] overflow-hidden shrink-0">
                      <img
                        src={imgSrc}
                        alt={rest.restaurantName}
                        loading="lazy"
                        onError={() => {
                          if (!useFallbackPhoto) {
                            markImageFailed(imgKey);
                          }
                        }}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />

                      {/* Subtle Editorial Scrim */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-black/15 pointer-events-none" />

                      {/* Top Overlays */}
                      <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold tracking-wide uppercase backdrop-blur-md shadow-xs ${
                            isOpen
                              ? 'bg-emerald-950/80 text-emerald-100 border border-emerald-400/25'
                              : 'bg-zinc-900/80 text-zinc-200 border border-white/10'
                          }`}
                        >
                          {isOpen && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                          {isOpen ? 'Open Now' : rest.operatingStatus || 'Closed'}
                        </span>

                        {Number(rest.ratingAvg || 0) > 0 && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/95 text-[11px] font-extrabold text-[#18181B] shadow-xs">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                            <span>{Number(rest.ratingAvg).toFixed(1)}</span>
                          </span>
                        )}
                      </div>

                      {/* Bottom Overlays */}
                      <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between gap-2">
                        {rest.city ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/55 text-white/95 text-[10.5px] font-semibold backdrop-blur-sm truncate max-w-[60%]">
                            <MapPin className="w-2.5 h-2.5 shrink-0 text-[#FFD8CB]" />
                            <span className="truncate">{rest.city}</span>
                          </span>
                        ) : (
                          <span />
                        )}

                        {hasDist && (
                          <span className="px-2.5 py-0.5 rounded-full bg-zinc-950/80 text-white text-[10.5px] font-bold backdrop-blur-md shrink-0">
                            {Number(rest.distanceKm).toFixed(1)} km away
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Restaurant Body */}
                    <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-[15px] font-black text-[#18181B] leading-snug line-clamp-1 group-hover:text-[#D33401] transition-colors">
                            {rest.restaurantName}
                          </h3>
                          <DietaryBadge dietaryType={rest.dietaryType} />
                        </div>
                        <p className="text-xs font-medium text-slate-600 line-clamp-1">{cuisinesText}</p>
                        {rest.address && (
                          <p className="text-[11px] text-slate-400 line-clamp-1">{rest.address}</p>
                        )}
                      </div>

                      {/* Service & Fee Tags */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-[#F4F1EA]">
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

        {/* Compact Responsive 2x2 / 4-col Value Bento */}
        <section className="flex flex-col gap-3">
          <div className="px-0.5">
            <h3 className="text-sm sm:text-base font-black text-[#18181B] tracking-tight">
              Why diners prefer MenzaOrder
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-white rounded-2xl border border-[#EAE5DC] p-4 sm:p-5 flex flex-col gap-2 shadow-2xs">
              <div className="w-9 h-9 rounded-xl bg-[#FFF1EC] text-[#D33401] flex items-center justify-center">
                <Tag className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-extrabold text-[#18181B]">Real Menu Prices</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Pay printed restaurant rates — zero 30% app markups.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-[#EAE5DC] p-4 sm:p-5 flex flex-col gap-2 shadow-2xs">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-extrabold text-[#18181B]">Live Kitchen Sync</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Real-time preparation updates directly from the chef.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-[#EAE5DC] p-4 sm:p-5 flex flex-col gap-2 shadow-2xs">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-extrabold text-[#18181B]">Secure Online Checkout</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Fast, verified UPI, card, and NetBanking payments via Razorpay &amp; Cashfree.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-[#EAE5DC] p-4 sm:p-5 flex flex-col gap-2 shadow-2xs">
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Receipt className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-extrabold text-[#18181B]">5% Delivery GST</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Self-delivery saves you 18% aggregator delivery tax.
              </p>
            </div>
          </div>
        </section>

        {/* Partner Callout */}
        <button
          type="button"
          onClick={handlePartnerContact}
          className="w-full text-left bg-white hover:bg-[#FFFDFB] border border-[#EAE5DC] hover:border-[#D33401]/40 rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4 transition-all cursor-pointer shadow-xs"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#FFF1EC] border border-[#FFD8CB] flex items-center justify-center text-[#D33401] shrink-0">
              <Store className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-extrabold text-[#18181B]">Own a restaurant or cafe?</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Launch 0%-commission QR dining &amp; direct delivery
              </p>
            </div>
          </div>
          <span className="flex items-center gap-1 bg-[#FFF1EC] text-[#D33401] border border-[#FFD8CB] px-3.5 py-2 rounded-xl text-xs font-extrabold shrink-0">
            <span>Partner</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </button>

        <footer className="pt-2 pb-4 border-t border-[#EAE5DC]/70 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-400">
          <span>© 2026 MenzaOrder · Direct Restaurant Tech</span>
          <span>Zero Commission QR Dining &amp; Self-Delivery</span>
        </footer>
      </main>

      {/* Mobile Thumb-Zone Sticky Bottom Dock */}
      <div
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#EAE5DC] px-4 pt-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]"
        style={{ paddingBottom: 'max(14px, env(safe-area-inset-bottom, 14px))' }}
      >
        <button
          type="button"
          onClick={onOpenScanner}
          style={{ backgroundColor: currentMode.accentHex }}
          className="w-full h-12 rounded-2xl text-white font-extrabold text-sm flex items-center justify-center gap-2.5 shadow-md active:scale-[0.98] transition-all cursor-pointer"
        >
          <Camera className="w-5 h-5" />
          <span>{currentMode.ctaLabel}</span>
        </button>
      </div>
    </div>
  );
}
