import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import {
  ShoppingBag as CartIcon,
  ClipboardList as OrderIcon,
  Store,
} from 'lucide-react';

export default function Header({
  restaurantName,
  cartCount = 0,
  openCart,
  openOrderTracker,
  activeOrder,
}) {
  const displayName = restaurantName || 'Saffron Café';

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>

        {/* =========================
            RESTAURANT NAME
        ========================== */}
        <View style={styles.brandContainer}>
          <View style={styles.logoBadge}>
            <Store size={21} color="#ffffff" />
          </View>

          <View style={styles.brandTextContainer}>
            <Text
              style={styles.brandTitle}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {displayName}
            </Text>

            <Text style={styles.brandSub}>
              Smart Ordering
            </Text>
          </View>
        </View>

        {/* =========================
            RIGHT SIDE ACTIONS
        ========================== */}
        <View style={styles.actionsRow}>

          {/* =========================
              ORDER BUTTON
          ========================== */}
          {activeOrder && (
            <TouchableOpacity
              style={styles.orderButton}
              onPress={openOrderTracker}
              activeOpacity={0.8}
            >
              <OrderIcon
                size={19}
                color="#D33401"
                strokeWidth={2.3}
              />

              <Text style={styles.orderButtonText}>
                Order
              </Text>

              {/* Order status dot */}
              <View style={styles.orderDot} />
            </TouchableOpacity>
          )}

          {/* =========================
              CART BUTTON
          ========================== */}
          <TouchableOpacity
            style={styles.cartButton}
            onPress={openCart}
            activeOpacity={0.8}
          >
            <CartIcon
              size={20}
              color="#ffffff"
              strokeWidth={2.3}
            />

            {/* Cart Count */}
            {cartCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>
                  {cartCount > 99 ? '99+' : cartCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({

  // ==========================================
  // MAIN HEADER
  // ==========================================
  container: {
    width: '100%',
    backgroundColor: '#FBF9F9',

    borderBottomWidth: 1,
    borderBottomColor: '#E0DDD8',

    paddingHorizontal: 16,
    paddingVertical: 11,

    zIndex: 100,
    elevation: 5,
  },

  // ==========================================
  // HEADER ROW
  // ==========================================
  headerRow: {
    width: '100%',

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',

    minHeight: 44,
  },

  // ==========================================
  // RESTAURANT BRAND
  // ==========================================
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',

    flex: 1,
    minWidth: 0,
  },

  logoBadge: {
    width: 38,
    height: 38,

    borderRadius: 10,

    backgroundColor: '#1B1C1C',

    alignItems: 'center',
    justifyContent: 'center',

    marginRight: 10,
  },

  brandTextContainer: {
    flex: 1,
    minWidth: 0,
  },

  brandTitle: {
    color: '#1B1C1C',

    fontSize: 17,
    fontWeight: '800',

    letterSpacing: -0.3,

    maxWidth: '100%',
  },

  brandSub: {
    color: '#747878',

    fontSize: 10,

    fontWeight: '600',

    marginTop: 1,
  },

  // ==========================================
  // RIGHT ACTIONS
  // ==========================================
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',

    marginLeft: 10,

    gap: 8,
  },

  // ==========================================
  // ORDER BUTTON
  // ==========================================
  orderButton: {
    height: 40,

    flexDirection: 'row',
    alignItems: 'center',

    paddingHorizontal: 12,

    borderRadius: 20,

    backgroundColor: '#FFF1EC',

    borderWidth: 1,
    borderColor: '#F3C8BA',

    position: 'relative',
  },

  orderButtonText: {
    color: '#D33401',

    fontSize: 12,

    fontWeight: '800',

    marginLeft: 6,
  },

  // ==========================================
  // ORDER STATUS DOT
  // ==========================================
  orderDot: {
    width: 7,
    height: 7,

    borderRadius: 4,

    backgroundColor: '#D33401',

    marginLeft: 6,
  },

  // ==========================================
  // CART BUTTON
  // ==========================================
  cartButton: {
    width: 42,
    height: 42,

    borderRadius: 21,

    backgroundColor: '#D33401',

    alignItems: 'center',
    justifyContent: 'center',

    position: 'relative',

    shadowColor: '#D33401',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.25,
    shadowRadius: 6,

    elevation: 4,
  },

  // ==========================================
  // CART BADGE
  // ==========================================
  cartBadge: {
    position: 'absolute',

    top: -5,
    right: -5,

    minWidth: 19,
    height: 19,

    borderRadius: 10,

    backgroundColor: '#1B1C1C',

    alignItems: 'center',
    justifyContent: 'center',

    paddingHorizontal: 4,

    borderWidth: 2,
    borderColor: '#FBF9F9',
  },

  cartBadgeText: {
    color: '#ffffff',

    fontSize: 9,

    fontWeight: '900',
  },
});