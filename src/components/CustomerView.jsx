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
} from 'lucide-react';
import {
  getUnitDescription,
  getItemImageUrl,
  getOriginalImageUrl,
  IMAGE_NOT_AVAILABLE,
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
          height={44}
          borderRadius={14}
          style={{ flex: 1 }}
        />
        <SkeletonBox
          width={72}
          height={44}
          borderRadius={14}
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

function ItemImageWithFallback({ uri, style, resizeMode = 'cover' }) {
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
}

export default function CustomerView({
  catalog,
  categories,
  items,
  activeTable,
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
  const [vegOnly, setVegOnly] = useState(false);
  const [actionLoading, setActionLoading] = useState({});

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

  const totalCartCount =
    (cartItems || []).reduce(
      (acc, item) =>
        acc + (Number(item.quantity) || 1),
      0
    );

  const totalCartAmount =
    (cartItems || []).reduce(
      (acc, item) =>
        acc +
        (
          Number(
            item.unitPrice ??
            item.amount ??
            0
          ) || 0
        ) *
        (Number(item.quantity) || 1),
      0
    );

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
      cartItem?.unitPrice ??
      cartItem?.amount ??
      item?.unitPrice ??
      item?.price ??
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
      cartItem?.imageUrl ||
      item?.imageUrl ||
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
        <View style={styles.controlsRow}>
          <View style={styles.searchBox}>
            <Search size={18} color="#64748B" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search food, drinks, desserts..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <TouchableOpacity
            style={[
              styles.vegToggle,
              vegOnly && styles.vegToggleActive,
            ]}
            onPress={() => setVegOnly(!vegOnly)}
            activeOpacity={0.85}
          >
            <View style={[styles.vegDot, vegOnly && styles.vegDotActive]} />
            <Text
              style={[
                styles.vegText,
                vegOnly && styles.vegTextActive,
              ]}
            >
              Veg
            </Text>
          </TouchableOpacity>
        </View>

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
            <Text style={styles.emptyTitle}>No Dishes Found</Text>
            <Text style={styles.emptySub}>
              No items match your search or dietary filter.
            </Text>
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
                      style={
                        styles.cardTouchable
                      }
                      activeOpacity={0.75}
                      onPress={() => {
                        if (
                          item.isAvailable &&
                          qty === 0
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
                        uri={
                          imageUrl
                        }
                        style={
                          styles.itemImage
                        }
                        resizeMode="cover"
                      />

                      <View
                        style={
                          styles.cardHeaderRow
                        }
                      >
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
                          {
                            dietLabel
                          }
                        </Text>

                        <View
                          style={
                            styles.ratingPill
                          }
                        >
                          <Text
                            style={
                              styles.ratingText
                            }
                          >
                            ★ 4.9
                          </Text>
                        </View>
                      </View>

                      <View
                        style={
                          styles.cardBody
                        }
                      >
                        <Text
                          style={
                            styles.itemName
                          }
                          numberOfLines={2}
                        >
                          {
                            item.itemName
                          }
                        </Text>

                        {item.description ? (
                          <Text
                            style={
                              styles.itemDesc
                            }
                            numberOfLines={2}
                          >
                            {
                              item.description
                            }
                          </Text>
                        ) : null}
                      </View>

                      <View
                        style={
                          styles.cardBottomRow
                        }
                      >
                        <View
                          style={
                            styles.priceContainer
                          }
                        >
                          <View
                            style={
                              styles.priceWithUnitRow
                            }
                          >
                            <Text
                              style={
                                styles.itemPrice
                              }
                            >
                              ₹
                              {Math.round(
                                unitPrice
                              ) ===
                              unitPrice
                                ? unitPrice
                                : unitPrice.toFixed(
                                    0
                                  )}
                            </Text>

                            {unitName ? (
                              <Text
                                style={
                                  styles.unitPerText
                                }
                              >
                                /{unitName}
                              </Text>
                            ) : null}
                          </View>
                        </View>

                        {!item.isAvailable ? (
                          <View
                            style={
                              styles.soldOutBadge
                            }
                          >
                            <Text
                              style={
                                styles.soldOutText
                              }
                            >
                              Sold Out
                            </Text>
                          </View>
                        ) : qty > 0 ? (
                          <View
                            style={
                              styles.qtyControlRow
                            }
                          >
                            <TouchableOpacity
                              style={[
                                styles.qtyActionBtn,
                                itemBusy &&
                                  styles.qtyBtnBusy,
                              ]}
                              onPress={() =>
                                runItemAction(
                                  item.itemId,
                                  () =>
                                    onUpdateCartQuantity(
                                      item.itemId,
                                      qty - 1
                                    )
                                )
                              }
                              disabled={
                                itemBusy
                              }
                            >
                              <Minus
                                size={13}
                                color={
                                  COLORS.text
                                }
                              />
                            </TouchableOpacity>

                            <View
                              style={
                                styles.qtyLabelWrap
                              }
                            >
                              <Text
                                style={
                                  styles.qtyActionText
                                }
                              >
                                {itemBusy
                                  ? '…'
                                  : qty}
                              </Text>
                            </View>

                            <TouchableOpacity
                              style={[
                                styles.qtyActionBtn,
                                (itemBusy || Boolean(storeOperatingStatus && !storeOperatingStatus.canPlaceOrder)) &&
                                  styles.qtyBtnBusy,
                              ]}
                              onPress={() =>
                                runItemAction(
                                  item.itemId,
                                  () =>
                                    onUpdateCartQuantity(
                                      item.itemId,
                                      qty + 1
                                    )
                                )
                              }
                              disabled={
                                itemBusy || Boolean(storeOperatingStatus && !storeOperatingStatus.canPlaceOrder)
                              }
                            >
                              <Plus
                                size={13}
                                color={
                                  COLORS.text
                                }
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
                            onPress={() =>
                              runItemAction(
                                item.itemId,
                                () =>
                                  onAddToCart(
                                    item.itemId,
                                    1,
                                    item
                                  )
                              )
                            }
                            disabled={
                              itemBusy || Boolean(storeOperatingStatus && !storeOperatingStatus.canPlaceOrder)
                            }
                          >
                            {itemBusy ? (
                              <ActivityIndicator
                                size="small"
                                color={
                                  COLORS.white
                                }
                              />
                            ) : (
                              <Plus
                                size={16}
                                color={
                                  COLORS.white
                                }
                              />
                            )}
                          </TouchableOpacity>
                        )}
                      </View>
                    </TouchableOpacity>
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
    gap: 8,
    marginBottom: 18,
    maxWidth: 680,
    width: '100%',
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor:
      COLORS.white,
    borderWidth: 1,
    borderColor:
      COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 44,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.03,
    shadowRadius: 4,
  },
  searchInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 13,
    outlineStyle: 'none',
  },
  vegToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor:
      COLORS.white,
    borderWidth: 1,
    borderColor:
      COLORS.border,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 14,
    flexShrink: 0,
  },
  vegToggleActive: {
    backgroundColor:
      COLORS.greenLight,
    borderColor: '#86EFAC',
  },
  vegDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor:
      COLORS.green,
  },
  vegText: {
    color:
      COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  vegTextActive: {
    color: COLORS.green,
    fontWeight: '700',
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
  cardTouchable: {
    flex: 1,
    justifyContent:
      'space-between',
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
    gap: 6,
  },
  priceContainer: {
    justifyContent:
      'center',
    flexShrink: 1,
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
  },
  unitPerText: {
    color:
      COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 1,
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor:
      COLORS.orangeLight,
    borderRadius: 18,
    paddingHorizontal: 5,
    paddingVertical: 3,
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
    minWidth: 24,
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
    justifyContent:
      'center',
    paddingVertical: 50,
    backgroundColor:
      COLORS.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor:
      COLORS.border,
    padding: 24,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  emptySub: {
    color:
      COLORS.textSecondary,
    fontSize: 12,
    textAlign: 'center',
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
});