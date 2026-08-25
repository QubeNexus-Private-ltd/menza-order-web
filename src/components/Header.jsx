import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
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
        <View style={styles.brandContainer}>
          <View style={styles.logoBadge}>
            <Store size={20} color="#ffffff" />
          </View>

          <View style={styles.brandTextContainer}>
            <Text style={styles.brandTitle} numberOfLines={1} ellipsizeMode="tail">
              {displayName}
            </Text>
            <Text style={styles.brandSub} numberOfLines={1}>
              Smart Ordering
            </Text>
          </View>
        </View>

        <View style={styles.actionsRow}>
          {typeof openQrModal === 'function' && (
            <Pressable
              style={({ pressed }) => [
                styles.qrButton,
                pressed && styles.qrButtonPressed,
              ]}
              onPress={handleQrPress}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
              android_ripple={{ color: '#D8D5D2', borderless: false }}
              accessibilityRole="button"
              accessibilityLabel="View and Download Restaurant QR Code"
            >
              <QrCode size={16} color="#1B1C1C" strokeWidth={2.3} />
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
              pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
              android_ripple={{ color: '#F3C8BA', borderless: false }}
              accessibilityRole="button"
              accessibilityLabel="View Restaurant Orders"
            >
              <OrderIcon size={17} color="#D33401" strokeWidth={2.3} />
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
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
            android_ripple={{ color: '#B52D03', borderless: true }}
            accessibilityRole="button"
            accessibilityLabel={`Cart with ${cartCount} items`}
          >
            <CartIcon size={19} color="#ffffff" strokeWidth={2.3} />

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
    backgroundColor: '#FBF9F9',
    borderBottomWidth: 1,
    borderBottomColor: '#E0DDD8',
    paddingHorizontal: 16,
    paddingVertical: 10,
    zIndex: 1000,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
  },
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
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 6,
    gap: 8,
    flexShrink: 0,
    zIndex: 1001,
  },
  qrButton: {
    height: 40,
    minWidth: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 11,
    borderRadius: 20,
    backgroundColor: '#EFEDED',
    borderWidth: 1,
    borderColor: '#E0DDD8',
    gap: 4,
    zIndex: 1002,
    elevation: 2,
  },
  qrButtonPressed: {
    backgroundColor: '#E3E0DD',
    transform: [{ scale: 0.97 }],
  },
  qrButtonText: {
    color: '#1B1C1C',
    fontSize: 12,
    fontWeight: '800',
  },
  orderButton: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#FFF1EC',
    borderWidth: 1,
    borderColor: '#F3C8BA',
    zIndex: 1002,
  },
  orderButtonPressed: {
    backgroundColor: '#FFE4DA',
    transform: [{ scale: 0.97 }],
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
  cartButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#D33401',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    zIndex: 1002,
    shadowColor: '#D33401',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 6,
    elevation: 5,
  },
  cartButtonPressed: {
    backgroundColor: '#B92D03',
    transform: [{ scale: 0.96 }],
  },
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