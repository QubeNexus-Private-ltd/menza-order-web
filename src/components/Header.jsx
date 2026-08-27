import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Image } from 'react-native';
import {
  ShoppingBag as CartIcon,
  ClipboardList as OrderIcon,
  Store,
  QrCode,
  MapPin,
  Utensils,
} from 'lucide-react';
import { getOriginalImageUrl } from '../services/api';

function SkeletonBox({ width, height, borderRadius = 8, style }) {
  if (typeof window !== 'undefined') {
    return (
      <div
        className="skeleton-pulse"
        style={{
          width: typeof width === 'number' ? `${width}px` : width,
          height: typeof height === 'number' ? `${height}px` : height,
          borderRadius: `${borderRadius}px`,
          backgroundColor: '#E2E8F0',
          flexShrink: 0,
          ...(typeof style === 'object' ? style : {}),
        }}
      />
    );
  }

  return (
    <View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: '#E2E8F0',
          opacity: 0.6,
        },
        style,
      ]}
    />
  );
}

function StoreLogoImage({ uri, size = 42, style, onError }) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [uri]);

  if (!uri || hasError) {
    return <Store size={20} color="#FFFFFF" />;
  }

  if (typeof window !== 'undefined') {
    return (
      <img
        src={uri}
        alt="Store Logo"
        style={{
          width: size,
          height: size,
          objectFit: 'cover',
          borderRadius: 10,
          display: 'block',
        }}
        onError={() => {
          setHasError(true);
          if (typeof onError === 'function') onError();
        }}
      />
    );
  }

  return (
    <Image
      source={{ uri }}
      style={style}
      resizeMode="cover"
      onError={() => {
        setHasError(true);
        if (typeof onError === 'function') onError();
      }}
    />
  );
}

export default function Header({
  restaurantName,
  restaurantAddress,
  restaurantImage,
  restaurantLogo,
  imageUrl,
  logoUrl,
  cartCount = 0,
  openCart,
  openOrderTracker,
  openQrModal,
  activeOrder,
  activeTable,
  storeOperatingStatus,
  loading = false,
}) {
  const displayName = restaurantName || 'Restaurant Menu';
  const rawImage =
    logoUrl ||
    restaurantLogo ||
    imageUrl ||
    restaurantImage ||
    '';
  const displayImage = rawImage ? getOriginalImageUrl(rawImage) : '';

  const handleQrPress = React.useCallback(() => {
    if (typeof openQrModal === 'function') {
      openQrModal();
    }
  }, [openQrModal]);

  const handleOrderPress = React.useCallback(() => {
    if (typeof openOrderTracker === 'function') {
      openOrderTracker();
    }
  }, [openOrderTracker]);

  const handleCartPress = React.useCallback(() => {
    if (typeof openCart === 'function') {
      openCart();
    }
  }, [openCart]);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        {/* Restaurant Identity: Logo, Name, Address & Live Status */}
        {loading ? (
          <View style={styles.brandContainer}>
            <SkeletonBox width={38} height={38} borderRadius={10} />
            <View style={[styles.brandTextContainer, { gap: 6 }]}>
              <SkeletonBox width={120} height={14} borderRadius={4} />
              <SkeletonBox width={160} height={10} borderRadius={3} />
            </View>
          </View>
        ) : (
          <View style={styles.brandContainer}>
            <View style={styles.logoBadge}>
              <StoreLogoImage
                uri={displayImage}
                size={38}
                style={styles.logoImage}
              />
            </View>

            <View style={styles.brandTextContainer}>
              <View style={styles.brandTitleRow}>
                <Text style={styles.brandTitle} numberOfLines={1} ellipsizeMode="tail">
                  {displayName}
                </Text>

                {storeOperatingStatus && (
                  <View
                    style={[
                      styles.statusPill,
                      storeOperatingStatus.canPlaceOrder !== false
                        ? styles.statusPillOpen
                        : storeOperatingStatus.status === 'PAUSED'
                        ? styles.statusPillPaused
                        : styles.statusPillClosed,
                    ]}
                  >
                    <View
                      style={[
                        styles.statusDot,
                        storeOperatingStatus.canPlaceOrder !== false
                          ? styles.statusDotOpen
                          : storeOperatingStatus.status === 'PAUSED'
                          ? styles.statusDotPaused
                          : styles.statusDotClosed,
                      ]}
                    />
                    <Text
                      style={[
                        styles.statusPillText,
                        storeOperatingStatus.canPlaceOrder !== false
                          ? styles.statusPillTextOpen
                          : storeOperatingStatus.status === 'PAUSED'
                          ? styles.statusPillTextPaused
                          : styles.statusPillTextClosed,
                      ]}
                    >
                      {storeOperatingStatus.canPlaceOrder !== false
                        ? 'OPEN'
                        : storeOperatingStatus.status === 'PAUSED'
                        ? 'PAUSED'
                        : 'CLOSED'}
                    </Text>
                  </View>
                )}
              </View>

              {/* Address & Table Seating Row (No dummy fallbacks) */}
              <View style={styles.subInfoRow}>
                {restaurantAddress ? (
                  <View style={styles.headerAddressRow}>
                    <MapPin size={11} color="#EA580C" style={{ flexShrink: 0 }} />
                    <Text style={styles.brandSub} numberOfLines={1}>
                      {restaurantAddress}
                    </Text>
                  </View>
                ) : null}

                {activeTable?.tableName ? (
                  <View style={styles.headerTableBadge}>
                    <Utensils size={10} color="#D33401" />
                    <Text style={styles.headerTableText} numberOfLines={1}>
                      {activeTable.tableName}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        )}

        {/* Action Controls: QR, Orders, Cart */}
        <View style={styles.actionsRow}>
          {typeof openQrModal === 'function' && (
            <Pressable
              style={({ pressed }) => [
                styles.qrButton,
                pressed && styles.qrButtonPressed,
              ]}
              onPress={handleQrPress}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="View QR Code"
            >
              <QrCode size={15} color="#0F172A" strokeWidth={2.2} />
              <Text style={styles.qrButtonText}>QR</Text>
            </Pressable>
          )}

          {typeof openOrderTracker === 'function' && (
            <Pressable
              style={({ pressed }) => [
                styles.orderButton,
                pressed && styles.orderButtonPressed,
              ]}
              onPress={handleOrderPress}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="View Orders"
            >
              <OrderIcon size={16} color="#D33401" strokeWidth={2.2} />
              <Text style={styles.orderButtonText}>Orders</Text>
              {activeOrder && <View style={styles.orderDot} />}
            </Pressable>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.cartButton,
              pressed && styles.cartButtonPressed,
            ]}
            onPress={handleCartPress}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            accessibilityRole="button"
            accessibilityLabel={`Cart with ${cartCount} items`}
          >
            <CartIcon size={18} color="#FFFFFF" strokeWidth={2.2} />

            {cartCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>
                  {cartCount > 99 ? '99+' : cartCount}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    zIndex: 1000,
    elevation: 4,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  headerRow: {
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
    gap: 8,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    gap: 8,
  },
  logoBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  logoImage: {
    width: 38,
    height: 38,
    borderRadius: 10,
  },
  brandTextContainer: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexWrap: 'nowrap',
    minWidth: 0,
  },
  brandTitle: {
    color: '#0F172A',
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 5,
    borderWidth: 1,
    flexShrink: 0,
  },
  statusPillOpen: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  statusPillPaused: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  statusPillClosed: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  statusDotOpen: {
    backgroundColor: '#10B981',
  },
  statusDotPaused: {
    backgroundColor: '#F59E0B',
  },
  statusDotClosed: {
    backgroundColor: '#EF4444',
  },
  statusPillText: {
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  statusPillTextOpen: {
    color: '#047857',
  },
  statusPillTextPaused: {
    color: '#B45309',
  },
  statusPillTextClosed: {
    color: '#B91C1C',
  },
  subInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 1.5,
    gap: 5,
    minWidth: 0,
    overflow: 'hidden',
  },
  headerAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2.5,
    flexShrink: 1,
    minWidth: 0,
  },
  brandSub: {
    color: '#64748B',
    fontSize: 10.5,
    fontWeight: '500',
    flexShrink: 1,
  },
  headerTableBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2.5,
    backgroundColor: '#FFF1EC',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#F3C8BA',
    flexShrink: 0,
  },
  headerTableText: {
    color: '#D33401',
    fontSize: 9.5,
    fontWeight: '800',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  qrButton: {
    height: 34,
    minWidth: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 3,
  },
  qrButtonPressed: {
    backgroundColor: '#E2E8F0',
    transform: [{ scale: 0.97 }],
  },
  qrButtonText: {
    color: '#0F172A',
    fontSize: 11,
    fontWeight: '800',
  },
  orderButton: {
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: 17,
    backgroundColor: '#FFF1EC',
    borderWidth: 1,
    borderColor: '#F3C8BA',
    gap: 3,
  },
  orderButtonPressed: {
    backgroundColor: '#FFE4DA',
    transform: [{ scale: 0.97 }],
  },
  orderButtonText: {
    color: '#D33401',
    fontSize: 11,
    fontWeight: '800',
  },
  orderDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#D33401',
    marginLeft: 1,
  },
  cartButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#D33401',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#D33401',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 5,
    elevation: 3,
  },
  cartButtonPressed: {
    backgroundColor: '#B92D03',
    transform: [{ scale: 0.96 }],
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 17,
    height: 17,
    borderRadius: 8.5,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2.5,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontWeight: '900',
  },
});