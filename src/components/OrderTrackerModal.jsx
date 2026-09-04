import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import {
  X,
  CreditCard,
  User,
  Calendar,
  Tag,
  MessageSquare,
  ArrowLeft,
  RefreshCw,
  Search,
  ChevronRight,
  UtensilsCrossed,
  ShoppingBag,
  Layers,
  ChefHat,
  Check,
  Flame,
} from 'lucide-react';
import * as api from '../services/api';
import * as signalrService from '../services/signalr';

const STATUSES = [
  'Pending',
  'Confirmed',
  'Preparing',
  'Ready',
  'Served',
];

export default function OrderTrackerModal({
  visible,
  onClose,
  order,
  orders = [],
  catalog,
  activeTable,
  onRefreshOrder,
}) {
  const [selectedOrder, setSelectedOrder] = useState(order || null);
  const [viewMode, setViewMode] = useState(order ? 'detail' : 'list');
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [allOrdersList, setAllOrdersList] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  useEffect(() => {
    if (order) {
      setSelectedOrder(order);
      setViewMode('detail');
    }
  }, [order]);

  useEffect(() => {
    if (!visible) return;
    loadOrders();
  }, [visible, catalog?.restaurantId]);

  const loadOrders = async () => {
    try {
      setLoadingOrders(true);

      const restId = catalog?.restaurantId || null;
      const savedUser = api.getSavedCustomer();
      const phone = savedUser?.mobile || '';

      const ords = await api.getRestaurantOrders(restId, phone);

      const combined = [...(ords || []), ...(orders || [])];
      const uniqueMap = new Map();

      for (const o of combined) {
        const id = Number(o?.orderId || o?.id);

        if (id && !uniqueMap.has(id)) {
          const norm = api.normalizeOrder ? api.normalizeOrder(o) : o;
          if (selectedOrder && Number(selectedOrder.id) === id) {
            uniqueMap.set(id, {
              ...norm,
              kitchenStatus: selectedOrder.kitchenStatus || norm.kitchenStatus,
              orderStatus: selectedOrder.orderStatus || norm.orderStatus,
            });
          } else {
            uniqueMap.set(id, norm);
          }
        }
      }

      const list = Array.from(uniqueMap.values()).sort(
        (a, b) =>
          new Date(b?.createdAt || b?.createdDateUtc || 0) -
          new Date(a?.createdAt || a?.createdDateUtc || 0)
      );

      setAllOrdersList(list);

      if (
        !order &&
        (!selectedOrder ||
          !list.some((o) => Number(o.id) === Number(selectedOrder.id)))
      ) {
        if (list.length === 1) {
          setSelectedOrder(list[0]);
        }
      }
    } catch (err) {
      console.log('Load orders error:', err);
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    if (!visible || viewMode !== 'detail' || !selectedOrder?.id) {
      return undefined;
    }

    let cancelled = false;
    let lastRefreshTime = 0;

    // Join SignalR order group for instant push updates
    signalrService.joinOrderGroup(selectedOrder.id);

    const refresh = async (force = false) => {
      const now = Date.now();
      if (!force && now - lastRefreshTime < 3000) {
        return; // Throttle to maximum 1 call per 3 seconds
      }
      lastRefreshTime = now;

      try {
        let latest = null;

        if (typeof onRefreshOrder === 'function') {
          latest = await onRefreshOrder(selectedOrder.id);
        } else {
          latest = await api.getOrder(selectedOrder.id);
        }

        if (!cancelled && latest) {
          setSelectedOrder((prev) => {
            if (!prev) return latest;

            const STATUS_RANKS = {
              pending: 0,
              placed: 0,
              new: 0,
              created: 0,
              confirmed: 1,
              accepted: 1,
              preparing: 2,
              cooking: 2,
              in_kitchen: 2,
              kitchen: 2,
              ready: 3,
              prepared: 3,
              delivered: 4,
              served: 4,
              completed: 4,
              settled: 4,
            };

            const prevOrderRank = STATUS_RANKS[String(prev.orderStatus || '').trim().toLowerCase()] ?? 0;
            const latestOrderRank = STATUS_RANKS[String(latest.orderStatus || '').trim().toLowerCase()] ?? 0;
            const effectiveOrderStatus = latestOrderRank >= prevOrderRank ? latest.orderStatus : prev.orderStatus;

            const prevKitchenRank = STATUS_RANKS[String(prev.kitchenStatus || '').trim().toLowerCase()] ?? 0;
            const latestKitchenRank = STATUS_RANKS[String(latest.kitchenStatus || '').trim().toLowerCase()] ?? 0;
            const effectiveKitchenStatus = (latest.kitchenStatus && latestKitchenRank >= prevKitchenRank)
              ? latest.kitchenStatus
              : prev.kitchenStatus;

            return {
              ...prev,
              ...latest,
              orderStatus: effectiveOrderStatus,
              kitchenStatus: effectiveKitchenStatus,
              items: (Array.isArray(latest.items) && latest.items.length > 0) ? latest.items : prev.items,
            };
          });
        }
      } catch (error) {
        console.log(
          'Order tracker refresh error:',
          error?.message || error
        );
      }
    };

    // Only fetch immediately on mount if order data is missing items/details
    if (!selectedOrder?.items || selectedOrder.items.length === 0) {
      refresh(true);
    }

    // Terminal state check: finalized orders do not need continuous polling
    const isTerminal = ['Completed', 'Settled', 'Cancelled'].includes(selectedOrder?.orderStatus);

    // Request browser notifications if user wants updates
    signalrService.requestNotificationPermission();

    // Real-Time SignalR Listener: Direct in-memory state update without HTTP request
    const unsubscribeSignalR = signalrService.onOrderStatusChanged((data) => {
      const changedOrderId = Number(data?.orderId || data?.OrderId || data?.id || data?.Id || 0);
      if (changedOrderId === Number(selectedOrder.id) || !changedOrderId) {
        console.log('⚡ [SignalR] Real-time order update received in-memory:', data);

        const newOrderStatus = data?.orderStatus || data?.OrderStatus || data?.status || data?.Status;
        let newKitchenStatus = data?.kitchenStatus || data?.KitchenStatus || data?.kitchenOrderStatus;
        const oStLower = String(newOrderStatus || '').toLowerCase();
        if (oStLower.includes('serve') || oStLower.includes('deliver') || oStLower.includes('complete') || oStLower.includes('settled')) {
          newKitchenStatus = 'Served';
        }
        const newPaymentStatus = data?.paymentStatus || data?.PaymentStatus;

        setSelectedOrder((prev) => {
          if (!prev) return prev;
          const effOrdSt = newOrderStatus || prev.orderStatus;
          let effKitchSt = newKitchenStatus || prev.kitchenStatus;
          const stLower = String(effOrdSt || '').toLowerCase();
          if (stLower.includes('serve') || stLower.includes('deliver') || stLower.includes('complete') || stLower.includes('settled')) {
            effKitchSt = 'Served';
          }
          return {
            ...prev,
            orderStatus: effOrdSt,
            kitchenStatus: effKitchSt,
            paymentStatus: newPaymentStatus || prev.paymentStatus,
            items: Array.isArray(data?.items) ? data.items : prev.items,
            settledDateUtc: data?.settledDateUtc || prev.settledDateUtc,
            estimatedPickupTime: data?.estimatedPickupTime || prev.estimatedPickupTime,
          };
        });

        setAllOrdersList((prevList) => {
          if (!Array.isArray(prevList)) return prevList;
          return prevList.map((o) => {
            const oId = Number(o.id || o.orderId || 0);
            if (oId === changedOrderId) {
              const effOrdSt = newOrderStatus || o.orderStatus;
              let effKitchSt = newKitchenStatus || o.kitchenStatus;
              const stLower = String(effOrdSt || '').toLowerCase();
              if (stLower.includes('serve') || stLower.includes('deliver') || stLower.includes('complete') || stLower.includes('settled')) {
                effKitchSt = 'Served';
              }
              return {
                ...o,
                orderStatus: effOrdSt,
                kitchenStatus: effKitchSt,
              };
            }
            return o;
          });
        });
      }
    });

    // Fallback polling only for non-terminal orders (every 30s as safety net)
    const interval = !isTerminal ? setInterval(() => refresh(false), 30000) : null;

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      unsubscribeSignalR();
      if (selectedOrder?.id) {
        signalrService.leaveOrderGroup(selectedOrder.id);
      }
    };
  }, [
    visible,
    viewMode,
    selectedOrder?.id,
    onRefreshOrder,
  ]);

  if (!visible) return null;

  const maskPhoneLast4 = (phone) => {
    if (!phone) return '';
    const str = String(phone).trim();
    if (str.includes('*')) return str;
    const digits = str.replace(/\D/g, '');
    if (digits.length <= 4) return digits;
    return '******' + digits.slice(-4);
  };

  const normalizeStatus = (value) => {
    const valueLower = String(value ?? '')
      .trim()
      .toLowerCase();

    if (
      [
        'pending',
        'placed',
        'created',
        'new',
        'received',
      ].includes(valueLower)
    ) {
      return 'Pending';
    }

    if (
      [
        'confirmed',
        'accepted',
        'approved',
        'order confirmed',
      ].includes(valueLower)
    ) {
      return 'Confirmed';
    }

    if (
      [
        'preparing',
        'prepare',
        'in preparation',
        'processing',
        'cooking',
        'in kitchen',
        'kitchen',
      ].includes(valueLower)
    ) {
      return 'Preparing';
    }

    if (
      [
        'ready',
        'prepared',
        'ready to serve',
        'ready for pickup',
      ].includes(valueLower)
    ) {
      return 'Ready';
    }

    if (
      [
        'served',
        'delivered',
        'completed',
        'settled',
        'picked up',
        'pickedup',
        'closed',
      ].includes(valueLower)
    ) {
      return 'Served';
    }

    if (
      [
        'cancelled',
        'rejected',
        'canceled',
        'declined',
      ].includes(valueLower)
    ) {
      return 'Cancelled';
    }

    return 'Pending';
  };

  const getOrderStatusInfo = (ord) => {
    const statusCandidates = [
      ord?.kitchenStatus,
      ord?.kitchenOrderStatus,
      ord?.orderStatus,
      ord?.orderStatusName,
      ord?.status,
      ord?.statusName,
      ord?.orderState,
    ]
      .filter(
        (v) =>
          v !== null &&
          v !== undefined &&
          v !== ''
      )
      .map(normalizeStatus);

    const rawStatus =
      statusCandidates.length > 0
        ? statusCandidates.reduce((best, value) =>
            STATUSES.indexOf(value) >
            STATUSES.indexOf(best)
              ? value
              : best
          )
        : 'Pending';

    const paymentMode = String(
      ord?.paymentMode ?? ''
    )
      .trim()
      .toUpperCase();

    const paymentMethod = String(
      ord?.paymentMethod ?? ''
    )
      .trim()
      .toUpperCase();

    const paymentState = String(
      ord?.paymentStatus ?? ''
    )
      .trim()
      .toUpperCase();

    const isOnline =
      ['ONLINE', 'CASHFREE', 'UPI'].includes(
        paymentMode
      ) ||
      [
        'CASHFREE',
        'CASHFREE_SPLIT',
        'ONLINE',
        'UPI',
      ].includes(paymentMethod) ||
      ord?.isOnline === true;

    const isPaid = [
      'PAID',
      'SUCCESS',
      'COMPLETED',
      'CAPTURED',
    ].includes(paymentState) || isOnline;

    const isAwaitingPayment =
      isOnline && !isPaid;

    const normalizedStatus = isAwaitingPayment
      ? 'Pending'
      : rawStatus;

    let badgeColor = '#0284c7';
    let badgeBg = '#e0f2fe';
    let label = 'Placed';

    if (normalizedStatus === 'Confirmed') {
      badgeColor = '#0d9488';
      badgeBg = '#ccfbf1';
      label = 'Confirmed';
    } else if (
      normalizedStatus === 'Preparing'
    ) {
      badgeColor = '#ea580c';
      badgeBg = '#ffedd5';
      label = 'In Kitchen';
    } else if (normalizedStatus === 'Ready') {
      badgeColor = '#7c3aed';
      badgeBg = '#ede9fe';
      label = 'Ready to Serve';
    } else if (
      normalizedStatus === 'Served' ||
      normalizedStatus === 'Delivered'
    ) {
      badgeColor = '#15803d';
      badgeBg = '#dcfce7';
      label = 'Served to Table';
    } else if (
      normalizedStatus === 'Cancelled'
    ) {
      badgeColor = '#dc2626';
      badgeBg = '#fee2e2';
      label = 'Cancelled';
    }

    return {
      rawStatus,
      normalizedStatus,
      isOnline,
      isPaid,
      isAwaitingPayment,
      badgeColor,
      badgeBg,
      label,
    };
  };

  const filteredOrders = allOrdersList.filter(
    (ord) => {
      const { normalizedStatus } =
        getOrderStatusInfo(ord);

      if (activeTab === 'active') {
        if (
          ['Served', 'Delivered', 'Cancelled'].includes(
            normalizedStatus
          )
        ) {
          return false;
        }
      } else if (activeTab === 'completed') {
        if (
          !['Served', 'Delivered', 'Cancelled'].includes(
            normalizedStatus
          )
        ) {
          return false;
        }
      }

      if (searchQuery.trim()) {
        const q =
          searchQuery.toLowerCase();

        const idStr = String(
          ord.id || ord.orderId || ''
        );

        const tokenStr = String(
          ord.pickupToken ||
            ord.tokenNumber ||
            ''
        ).toLowerCase();

        const dinerName = String(
          ord.customerName ||
            ord.name ||
            ''
        ).toLowerCase();

        const tableStr = String(
          ord.tableName ||
            ord.tableNumber ||
            ''
        ).toLowerCase();

        const itemsMatch =
          Array.isArray(ord.items) &&
          ord.items.some((i) =>
            String(
              i.itemName ||
                i.name ||
                ''
            )
              .toLowerCase()
              .includes(q)
          );

        return (
          idStr.includes(q) ||
          tokenStr.includes(q) ||
          dinerName.includes(q) ||
          tableStr.includes(q) ||
          itemsMatch
        );
      }

      return true;
    }
  );

  const activeCount =
    allOrdersList.filter((o) => {
      const { normalizedStatus } =
        getOrderStatusInfo(o);

      return ![
        'Delivered',
        'Cancelled',
      ].includes(normalizedStatus);
    }).length;

  const completedCount =
    allOrdersList.filter((o) => {
      const { normalizedStatus } =
        getOrderStatusInfo(o);

      return [
        'Delivered',
        'Cancelled',
      ].includes(normalizedStatus);
    }).length;

  /* =========================================================
     RENDER: ORDER DETAIL & RECEIPT VIEW
  ========================================================= */
  const renderDetailView = () => {
    if (!selectedOrder) {
      return (
        <View style={styles.emptyContainer}>
          <UtensilsCrossed
            size={36}
            color="#cbd5e1"
          />

          <Text style={styles.emptyTitle}>
            No Order Selected
          </Text>

          <TouchableOpacity
            style={styles.backToListBtn}
            onPress={() =>
              setViewMode('list')
            }
          >
            <Text
              style={
                styles.backToListBtnText
              }
            >
              View All Orders
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    const {
      normalizedStatus,
      isOnline,
      isPaid,
      isAwaitingPayment,
      badgeColor,
      badgeBg,
      label,
    } = getOrderStatusInfo(
      selectedOrder
    );

    const currentIdx =
      STATUSES.indexOf(normalizedStatus) >= 0
        ? STATUSES.indexOf(normalizedStatus)
        : normalizedStatus === 'Delivered'
        ? STATUSES.indexOf('Served')
        : 0;

    const items = Array.isArray(
      selectedOrder.items
    )
      ? selectedOrder.items
      : [];

    const subtotal =
      Number(
        selectedOrder.subTotal ??
          selectedOrder.itemTotal ??
          items.reduce(
            (sum, item) =>
              sum +
              Number(
                item.amount ??
                  item.unitPrice ??
                  item.price ??
                  0
              ) *
                Number(
                  item.quantity || 1
                ),
            0
          )
      ) || 0;

    const cgst =
      Number(
        selectedOrder.cgstAmount ?? 0
      ) ||
      Math.round(
        subtotal * 0.025 * 100
      ) / 100;

    const sgst =
      Number(
        selectedOrder.sgstAmount ?? 0
      ) ||
      Math.round(
        subtotal * 0.025 * 100
      ) / 100;

    const grandTotal =
      Number(
        selectedOrder.totalAmount ??
          subtotal + cgst + sgst
      ) || 0;

    const tokenNumber =
      selectedOrder.pickupToken ||
      (selectedOrder.tokenNumber
        ? `TK-${String(
            selectedOrder.tokenNumber
          ).padStart(3, '0')}`
        : `TK-${String(
            selectedOrder.id
          ).padStart(3, '0')}`);

    const formattedDate =
      selectedOrder.createdDateUtc ||
      selectedOrder.createdAt
        ? new Date(
            selectedOrder.createdDateUtc ||
              selectedOrder.createdAt
          ).toLocaleString(
            'en-IN',
            {
              dateStyle: 'medium',
              timeStyle: 'short',
            }
          )
        : new Date().toLocaleString(
            'en-IN',
            {
              dateStyle: 'medium',
              timeStyle: 'short',
            }
          );

    const channelText =
      selectedOrder.tableName
        ? `Dine-In • ${selectedOrder.tableName}`
        : selectedOrder.tableId
        ? `Dine-In • Table #${selectedOrder.tableId}`
        : 'Quick Order (Counter / Takeaway)';

    return (
      <ScrollView
        style={styles.scrollBody}
        contentContainerStyle={
          styles.scrollContent
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        {/* Navigation & Header */}
        <View
          style={styles.detailNavRow}
        >
          <TouchableOpacity
            style={styles.backNavBtn}
            onPress={() =>
              setViewMode('list')
            }
          >
            <ArrowLeft
              size={16}
              color="#D33401"
            />

            <Text
              style={
                styles.backNavBtnText
              }
            >
              All Orders (
              {allOrdersList.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.refreshIconBtn}
            onPress={loadOrders}
            disabled={loadingOrders}
          >
            {loadingOrders ? (
              <ActivityIndicator
                size="small"
                color="#747878"
              />
            ) : (
              <RefreshCw
                size={15}
                color="#747878"
              />
            )}
          </TouchableOpacity>
        </View>

        {/* RESTAURANT BRAND & ADDRESS HEADER */}
        <View style={styles.restaurantBrandCard}>
          {(selectedOrder.logoUrl || catalog?.logoUrl || selectedOrder.imageUrl || catalog?.imageUrl) ? (
            <Image
              source={{ uri: selectedOrder.logoUrl || catalog?.logoUrl || selectedOrder.imageUrl || catalog?.imageUrl }}
              style={styles.restaurantBrandLogo}
              resizeMode="cover"
            />
          ) : null}
          <View style={{ flex: 1 }}>
            <Text style={styles.restaurantBrandName}>
              {selectedOrder.restaurantName || catalog?.restaurantName || ''}
            </Text>
            {((selectedOrder.address || catalog?.address) || (selectedOrder.city || catalog?.city)) ? (
              <Text style={styles.restaurantBrandAddress}>
                {[
                  selectedOrder.address || catalog?.address,
                  selectedOrder.city || catalog?.city,
                  selectedOrder.state || catalog?.state
                ].filter(Boolean).join(', ')}
              </Text>
            ) : null}
            {(selectedOrder.contactPhone || catalog?.contactNumber) ? (
              <Text style={styles.restaurantBrandContact}>
                Ph: {selectedOrder.contactPhone || catalog?.contactNumber}
              </Text>
            ) : null}
          </View>
        </View>

        {/* ORDER STATUS HERO CARD */}
        <View
          style={[
            styles.statusHeroCard,
            {
              borderColor:
                badgeColor,
              backgroundColor:
                badgeBg,
            },
          ]}
        >
          <View
            style={styles.statusHeroTop}
          >
            <View
              style={
                styles.statusHeroLeft
              }
            >
              <View
                style={styles.tokenPill}
              >
                <Tag
                  size={13}
                  color="#D33401"
                />

                <Text
                  style={
                    styles.tokenPillText
                  }
                >
                  {tokenNumber}
                </Text>
              </View>
              <Text style={styles.orderIdHeroText}>Order #{selectedOrder.id}</Text>
            </View>

            <View
              style={[
                styles.statusBadgePill,
                {
                  backgroundColor:
                    badgeColor,
                },
              ]}
            >
              <Text
                style={
                  styles.statusBadgePillText
                }
              >
                {label}
              </Text>
            </View>
          </View>

          <Text
            style={
              styles.channelHeroText
            }
          >
            {channelText}
          </Text>

          <View
            style={styles.heroTimeRow}
          >
            <Calendar
              size={12}
              color="#64748b"
            />

            <Text
              style={styles.heroTimeText}
            >
              {formattedDate}
            </Text>
          </View>
        </View>

        {/* LIVE KITCHEN PROGRESS STEPPER */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <ChefHat size={16} color="#D33401" />
            <Text style={styles.cardTitle}>Live Kitchen Progress</Text>
          </View>

          <View style={styles.stepperContainer}>
            {STATUSES.map((step, idx) => {
              const isDone = idx <= currentIdx;
              const isCurrent = idx === currentIdx;

              return (
                <View key={step} style={styles.stepperStep}>
                  <View
                    style={[
                      styles.stepCircle,
                      isDone && styles.stepCircleDone,
                      isCurrent && styles.stepCircleCurrent,
                    ]}
                  >
                    {isDone ? (
                      <Check size={12} color="#ffffff" strokeWidth={3} />
                    ) : (
                      <Text style={styles.stepNumText}>{idx + 1}</Text>
                    )}
                  </View>

                  <Text
                    style={[
                      styles.stepLabelText,
                      isDone && styles.stepLabelTextDone,
                      isCurrent && styles.stepLabelTextCurrent,
                    ]}
                    numberOfLines={1}
                  >
                    {step === 'Delivered' ? 'Served' : step}
                  </Text>

                  {idx < STATUSES.length - 1 && (
                    <View
                      style={[
                        styles.stepConnector,
                        idx < currentIdx && styles.stepConnectorDone,
                      ]}
                    />
                  )}
                </View>
              );
            })}
          </View>

          <View style={styles.statusMessageCallout}>
            <Flame size={18} color="#f59e0b" />
            <View style={styles.statusMessageTextWrap}>
              <Text style={styles.statusMessageTitle}>
                {normalizedStatus === 'Preparing'
                  ? 'Chef is cooking your dishes!'
                  : normalizedStatus === 'Ready'
                  ? 'Your order is ready for serving!'
                  : normalizedStatus === 'Delivered'
                  ? 'Order served. Enjoy your meal!'
                  : isAwaitingPayment
                  ? 'Awaiting payment confirmation.'
                  : 'Order queued in kitchen.'}
              </Text>
              <Text style={styles.statusMessageSub}>
                Estimated preparation: ~15 to 20 mins
              </Text>
            </View>
          </View>
        </View>

        {/* CUSTOMER & DINER INFO */}
        <View style={styles.card}>
          <View
            style={styles.sectionHeader}
          >
            <User
              size={16}
              color="#10b981"
            />

            <Text
              style={styles.cardTitle}
            >
              Customer & Dining Info
            </Text>
          </View>

          <View
            style={styles.infoTable}
          >
            <View
              style={
                styles.infoTableRow
              }
            >
              <Text
                style={
                  styles.infoTableLabel
                }
              >
                Customer Name:
              </Text>

              <Text
                style={
                  styles.infoTableValue
                }
              >
                {selectedOrder.customerName ||
                  selectedOrder.name ||
                  ''}
              </Text>
            </View>

            <View
              style={
                styles.infoTableRow
              }
            >
              <Text
                style={
                  styles.infoTableLabel
                }
              >
                Mobile Number:
              </Text>

              <Text
                style={
                  styles.infoTableValue
                }
              >
                {maskPhoneLast4(selectedOrder.maskedMobileNumber || selectedOrder.mobileNumber || selectedOrder.customerPhone) || ''}
              </Text>
            </View>

            <View style={styles.infoTableRow}>
              <Text style={styles.infoTableLabel}>Delivery / Dining Type:</Text>
              <Text style={styles.infoTableValue}>
                {selectedOrder.deliveryType || (selectedOrder.tableId ? 'Dine-In' : 'Takeaway / Counter')}
              </Text>
            </View>

            <View
              style={
                styles.infoTableRow
              }
            >
              <Text
                style={
                  styles.infoTableLabel
                }
              >
                Dining Channel:
              </Text>

              <Text
                style={
                  styles.infoTableValue
                }
              >
                {channelText}
              </Text>
            </View>

            <View style={styles.infoTableRow}>
              <Text style={styles.infoTableLabel}>Payment Mode & Type:</Text>
              <Text style={styles.infoTableValue}>
                {isOnline ? 'Online (Cashfree / UPI)' : 'Cash (Counter / Table)'}
              </Text>
            </View>

            <View style={styles.infoTableRow}>
              <Text style={styles.infoTableLabel}>Settlement Status:</Text>
              <Text style={[styles.infoTableValue, { color: (isPaid || isOnline) ? '#16a34a' : '#ea580c', fontWeight: '700' }]}>
                {(isPaid || isOnline) ? '✓ Settled & Auto-Confirmed' : '⏳ Awaiting Cashier Confirmation'}
              </Text>
            </View>

            {selectedOrder.remarks ? (
              <View
                style={
                  styles.remarksBanner
                }
              >
                <MessageSquare
                  size={13}
                  color="#f59e0b"
                />

                <Text
                  style={
                    styles.remarksBannerText
                  }
                >
                  Special Note:{' '}
                  {selectedOrder.remarks}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* DETAILED RECEIPT / ORDERED ITEMS BREAKDOWN */}
        <View style={styles.card}>
          <View
            style={styles.sectionHeader}
          >
            <Text
              style={styles.cardTitle}
            >
              Official Receipt Breakdown (
              {items.reduce(
                (s, i) =>
                  s +
                  (Number(
                    i.quantity
                  ) || 1),
                0
              )}{' '}
              items)
            </Text>
          </View>

          <View
            style={
              styles.receiptTableHeader
            }
          >
            <Text
              style={[
                styles.receiptHeaderCol,
                { flex: 2 },
              ]}
            >
              Dish Item
            </Text>

            <Text
              style={[
                styles.receiptHeaderCol,
                {
                  flex: 1.2,
                  textAlign:
                    'center',
                },
              ]}
            >
              Qty & Unit
            </Text>

            <Text
              style={[
                styles.receiptHeaderCol,
                {
                  flex: 1,
                  textAlign:
                    'right',
                },
              ]}
            >
              Price
            </Text>

            <Text
              style={[
                styles.receiptHeaderCol,
                {
                  flex: 1,
                  textAlign:
                    'right',
                },
              ]}
            >
              Total
            </Text>
          </View>

          {items.length === 0 ? (
            <View
              style={
                styles.emptyItems
              }
            >
              <Text
                style={
                  styles.emptyText
                }
              >
                No items found for this
                order.
              </Text>
            </View>
          ) : (
            items.map(
              (item, idx) => {
                const qty =
                  Number(
                    item.quantity || 1
                  );

                const unitPrice =
                  Number(
                    item.unitPrice ??
                      item.amount ??
                      item.price ??
                      0
                  );

                const lineTotal =
                  Number(
                    item.totalAmount ??
                      unitPrice * qty
                  );

                const unitName =
                  item.unitName ||
                  item.unitDescription ||
                  (item.unit
                    ? `Unit #${item.unit}`
                    : '') ||
                  'Plate';

                return (
                  <View
                    key={
                      item.itemId ??
                      idx
                    }
                    style={
                      styles.receiptItemRow
                    }
                  >
                    <View
                      style={{
                        flex: 2,
                        paddingRight: 6,
                      }}
                    >
                      <Text
                        style={
                          styles.receiptItemName
                        }
                      >
                        {item.itemName ||
                          item.name ||
                          'Menu Dish'}
                      </Text>

                      {item.cookingInstruction ? (
                        <Text
                          style={
                            styles.receiptItemNote
                          }
                        >
                          Note:{' '}
                          {
                            item.cookingInstruction
                          }
                        </Text>
                      ) : null}
                    </View>

                    <View
                      style={{
                        flex: 1.2,
                        alignItems:
                          'center',
                      }}
                    >
                      <View
                        style={
                          styles.qtyUnitBadge
                        }
                      >
                        <Text
                          style={
                            styles.qtyUnitBadgeNumber
                          }
                        >
                          {qty}×
                        </Text>

                        <Text
                          style={
                            styles.qtyUnitBadgeName
                          }
                          numberOfLines={1}
                        >
                          {unitName}
                        </Text>
                      </View>
                    </View>

                    <View
                      style={{
                        flex: 1,
                        alignItems:
                          'flex-end',
                      }}
                    >
                      <Text
                        style={
                          styles.receiptUnitPriceText
                        }
                      >
                        ₹
                        {unitPrice.toFixed(
                          2
                        )}
                      </Text>
                    </View>

                    <View
                      style={{
                        flex: 1,
                        alignItems:
                          'flex-end',
                      }}
                    >
                      <Text
                        style={
                          styles.receiptLineTotalText
                        }
                      >
                        ₹
                        {lineTotal.toFixed(
                          2
                        )}
                      </Text>
                    </View>
                  </View>
                );
              }
            )
          )}

          <View
            style={
              styles.receiptDivider
            }
          />

          <View
            style={
              styles.billBreakdown
            }
          >
            <View
              style={styles.billRow}
            >
              <Text
                style={styles.billLabel}
              >
                Item Subtotal
              </Text>

              <Text
                style={styles.billValue}
              >
                ₹{subtotal.toFixed(2)}
              </Text>
            </View>

            <View
              style={styles.billRow}
            >
              <Text
                style={styles.billLabel}
              >
                CGST (2.5%)
              </Text>

              <Text
                style={styles.billValue}
              >
                ₹{cgst.toFixed(2)}
              </Text>
            </View>

            <View
              style={styles.billRow}
            >
              <Text
                style={styles.billLabel}
              >
                SGST (2.5%)
              </Text>

              <Text
                style={styles.billValue}
              >
                ₹{sgst.toFixed(2)}
              </Text>
            </View>

            <View
              style={
                styles.receiptDividerBold
              }
            />

            <View
              style={
                styles.grandTotalRow
              }
            >
              <View>
                <Text
                  style={
                    styles.grandTotalLabel
                  }
                >
                  Grand Total Amount
                </Text>

                <Text
                  style={
                    styles.grandTotalTaxesNote
                  }
                >
                  (Inclusive of all
                  applicable taxes)
                </Text>
              </View>

              <Text
                style={
                  styles.grandTotalValue
                }
              >
                ₹{grandTotal.toFixed(2)}
              </Text>
            </View>
          </View>
        </View>

        {/* PAYMENT METHOD & STATUS CARD */}
        <View
          style={styles.paymentCard}
        >
          <View
            style={
              styles.paymentCardIconWrap
            }
          >
            <CreditCard
              size={18}
              color="#D33401"
            />
          </View>

          <View
            style={
              styles.paymentCardContent
            }
          >
            <View
              style={
                styles.paymentCardTopRow
              }
            >
              <Text
                style={
                  styles.paymentCardTitle
                }
              >
                {isOnline
                  ? 'Online Payment (Direct / Cashfree)'
                  : 'Cash Payment (At Counter / Table)'}
              </Text>

              <View
                style={[
                  styles.paymentPill,
                  (isPaid || isOnline)
                    ? styles.paymentPillPaid
                    : styles.paymentPillPending,
                ]}
              >
                <Text
                  style={[
                    styles.paymentPillText,
                    (isPaid || isOnline)
                      ? styles.paymentPillTextPaid
                      : styles.paymentPillTextPending,
                  ]}
                >
                  {(isPaid || isOnline)
                    ? '✓ PAID & SETTLED'
                    : 'PENDING CASHIER CONFIRMATION'}
                </Text>
              </View>
            </View>

            <Text
              style={
                styles.paymentCardSubText
              }
            >
              Delivery Type: {selectedOrder.deliveryType || (selectedOrder.tableId ? 'Dine-In' : 'Takeaway / Counter')} • Mode: {selectedOrder.paymentMode || (isOnline ? 'ONLINE' : 'CASH')}
            </Text>

            <View style={{ marginTop: 8, padding: 8, borderRadius: 6, backgroundColor: (isPaid || isOnline) ? '#f0fdf4' : '#fffbeb' }}>
              <Text style={{ fontSize: 11, color: (isPaid || isOnline) ? '#166534' : '#92400e', fontWeight: '500', lineHeight: 15 }}>
                {(isPaid || isOnline)
                  ? '✓ This online order is settled and confirmed directly to kitchen for preparation.'
                  : '⏳ This cash order requires manual acceptance & confirmation by the cashier or restaurant owner before kitchen prep.'}
              </Text>
            </View>

            {selectedOrder.paymentOrderId ||
            selectedOrder.cashfreeOrderId ? (
              <Text
                style={
                  styles.paymentTxnText
                }
              >
                Ref:{' '}
                {selectedOrder.paymentOrderId ||
                  selectedOrder.cashfreeOrderId}
              </Text>
            ) : null}
          </View>
        </View>
      </ScrollView>
    );
  };

  /* =========================================================
     RENDER: ALL ORDERS LIST VIEW
  ========================================================= */
  const renderListView = () => {
    return (
      <View style={styles.listContainer}>
        <View
          style={styles.searchRow}
        >
          <View
            style={styles.searchBar}
          >
            <Search
              size={15}
              color="#94a3b8"
            />

            <TextInput
              style={styles.searchInput}
              placeholder="Search by Order #, token, dish..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={
                setSearchQuery
              }
            />

            {searchQuery ? (
              <TouchableOpacity
                onPress={() =>
                  setSearchQuery('')
                }
              >
                <X
                  size={15}
                  color="#94a3b8"
                />
              </TouchableOpacity>
            ) : null}
          </View>

          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={loadOrders}
            disabled={loadingOrders}
          >
            {loadingOrders ? (
              <ActivityIndicator
                size="small"
                color="#ffffff"
              />
            ) : (
              <RefreshCw
                size={15}
                color="#ffffff"
              />
            )}
          </TouchableOpacity>
        </View>

        <View
          style={
            styles.filterTabsRow
          }
        >
          <TouchableOpacity
            style={[
              styles.filterTab,
              activeTab === 'all' &&
                styles.filterTabActive,
            ]}
            onPress={() =>
              setActiveTab('all')
            }
          >
            <Text
              style={[
                styles.filterTabText,
                activeTab === 'all' &&
                  styles.filterTabTextActive,
              ]}
            >
              All ({allOrdersList.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterTab,
              activeTab === 'active' &&
                styles.filterTabActive,
            ]}
            onPress={() =>
              setActiveTab('active')
            }
          >
            <Text
              style={[
                styles.filterTabText,
                activeTab === 'active' &&
                  styles.filterTabTextActive,
              ]}
            >
              Active ({activeCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterTab,
              activeTab === 'completed' &&
                styles.filterTabActive,
            ]}
            onPress={() =>
              setActiveTab('completed')
            }
          >
            <Text
              style={[
                styles.filterTabText,
                activeTab === 'completed' &&
                  styles.filterTabTextActive,
              ]}
            >
              Completed (
              {completedCount})
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.listScroll}
          contentContainerStyle={
            styles.listScrollContent
          }
          showsVerticalScrollIndicator={
            false
          }
        >
          {loadingOrders &&
          allOrdersList.length === 0 ? (
            <View
              style={styles.loadingBox}
            >
              <ActivityIndicator
                size="large"
                color="#D33401"
              />

              <Text
                style={
                  styles.loadingText
                }
              >
                Loading restaurant
                orders...
              </Text>
            </View>
          ) : filteredOrders.length ===
            0 ? (
            <View
              style={
                styles.emptyContainer
              }
            >
              <ShoppingBag
                size={42}
                color="#cbd5e1"
              />

              <Text
                style={
                  styles.emptyTitle
                }
              >
                No Orders Found
              </Text>

              <Text
                style={
                  styles.emptySubtitle
                }
              >
                {searchQuery
                  ? 'No orders match your search criteria.'
                  : activeTab === 'active'
                  ? 'There are no active kitchen orders right now.'
                  : 'Place your order from the menu catalog to track it here.'}
              </Text>
            </View>
          ) : (
            filteredOrders.map(
              (ord) => {
                const {
                  badgeColor,
                  badgeBg,
                  label,
                  isOnline,
                  isPaid,
                } =
                  getOrderStatusInfo(
                    ord
                  );

                const items =
                  Array.isArray(
                    ord.items
                  )
                    ? ord.items
                    : [];

                const tokenNumber =
                  ord.pickupToken ||
                  (ord.tokenNumber
                    ? `TK-${String(
                        ord.tokenNumber
                      ).padStart(
                        3,
                        '0'
                      )}`
                    : `TK-${String(
                        ord.id
                      ).padStart(
                        3,
                        '0'
                      )}`);

                const formattedDate =
                  ord.createdDateUtc ||
                  ord.createdAt
                    ? new Date(
                        ord.createdDateUtc ||
                          ord.createdAt
                      ).toLocaleString(
                        'en-IN',
                        {
                          dateStyle:
                            'medium',
                          timeStyle:
                            'short',
                        }
                      )
                    : 'Just now';

                const channelText =
                  ord.tableName
                    ? `Table ${ord.tableName}`
                    : ord.tableId
                    ? `Table #${ord.tableId}`
                    : 'Counter / Takeaway';

                const totalAmount =
                  Number(
                    ord.totalAmount ||
                      0
                  );

                return (
                  <TouchableOpacity
                    key={
                      ord.id ||
                      ord.orderId
                    }
                    style={
                      styles.orderCard
                    }
                    onPress={() => {
                      setSelectedOrder(
                        ord
                      );
                      setViewMode(
                        'detail'
                      );
                    }}
                    activeOpacity={0.85}
                  >
                    <View
                      style={
                        styles.orderCardHeader
                      }
                    >
                      <View
                        style={
                          styles.orderCardHeaderLeft
                        }
                      >
                        <View
                          style={
                            styles.tokenPillSmall
                          }
                        >
                          <Tag
                            size={11}
                            color="#D33401"
                          />

                          <Text
                            style={
                              styles.tokenPillSmallText
                            }
                          >
                            {tokenNumber}
                          </Text>
                        </View>
                        <Text style={styles.orderCardId}>Order #{ord.id}</Text>
                      </View>

                      <View
                        style={[
                          styles.cardStatusBadge,
                          {
                            backgroundColor:
                              badgeBg,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.cardStatusBadgeText,
                            {
                              color:
                                badgeColor,
                            },
                          ]}
                        >
                          {label}
                        </Text>
                      </View>
                    </View>

                    {/* Channel & Time */}
                    <View
                      style={
                        styles.cardMetaRow
                      }
                    >
                      <Text
                        style={
                          styles.cardChannelText
                        }
                      >
                        🍽️ {ord.deliveryType || channelText}
                      </Text>

                      <View style={{
                        marginHorizontal: 4,
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 4,
                        backgroundColor: (isPaid || isOnline) ? '#f0fdf4' : '#fffbeb',
                        borderWidth: 1,
                        borderColor: (isPaid || isOnline) ? '#bbf7d0' : '#fde68a'
                      }}>
                        <Text style={{
                          fontSize: 10,
                          fontWeight: '700',
                          color: (isPaid || isOnline) ? '#166534' : '#92400e'
                        }}>
                          {(isPaid || isOnline) ? '✓ Online Paid' : '💵 Cash (Pending)'}
                        </Text>
                      </View>

                      <Text
                        style={
                          styles.cardDateText
                        }
                      >
                        • {formattedDate}
                      </Text>
                    </View>

                    {/* Items List with Quantity and Unit Name */}
                    <View
                      style={
                        styles.cardItemsBox
                      }
                    >
                      {items
                        .slice(0, 3)
                        .map(
                          (
                            item,
                            i
                          ) => {
                            const qty =
                              Number(
                                item.quantity ||
                                  1
                              );

                            const unitName =
                              item.unitName ||
                              item.unitDescription ||
                              (item.unit
                                ? `Unit #${item.unit}`
                                : '') ||
                              'Plate';

                            return (
                              <View
                                key={i}
                                style={
                                  styles.cardItemLine
                                }
                              >
                                <Text
                                  style={
                                    styles.cardItemBullet
                                  }
                                >
                                  •
                                </Text>

                                <Text
                                  style={
                                    styles.cardItemQtyText
                                  }
                                >
                                  {qty}×
                                </Text>

                                <Text
                                  style={
                                    styles.cardItemNameText
                                  }
                                  numberOfLines={
                                    1
                                  }
                                >
                                  {item.itemName ||
                                    item.name ||
                                    'Dish Item'}
                                </Text>

                                <Text
                                  style={
                                    styles.cardItemUnitText
                                  }
                                >
                                  ({unitName})
                                </Text>
                              </View>
                            );
                          }
                        )}

                      {items.length >
                      3 ? (
                        <Text
                          style={
                            styles.cardMoreItemsText
                          }
                        >
                          +
                          {items.length -
                            3}{' '}
                          more dishes...
                        </Text>
                      ) : null}
                    </View>

                    <View
                      style={
                        styles.orderCardFooter
                      }
                    >
                      <View
                        style={
                          styles.cardFooterLeft
                        }
                      >
                        <Text
                          style={
                            styles.cardTotalLabel
                          }
                        >
                          Total Amount
                        </Text>

                        <Text
                          style={
                            styles.cardTotalValue
                          }
                        >
                          ₹
                          {totalAmount.toFixed(
                            2
                          )}
                        </Text>
                      </View>

                      <View
                        style={
                          styles.cardActionBtn
                        }
                      >
                        <Text
                          style={
                            styles.cardActionBtnText
                          }
                        >
                          Track & Receipt
                        </Text>

                        <ChevronRight
                          size={14}
                          color="#D33401"
                        />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }
            )
          )}
        </ScrollView>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View
          style={
            styles.sheetContainer
          }
        >
          <View
            style={styles.modalHeader}
          >
            <View
              style={
                styles.modalHeaderLeft
              }
            >
              <View
                style={
                  styles.headerIconWrap
                }
              >
              </View>

              <View>
                <Text
                  style={
                    styles.modalHeaderTitle
                  }
                >
                  {viewMode ===
                  'detail'
                    ? 'Order Live Tracking'
                    : 'Restaurant Orders'}
                </Text>

                <Text
                  style={
                    styles.modalHeaderSubtitle
                  }
                >
                  {catalog?.restaurantName ||
                    'Menza Smart Dining'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={
                styles.modalCloseBtn
              }
              accessibilityLabel="Close Orders Modal"
            >
              <X
                size={20}
                color="#64748b"
              />
            </TouchableOpacity>
          </View>

          {viewMode === 'detail'
            ? renderDetailView()
            : renderListView()}

          <View
            style={styles.footer}
          >
            {viewMode === 'detail' ? (
              <View
                style={
                  styles.detailFooterRow
                }
              >
                <TouchableOpacity
                  style={
                    styles.switchToListBtn
                  }
                  onPress={() =>
                    setViewMode('list')
                  }
                >
                  <Layers
                    size={15}
                    color="#1B1C1C"
                  />

                  <Text
                    style={
                      styles.switchToListBtnText
                    }
                  >
                    All Orders (
                    {allOrdersList.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={
                    styles.closeDoneBtn
                  }
                  onPress={onClose}
                >
                  <Text
                    style={
                      styles.closeDoneBtnText
                    }
                  >
                    Done
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={
                  styles.closeDoneBtnFull
                }
                onPress={onClose}
              >
                <Text
                  style={
                    styles.closeDoneBtnText
                  }
                >
                  Back to Menu
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor:
      'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },

  sheetContainer: {
    width: '100%',
    maxWidth: 620,
    maxHeight: '92%',
    backgroundColor: '#FAF8F5',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    flexDirection: 'column',
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },

  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  headerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFF1EC',
    justifyContent: 'center',
    alignItems: 'center',
  },

  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1B1C1C',
    letterSpacing: -0.2,
  },

  modalHeaderSubtitle: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },

  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },

  listContainer: {
    flex: 1,
  },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
    backgroundColor: '#FFFFFF',
  },

  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
  },

  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#1B1C1C',
    paddingVertical: 0,
  },

  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#D33401',
    justifyContent: 'center',
    alignItems: 'center',
  },

  filterTabsRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },

  filterTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },

  filterTabActive: {
    backgroundColor: '#D33401',
  },

  filterTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },

  filterTabTextActive: {
    color: '#ffffff',
  },

  listScroll: {
    flex: 1,
  },

  listScrollContent: {
    padding: 14,
    gap: 12,
  },

  loadingBox: {
    padding: 40,
    alignItems: 'center',
    gap: 10,
  },

  loadingText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },

  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1B1C1C',
    marginTop: 6,
  },

  emptySubtitle: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },

  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    gap: 8,
  },

  orderCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  orderCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  orderCardId: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1B1C1C',
  },

  tokenPillSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF1EC',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },

  tokenPillSmallText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D33401',
  },

  cardStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },

  cardStatusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },

  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  cardChannelText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },

  cardDateText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },

  cardItemsBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },

  cardItemLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  cardItemBullet: {
    color: '#D33401',
    fontWeight: '900',
  },

  cardItemQtyText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1B1C1C',
  },

  cardItemNameText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    flex: 1,
  },

  cardItemUnitText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },

  cardMoreItemsText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#D33401',
    marginTop: 2,
  },

  orderCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },

  cardFooterLeft: {
    gap: 1,
  },

  cardTotalLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
  },

  cardTotalValue: {
    fontSize: 15,
    fontWeight: '900',
    color: '#1B1C1C',
  },

  cardActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF1EC',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },

  cardActionBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#D33401',
  },

  scrollBody: {
    flex: 1,
  },

  scrollContent: {
    padding: 14,
    gap: 12,
  },

  detailNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  backNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  backNavBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D33401',
  },

  refreshIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },

  statusHeroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    gap: 6,
  },

  statusHeroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  statusHeroLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  orderIdHeroText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1B1C1C',
  },

  tokenPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFD6C9',
  },

  tokenPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#D33401',
  },

  statusBadgePill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },

  statusBadgePillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },

  channelHeroText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },

  heroTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  heroTimeText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  cardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1B1C1C',
    letterSpacing: -0.2,
  },

  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },

  stepperStep: {
    alignItems: 'center',
    flex: 1,
    position: 'relative',
  },

  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#CBD5E1',
    zIndex: 2,
  },

  stepCircleDone: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },

  stepCircleCurrent: {
    backgroundColor: '#D33401',
    borderColor: '#D33401',
  },

  stepNumText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },

  stepLabelText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94a3b8',
    marginTop: 4,
    textAlign: 'center',
  },

  stepLabelTextDone: {
    color: '#10b981',
    fontWeight: '700',
  },

  stepLabelTextCurrent: {
    color: '#D33401',
    fontWeight: '800',
  },

  stepConnector: {
    position: 'absolute',
    top: 13,
    left: '50%',
    right: '-50%',
    height: 2,
    backgroundColor: '#E2E8F0',
    zIndex: 1,
  },

  stepConnectorDone: {
    backgroundColor: '#10b981',
  },

  statusMessageCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFBEB',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },

  statusMessageTextWrap: {
    flex: 1,
  },

  statusMessageTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B45309',
  },

  statusMessageSub: {
    fontSize: 11,
    color: '#92400E',
    marginTop: 1,
  },

  infoTable: {
    gap: 6,
  },

  infoTableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  infoTableLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },

  infoTableValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1B1C1C',
  },

  remarksBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    padding: 8,
    borderRadius: 8,
    marginTop: 4,
  },

  remarksBannerText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#92400E',
  },

  receiptTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },

  receiptHeaderCol: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
  },

  receiptItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },

  receiptItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1B1C1C',
  },

  receiptItemNote: {
    fontSize: 10,
    color: '#d97706',
    fontStyle: 'italic',
    marginTop: 1,
  },

  qtyUnitBadge: {
    alignItems: 'center',
    backgroundColor: '#FFF1EC',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    maxWidth: 90,
  },

  qtyUnitBadgeNumber: {
    fontSize: 11,
    fontWeight: '900',
    color: '#D33401',
  },

  qtyUnitBadgeName: {
    fontSize: 9,
    fontWeight: '700',
    color: '#D33401',
    textTransform: 'capitalize',
  },

  receiptUnitPriceText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },

  receiptLineTotalText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1B1C1C',
  },

  receiptDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 4,
  },

  receiptDividerBold: {
    height: 1.5,
    backgroundColor: '#CBD5E1',
    marginVertical: 6,
  },

  billBreakdown: {
    gap: 4,
    paddingHorizontal: 4,
  },

  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  billLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },

  billValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1B1C1C',
  },

  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 2,
  },

  grandTotalLabel: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1B1C1C',
  },

  grandTotalTaxesNote: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '500',
  },

  grandTotalValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#D33401',
  },

  paymentCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 12,
    gap: 10,
  },

  paymentCardIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFF1EC',
    justifyContent: 'center',
    alignItems: 'center',
  },

  paymentCardContent: {
    flex: 1,
    gap: 2,
  },

  paymentCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },

  paymentCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1B1C1C',
  },

  paymentPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },

  paymentPillPaid: {
    backgroundColor: '#DCFCE7',
  },

  paymentPillPending: {
    backgroundColor: '#FEF3C7',
  },

  paymentPillText: {
    fontSize: 10,
    fontWeight: '800',
  },

  paymentPillTextPaid: {
    color: '#16A34A',
  },

  paymentPillTextPending: {
    color: '#D97706',
  },

  paymentCardSubText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 2,
  },

  paymentTxnText: {
    fontSize: 10,
    color: '#94a3b8',
    fontFamily: 'monospace',
    marginTop: 2,
  },

  footer: {
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },

  detailFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  switchToListBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },

  switchToListBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1B1C1C',
  },

  closeDoneBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#D33401',
    alignItems: 'center',
    justifyContent: 'center',
  },

  closeDoneBtnFull: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#D33401',
    alignItems: 'center',
    justifyContent: 'center',
  },

  closeDoneBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },

  backToListBtn: {
    backgroundColor: '#D33401',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 8,
  },

  backToListBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
  restaurantBrandCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  restaurantBrandLogo: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
  },
  restaurantBrandName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E293B',
  },
  restaurantBrandAddress: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 2,
  },
  restaurantBrandContact: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 1,
  },
});