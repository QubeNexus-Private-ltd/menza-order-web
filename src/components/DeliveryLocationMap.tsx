import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface DeliveryLocationMapProps {
  latitude: number;
  longitude: number;
  restaurantLat?: number | null;
  restaurantLng?: number | null;
  restaurantName?: string;
  onChangeLocation?: (lat: number, lng: number) => void;
  height?: number;
}

const createPinIcon = (color: string, label: string) =>
  L.divIcon({
    className: 'menza-custom-map-pin',
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);">
        <div style="background:${color};color:#fff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:999px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.28);margin-bottom:2px;font-family:system-ui,-apple-system,sans-serif;">
          ${label}
        </div>
        <svg width="26" height="32" viewBox="0 0 24 30" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.32));">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 8.25 12 18 12 18s12-9.75 12-18c0-6.63-5.37-12-12-12z" fill="${color}"/>
          <circle cx="12" cy="11.5" r="4.5" fill="#ffffff"/>
        </svg>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });

export default function DeliveryLocationMap({
  latitude,
  longitude,
  restaurantLat,
  restaurantLng,
  restaurantName,
  onChangeLocation,
  height = 195,
}: DeliveryLocationMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const deliveryMarkerRef = useRef<L.Marker | null>(null);
  const restaurantMarkerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChangeLocation);

  useEffect(() => {
    onChangeRef.current = onChangeLocation;
  }, [onChangeLocation]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [latitude, longitude],
      zoom: 16,
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker([latitude, longitude], {
      draggable: Boolean(onChangeRef.current),
      icon: createPinIcon('#2563eb', 'Delivery'),
    }).addTo(map);

    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      if (onChangeRef.current) {
        onChangeRef.current(Number(pos.lat.toFixed(6)), Number(pos.lng.toFixed(6)));
      }
    });

    map.on('click', (e: L.LeafletMouseEvent) => {
      const lat = Number(e.latlng.lat.toFixed(6));
      const lng = Number(e.latlng.lng.toFixed(6));
      marker.setLatLng([lat, lng]);
      if (onChangeRef.current) {
        onChangeRef.current(lat, lng);
      }
    });

    mapRef.current = map;
    deliveryMarkerRef.current = marker;

    // Ensure proper size inside modal sheet animation
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => {
      clearTimeout(timer);
      map.remove();
      mapRef.current = null;
      deliveryMarkerRef.current = null;
      restaurantMarkerRef.current = null;
    };
  }, []);

  // Update delivery pin & recenter whenever coordinates update (e.g. "Update GPS" or saved address)
  useEffect(() => {
    const map = mapRef.current;
    const marker = deliveryMarkerRef.current;
    if (!map || !marker || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

    const current = marker.getLatLng();
    const moved =
      Math.abs(current.lat - latitude) > 0.00001 ||
      Math.abs(current.lng - longitude) > 0.00001;

    if (moved) {
      marker.setLatLng([latitude, longitude]);
      map.setView([latitude, longitude], Math.max(map.getZoom(), 15), { animate: true });
    }
    map.invalidateSize();
  }, [latitude, longitude]);

  // Show restaurant marker if store coordinates exist
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (restaurantMarkerRef.current) {
      restaurantMarkerRef.current.remove();
      restaurantMarkerRef.current = null;
    }

    if (
      typeof restaurantLat === 'number' &&
      typeof restaurantLng === 'number' &&
      Number.isFinite(restaurantLat) &&
      Number.isFinite(restaurantLng) &&
      (restaurantLat !== 0 || restaurantLng !== 0)
    ) {
      const safeName = (restaurantName || 'Restaurant').replace(/[<>&"]/g, '');
      restaurantMarkerRef.current = L.marker([restaurantLat, restaurantLng], {
        interactive: false,
        icon: createPinIcon('#d33401', safeName),
      }).addTo(map);
    }
  }, [restaurantLat, restaurantLng, restaurantName]);

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;

  return (
    <div
      style={{
        marginTop: 8,
        marginBottom: 8,
        borderRadius: 12,
        overflow: 'hidden',
        border: '1px solid #93c5fd',
        backgroundColor: '#e2e8f0',
      }}
    >
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height,
          position: 'relative',
          zIndex: 1,
        }}
      />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '6px 10px',
          backgroundColor: '#f8fafc',
          borderTop: '1px solid #cbd5e1',
          fontSize: 11,
          color: '#334155',
        }}
      >
        <span style={{ fontWeight: 600 }}>
          📍 Tap map or drag pin to adjust drop point
        </span>
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: '#1d4ed8',
            fontWeight: 700,
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          Open Maps ↗
        </a>
      </div>
    </div>
  );
}
