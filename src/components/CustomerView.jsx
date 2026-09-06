import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import {
  Search,
  Plus,
  Minus,
  Store,
  ChevronUp,
  MapPin,
  Utensils,
  Clock,
  Bell,
  Receipt,
  Sparkles,
  Flame,
  Check,
  ChevronRight,
  X,
} from 'lucide-react';
import * as signalrService from '../services/signalr';
import {
  getUnitDescription,
  getItemImageUrl,
  getOriginalImageUrl,
  IMAGE_NOT_AVAILABLE,
  getDecreasingPreparationCountdown,
  isLiveKitchenActive,
} from '../services/api';

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

function CustomerViewSkeleton() {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Search & Veg Filter Skeleton */}
      <View style={styles.controlsRow}>
        <SkeletonBox
          width="100%"
          height={48}
          borderRadius={16}
          style={{ flex: 1 }}
        />
        <SkeletonBox
          width={76}
          height={48}
          borderRadius={16}
        />
      </View>

      {/* Category Filter Pills Skeleton */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoriesScroll}
        contentContainerStyle={styles.categoriesContainer}
      >
        {[85, 105, 115, 95, 110, 90].map((w, idx) => (
          <SkeletonBox
            key={idx}
            width={w}
            height={36}
            borderRadius={22}
          />
        ))}
      </ScrollView>

      {/* Section Header Skeleton */}
      <View style={styles.sectionHeaderRow}>
        <SkeletonBox width={140} height={20} borderRadius={6} />
        <SkeletonBox width={60} height={14} borderRadius={4} />
      </View>

      {/* Dishes Grid Skeleton */}
      <View style={styles.grid}>
        {[1, 2, 3, 4, 5, 6, 7, 8].map((item) => (
          <View key={item} style={styles.cardSkeleton}>
            <SkeletonBox
              width="100%"
              height={135}
              borderRadius={12}
              style={{ marginBottom: 10 }}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <SkeletonBox width={54} height={14} borderRadius={4} />
              <SkeletonBox width={36} height={14} borderRadius={4} />
            </View>
            <SkeletonBox width="85%" height={15} borderRadius={4} style={{ marginBottom: 6 }} />
            <SkeletonBox width="60%" height={11} borderRadius={4} style={{ marginBottom: 12 }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 6, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
              <SkeletonBox width={58} height={16} borderRadius={4} />
              <SkeletonBox width={34} height={34} borderRadius={17} />
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const COLORS = {
  orange: '#F47A24',
  orangeDark: '#E96816',
  orangeLight: '#FFF1E8',
  orangeSoft: '#fcf7f3',
  background: '#FFFCFA',
  white: '#FFFFFF',
  text: '#171717',
  textSecondary: '#8C8885',
  textMuted: '#AAA5A1',
  softGray: '#F7F5F3',
  gray: '#EFECE9',
  border: '#EEE8E3',
  green: '#15803D',
  greenLight: '#DCFCE7',
  red: '#DC2626',
  placeholder: '#F5F3F1',
};

const ItemImageWithFallback = React.memo(function ItemImageWithFallback({ uri, style, resizeMode = 'cover' }) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [uri]);

  const cleanUri = typeof uri === 'string' ? uri.trim() : '';
  const hasValidUri =
    cleanUri !== '' &&
    cleanUri !== IMAGE_NOT_AVAILABLE;

  if (!hasValidUri || hasError) {
    return (
      <View style={[style, styles.imagePlaceholder]}>
        <Store size={28} color={COLORS.textMuted} />
        <Text style={styles.imagePlaceholderText}>
          Image unavailable
        </Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: cleanUri }}
      style={style}
      resizeMode={resizeMode}
      onLoad={() => {
        console.log('CUSTOMER IMAGE LOADED:', cleanUri);
      }}
      onError={(error) => {
        console.log(
          'CUSTOMER IMAGE FAILED:',
          cleanUri,
          error?.nativeEvent
        );
        setHasError(true);
      }}
    />
  );
});

export default function CustomerView({
  catalog,
  categories,
  items,
  activeTable,
  activeOrder,
  openOrderTracker,
  openScanner,
  cartItems = [],
  openCart,
  onAddToCart,
  onUpdateCartQuantity,
  onCallWaiter,
  onRequestBill,
  loading,
  storeOperatingStatus,
}) {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [vegOnly, setVegOnly] = useState(false);
  const [actionLoading, setActionLoading] = useState({});
  const [liveOrder, setLiveOrder] = useState(activeOrder || null);
  const [, setLiveOrderTick] = useState(0);
  const [dismissedOrderIds, setDismissedOrderIds] = useState(new Set());
  const servedTimestampsRef = useRef({});
  const searchInputRef = useRef(null);

  // Live 1-second countdown interval for active floating order bar
  useEffect(() => {
    if (!liveOrder) return;
    const st = String(liveOrder.kitchenStatus || liveOrder.orderStatus || '').toLowerCase();
    const isDone = st.includes('serve') || st.includes('deliver') || st.includes('complete') || st.includes('settled') || st.includes('ready');
    if (isDone) return;

    const timer = setInterval(() => {
      setLiveOrderTick((t) => (t + 1) % 10000);
    }, 1000);

    return () => clearInterval(timer);
  }, [liveOrder?.id, liveOrder?.kitchenStatus, liveOrder?.orderStatus]);

  // Phase 3: Auto-collapse floating order bar 5 minutes after being served
  useEffect(() => {
    if (!liveOrder) return;
    const orderId = Number(liveOrder.id || liveOrder.orderId || 0);
    const kSt = String(liveOrder.kitchenStatus || '').toLowerCase();
    const oSt = String(liveOrder.orderStatus || '').toLowerCase();
    const isServed =
      kSt.includes('serve') ||
      oSt.includes('serve') ||
      kSt.includes('deliver') ||
      oSt.includes('deliver');

    if (isServed && orderId) {
      if (!servedTimestampsRef.current[orderId]) {
        servedTimestampsRef.current[orderId] = Date.now();
      }
      const timeSinceServed = Date.now() - servedTimestampsRef.current[orderId];
      const remainingToDismiss = Math.max(1000, 300000 - timeSinceServed);

      const timeout = setTimeout(() => {
        setDismissedOrderIds((prev) => new Set([...prev, orderId]));
      }, remainingToDismiss);

      return () => clearTimeout(timeout);
    }
  }, [liveOrder?.id, liveOrder?.kitchenStatus, liveOrder?.orderStatus]);

  const { width: windowWidth } = useWindowDimensions();
  const isSmallMobile = windowWidth < 380;
  const isMobile = windowWidth < 640;
  const isTabletOrDesktop = windowWidth >= 768;

  const searchPlaceholder = isSmallMobile
    ? 'Search dishes...'
    : isTabletOrDesktop
    ? 'Search dishes, drinks, desserts... (Press / to search)'
    : 'Search dishes, drinks, desserts...';

  // Desktop keyboard shortcuts: '/' or Ctrl/Cmd+K to focus, 'Escape' to blur
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleKeyDown = (e) => {
      const activeTag = document.activeElement?.tagName?.toUpperCase();
      const isInputActive = activeTag === 'INPUT' || activeTag === 'TEXTAREA';

      if (e.key === '/' && !isInputActive) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K') && !isInputActive) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape' && isSearchFocused) {
        searchInputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchFocused]);

  useEffect(() => {
    if (activeOrder) {
      setLiveOrder((prev) => {
        if (!prev) return activeOrder;
        const curOrderSt = activeOrder.orderStatus || prev.orderStatus;
        let curKitchenSt = activeOrder.kitchenStatus || prev.kitchenStatus;
        const oStLower = String(curOrderSt || '').toLowerCase();
        if (oStLower.includes('serve') || oStLower.includes('deliver') || oStLower.includes('complete') || oStLower.includes('settled')) {
          curKitchenSt = 'Served';
        }
        return {
          ...prev,
          ...activeOrder,
          kitchenStatus: curKitchenSt,
          orderStatus: curOrderSt,
        };
      });
    }
  }, [activeOrder]);

  useEffect(() => {
    const unsub = signalrService.onKitchenProgress((data) => {
      const changedId = Number(data?.orderId || data?.id || 0);
      setLiveOrder((prev) => {
        if (!prev) return prev;
        const curId = Number(prev.id || prev.orderId || 0);
        if (changedId && changedId !== curId) return prev;
        const newOrdSt = data?.orderStatus || data?.status || prev.orderStatus;
        let newKitchSt = data?.kitchenStatus || prev.kitchenStatus;
        const oStLower = String(newOrdSt || '').toLowerCase();
        if (oStLower.includes('serve') || oStLower.includes('deliver') || oStLower.includes('complete') || oStLower.includes('settled')) {
          newKitchSt = 'Served';
        }
        return {
          ...prev,
          orderStatus: newOrdSt,
          kitchenStatus: newKitchSt,
        };
      });
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, []);

  const restaurantName =
    catalog
      ? catalog.restaurantName ||
        (catalog.restaurantId ? `Restaurant #${catalog.restaurantId}` : 'Restaurant Menu')
      : 'Restaurant Menu';

  const restaurantAddress =
    catalog?.restaurantAddress ||
    catalog?.address ||
    [catalog?.address, catalog?.city, catalog?.state].filter(Boolean).join(', ') ||
    '';

  const rawCover = catalog?.imageUrl || catalog?.restaurantImage || '';
  const restaurantImageUrl = rawCover ? getOriginalImageUrl(rawCover) : '';

  const rawLogo = catalog?.logoUrl || catalog?.logo || '';
  const restaurantLogoUrl = rawLogo ? getOriginalImageUrl(rawLogo) : '';

  const [logoError, setLogoError] = useState(false);
  const [coverError, setCoverError] = useState(false);

  // Selected items count (only items, not quantity)
  const totalCartCount = (cartItems || []).length;

  const totalCartSubTotal =
    (cartItems || []).reduce(
      (acc, item) =>
        acc +
        (
          Number(
            item.unitPrice ??
            item.amount ??
            item.price ??
            0
          ) || 0
        ) *
        (Number(item.quantity) || 1),
      0
    );

  const cgstRate = Number(catalog?.cgstPercentage ?? 2.5);
  const sgstRate = Number(catalog?.sgstPercentage ?? 2.5);
  const hasGst = cgstRate > 0 || sgstRate > 0 || Boolean(catalog?.gstNumber);

  const totalCartTax = hasGst
    ? Math.round(totalCartSubTotal * ((cgstRate + sgstRate) / 100) * 100) / 100
    : 0;

  const totalCartAmount = Math.round((totalCartSubTotal + totalCartTax) * 100) / 100;

  const filteredItems =
    (items || []).filter((item) => {
      if (
        selectedCategory &&
        item.categoryId !== selectedCategory
      ) {
        return false;
      }

      if (vegOnly && !item.isVeg) {
        return false;
      }

      if (searchQuery.trim()) {
        const q =
          searchQuery.toLowerCase().trim();

        const matchName =
          item.itemName &&
          String(item.itemName)
            .toLowerCase()
            .includes(q);

        const matchDesc =
          item.description &&
          String(item.description)
            .toLowerCase()
            .includes(q);

        if (!matchName && !matchDesc) {
          return false;
        }
      }

      return true;
    });

  const getCartItem = (itemId) => {
    return (
      (cartItems || []).find(
        (cartItem) =>
          cartItem.itemId === itemId
      ) || null
    );
  };

  const getCartQuantity = (itemId) => {
    const found =
      getCartItem(itemId);

    return found
      ? Number(found.quantity || 0)
      : 0;
  };

  const getUnitPrice = (
    item,
    cartItem
  ) => {
    const value =
      item?.unitPrice ??
      item?.price ??
      cartItem?.unitPrice ??
      cartItem?.amount ??
      0;

    const number = Number(value);

    return Number.isFinite(number)
      ? number
      : 0;
  };

  const getUnitName = (
    item,
    cartItem
  ) => {
    const unitName =
      item?.unitName ||
      item?.unitDescription ||
      cartItem?.unitName ||
      cartItem?.unitDescription ||
      '';

    if (
      typeof unitName === 'string' &&
      unitName.trim() !== ''
    ) {
      return unitName.trim();
    }

    const unitDescription =
      getUnitDescription(
        cartItem || item
      );

    return unitDescription || '';
  };

  const runItemAction = async (
    itemId,
    action
  ) => {
    if (
      actionLoading[itemId]
    ) {
      return;
    }

    setActionLoading(
      (prev) => ({
        ...prev,
        [itemId]: true,
      })
    );

    try {
      await action();
    } catch (error) {
      console.error(
        'Customer item action failed:',
        error
      );
    } finally {
      setActionLoading(
        (prev) => {
          const next = {
            ...prev,
          };

          delete next[itemId];

          return next;
        }
      );
    }
  };

  const getDisplayImage = (
    item,
    cartItem = null
  ) => {
    if (
      !item &&
      !cartItem
    ) {
      return '';
    }

    const directImageUrl =
      item?.imageUrl ||
      item?.ImageUrl ||
      cartItem?.imageUrl ||
      '';

    if (
      typeof directImageUrl === 'string' &&
      directImageUrl.trim() !== '' &&
      directImageUrl.trim() !==
        IMAGE_NOT_AVAILABLE
    ) {
      const cleanDirectUrl =
        directImageUrl.trim();

      const resolved =
        getItemImageUrl(
          cleanDirectUrl,
          item?.isVeg !== false
        );

      return (
        resolved ||
        cleanDirectUrl
      );
    }

    const imageCandidates = [
      item?.ImageUrl,
      item?.ImageURL,
      item?.imageURL,
      item?.imagePath,
      item?.ImagePath,
      item?.photoUrl,
      item?.PhotoUrl,
      item?.photoURL,
      item?.PhotoURL,
      item?.img,
      item?.itemImage,
      item?.itemImageUrl,
      item?.ItemImage,
      item?.ItemImageUrl,
      item?.itemImageURL,
      item?.ItemImageURL,
      item?.imageFile,
      item?.ImageFile,
      item?.imageName,
      item?.ImageName,
      cartItem?.ImageUrl,
      cartItem?.ImageURL,
      cartItem?.imageURL,
      cartItem?.imagePath,
      cartItem?.ImagePath,
      cartItem?.photoUrl,
      cartItem?.PhotoUrl,
      cartItem?.photoURL,
      cartItem?.PhotoURL,
      cartItem?.img,
      cartItem?.itemImage,
      cartItem?.itemImageUrl,
      cartItem?.ItemImage,
      cartItem?.ItemImageUrl,
    ];

    const apiImage =
      imageCandidates.find(
        (value) =>
          typeof value === 'string' &&
          value.trim() !== '' &&
          value.trim() !==
            IMAGE_NOT_AVAILABLE
      );

    if (!apiImage) {
      return '';
    }

    const cleanImage =
      apiImage.trim();

    if (
      cleanImage.startsWith(
        'http://'
      ) ||
      cleanImage.startsWith(
        'https://'
      ) ||
      cleanImage.startsWith(
        'data:'
      )
    ) {
      return cleanImage;
    }

    const generatedUrl =
      getItemImageUrl(
        cleanImage,
        item?.isVeg !== false
      );

    return generatedUrl || '';
  };

  if (loading) {
    return (
      <View style={styles.rootWrapper}>
        <CustomerViewSkeleton />
      </View>
    );
  }

  return (
    <View style={styles.rootWrapper}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={
          styles.contentContainer
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        {/* Closed/Paused Notification Banner if Ordering is Disabled */}
        {storeOperatingStatus && !storeOperatingStatus.canPlaceOrder && (
          <View
            style={[
              styles.storeStatusBanner,
              storeOperatingStatus.status === 'PAUSED'
                ? styles.storeStatusBannerPaused
                : styles.storeStatusBannerClosed,
            ]}
          >
            <View
              style={[
                styles.storeStatusDot,
                storeOperatingStatus.status === 'PAUSED'
                  ? styles.storeStatusDotPaused
                  : styles.storeStatusDotClosed,
              ]}
            />
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.storeStatusBannerTitle,
                  storeOperatingStatus.status === 'PAUSED'
                    ? styles.storeStatusBannerTitlePaused
                    : styles.storeStatusBannerTitleClosed,
                ]}
              >
                {storeOperatingStatus.status === 'PAUSED'
                  ? `Kitchen Temporarily Paused (${storeOperatingStatus.remainingPauseMinutes || 0}m left)`
                  : 'Kitchen Closed for Ordering'}
              </Text>
              <Text style={styles.storeStatusBannerSubtitle}>
                {storeOperatingStatus.statusMessage ||
                  'Ordering is currently disabled for this outlet.'}
              </Text>
            </View>
          </View>
        )}
        {/* Search & Veg Filter Bar */}
        <View style={[
          styles.controlsRow,
          isSmallMobile && styles.controlsRowSmallMobile,
          isTabletOrDesktop && styles.controlsRowDesktop,
        ]}>
          <Pressable
            style={[
              styles.searchBox,
              isSmallMobile && styles.searchBoxSmallMobile,
              isTabletOrDesktop && styles.searchBoxDesktop,
              isSearchFocused && styles.searchBoxFocused,
            ]}
            onPress={() => searchInputRef.current?.focus()}
            accessibilityRole="search"
          >
            <View
              style={[
                styles.searchIconBadge,
                isSmallMobile && styles.searchIconBadgeSmallMobile,
                (isSearchFocused || Boolean(searchQuery)) && styles.searchIconBadgeActive,
              ]}
            >
              <Search
                size={isSmallMobile ? 14 : 16}
                color={(isSearchFocused || Boolean(searchQuery)) ? '#D33401' : '#64748B'}
                strokeWidth={2.2}
              />
            </View>

            <TextInput
              ref={searchInputRef}
              style={[
                styles.searchInput,
                isSmallMobile && styles.searchInputSmallMobile,
              ]}
              placeholder={searchPlaceholder}
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />

            {Boolean(searchQuery) ? (
              <View style={styles.searchRightActions}>
                <View style={[
                  styles.searchCountBadge,
                  isSmallMobile && styles.searchCountBadgeSmallMobile,
                ]}>
                  <Text style={[
                    styles.searchCountText,
                    isSmallMobile && styles.searchCountTextSmallMobile,
                  ]}>
                    {windowWidth < 440 ? `${filteredItems.length}` : `${filteredItems.length} found`}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.searchClearBtn,
                    isSmallMobile && styles.searchClearBtnSmallMobile,
                  ]}
                  onPress={() => {
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search input"
                >
                  <X size={isSmallMobile ? 11 : 12} color="#64748B" strokeWidth={2.5} />
                </TouchableOpacity>
              </View>
            ) : isTabletOrDesktop && !isSearchFocused ? (
              <View style={styles.desktopKbdPill}>
                <Text style={styles.desktopKbdText}>/</Text>
              </View>
            ) : null}
          </Pressable>

          <TouchableOpacity
            style={[
              styles.vegToggle,
              isSmallMobile && styles.vegToggleSmallMobile,
              isTabletOrDesktop && styles.vegToggleDesktop,
              vegOnly && styles.vegToggleActive,
            ]}
            onPress={() => setVegOnly(!vegOnly)}
            activeOpacity={0.85}
            accessibilityRole="switch"
            accessibilityState={{ checked: vegOnly }}
            accessibilityLabel="Toggle vegetarian only filter"
          >
            <View style={[styles.vegDotBorder, vegOnly && styles.vegDotBorderActive]}>
              <View style={[styles.vegDot, vegOnly && styles.vegDotActive]} />
            </View>
            <Text
              style={[
                styles.vegText,
                isSmallMobile && styles.vegTextSmallMobile,
                vegOnly && styles.vegTextActive,
              ]}
            >
              Veg
            </Text>
          </TouchableOpacity>
        </View>

        {/* Active Search Result Notification Pill */}
        {Boolean(searchQuery.trim()) && (
          <View style={styles.activeFilterRow}>
            <View style={styles.activeFilterChip}>
              <Text style={styles.activeFilterLabel} numberOfLines={1}>
                Results for <Text style={styles.activeFilterQuery}>"{searchQuery.trim()}"</Text> ({filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'})
              </Text>
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                style={styles.activeFilterClearBtn}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                accessibilityRole="button"
                accessibilityLabel="Clear search filter"
              >
                <X size={11} color="#D33401" strokeWidth={2.5} />
                <Text style={styles.activeFilterClearText}>Clear</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Category Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoriesScroll}
          contentContainerStyle={styles.categoriesContainer}
        >
          <TouchableOpacity
            style={[
              styles.categoryChip,
              selectedCategory === null && styles.categoryChipActive,
            ]}
            onPress={() => setSelectedCategory(null)}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.categoryChipText,
                selectedCategory === null && styles.categoryChipTextActive,
              ]}
            >
              All Items
            </Text>
          </TouchableOpacity>

          {(categories || []).map((cat) => (
            <TouchableOpacity
              key={cat.categoryId}
              style={[
                styles.categoryChip,
                selectedCategory === cat.categoryId && styles.categoryChipActive,
              ]}
              onPress={() => setSelectedCategory(cat.categoryId)}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  selectedCategory === cat.categoryId && styles.categoryChipTextActive,
                ]}
              >
                {cat.categoryName}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Section Header */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeaderTitle}>
            {selectedCategory
              ? (categories || []).find((c) => c.categoryId === selectedCategory)?.categoryName || 'Menu Selection'
              : 'Popular Dishes'}
          </Text>

          <Text style={styles.itemCountBadge}>
            {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'}
          </Text>
        </View>

        {loading ? (
          <View style={styles.loaderBox}>
            <ActivityIndicator size="large" color="#D33401" />
            <Text style={styles.loaderText}>Loading menu...</Text>
          </View>
        ) : filteredItems.length === 0 ? (
          <View style={styles.emptyBox}>
            <View style={styles.emptyIconCircle}>
              <Search size={26} color="#94A3B8" strokeWidth={2} />
            </View>
            <Text style={styles.emptyTitle}>No Dishes Found</Text>
            <Text style={styles.emptySub}>
              {searchQuery.trim()
                ? `We couldn't find any dish matching "${searchQuery.trim()}".`
                : 'No items match your dietary or category filter.'}
            </Text>
            {(Boolean(searchQuery.trim()) || vegOnly || selectedCategory !== null) && (
              <TouchableOpacity
                style={styles.emptyResetBtn}
                onPress={() => {
                  setSearchQuery('');
                  setVegOnly(false);
                  setSelectedCategory(null);
                }}
                activeOpacity={0.85}
              >
                <X size={13} color="#D33401" strokeWidth={2.5} />
                <Text style={styles.emptyResetBtnText}>Clear All Filters</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View
            style={
              styles.grid
            }
          >
            {filteredItems.map(
              (item) => {
                const cartItem =
                  getCartItem(
                    item.itemId
                  );

                const qty =
                  getCartQuantity(
                    item.itemId
                  );

                const unitPrice =
                  getUnitPrice(
                    item,
                    cartItem
                  );

                const unitName =
                  getUnitName(
                    item,
                    cartItem
                  );

                const itemBusy =
                  !!actionLoading[
                    item.itemId
                  ];

                const imageUrl =
                  getDisplayImage(
                    item,
                    cartItem
                  );

                const dietLabel =
                  item.isVeg
                    ? 'Veg'
                    : 'Non-Veg';

                return (
                  <View
                    key={
                      item.itemId
                    }
                    style={
                      styles.card
                    }
                  >
                    <TouchableOpacity
                      style={styles.cardTopArea}
                      activeOpacity={0.9}
                      onPress={() => {
                        if (
                          item.isAvailable &&
                          qty === 0 &&
                          (!storeOperatingStatus || storeOperatingStatus.canPlaceOrder !== false)
                        ) {
                          runItemAction(
                            item.itemId,
                            () =>
                              onAddToCart(
                                item.itemId,
                                1,
                                item
                              )
                          );
                        }
                      }}
                    >
                      <ItemImageWithFallback
                        uri={imageUrl}
                        style={styles.itemImage}
                        resizeMode="cover"
                      />

                      <View style={styles.cardHeaderRow}>
                        <View
                          style={[
                            styles.dietBadge,
                            item.isVeg
                              ? styles.vegBadgeBorder
                              : styles.nonVegBadgeBorder,
                          ]}
                        >
                          <View
                            style={[
                              styles.dietDot,
                              {
                                backgroundColor:
                                  item.isVeg
                                    ? COLORS.green
                                    : COLORS.red,
                              },
                            ]}
                          />
                        </View>

                        <Text
                          style={[
                            styles.itemDietLabel,
                            item.isVeg
                              ? styles.vegLabel
                              : styles.nonVegLabel,
                          ]}
                          numberOfLines={1}
                        >
                          {dietLabel}
                        </Text>

                        <View style={styles.ratingPill}>
                          <Text style={styles.ratingText}>★ 4.9</Text>
                        </View>
                      </View>

                      <View style={styles.cardBody}>
                        <Text
                          style={styles.itemName}
                          numberOfLines={2}
                        >
                          {item.itemName}
                        </Text>

                        {item.description ? (
                          <Text
                            style={styles.itemDesc}
                            numberOfLines={2}
                          >
                            {item.description}
                          </Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>

                    <View style={styles.cardBottomRow}>
                      <View style={styles.priceContainer}>
                        <View style={styles.priceWithUnitRow}>
                          <Text style={styles.itemPrice}>
                            ₹
                            {Math.round(unitPrice) === unitPrice
                              ? unitPrice
                              : unitPrice.toFixed(0)}
                          </Text>

                          {unitName ? (
                            <Text style={styles.unitPerText}>
                              /{unitName}
                            </Text>
                          ) : null}
                        </View>
                      </View>

                      {!item.isAvailable ? (
                        <View style={styles.soldOutBadge}>
                          <Text style={styles.soldOutText}>
                            Sold Out
                          </Text>
                        </View>
                      ) : qty > 0 ? (
                        <View style={styles.qtyControlRow}>
                          <TouchableOpacity
                            style={styles.qtyActionBtn}
                            onPress={(e) => {
                              e?.stopPropagation?.();
                              runItemAction(
                                item.itemId,
                                () =>
                                  onUpdateCartQuantity(
                                    item.itemId,
                                    qty - 1
                                  )
                              );
                            }}
                            activeOpacity={0.7}
                          >
                            <Minus
                              size={13}
                              color={COLORS.text}
                            />
                          </TouchableOpacity>

                          <View style={styles.qtyLabelWrap}>
                            <Text style={styles.qtyActionText}>
                              {qty}
                            </Text>
                          </View>

                          <TouchableOpacity
                            style={[
                              styles.qtyActionBtn,
                              Boolean(storeOperatingStatus && !storeOperatingStatus.canPlaceOrder) &&
                                styles.qtyBtnBusy,
                            ]}
                            onPress={(e) => {
                              e?.stopPropagation?.();
                              runItemAction(
                                item.itemId,
                                () =>
                                  onUpdateCartQuantity(
                                    item.itemId,
                                    qty + 1
                                  )
                              );
                            }}
                            disabled={
                              Boolean(storeOperatingStatus && !storeOperatingStatus.canPlaceOrder)
                            }
                            activeOpacity={0.7}
                          >
                            <Plus
                              size={13}
                              color={COLORS.text}
                            />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={[
                            styles.addBtn,
                            Boolean(storeOperatingStatus && !storeOperatingStatus.canPlaceOrder) &&
                              styles.addBtnDisabled,
                          ]}
                          onPress={(e) => {
                            e?.stopPropagation?.();
                            runItemAction(
                              item.itemId,
                              () =>
                                onAddToCart(
                                  item.itemId,
                                  1,
                                  item
                                )
                            );
                          }}
                          disabled={
                            Boolean(storeOperatingStatus && !storeOperatingStatus.canPlaceOrder)
                          }
                          activeOpacity={0.8}
                        >
                          <Plus
                            size={16}
                            color={COLORS.white}
                          />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              }
            )}
          </View>
        )}
      </ScrollView>

      {totalCartCount > 0 && (
        <View
          style={
            styles.floatingCartBarWrapper
          }
        >
          <TouchableOpacity
            style={
              styles.floatingCartBar
            }
            onPress={
              openCart
            }
            activeOpacity={0.9}
          >
            <View
              style={
                styles.cartCountCircle
              }
            >
              <Text
                style={
                  styles.cartCountCircleText
                }
              >
                {
                  totalCartCount
                }
              </Text>
            </View>

            <Text
              style={
                styles.cartCenterText
              }
            >
              {totalCartCount ===
              1
                ? '1 Item Added'
                : `${totalCartCount} Items Added`}
            </Text>

            <View
              style={
                styles.cartRightBox
              }
            >
              <Text
                style={
                  styles.cartRightAmount
                }
              >
                ₹
                {Math.round(
                  totalCartAmount
                ) ===
                totalCartAmount
                  ? totalCartAmount
                  : totalCartAmount.toFixed(
                      0
                    )}
              </Text>

              <ChevronUp
                size={20}
                color={
                  COLORS.white
                }
              />
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* FLOATING LIVE KITCHEN PROGRESS BAR */}
      {liveOrder && !['Cancelled', 'Settled'].includes(liveOrder.orderStatus) && (() => {
        const orderId = Number(liveOrder.id || liveOrder.orderId || 0);
        if (orderId && dismissedOrderIds.has(orderId)) return null;

        const kSt = String(liveOrder.kitchenStatus || '').toLowerCase();
        const oSt = String(liveOrder.orderStatus || '').toLowerCase();

        const isKitchenActive = isLiveKitchenActive(liveOrder, catalog, storeOperatingStatus);
        const isKitchenDisabled = !isKitchenActive;

        const isServed = kSt.includes('serve') || oSt.includes('serve') || kSt.includes('deliver') || oSt.includes('deliver') || kSt.includes('complete') || oSt.includes('complete') || kSt.includes('settled') || oSt.includes('settled');
        const isReady = !isServed && (kSt.includes('ready') || oSt.includes('ready'));
        const isCooking = !isKitchenDisabled && !isServed && !isReady && (kSt.includes('prep') || oSt.includes('prep') || kSt.includes('cook') || oSt.includes('cook') || kSt.includes('kitchen') || oSt.includes('kitchen'));

        const prepCountdown = getDecreasingPreparationCountdown(liveOrder, catalog, storeOperatingStatus);
        const isAwaiting = prepCountdown.isAwaitingConfirmation;

        return (
          <View style={[styles.floatingLiveOrderWrapper, totalCartCount > 0 && styles.floatingLiveOrderWrapperWithCart]}>
            <TouchableOpacity
              style={[
                styles.floatingLiveOrderBar,
                isServed
                  ? styles.liveOrderBarServed
                  : isReady
                  ? styles.liveOrderBarReady
                  : isCooking
                  ? styles.liveOrderBarCooking
                  : isAwaiting
                  ? styles.liveOrderBarAwaiting
                  : styles.liveOrderBarPlaced,
              ]}
              onPress={() => {
                if (typeof openOrderTracker === 'function') openOrderTracker();
              }}
              activeOpacity={0.9}
            >
              <View style={styles.liveOrderLeftIconWrap}>
                {isServed ? (
                  <Check size={18} color="#ffffff" />
                ) : isReady ? (
                  <Bell size={18} color="#ffffff" />
                ) : isCooking ? (
                  <Flame size={18} color="#ffffff" />
                ) : isAwaiting ? (
                  <Clock size={18} color="#ffffff" />
                ) : (
                  <Utensils size={18} color="#ffffff" />
                )}
              </View>

              <View style={{ flex: 1, paddingHorizontal: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.liveOrderTitleText}>
                    Order #{orderId}
                  </Text>
                  <View style={[
                    styles.liveOrderPillBadge,
                    isAwaiting && styles.liveOrderPillBadgeAwaiting,
                  ]}>
                    <Text style={styles.liveOrderPillBadgeText}>
                      {isServed
                        ? 'Served to Table'
                        : isReady
                        ? (prepCountdown.shortFormatted || 'Ready to Serve')
                        : isKitchenDisabled
                        ? (isAwaiting ? 'Awaiting Approval' : 'Confirmed')
                        : isCooking
                        ? `Cooking • ${prepCountdown.shortFormatted}`
                        : isAwaiting
                        ? 'Awaiting Approval'
                        : `Queued • ${prepCountdown.shortFormatted}`}
                    </Text>
                  </View>
                </View>

                <Text style={styles.liveOrderSubtitleText} numberOfLines={1}>
                  {prepCountdown.statusMessage}
                </Text>
              </View>

              <View style={styles.liveOrderActionWrap}>
                <Text style={styles.liveOrderActionText}>Track</Text>
                <ChevronRight size={15} color="#ffffff" />
              </View>

              {isServed && (
                <TouchableOpacity
                  style={styles.liveOrderDismissBtn}
                  onPress={(e) => {
                    e.stopPropagation();
                    setDismissedOrderIds((prev) => new Set([...prev, orderId]));
                  }}
                  accessibilityLabel="Dismiss order bar"
                >
                  <X size={15} color="#ffffff" />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          </View>
        );
      })()}
    </View>
  );
}

const styles = StyleSheet.create({
  rootWrapper: {
    flex: 1,
    backgroundColor:
      COLORS.background,
    position: 'relative',
  },
  container: {
    flex: 1,
    backgroundColor:
      COLORS.background,
  },
  contentContainer: {
    maxWidth: 1280,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 110,
  },
  categoriesScroll: {
    marginBottom: 16,
  },
  categoriesContainer: {
    gap: 8,
    paddingRight: 10,
  },
  categoryChip: {
    backgroundColor:
      COLORS.orangeLight,
    borderWidth: 1,
    borderColor: '#F8E1D2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 22,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryChipActive: {
    backgroundColor:
      COLORS.orange,
    borderColor:
      COLORS.orange,
    shadowColor:
      COLORS.orange,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    elevation: 2,
  },
  categoryChipText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
  },
  categoryChipTextActive: {
    color: COLORS.white,
    fontWeight: '700',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
    maxWidth: 680,
    width: '100%',
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 10,
    height: 48,
    shadowColor: '#0F172A',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  searchBoxFocused: {
    borderColor: '#D33401',
    backgroundColor: '#FFFFFF',
    shadowColor: '#D33401',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  searchIconBadge: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  searchIconBadgeActive: {
    backgroundColor: '#FFF1EC',
  },
  searchInput: {
    flex: 1,
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: -0.2,
    height: '100%',
    paddingVertical: 0,
    outlineStyle: 'none',
  },
  searchRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  searchCountBadge: {
    backgroundColor: '#FFF1EC',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F3C8BA',
  },
  searchCountText: {
    color: '#D33401',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  searchClearBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vegToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    height: 48,
    borderRadius: 16,
    flexShrink: 0,
    shadowColor: '#0F172A',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  vegToggleActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#22C55E',
    shadowColor: '#22C55E',
    shadowOpacity: 0.12,
  },
  vegDotBorder: {
    width: 14,
    height: 14,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vegDotBorderActive: {
    borderColor: '#16A34A',
  },
  vegDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#94A3B8',
  },
  vegDotActive: {
    backgroundColor: '#16A34A',
  },
  vegText: {
    color: '#64748B',
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  vegTextActive: {
    color: '#15803D',
    fontWeight: '800',
  },
  activeFilterRow: {
    maxWidth: 680,
    width: '100%',
    marginBottom: 14,
  },
  activeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF7F2',
    borderWidth: 1,
    borderColor: '#FDBA74',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  activeFilterLabel: {
    fontSize: 12,
    color: '#7C2D12',
    fontWeight: '500',
    flexShrink: 1,
  },
  activeFilterQuery: {
    fontWeight: '800',
    color: '#C2410C',
  },
  activeFilterClearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDBA74',
    marginLeft: 8,
    flexShrink: 0,
  },
  activeFilterClearText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#C2410C',
  },
  controlsRowSmallMobile: {
    gap: 6,
    marginBottom: 10,
  },
  controlsRowDesktop: {
    maxWidth: 720,
    gap: 12,
  },
  searchBoxSmallMobile: {
    height: 44,
    borderRadius: 14,
    paddingHorizontal: 8,
    gap: 6,
  },
  searchBoxDesktop: {
    height: 50,
    borderRadius: 18,
    paddingHorizontal: 14,
  },
  searchIconBadgeSmallMobile: {
    width: 28,
    height: 28,
    borderRadius: 8,
  },
  searchInputSmallMobile: {
    fontSize: 13,
  },
  searchCountBadgeSmallMobile: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
  },
  searchCountTextSmallMobile: {
    fontSize: 9.5,
  },
  searchClearBtnSmallMobile: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  desktopKbdPill: {
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 2,
  },
  desktopKbdText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  vegToggleSmallMobile: {
    height: 44,
    borderRadius: 14,
    paddingHorizontal: 8,
    gap: 4,
  },
  vegToggleDesktop: {
    height: 50,
    borderRadius: 18,
    paddingHorizontal: 14,
  },
  vegTextSmallMobile: {
    fontSize: 11.5,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent:
      'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionHeaderTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  itemCountBadge: {
    color:
      COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent:
      'flex-start',
  },
  card: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 155,
    minWidth: 140,
    maxWidth: 295,
    minHeight: 310,
    backgroundColor:
      COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F0ECE9',
    padding: 10,
    justifyContent:
      'space-between',
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardSkeleton: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 155,
    minWidth: 140,
    maxWidth: 295,
    minHeight: 280,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    justifyContent: 'space-between',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  cardTopArea: {
    flex: 1,
    width: '100%',
  },
  cardTouchable: {
    flex: 1,
    width: '100%',
  },
  itemImage: {
    width: '100%',
    height: 140,
    borderRadius: 12,
    marginBottom: 10,
    backgroundColor:
      COLORS.placeholder,
  },
  imagePlaceholder: {
    width: '100%',
    height: 140,
    borderRadius: 12,
    marginBottom: 10,
    alignItems: 'center',
    justifyContent:
      'center',
    backgroundColor:
      COLORS.placeholder,
  },
  imagePlaceholderText: {
    color:
      COLORS.textMuted,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
    flexWrap: 'nowrap',
  },
  dietBadge: {
    width: 14,
    height: 14,
    borderWidth: 1.5,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent:
      'center',
    backgroundColor:
      COLORS.white,
    flexShrink: 0,
  },
  vegBadgeBorder: {
    borderColor:
      COLORS.green,
  },
  nonVegBadgeBorder: {
    borderColor:
      COLORS.red,
  },
  dietDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  itemDietLabel: {
    flex: 1,
    fontSize: 10,
    fontWeight: '700',
    textTransform:
      'uppercase',
    letterSpacing: 0.4,
  },
  vegLabel: {
    color:
      COLORS.green,
  },
  nonVegLabel: {
    color:
      COLORS.red,
  },
  ratingPill: {
    backgroundColor:
      COLORS.orangeSoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    flexShrink: 0,
  },
  ratingText: {
    color:
      COLORS.orangeDark,
    fontSize: 9,
    fontWeight: '700',
  },
  cardBody: {
    flex: 1,
    justifyContent:
      'center',
    marginVertical: 2,
  },
  itemName: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18,
    letterSpacing: -0.2,
  },
  itemDesc: {
    color:
      COLORS.textSecondary,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 3,
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:
      'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor:
      '#F3EFEC',
    minHeight: 44,
    gap: 6,
  },
  priceContainer: {
    justifyContent:
      'center',
    flexShrink: 1,
    minWidth: 0,
  },
  priceWithUnitRow: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  itemPrice: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
    lineHeight: 18,
  },
  unitPerText: {
    color:
      COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 1,
    lineHeight: 12,
  },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor:
      COLORS.orange,
    alignItems: 'center',
    justifyContent:
      'center',
    shadowColor:
      COLORS.orange,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.22,
    shadowRadius: 4,
    elevation: 3,
    flexShrink: 0,
  },
  addBtnDisabled: {
    backgroundColor: '#D1D5DB',
    shadowOpacity: 0,
    elevation: 0,
    opacity: 0.6,
  },
  qtyControlRow: {
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor:
      COLORS.orangeLight,
    borderRadius: 17,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor:
      '#F7D9C6',
    flexShrink: 0,
  },
  qtyActionBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor:
      COLORS.white,
    alignItems: 'center',
    justifyContent:
      'center',
  },
  qtyBtnBusy: {
    opacity: 0.5,
  },
  qtyLabelWrap: {
    alignItems: 'center',
    justifyContent:
      'center',
    paddingHorizontal: 2,
    minWidth: 20,
    height: 24,
  },
  qtyActionText: {
    color: COLORS.text,
    fontWeight: '800',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 14,
  },
  soldOutBadge: {
    backgroundColor:
      COLORS.gray,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
    flexShrink: 0,
  },
  soldOutText: {
    color:
      COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },
  floatingCartBarWrapper: {
    position: 'absolute',
    bottom: 16,
    left: 14,
    right: 14,
    zIndex: 999,
    alignItems: 'center',
  },
  floatingCartBar: {
    width: '100%',
    maxWidth: 480,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:
      'space-between',
    backgroundColor:
      COLORS.orange,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor:
      COLORS.orange,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 7,
  },
  cartCountCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor:
      COLORS.white,
    alignItems: 'center',
    justifyContent:
      'center',
  },
  cartCountCircleText: {
    color:
      COLORS.orangeDark,
    fontWeight: '800',
    fontSize: 13,
  },
  cartCenterText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  cartRightBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cartRightAmount: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '800',
  },
  loaderBox: {
    alignItems: 'center',
    justifyContent:
      'center',
    paddingVertical: 50,
  },
  loaderText: {
    color:
      COLORS.textSecondary,
    marginTop: 10,
    fontSize: 13,
    textAlign: 'center',
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 44,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 24,
    marginVertical: 12,
  },
  emptyIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    color: '#0F172A',
    fontSize: 16.5,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySub: {
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 19,
    marginBottom: 16,
  },
  emptyResetBtn: {
    backgroundColor: '#FFF1EC',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3C8BA',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  emptyResetBtnText: {
    color: '#D33401',
    fontSize: 12.5,
    fontWeight: '800',
  },
  restaurantHeroCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EAE6E1',
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  restaurantHeroCover: {
    width: '100%',
    height: 145,
    backgroundColor: COLORS.softGray,
  },
  restaurantHeroCoverPlaceholder: {
    width: '100%',
    height: 90,
    backgroundColor: '#FAF5EE',
    position: 'relative',
    overflow: 'hidden',
  },
  heroPatternOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F3EAE0',
    opacity: 0.6,
  },
  restaurantHeroBody: {
    padding: 16,
  },
  restaurantHeroHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  restaurantLogoWrapper: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    flexShrink: 0,
    overflow: 'hidden',
  },
  restaurantLogo: {
    width: '100%',
    height: '100%',
  },
  restaurantLogoFallback: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: COLORS.orange,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.orange,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
    flexShrink: 0,
  },
  restaurantHeroText: {
    flex: 1,
    minWidth: 0,
  },
  restaurantTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  restaurantHeroTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1B1C1C',
    letterSpacing: -0.4,
  },
  restaurantAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  restaurantHeroAddress: {
    fontSize: 12.5,
    color: '#6B6661',
    fontWeight: '500',
    flex: 1,
    lineHeight: 17,
  },
  heroStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  heroStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  heroStatusPillOpen: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  heroStatusPillPaused: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  heroStatusPillClosed: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  heroStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  heroStatusDotOpen: {
    backgroundColor: '#10B981',
  },
  heroStatusDotPaused: {
    backgroundColor: '#F59E0B',
  },
  heroStatusDotClosed: {
    backgroundColor: '#EF4444',
  },
  heroStatusText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  heroStatusTextOpen: {
    color: '#047857',
  },
  heroStatusTextPaused: {
    color: '#B45309',
  },
  heroStatusTextClosed: {
    color: '#B91C1C',
  },
  heroFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 8,
  },
  tableBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF1EC',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: '#F3C8BA',
  },
  tableBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#D33401',
  },
  tableActionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F5F2EE',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5DFD7',
  },
  heroActionBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#383431',
  },
  storeStatusBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
  },
  storeStatusBannerPaused: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  storeStatusBannerClosed: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  storeStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
  },
  storeStatusDotPaused: {
    backgroundColor: '#D97706',
  },
  storeStatusDotClosed: {
    backgroundColor: '#DC2626',
  },
  storeStatusBannerTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  storeStatusBannerTitlePaused: {
    color: '#B45309',
  },
  storeStatusBannerTitleClosed: {
    color: '#B91C1C',
  },
  storeStatusBannerSubtitle: {
    fontSize: 11,
    color: '#78716C',
    marginTop: 2,
    lineHeight: 15,
  },
  floatingLiveOrderWrapper: {
    position: 'absolute',
    bottom: 20,
    left: 14,
    right: 14,
    maxWidth: 600,
    alignSelf: 'center',
    zIndex: 999,
  },
  floatingLiveOrderWrapperWithCart: {
    bottom: 84,
  },
  floatingLiveOrderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  liveOrderBarAwaiting: {
    backgroundColor: '#b45309',
  },
  liveOrderBarPlaced: {
    backgroundColor: '#0284c7',
  },
  liveOrderBarCooking: {
    backgroundColor: '#ea580c',
  },
  liveOrderBarReady: {
    backgroundColor: '#7c3aed',
  },
  liveOrderBarServed: {
    backgroundColor: '#15803d',
  },
  liveOrderLeftIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveOrderTitleText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  liveOrderPillBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  liveOrderPillBadgeAwaiting: {
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
  },
  liveOrderPillBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  liveOrderSubtitleText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  liveOrderActionWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 2,
  },
  liveOrderDismissBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  liveOrderActionText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
});