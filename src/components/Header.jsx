import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import {
  ShoppingBag as CartIcon,
  QrCode as ScanIcon,
  Bell as WaiterIcon,
  FileText as BillIcon,
  User as UserIcon,
  Shield as StaffIcon,
  LogOut,
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
  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        {/* Brand Logo & Name */}
        <View style={styles.brandContainer}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>M</Text>
          </View>
          <View>
            <Text style={styles.brandTitle}>MENZA <Text style={styles.brandHighlight}>ORDER</Text></Text>
            <Text style={styles.brandSub}>{restaurantName || 'Smart QR & POS System'}</Text>
          </View>
        </View>

        {/* Mode Switcher Pills */}
        <View style={styles.modeSwitchContainer}>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'customer' && styles.modeButtonActive]}
            onPress={() => setMode('customer')}
            activeOpacity={0.8}
          >
            <ScanIcon size={16} color={mode === 'customer' ? '#ffffff' : '#94a3b8'} />
            <Text style={[styles.modeText, mode === 'customer' && styles.modeTextActive]}>
              Customer QR
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeButton, mode === 'staff' && styles.modeButtonActive]}
            onPress={() => setMode('staff')}
            activeOpacity={0.8}
          >
            <StaffIcon size={16} color={mode === 'staff' ? '#ffffff' : '#94a3b8'} />
            <Text style={[styles.modeText, mode === 'staff' && styles.modeTextActive]}>
              Staff POS & Admin
            </Text>
          </TouchableOpacity>
        </View>

        {/* Right Actions */}
        <View style={styles.actionsRow}>
          {mode === 'customer' ? (
            <>
              {/* Table Info / Scanner button */}
              <TouchableOpacity style={styles.tableChip} onPress={openScanner}>
                <ScanIcon size={16} color="#10b981" />
                <Text style={styles.tableChipText}>
                  {activeTable ? `Table #${activeTable.id}` : 'Scan QR Table'}
                </Text>
              </TouchableOpacity>

              {/* Call Waiter Quick Action */}
              {activeTable && (
                <TouchableOpacity style={styles.iconActionButton} onPress={onCallWaiter} title="Call Waiter">
                  <WaiterIcon size={18} color="#f59e0b" />
                </TouchableOpacity>
              )}

              {/* Request Bill Quick Action */}
              {activeTable && (
                <TouchableOpacity style={styles.iconActionButton} onPress={onRequestBill} title="Request Bill">
                  <BillIcon size={18} color="#3b82f6" />
                </TouchableOpacity>
              )}

              {/* Active Order Tracker Button if order placed */}
              {activeOrder && (
                <TouchableOpacity style={styles.trackerChip} onPress={openOrderTracker}>
                  <View style={styles.pulseDot} />
                  <Text style={styles.trackerText}>Order #{activeOrder.id} ({activeOrder.orderStatus})</Text>
                </TouchableOpacity>
              )}

              {/* Cart Button with Count Badge */}
              <TouchableOpacity style={styles.cartButton} onPress={openCart}>
                <CartIcon size={20} color="#ffffff" />
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
                    <LogOut size={16} color="#ef4444" />
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
    backgroundColor: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    paddingHorizontal: 20,
    paddingVertical: 14,
    zIndex: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  logoText: {
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 22,
  },
  brandTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  brandHighlight: {
    color: '#10b981',
  },
  brandSub: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
  },
  modeSwitchContainer: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 30,
    padding: 4,
    gap: 4,
  },
  modeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 24,
  },
  modeButtonActive: {
    backgroundColor: '#10b981',
  },
  modeText: {
    color: '#94a3b8',
    fontSize: 13,
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
  tableChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10b981',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  tableChipText: {
    color: '#10b981',
    fontWeight: '700',
    fontSize: 13,
  },
  iconActionButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: '#f59e0b',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f59e0b',
  },
  trackerText: {
    color: '#f59e0b',
    fontWeight: '700',
    fontSize: 12,
  },
  cartButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ef4444',
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#0f172a',
  },
  cartBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  userProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 24,
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 14,
  },
  userInfoCol: {
    justifyContent: 'center',
  },
  userNameText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  userRoleText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '600',
  },
  logoutBtn: {
    padding: 6,
  },
  loginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#3b82f6',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  loginBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
