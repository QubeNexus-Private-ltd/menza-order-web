import React, {
  useState,
  useEffect,
  useCallback,
} from 'react';

import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
} from 'react-native';
import {
  Bell,
  Flame,
  Check,
  Utensils,
} from 'lucide-react';

import Header from './components/Header';
import CustomerView from './components/CustomerView';
import StaffView from './components/StaffView';
import CartModal from './components/CartModal';
import OrderTrackerModal from './components/OrderTrackerModal';
import QrScannerModal from './components/QrScannerModal';
import RestaurantQrModal from './components/RestaurantQrModal';
import CallWaiterModal from './components/CallWaiterModal';

import * as api from './services/api';
import * as signalrService from './services/signalr';

export default function App() {
  const [mode, setMode] =
    useState('customer');

  const [catalog, setCatalog] =
    useState(null);

  const [categories, setCategories] =
    useState([]);

  const [items, setItems] =
    useState([]);

  const [tables, setTables] =
    useState([]);

  const [orders, setOrders] =
    useState([]);

  const [cart, setCart] = useState({
    userId: 0,
    deviceId: '',
    restaurantId: null,
    restaurantName: '',
    items: [],
    itemTotal: 0,
    subTotal: 0,
    discountAmount: 0,
    taxableAmount: 0,
    cgstAmount: 0,
    sgstAmount: 0,
    taxAmount: 0,
    totalAmount: 0,
    platformFee: 0,
    vendorPayoutAmount: 0,
    hasUnavailableItems: false,
  });

  const [cartItems, setCartItems] =
    useState([]);

  const [activeTable, setActiveTable] =
    useState(null);

  const [activeOrder, setActiveOrderState] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem('menza_active_order');
        return saved ? JSON.parse(saved) : null;
      } catch {
        return null;
      }
    }
    return null;
  });

  const setActiveOrder = useCallback((order) => {
    setActiveOrderState(order);
    if (typeof localStorage !== 'undefined') {
      if (order && !['Cancelled', 'Settled'].includes(order.orderStatus)) {
        localStorage.setItem('menza_active_order', JSON.stringify(order));
      } else {
        localStorage.removeItem('menza_active_order');
      }
    }
  }, []);

  const [staffUser, setStaffUser] =
    useState(null);

  const [restaurants, setRestaurants] =
    useState([]);

  const [
    selectedRestaurant,
    setSelectedRestaurant,
  ] = useState(null);

  const [
    cartModalOpen,
    setCartModalOpen,
  ] = useState(false);

  const [
    orderTrackerOpen,
    setOrderTrackerOpen,
  ] = useState(false);

  const [trackerTargetOrder, setTrackerTargetOrder] = useState(null);

  const handleOpenOrderTracker = useCallback((targetOrder = null) => {
    const ord = targetOrder || activeOrder || api.getSavedActiveOrder();
    if (ord) {
      setActiveOrder(ord);
      setTrackerTargetOrder(ord);
    }
    setOrderTrackerOpen(true);
  }, [activeOrder, setActiveOrder]);

  const [
    scannerOpen,
    setScannerOpen,
  ] = useState(false);

  const [
    qrModalOpen,
    setQrModalOpen,
  ] = useState(false);

  const [callWaiterModalOpen, setCallWaiterModalOpen] = useState(false);
  const [callWaiterInitialType, setCallWaiterInitialType] = useState('CALL_WAITER');

  const handleOpenCallWaiter = useCallback((type = 'CALL_WAITER') => {
    setCallWaiterInitialType(type || 'CALL_WAITER');
    setCallWaiterModalOpen(true);
  }, []);

  const [loading, setLoading] =
    useState(true);

  const [storeOperatingStatus, setStoreOperatingStatus] =
    useState(null);

  const [toastData, setToastData] =
    useState(null);

  const showToast = useCallback((msg, type = 'info', orderId = null) => {
    setToastData({ message: msg, type, orderId });

    setTimeout(() => {
      setToastData((prev) => (prev?.message === msg ? null : prev));
    }, 5500);
  }, []);

  /* =========================
     SIGNALR REAL-TIME SYNC
  ========================= */
  useEffect(() => {
    const restId = catalog?.restaurantId || selectedRestaurant?.id || 1;
    signalrService.startSignalRConnection(restId, activeOrder?.id || null);

    // Request notification permission
    signalrService.requestNotificationPermission();

    const unsubStore = signalrService.onStoreOperatingStatusChanged((raw) => {
      if (!raw) return;
      const data = raw?.data || raw;
      const normalized = typeof data === 'string'
        ? {
            restaurantId: restId,
            isOpen: data === 'OPEN',
            status: data,
            canPlaceOrder: data === 'OPEN',
            statusMessage: data === 'OPEN' ? 'Store is open.' : 'Store is closed.',
            isKitchenActive: data !== 'PAUSED',
            isLiveKitchenStatusEnabled: data !== 'PAUSED',
          }
        : {
            ...data,
            isOpen: data.isOpen ?? data.status === 'OPEN',
            canPlaceOrder: data.canPlaceOrder ?? (data.status === 'OPEN' || data.isOpen === true),
            status: data.status || (data.isOpen ? 'OPEN' : 'CLOSED'),
            isKitchenActive:
              data.isKitchenActive !== undefined
                ? Boolean(data.isKitchenActive)
                : data.IsKitchenActive !== undefined
                ? Boolean(data.IsKitchenActive)
                : data.status !== 'PAUSED',
            isLiveKitchenStatusEnabled:
              data.isKitchenActive !== undefined
                ? Boolean(data.isKitchenActive)
                : data.IsKitchenActive !== undefined
                ? Boolean(data.IsKitchenActive)
                : data.isLiveKitchenStatusEnabled !== undefined
                ? Boolean(data.isLiveKitchenStatusEnabled)
                : data.status !== 'PAUSED',
          };

      setStoreOperatingStatus(normalized);
      showToast(
        normalized.canPlaceOrder
          ? '🟢 Store is now OPEN for ordering!'
          : normalized.status === 'PAUSED'
          ? `🟡 Kitchen is temporarily paused (${normalized.remainingPauseMinutes || 0}m left)`
          : '🔴 Store is now CLOSED for ordering.'
      );
    });

    // Real-Time Kitchen & Order Progress Sync (from CaptainMenza Chef & MenzaServe Waiter)
    const unsubOrder = signalrService.onOrderStatusChanged((data) => {
      if (!data) return;
      console.log('⚡ [App.jsx] Real-Time Kitchen / Order Update received:', data);

      const changedOrderId = Number(data?.orderId || data?.OrderId || data?.id || data?.Id || 0);
      const newOrderStatus = data?.orderStatus || data?.OrderStatus || data?.status || data?.Status;
      let newKitchenStatus = data?.kitchenStatus || data?.KitchenStatus || data?.kitchenOrderStatus;

      const oStLower = String(newOrderStatus || '').toLowerCase();
      if (oStLower.includes('serve') || oStLower.includes('deliver') || oStLower.includes('complete') || oStLower.includes('settled')) {
        newKitchenStatus = 'Served';
      }

      // 1. Update activeOrder if it's the active one or if it matches current table
      setActiveOrderState((prev) => {
        if (!prev) {
          if (activeTable && data.tableId && Number(data.tableId) === Number(activeTable)) {
            api.getOrder(changedOrderId).then((fresh) => {
              if (fresh) setActiveOrder(fresh);
            });
          }
          return prev;
        }

        const curId = Number(prev.id || prev.orderId || 0);
        if (changedOrderId && changedOrderId !== curId) return prev;

        const effectiveOrderStatus = newOrderStatus || prev.orderStatus;
        let effectiveKitchenStatus = newKitchenStatus || prev.kitchenStatus;
        const effLower = String(effectiveOrderStatus || '').toLowerCase();
        if (effLower.includes('serve') || effLower.includes('deliver') || effLower.includes('complete') || effLower.includes('settled')) {
          effectiveKitchenStatus = 'Served';
        }

        const updated = {
          ...prev,
          orderStatus: effectiveOrderStatus,
          kitchenStatus: effectiveKitchenStatus,
          paymentStatus: data?.paymentStatus || prev.paymentStatus,
          settledDateUtc: data?.settledDateUtc || prev.settledDateUtc,
          items: Array.isArray(data?.items) ? data.items : prev.items,
        };

        if (typeof localStorage !== 'undefined') {
          if (!['Cancelled', 'Settled'].includes(updated.orderStatus)) {
            localStorage.setItem('menza_active_order', JSON.stringify(updated));
          } else {
            localStorage.removeItem('menza_active_order');
          }
        }

        return updated;
      });

      // 2. Update orders list
      setOrders((prevList) => {
        if (!Array.isArray(prevList)) return prevList;
        return prevList.map((o) => {
          const oId = Number(o.id || o.orderId || 0);
          if (oId === changedOrderId) {
            const effectiveOrderStatus = newOrderStatus || o.orderStatus;
            let effectiveKitchenStatus = newKitchenStatus || o.kitchenStatus;
            const effLower = String(effectiveOrderStatus || '').toLowerCase();
            if (effLower.includes('serve') || effLower.includes('deliver') || effLower.includes('complete') || effLower.includes('settled')) {
              effectiveKitchenStatus = 'Served';
            }
            return {
              ...o,
              orderStatus: effectiveOrderStatus,
              kitchenStatus: effectiveKitchenStatus,
            };
          }
          return o;
        });
      });

      // Sync persistent local orders
      const resolvedOrderStatus = newOrderStatus;
      let resolvedKitchenStatus = newKitchenStatus;
      const resLower = String(resolvedOrderStatus || '').toLowerCase();
      if (resLower.includes('serve') || resLower.includes('deliver') || resLower.includes('complete') || resLower.includes('settled')) {
        resolvedKitchenStatus = 'Served';
      }
      api.updateLocalOrderStatus(changedOrderId, resolvedOrderStatus, resolvedKitchenStatus);

      // 3. User Toast Alert based on Kitchen Progression
      const isKitchenActive = api.isLiveKitchenActive(data, catalog, storeOperatingStatus);
      const st = String(newKitchenStatus || newOrderStatus || '').toLowerCase();
      const displayId = changedOrderId ? `#${changedOrderId}` : '';

      if (st.includes('ready')) {
        showToast(`Order ${displayId} is READY! Server is bringing it to your table.`, 'ready', changedOrderId);
      } else if (st.includes('serve') || st.includes('deliver') || st.includes('complete')) {
        showToast(`Order ${displayId} has been served to your table. Enjoy your feast!`, 'served', changedOrderId);
      } else if ((st.includes('prep') || st.includes('cook')) && isKitchenActive) {
        showToast(`Chef started preparing Order ${displayId} in the kitchen (~15m).`, 'cooking', changedOrderId);
      } else if (st.includes('confirm')) {
        showToast(
          isKitchenActive
            ? `Order ${displayId} confirmed and sent to kitchen KOT.`
            : `Order ${displayId} confirmed by restaurant.`,
          'info',
          changedOrderId
        );
      }
    });

    const unsubServiceRequest = signalrService.onServiceRequestResolved((data) => {
      if (!data) return;
      console.log('⚡ [App.jsx] Real-Time ServiceRequestResolved received:', data);
      showToast('🔔 Waiter has acknowledged your request and is heading to your table!', 'success');
    });

    const unsubItemAvailability = signalrService.onMenuItemAvailabilityChanged((data) => {
      if (!data) return;
      console.log('⚡ [App.jsx] Real-Time MenuItemAvailabilityChanged received:', data);
      const targetItemId = Number(data.itemId || data.ItemId || 0);
      const isAvailable = Boolean(data.isAvailable ?? data.IsAvailable ?? (data.status === 'Active'));

      setItems((prevItems) => {
        if (!Array.isArray(prevItems)) return prevItems;
        return prevItems.map((item) => {
          const currentId = Number(item.itemId || item.id || 0);
          if (currentId === targetItemId) {
            return {
              ...item,
              isAvailable,
              isActive: isAvailable,
              status: isAvailable ? 'Active' : 'Inactive',
            };
          }
          return item;
        });
      });

      setCatalog((prevCatalog) => {
        if (!prevCatalog || !Array.isArray(prevCatalog.items)) return prevCatalog;
        return {
          ...prevCatalog,
          items: prevCatalog.items.map((item) => {
            const currentId = Number(item.itemId || item.id || 0);
            if (currentId === targetItemId) {
              return {
                ...item,
                isAvailable,
                isActive: isAvailable,
                status: isAvailable ? 'Active' : 'Inactive',
              };
            }
            return item;
          }),
        };
      });
    });

    const unsubTableStatus = signalrService.onTableStatusChanged((data) => {
      if (!data) return;
      console.log('⚡ [App.jsx] Real-Time TableStatusChanged received:', data);
      const targetTableId = Number(data.tableId || data.TableId || 0);
      const isOccupied = Boolean(data.isOccupied ?? data.IsOccupied ?? (data.status === 'Occupied' || data.status === 'KOT_Active'));
      const status = data.status || data.Status || (isOccupied ? 'Occupied' : 'Available');

      setTables((prevTables) => {
        if (!Array.isArray(prevTables)) return prevTables;
        return prevTables.map((t) => {
          const tid = Number(t.id || t.tableId || 0);
          if (tid === targetTableId) {
            return {
              ...t,
              isOccupied,
              status,
              activeOrderId: data.activeOrderId ?? t.activeOrderId,
            };
          }
          return t;
        });
      });

      setActiveTable((prevTable) => {
        if (!prevTable) return prevTable;
        const currentTid = Number(prevTable.id || 0);
        if (currentTid === targetTableId) {
          const isCleaning = status === 'Cleaning';
          const isReserved = status === 'Reserved';
          const isOccupiedStatus = status === 'Occupied' || status === 'KOT_Active' || status === 'Billed';
          const isLocked = isCleaning || isReserved;
          return {
            ...prevTable,
            isOccupied: isOccupiedStatus,
            status,
            isCleaning,
            isReserved,
            isLocked,
            occupiedByOther: false,
            activeOrderId: data.activeOrderId ?? prevTable.activeOrderId,
          };
        }
        return prevTable;
      });
    });

    return () => {
      if (typeof unsubStore === 'function') unsubStore();
      if (typeof unsubOrder === 'function') unsubOrder();
      if (typeof unsubServiceRequest === 'function') unsubServiceRequest();
      if (typeof unsubItemAvailability === 'function') unsubItemAvailability();
      if (typeof unsubTableStatus === 'function') unsubTableStatus();
    };
  }, [catalog?.restaurantId, selectedRestaurant?.id, activeOrder?.id, activeOrder?.orderStatus, activeOrder?.tableId]);

  /* =========================
     CART
  ========================= */

  const syncCart = (cartData) => {
    const safeCart =
      cartData || {
        userId: 0,
        deviceId: api.getDeviceId(),
        restaurantId: null,
        restaurantName: '',
        items: [],
        itemTotal: 0,
        subTotal: 0,
        discountAmount: 0,
        taxableAmount: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        taxAmount: 0,
        totalAmount: 0,
        platformFee: 0,
        vendorPayoutAmount: 0,
        hasUnavailableItems: false,
      };

    setCart(safeCart);

    setCartItems(
      Array.isArray(safeCart.items)
        ? safeCart.items
        : []
    );

    return safeCart;
  };

  const refreshCart = async () => {
    const cartData =
      await api.getCart();

    return syncCart(cartData);
  };

  /* =========================
     MENU
  ========================= */

  useEffect(() => {
    const searchParams =
      new URLSearchParams(
        window.location.search
      );

    // Support path-based Dine-In QR URLs: /dinein/:encRestId/:encTableId or /dinein/:encRestId
    const pathParts = (typeof window !== 'undefined' && window.location.pathname)
      ? window.location.pathname.split('/').filter(Boolean)
      : [];
    const isDineInPath = pathParts[0]?.toLowerCase() === 'dinein';
    const pathEncRestId = isDineInPath && pathParts[1] ? decodeURIComponent(pathParts[1]) : null;
    const pathEncTableId = isDineInPath && pathParts[2] ? decodeURIComponent(pathParts[2]) : null;

    // Multi-parameter table fallback
    const rawUrlTableId =
      pathEncTableId ||
      searchParams.get('tableId') ||
      searchParams.get('t') ||
      searchParams.get('table') ||
      searchParams.get('tablenum');

    // Decode or decrypt table if client-obfuscated
    const urlTableId = rawUrlTableId ? api.decryptIdentifier(rawUrlTableId) : null;

    // Multi-parameter encrypted restaurant ID fallback
    const encRestId =
      pathEncRestId ||
      searchParams.get('r') ||
      searchParams.get('encRestId') ||
      searchParams.get('enc') ||
      searchParams.get('eid');

    // Multi-parameter plain restaurant ID fallback
    const urlRestId =
      searchParams.get('restId') ||
      searchParams.get('restaurantId') ||
      searchParams.get('id');

    const paymentReturnOrderId =
      searchParams.get('order_id') ||
      searchParams.get('orderId') ||
      searchParams.get('cf_order_id');

    const initializeMenu =
      async () => {
        let targetEncryptedId =
          encRestId;

        if (!targetEncryptedId && typeof localStorage !== 'undefined') {
          targetEncryptedId = localStorage.getItem('menza_last_enc_rest_id');
        }

        if (!targetEncryptedId) {
          const rawId = urlRestId
            ? Number(urlRestId)
            : (typeof localStorage !== 'undefined' && localStorage.getItem('menza_last_rest_id')
                ? Number(localStorage.getItem('menza_last_rest_id'))
                : 1);
          const encResult =
            await api.getEncryptedRestaurantIdFromApi(
              rawId
            );

          targetEncryptedId =
            encResult?.encryptedRestaurantId || api.encryptRestaurantId(rawId);
        }

        // If table ID is not in URL, do NOT resurrect old table from localStorage.
        // URLs with only encRestId/r are store-level menus (Takeaway / Counter / General browsing).
        const targetTableNum = urlTableId
          ? (isNaN(Number(urlTableId)) ? urlTableId : Number(urlTableId))
          : null;

        if (urlTableId && typeof localStorage !== 'undefined') {
          localStorage.setItem('menza_last_table_id', String(urlTableId));
        } else if (!urlTableId && typeof localStorage !== 'undefined') {
          localStorage.removeItem('menza_last_table_id');
        }

        await loadMenuViaEncryptedEndpoint(
          targetEncryptedId,
          targetTableNum
        );

        // Check for any recently saved active order from persistent storage
        try {
          const savedActive = api.getSavedActiveOrder();
          if (savedActive && !['Cancelled', 'Settled'].includes(savedActive.orderStatus)) {
            setActiveOrder(savedActive);
          }
        } catch (e) {}

        // Ensure browser address bar always uses encrypted restaurant ID parameter 'r'
        if (typeof window !== 'undefined' && window.history?.replaceState) {
          try {
            const currentUrl = new URL(window.location.href);
            if (
              currentUrl.searchParams.has('restaurantId') ||
              currentUrl.searchParams.has('restId') ||
              currentUrl.searchParams.has('id') ||
              currentUrl.searchParams.has('encRestId') ||
              currentUrl.searchParams.has('enc') ||
              currentUrl.searchParams.has('eid')
            ) {
              currentUrl.searchParams.delete('restaurantId');
              currentUrl.searchParams.delete('restId');
              currentUrl.searchParams.delete('id');
              currentUrl.searchParams.delete('encRestId');
              currentUrl.searchParams.delete('enc');
              currentUrl.searchParams.delete('eid');
              if (targetEncryptedId) {
                currentUrl.searchParams.set('r', targetEncryptedId);
              }
              window.history.replaceState({}, document.title, currentUrl.toString());
            }
          } catch (e) {}
        }

        // If dining at a table, automatically detect and sync any active running kitchen order
        if (targetTableNum) {
          try {
            const effectiveRestId = Number(urlRestId) || (targetEncryptedId ? api.decryptRestaurantId(targetEncryptedId) : 1);
            const runningOrder = await api.getActiveOrderByTable(targetTableNum, effectiveRestId);
            if (runningOrder && !['Cancelled', 'Settled'].includes(runningOrder.orderStatus)) {
              setActiveOrder(runningOrder);
              signalrService.joinOrderGroup(runningOrder.id);
            }
          } catch (e) {
            console.log('Active table order check:', e);
          }
        }

        if (paymentReturnOrderId) {
          try {
            // Join real-time SignalR group for immediate settlement events
            signalrService.joinOrderGroup(paymentReturnOrderId);

            let statusRes = null;
            try {
              statusRes = await api.verifyCashfreePayment(
                paymentReturnOrderId
              );
            } catch (statusErr) {
              console.log(
                'Cashfree status check:',
                statusErr?.message
              );
            }

            if (statusRes && (statusRes?.status === 'FAILED' || statusRes?.order_status === 'FAILED' || statusRes?.status === 'CANCELLED' || statusRes?.order_status === 'CANCELLED')) {
              showToast('❌ Payment was cancelled or failed. Your order was not placed.');
              return;
            }

            // 1. Multi-tier retrieval of pending order payload
            let pendingPayload = null;
            try {
              const raw1 = sessionStorage.getItem('pending_cf_order_' + paymentReturnOrderId);
              const raw2 = localStorage.getItem('pending_cf_order_' + paymentReturnOrderId);
              const raw3 = localStorage.getItem('pending_cf_order_latest');
              const rawCandidate = raw1 || raw2 || raw3;
              if (rawCandidate) {
                pendingPayload = JSON.parse(rawCandidate);
              }

              // If still not found, scan localStorage keys for any pending_cf_order_
              if (!pendingPayload && typeof localStorage !== 'undefined') {
                for (let i = 0; i < localStorage.length; i++) {
                  const key = localStorage.key(i);
                  if (key && key.startsWith('pending_cf_order_')) {
                    try {
                      const itemRaw = localStorage.getItem(key);
                      if (itemRaw) {
                        const parsed = JSON.parse(itemRaw);
                        if (parsed) {
                          pendingPayload = parsed;
                          if (parsed.cashfreeOrderId === paymentReturnOrderId || parsed.paymentOrderId === paymentReturnOrderId) break;
                        }
                      }
                    } catch (e) {}
                  }
                }
              }
            } catch (storageErr) {
              console.log('Error parsing pending order payload:', storageErr);
            }

            // Fallback from cart if pendingPayload was somehow empty
            if (!pendingPayload && cartItems && cartItems.length > 0) {
              const subTotalVal = cartItems.reduce((acc, it) => acc + (Number(it.unitPrice || it.price || 0) * (Number(it.quantity) || 1)), 0);
              const taxVal = Math.round(subTotalVal * 0.05 * 100) / 100;
              const grandVal = Math.round((subTotalVal + taxVal) * 100) / 100;
              pendingPayload = {
                restaurantId: Number(urlRestId) || catalog?.restaurantId || 1,
                encryptedRestaurantId: targetEncryptedId || catalog?.encryptedRestaurantId || '',
                tableId: targetTableNum || null,
                tableNumber: targetTableNum ? String(targetTableNum) : null,
                customerName: 'Guest Diner',
                customerPhone: '9999999999',
                mobileNumber: '9999999999',
                items: cartItems,
                subTotal: subTotalVal,
                itemTotal: subTotalVal,
                orderAmount: subTotalVal,
                cgstAmount: Math.round(subTotalVal * 0.025 * 100) / 100,
                sgstAmount: Math.round(subTotalVal * 0.025 * 100) / 100,
                taxAmount: taxVal,
                totalAmount: grandVal,
                paymentMode: 'CASHFREE',
                paymentType: 'ONLINE_CASHFREE',
                paymentStatus: 'Paid',
                orderStatus: 'Confirmed',
                paymentOrderId: paymentReturnOrderId,
                cashfreeOrderId: paymentReturnOrderId,
                createdAt: new Date().toISOString(),
              };
            }

            let finalPlacedOrder = null;

            if (pendingPayload) {
              try {
                const effectiveRestId = Number(pendingPayload.restaurantId || urlRestId || catalog?.restaurantId || 1);
                const effectiveEncRestId = pendingPayload.encryptedRestaurantId || targetEncryptedId || catalog?.encryptedRestaurantId || api.encryptRestaurantId(effectiveRestId);
                const effectivePhone = String(pendingPayload.customerPhone || pendingPayload.mobileNumber || '').trim();
                const validPhone = effectivePhone.length >= 10 ? effectivePhone : '9999999999';

                const placeRes = await api.placeOrder({
                  ...pendingPayload,
                  restaurantId: effectiveRestId,
                  encryptedRestaurantId: effectiveEncRestId,
                  customerName: pendingPayload.name || pendingPayload.customerName || 'Guest Diner',
                  name: pendingPayload.name || pendingPayload.customerName || 'Guest Diner',
                  customerPhone: validPhone,
                  mobileNumber: validPhone,
                  paymentMode: 'CASHFREE',
                  paymentType: 'ONLINE_CASHFREE',
                  paymentStatus: 'Paid',
                  orderStatus: 'Confirmed',
                  paymentOrderId: paymentReturnOrderId,
                  cashfreeOrderId: paymentReturnOrderId,
                });

                finalPlacedOrder =
                  placeRes?.order ||
                  (placeRes?.orderId
                    ? await api.getOrder(placeRes.orderId)
                    : null) || placeRes;

                // Clean up cached payload
                sessionStorage.removeItem('pending_cf_order_' + paymentReturnOrderId);
                localStorage.removeItem('pending_cf_order_' + paymentReturnOrderId);
                localStorage.removeItem('pending_cf_order_latest');
              } catch (placeErr) {
                console.warn('Place verified order error:', placeErr?.message);
                // Guaranteed local fallback order so customer is never stranded
                finalPlacedOrder = {
                  ...pendingPayload,
                  id: Number(paymentReturnOrderId.replace(/\D/g, '').slice(-6)) || (Date.now() % 1000000),
                  orderId: Number(paymentReturnOrderId.replace(/\D/g, '').slice(-6)) || (Date.now() % 1000000),
                  paymentStatus: 'Paid',
                  orderStatus: 'Confirmed',
                  paymentMode: 'CASHFREE',
                  paymentType: 'ONLINE_CASHFREE',
                  paymentOrderId: paymentReturnOrderId,
                  cashfreeOrderId: paymentReturnOrderId,
                  createdAt: new Date().toISOString(),
                };
                api.saveLocalOrders([finalPlacedOrder, ...api.getLocalOrders()]);
              }
            }

            if (!finalPlacedOrder) {
              const ordersList =
                (await api.getMyOrders()) || [];

              let targetOrder =
                ordersList.find(
                  (o) =>
                    String(o.cashfreeOrderId) ===
                      String(paymentReturnOrderId) ||
                    String(o.paymentOrderId) ===
                      String(paymentReturnOrderId) ||
                    String(o.id) ===
                      String(paymentReturnOrderId)
                );

              if (!targetOrder && ordersList.length > 0) {
                targetOrder = ordersList[0];
              }

              if (targetOrder) {
                let confirmedOrder = null;
                try {
                  confirmedOrder = await api.confirmOrderPayment(
                    targetOrder.id,
                    paymentReturnOrderId
                  );
                } catch (confErr) {
                  console.log('Public confirmOrderPayment error:', confErr?.message);
                }

                finalPlacedOrder = confirmedOrder || (await api.getOrder(targetOrder.id)) || targetOrder;
              }
            }

            if (finalPlacedOrder) {
              const fallbackItems = Array.isArray(finalPlacedOrder?.items) && finalPlacedOrder.items.length > 0
                ? finalPlacedOrder.items
                : (pendingPayload?.items || []);

              const subTotalVal = Number(
                (finalPlacedOrder.subTotal > 0 ? finalPlacedOrder.subTotal : null) ??
                (finalPlacedOrder.orderAmount > 0 ? finalPlacedOrder.orderAmount : null) ??
                (finalPlacedOrder.itemTotal > 0 ? finalPlacedOrder.itemTotal : null) ??
                (pendingPayload?.subTotal > 0 ? pendingPayload.subTotal : null) ??
                0
              );

              const totalVal = Number(
                (finalPlacedOrder.totalAmount > 0 ? finalPlacedOrder.totalAmount : null) ??
                (pendingPayload?.totalAmount > 0 ? pendingPayload.totalAmount : null) ??
                0
              );

              const finalOrder = {
                ...finalPlacedOrder,
                id: Number(finalPlacedOrder.id || finalPlacedOrder.orderId || 0) || Date.now() % 1000000,
                orderId: Number(finalPlacedOrder.id || finalPlacedOrder.orderId || 0) || Date.now() % 1000000,
                items: fallbackItems,
                subTotal: subTotalVal,
                itemTotal: subTotalVal,
                orderAmount: subTotalVal,
                cgstAmount: Number(finalPlacedOrder.cgstAmount ?? finalPlacedOrder.cgst ?? pendingPayload?.cgstAmount ?? (subTotalVal * 0.025)),
                sgstAmount: Number(finalPlacedOrder.sgstAmount ?? finalPlacedOrder.sgst ?? pendingPayload?.sgstAmount ?? (subTotalVal * 0.025)),
                taxAmount: Number(finalPlacedOrder.taxAmount ?? pendingPayload?.taxAmount ?? (subTotalVal * 0.05)),
                totalAmount: totalVal,
                paymentStatus: 'Paid',
                orderStatus: 'Confirmed',
                paymentMode: 'CASHFREE',
                paymentType: 'ONLINE_CASHFREE',
                paymentOrderId: paymentReturnOrderId,
                cashfreeOrderId: paymentReturnOrderId,
                createdAt: finalPlacedOrder.createdAt || new Date().toISOString(),
              };

              setActiveOrder(finalOrder);
              setTrackerTargetOrder(finalOrder);
              if (typeof localStorage !== 'undefined') {
                localStorage.setItem('menza_active_order', JSON.stringify(finalOrder));
              }
              setOrders((prev) => {
                const list = [finalOrder, ...(prev || []).filter((o) => (o.id || o.orderId) !== (finalOrder.id || finalOrder.orderId))];
                return list;
              });

              setOrderTrackerOpen(true);
              showToast(
                `🎉 Payment completed! Order #${finalOrder.id || finalOrder.orderId} is confirmed and sent to the kitchen.`
              );

              await api.clearCart();
              syncCart(null);
            }
          } catch (e) {
            console.error(
              'Post payment redirect handling error:',
              e
            );
          } finally {
            if (
              typeof window !== 'undefined' &&
              window.history?.replaceState
            ) {
              const cleanUrl = new URL(
                window.location.href
              );
              cleanUrl.searchParams.delete('order_id');
              cleanUrl.searchParams.delete('orderId');
              cleanUrl.searchParams.delete('cf_order_id');
              cleanUrl.searchParams.delete('payment_status');

              // Post-payment redirect: ensure restaurant ID in URL is ALWAYS encrypted ('r')
              cleanUrl.searchParams.delete('restaurantId');
              cleanUrl.searchParams.delete('restId');
              cleanUrl.searchParams.delete('id');

              const resolvedEncId =
                targetEncryptedId ||
                catalog?.encryptedRestaurantId ||
                api.encryptRestaurantId(catalog?.restaurantId || urlRestId || 1);

              if (resolvedEncId) {
                cleanUrl.searchParams.set('r', resolvedEncId);
                cleanUrl.searchParams.delete('encRestId');
                cleanUrl.searchParams.delete('enc');
                cleanUrl.searchParams.delete('eid');
              }

              if (targetTableNum) {
                cleanUrl.searchParams.set('tableId', String(targetTableNum));
              }

              window.history.replaceState(
                {},
                document.title,
                cleanUrl.toString()
              );
            }
          }
        }
      };

    initializeMenu();
  }, []);

  const loadMenuViaEncryptedEndpoint =
    async (
      encryptedRestId,
      targetTableId = null
    ) => {
      setLoading(true);

      try {
        const catData =
          await api.getMenuCatalogByEncryptedId(
            encryptedRestId
          );

        setCatalog(catData);
        setCategories(
          catData.categories || []
        );
        setItems(
          catData.items || []
        );

        const numericRestId =
          catData.restaurantId ||
          api.decryptRestaurantId(
            encryptedRestId
          );

        try {
          const statusData = await api.getStoreOperatingStatus(numericRestId);
          if (statusData) {
            setStoreOperatingStatus(statusData);
            setCatalog((prev) => {
              if (!prev) return prev;
              const realName =
                prev.restaurantName && !prev.restaurantName.startsWith('Restaurant #')
                  ? prev.restaurantName
                  : statusData.restaurantName || prev.restaurantName;
              const realLogo =
                prev.logoUrl ||
                statusData.storeImageUrl ||
                statusData.storeImage ||
                statusData.logoUrl ||
                '';
              const realImage =
                prev.imageUrl ||
                statusData.storeImageUrl ||
                statusData.storeImage ||
                statusData.bannerImage ||
                statusData.bannerUrl ||
                statusData.imageUrl ||
                '';
              return {
                ...prev,
                restaurantName: realName,
                logoUrl: realLogo,
                imageUrl: realImage,
              };
            });
          }
        } catch (statusErr) {
          console.warn('Status fetch error:', statusErr);
        }

        let storeProfile = null;
        try {
          storeProfile = await api.getStoreProfile(
            encryptedRestId,
            numericRestId,
            targetTableId
          );
        } catch (profileErr) {
          console.warn('Store profile fetch error:', profileErr);
        }

        const localTables = await api.getTables(numericRestId);
        const profileTables = Array.isArray(storeProfile?.availableTables) ? storeProfile.availableTables : [];
        const tablesData = profileTables.length > 0 ? profileTables : (localTables || []);

        setTables(tablesData);

        if (targetTableId) {
          const cleanTarget = String(targetTableId).trim();
          let resolvedTable = null;

          // 1. Check if backend decrypted the table in storeProfile
          if (storeProfile?.tableId) {
            resolvedTable = {
              id: Number(storeProfile.tableId),
              tableName: storeProfile.tableName || `Table ${storeProfile.tableId}`,
              tableNumber: storeProfile.tableName || String(storeProfile.tableId),
              restaurantId: numericRestId,
              rId: numericRestId,
              encryptedTableId: targetTableId,
            };
          }

          // 2. Check if matching table in tablesData
          if (!resolvedTable) {
            const found = tablesData.find(
              (t) =>
                t.id === targetTableId ||
                String(t.id) === cleanTarget ||
                (t.tableName && String(t.tableName).toLowerCase() === cleanTarget.toLowerCase()) ||
                (t.tableNumber && String(t.tableNumber).toLowerCase() === cleanTarget.toLowerCase())
            );
            if (found) {
              resolvedTable = {
                ...found,
                id: Number(found.id),
                tableName: found.tableName || `Table ${found.id}`,
                tableNumber: found.tableNumber || found.tableName || String(found.id),
                restaurantId: numericRestId,
                rId: numericRestId,
                encryptedTableId: targetTableId,
              };
            }
          }

          // 3. Fallback: numeric or unresolvable placeholder
          if (!resolvedTable) {
            const isNumeric = !isNaN(Number(targetTableId)) && Number(targetTableId) > 0;
            resolvedTable = {
              id: isNumeric ? Number(targetTableId) : targetTableId,
              tableName: isNumeric
                ? `Table #${cleanTarget}`
                : 'Selected Table',
              tableNumber: cleanTarget,
              restaurantId: numericRestId,
              rId: numericRestId,
              encryptedTableId: targetTableId,
            };
          }

          const status = resolvedTable?.status || storeProfile?.tableStatus || (storeProfile?.isTableOccupied ? 'Occupied' : 'Available');
          const isCleaning = status === 'Cleaning';
          const isReserved = status === 'Reserved';
          const isOccupied = status === 'Occupied' || status === 'KOT_Active' || status === 'Billed' || Boolean(storeProfile?.isTableOccupied || resolvedTable?.isOccupied);
          const isLocked = isCleaning || isReserved;

          let savedOrder = activeOrder;
          if (!savedOrder && typeof localStorage !== 'undefined') {
            try {
              const raw = localStorage.getItem('menza_active_order');
              if (raw) savedOrder = JSON.parse(raw);
            } catch {}
          }

          resolvedTable = {
            ...resolvedTable,
            status,
            isOccupied,
            isCleaning,
            isReserved,
            isLocked,
            isAvailable: status === 'Available',
            occupiedByOther: false,
            activeOrderId: storeProfile?.activeOrderId || savedOrder?.id || null,
            activeOrderPhoneLast4: storeProfile?.activeOrderPhoneLast4 || null,
          };

          setActiveTable(resolvedTable);
        } else {
          setActiveTable(null);
        }

        const rObj =
          (
            restaurants || []
          ).find(
            (r) =>
              r.id === numericRestId
          ) || {
            id: numericRestId,
            name:
              catData.restaurantName ||
              `Restaurant #${numericRestId}`,
          };

        setSelectedRestaurant(
          rObj
        );

        await refreshCart();

        const allOrd =
          await api.getAllOrders();

        setOrders(
          allOrd || []
        );
      } catch (err) {
        console.error(
          'Failed to load menu:',
          err
        );
        try {
          const fallbackCat = await api.getMenuCatalog(1);
          if (fallbackCat && Array.isArray(fallbackCat.items) && fallbackCat.items.length > 0) {
            setCatalog(fallbackCat);
            setCategories(fallbackCat.categories || []);
            setItems(fallbackCat.items || []);
          }
        } catch (fbErr2) {}
      } finally {
        setLoading(false);
      }
    };

  /* =========================
     QR
  ========================= */

  const handleSelectScanResult =
    async (
      restaurantId,
      tableId
    ) => {
      const encResult =
        await api.getEncryptedRestaurantIdFromApi(
          restaurantId
        );

      const encId =
        encResult.encryptedRestaurantId;

      if (
        catalog &&
        Number(
          catalog.restaurantId
        ) !==
          Number(restaurantId)
      ) {
        await api.clearCart();
        syncCart(null);
      }

      try {
        const url =
          new URL(
            window.location.href
          );

        url.searchParams.set(
          'restaurantId',
          restaurantId
        );

        if (tableId) {
          url.searchParams.set(
            'tableId',
            String(tableId)
          );
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('menza_last_table_id', String(tableId));
          }
        } else {
          url.searchParams.delete('tableId');
          if (typeof localStorage !== 'undefined') {
            localStorage.removeItem('menza_last_table_id');
          }
        }

        url.searchParams.delete(
          'encRestId'
        );

        window.history.pushState(
          {},
          '',
          url
        );
      } catch (e) {}

      await loadMenuViaEncryptedEndpoint(
        encId,
        tableId || null
      );
    };

  /* =========================
     REFRESH
  ========================= */

  const handleRefreshData =
    async () => {
      const encId = catalog
        ? catalog.encryptedRestaurantId ||
          api.encryptRestaurantId(1)
        : api.encryptRestaurantId(1);

      await loadMenuViaEncryptedEndpoint(
        encId,
        activeTable
          ? activeTable.id
          : null
      );

      showToast(
        'Menu refreshed'
      );
    };

  /* =========================
     CART ACTIONS
  ========================= */

  const handleAddToCart =
    async (
      itemId,
      quantity = 1,
      itemData = null
    ) => {
      if (activeTable?.isCleaning) {
        showToast(
          `Table ${activeTable.tableName || activeTable.id} is currently being sanitized. Please wait a moment.`,
          'warn'
        );
        return;
      }
      if (activeTable?.isReserved) {
        showToast(
          `Table ${activeTable.tableName || activeTable.id} is reserved. Please consult staff to be seated.`,
          'warn'
        );
        return;
      }

      const restId =
        catalog
          ? catalog.restaurantId
          : 1;

      const itemObj =
        itemData ||
        (items || []).find(
          (i) =>
            Number(i.itemId) ===
            Number(itemId)
        ) ||
        null;

      const unitPrice = Number(
        itemObj?.unitPrice ?? itemObj?.price ?? itemObj?.amount ?? 0
      );
      const itemName = itemObj?.itemName || `Dish #${itemId}`;
      const isVeg = itemObj?.isVeg !== false;
      const imageUrl = itemObj?.imageUrl || '';
      const unitName = itemObj?.unitName || '';

      // Instant optimistic UI update to eliminate delay/fluctuation
      setCartItems((prevItems) => {
        const itemsList = Array.isArray(prevItems) ? [...prevItems] : [];
        const existingIdx = itemsList.findIndex(
          (i) => Number(i.itemId) === Number(itemId)
        );
        if (existingIdx >= 0) {
          const old = itemsList[existingIdx];
          const newQ = Number(old.quantity || 1) + Number(quantity || 1);
          itemsList[existingIdx] = {
            ...old,
            quantity: newQ,
            totalAmount: (Number(old.unitPrice) || unitPrice) * newQ,
          };
        } else {
          itemsList.push({
            itemId: Number(itemId),
            itemName,
            quantity: Number(quantity || 1),
            unitPrice,
            amount: unitPrice,
            totalAmount: unitPrice * Number(quantity || 1),
            imageUrl,
            unitName,
            isVeg,
          });
        }
        return itemsList;
      });

      try {
        const updated = await api.addToCart(
          restId,
          itemId,
          quantity,
          { item: itemObj }
        );

        if (updated) {
          syncCart(updated);
        } else {
          await refreshCart();
        }
      } catch (err) {
        console.error('addToCart error:', err);
        await refreshCart();
      }

      showToast(
        'Added dish to cart'
      );
    };

  const handleUpdateCartQuantity =
    async (
      itemId,
      quantity,
      cookingInstruction = null
    ) => {
      if (activeTable?.isCleaning) {
        showToast(
          `Table ${activeTable.tableName || activeTable.id} is currently being sanitized. Please wait a moment.`,
          'warn'
        );
        return;
      }
      if (activeTable?.isReserved) {
        showToast(
          `Table ${activeTable.tableName || activeTable.id} is reserved. Please consult staff to be seated.`,
          'warn'
        );
        return;
      }

      const targetQty = Number(quantity);

      // Instant optimistic UI update to eliminate delay/fluctuation
      setCartItems((prevItems) => {
        const itemsList = Array.isArray(prevItems) ? [...prevItems] : [];
        if (targetQty <= 0) {
          return itemsList.filter((i) => Number(i.itemId) !== Number(itemId));
        }
        return itemsList.map((item) => {
          if (Number(item.itemId) === Number(itemId)) {
            const uPrice = Number(item.unitPrice || item.amount || 0);
            return {
              ...item,
              quantity: targetQty,
              totalAmount: uPrice * targetQty,
              cookingInstruction:
                cookingInstruction !== null
                  ? cookingInstruction
                  : item.cookingInstruction,
            };
          }
          return item;
        });
      });

      try {
        const updated = await api.updateCartQuantity(
          itemId,
          quantity,
          cookingInstruction
        );

        if (updated) {
          syncCart(updated);
        } else {
          await refreshCart();
        }
      } catch (err) {
        console.error('updateCartQuantity error:', err);
        await refreshCart();
      }
    };

  const handleRemoveFromCart =
    async (itemId) => {
      await api.removeFromCart(
        itemId
      );

      await refreshCart();
    };

  const handleClearCart =
    async () => {
      await api.clearCart();

      syncCart(null);

      showToast(
        'Cart cleared'
      );
    };

  /* =========================
     ORDER
  ========================= */

  const handlePlaceOrder =
    async (orderPayload) => {
      setLoading(true);

      try {
        if (activeTable?.isCleaning) {
          throw new Error(
            `Table ${activeTable.tableName || activeTable.id} is currently being sanitized. Please wait for staff to complete turnover.`
          );
        }

        if (activeTable?.isReserved) {
          throw new Error(
            `Table ${activeTable.tableName || activeTable.id} is reserved for scheduled guests. Please speak to staff to be seated.`
          );
        }

        if (storeOperatingStatus && storeOperatingStatus.canPlaceOrder === false) {
          const msg = storeOperatingStatus.statusMessage ||
            (storeOperatingStatus.status === 'PAUSED'
              ? `Kitchen is temporarily paused (${storeOperatingStatus.remainingPauseMinutes || 0}m left). Ordering is currently disabled.`
              : 'Restaurant is currently closed for ordering.');
          throw new Error(msg);
        }

        const restId =
          catalog
            ? catalog.restaurantId
            : 1;

        /*
         * IMPORTANT:
         * Make sure items are always
         * attached to the order.
         */
        const payload = {
          ...orderPayload,

          restaurantId:
            restId,

          tableId:
            orderPayload.tableId ||
            (
              activeTable
                ? activeTable.id
                : null
            ),

          deviceId:
            orderPayload.deviceId ||
            api.getDeviceId(),

          items:
            Array.isArray(
              orderPayload.items
            ) &&
            orderPayload.items.length
              ? orderPayload.items
              : cartItems.map(
                  (item) => ({
                    itemId:
                      item.itemId,

                    itemName:
                      item.itemName,

                    quantity:
                      Number(
                        item.quantity ||
                          1
                      ),

                    amount:
                      Number(
                        item.unitPrice ??
                          item.amount ??
                          item.price ??
                          0
                      ),

                    unitPrice:
                      Number(
                        item.unitPrice ??
                          item.amount ??
                          item.price ??
                          0
                      ),

                    totalAmount:
                      Number(
                        item.totalAmount ??
                          (
                            item.unitPrice ??
                            item.amount ??
                            item.price ??
                            0
                          ) *
                            Number(
                              item.quantity ||
                                1
                            )
                      ),

                    cookingInstruction:
                      item.cookingInstruction ||
                      null,
                  })
                ),

          subTotal:
            Number(
              orderPayload.subTotal ??
                cart.subTotal ??
                cart.itemTotal ??
                0
            ),

          cgstAmount:
            Number(
              orderPayload.cgstAmount ??
                cart.cgstAmount ??
                0
            ),

          sgstAmount:
            Number(
              orderPayload.sgstAmount ??
                cart.sgstAmount ??
                0
            ),

          totalAmount:
            Number(
              orderPayload.totalAmount ??
                cart.totalAmount ??
                0
            ),
        };

        console.log(
          'FINAL ORDER PAYLOAD:',
          JSON.stringify(
            payload,
            null,
            2
          )
        );

        /*
         * CREATE ORDER FIRST
         */
        const result =
          await api.placeOrder(
            payload
          );

        if (
          !result ||
          !result.orderId
        ) {
          throw new Error(
            'Order ID was not returned'
          );
        }

        /*
         * GET COMPLETE ORDER
         */
        const placed =
          result.order ||
          (await api.getOrder(
            result.orderId
          ));

        if (!placed) {
          throw new Error(
            'Created order could not be loaded'
          );
        }

        /*
         * VERY IMPORTANT:
         * Keep complete order in state.
         */
        const completePlacedOrder = {
          ...placed,

          id: Number(placed.id || placed.orderId || placed.Id || placed.OrderId || result.orderId),
          orderId: placed.orderId || placed.OrderId || Number(placed.id || placed.orderId || result.orderId),

          items:
            (Array.isArray(placed.items) && placed.items.length > 0)
              ? placed.items
              : payload.items,

          subTotal:
            Number(
              placed.subTotal ??
                payload.subTotal
            ),

          cgstAmount:
            Number(
              placed.cgstAmount ??
                payload.cgstAmount
            ),

          sgstAmount:
            Number(
              placed.sgstAmount ??
                payload.sgstAmount
            ),

          totalAmount:
            Number(
              placed.totalAmount ??
                payload.totalAmount
            ),

          paymentStatus:
            placed.paymentStatus ||
            'Pending',
        };

        setActiveOrder(completePlacedOrder);
        setTrackerTargetOrder(completePlacedOrder);

        /*
         * Update order list
         */
        const allOrd =
          await api.getAllOrders();

        setOrders(
          allOrd || []
        );

        /*
         * Clear cart
         */
        await api.clearCart();

        syncCart(null);

        /*
         * Close cart and
         * open tracker.
         */
        setCartModalOpen(false);
        setOrderTrackerOpen(true);

        showToast(
          `Order #${result.orderId} created successfully!`
        );

        return result;
      } catch (err) {
        console.error(
          'PLACE ORDER ERROR:',
          err
        );

        if (err?.isRateLimited) {
          showToast(
            `⏳ ${err.message}`
          );
        } else {
          showToast(
            err?.response?.data?.message ||
              err?.message ||
              'Failed to create order. Please try again.'
          );
        }

        throw err;
      } finally {
        setLoading(false);
      }
    };

  /* =========================
     TABLE
  ========================= */

  const effectiveTable = React.useMemo(() => {
    if (activeTable) return activeTable;
    if (activeOrder?.tableId || activeOrder?.tableName) {
      return {
        id: activeOrder.tableId,
        tableName: activeOrder.tableName || `Table #${activeOrder.tableId}`,
        restaurantId: activeOrder.restaurantId || catalog?.restaurantId,
        encryptedTableId: activeOrder.encryptedTableId,
        isOccupied: true,
      };
    }
    return null;
  }, [activeTable, activeOrder?.tableId, activeOrder?.tableName, activeOrder?.restaurantId, activeOrder?.encryptedTableId, catalog?.restaurantId]);

  const handleCallWaiter =
    async (requestType = 'CALL_WAITER', message = '') => {
      const targetTable = activeTable || effectiveTable;
      if (!targetTable) {
        handleOpenCallWaiter(requestType);
        return null;
      }

      const restId = Number(catalog?.restaurantId) || Number(targetTable?.restaurantId) || undefined;
      const encRestId = catalog?.encryptedRestaurantId || selectedRestaurant?.encryptedRestaurantId || undefined;
      const encTableId = targetTable?.encryptedTableId || undefined;
      try {
        const res =
          await api.callWaiter(
            targetTable.id,
            restId,
            requestType,
            message,
            '',
            encRestId,
            encTableId
          );

        showToast(
          res?.message ||
            'Waiter has been notified.'
        );
        return res;
      } catch (err) {
        if (err?.isRateLimited) {
          showToast(`⏳ ${err.message}`);
        } else {
          showToast('Failed to notify waiter. Please try again.');
        }
        throw err;
      }
    };

  const handleRequestBill =
    async () => {
      const targetTable = activeTable || effectiveTable;
      if (!targetTable) {
        handleOpenCallWaiter('REQUEST_BILL');
        return null;
      }

      const restId = Number(catalog?.restaurantId) || Number(targetTable?.restaurantId) || undefined;
      const encRestId = catalog?.encryptedRestaurantId || selectedRestaurant?.encryptedRestaurantId || undefined;
      const encTableId = targetTable?.encryptedTableId || undefined;
      try {
        const res =
          await api.requestBill(
            targetTable.id,
            restId,
            encRestId,
            encTableId
          );

        showToast(
          res?.message ||
            'Bill requested.'
        );
        return res;
      } catch (err) {
        if (err?.isRateLimited) {
          showToast(`⏳ ${err.message}`);
        } else {
          showToast('Failed to request bill. Please try again.');
        }
        throw err;
      }
    };

  /* =========================
     LIVE ORDER TRACKING
  ========================= */

  const handleRefreshOrder = useCallback(
    async (orderId) => {
      if (!orderId) return null;

      const restId = Number(catalog?.restaurantId) || 1;

      try {
        const latest = await api.getLiveOrderTracking(orderId, restId);
        if (latest) {
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

          let mergedResult = latest;

          setActiveOrder((previous) => {
            if (!previous || Number(previous.id || previous.orderId) !== Number(orderId)) {
              mergedResult = latest;
              return latest;
            }

            const prevOrderRank = STATUS_RANKS[String(previous.orderStatus || '').trim().toLowerCase()] ?? 0;
            const latestOrderRank = STATUS_RANKS[String(latest.orderStatus || '').trim().toLowerCase()] ?? 0;
            const effectiveOrderStatus = latestOrderRank >= prevOrderRank ? latest.orderStatus : previous.orderStatus;

            const prevKitchenRank = STATUS_RANKS[String(previous.kitchenStatus || '').trim().toLowerCase()] ?? 0;
            const latestKitchenRank = STATUS_RANKS[String(latest.kitchenStatus || '').trim().toLowerCase()] ?? 0;
            const effectiveKitchenStatus = (latest.kitchenStatus && latestKitchenRank >= prevKitchenRank)
              ? latest.kitchenStatus
              : previous.kitchenStatus;

            mergedResult = {
              ...previous,
              ...latest,
              orderStatus: effectiveOrderStatus,
              kitchenStatus: effectiveKitchenStatus,
              items: (Array.isArray(latest.items) && latest.items.length > 0) ? latest.items : previous.items,
            };

            return mergedResult;
          });

          api.updateLocalOrderStatus(orderId, mergedResult.orderStatus, mergedResult.kitchenStatus);
          return mergedResult;
        }
      } catch (error) {
        console.log('handleRefreshOrder error:', error?.message);
      }

      return null;
    },
    [catalog?.restaurantId]
  );

  /* =========================
     STAFF AUTH
  ========================= */

  const handleStaffLogin =
    async (
      mobile,
      otpCode
    ) => {
      const res =
        await api.loginWithOtp(
          mobile,
          otpCode
        );

      if (res && res.token) {
        setStaffUser(
          res.user
        );

        setRestaurants(
          res.restaurants || []
        );

        if (
          res.restaurants &&
          res.restaurants.length
        ) {
          setSelectedRestaurant(
            res.restaurants[0]
          );
        }

        showToast(
          `Welcome back, ${
            res.user?.name ||
            'Staff'
          }!`
        );
      }
    };

  const handleStaffLogout =
    () => {
      api.setAuthToken(null);
      setStaffUser(null);

      showToast(
        'Logged out of staff POS'
      );
    };

  /* =========================
     STAFF TABLES / ORDERS
  ========================= */

  const handleUpdateTableStatus =
    async (
      tableId,
      status
    ) => {
      const restId =
        selectedRestaurant
          ? selectedRestaurant.id
          : (catalog?.restaurantId || 1);

      await api.updateTableStatus(
        tableId,
        status,
        restId
      );

      const tList =
        await api.getTables(
          restId
        );

      setTables(tList);

      showToast(
        `Table #${tableId} status set to ${status}`
      );
    };

  const handleSettleTable =
    async (tableId) => {
      const restId =
        selectedRestaurant
          ? selectedRestaurant.id
          : (catalog?.restaurantId || 1);

      await api.settleTable(
        tableId,
        restId
      );

      const tList =
        await api.getTables(
          restId
        );

      setTables(tList);

      const allOrd =
        await api.getAllOrders();

      setOrders(allOrd);

      showToast(
        `Table #${tableId} settled!`
      );
    };

  const handleUpdateOrderStatus =
    async (
      orderId,
      status
    ) => {
      await api.updateOrderStatus(
        orderId,
        status
      );

      const allOrd =
        await api.getAllOrders();

      setOrders(allOrd);

      /*
       * If customer is watching
       * same order, update tracker.
       */
      if (
        activeOrder &&
        Number(
          activeOrder.id
        ) === Number(orderId)
      ) {
        setActiveOrder(
          (prev) => ({
            ...prev,
            orderStatus:
              status,
          })
        );
      }

      showToast(
        `Order #${orderId} updated`
      );
    };

  const handleUpdateKitchenStatus =
    async (
      orderId,
      status
    ) => {
      await api.updateKitchenOrderStatus(
        orderId,
        status
      );

      const allOrd =
        await api.getAllOrders();

      setOrders(allOrd);

      if (
        activeOrder &&
        Number(
          activeOrder.id
        ) === Number(orderId)
      ) {
        setActiveOrder(
          (prev) => ({
            ...prev,
            orderStatus:
              status,
          })
        );
      }

      showToast(
        `Kitchen order #${orderId} updated`
      );
    };

  const handleAddItemsToOrder =
    async (
      orderIdOrPayload,
      itemId,
      quantity,
      amount
    ) => {
      if (
        typeof orderIdOrPayload ===
        'object'
      ) {
        const restId =
          catalog
            ? catalog.restaurantId
            : 1;

        const result =
          await api.placeOrder({
            ...orderIdOrPayload,
            restaurantId:
              restId,
          });

        const allOrd =
          await api.getAllOrders();

        setOrders(allOrd);

        showToast(
          `Staff created Order #${result.orderId}`
        );
      } else {
        await api.addItemToOrder(
          orderIdOrPayload,
          itemId,
          quantity,
          amount
        );

        const allOrd =
          await api.getAllOrders();

        setOrders(allOrd);

        showToast(
          `Item added to Order #${orderIdOrPayload}`
        );
      }
    };

  /* =========================
     UI
  ========================= */

  return (
    <View
      style={styles.appContainer}
    >
      {toastData ? (
        <TouchableOpacity
          style={[
            styles.toastBanner,
            toastData.type === 'ready'
              ? styles.toastReady
              : toastData.type === 'cooking'
              ? styles.toastCooking
              : toastData.type === 'served'
              ? styles.toastServed
              : styles.toastDefault,
          ]}
          onPress={() => {
            const ord = activeOrder || (toastData?.orderId ? { id: toastData.orderId, orderId: toastData.orderId } : null) || api.getSavedActiveOrder();
            handleOpenOrderTracker(ord);
          }}
          activeOpacity={0.9}
        >
          <View style={styles.toastIconWrap}>
            {toastData.type === 'ready' ? (
              <Bell size={16} color="#ffffff" />
            ) : toastData.type === 'cooking' ? (
              <Flame size={16} color="#ffffff" />
            ) : toastData.type === 'served' ? (
              <Check size={16} color="#ffffff" />
            ) : (
              <Utensils size={16} color="#ffffff" />
            )}
          </View>
          <Text style={styles.toastText} numberOfLines={2}>
            {toastData.message}
          </Text>
          {(toastData.orderId || activeOrder) && (
            <View style={styles.toastActionPill}>
              <Text style={styles.toastActionText}>Track</Text>
            </View>
          )}
        </TouchableOpacity>
      ) : null}

      <Header
        restaurantName={
          catalog?.restaurantName && !catalog.restaurantName.startsWith('Restaurant #')
            ? catalog.restaurantName
            : storeOperatingStatus?.restaurantName ||
              catalog?.restaurantName ||
              'Restaurant Menu'
        }
        restaurantAddress={
          catalog?.restaurantAddress ||
          catalog?.address ||
          storeOperatingStatus?.restaurantAddress ||
          storeOperatingStatus?.address ||
          [catalog?.address, catalog?.city, catalog?.state].filter(Boolean).join(', ') ||
          ''
        }
        restaurantImage={
          catalog?.imageUrl ||
          catalog?.restaurantImage ||
          storeOperatingStatus?.storeImageUrl ||
          storeOperatingStatus?.storeImage ||
          storeOperatingStatus?.imageUrl ||
          storeOperatingStatus?.bannerImage ||
          storeOperatingStatus?.bannerUrl ||
          ''
        }
        restaurantLogo={
          catalog?.logoUrl ||
          catalog?.logo ||
          storeOperatingStatus?.storeImageUrl ||
          storeOperatingStatus?.storeImage ||
          storeOperatingStatus?.logoUrl ||
          ''
        }
        loading={loading}
        storeOperatingStatus={storeOperatingStatus}
        activeTable={effectiveTable}
        openQrModal={() =>
          setQrModalOpen(true)
        }
        openCallWaiter={() =>
          handleOpenCallWaiter('CALL_WAITER')
        }
        cartCount={cartItems.length}
        openCart={() =>
          setCartModalOpen(true)
        }
        openOrderTracker={handleOpenOrderTracker}
        activeOrder={activeOrder}
      />

      {mode === 'customer' ? (
        <CustomerView
          catalog={catalog}
          categories={categories}
          items={items}
          activeTable={effectiveTable}
          activeOrder={activeOrder}
          openOrderTracker={handleOpenOrderTracker}
          openScanner={() =>
            setScannerOpen(true)
          }
          openQrModal={() =>
            setQrModalOpen(true)
          }
          openCallWaiter={
            handleOpenCallWaiter
          }
          cartItems={cartItems}
          openCart={() =>
            setCartModalOpen(true)
          }
          onAddToCart={
            handleAddToCart
          }
          onUpdateCartQuantity={
            handleUpdateCartQuantity
          }
          onCallWaiter={
            handleCallWaiter
          }
          onRequestBill={
            handleRequestBill
          }
          loading={loading}
          storeOperatingStatus={storeOperatingStatus}
        />
      ) : (
        <StaffView
          staffUser={staffUser}
          restaurants={restaurants}
          selectedRestaurant={
            selectedRestaurant
          }
          onSelectRestaurant={(
            rest
          ) => {
            setSelectedRestaurant(
              rest
            );

            const encId =
              api.encryptRestaurantId(
                rest.id
              );

            loadMenuViaEncryptedEndpoint(
              encId
            );
          }}
          onGenerateOtp={
            api.generateOtp
          }
          onLogin={
            handleStaffLogin
          }
          tables={tables}
          orders={orders}
          items={items}
          onUpdateTableStatus={
            handleUpdateTableStatus
          }
          onSettleTable={
            handleSettleTable
          }
          onUpdateOrderStatus={
            handleUpdateOrderStatus
          }
          onUpdateKitchenStatus={
            handleUpdateKitchenStatus
          }
          onAddItemToOrder={
            handleAddItemsToOrder
          }
          onRefreshData={
            handleRefreshData
          }
          onOpenQrGenerator={() =>
            setQrModalOpen(true)
          }
        />
      )}

      <CartModal
        visible={cartModalOpen}
        onClose={() =>
          setCartModalOpen(false)
        }
        cart={cart}
        cartItems={cartItems}
        onUpdateCartQuantity={
          handleUpdateCartQuantity
        }
        onRemoveFromCart={
          handleRemoveFromCart
        }
        onClearCart={
          handleClearCart
        }
        onRefreshCart={
          refreshCart
        }
        onPlaceOrder={
          handlePlaceOrder
        }
        activeTable={effectiveTable}
        catalog={catalog}
        loading={loading}
        storeOperatingStatus={storeOperatingStatus}
      />

      <OrderTrackerModal
        visible={
          orderTrackerOpen
        }
        onClose={() => {
          setTrackerTargetOrder(null);
          setOrderTrackerOpen(false);
        }}
        order={trackerTargetOrder || activeOrder || api.getSavedActiveOrder()}
        targetOrder={trackerTargetOrder || activeOrder || api.getSavedActiveOrder()}
        orders={orders}
        catalog={catalog}
        activeTable={effectiveTable}
        onRefreshOrder={handleRefreshOrder}
        storeOperatingStatus={storeOperatingStatus}
        openCallWaiter={handleOpenCallWaiter}
        onCallWaiter={handleCallWaiter}
        onRequestBill={handleRequestBill}
      />

      <QrScannerModal
        visible={scannerOpen}
        onClose={() =>
          setScannerOpen(false)
        }
        onSelectScanResult={
          handleSelectScanResult
        }
        activeRestaurantId={
          catalog
            ? catalog.restaurantId
            : 1
        }
      />

      <RestaurantQrModal
        visible={qrModalOpen}
        onClose={() =>
          setQrModalOpen(false)
        }
        catalog={catalog}
        restaurantName={
          catalog
            ? catalog.restaurantName
            : 'Menza Fine Dining'
        }
        activeTable={effectiveTable}
        tables={tables}
      />

      <CallWaiterModal
        visible={callWaiterModalOpen}
        onClose={() => setCallWaiterModalOpen(false)}
        activeTable={effectiveTable}
        catalog={catalog}
        initialRequestType={callWaiterInitialType}
        onCallWaiter={handleCallWaiter}
        onRequestBill={handleRequestBill}
        openScanner={() => setScannerOpen(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    backgroundColor: '#FAF8F5',
    position: 'relative',
  },

  toastBanner: {
    position: 'absolute',
    top: 65,
    alignSelf: 'center',
    maxWidth: '92%',
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
    gap: 10,
  },

  toastDefault: {
    backgroundColor: '#0f172a',
    shadowColor: '#0f172a',
  },

  toastReady: {
    backgroundColor: '#7c3aed',
    shadowColor: '#7c3aed',
  },

  toastCooking: {
    backgroundColor: '#ea580c',
    shadowColor: '#ea580c',
  },

  toastServed: {
    backgroundColor: '#15803d',
    shadowColor: '#15803d',
  },

  toastIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  toastText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },

  toastActionPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },

  toastActionText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
});