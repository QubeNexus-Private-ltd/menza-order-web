import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import {
  ShoppingBag as CartIcon,
  ClipboardList as OrderIcon,
  Store,
  QrCode,
} from 'lucide-react';

export default function Header({
  restaurantName,
  cartCount = 0,
  openCart,
  openOrderTracker,
  openQrModal,
  activeOrder,
}) {
  const displayName = restaurantName || 'Saffron Café';

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>

        {/* =========================
            RESTAURANT NAME & BRAND
        ========================== */}
        <View style={styles.brandContainer}>
          <View style={styles.logoBadge}>
            <Store size={20} color="#ffffff" />
          </View>

          <View style={styles.brandTextContainer}>
            <Text
              style={styles.brandTitle}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {displayName}
            </Text>

            <Text style={styles.brandSub} numberOfLines={1}>
              Smart Ordering
            </Text>
          </View>
        </View>

        {/* =========================
            RIGHT SIDE ACTIONS
        ========================== */}
        <View style={styles.actionsRow}>

          {/* =========================
              RESTAURANT QR CODE BUTTON
          ========================== */}
          {openQrModal && (
            <TouchableOpacity
              style={styles.qrButton}
              onPress={openQrModal}
              activeOpacity={0.8}
              accessibilityLabel="View and Download Restaurant QR Code"
            >
              <QrCode
                size={16}
                color="#1B1C1C"
                strokeWidth={2.3}
              />
              <Text style={styles.qrButtonText}>QR</Text>
            </TouchableOpacity>
          )}

          {/* =========================
              ORDER TRACKER BUTTON
          ========================== */}
          {activeOrder && (
            <TouchableOpacity
              style={styles.orderButton}
              onPress={openOrderTracker}
              activeOpacity={0.8}
              accessibilityLabel="View Active Order"
            >
              <OrderIcon
                size={17}
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
            accessibilityLabel={`Cart with ${cartCount} items`}
          >
            <CartIcon
              size={19}
              color="#ffffff"
              strokeWidth={2.3}
            />

            {/* Cart Count Badge */}
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
  // MAIN HEADER CONTAINER
  // ==========================================
  container: {
    width: '100%',
    backgroundColor: '#FBF9F9',
    borderBottomWidth: 1,
    borderBottomColor: '#E0DDD8',
    paddingHorizontal: 16,
    paddingVertical: 10,
    zIndex: 100,
    elevation: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
  },

  // ==========================================
  // HEADER ROW (MAX WIDTH ALIGNED)
  // ==========================================
  headerRow: {
    width: '100%',
    maxWidth: 1280,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 42,
    gap: 8,
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
    flexShrink: 0,
  },

  brandTextContainer: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },

  brandTitle: {
    color: '#1B1C1C',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },

  brandSub: {
    color: '#747878',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },

  // ==========================================
  // RIGHT ACTIONS
  // ==========================================
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 6,
    gap: 8,
    flexShrink: 0,
  },

  // ==========================================
  // QR BUTTON
  // ==========================================
  qrButton: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    borderRadius: 20,
    backgroundColor: '#EFEDED',
    borderWidth: 1,
    borderColor: '#E0DDD8',
    gap: 4,
  },

  qrButtonText: {
    color: '#1B1C1C',
    fontSize: 12,
    fontWeight: '800',
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
  },

  orderButtonText: {
    color: '#D33401',
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 5,
  },

  orderDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#D33401',
    marginLeft: 5,
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
    shadowOpacity: 0.28,
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