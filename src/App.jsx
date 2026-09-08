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

  const [
    scannerOpen,
    setScannerOpen,
  ] = useState(false);

  const [
    qrModalOpen,
    setQrModalOpen,
  ] = useState(false);

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

    return () => {
      if (typeof unsubStore === 'function') unsubStore();
      if (typeof unsubOrder === 'function') unsubOrder();
    };
  }, [catalog?.restaurantId, selectedRestaurant?.id, activeOrder?.id]);

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

    // Multi-parameter table fallback
    const urlTableId =
      searchParams.get('tableId') ||
      searchParams.get('t') ||
      searchParams.get('table') ||
      searchParams.get('tablenum');

    // Multi-parameter encrypted restaurant ID fallback
    const encRestId =
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

        if (!targetEncryptedId) {
          const rawId = urlRestId ? Number(urlRestId) : 1;
          const encResult =
            await api.getEncryptedRestaurantIdFromApi(
              rawId
            );

          targetEncryptedId =
            encResult?.encryptedRestaurantId || api.encryptRestaurantId(rawId);
        }

        const targetTableNum =
          urlTableId
            ? isNaN(Number(urlTableId)) ? urlTableId : Number(urlTableId)
            : null;

        await loadMenuViaEncryptedEndpoint(
          targetEncryptedId,
          targetTableNum
        );

        // Ensure browser address bar always uses encrypted restaurant ID parameter 'r'
        if (typeof window !== 'undefined' && window.history?.replaceState) {
          try {
            const currentUrl = new URL(window.location.href);
            if (
              currentUrl.searchParams.has('restaurantId') ||
              currentUrl.searchParams.has('restId') ||
              currentUrl.searchParams.has('id')
            ) {
              currentUrl.searchParams.delete('restaurantId');
              currentUrl.searchParams.delete('restId');
              currentUrl.searchParams.delete('id');
              if (targetEncryptedId) {
                currentUrl.searchParams.set('r', targetEncryptedId);
                currentUrl.searchParams.delete('encRestId');
                currentUrl.searchParams.delete('enc');
                currentUrl.searchParams.delete('eid');
              }
              window.history.replaceState({}, document.title, currentUrl.toString());
            }
          } catch (e) {}
        }

        // If dining at a table, automatically detect and sync any active running kitchen order
        if (targetTableNum) {
          try {
            const rawId = urlRestId ? Number(urlRestId) : 1;
            const runningOrder = await api.getActiveOrderByTable(targetTableNum, rawId);
            if (runningOrder && !['Cancelled', 'Settled'].includes(runningOrder.orderStatus)) {
              setActiveOrder(runningOrder);
              signalrService.joinOrderGroup(runningOrder.id);
            }
          } catch (e) {
            console.log('Active table order check:', e);
          }
        }

        if (paymentReturnOrderId) {
          const processedKey = 'cf_ret_handled_' + paymentReturnOrderId;
          if (sessionStorage.getItem(processedKey)) {
            console.log('Payment return already processed for', paymentReturnOrderId);
            return;
          }
          sessionStorage.setItem(processedKey, 'true');

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

            const isPaid =
              statusRes?.status === 'SUCCESS' ||
              statusRes?.status === 'PAID' ||
              statusRes?.order_status === 'PAID' ||
              statusRes?.data?.order_status === 'PAID' ||
              statusRes?.data?.status === 'SUCCESS' ||
              statusRes?.paymentStatus === 'SUCCESS' ||
              statusRes?.paymentStatus === 'Paid';

            if (statusRes && (statusRes?.status === 'FAILED' || statusRes?.order_status === 'FAILED' || statusRes?.status === 'CANCELLED' || statusRes?.order_status === 'CANCELLED')) {
              showToast('❌ Payment was cancelled or failed. Your order was not placed.');
              return;
            }

            // 1. Retrieve pending order payload cached before payment
            let pendingPayload = null;
            try {
              const rawPayload =
                sessionStorage.getItem('pending_cf_order_' + paymentReturnOrderId) ||
                localStorage.getItem('pending_cf_order_' + paymentReturnOrderId);
              if (rawPayload) pendingPayload = JSON.parse(rawPayload);
            } catch (storageErr) {
              console.log('Error parsing pending order payload:', storageErr);
            }

            let finalPlacedOrder = null;

            if (pendingPayload) {
              try {
                const placeRes = await api.placeOrder({
                  ...pendingPayload,
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
                    : null);

                // Clean up cached payload
                sessionStorage.removeItem('pending_cf_order_' + paymentReturnOrderId);
                localStorage.removeItem('pending_cf_order_' + paymentReturnOrderId);
              } catch (placeErr) {
                console.log('Place verified order error:', placeErr?.message);
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
                // Confirm payment and transition status via PublicDineInController endpoint
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
              const finalOrder = {
                ...finalPlacedOrder,
                items: (finalPlacedOrder?.items && finalPlacedOrder.items.length > 0)
                  ? finalPlacedOrder.items
                  : (pendingPayload?.items || []),
                paymentStatus: 'Paid',
                orderStatus: 'Confirmed',
              };

              setActiveOrder(finalOrder);
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

        const tablesData =
          await api.getTables(
            numericRestId
          );

        setTables(
          tablesData || []
        );

        if (targetTableId) {
          const found =
            tablesData.find(
              (t) =>
                t.id ===
                targetTableId
            );

          if (found) {
            setActiveTable(found);
          } else {
            setActiveTable({
              id: targetTableId,
              tableName:
                `Table #${targetTableId}`,
              rId: numericRestId,
            });
          }
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
            tableId
          );
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
        tableId
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
        setActiveOrder({
          ...placed,

          items:
            Array.isArray(
              placed.items
            )
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
        });

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

  const handleCallWaiter =
    async (requestType = 'CALL_WAITER', message = '') => {
      if (!activeTable) return;

      const restId = Number(catalog?.restaurantId) || Number(activeTable?.restaurantId) || undefined;
      try {
        const res =
          await api.callWaiter(
            activeTable.id,
            restId,
            requestType,
            message
          );

        showToast(
          res.message ||
            'Waiter has been notified.'
        );
      } catch (err) {
        if (err?.isRateLimited) {
          showToast(`⏳ ${err.message}`);
        } else {
          showToast('Failed to notify waiter. Please try again.');
        }
      }
    };

  const handleRequestBill =
    async () => {
      if (!activeTable) return;

      const restId = Number(catalog?.restaurantId) || Number(activeTable?.restaurantId) || undefined;
      try {
        const res =
          await api.requestBill(
            activeTable.id,
            restId
          );

        showToast(
          res.message ||
            'Bill requested.'
        );
      } catch (err) {
        if (err?.isRateLimited) {
          showToast(`⏳ ${err.message}`);
        } else {
          showToast('Failed to request bill. Please try again.');
        }
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
      await api.updateTableStatus(
        tableId,
        status
      );

      const restId =
        selectedRestaurant
          ? selectedRestaurant.id
          : 1;

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
      await api.settleTable(
        tableId
      );

      const restId =
        selectedRestaurant
          ? selectedRestaurant.id
          : 1;

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
            if (toastData.orderId || activeOrder) {
              setOrderTrackerOpen(true);
            }
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
        activeTable={activeTable}
        openQrModal={() =>
          setQrModalOpen(true)
        }
        cartCount={cartItems.length}
        openCart={() =>
          setCartModalOpen(true)
        }
        openOrderTracker={() =>
          activeOrder
            ? setOrderTrackerOpen(
                true
              )
            : showToast(
                'No active order found.'
              )
        }
        activeOrder={activeOrder}
      />

      {mode === 'customer' ? (
        <CustomerView
          catalog={catalog}
          categories={categories}
          items={items}
          activeTable={activeTable}
          activeOrder={activeOrder}
          openOrderTracker={() => setOrderTrackerOpen(true)}
          openScanner={() =>
            setScannerOpen(true)
          }
          openQrModal={() =>
            setQrModalOpen(true)
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
        activeTable={activeTable}
        catalog={catalog}
        loading={loading}
        storeOperatingStatus={storeOperatingStatus}
      />

      <OrderTrackerModal
        visible={
          orderTrackerOpen
        }
        onClose={() =>
          setOrderTrackerOpen(
            false
          )
        }
        order={activeOrder}
        orders={orders}
        catalog={catalog}
        activeTable={activeTable}
        onRefreshOrder={handleRefreshOrder}
        storeOperatingStatus={storeOperatingStatus}
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
        activeTable={activeTable}
        tables={tables}
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