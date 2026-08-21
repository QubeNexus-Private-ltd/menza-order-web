import React, { useState } from 'react';
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
import { Search, Plus, Minus, Bell, FileText, QrCode, Sparkles, Check, Building, MapPin, Lock, ShoppingBag, ArrowRight } from 'lucide-react';

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
  const [selectedCategory, setSelectedCategory] = useState(null); // null = All
  const [searchQuery, setSearchQuery] = useState('');
  const [vegOnly, setVegOnly] = useState(false);
  const [actionLoading, setActionLoading] = useState({});
  const [utilityLoading, setUtilityLoading] = useState({});

  const restaurantName = catalog ? catalog.restaurantName || `Restaurant #${catalog.restaurantId}` : 'Menza Fine Dining';
  const restaurantAddress = catalog ? catalog.restaurantAddress || '' : '';
  const encryptedId = catalog ? catalog.encryptedRestaurantId || '' : '';

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

  // Display item quantity/unit information from API data without inventing
  // meanings for numeric unit ids.
  const getUnitName = (item, cartItem) => {
    const value =
      item?.unitName ||
      item?.unitTypeName ||
      item?.unit?.name ||
      item?.unit?.unitName ||
      item?.unitDescription ||
      cartItem?.unitName ||
      cartItem?.unitTypeName ||
      cartItem?.unit?.name ||
      cartItem?.unit?.unitName;

    return value ? String(value).trim() : '';
  };

  const getVariantName = (item, cartItem) => {
    const value =
      item?.variantName ||
      cartItem?.variantName ||
      item?.sizeName ||
      item?.size ||
      '';

    return value ? String(value).trim() : '';
  };

  const getUnitPrice = (item, cartItem) => {
    // Prefer the cart/server price once the item is in the cart.
    const value =
      cartItem?.unitPrice ??
      cartItem?.amount ??
      item?.unitPrice ??
      item?.price ??
      0;

    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  };

  const getItemLineText = (item, cartItem) => {
    const unitName = getUnitName(item, cartItem);
    const variantName = getVariantName(item, cartItem);
    const price = getUnitPrice(item, cartItem);

    // Customer-friendly wording: "1 Plate • ₹220.00" instead of
    // technical labels such as "Unit: 5".
    const quantityWord = variantName || unitName;

    if (quantityWord) {
      return `1 ${quantityWord} • ₹${price.toFixed(2)}`;
    }

    return `₹${price.toFixed(2)}`;
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

  const runUtilityAction = async (key, action) => {
    if (utilityLoading[key]) return;
    setUtilityLoading((prev) => ({ ...prev, [key]: true }));
    try {
      await action();
    } catch (error) {
      console.error(`Customer ${key} action failed:`, error);
    } finally {
      setUtilityLoading((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  return (
    <View style={styles.rootWrapper}>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Scanned Restaurant Banner Header */}
      <View style={styles.bannerContainer}>
        <View style={styles.bannerContent}>
          <View style={styles.bannerInfo}>
            <View style={styles.restaurantTagRow}>
              <View style={styles.restaurantBadge}>
                <Building size={14} color="#10b981" />
                <Text style={styles.restaurantBadgeText}>{restaurantName}</Text>
              </View>

              <View style={styles.tableBadge}>
                <QrCode size={14} color="#f59e0b" />
                <Text style={styles.tableBadgeText}>
                  {activeTable ? `Table #${activeTable.id}` : 'General Guest'}
                </Text>
              </View>

              {encryptedId ? (
                <View style={styles.encryptedBadge}>
                  <Lock size={12} color="#3b82f6" />
                  <Text style={styles.encryptedBadgeText} numberOfLines={1}>
                    Encrypted Token: {encryptedId}
                  </Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.bannerTitle}>{restaurantName}</Text>
            {restaurantAddress ? (
              <View style={styles.addressRow}>
                <MapPin size={14} color="#94a3b8" />
                <Text style={styles.bannerAddress}>{restaurantAddress}</Text>
              </View>
            ) : null}
            <Text style={styles.bannerSub}>
              🔒 Salt Encrypted Menu Stream • Items loaded securely via backend decryption
            </Text>
          </View>

          {/* Quick Actions */}
          <View style={styles.bannerActions}>
            <TouchableOpacity style={styles.bannerButtonScan} onPress={openScanner}>
              <QrCode size={16} color="#0f172a" />
              <Text style={styles.bannerButtonScanText}>Scan Other Table</Text>
            </TouchableOpacity>

            {activeTable && (
              <>
                <TouchableOpacity
                  style={styles.bannerButtonWaiter}
                  onPress={() => runUtilityAction('waiter', onCallWaiter)}
                  disabled={!!utilityLoading.waiter}
                >
                  {utilityLoading.waiter ? <ActivityIndicator size="small" color="#f59e0b" /> : <Bell size={16} color="#f59e0b" />}
                  <Text style={styles.bannerButtonWaiterText}>Call Waiter</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.bannerButtonBill}
                  onPress={() => runUtilityAction('bill', onRequestBill)}
                  disabled={!!utilityLoading.bill}
                >
                  {utilityLoading.bill ? <ActivityIndicator size="small" color="#3b82f6" /> : <FileText size={16} color="#3b82f6" />}
                  <Text style={styles.bannerButtonBillText}>Request Bill</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>

      {/* Controls Bar: Search & Veg Filter */}
      <View style={styles.controlsRow}>
        <View style={styles.searchBox}>
          <Search size={18} color="#64748b" />
          <TextInput
            style={styles.searchInput}
            placeholder={`Search dishes in ${restaurantName}...`}
            placeholderTextColor="#64748b"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Veg Only Toggle */}
        <TouchableOpacity
          style={[styles.vegToggle, vegOnly && styles.vegToggleActive]}
          onPress={() => setVegOnly(!vegOnly)}
          activeOpacity={0.8}
        >
          <View style={[styles.vegDot, { backgroundColor: '#10b981' }]} />
          <Text style={[styles.vegText, vegOnly && styles.vegTextActive]}>Veg Only</Text>
        </TouchableOpacity>
      </View>

      {/* Category Pills Slider */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoriesScroll}
        contentContainerStyle={styles.categoriesContainer}
      >
        <TouchableOpacity
          style={[styles.categoryPill, selectedCategory === null && styles.categoryPillActive]}
          onPress={() => setSelectedCategory(null)}
        >
          <Text style={[styles.categoryPillText, selectedCategory === null && styles.categoryPillTextActive]}>
            ✨ All Items ({items.length})
          </Text>
        </TouchableOpacity>

        {categories.map((cat) => (
          <TouchableOpacity
            key={cat.categoryId}
            style={[styles.categoryPill, selectedCategory === cat.categoryId && styles.categoryPillActive]}
            onPress={() => setSelectedCategory(cat.categoryId)}
          >
            <Text
              style={[
                styles.categoryPillText,
                selectedCategory === cat.categoryId && styles.categoryPillTextActive,
              ]}
            >
              {cat.categoryName}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Loading Indicator */}
      {loading ? (
        <View style={styles.loaderBox}>
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={styles.loaderText}>Decrypting & loading menu catalog for {restaurantName}...</Text>
        </View>
      ) : filteredItems.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>No Items Found</Text>
          <Text style={styles.emptySub}>No dishes match your filter in {restaurantName}.</Text>
        </View>
      ) : (
        /* Items Grid */
        <View style={styles.grid}>
          {filteredItems.map((item) => {
            const cartItem = getCartItem(item.itemId);
            const qty = getCartQuantity(item.itemId);
            const unitPrice = getUnitPrice(item, cartItem);
            const itemTotal = unitPrice * qty;
            const itemBusy = !!actionLoading[item.itemId];
            return (
              <View key={item.itemId} style={styles.card}>
                {/* Image */}
                {item.imageUrl ? (
                  <View style={styles.imageWrapper}>
                    <Image
                      source={{ uri: item.imageUrl }}
                      style={styles.itemImage}
                      resizeMode="cover"
                    />
                    {/* Veg / Non-Veg Badge */}
                    <View style={[styles.dietBadge, { borderColor: item.isVeg ? '#10b981' : '#ef4444' }]}>
                      <View style={[styles.dietDot, { backgroundColor: item.isVeg ? '#10b981' : '#ef4444' }]} />
                    </View>
                  </View>
                ) : null}

                {/* Info Content */}
                <View style={styles.cardContent}>
                  <Text style={styles.itemName} numberOfLines={2}>{item.itemName}</Text>
                  {item.description ? <Text style={styles.itemDesc} numberOfLines={2}>{item.description}</Text> : null}

                  <View style={styles.itemMeta}>
                    <Text style={styles.itemMetaText}>
                      {getItemLineText(item, cartItem)}
                    </Text>
                    {qty > 0 ? (
                      <Text style={styles.itemMetaTotal}>
                        {qty} × ₹{unitPrice.toFixed(2)} = ₹{itemTotal.toFixed(2)}
                      </Text>
                    ) : null}
                  </View>

                  <View style={styles.cardFooter}>

                    {!item.isAvailable ? (
                      <View style={[styles.addButton, { backgroundColor: '#334155', opacity: 0.6 }]}>
                        <Text style={[styles.addButtonText, { color: '#94a3b8' }]}>SOLD OUT</Text>
                      </View>
                    ) : qty === 0 ? (
                      <TouchableOpacity
                        style={styles.addButton}
                        onPress={() => runItemAction(item.itemId, () => onAddToCart(item.itemId, 1))}
                        disabled={itemBusy}
                        activeOpacity={0.8}
                      >
                        {itemBusy ? <ActivityIndicator size="small" color="#0f172a" /> : <Plus size={16} color="#0f172a" />}
                        <Text style={styles.addButtonText}>{itemBusy ? 'ADDING' : 'ADD'}</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.quantityCounter}>
                        <TouchableOpacity
                          style={[styles.qtyBtn, itemBusy && styles.qtyBtnDisabled]}
                          onPress={() => runItemAction(item.itemId, () => onUpdateCartQuantity(item.itemId, qty - 1))}
                          disabled={itemBusy}
                        >
                          {itemBusy ? <ActivityIndicator size="small" color="#ffffff" /> : <Minus size={14} color="#ffffff" />}
                        </TouchableOpacity>
                        <Text style={styles.qtyText}>{itemBusy ? '…' : qty}</Text>
                        <TouchableOpacity
                          style={[styles.qtyBtn, itemBusy && styles.qtyBtnDisabled]}
                          onPress={() => runItemAction(item.itemId, () => onUpdateCartQuantity(item.itemId, qty + 1))}
                          disabled={itemBusy}
                        >
                          {itemBusy ? <ActivityIndicator size="small" color="#ffffff" /> : <Plus size={14} color="#ffffff" />}
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}
      </ScrollView>

      {/* Floating Bottom Cart Basket Bar */}
      {totalCartCount > 0 && (
        <View style={styles.floatingCartBarContainer}>
          <TouchableOpacity
            style={styles.floatingCartBar}
            onPress={openCart}
            activeOpacity={0.88}
          >
            <View style={styles.floatingCartLeft}>
              <View style={styles.floatingCartBadge}>
                <ShoppingBag size={18} color="#0f172a" />
                <Text style={styles.floatingCartCount}>{totalCartCount}</Text>
              </View>
              <View style={styles.floatingCartDetails}>
                <Text style={styles.floatingCartItemsText}>
                  {totalCartCount} {totalCartCount === 1 ? 'Dish' : 'Dishes'} in Basket
                </Text>
                <Text style={styles.floatingCartAmountText}>₹{totalCartAmount.toFixed(2)}</Text>
              </View>
            </View>

            <View style={styles.floatingCartRight}>
              <Text style={styles.floatingCartActionText}>VIEW BASKET</Text>
              <ArrowRight size={18} color="#0f172a" />
            </View>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0f19',
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 100,
  },
  bannerContainer: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 16,
  },
  bannerInfo: {
    flex: 1,
    minWidth: 260,
  },
  restaurantTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  restaurantBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10b981',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  restaurantBadgeText: {
    color: '#10b981',
    fontWeight: '700',
    fontSize: 12,
  },
  tableBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: '#f59e0b',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tableBadgeText: {
    color: '#f59e0b',
    fontWeight: '700',
    fontSize: 12,
  },
  encryptedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: '#3b82f6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    maxWidth: 220,
  },
  encryptedBadgeText: {
    color: '#3b82f6',
    fontWeight: '700',
    fontSize: 11,
  },
  bannerTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  bannerAddress: {
    color: '#94a3b8',
    fontSize: 13,
  },
  bannerSub: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  bannerActions: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  bannerButtonScan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#10b981',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  bannerButtonScanText: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 13,
  },
  bannerButtonWaiter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: '#f59e0b',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  bannerButtonWaiterText: {
    color: '#f59e0b',
    fontWeight: '700',
    fontSize: 13,
  },
  bannerButtonBill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: '#3b82f6',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  bannerButtonBillText: {
    color: '#3b82f6',
    fontWeight: '700',
    fontSize: 13,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    outlineStyle: 'none',
  },
  vegToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 14,
    height: 46,
    borderRadius: 12,
  },
  vegToggleActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10b981',
  },
  vegDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  vegText: {
    color: '#94a3b8',
    fontWeight: '600',
    fontSize: 13,
  },
  vegTextActive: {
    color: '#10b981',
    fontWeight: '700',
  },
  categoriesScroll: {
    marginBottom: 20,
  },
  categoriesContainer: {
    gap: 10,
    paddingRight: 20,
  },
  categoryPill: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  categoryPillActive: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  categoryPillText: {
    color: '#94a3b8',
    fontWeight: '600',
    fontSize: 13,
  },
  categoryPillTextActive: {
    color: '#0f172a',
    fontWeight: '800',
  },
  loaderBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loaderText: {
    color: '#94a3b8',
    marginTop: 12,
    fontSize: 14,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 30,
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySub: {
    color: '#64748b',
    fontSize: 13,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  card: {
    width: 'calc(33.333% - 11px)',
    minWidth: 260,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
  },
  imageWrapper: {
    height: 160,
    width: '100%',
    position: 'relative',
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  dietBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 18,
    height: 18,
    borderRadius: 4,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dietDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cardContent: {
    padding: 14,
  },
  itemName: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  itemDesc: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 16,
    height: 32,
    marginBottom: 12,
  },
  itemMeta: {
    marginTop: 2,
    marginBottom: 12,
    minHeight: 36,
    justifyContent: 'center',
  },
  itemMetaText: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  itemMetaTotal: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    minHeight: 40,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#10b981',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  buttonBusy: {
    opacity: 0.78,
  },
  addButtonText: {
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 12,
  },
  quantityCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 4,
  },
  qtyBtn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
    minWidth: 16,
    textAlign: 'center',
  },
  rootWrapper: {
    flex: 1,
    position: 'relative',
  },
  floatingCartBarContainer: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    zIndex: 999,
    alignItems: 'center',
  },
  floatingCartBar: {
    width: '100%',
    maxWidth: 540,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#10b981',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
  },
  floatingCartLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  floatingCartBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  floatingCartCount: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ef4444',
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  floatingCartDetails: {
    justifyContent: 'center',
  },
  floatingCartItemsText: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 13,
  },
  floatingCartAmountText: {
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 16,
  },
  floatingCartRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  floatingCartActionText: {
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.5,
  },
});