import React, { useEffect, useMemo, useState } from 'react';
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
  CheckCircle2,
  Flame,
  Clock,
  Utensils,
  Bell,
  Droplets,
  Receipt,
  Sparkles,
} from 'lucide-react';
import * as api from '../services/api';
import * as signalrService from '../services/signalr';
import { Order, Catalog, Table, StoreOperatingStatus } from '../types';

const STATUSES = [
  'Pending',
  'Confirmed',
  'Preparing',
  'Ready',
  'Served',
];


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

const PAYMENT_MODE_ONLINE = ['ONLINE', 'CASHFREE', 'UPI'];
const PAYMENT_METHOD_ONLINE = ['CASHFREE', 'CASHFREE_SPLIT', 'ONLINE', 'UPI'];
const PAYMENT_STATES_PAID = ['PAID', 'SUCCESS', 'COMPLETED', 'CAPTURED'];
const TERMINAL_STATUSES = ['Served', 'Delivered', 'Cancelled'];

const STATUS_ALIASES = {
  Pending: ['pending', 'placed', 'created', 'new', 'received'],
  Confirmed: ['confirmed', 'accepted', 'approved', 'order confirmed'],
  Preparing: ['preparing', 'prepare', 'in preparation', 'processing', 'cooking', 'in kitchen', 'kitchen'],
  Ready: ['ready', 'prepared', 'ready to serve', 'ready for pickup'],
  Served: ['served', 'delivered', 'completed', 'settled', 'picked up', 'pickedup', 'closed'],
  Cancelled: ['cancelled', 'rejected', 'canceled', 'declined'],
};

const maskPhoneLast4 = (phone) => {
  if (!phone) return '';
  const str = String(phone).trim();
  if (str.includes('*')) return str;
  const digits = str.replace(/\D/g, '');
  if (digits.length <= 4) return digits;
  return '******' + digits.slice(-4);
};

const normalizeStatus = (value) => {
  const valueLower = String(value ?? '').trim().toLowerCase();

  for (const [status, aliases] of Object.entries(STATUS_ALIASES)) {
    if (aliases.includes(valueLower)) return status;
  }

  return 'Pending';
};

const resolveIsKitchenActive = (ord, isKitchenActiveOverride = null, catalog = null, storeOperatingStatus = null) => {
  if (typeof isKitchenActiveOverride === 'boolean') return isKitchenActiveOverride;
  if (typeof api?.isLiveKitchenActive === 'function') {
    return api.isLiveKitchenActive(ord, catalog, storeOperatingStatus);
  }
  return Boolean(ord?.isKitchenActive ?? catalog?.isKitchenActive ?? storeOperatingStatus?.isKitchenActive ?? true);
};

const getOrderStatusInfo = (ord, isKitchenActiveOverride = null, catalog = null, storeOperatingStatus = null) => {
  const isKitchenActive = resolveIsKitchenActive(ord, isKitchenActiveOverride, catalog, storeOperatingStatus);

  const paymentMode = String(ord?.paymentMode ?? '').trim().toUpperCase();
  const paymentMethod = String(ord?.paymentMethod ?? '').trim().toUpperCase();
  const paymentState = String(ord?.paymentStatus ?? '').trim().toUpperCase();

  const isOnline =
    PAYMENT_MODE_ONLINE.includes(paymentMode) ||
    PAYMENT_METHOD_ONLINE.includes(paymentMethod) ||
    ord?.isOnline === true;

  const isPaid = PAYMENT_STATES_PAID.includes(paymentState) || Boolean(ord?.settledDateUtc) || ord?.isSettled === true || isOnline;
  const isAwaitingPayment = isOnline && !isPaid;

  let rawStatus = 'Pending';
  let badge = null;

  if (isKitchenActive) {
    // If restaurant has IsKitchenActive === true, resolve and display KITCHEN status
    const kitchenStatusCandidates = [
      ord?.kitchenStatus,
      ord?.KitchenStatus,
      ord?.kitchenOrderStatus,
      ord?.KitchenOrderStatus,
    ]
      .filter((value) => value !== null && value !== undefined && value !== '')
      .map(normalizeStatus);

    rawStatus =
      kitchenStatusCandidates.length > 0
        ? kitchenStatusCandidates[0]
        : normalizeStatus(ord?.orderStatus || 'Pending');

    const orderStLower = String(ord?.orderStatus || '').toLowerCase();
    if (orderStLower.includes('serve') || orderStLower.includes('deliver') || orderStLower.includes('complete') || orderStLower.includes('settled')) {
      rawStatus = 'Served';
    } else if (orderStLower.includes('cancel')) {
      rawStatus = 'Cancelled';
    }

    // Business Rule: For Cash QR orders, status will only be Confirmed AFTER Payment to cashier settlement.
    if (!isOnline && !isPaid) {
      if (rawStatus === 'Confirmed' || rawStatus === 'Preparing') {
        rawStatus = 'Pending';
      }
    }

    const normalizedStatus = isAwaitingPayment ? 'Pending' : rawStatus;

    const kitchenBadgeByStatus = {
      Confirmed: { badgeColor: '#0d9488', badgeBg: '#ccfbf1', label: 'Confirmed' },
      Preparing: { badgeColor: '#ea580c', badgeBg: '#ffedd5', label: 'In Kitchen' },
      Ready: { badgeColor: '#7c3aed', badgeBg: '#ede9fe', label: 'Ready to Serve' },
      Served: {
        badgeColor: '#15803d',
        badgeBg: '#dcfce7',
        label: isDineInOrder(ord) ? 'Served to Table' : 'Picked Up',
      },
      Cancelled: { badgeColor: '#dc2626', badgeBg: '#fee2e2', label: 'Cancelled' },
    };

    badge = kitchenBadgeByStatus[normalizedStatus] || {
      badgeColor: '#0284c7',
      badgeBg: '#e0f2fe',
      label: 'Received',
    };

    return {
      rawStatus,
      normalizedStatus,
      isKitchenActive: true,
      isOnline,
      isPaid,
      isAwaitingPayment,
      ...badge,
    };
  } else {
    // If restaurant has IsKitchenActive === false, resolve and display ORDER status
    const orderStatusCandidates = [
      ord?.orderStatus,
      ord?.orderStatusName,
      ord?.status,
      ord?.statusName,
      ord?.orderState,
    ]
      .filter((value) => value !== null && value !== undefined && value !== '')
      .map(normalizeStatus);

    rawStatus =
      orderStatusCandidates.length > 0
        ? orderStatusCandidates[0]
        : 'Pending';

    // Business Rule: For Cash QR orders, status will only be Confirmed AFTER Payment to cashier settlement.
    if (!isOnline && !isPaid) {
      if (rawStatus === 'Confirmed') {
        rawStatus = 'Pending';
      }
    }

    const normalizedStatus = isAwaitingPayment ? 'Pending' : rawStatus;

    const orderBadgeByStatus = {
      Confirmed: { badgeColor: '#0d9488', badgeBg: '#ccfbf1', label: 'Confirmed' },
      Preparing: { badgeColor: '#0d9488', badgeBg: '#ccfbf1', label: 'Confirmed' },
      Ready: { badgeColor: '#0d9488', badgeBg: '#ccfbf1', label: 'Confirmed' },
      Served: {
        badgeColor: '#15803d',
        badgeBg: '#dcfce7',
        label: isDineInOrder(ord) ? 'Completed' : 'Picked Up',
      },
      Delivered: {
        badgeColor: '#15803d',
        badgeBg: '#dcfce7',
        label: 'Completed',
      },
      Cancelled: { badgeColor: '#dc2626', badgeBg: '#fee2e2', label: 'Cancelled' },
    };

    badge = orderBadgeByStatus[normalizedStatus] || {
      badgeColor: '#0284c7',
      badgeBg: '#e0f2fe',
      label: 'Placed',
    };

    return {
      rawStatus,
      normalizedStatus,
      isKitchenActive: false,
      isOnline,
      isPaid,
      isAwaitingPayment,
      ...badge,
    };
  }
};

const getOrderItems = (orderItem) => {
  if (!orderItem) return [];
  if (Array.isArray(orderItem.items) && orderItem.items.length > 0) return orderItem.items;
  if (Array.isArray(orderItem.orderItems) && orderItem.orderItems.length > 0) return orderItem.orderItems;
  if (Array.isArray(orderItem.OrderItems) && orderItem.OrderItems.length > 0) return orderItem.OrderItems;
  if (Array.isArray(orderItem.Items) && orderItem.Items.length > 0) return orderItem.Items;
  if (Array.isArray(orderItem.orderDetails) && orderItem.orderDetails.length > 0) return orderItem.orderDetails;
  if (Array.isArray(orderItem.OrderDetails) && orderItem.OrderDetails.length > 0) return orderItem.OrderDetails;
  return Array.isArray(orderItem.items) ? orderItem.items : [];
};

const getOrderTokenNumber = (ord) => {
  if (!ord) return 'TK-001';
  if (ord.pickupToken) return ord.pickupToken;
  if (ord.tokenNumber) return `TK-${String(ord.tokenNumber).padStart(3, '0')}`;
  if (ord.TokenNumber) return `TK-${String(ord.TokenNumber).padStart(3, '0')}`;
  const idVal = ord.id ?? ord.orderId ?? ord.Id ?? ord.OrderId;
  return idVal ? `TK-${String(idVal).padStart(3, '0')}` : 'TK-001';
};

const formatOrderDate = (ord, fallback = 'Just now') => {
  const value = ord?.createdDateUtc || ord?.createdAt || ord?.CreatedDateUtc || ord?.CreatedAt;
  return value
    ? new Date(value).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : fallback;
};

const normalizeDeliveryType = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/-+/g, '-');

const isDineInOrder = (ord) =>
  ['dine-in', 'dine-in-order', 'dinein'].includes(
    normalizeDeliveryType(ord?.deliveryType || ord?.DeliveryType)
  );

const hasOrderTableId = (ord) => {
  if (!ord) return false;
  const tid = ord.tableId ?? ord.TableId ?? ord.tableNumber ?? ord.TableNumber;
  if (tid === null || tid === undefined || tid === '' || tid === false) return false;
  const num = Number(tid);
  if (!isNaN(num)) {
    return num > 0;
  }
  return String(tid).trim().length > 0;
};

const getOrderDiningType = (ord) =>
  isDineInOrder(ord) ? 'Dine-In' : 'Self Pickup';

const getOrderChannelText = (ord) =>
  isDineInOrder(ord)
    ? ord?.tableName
      ? `Dine-In • ${ord.tableName}`
      : hasOrderTableId(ord)
      ? `Dine-In • Table #${ord.tableId}`
      : 'Dine-In'
    : 'Self Pickup';

const getItemUnitName = (item) =>
  item?.unitName ||
  item?.unitDescription ||
  (item?.unit ? `Unit #${item.unit}` : '') ||
  'Plate';


const isCompletedOrderStatus = (status) => TERMINAL_STATUSES.includes(status);

const filterOrders = (ordersList, activeTab, searchQuery) => {
  const list = Array.isArray(ordersList) ? ordersList : [];
  const query = (searchQuery || '').trim().toLowerCase();

  return list.filter((ord) => {
    const { normalizedStatus } = getOrderStatusInfo(ord);

    if (activeTab === 'active' && isCompletedOrderStatus(normalizedStatus)) {
      return false;
    }

    if (activeTab === 'completed' && !isCompletedOrderStatus(normalizedStatus)) {
      return false;
    }

    if (!query) return true;

    const idStr = String(ord?.id || ord?.orderId || '');
    const tokenStr = String(ord?.pickupToken || ord?.tokenNumber || '').toLowerCase();
    const dinerName = String(ord?.customerName || ord?.name || '').toLowerCase();
    const tableStr = String(ord?.tableName || ord?.tableNumber || '').toLowerCase();
    const itemsMatch = getOrderItems(ord).some((item) =>
      String(item?.itemName || item?.name || '')
        .toLowerCase()
        .includes(query)
    );

    return (
      idStr.includes(query) ||
      tokenStr.includes(query) ||
      dinerName.includes(query) ||
      tableStr.includes(query) ||
      itemsMatch
    );
  });
};

const getOrderTabCounts = (ordersList) => {
  const list = Array.isArray(ordersList) ? ordersList : [];
  let activeCount = 0;
  let completedCount = 0;

  for (const order of list) {
    const { normalizedStatus } = getOrderStatusInfo(order);
    if (['Delivered', 'Cancelled'].includes(normalizedStatus)) {
      completedCount += 1;
    } else {
      activeCount += 1;
    }
  }

  return { activeCount, completedCount };
};

export interface OrderTrackerModalProps {
  visible: boolean;
  onClose: () => void;
  order?: Order | null;
  targetOrder?: Order | null;
  orders?: Order[];
  catalog?: Catalog | null;
  activeTable?: Table | null;
  onRefreshOrder?: (orderId: number) => Promise<any> | any;
  storeOperatingStatus?: StoreOperatingStatus | null;
  openCallWaiter?: (action?: string) => void;
  onCallWaiter?: (action?: string) => void;
  onRequestBill?: () => void;
}

export default function OrderTrackerModal({
  visible,
  onClose,
  order,
  targetOrder,
  orders = [],
  catalog,
  activeTable,
  onRefreshOrder,
  storeOperatingStatus,
  openCallWaiter,
  onCallWaiter,
  onRequestBill,
}: OrderTrackerModalProps) {
  const [selectedOrder, setSelectedOrder] = useState<any>(() => {
    const init = targetOrder || order || api.getSavedActiveOrder() || null;
    return init && api.normalizeOrder ? api.normalizeOrder(init) : init;
  });
  const [viewMode, setViewMode] = useState<'detail' | 'list'>(() => (targetOrder || order || api.getSavedActiveOrder() ? 'detail' : 'list'));
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [allOrdersList, setAllOrdersList] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [, setTimerTick] = useState(0);

  // Live 1-second interval for real-time decreasing countdown
  useEffect(() => {
    if (!visible) return;
    const timer = setInterval(() => {
      setTimerTick((t) => (t + 1) % 10000);
    }, 1000);
    return () => clearInterval(timer);
  }, [visible]);

  // Synchronize on order prop change or whenever tracker modal becomes visible
  useEffect(() => {
    if (!visible) return;

    let target = targetOrder || order || selectedOrder || api.getSavedActiveOrder();
    if (!target && typeof localStorage !== 'undefined') {
      try {
        const localOrds = api.getLocalOrders ? api.getLocalOrders() : [];
        if (localOrds && localOrds.length > 0) {
          target = localOrds[0];
        } else {
          const rawPending = localStorage.getItem('pending_cf_order_latest');
          if (rawPending) {
            target = JSON.parse(rawPending);
          }
        }
      } catch (e) {}
    }

    const tid = Number(target?.id || target?.orderId || target?.Id || target?.OrderId);
    if (tid) {
      const normalized = api.normalizeOrder ? api.normalizeOrder(target) : target;
      setSelectedOrder(normalized);
      setViewMode('detail');
    } else if (allOrdersList.length > 0) {
      setSelectedOrder(allOrdersList[0]);
      setViewMode('detail');
    } else {
      setViewMode('list');
    }
  }, [visible, order, targetOrder]);

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

      const savedActive = api.getSavedActiveOrder();
      const localOrders = api.getLocalOrders ? api.getLocalOrders() : [];
      let pendingLatest = null;
      try {
        if (typeof localStorage !== 'undefined') {
          const rawP = localStorage.getItem('pending_cf_order_latest');
          if (rawP) pendingLatest = JSON.parse(rawP);
        }
      } catch (e) {}

      const combined = [
        ...(targetOrder ? [targetOrder] : []),
        ...(order ? [order] : []),
        ...(selectedOrder ? [selectedOrder] : []),
        ...(savedActive ? [savedActive] : []),
        ...(localOrders || []),
        ...(pendingLatest ? [pendingLatest] : []),
        ...(ords || []),
        ...(orders || []),
      ];
      const uniqueMap = new Map();

      for (const o of combined) {
        const id = Number(o?.id || o?.orderId || o?.Id || o?.OrderId);

        if (id && !uniqueMap.has(id)) {
          const norm = api.normalizeOrder ? api.normalizeOrder(o) : o;
          const curSelectedId = Number(selectedOrder?.id || selectedOrder?.orderId || selectedOrder?.Id || selectedOrder?.OrderId);
          if (curSelectedId && curSelectedId === id) {
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
        (a: any, b: any) =>
          new Date(b?.createdAt || b?.createdDateUtc || b?.CreatedAt || b?.CreatedDateUtc || 0).getTime() -
          new Date(a?.createdAt || a?.createdDateUtc || a?.CreatedAt || a?.CreatedDateUtc || 0).getTime()
      );

      setAllOrdersList(list);

      // If selectedOrder is null or not in list, auto-select latest order so user never sees empty screen
      if (list.length > 0) {
        const curId = Number(selectedOrder?.id || selectedOrder?.orderId || selectedOrder?.Id || selectedOrder?.OrderId);
        if (!curId || !list.some((o) => Number(o?.id || o?.orderId || o?.Id || o?.OrderId) === curId)) {
          setSelectedOrder(list[0]);
          setViewMode('detail');
        }
      }
    } catch (err) {
      console.log('Load orders error:', err);
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    const activeOrderId = Number(selectedOrder?.id || selectedOrder?.orderId || selectedOrder?.Id || selectedOrder?.OrderId);
    if (!visible || viewMode !== 'detail' || !activeOrderId) {
      return undefined;
    }

    let cancelled = false;
    let lastRefreshTime = 0;

    // Join SignalR order group for instant push updates
    signalrService.joinOrderGroup(activeOrderId);

    const refresh = async (force = false) => {
      const now = Date.now();
      if (!force && now - lastRefreshTime < 3000) {
        return; // Throttle to maximum 1 call per 3 seconds
      }
      lastRefreshTime = now;

      try {
        let latest = null;

        if (typeof onRefreshOrder === 'function') {
          latest = await onRefreshOrder(activeOrderId);
        } else {
          latest = await api.getOrder(activeOrderId);
        }

        if (!cancelled && latest) {
          setSelectedOrder((prev) => {
            if (!prev) return latest;

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
      if (changedOrderId === activeOrderId || !changedOrderId) {
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
      if (activeOrderId) {
        signalrService.leaveOrderGroup(activeOrderId);
      }
    };
  }, [
    visible,
    viewMode,
    selectedOrder?.id,
    selectedOrder?.orderId,
    selectedOrder?.Id,
    selectedOrder?.OrderId,
    onRefreshOrder,
  ]);

  const filteredOrders = useMemo(
    () => filterOrders(allOrdersList, activeTab, searchQuery),
    [allOrdersList, activeTab, searchQuery]
  );

  const { activeCount, completedCount } = useMemo(
    () => getOrderTabCounts(allOrdersList),
    [allOrdersList]
  );

  if (!visible) return null;

  const handleWaiterAction = (action) => {
    if (!hasOrderTableId(selectedOrder)) {
      return;
    }

    if (typeof openCallWaiter === 'function') {
      openCallWaiter(action);
      return;
    }

    if (action === 'REQUEST_BILL' && typeof onRequestBill === 'function') {
      onRequestBill();
      return;
    }

    if (typeof onCallWaiter === 'function') {
      onCallWaiter(action);
    }
  };

  const handleSelectOrder = (ord) => {
    setSelectedOrder(ord);
    setViewMode('detail');
  };

  /* =========================================================
     RENDER: ORDER DETAIL & RECEIPT VIEW
  ========================================================= */
  const renderDetailView = () => {
    try {
      let activeOrd =
        selectedOrder ||
        targetOrder ||
        order ||
        api.getSavedActiveOrder() ||
        (allOrdersList.length > 0 ? allOrdersList[0] : null);

      if (!activeOrd) {
        try {
          const localOrds = api.getLocalOrders ? api.getLocalOrders() : [];
          if (localOrds && localOrds.length > 0) {
            activeOrd = localOrds[0];
          } else if (typeof localStorage !== 'undefined') {
            const rawP = localStorage.getItem('pending_cf_order_latest');
            if (rawP) activeOrd = JSON.parse(rawP);
          }
        } catch (e) {}
      }

      if (!activeOrd) {
        if (allOrdersList.length > 0) {
          return renderListView();
        }
        return (
          <View style={styles.emptyContainer}>
            <UtensilsCrossed
              size={38}
              color="#EA580C"
            />

            <Text style={styles.emptyTitle}>
              No Active Orders
            </Text>

            <Text style={styles.emptySubtitle}>
              Browse our menu and place your order. You can track real-time kitchen preparation status right here!
            </Text>

            <TouchableOpacity
              style={styles.backToListBtn}
              onPress={onClose}
            >
              <Text
                style={
                  styles.backToListBtnText
                }
              >
                Browse Menu Catalog
              </Text>
            </TouchableOpacity>
          </View>
        );
      }

      const normalizedOrd = api.normalizeOrder ? api.normalizeOrder(activeOrd) : activeOrd;
      const curOrder = normalizedOrd || activeOrd;

      const isKitchenActive = resolveIsKitchenActive(curOrder, null, catalog, storeOperatingStatus);
      const isKitchenDisabled = !isKitchenActive;

      const {
        normalizedStatus,
        isOnline,
        isPaid,
        isAwaitingPayment,
        badgeColor,
        badgeBg,
        label,
      } = getOrderStatusInfo(
        curOrder,
        isKitchenActive,
        catalog,
        storeOperatingStatus
      );

      let prepCountdown = {
        formatted: 'Order confirmed',
        shortFormatted: 'Confirmed',
        diffSec: 0,
        minutes: 0,
        seconds: 0,
        isFinished: false,
        isOverdue: false,
        isAwaitingConfirmation: false,
        isTakeaway: false,
        isKitchenStatusDisabled: isKitchenDisabled,
        statusMessage: 'Order confirmed and received by restaurant.',
      };
      try {
        if (typeof api?.getDecreasingPreparationCountdown === 'function') {
          const res = api.getDecreasingPreparationCountdown(
            curOrder,
            catalog,
            storeOperatingStatus
          );
          if (res) prepCountdown = { ...prepCountdown, ...res };
        }
      } catch (e) {
        console.warn('prepCountdown calculation error:', e);
      }

    const currentIdx =
      STATUSES.indexOf(normalizedStatus) >= 0
        ? STATUSES.indexOf(normalizedStatus)
        : normalizedStatus === 'Delivered'
        ? STATUSES.indexOf('Served')
        : 0;

    const items = getOrderItems(curOrder);

    const itemsSum = items.reduce(
      (sum, item) => {
        const q = Number(item.quantity || 1);
        const p = Number(item.unitPrice ?? item.price ?? item.amount ?? (item.totalAmount > 0 ? item.totalAmount / q : 0));
        const t = Number(item.totalAmount ?? (p * q));
        return sum + t;
      },
      0
    );

    const subtotal =
      Number(
        (curOrder.subTotal > 0 ? curOrder.subTotal : null) ??
          (curOrder.orderAmount > 0 ? curOrder.orderAmount : null) ??
          (curOrder.itemTotal > 0 ? curOrder.itemTotal : null) ??
          (itemsSum > 0 ? itemsSum : 0)
      ) || 0;

    const cgst =
      Number(
        (curOrder.cgstAmount > 0 ? curOrder.cgstAmount : null) ??
          (curOrder.cgst > 0 ? curOrder.cgst : null) ??
          Math.round(
            subtotal * 0.025 * 100
          ) / 100
      ) || 0;

    const sgst =
      Number(
        (curOrder.sgstAmount > 0 ? curOrder.sgstAmount : null) ??
          (curOrder.sgst > 0 ? curOrder.sgst : null) ??
          Math.round(
            subtotal * 0.025 * 100
          ) / 100
      ) || 0;

    const grandTotal =
      Number(
        (curOrder.totalAmount > 0 ? curOrder.totalAmount : null) ??
          (subtotal + cgst + sgst)
      ) || 0;

    const tokenNumber = getOrderTokenNumber(curOrder);

    const formattedDate = formatOrderDate(curOrder);

    const hasTable = hasOrderTableId(curOrder);
    const isTableOrder = isDineInOrder(curOrder) && hasTable;
    const channelText = getOrderChannelText(curOrder);
    const diningType = getOrderDiningType(curOrder);

    const displayTableName =
      curOrder.tableName ||
      (hasTable ? `Table #${curOrder.tableId}` : 'Table');

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
          {(curOrder.logoUrl || catalog?.logoUrl || curOrder.imageUrl || catalog?.imageUrl) ? (
            <Image
              source={{ uri: curOrder.logoUrl || catalog?.logoUrl || curOrder.imageUrl || catalog?.imageUrl }}
              style={styles.restaurantBrandLogo}
              resizeMode="cover"
            />
          ) : null}
          <View style={{ flex: 1 }}>
            <Text style={styles.restaurantBrandName}>
              {curOrder.restaurantName || catalog?.restaurantName || ''}
            </Text>
            {((curOrder.address || catalog?.address) || (curOrder.city || catalog?.city)) ? (
              <Text style={styles.restaurantBrandAddress}>
                {[
                  curOrder.address || catalog?.address,
                  curOrder.city || catalog?.city,
                  curOrder.state || catalog?.state
                ].filter(Boolean).join(', ')}
              </Text>
            ) : null}
            {(curOrder.contactPhone || catalog?.contactNumber) ? (
              <Text style={styles.restaurantBrandContact}>
                Ph: {curOrder.contactPhone || catalog?.contactNumber}
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
              <Text style={styles.orderIdHeroText}>Order #{curOrder.id || curOrder.orderId || curOrder.Id || curOrder.OrderId}</Text>
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

        {/* TABLE SERVICE & CALL WAITER ACTIONS */}
        {isTableOrder && (
          <View style={styles.waiterCard}>
            <View style={styles.waiterCardHeader}>
              <View style={styles.waiterCardHeaderLeft}>
                <View style={styles.waiterIconBadge}>
                  <Bell size={15} color="#D33401" strokeWidth={2.4} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.waiterCardTitle}>Table Assistance</Text>
                  <Text style={styles.waiterCardSubtitle}>
                    {displayTableName} • Need service or assistance from floor staff?
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.waiterActionsGrid}>
              <TouchableOpacity
                style={[styles.waiterActionBtn, styles.waiterActionBtnPrimary]}
                onPress={() => handleWaiterAction('CALL_WAITER')}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="Call Waiter"
              >
                <View style={[styles.waiterActionIconWrap, { backgroundColor: '#FFEDD5' }]}>
                  <Bell size={16} color="#EA580C" strokeWidth={2.4} />
                </View>
                <Text style={styles.waiterActionBtnTitle}>Call Waiter</Text>
                <Text style={styles.waiterActionBtnDesc}>Assistance</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.waiterActionBtn, styles.waiterActionBtnWater]}
                onPress={() => handleWaiterAction('REQUEST_WATER')}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="Request Drinking Water"
              >
                <View style={[styles.waiterActionIconWrap, { backgroundColor: '#E0F2FE' }]}>
                  <Droplets size={16} color="#0284C7" strokeWidth={2.4} />
                </View>
                <Text style={styles.waiterActionBtnTitle}>Water</Text>
                <Text style={styles.waiterActionBtnDesc}>Refill</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.waiterActionBtn, styles.waiterActionBtnBill]}
                onPress={() => handleWaiterAction('REQUEST_BILL')}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="Request Bill"
              >
                <View style={[styles.waiterActionIconWrap, { backgroundColor: '#DCFCE7' }]}>
                  <Receipt size={16} color="#16A34A" strokeWidth={2.4} />
                </View>
                <Text style={styles.waiterActionBtnTitle}>Bill</Text>
                <Text style={styles.waiterActionBtnDesc}>Invoice</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.waiterActionBtn, styles.waiterActionBtnClean]}
                onPress={() => handleWaiterAction('CLEAN_TABLE')}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="Clean Table"
              >
                <View style={[styles.waiterActionIconWrap, { backgroundColor: '#EDE9FE' }]}>
                  <Sparkles size={16} color="#7C3AED" strokeWidth={2.4} />
                </View>
                <Text style={styles.waiterActionBtnTitle}>Clean</Text>
                <Text style={styles.waiterActionBtnDesc}>Wipe table</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ORDER PROGRESSION (SIMPLIFIED OR LIVE KITCHEN) */}
        {isKitchenDisabled ? (
          <View style={styles.card}>
            <View style={[styles.sectionHeader, { justifyContent: 'space-between', alignItems: 'center' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 size={16} color="#15803d" />
                <Text style={styles.cardTitle}>Order Status</Text>
              </View>
              <View style={[styles.cardStatusBadge, { backgroundColor: badgeBg }]}>
                <Text style={[styles.cardStatusBadgeText, { color: badgeColor }]}>
                  {label === 'In Kitchen' ? 'Confirmed' : label}
                </Text>
              </View>
            </View>

            <View style={styles.stepperContainer}>
              {[
                { name: 'Placed', done: true, current: normalizedStatus === 'Pending' },
                {
                  name: 'Confirmed',
                  done: ['Confirmed', 'Preparing', 'Ready', 'Served', 'Delivered'].includes(normalizedStatus),
                  current: ['Confirmed', 'Preparing', 'Ready'].includes(normalizedStatus),
                },
                {
                  name: prepCountdown.isTakeaway ? 'Picked Up' : 'Served',
                  done: ['Served', 'Delivered'].includes(normalizedStatus),
                  current: ['Served', 'Delivered'].includes(normalizedStatus),
                },
              ].map((step, idx, arr) => (
                <View key={step.name} style={styles.stepperStep}>
                  <View
                    style={[
                      styles.stepCircle,
                      step.done && styles.stepCircleDone,
                      step.current && styles.stepCircleCurrent,
                    ]}
                  >
                    {step.done ? (
                      <Check size={12} color="#ffffff" strokeWidth={3} />
                    ) : (
                      <Text style={styles.stepNumText}>{idx + 1}</Text>
                    )}
                  </View>

                  <Text
                    style={[
                      styles.stepLabelText,
                      step.done && styles.stepLabelTextDone,
                      step.current && styles.stepLabelTextCurrent,
                    ]}
                    numberOfLines={1}
                  >
                    {step.name}
                  </Text>

                  {idx < arr.length - 1 && (
                    <View
                      style={[
                        styles.stepConnector,
                        arr[idx + 1].done && styles.stepConnectorDone,
                      ]}
                    />
                  )}
                </View>
              ))}
            </View>

            <View style={styles.statusMessageCallout}>
              <Utensils size={18} color="#0d9488" />
              <View style={styles.statusMessageTextWrap}>
                <Text style={styles.statusMessageTitle}>
                  {normalizedStatus === 'Served' || normalizedStatus === 'Delivered'
                    ? (prepCountdown.isTakeaway ? 'Order collected. Enjoy your meal!' : 'Order served. Enjoy your meal!')
                    : prepCountdown.isAwaitingConfirmation
                    ? 'Order sent to cashier for acceptance.'
                    : 'Order confirmed and received by restaurant.'}
                </Text>
                <Text style={styles.statusMessageSub}>
                  {normalizedStatus === 'Served' || normalizedStatus === 'Delivered'
                    ? (prepCountdown.isTakeaway ? 'Thank you for ordering with us!' : 'Order served to your table. Enjoy your meal!')
                    : prepCountdown.isAwaitingConfirmation
                    ? 'Awaiting cashier confirmation before kitchen preparation begins.'
                    : 'Your order has been received and is being processed.'}
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={[styles.sectionHeader, { justifyContent: 'space-between', alignItems: 'center' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <ChefHat size={16} color="#D33401" />
                <Text style={styles.cardTitle}>Live Kitchen Progress</Text>
              </View>
              {!prepCountdown.isFinished && (
                <View style={[
                  styles.prepCountdownBadge,
                  prepCountdown.isOverdue && styles.prepCountdownBadgeOverdue,
                  prepCountdown.isAwaitingConfirmation && styles.prepCountdownBadgeAwaiting,
                ]}>
                  <Clock
                    size={12}
                    color={
                      prepCountdown.isAwaitingConfirmation
                        ? '#b45309'
                        : prepCountdown.isOverdue
                        ? '#b45309'
                        : '#c2410c'
                    }
                  />
                  <Text style={[
                    styles.prepCountdownBadgeText,
                    prepCountdown.isOverdue && styles.prepCountdownBadgeTextOverdue,
                    prepCountdown.isAwaitingConfirmation && styles.prepCountdownBadgeTextAwaiting,
                  ]}>
                    {prepCountdown.isAwaitingConfirmation ? 'Paused • ~15m prep' : prepCountdown.formatted}
                  </Text>
                </View>
              )}
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
                      {step === 'Delivered' ? 'Served' : (step === 'Pending' ? 'Placed' : step)}
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
                    ? (prepCountdown.isTakeaway ? 'Your order is ready for pickup!' : 'Your order is ready for serving!')
                    : normalizedStatus === 'Delivered' || normalizedStatus === 'Served'
                    ? (prepCountdown.isTakeaway ? 'Order collected. Enjoy your meal!' : 'Order served. Enjoy your meal!')
                    : prepCountdown.isAwaitingConfirmation
                    ? 'Order sent to cashier for acceptance.'
                    : isAwaitingPayment
                    ? 'Awaiting payment confirmation.'
                    : 'Order queued in kitchen.'}
                </Text>
                <Text style={styles.statusMessageSub}>
                  {normalizedStatus === 'Preparing'
                    ? 'Dishes are being freshly prepared in the kitchen.'
                    : normalizedStatus === 'Ready'
                    ? (prepCountdown.isTakeaway ? 'Please collect your order at the pickup counter.' : 'Server is bringing dishes to your table.')
                    : normalizedStatus === 'Delivered' || normalizedStatus === 'Served'
                    ? (prepCountdown.isTakeaway ? 'Thank you for ordering with us!' : 'Order served to your table. Enjoy your feast!')
                    : prepCountdown.isAwaitingConfirmation
                    ? 'Awaiting cashier confirmation before kitchen preparation begins.'
                    : isAwaitingPayment
                    ? 'Please complete payment to send your order to the kitchen.'
                    : 'Order confirmed and queued for preparation.'}
                </Text>
              </View>
            </View>
          </View>
        )}

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
                {curOrder.customerName ||
                  curOrder.name ||
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
                {maskPhoneLast4(curOrder.maskedMobileNumber || curOrder.mobileNumber || curOrder.customerPhone) || ''}
              </Text>
            </View>

            <View style={styles.infoTableRow}>
              <Text style={styles.infoTableLabel}>Delivery / Dining Type:</Text>
              <Text style={styles.infoTableValue}>
                {diningType}
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

            {curOrder.remarks ? (
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
                  {curOrder.remarks}
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
                      item.price ??
                      item.amount ??
                      (item.totalAmount > 0 && qty > 0 ? item.totalAmount / qty : 0)
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
                  : 'Cash Payment (At Counter / Self Pickup)'}
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
              Delivery Type: {diningType} • Mode: {curOrder.paymentMode || (isOnline ? 'ONLINE' : 'CASH')}
            </Text>

            <View style={{ marginTop: 8, padding: 8, borderRadius: 6, backgroundColor: (isPaid || isOnline) ? '#f0fdf4' : '#fffbeb' }}>
              <Text style={{ fontSize: 11, color: (isPaid || isOnline) ? '#166534' : '#92400e', fontWeight: '500', lineHeight: 15 }}>
                {(isPaid || isOnline)
                  ? '✓ This online order is settled and confirmed directly to kitchen for preparation.'
                  : '⏳ This cash order requires manual acceptance & confirmation by the cashier or restaurant owner before kitchen prep.'}
              </Text>
            </View>

            {curOrder.paymentOrderId ||
            curOrder.cashfreeOrderId ? (
              <Text
                style={
                  styles.paymentTxnText
                }
              >
                Ref:{' '}
                {curOrder.paymentOrderId ||
                  curOrder.cashfreeOrderId}
              </Text>
            ) : null}
          </View>
        </View>
      </ScrollView>
    );
  } catch (err) {
    console.error('renderDetailView error:', err);
    return (
      <View style={[styles.emptyContainer, { padding: 24 }]}>
        <UtensilsCrossed size={36} color="#EA580C" />
        <Text style={styles.emptyTitle}>Order Tracking</Text>
        <Text style={styles.emptySubtitle}>
          {err?.message || 'Unable to display order details. Please refresh or view all orders.'}
        </Text>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
          <TouchableOpacity style={styles.backToListBtn} onPress={loadOrders}>
            <Text style={styles.backToListBtnText}>Refresh Order</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.backToListBtn, { backgroundColor: '#F1F5F9' }]} onPress={() => setViewMode('list')}>
            <Text style={[styles.backToListBtnText, { color: '#1B1C1C' }]}>View All Orders</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
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

              <TouchableOpacity
                style={[styles.backToListBtn, { marginTop: 14 }]}
                onPress={onClose}
              >
                <Text style={styles.backToListBtnText}>
                  Browse Menu & Order
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            filteredOrders.map(
              (ord) => {
                const isKitchenActive = resolveIsKitchenActive(ord, null, catalog, storeOperatingStatus);

                const {
                  badgeColor,
                  badgeBg,
                  label,
                  isOnline,
                  isPaid,
                } =
                  getOrderStatusInfo(
                    ord,
                    isKitchenActive,
                    catalog,
                    storeOperatingStatus
                  );

                const items = getOrderItems(ord);

                const tokenNumber = getOrderTokenNumber(ord);

                const formattedDate = formatOrderDate(ord);

                const channelText = getOrderChannelText(ord);

                const itemsSum = items.reduce((sum, item) => {
                  const q = Number(item.quantity || 1);
                  const p = Number(item.unitPrice ?? item.price ?? item.amount ?? (item.totalAmount > 0 ? item.totalAmount / q : 0));
                  const t = Number(item.totalAmount ?? (p * q));
                  return sum + t;
                }, 0);

                const totalAmount =
                  Number(
                    (ord.totalAmount > 0 ? ord.totalAmount : null) ??
                    (ord.subTotal > 0 ? ord.subTotal : null) ??
                    (ord.orderAmount > 0 ? ord.orderAmount : null) ??
                    (itemsSum > 0 ? itemsSum * 1.05 : 0)
                  );

                let ordCountdown = {
                  formatted: 'Order confirmed',
                  shortFormatted: 'Confirmed',
                  diffSec: 0,
                  minutes: 0,
                  seconds: 0,
                  isFinished: false,
                  isOverdue: false,
                  isAwaitingConfirmation: false,
                  isTakeaway: false,
                  isKitchenStatusDisabled: true,
                  statusMessage: 'Order confirmed',
                };
                try {
                  if (typeof api?.getDecreasingPreparationCountdown === 'function') {
                    const res = api.getDecreasingPreparationCountdown(ord, catalog, storeOperatingStatus);
                    if (res) ordCountdown = { ...ordCountdown, ...res };
                  }
                } catch (e) {}

                return (
                  <TouchableOpacity
                    key={
                      ord.id ||
                      ord.orderId ||
                      ord.Id ||
                      ord.OrderId ||
                      Math.random()
                    }
                    style={
                      styles.orderCard
                    }
                    onPress={() => handleSelectOrder(ord)}
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
                        <Text style={styles.orderCardId}>Order #{ord.id || ord.orderId || ord.Id || ord.OrderId}</Text>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {!ordCountdown.isFinished && !ordCountdown.isKitchenStatusDisabled && (
                          <View
                            style={[
                              styles.orderCardTimerPill,
                              ordCountdown.isOverdue && styles.orderCardTimerPillOverdue,
                              ordCountdown.isAwaitingConfirmation && styles.orderCardTimerPillAwaiting,
                            ]}
                          >
                            <Clock
                              size={11}
                              color={
                                ordCountdown.isAwaitingConfirmation
                                  ? '#b45309'
                                  : ordCountdown.isOverdue
                                  ? '#b45309'
                                  : '#c2410c'
                              }
                            />
                            <Text
                              style={[
                                styles.orderCardTimerText,
                                ordCountdown.isOverdue && styles.orderCardTimerTextOverdue,
                                ordCountdown.isAwaitingConfirmation && styles.orderCardTimerTextAwaiting,
                              ]}
                            >
                              {ordCountdown.shortFormatted}
                            </Text>
                          </View>
                        )}

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

                            const unitName = getItemUnitName(item);

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

  const curForWaiter = selectedOrder || order || api.getSavedActiveOrder();
  const isTableOrderForSelected = isDineInOrder(curForWaiter) && hasOrderTableId(curForWaiter);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay} className="responsive-modal-overlay">
        <View
          style={
            styles.sheetContainer
          }
          className="responsive-modal-sheet"
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
                <ChefHat size={18} color="#D33401" />
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

                {isTableOrderForSelected && (
                  <TouchableOpacity
                    style={styles.waiterFooterBtn}
                    onPress={() => handleWaiterAction('CALL_WAITER')}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityLabel="Call Waiter"
                  >
                    <Bell size={14} color="#EA580C" strokeWidth={2.4} />
                    <Text style={styles.waiterFooterBtnText}>Call Waiter</Text>
                  </TouchableOpacity>
                )}

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
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    width: '100%',
    height: '100%',
    minHeight: '100vh',
  },

  sheetContainer: {
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
    height: '90vh',
    maxHeight: '92vh',
    minHeight: '60vh',
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
    display: 'flex',
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

  emptyItems: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: '#94A3B8',
    fontStyle: 'italic',
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

  waiterCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FED7AA',
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  waiterCardHeader: {
    marginBottom: 12,
  },
  waiterCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  waiterIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waiterCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1B1C1C',
  },
  waiterCardSubtitle: {
    fontSize: 11.5,
    color: '#747878',
    marginTop: 1,
  },
  waiterActionsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  waiterActionBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  waiterActionBtnPrimary: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
  },
  waiterActionBtnWater: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
  },
  waiterActionBtnBill: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  waiterActionBtnClean: {
    backgroundColor: '#F5F3FF',
    borderColor: '#DDD6FE',
  },
  waiterActionIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  waiterActionBtnTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#1B1C1C',
    textAlign: 'center',
  },
  waiterActionBtnDesc: {
    fontSize: 9.5,
    color: '#747878',
    textAlign: 'center',
    marginTop: 1,
  },
  waiterFooterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#FFF7ED',
    borderWidth: 1.5,
    borderColor: '#FED7AA',
  },
  waiterFooterBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#EA580C',
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
  prepCountdownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#fff7ed',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffedd5',
  },
  prepCountdownBadgeOverdue: {
    backgroundColor: '#fef3c7',
    borderColor: '#fde68a',
  },
  prepCountdownBadgeAwaiting: {
    backgroundColor: '#fef3c7',
    borderColor: '#fde68a',
  },
  prepCountdownBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#c2410c',
  },
  prepCountdownBadgeTextOverdue: {
    color: '#b45309',
  },
  prepCountdownBadgeTextAwaiting: {
    color: '#b45309',
  },
  orderCardTimerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff7ed',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ffedd5',
  },
  orderCardTimerPillOverdue: {
    backgroundColor: '#fef3c7',
    borderColor: '#fde68a',
  },
  orderCardTimerPillAwaiting: {
    backgroundColor: '#fef3c7',
    borderColor: '#fde68a',
  },
  orderCardTimerText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#c2410c',
  },
  orderCardTimerTextOverdue: {
    color: '#b45309',
  },
  orderCardTimerTextAwaiting: {
    color: '#b45309',
  },
  receiptItemPrepText: {
    fontSize: 11,
    color: '#d97706',
    fontWeight: '600',
    marginTop: 2,
  },
});