import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import {
  ShoppingBag as CartIcon,
  QrCode as ScanIcon,
  Bell as WaiterIcon,
  FileText as BillIcon,
  User as UserIcon,
  Shield as StaffIcon,
  LogOut,
  Store,
  Wifi,
} from 'lucide-react';

export default function Header({
  mode,
  setMode,
  activeTable,
  openScanner,
  cartCount,
  openCart,
  openOrderTracker,
  activeOrder,
  onCallWaiter,
  onRequestBill,
  staffUser,
  openLogin,
  onLogout,
  restaurantName,
}) {
  const displayName = restaurantName || 'Saffron Café';

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        {/* Brand Logo & Name */}
        <View style={styles.brandContainer}>
          <View style={styles.logoBadge}>
            <Store size={22} color="#78350f" />
          </View>
          <View>
            <Text style={styles.brandTitle}>{displayName}</Text>
            <Text style={styles.brandSub}>Streamlined Smart Ordering</Text>
          </View>
        </View>

        {/* Mode Switcher Pills */}
        <View style={styles.modeSwitchContainer}>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'customer' && styles.modeButtonActive]}
            onPress={() => setMode('customer')}
            activeOpacity={0.8}
          >
            <ScanIcon size={15} color={mode === 'customer' ? '#ffffff' : '#78716c'} />
            <Text style={[styles.modeText, mode === 'customer' && styles.modeTextActive]}>
              Customer QR
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeButton, mode === 'staff' && styles.modeButtonActive]}
            onPress={() => setMode('staff')}
            activeOpacity={0.8}
          >
            <StaffIcon size={15} color={mode === 'staff' ? '#ffffff' : '#78716c'} />
            <Text style={[styles.modeText, mode === 'staff' && styles.modeTextActive]}>
              Staff POS
            </Text>
          </TouchableOpacity>
        </View>

        {/* Right Actions */}
        <View style={styles.actionsRow}>
          {mode === 'customer' ? (
            <>
              {/* Online/Wifi indicator icon */}
              <View style={styles.wifiBox}>
                <Wifi size={18} color="#78350f" />
              </View>

              {/* Table Info / Scanner button */}
              <TouchableOpacity style={styles.tableChip} onPress={openScanner}>
                <ScanIcon size={15} color="#78350f" />
                <Text style={styles.tableChipText}>
                  {activeTable ? `Table #${activeTable.id}` : 'Scan Table'}
                </Text>
              </TouchableOpacity>

              {/* Call Waiter Quick Action */}
              {activeTable && (
                <TouchableOpacity style={styles.iconActionButton} onPress={onCallWaiter} title="Call Waiter">
                  <WaiterIcon size={17} color="#d97706" />
                </TouchableOpacity>
              )}

              {/* Request Bill Quick Action */}
              {activeTable && (
                <TouchableOpacity style={styles.iconActionButton} onPress={onRequestBill} title="Request Bill">
                  <BillIcon size={17} color="#78350f" />
                </TouchableOpacity>
              )}

              {/* Active Order Tracker Button if order placed */}
              {activeOrder && (
                <TouchableOpacity style={styles.trackerChip} onPress={openOrderTracker}>
                  <View style={styles.pulseDot} />
                  <Text style={styles.trackerText}>Order #{activeOrder.id}</Text>
                </TouchableOpacity>
              )}

              {/* Cart Button with Count Badge */}
              <TouchableOpacity style={styles.cartButton} onPress={openCart}>
                <CartIcon size={19} color="#ffffff" />
                {cartCount > 0 && (
                  <View style={styles.cartBadge}>
                    <Text style={styles.cartBadgeText}>{cartCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              {staffUser ? (
                <View style={styles.userProfileRow}>
                  <View style={styles.userAvatar}>
                    <Text style={styles.userAvatarText}>{staffUser.name ? staffUser.name[0].toUpperCase() : 'S'}</Text>
                  </View>
                  <View style={styles.userInfoCol}>
                    <Text style={styles.userNameText}>{staffUser.name}</Text>
                    <Text style={styles.userRoleText}>{staffUser.role || 'Staff / Waiter'}</Text>
                  </View>
                  <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
                    <LogOut size={16} color="#b91c1c" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.loginBtn} onPress={openLogin}>
                  <UserIcon size={16} color="#ffffff" />
                  <Text style={styles.loginBtnText}>Staff Login</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FBF9F9',
    borderBottomWidth: 1,
    borderBottomColor: '#E0DDD8',
    paddingHorizontal: 20,
    paddingVertical: 12,
    zIndex: 10,
  },
  topRow: {
    width: '100%',
    maxWidth: 1280,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#1B1C1C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    color: '#1B1C1C',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  brandSub: {
    color: '#747878',
    fontSize: 11,
    fontWeight: '500',
  },
  modeSwitchContainer: {
    flexDirection: 'row',
    backgroundColor: '#EFEDED',
    borderRadius: 24,
    padding: 3,
    gap: 3,
    borderWidth: 1,
    borderColor: '#E0DDD8',
  },
  modeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
  },
  modeButtonActive: {
    backgroundColor: '#1B1C1C',
  },
  modeText: {
    color: '#444748',
    fontSize: 12,
    fontWeight: '600',
  },
  modeTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  wifiBox: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFEDED',
    borderWidth: 1,
    borderColor: '#E0DDD8',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  tableChipText: {
    color: '#1B1C1C',
    fontWeight: '700',
    fontSize: 12,
  },
  iconActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFEDED',
    borderWidth: 1,
    borderColor: '#E0DDD8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(211, 52, 1, 0.1)',
    borderWidth: 1,
    borderColor: '#D33401',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 20,
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#D33401',
  },
  trackerText: {
    color: '#D33401',
    fontWeight: '700',
    fontSize: 12,
  },
  cartButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#D33401',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#D33401',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#1B1C1C',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 2,
    borderColor: '#FBF9F9',
  },
  cartBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  userProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EFEDED',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0DDD8',
  },
  userAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1B1C1C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 12,
  },
  userInfoCol: {
    justifyContent: 'center',
  },
  userNameText: {
    color: '#1B1C1C',
    fontSize: 12,
    fontWeight: '700',
  },
  userRoleText: {
    color: '#444748',
    fontSize: 10,
    fontWeight: '500',
  },
  logoutBtn: {
    padding: 4,
  },
  loginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1B1C1C',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  loginBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
});
