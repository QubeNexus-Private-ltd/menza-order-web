import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import {
  Search,
  Plus,
  Minus,
  Bell,
  FileText,
  QrCode,
  Store,
  UtensilsCrossed,
  ShoppingBag,
  ChevronUp,
  ImageOff,
  Home as HomeIcon,
  Receipt,
  LayoutGrid,
} from 'lucide-react';
import { getUnitDescription, IMAGE_NOT_AVAILABLE } from '../services/api';

function ItemImageWithFallback({ uri, style, resizeMode = 'cover' }) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [uri]);

  const hasValidUri = uri && typeof uri === 'string' && uri.trim() !== '' && uri !== IMAGE_NOT_AVAILABLE;

  if (!hasValidUri || hasError) {
    return null; // For minimalist card style matching screen.png, images are optional or subtle
  }

  return (
    <Image
      source={{ uri }}
      style={style}
      resizeMode={resizeMode}
      onError={() => setHasError(true)}
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
}) {
  const [selectedChannel, setSelectedChannel] = useState(activeTable ? 'dinein' : 'counter');
  const [selectedCategory, setSelectedCategory] = useState(null); // null = All
  const [searchQuery, setSearchQuery] = useState('');
  const [vegOnly, setVegOnly] = useState(false);
  const [actionLoading, setActionLoading] = useState({});

  const restaurantName = catalog ? catalog.restaurantName || `Restaurant #${catalog.restaurantId}` : 'Saffron Café';

  const totalCartCount = (cartItems || []).reduce((acc, i) => acc + (i.quantity || 1), 0);
  const totalCartAmount = (cartItems || []).reduce((acc, i) => acc + (i.unitPrice || i.amount || 0) * (i.quantity || 1), 0);

  // Filter items based on selected category, search query, and veg toggle
  const filteredItems = items.filter((item) => {
    if (selectedCategory && item.categoryId !== selectedCategory) {
      return false;
    }
    if (vegOnly && !item.isVeg) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = item.itemName && item.itemName.toLowerCase().includes(q);
      const matchDesc = item.description && item.description.toLowerCase().includes(q);
      if (!matchName && !matchDesc) return false;
    }
    return true;
  });

  const getCartItem = (itemId) => {
    return (cartItems || []).find((c) => c.itemId === itemId) || null;
  };

  const getCartQuantity = (itemId) => {
    const found = getCartItem(itemId);
    return found ? Number(found.quantity || 0) : 0;
  };

  const getSubtitleTag = (item, cartItem) => {
    const variantName = item?.variantName || cartItem?.variantName || item?.sizeName || item?.size || '';
    if (variantName) return String(variantName).trim();

    const unitDesc = getUnitDescription(cartItem || item);
    if (unitDesc && !unitDesc.toLowerCase().includes('unit')) return unitDesc;

    if (item.categoryName) {
      const cat = item.categoryName.toLowerCase();
      if (cat.includes('chai') || cat.includes('coffee') || cat.includes('beverage')) return 'Hot';
      if (cat.includes('snack')) return 'Spicy';
      if (cat.includes('sweet') || cat.includes('dessert')) return 'Sweet';
      if (cat.includes('breakfast')) return 'Breakfast';
      return item.categoryName;
    }

    return item.isVeg ? 'Veg' : 'Non-Veg';
  };

  const getUnitPrice = (item, cartItem) => {
    const value =
      cartItem?.unitPrice ??
      cartItem?.amount ??
      item?.unitPrice ??
      item?.price ??
      0;
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  };

  const runItemAction = async (itemId, action) => {
    if (actionLoading[itemId]) return;
    setActionLoading((prev) => ({ ...prev, [itemId]: true }));
    try {
      await action();
    } catch (error) {
      console.error('Customer item action failed:', error);
    } finally {
      setActionLoading((prev) => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
    }
  };

  return (
    <View style={styles.rootWrapper}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Menza Culinary Hero Section */}
        <View style={styles.heroBanner}>
          <View style={styles.heroOverlay} />
          <View style={styles.heroContent}>
            <View style={styles.tableBadge}>
              <Text style={styles.tableBadgeText}>
                {activeTable ? `TABLE ${activeTable.id}` : 'SCAN & DINE'}
              </Text>
            </View>
            <Text style={styles.heroTitle}>Order from{'\n'}your table.</Text>
            <Text style={styles.heroSubtitle}>
              Scan, browse, and order directly to our kitchen. We'll handle the rest.
            </Text>
          </View>
        </View>

        {/* Row 1: Dining Channel Selector Pills (Counter, Dine-in, Takeaway) */}
        <View style={styles.channelRow}>
          <TouchableOpacity
            style={[styles.channelPill, selectedChannel === 'counter' && styles.channelPillActive]}
            onPress={() => setSelectedChannel('counter')}
            activeOpacity={0.85}
          >
            <Store
              size={16}
              color={selectedChannel === 'counter' ? '#ffffff' : '#1b1c1c'}
            />
            <Text
              style={[
                styles.channelPillText,
                selectedChannel === 'counter' && styles.channelPillTextActive,
              ]}
            >
              Counter
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.channelPill, selectedChannel === 'dinein' && styles.channelPillActive]}
            onPress={() => {
              setSelectedChannel('dinein');
              if (!activeTable && openScanner) {
                openScanner();
              }
            }}
            activeOpacity={0.85}
          >
            <UtensilsCrossed
              size={16}
              color={selectedChannel === 'dinein' ? '#ffffff' : '#1b1c1c'}
            />
            <Text
              style={[
                styles.channelPillText,
                selectedChannel === 'dinein' && styles.channelPillTextActive,
              ]}
            >
              {activeTable ? `Dine-in #${activeTable.id}` : 'Dine-in'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.channelPill, selectedChannel === 'takeaway' && styles.channelPillActive]}
            onPress={() => setSelectedChannel('takeaway')}
            activeOpacity={0.85}
          >
            <ShoppingBag
              size={16}
              color={selectedChannel === 'takeaway' ? '#ffffff' : '#1b1c1c'}
            />
            <Text
              style={[
                styles.channelPillText,
                selectedChannel === 'takeaway' && styles.channelPillTextActive,
              ]}
            >
              Takeaway
            </Text>
          </TouchableOpacity>
        </View>

        {/* Row 2: Category Filter Chips Slider (All, Starters, Mains, Sides, Drinks...) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoriesScroll}
          contentContainerStyle={styles.categoriesContainer}
        >
          <TouchableOpacity
            style={[styles.categoryChip, selectedCategory === null && styles.categoryChipActive]}
            onPress={() => setSelectedCategory(null)}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.categoryChipText,
                selectedCategory === null && styles.categoryChipTextActive,
              ]}
            >
              All
            </Text>
          </TouchableOpacity>

          {categories.map((cat) => (
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

        {/* Controls Bar: Search & Veg Filter */}
        <View style={styles.controlsRow}>
          <View style={styles.searchBox}>
            <Search size={16} color="#747878" />
            <TextInput
              style={styles.searchInput}
              placeholder={`Search dishes in ${restaurantName}...`}
              placeholderTextColor="#9ca3af"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Veg Only Toggle */}
          <TouchableOpacity
            style={[styles.vegToggle, vegOnly && styles.vegToggleActive]}
            onPress={() => setVegOnly(!vegOnly)}
            activeOpacity={0.85}
          >
            <View style={[styles.vegDot, { backgroundColor: '#15803d' }]} />
            <Text style={[styles.vegText, vegOnly && styles.vegTextActive]}>Veg</Text>
          </TouchableOpacity>
        </View>

        {/* Section Heading */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeaderTitle}>
            {selectedCategory ? 'Menu Selection' : 'Popular Choice'}
          </Text>
          <Text style={styles.itemCountBadge}>
            {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'}
          </Text>
        </View>

        {/* Loading Indicator */}
        {loading ? (
          <View style={styles.loaderBox}>
            <ActivityIndicator size="large" color="#D33401" />
            <Text style={styles.loaderText}>Loading culinary catalog for {restaurantName}...</Text>
          </View>
        ) : filteredItems.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>No Items Found</Text>
            <Text style={styles.emptySub}>No dishes match your filter in {restaurantName}.</Text>
          </View>
        ) : (
          /* Items Responsive Grid in Menza Culinary System */
          <View style={styles.grid}>
            {filteredItems.map((item) => {
              const cartItem = getCartItem(item.itemId);
              const qty = getCartQuantity(item.itemId);
              const unitPrice = getUnitPrice(item, cartItem);
              const tag = getSubtitleTag(item, cartItem);
              const itemBusy = !!actionLoading[item.itemId];

              return (
                <View key={item.itemId} style={styles.card}>
                  <TouchableOpacity
                    style={styles.cardTouchable}
                    activeOpacity={0.75}
                    onPress={() => {
                      if (item.isAvailable && qty === 0) {
                        runItemAction(item.itemId, () => onAddToCart(item.itemId, 1, item));
                      }
                    }}
                  >
                    {/* Top Row: Veg/Non-Veg Badge & Subtitle Tag */}
                    <View style={styles.cardHeaderRow}>
                      <View style={[styles.dietBadge, item.isVeg ? styles.vegBadgeBorder : styles.nonVegBadgeBorder]}>
                        <View style={[styles.dietDot, { backgroundColor: item.isVeg ? '#15803d' : '#dc2626' }]} />
                      </View>

                      <Text style={styles.itemTag} numberOfLines={1}>
                        {tag}
                      </Text>

                      <View style={styles.ratingPill}>
                        <Text style={styles.ratingText}>★ 4.9</Text>
                      </View>
                    </View>

                    {/* Middle: Dish Title & Optional Description */}
                    <View style={styles.cardBody}>
                      <Text style={styles.itemName} numberOfLines={2}>
                        {item.itemName}
                      </Text>
                      {item.description ? (
                        <Text style={styles.itemDesc} numberOfLines={2}>
                          {item.description}
                        </Text>
                      ) : null}
                    </View>

                    {/* Bottom Row: Price (Left) & Add/Stepper Button (Right) */}
                    <View style={styles.cardBottomRow}>
                      <View style={styles.priceContainer}>
                        <Text style={styles.priceCurrency}>INR</Text>
                        <Text style={styles.itemPrice}>
                          ₹{Math.round(unitPrice) === unitPrice ? unitPrice : unitPrice.toFixed(0)}
                        </Text>
                      </View>

                      {/* Action Button */}
                      {!item.isAvailable ? (
                        <View style={styles.soldOutBadge}>
                          <Text style={styles.soldOutText}>Sold Out</Text>
                        </View>
                      ) : qty > 0 ? (
                        <View style={styles.qtyControlRow}>
                          <TouchableOpacity
                            style={[styles.qtyActionBtn, itemBusy && styles.qtyBtnBusy]}
                            onPress={() => runItemAction(item.itemId, () => onUpdateCartQuantity(item.itemId, qty - 1))}
                            disabled={itemBusy}
                          >
                            <Minus size={13} color="#1b1c1c" />
                          </TouchableOpacity>

                          <Text style={styles.qtyActionText}>{itemBusy ? '…' : qty}</Text>

                          <TouchableOpacity
                            style={[styles.qtyActionBtn, itemBusy && styles.qtyBtnBusy]}
                            onPress={() => runItemAction(item.itemId, () => onUpdateCartQuantity(item.itemId, qty + 1))}
                            disabled={itemBusy}
                          >
                            <Plus size={13} color="#1b1c1c" />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.addBtn}
                          onPress={() => runItemAction(item.itemId, () => onAddToCart(item.itemId, 1, item))}
                          disabled={itemBusy}
                        >
                          <Plus size={16} color="#ffffff" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Floating Bottom Cart Bar in Menza Flame Accent */}
      {totalCartCount > 0 && (
        <View style={styles.floatingCartBarWrapper}>
          <TouchableOpacity
            style={styles.floatingCartBar}
            onPress={openCart}
            activeOpacity={0.9}
          >
            {/* Left: White circular badge with count */}
            <View style={styles.cartCountCircle}>
              <Text style={styles.cartCountCircleText}>{totalCartCount}</Text>
            </View>

            {/* Center: "Items Added" */}
            <Text style={styles.cartCenterText}>
              {totalCartCount === 1 ? '1 Item Added' : `${totalCartCount} Items Added`}
            </Text>

            {/* Right: Total Amount & Up Chevron */}
            <View style={styles.cartRightBox}>
              <Text style={styles.cartRightAmount}>
                ₹{Math.round(totalCartAmount) === totalCartAmount ? totalCartAmount : totalCartAmount.toFixed(0)}
              </Text>
              <ChevronUp size={20} color="#ffffff" />
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Bottom Navigation Bar */}
      <View style={styles.bottomTabBar}>
        <TouchableOpacity style={styles.bottomTabItemActive} onPress={() => setSelectedCategory(null)}>
          <UtensilsCrossed size={18} color="#D33401" />
          <Text style={styles.bottomTabTextActive}>Menu</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.bottomTabItem} onPress={openCart}>
          <Receipt size={18} color="#747878" />
          <Text style={styles.bottomTabText}>Orders</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.bottomTabItem} onPress={openScanner}>
          <LayoutGrid size={18} color="#747878" />
          <Text style={styles.bottomTabText}>Tables</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rootWrapper: {
    flex: 1,
    backgroundColor: '#FBF9F9',
    position: 'relative',
  },
  container: {
    flex: 1,
    backgroundColor: '#FBF9F9',
  },
  contentContainer: {
    maxWidth: 1280,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 140,
  },

  /* Hero Section */
  heroBanner: {
    backgroundColor: '#1B1C1C',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
    padding: 24,
    minHeight: 170,
    justifyContent: 'flex-end',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#303031',
  },
  heroOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(27, 28, 28, 0.75)',
  },
  heroContent: {
    zIndex: 2,
  },
  tableBadge: {
    backgroundColor: 'rgba(255, 181, 160, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 181, 160, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  tableBadgeText: {
    color: '#ffb5a0',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 30,
    marginBottom: 6,
  },
  heroSubtitle: {
    color: '#E3E2E2',
    fontSize: 12,
    lineHeight: 18,
    maxWidth: 400,
  },

  /* Row 1: Channel Pills */
  channelRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
    maxWidth: 480,
    width: '100%',
  },
  channelPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EFEDED',
    borderWidth: 1,
    borderColor: '#E0DDD8',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 24,
  },
  channelPillActive: {
    backgroundColor: '#1B1C1C',
    borderColor: '#1B1C1C',
  },
  channelPillText: {
    color: '#1B1C1C',
    fontSize: 13,
    fontWeight: '700',
  },
  channelPillTextActive: {
    color: '#ffffff',
  },

  /* Row 2: Category Chips */
  categoriesScroll: {
    marginBottom: 16,
  },
  categoriesContainer: {
    gap: 8,
    paddingRight: 10,
  },
  categoryChip: {
    backgroundColor: '#EFEDED',
    borderWidth: 1,
    borderColor: '#E0DDD8',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  categoryChipActive: {
    backgroundColor: '#1B1C1C',
    borderColor: '#1B1C1C',
  },
  categoryChipText: {
    color: '#444748',
    fontSize: 13,
    fontWeight: '600',
  },
  categoryChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },

  /* Search & Veg controls */
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
    maxWidth: 680,
    width: '100%',
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0DDD8',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    color: '#1B1C1C',
    fontSize: 13,
    outlineStyle: 'none',
  },
  vegToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0DDD8',
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 14,
  },
  vegToggleActive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  vegDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  vegText: {
    color: '#747878',
    fontSize: 12,
    fontWeight: '600',
  },
  vegTextActive: {
    color: '#15803d',
    fontWeight: '700',
  },

  /* Section Header */
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionHeaderTitle: {
    color: '#1B1C1C',
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  itemCountBadge: {
    color: '#747878',
    fontSize: 12,
    fontWeight: '600',
  },

  /* Responsive Dish Grid for Laptop & Mobile */
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'flex-start',
  },
  card: {
    flexGrow: 1,
    flexShrink: 0,
    flexBasis: 220,
    maxWidth: 290,
    minWidth: 175,
    minHeight: 165,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0DDD8',
    padding: 16,
    justifyContent: 'space-between',
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
  },
  cardTouchable: {
    flex: 1,
    justifyContent: 'space-between',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  dietBadge: {
    width: 14,
    height: 14,
    borderWidth: 1.5,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vegBadgeBorder: {
    borderColor: '#15803d',
  },
  nonVegBadgeBorder: {
    borderColor: '#dc2626',
  },
  dietDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  itemTag: {
    color: '#747878',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
  },
  ratingPill: {
    backgroundColor: '#EFEDED',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ratingText: {
    color: '#D33401',
    fontSize: 10,
    fontWeight: '700',
  },
  cardBody: {
    flex: 1,
    justifyContent: 'center',
    marginVertical: 4,
  },
  itemName: {
    color: '#1B1C1C',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  itemDesc: {
    color: '#747878',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#EFEDED',
  },
  priceContainer: {
    justifyContent: 'center',
  },
  priceCurrency: {
    color: '#747878',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  itemPrice: {
    color: '#1B1C1C',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#D33401',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#D33401',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  qtyControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EFEDED',
    borderRadius: 16,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#E0DDD8',
  },
  qtyActionBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnBusy: {
    opacity: 0.5,
  },
  qtyActionText: {
    color: '#1B1C1C',
    fontWeight: '800',
    fontSize: 13,
    minWidth: 16,
    textAlign: 'center',
  },
  soldOutBadge: {
    backgroundColor: '#EFEDED',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
  },
  soldOutText: {
    color: '#747878',
    fontSize: 10,
    fontWeight: '700',
  },

  /* Floating Bottom Cart Bar in Menza Flame Accent */
  floatingCartBarWrapper: {
    position: 'absolute',
    bottom: 74,
    left: 16,
    right: 16,
    zIndex: 999,
    alignItems: 'center',
  },
  floatingCartBar: {
    width: '100%',
    maxWidth: 480,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#D33401',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#D33401',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  cartCountCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartCountCircleText: {
    color: '#D33401',
    fontWeight: '800',
    fontSize: 13,
  },
  cartCenterText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  cartRightBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cartRightAmount: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },

  /* Bottom Navigation Bar */
  bottomTabBar: {
    height: 60,
    backgroundColor: 'rgba(251, 249, 249, 0.95)',
    borderTopWidth: 1,
    borderTopColor: '#E0DDD8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 10,
  },
  bottomTabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 4,
    minWidth: 60,
  },
  bottomTabText: {
    color: '#747878',
    fontSize: 11,
    fontWeight: '600',
  },
  bottomTabItemActive: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 4,
    minWidth: 60,
  },
  bottomTabTextActive: {
    color: '#D33401',
    fontSize: 11,
    fontWeight: '700',
  },

  /* Loader & Empty states */
  loaderBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  loaderText: {
    color: '#747878',
    marginTop: 10,
    fontSize: 13,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0DDD8',
    padding: 24,
  },
  emptyTitle: {
    color: '#1B1C1C',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptySub: {
    color: '#747878',
    fontSize: 12,
  },
});