import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Image,
} from 'react-native';
import {
  LayoutGrid,
  ClipboardList,
  ChefHat,
  QrCode as QrIcon,
  Plus,
  CheckCircle,
  Clock,
  User,
  Phone,
  Lock,
  ArrowRight,
  RefreshCw,
  Sliders,
  IndianRupee,
  AlertTriangle,
  Send,
  Building,
  Download,
  Printer,
  Copy,
  Check,
  Store,
  ExternalLink,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { encryptRestaurantId } from '../services/api';
import { downloadQrCodeImage, downloadQrCodeSvg } from './RestaurantQrModal';

export default function StaffView({
  staffUser,
  restaurants,
  selectedRestaurant,
  catalog,
  onSelectRestaurant,
  onGenerateOtp,
  onLogin,
  tables,
  orders,
  items,
  onUpdateTableStatus,
  onSettleTable,
  onUpdateOrderStatus,
  onUpdateKitchenStatus,
  onAddItemToOrder,
  onRefreshData,
  onOpenQrGenerator,
  orderTypes = [],
}) {
  // Login State
  const [mobile, setMobile] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [devOtpHint, setDevOtpHint] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [otpCountdown, setOtpCountdown] = useState(0);

  // OTP Countdown Timer
  useEffect(() => {
    if (otpCountdown <= 0) return;
    const timer = setInterval(() => {
      setOtpCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [otpCountdown]);

  // Dashboard Tabs
  const [activeTab, setActiveTab] = useState('tables'); // 'tables', 'orders', 'kds', 'qr'
  const [orderStatusFilter, setOrderStatusFilter] = useState('All');
  const [copiedQrId, setCopiedQrId] = useState(null);

  // Modal State for Adding Items to Order
  const [selectedOrderForAdd, setSelectedOrderForAdd] = useState(null);
  const [selectedItemToAdd, setSelectedItemToAdd] = useState(null);
  const [addQty, setAddQty] = useState(1);

  // Modal State for Creating Order for Table directly by Staff
  const [createOrderTable, setCreateOrderTable] = useState(null);
  const [selectedStaffItems, setSelectedStaffItems] = useState([]);
  const [staffGuestName, setStaffGuestName] = useState('');
  const [staffGuestMobile, setStaffGuestMobile] = useState('');
  const [staffOrderTypeId, setStaffOrderTypeId] = useState(1);

  // Handle OTP request
  const handleRequestOtp = async () => {
    if (!mobile.trim()) return;
    if (otpCountdown > 0) return;
    setLoginLoading(true);
    setLoginError('');
    try {
      const res = await onGenerateOtp(mobile);
      setOtpSent(true);
      setOtpCountdown(30);
      if (res && res.otpCode) {
        setDevOtpHint(res.otpCode);
        setOtpCode(res.otpCode); // Pre-fill in dev mode for smooth experience!
      }
    } catch (err) {
      if (err?.isRateLimited) {
        if (err.retryAfterSeconds) {
          setOtpCountdown(err.retryAfterSeconds);
        }
        setLoginError(err.message);
      } else {
        setLoginError(err?.response?.data?.message || err?.message || 'Failed to send OTP. Please try again.');
      }
    } finally {
      setLoginLoading(false);
    }
  };

  // Handle Login submission
  const handleLoginSubmit = async () => {
    if (!mobile.trim() || !otpCode.trim()) return;
    setLoginLoading(true);
    setLoginError('');
    try {
      await onLogin(mobile, otpCode);
    } catch (err) {
      if (err?.isRateLimited) {
        setLoginError(err.message);
      } else {
        setLoginError(err?.response?.data?.message || err?.message || 'Login failed. Please check OTP.');
      }
    } finally {
      setLoginLoading(false);
    }
  };

  // Staff POS item add toggle
  const toggleStaffItem = (item) => {
    const existing = selectedStaffItems.find((i) => i.itemId === item.itemId);
    if (existing) {
      setSelectedStaffItems(selectedStaffItems.filter((i) => i.itemId !== item.itemId));
    } else {
      setSelectedStaffItems([...selectedStaffItems, { ...item, quantity: 1 }]);
    }
  };

  const updateStaffItemQty = (itemId, qty) => {
    if (qty <= 0) {
      setSelectedStaffItems(selectedStaffItems.filter((i) => i.itemId !== itemId));
    } else {
      setSelectedStaffItems(
        selectedStaffItems.map((i) => (i.itemId === itemId ? { ...i, quantity: qty } : i))
      );
    }
  };

  const handleStaffPlaceOrder = async () => {
    if (!staffGuestName.trim() || !staffGuestMobile.trim() || selectedStaffItems.length === 0) return;
    // Prepare order payload
    const itemsTotal = selectedStaffItems.reduce((acc, i) => acc + i.price * i.quantity, 0);
    const cgst = itemsTotal * 0.025;
    const sgst = itemsTotal * 0.025;

    await onAddItemToOrder({
      name: staffGuestName,
      mobileNumber: staffGuestMobile,
      tableId: createOrderTable ? createOrderTable.id : null,
      orderTypeId: staffOrderTypeId,
      items: selectedStaffItems,
      orderAmount: itemsTotal,
      cgst,
      sgst,
      totalAmount: itemsTotal + cgst + sgst,
    });

    setCreateOrderTable(null);
    setSelectedStaffItems([]);
    setStaffGuestName('');
    setStaffGuestMobile('');
    setStaffOrderTypeId(1);
  };

  // Render Login Form if staff is not authenticated
  if (!staffUser) {
    return (
      <View style={styles.loginCenterContainer}>
        <View style={styles.loginCard}>
          <View style={styles.loginBadgeIcon}>
            <User size={32} color="#10b981" />
          </View>
          <Text style={styles.loginTitle}>Menza Staff Login</Text>
          <Text style={styles.loginSub}>Enter your mobile number to access POS & Kitchen management</Text>

          <View style={styles.loginForm}>
            <View style={styles.loginInputGroup}>
              <Text style={styles.loginLabel}>Mobile Number</Text>
              <View style={styles.loginInputWrapper}>
                <Phone size={18} color="#64748b" />
                <TextInput
                  style={styles.loginInput}
                  placeholder="Enter 10-digit mobile"
                  placeholderTextColor="#64748b"
                  keyboardType="phone-pad"
                  value={mobile}
                  onChangeText={setMobile}
                />
              </View>
            </View>

            {otpSent && (
              <View style={styles.loginInputGroup}>
                <Text style={styles.loginLabel}>OTP Verification Code</Text>
                <View style={styles.loginInputWrapper}>
                  <Lock size={18} color="#64748b" />
                  <TextInput
                    style={styles.loginInput}
                    placeholder="Enter 6-digit OTP"
                    placeholderTextColor="#64748b"
                    keyboardType="number-pad"
                    value={otpCode}
                    onChangeText={setOtpCode}
                  />
                </View>
                {devOtpHint ? (
                  <Text style={styles.devHintText}>💡 Dev Mode Auto OTP: {devOtpHint}</Text>
                ) : null}
              </View>
            )}

            {loginError ? (
              <View style={styles.loginErrorBox}>
                <AlertTriangle size={15} color="#ef4444" />
                <Text style={styles.loginErrorText}>{loginError}</Text>
              </View>
            ) : null}

            {!otpSent ? (
              <TouchableOpacity
                style={[styles.primaryLoginBtn, otpCountdown > 0 && styles.primaryLoginBtnDisabled]}
                onPress={handleRequestOtp}
                disabled={loginLoading || otpCountdown > 0}
              >
                {loginLoading ? (
                  <ActivityIndicator size="small" color="#0f172a" />
                ) : (
                  <>
                    <Text style={styles.primaryLoginBtnText}>
                      {otpCountdown > 0 ? `RESEND IN ${otpCountdown}s` : 'SEND OTP'}
                    </Text>
                    <ArrowRight size={18} color="#0f172a" />
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <View style={{ gap: 10 }}>
                <TouchableOpacity
                  style={styles.primaryLoginBtn}
                  onPress={handleLoginSubmit}
                  disabled={loginLoading}
                >
                  {loginLoading ? (
                    <ActivityIndicator size="small" color="#0f172a" />
                  ) : (
                    <>
                      <Text style={styles.primaryLoginBtnText}>VERIFY & LOGIN</Text>
                      <CheckCircle size={18} color="#0f172a" />
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.resendOtpBtn}
                  onPress={handleRequestOtp}
                  disabled={loginLoading || otpCountdown > 0}
                >
                  <Text style={[styles.resendOtpBtnText, otpCountdown > 0 && styles.resendOtpBtnTextDisabled]}>
                    {otpCountdown > 0 ? `Resend OTP in ${otpCountdown}s` : 'Resend OTP Code'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  }

  const filteredOrders = orders.filter((o) => {
    if (orderStatusFilter === 'All') return true;
    return o.orderStatus === orderStatusFilter;
  });

  return (
    <View style={styles.container}>
      {/* Sub-Header Toolbar */}
      <View style={styles.subHeader}>
        <View style={styles.subHeaderTopRow}>
          {/* Restaurant Switcher */}
          <View style={styles.restaurantPicker}>
            <Building size={15} color="#10b981" />
            <Text style={styles.restaurantText} numberOfLines={1}>
              {selectedRestaurant ? selectedRestaurant.name : 'All Outlets'}
            </Text>
          </View>

          {/* Refresh button */}
          <TouchableOpacity style={styles.refreshBtn} onPress={onRefreshData} accessibilityLabel="Refresh Staff Data">
            <RefreshCw size={15} color="#94a3b8" />
          </TouchableOpacity>
        </View>

        {/* Staff Dashboard Nav Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsScroll}
          contentContainerStyle={styles.tabsRow}
        >
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'tables' && styles.tabBtnActive]}
            onPress={() => setActiveTab('tables')}
          >
            <LayoutGrid size={15} color={activeTab === 'tables' ? '#0f172a' : '#94a3b8'} />
            <Text style={[styles.tabText, activeTab === 'tables' && styles.tabTextActive]}>
              Tables POS ({tables.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'orders' && styles.tabBtnActive]}
            onPress={() => setActiveTab('orders')}
          >
            <ClipboardList size={15} color={activeTab === 'orders' ? '#0f172a' : '#94a3b8'} />
            <Text style={[styles.tabText, activeTab === 'orders' && styles.tabTextActive]}>
              Active Orders ({orders.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'kds' && styles.tabBtnActive]}
            onPress={() => setActiveTab('kds')}
          >
            <ChefHat size={15} color={activeTab === 'kds' ? '#0f172a' : '#94a3b8'} />
            <Text style={[styles.tabText, activeTab === 'kds' && styles.tabTextActive]}>
              Kitchen KDS
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'qr' && styles.tabBtnActive]}
            onPress={() => setActiveTab('qr')}
          >
            <QrIcon size={15} color={activeTab === 'qr' ? '#0f172a' : '#94a3b8'} />
            <Text style={[styles.tabText, activeTab === 'qr' && styles.tabTextActive]}>
              Table QR Codes
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Main Content Area */}
      <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.bodyContent}>
        {/* TAB 1: TABLES POS GRID */}
        {activeTab === 'tables' && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Table Overview & POS Quick Orders</Text>
              <Text style={styles.sectionSub}>Manage table occupancy, create orders, or settle bills</Text>
            </View>

            <View style={styles.tableGrid}>
              {tables.map((table) => {
                const statusColor =
                  table.status === 'Available'
                    ? '#10b981'
                    : table.status === 'Occupied'
                    ? '#3b82f6'
                    : table.status === 'Reserved'
                    ? '#f59e0b'
                    : '#ef4444';

                const tableOrder = orders.find((o) => o.tableId === table.id && o.orderStatus !== 'Settled');

                return (
                  <View key={table.id} style={styles.tableCard}>
                    <View style={styles.tableCardHeader}>
                      <Text style={styles.tableName}>{table.tableName}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: `${statusColor}25`, borderColor: statusColor }]}>
                        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                        <Text style={[styles.statusBadgeText, { color: statusColor }]}>{table.status}</Text>
                      </View>
                    </View>

                    <Text style={styles.tableCap}>Capacity: {table.capacity || 4} Guests</Text>

                    {tableOrder ? (
                      <View style={styles.activeOrderBox}>
                        <Text style={styles.activeOrderTitle}>Active Order #{tableOrder.id}</Text>
                        <Text style={styles.activeOrderGuest}>{tableOrder.name} • {tableOrder.items ? tableOrder.items.length : 0} items</Text>
                        <Text style={styles.activeOrderAmount}>Total: ₹{tableOrder.totalAmount}</Text>
                      </View>
                    ) : (
                      <View style={styles.idleTableBox}>
                        <Text style={styles.idleTableText}>Table is ready for new guests</Text>
                      </View>
                    )}

                    {/* Table Quick Actions */}
                    <View style={styles.tableCardFooter}>
                      <TouchableOpacity
                        style={styles.tableActionBtnPrimary}
                        onPress={() => setCreateOrderTable(table)}
                      >
                        <Plus size={14} color="#0f172a" />
                        <Text style={styles.tableActionBtnPrimaryText}>New Order</Text>
                      </TouchableOpacity>

                      {table.status === 'Occupied' && (
                        <TouchableOpacity
                          style={styles.tableActionBtnSettle}
                          onPress={() => onSettleTable(table.id)}
                        >
                          <IndianRupee size={14} color="#10b981" />
                          <Text style={styles.tableActionBtnSettleText}>Settle Table</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* TAB 2: ACTIVE ORDERS MANAGER */}
        {activeTab === 'orders' && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionTitle}>Order Management Desk</Text>
                <Text style={styles.sectionSub}>Update order statuses, append dishes, and track kitchen tickets</Text>
              </View>

              {/* Status Filters */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPillsContainer}>
                {['All', 'Pending', 'Confirmed', 'Preparing', 'Ready', 'Delivered'].map((st) => (
                  <TouchableOpacity
                    key={st}
                    style={[styles.filterPill, orderStatusFilter === st && styles.filterPillActive]}
                    onPress={() => setOrderStatusFilter(st)}
                  >
                    <Text style={[styles.filterPillText, orderStatusFilter === st && styles.filterPillTextActive]}>
                      {st}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.ordersList}>
              {filteredOrders.length === 0 ? (
                <View style={styles.emptyOrdersBox}>
                  <Text style={styles.emptyOrdersText}>No orders match filter "{orderStatusFilter}".</Text>
                </View>
              ) : (
                filteredOrders.map((ord) => {
                  const rawMode = (ord.paymentMode || ord.paymentMethod || 'CASH').toString().toUpperCase();
                  const isOnline = rawMode.includes('ONLINE') || rawMode.includes('CASHFREE') || rawMode.includes('UPI') || ord.isOnline === true;
                  const isPaid = String(ord.paymentStatus || '').toUpperCase() === 'PAID' || isOnline;
                  const isSettled = isPaid || isOnline || Boolean(ord.settledDateUtc);
                  const deliveryType = ord.deliveryType || (ord.tableName || ord.tableId ? 'Dine-In' : 'Takeaway / Counter');
                  const isQr = String(ord.source || '').toUpperCase().includes('QR') || !ord.source;

                  return (
                    <View key={ord.id} style={styles.orderManageCard}>
                      <View style={styles.orderManageHeader}>
                        <View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                            <Text style={styles.orderIdText}>ORDER #{ord.id}</Text>
                            {isQr && (
                              <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: '#f1f5f9' }}>
                                <Text style={{ fontSize: 10, fontWeight: '700', color: '#475569' }}>📱 QR SCAN</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.orderMetaText}>
                            🍽️ {deliveryType} ({ord.tableName || 'Counter'}) • {ord.name || 'Guest'} ({ord.mobileNumber || 'No mobile'})
                          </Text>
                        </View>

                        <View style={{ alignItems: 'flex-end', gap: 4 }}>
                          <View style={styles.orderStatusBadge}>
                            <Text style={styles.orderStatusBadgeText}>{ord.orderStatus}</Text>
                          </View>
                          <View style={{
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderRadius: 4,
                            backgroundColor: isSettled ? '#f0fdf4' : '#fffbeb',
                            borderWidth: 1,
                            borderColor: isSettled ? '#bbf7d0' : '#fde68a'
                          }}>
                            <Text style={{
                              fontSize: 10,
                              fontWeight: '700',
                              color: isSettled ? '#166534' : '#92400e'
                            }}>
                              {isSettled ? '✓ Online Paid & Settled' : '⏳ Cash (Needs Confirm)'}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Items List */}
                      <View style={styles.orderItemsBox}>
                        {ord.items && ord.items.map((it, idx) => (
                          <View key={idx} style={styles.orderItemLine}>
                            <Text style={styles.orderItemQty}>{it.quantity}x</Text>
                            <Text style={styles.orderItemName}>{it.itemName}{it.unitName ? ` (${it.unitName})` : ''}</Text>
                            <Text style={styles.orderItemPrice}>₹{it.amount * it.quantity}</Text>
                          </View>
                        ))}
                      </View>

                      {/* Order Action Buttons */}
                      <View style={styles.orderManageFooter}>
                        <Text style={styles.orderTotalText}>Total: ₹{ord.totalAmount}</Text>

                        <View style={styles.orderActionGroup}>
                          <TouchableOpacity
                            style={styles.addMoreBtn}
                            onPress={() => setSelectedOrderForAdd(ord)}
                          >
                            <Plus size={14} color="#ffffff" />
                            <Text style={styles.addMoreBtnText}>+ Add Dish</Text>
                          </TouchableOpacity>

                          {(ord.orderStatus === 'Pending' || ord.orderStatus === 'Placed') && (
                            <TouchableOpacity
                              style={styles.statusUpdateBtnConfirm}
                              onPress={() => onUpdateOrderStatus(ord.id, 'Confirmed')}
                            >
                              <Text style={styles.statusUpdateBtnText}>✓ Confirm Order</Text>
                            </TouchableOpacity>
                          )}

                          {ord.orderStatus === 'Confirmed' && (
                            <TouchableOpacity
                              style={styles.statusUpdateBtnPrep}
                              onPress={() => onUpdateOrderStatus(ord.id, 'Preparing')}
                            >
                              <Text style={styles.statusUpdateBtnText}>Start Cooking</Text>
                            </TouchableOpacity>
                          )}

                          {ord.orderStatus === 'Preparing' && (
                            <TouchableOpacity
                              style={styles.statusUpdateBtnReady}
                              onPress={() => onUpdateOrderStatus(ord.id, 'Ready')}
                            >
                              <Text style={styles.statusUpdateBtnText}>Mark Ready</Text>
                            </TouchableOpacity>
                          )}

                          {ord.orderStatus === 'Ready' && (
                            <TouchableOpacity
                              style={styles.statusUpdateBtnServe}
                              onPress={() => onUpdateOrderStatus(ord.id, 'Delivered')}
                            >
                              <Text style={styles.statusUpdateBtnText}>Serve Table</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </View>
        )}

        {/* TAB 3: KITCHEN DISPLAY SYSTEM (KDS) */}
        {activeTab === 'kds' && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>🍳 Kitchen Display System (KDS)</Text>
              <Text style={styles.sectionSub}>Live order queue for chefs & kitchen staff</Text>
            </View>

            <View style={styles.kdsGrid}>
              {orders
                .filter((o) => ['Pending', 'Confirmed', 'Preparing'].includes(o.orderStatus))
                .map((ticket) => (
                  <View key={ticket.id} style={styles.kdsCard}>
                    <View style={styles.kdsHeader}>
                      <Text style={styles.kdsTicketNum}>Ticket #{ticket.id}</Text>
                      <Text style={styles.kdsTable}>{ticket.tableName || 'Takeaway'}</Text>
                    </View>

                    <ScrollView style={styles.kdsItemsList}>
                      {ticket.items && ticket.items.map((it, idx) => (
                        <View key={idx} style={styles.kdsItemLine}>
                          <Text style={styles.kdsQty}>{it.quantity}x</Text>
                          <Text style={styles.kdsItemName}>{it.itemName}</Text>
                        </View>
                      ))}
                    </ScrollView>

                    {ticket.remarks ? (
                      <View style={styles.kdsNotesBox}>
                        <Text style={styles.kdsNotesText}>Note: {ticket.remarks}</Text>
                      </View>
                    ) : null}

                    <TouchableOpacity
                      style={styles.kdsReadyBtn}
                      onPress={() => onUpdateKitchenStatus(ticket.id, 'Ready')}
                    >
                      <CheckCircle size={16} color="#0f172a" />
                      <Text style={styles.kdsReadyBtnText}>BUMP ORDER READY</Text>
                    </TouchableOpacity>
                  </View>
                ))}
            </View>
          </View>
        )}

        {/* TAB 4: RESTAURANT & TABLE QR CODES MANAGER */}
        {activeTab === 'qr' && (
          <View style={styles.sectionContainer}>
            {/* Section Header */}
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionTitle}>Restaurant & Table QR Code Hub</Text>
                <Text style={styles.sectionSub}>Download high-resolution QR codes for physical table displays, counters, and posters</Text>
              </View>

              {tables.length > 0 && (
                <TouchableOpacity
                  style={styles.downloadAllBtn}
                  onPress={() => {
                    // Download all table QRs sequentially
                    tables.forEach((table, idx) => {
                      setTimeout(() => {
                        const rId = table.rId || table.restaurantId || (selectedRestaurant ? selectedRestaurant.id : 1);
                        const restName = selectedRestaurant?.name || catalog?.restaurantName || 'Menza Fine Dining';
                        const cleanName = restName.toLowerCase().replace(/[^a-z0-9]/g, '-');
                        downloadQrCodeImage({
                          svgElementId: `staff-table-qr-svg-${table.id}`,
                          title: restName,
                          subtitle: 'Scan to view menu & order',
                          fileName: `${cleanName}-table-${table.id}.png`,
                          tableNumber: table.id,
                        });
                      }, idx * 300);
                    });
                  }}
                >
                  <Download size={15} color="#0f172a" />
                  <Text style={styles.downloadAllBtnText}>Download All Table QRs</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* FEATURED: MAIN RESTAURANT QR CODE */}
            {(() => {
              const rId = selectedRestaurant ? selectedRestaurant.id : (catalog?.restaurantId || 1);
              const encId = catalog?.encryptedRestaurantId || selectedRestaurant?.encryptedRestaurantId || encryptRestaurantId(rId);
              const mainQrUrl = `${window.location.origin}/?encRestId=${encId}`;
              const restName = selectedRestaurant?.name || catalog?.restaurantName || 'Menza Fine Dining';
              const cleanName = restName.toLowerCase().replace(/[^a-z0-9]/g, '-');

              return (
                <View style={styles.mainQrHeroCard}>
                  <View style={styles.mainQrLeft}>
                    <View style={styles.mainQrBadge}>
                      <Store size={14} color="#10b981" />
                      <Text style={styles.mainQrBadgeText}>MAIN OUTLET QR CODE</Text>
                    </View>

                    <Text style={styles.mainQrTitle}>{restName}</Text>
                    <Text style={styles.mainQrDesc}>
                      Universal QR code for general customer ordering, counter POS express checkout, and takeaway.
                    </Text>

                    {/* URL Snippet */}
                    <View style={styles.mainQrUrlBox}>
                      <Text style={styles.mainQrUrlText} numberOfLines={1}>{mainQrUrl}</Text>
                      <TouchableOpacity
                        style={styles.qrCopyBtn}
                        onPress={() => {
                          if (navigator.clipboard) {
                            navigator.clipboard.writeText(mainQrUrl);
                            setCopiedQrId('main');
                            setTimeout(() => setCopiedQrId(null), 2500);
                          }
                        }}
                      >
                        {copiedQrId === 'main' ? (
                          <Check size={13} color="#10b981" />
                        ) : (
                          <Copy size={13} color="#94a3b8" />
                        )}
                        <Text style={[styles.qrCopyBtnText, copiedQrId === 'main' && { color: '#10b981' }]}>
                          {copiedQrId === 'main' ? 'Copied' : 'Copy'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.mainQrActionRow}>
                      <TouchableOpacity
                        style={styles.mainDownloadBtnPrimary}
                        onPress={() => {
                          downloadQrCodeImage({
                            svgElementId: 'staff-main-outlet-qr-svg',
                            title: restName,
                            subtitle: 'Scan to View Menu & Order',
                            fileName: `${cleanName}-main-qr.png`,
                          });
                        }}
                      >
                        <Download size={15} color="#0f172a" />
                        <Text style={styles.mainDownloadBtnPrimaryText}>DOWNLOAD PNG</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.mainDownloadBtnSecondary}
                        onPress={() => {
                          downloadQrCodeSvg({
                            svgElementId: 'staff-main-outlet-qr-svg',
                            fileName: `${cleanName}-main-qr.svg`,
                          });
                        }}
                      >
                        <Download size={14} color="#ffffff" />
                        <Text style={styles.mainDownloadBtnSecondaryText}>SVG</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.mainDownloadBtnSecondary}
                        onPress={() => window.print()}
                      >
                        <Printer size={14} color="#ffffff" />
                        <Text style={styles.mainDownloadBtnSecondaryText}>Print</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.mainQrRight}>
                    <View style={styles.mainQrWrapper}>
                      <QRCodeSVG
                        id="staff-main-outlet-qr-svg"
                        value={mainQrUrl}
                        size={160}
                        bgColor="#ffffff"
                        fgColor="#0f172a"
                        level="Q"
                      />
                    </View>
                    <Text style={styles.mainQrScanCaption}>Scan with Camera</Text>
                  </View>
                </View>
              );
            })()}

            {/* INDIVIDUAL TABLE QR CODES */}
            <View style={styles.tableQrSection}>
              <Text style={styles.tableQrSectionTitle}>Individual Table QR Codes ({tables.length})</Text>
              
              <View style={styles.qrGrid}>
                {tables.map((table) => {
                  const rId = table.rId || table.restaurantId || (selectedRestaurant ? selectedRestaurant.id : 1);
                  const encId = catalog?.encryptedRestaurantId || selectedRestaurant?.encryptedRestaurantId || encryptRestaurantId(rId);
                  const qrTargetUrl = `${window.location.origin}/?encRestId=${encId}&tableId=${table.id}`;
                  const restName = selectedRestaurant?.name || catalog?.restaurantName || 'Menza Fine Dining';
                  const cleanName = restName.toLowerCase().replace(/[^a-z0-9]/g, '-');
                  const svgId = `staff-table-qr-svg-${table.id}`;

                  return (
                    <View key={table.id} style={styles.qrCard}>
                      <View style={styles.qrCardTop}>
                        <Text style={styles.qrTableName}>{table.tableName || `Table #${table.id}`}</Text>
                        <View style={styles.qrTableCapBadge}>
                          <Text style={styles.qrTableCapText}>{table.capacity || 4} seats</Text>
                        </View>
                      </View>

                      <View style={styles.qrCodeWrapper}>
                        <QRCodeSVG
                          id={svgId}
                          value={qrTargetUrl}
                          size={135}
                          bgColor="#ffffff"
                          fgColor="#0f172a"
                          level="Q"
                        />
                      </View>

                      <View style={styles.qrCardUrlBox}>
                        <Text style={styles.qrUrlText} numberOfLines={1}>{qrTargetUrl}</Text>
                      </View>

                      {/* Card Actions */}
                      <View style={styles.qrCardActions}>
                        <TouchableOpacity
                          style={styles.downloadTableQrBtn}
                          onPress={() => {
                            downloadQrCodeImage({
                              svgElementId: svgId,
                              title: restName,
                              subtitle: 'Scan to View Menu & Order',
                              fileName: `${cleanName}-table-${table.id}.png`,
                              tableNumber: table.id,
                            });
                          }}
                        >
                          <Download size={13} color="#0f172a" />
                          <Text style={styles.downloadTableQrBtnText}>Download PNG</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.printTableQrBtn}
                          onPress={() => window.print()}
                        >
                          <Printer size={13} color="#ffffff" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Staff Modal: Create Table Order */}
      {createOrderTable && (
        <Modal visible transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.posModalBox}>
              <Text style={styles.posModalTitle}>New Order for {createOrderTable.tableName}</Text>

              <View style={styles.posInputsRow}>
                <TextInput
                  style={styles.posInput}
                  placeholder="Guest Name *"
                  placeholderTextColor="#64748b"
                  value={staffGuestName}
                  onChangeText={setStaffGuestName}
                />
                <TextInput
                  style={styles.posInput}
                  placeholder="Guest Mobile *"
                  placeholderTextColor="#64748b"
                  keyboardType="phone-pad"
                  value={staffGuestMobile}
                  onChangeText={setStaffGuestMobile}
                />
              </View>

              <View style={styles.staffOrderTypeSection}>
                <Text style={styles.posSelectItemsTitle}>Order Type:</Text>
                <View style={styles.staffOrderTypeRow}>
                  {(orderTypes.length > 0 ? orderTypes : [
                    { id: 1, typeName: 'Dine-In' },
                    { id: 2, typeName: 'Self Pickup' },
                    { id: 3, typeName: 'Delivery' },
                    { id: 4, typeName: 'Counter POS' }
                  ]).map((t) => (
                    <TouchableOpacity
                      key={t.id}
                      style={[styles.staffOrderTypePill, staffOrderTypeId === t.id && styles.staffOrderTypePillActive]}
                      onPress={() => setStaffOrderTypeId(t.id)}
                    >
                      <Text style={[styles.staffOrderTypeText, staffOrderTypeId === t.id && styles.staffOrderTypeTextActive]}>
                        {t.typeName}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <Text style={styles.posSelectItemsTitle}>Select Menu Dishes:</Text>

              <ScrollView style={styles.posItemListScroll}>
                {items.map((it) => {
                  const sel = selectedStaffItems.find((s) => s.itemId === it.itemId);
                  return (
                    <TouchableOpacity
                      key={it.itemId}
                      style={[styles.posItemRow, sel && styles.posItemRowSelected]}
                      onPress={() => toggleStaffItem(it)}
                    >
                      <Text style={styles.posItemName}>{it.itemName} (₹{it.price})</Text>
                      {sel ? (
                        <View style={styles.posQtyBox}>
                          <TouchableOpacity
                            style={styles.posQtyBtn}
                            onPress={() => updateStaffItemQty(it.itemId, sel.quantity - 1)}
                          >
                            <Text style={styles.posQtyBtnText}>-</Text>
                          </TouchableOpacity>
                          <Text style={styles.posQtyNum}>{sel.quantity}</Text>
                          <TouchableOpacity
                            style={styles.posQtyBtn}
                            onPress={() => updateStaffItemQty(it.itemId, sel.quantity + 1)}
                          >
                            <Text style={styles.posQtyBtnText}>+</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <View style={styles.posAddIconBtn}>
                          <Plus size={14} color="#10b981" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={styles.posModalFooter}>
                <TouchableOpacity
                  style={styles.cancelPosBtn}
                  onPress={() => setCreateOrderTable(null)}
                >
                  <Text style={styles.cancelPosBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.submitPosBtn}
                  onPress={handleStaffPlaceOrder}
                >
                  <Text style={styles.submitPosBtnText}>SUBMIT ORDER TO KITCHEN</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Staff Modal: Add Dish to Existing Order */}
      {selectedOrderForAdd && (
        <Modal visible transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.posModalBox}>
              <Text style={styles.posModalTitle}>Add Dish to Order #{selectedOrderForAdd.id}</Text>

              <ScrollView style={styles.posItemListScroll}>
                {items.map((it) => (
                  <TouchableOpacity
                    key={it.itemId}
                    style={styles.posItemRow}
                    onPress={() => {
                      onAddItemToOrder(selectedOrderForAdd.id, it.itemId, 1, it.price);
                      setSelectedOrderForAdd(null);
                    }}
                  >
                    <Text style={styles.posItemName}>{it.itemName}</Text>
                    <Text style={styles.posItemPrice}>₹{it.price}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity
                style={styles.cancelPosBtn}
                onPress={() => setSelectedOrderForAdd(null)}
              >
                <Text style={styles.cancelPosBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0f19',
  },
  loginCenterContainer: {
    flex: 1,
    backgroundColor: '#0b0f19',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loginCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 30,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
  },
  loginBadgeIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  loginTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 6,
  },
  loginSub: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 24,
  },
  loginForm: {
    width: '100%',
    gap: 16,
  },
  loginInputGroup: {
    gap: 6,
  },
  loginLabel: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
  },
  loginInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
  },
  loginInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    outlineStyle: 'none',
  },
  devHintText: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  loginErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  loginErrorText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  primaryLoginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10b981',
    height: 48,
    borderRadius: 12,
    marginTop: 4,
  },
  primaryLoginBtnDisabled: {
    backgroundColor: '#334155',
    opacity: 0.8,
  },
  primaryLoginBtnText: {
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 14,
  },
  resendOtpBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  resendOtpBtnText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '700',
  },
  resendOtpBtnTextDisabled: {
    color: '#64748b',
  },
  subHeader: {
    backgroundColor: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  subHeaderTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  restaurantPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    maxWidth: '80%',
  },
  restaurantText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  tabsScroll: {
    width: '100%',
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 12,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1e293b',
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 16,
    flexShrink: 0,
  },
  tabBtnActive: {
    backgroundColor: '#10b981',
  },
  tabText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#0f172a',
    fontWeight: '800',
  },
  refreshBtn: {
    padding: 8,
    backgroundColor: '#1e293b',
    borderRadius: 16,
  },
  bodyScroll: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: 16,
    paddingVertical: 18,
    maxWidth: 1280,
    width: '100%',
    alignSelf: 'center',
  },
  sectionContainer: {
    gap: 18,
  },
  sectionHeader: {
    marginBottom: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },
  sectionSub: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  tableGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  tableCard: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 240,
    minWidth: 200,
    maxWidth: 380,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 10,
  },
  tableCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tableName: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  tableCap: {
    color: '#64748b',
    fontSize: 12,
  },
  activeOrderBox: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 10,
    gap: 3,
  },
  activeOrderTitle: {
    color: '#10b981',
    fontWeight: '700',
    fontSize: 12,
  },
  activeOrderGuest: {
    color: '#94a3b8',
    fontSize: 11,
  },
  activeOrderAmount: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 12,
  },
  idleTableBox: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  idleTableText: {
    color: '#64748b',
    fontSize: 11,
  },
  tableCardFooter: {
    flexDirection: 'row',
    gap: 8,
  },
  tableActionBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#10b981',
    paddingVertical: 8,
    borderRadius: 8,
  },
  tableActionBtnPrimaryText: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 12,
  },
  tableActionBtnSettle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10b981',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  tableActionBtnSettleText: {
    color: '#10b981',
    fontWeight: '700',
    fontSize: 12,
  },
  filterPillsContainer: {
    gap: 8,
    paddingRight: 10,
  },
  filterPill: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  filterPillActive: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  filterPillText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  filterPillTextActive: {
    color: '#0f172a',
    fontWeight: '800',
  },
  ordersList: {
    gap: 12,
  },
  orderManageCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 10,
  },
  orderManageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  orderIdText: {
    color: '#10b981',
    fontSize: 15,
    fontWeight: '800',
  },
  orderMetaText: {
    color: '#94a3b8',
    fontSize: 11,
  },
  orderStatusBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: '#f59e0b',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
  },
  orderStatusBadgeText: {
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: '700',
  },
  orderItemsBox: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  orderItemLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderItemQty: {
    color: '#10b981',
    fontWeight: '800',
    fontSize: 12,
  },
  orderItemName: {
    flex: 1,
    color: '#ffffff',
    fontSize: 12,
  },
  orderItemPrice: {
    color: '#94a3b8',
    fontSize: 12,
  },
  orderManageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  orderTotalText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  orderActionGroup: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  addMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  addMoreBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  statusUpdateBtnConfirm: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  statusUpdateBtnPrep: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  statusUpdateBtnReady: {
    backgroundColor: '#10b981',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  statusUpdateBtnServe: {
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  statusUpdateBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 11,
  },
  emptyOrdersBox: {
    padding: 24,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    alignItems: 'center',
  },
  emptyOrdersText: {
    color: '#64748b',
    fontSize: 13,
  },
  kdsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  kdsCard: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 280,
    minWidth: 240,
    maxWidth: 420,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 14,
    borderWidth: 2,
    borderColor: '#f59e0b',
    gap: 10,
  },
  kdsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kdsTicketNum: {
    color: '#f59e0b',
    fontSize: 16,
    fontWeight: '800',
  },
  kdsTable: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  kdsItemsList: {
    maxHeight: 180,
  },
  kdsItemLine: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  kdsQty: {
    color: '#10b981',
    fontWeight: '800',
    fontSize: 14,
  },
  kdsItemName: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  kdsNotesBox: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    padding: 8,
    borderRadius: 6,
  },
  kdsNotesText: {
    color: '#f59e0b',
    fontSize: 11,
  },
  kdsReadyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#10b981',
    paddingVertical: 10,
    borderRadius: 10,
  },
  kdsReadyBtnText: {
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 12,
  },
  downloadAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#10b981',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  downloadAllBtnText: {
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 12,
  },
  mainQrHeroCard: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mainQrLeft: {
    flex: 1,
    minWidth: 260,
    gap: 10,
  },
  mainQrBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10b981',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  mainQrBadgeText: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  mainQrTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
  },
  mainQrDesc: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 18,
  },
  mainQrUrlBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  mainQrUrlText: {
    flex: 1,
    color: '#64748b',
    fontSize: 11,
  },
  qrCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  qrCopyBtnText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
  },
  mainQrActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  mainDownloadBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#10b981',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  mainDownloadBtnPrimaryText: {
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.3,
  },
  mainDownloadBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  mainDownloadBtnSecondaryText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12,
  },
  mainQrRight: {
    alignItems: 'center',
    gap: 8,
    alignSelf: 'center',
  },
  mainQrWrapper: {
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 16,
  },
  mainQrScanCaption: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  tableQrSection: {
    gap: 12,
    marginTop: 10,
  },
  tableQrSectionTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  qrGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  qrCard: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 200,
    minWidth: 180,
    maxWidth: 280,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  qrCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  qrTableName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  qrTableCapBadge: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  qrTableCapText: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '600',
  },
  qrCodeWrapper: {
    backgroundColor: '#ffffff',
    padding: 8,
    borderRadius: 12,
  },
  qrCardUrlBox: {
    width: '100%',
    backgroundColor: '#0f172a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  qrUrlText: {
    color: '#64748b',
    fontSize: 10,
    textAlign: 'center',
  },
  qrCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '100%',
  },
  downloadTableQrBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#10b981',
    paddingVertical: 7,
    borderRadius: 8,
  },
  downloadTableQrBtnText: {
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 11,
  },
  printTableQrBtn: {
    padding: 7,
    backgroundColor: '#334155',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  posModalBox: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#0f172a',
    borderRadius: 20,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    maxHeight: '90%',
  },
  posModalTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
  },
  posInputsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  posInput: {
    flex: 1,
    minWidth: 140,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    color: '#ffffff',
    fontSize: 13,
  },
  posSelectItemsTitle: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
  posItemListScroll: {
    maxHeight: 220,
  },
  posItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  posItemRowSelected: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  posItemName: {
    color: '#ffffff',
    fontSize: 13,
  },
  posItemPrice: {
    color: '#10b981',
    fontWeight: '700',
  },
  posQtyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  posQtyBtn: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  posQtyBtnText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  posQtyNum: {
    color: '#10b981',
    fontWeight: '800',
  },
  posAddIconBtn: {
    padding: 6,
  },
  posModalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  cancelPosBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#334155',
  },
  cancelPosBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12,
  },
  submitPosBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#10b981',
  },
  submitPosBtnText: {
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 12,
  },
  staffOrderTypeSection: {
    gap: 4,
  },
  staffOrderTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  staffOrderTypePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
  },
  staffOrderTypePillActive: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  staffOrderTypeText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
  },
  staffOrderTypeTextActive: {
    color: '#0f172a',
    fontWeight: '800',
  },
});
