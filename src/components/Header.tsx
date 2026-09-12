import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Image } from 'react-native';
import {
  ShoppingBag as CartIcon,
  ClipboardList as OrderIcon,
  Store,
  QrCode,
  MapPin,
  Bell,
} from 'lucide-react';
import { getOriginalImageUrl } from '../services/api';
import { Order, Table, StoreOperatingStatus } from '../types';

interface SkeletonBoxProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: any;
}

function SkeletonBox({ width, height, borderRadius = 8, style }: SkeletonBoxProps) {
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
          width: width as any,
          height: height as any,
          borderRadius,
          backgroundColor: '#E2E8F0',
          opacity: 0.6,
        },
        style,
      ]}
    />
  );
}

interface StoreLogoImageProps {
  uri?: string;
  sources?: string[];
  size?: number;
  style?: any;
  onError?: () => void;
}

function StoreLogoImage({ uri, sources = [], size = 42, style, onError }: StoreLogoImageProps) {
  const candidateList = React.useMemo(() => {
    const raw = Array.isArray(sources) && sources.length > 0 ? sources : [uri];
    return raw.filter((u): u is string => Boolean(u && typeof u === 'string' && u.trim().length > 0));
  }, [uri, sources]);

  const [currentIndex, setCurrentIndex] = useState(0);

  const candidateKey = candidateList.join('|');
  useEffect(() => {
    setCurrentIndex(0);
  }, [candidateKey]);

  const activeUri = candidateList[currentIndex];

  if (!activeUri || currentIndex >= candidateList.length) {
    return <Store size={Math.round(size * 0.52)} color="#FFFFFF" />;
  }

  const handleImgError = () => {
    if (currentIndex + 1 < candidateList.length) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setCurrentIndex(candidateList.length);
      if (typeof onError === 'function') onError();
    }
  };

  if (typeof window !== 'undefined') {
    return (
      <img
        src={activeUri}
        alt="Store Logo"
        style={{
          width: size,
          height: size,
          objectFit: 'cover',
          borderRadius: Math.round(size * 0.26),
          display: 'block',
        }}
        onError={handleImgError}
      />
    );
  }

  return (
    <Image
      source={{ uri: activeUri }}
      style={style}
      resizeMode="cover"
      onError={handleImgError}
    />
  );
}

export interface HeaderProps {
  restaurantName?: string;
  restaurantAddress?: string;
  restaurantImage?: string;
  restaurantLogo?: string;
  imageUrl?: string;
  logoUrl?: string;
  cartCount?: number;
  openCart?: () => void;
  openOrderTracker?: (targetOrder?: any) => void;
  openQrModal?: () => void;
  openCallWaiter?: () => void;
  activeOrder?: Order | null;
  activeTable?: Table | null;
  storeOperatingStatus?: StoreOperatingStatus | null;
  loading?: boolean;
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
  openCallWaiter,
  activeOrder,
  activeTable,
  storeOperatingStatus,
  loading = false,
}: HeaderProps) {
  const displayName =
    restaurantName && !restaurantName.startsWith('Restaurant #')
      ? restaurantName
      : storeOperatingStatus?.restaurantName ||
        restaurantName ||
        'Restaurant Menu';

  const address =
    restaurantAddress ||
    storeOperatingStatus?.restaurantAddress ||
    storeOperatingStatus?.address ||
    '';

  const candidateImages = React.useMemo(() => {
    const rawList = [
      logoUrl,
      restaurantLogo,
      storeOperatingStatus?.storeImageUrl,
      storeOperatingStatus?.storeImage,
      storeOperatingStatus?.logoUrl,
      restaurantImage,
      imageUrl,
      storeOperatingStatus?.imageUrl,
      storeOperatingStatus?.bannerImage,
      storeOperatingStatus?.bannerUrl,
    ];

    const list: string[] = [];
    for (const raw of rawList) {
      if (raw && typeof raw === 'string' && raw.trim().length > 0) {
        const resolved = getOriginalImageUrl(raw);
        if (resolved && !list.includes(resolved)) {
          list.push(resolved);
        }
      }
    }
    return list;
  }, [
    logoUrl,
    restaurantLogo,
    storeOperatingStatus?.storeImageUrl,
    storeOperatingStatus?.storeImage,
    storeOperatingStatus?.logoUrl,
    restaurantImage,
    imageUrl,
    storeOperatingStatus?.imageUrl,
    storeOperatingStatus?.bannerImage,
    storeOperatingStatus?.bannerUrl,
  ]);

  const primaryImage = candidateImages[0] || '';

  const handleQrPress = React.useCallback(() => {
    if (typeof openQrModal === 'function') {
      openQrModal();
    }
  }, [openQrModal]);

  const hasTable = React.useMemo(() => {
    if (!activeTable) return false;
    const tid = activeTable.id ?? activeTable.tableId;
    if (tid === null || tid === undefined || (tid as any) === '' || (tid as any) === false) return false;
    const num = Number(tid);
    if (!isNaN(num)) return num > 0;
    return String(tid).trim().length > 0;
  }, [activeTable]);

  const handleCallWaiterPress = React.useCallback(() => {
    if (typeof openCallWaiter === 'function') {
      openCallWaiter();
    }
  }, [openCallWaiter]);

  const handleOrderPress = React.useCallback(() => {
    if (typeof openOrderTracker === 'function') {
      openOrderTracker(activeOrder);
    }
  }, [openOrderTracker, activeOrder]);

  const handleCartPress = React.useCallback(() => {
    if (typeof openCart === 'function') {
      openCart();
    }
  }, [openCart]);

  // Responsive device state for Mobile (<640), Tablet (640-1024), Desktop (>1024)
  const [deviceType, setDeviceType] = useState<'mobile' | 'tablet' | 'desktop'>(() => {
    if (typeof window !== 'undefined') {
      const w = window.innerWidth;
      if (w < 640) return 'mobile';
      if (w < 1024) return 'tablet';
      return 'desktop';
    }
    return 'desktop';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      const w = window.innerWidth;
      if (w < 640) {
        setDeviceType('mobile');
      } else if (w < 1024) {
        setDeviceType('tablet');
      } else {
        setDeviceType('desktop');
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = deviceType === 'mobile';
  const isDesktop = deviceType === 'desktop';

  const logoSize = isMobile ? 36 : isDesktop ? 44 : 40;

  return (
    <View style={[styles.container, isMobile && styles.containerMobile]}>
      <View style={styles.headerRow}>
        {/* =========================================================
            RESTAURANT IDENTITY: Logo, Prominent Name & Address
            (Never squished, NO table ID in header)
           ========================================================= */}
        {loading ? (
          <View style={styles.brandContainer}>
            <SkeletonBox width={logoSize} height={logoSize} borderRadius={10} />
            <View style={[styles.brandTextContainer, { gap: 5 }]}>
              <SkeletonBox width={isMobile ? 130 : 180} height={16} borderRadius={4} />
              <SkeletonBox width={isMobile ? 90 : 130} height={11} borderRadius={3} />
            </View>
          </View>
        ) : (
          <View style={styles.brandContainer}>
            <View style={[styles.logoBadge, { width: logoSize, height: logoSize }]}>
              <StoreLogoImage
                uri={primaryImage}
                sources={candidateImages}
                size={logoSize}
                style={{ width: logoSize, height: logoSize, borderRadius: 10 }}
              />
            </View>

            <View style={styles.brandTextContainer}>
              {/* Row 1: Restaurant Name + Status Badge (on Desktop) */}
              <View style={styles.brandTitleRow}>
                <Text
                  style={[
                    styles.brandTitle,
                    isMobile && styles.brandTitleMobile,
                    isDesktop && styles.brandTitleDesktop,
                  ]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {displayName}
                </Text>

                {/* Status Pill on Desktop/Tablet */}
                {!isMobile && storeOperatingStatus && (
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

              {/* Row 2: Subtitle with Status & Address */}
              <View style={styles.subInfoRow}>
                {/* On Mobile: Micro Live Status Dot + Text */}
                {isMobile && storeOperatingStatus && (
                  <View style={styles.mobileStatusChip}>
                    <View
                      style={[
                        styles.mobileStatusDot,
                        storeOperatingStatus.canPlaceOrder !== false
                          ? styles.statusDotOpen
                          : storeOperatingStatus.status === 'PAUSED'
                          ? styles.statusDotPaused
                          : styles.statusDotClosed,
                      ]}
                    />
                    <Text
                      style={[
                        styles.mobileStatusText,
                        storeOperatingStatus.canPlaceOrder !== false
                          ? styles.statusPillTextOpen
                          : storeOperatingStatus.status === 'PAUSED'
                          ? styles.statusPillTextPaused
                          : styles.statusPillTextClosed,
                      ]}
                    >
                      {storeOperatingStatus.canPlaceOrder !== false
                        ? 'Open'
                        : storeOperatingStatus.status === 'PAUSED'
                        ? 'Paused'
                        : 'Closed'}
                    </Text>
                    {address ? <Text style={styles.subDotDivider}>•</Text> : null}
                  </View>
                )}

                {address ? (
                  <View style={styles.headerAddressRow}>
                    <MapPin size={11} color="#EA580C" style={{ flexShrink: 0 }} />
                    <Text style={styles.brandSub} numberOfLines={1}>
                      {address}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        )}

        {/* =========================================================
            ACTION CONTROLS: QR, Call Waiter, Orders, Cart
            (Icon-only on mobile, labeled on tablet/desktop)
           ========================================================= */}
        {loading ? (
          <View style={styles.actionsRow}>
            <SkeletonBox width={isMobile ? 34 : 48} height={isMobile ? 34 : 36} borderRadius={18} />
            <SkeletonBox width={isMobile ? 34 : 72} height={isMobile ? 34 : 36} borderRadius={18} />
            <SkeletonBox width={isMobile ? 36 : 38} height={isMobile ? 36 : 38} borderRadius={19} />
          </View>
        ) : (
          <View style={[styles.actionsRow, isMobile && styles.actionsRowMobile]}>
            {/* QR Scanner / Modal Button */}
            {typeof openQrModal === 'function' && (
              <Pressable
                className="header-action-btn"
                style={({ pressed }) => [
                  styles.qrButton,
                  isMobile && styles.iconBtnMobile,
                  pressed && styles.qrButtonPressed,
                ]}
                onPress={handleQrPress}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="View QR Code"
                title="View QR Code"
              >
                <QrCode size={isMobile ? 16 : 15} color="#0F172A" strokeWidth={2.2} />
                {!isMobile && (
                  <Text style={styles.qrButtonText}>
                    {isDesktop ? 'QR Code' : 'QR'}
                  </Text>
                )}
              </Pressable>
            )}

            {/* Call Waiter Button (Shown when active table exists) */}
            {hasTable && typeof openCallWaiter === 'function' && (
              <Pressable
                className="header-action-btn"
                style={({ pressed }) => [
                  styles.bellButton,
                  isMobile && styles.iconBtnMobile,
                  pressed && styles.bellButtonPressed,
                ]}
                onPress={handleCallWaiterPress}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Call Waiter"
                title="Call Waiter"
              >
                <Bell size={isMobile ? 16 : 15} color="#EA580C" strokeWidth={2.2} />
                {!isMobile && (
                  <Text style={styles.bellButtonText}>
                    {isDesktop ? 'Call Waiter' : 'Waiter'}
                  </Text>
                )}
              </Pressable>
            )}

            {/* Orders Tracker Button */}
            {typeof openOrderTracker === 'function' && (
              <Pressable
                className="header-action-btn"
                style={({ pressed }) => [
                  styles.orderButton,
                  isMobile && styles.iconBtnMobile,
                  pressed && styles.orderButtonPressed,
                ]}
                onPress={handleOrderPress}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="View Orders"
                title="View Orders"
              >
                <OrderIcon size={isMobile ? 16 : 16} color="#D33401" strokeWidth={2.2} />
                {!isMobile && (
                  <>
                    <Text style={styles.orderButtonText}>Orders</Text>
                    {activeOrder && <View style={styles.orderDot} />}
                  </>
                )}
                {isMobile && activeOrder && (
                  <View style={styles.orderDotMobile} className="pulse-order-dot" />
                )}
              </Pressable>
            )}

            {/* Cart Button */}
            <Pressable
              className="header-action-btn"
              style={({ pressed }) => [
                styles.cartButton,
                isMobile && styles.cartButtonMobile,
                pressed && styles.cartButtonPressed,
              ]}
              onPress={handleCartPress}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              accessibilityRole="button"
              accessibilityLabel={`Cart with ${cartCount} items`}
              title="View Cart"
            >
              <CartIcon size={isMobile ? 17 : 18} color="#FFFFFF" strokeWidth={2.2} />

              {cartCount > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>
                    {cartCount > 99 ? '99+' : cartCount}
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
        )}
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
    paddingHorizontal: 20,
    paddingVertical: 10,
    zIndex: 1000,
    elevation: 4,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  containerMobile: {
    paddingHorizontal: 12,
    paddingVertical: 8,
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
    borderRadius: 10,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  brandTextContainer: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'nowrap',
    minWidth: 0,
  },
  brandTitle: {
    color: '#0F172A',
    fontSize: 16.5,
    fontWeight: '800',
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  brandTitleMobile: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  brandTitleDesktop: {
    fontSize: 18,
    letterSpacing: -0.4,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
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
    width: 5.5,
    height: 5.5,
    borderRadius: 3,
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
    fontSize: 9,
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
    marginTop: 2,
    gap: 4,
    minWidth: 0,
    overflow: 'hidden',
  },
  mobileStatusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
    flexShrink: 0,
  },
  mobileStatusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  mobileStatusText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  subDotDivider: {
    color: '#CBD5E1',
    fontSize: 10,
    marginHorizontal: 1,
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
    fontSize: 11,
    fontWeight: '500',
    flexShrink: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  actionsRowMobile: {
    gap: 5.5,
  },
  iconBtnMobile: {
    width: 34,
    height: 34,
    minWidth: 34,
    paddingHorizontal: 0,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrButton: {
    height: 36,
    minWidth: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  qrButtonPressed: {
    backgroundColor: '#E2E8F0',
    transform: [{ scale: 0.96 }],
  },
  qrButtonText: {
    color: '#0F172A',
    fontSize: 11.5,
    fontWeight: '700',
  },
  bellButton: {
    height: 36,
    minWidth: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: 18,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    gap: 4,
  },
  bellButtonPressed: {
    backgroundColor: '#FFEDD5',
    transform: [{ scale: 0.96 }],
  },
  bellButtonText: {
    color: '#EA580C',
    fontSize: 11.5,
    fontWeight: '700',
  },
  orderButton: {
    height: 36,
    minWidth: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: 18,
    backgroundColor: '#FFF1EC',
    borderWidth: 1,
    borderColor: '#F3C8BA',
    gap: 4,
    position: 'relative',
  },
  orderButtonPressed: {
    backgroundColor: '#FFE4DA',
    transform: [{ scale: 0.96 }],
  },
  orderButtonText: {
    color: '#D33401',
    fontSize: 11.5,
    fontWeight: '700',
  },
  orderDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D33401',
    marginLeft: 1,
  },
  orderDotMobile: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D33401',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  cartButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
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
  cartButtonMobile: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  cartButtonPressed: {
    backgroundColor: '#B92D03',
    transform: [{ scale: 0.95 }],
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
