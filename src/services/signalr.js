import { HubConnectionBuilder, LogLevel, HttpTransportType } from '@microsoft/signalr';
import { getBaseUrl } from './api';

let hubConnection = null;
let currentRestaurantId = null;
let currentOrderId = null;

const statusListeners = new Set();
const orderCreatedListeners = new Set();
const storeOperatingStatusListeners = new Set();
const paymentVerifiedListeners = new Set();
const kitchenProgressListeners = new Set();
const serviceRequestResolvedListeners = new Set();
const tableStatusListeners = new Set();
const menuItemAvailabilityListeners = new Set();

/* =========================================================
   AUDIO CHIME & BROWSER NOTIFICATIONS
========================================================= */

/**
 * Requests browser notification permission if not yet decided
 */
export function requestNotificationPermission() {
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }
}

/**
 * Synthesizes a crisp, pleasant restaurant audio chime using Web Audio API
 */
export function playNotificationChime(type = 'ready') {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    if (type === 'ready') {
      // 2-tone uplifting bell: D5 (587Hz) -> A5 (880Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now);
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.18);
      gain1.gain.setValueAtTime(0.25, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.7);
    } else if (type === 'served') {
      // 3-tone cheerful arrival chime: C5 -> E5 -> G5
      [523.25, 659.25, 783.99].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = now + i * 0.12;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.5);
      });
    } else {
      // Soft gentle ping for 'cooking' or 'placed'
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(554.37, now + 0.12);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.45);
    }
  } catch (e) {
    // Autoplay restrictions safely caught
  }
}

/**
 * Fires a native desktop/mobile browser notification if permission is granted
 */
export function sendBrowserNotification(title, body = '', tag = 'order-update') {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  try {
    if (Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/favicon.png',
        tag,
        badge: '/favicon.png',
      });
    }
  } catch (e) {
    console.warn('Browser notification error:', e);
  }
}

/* =========================================================
   SIGNALR CONNECTION
========================================================= */

/**
 * Initializes and starts the SignalR Hub connection
 */
export async function startSignalRConnection(restaurantId = null, orderId = null) {
  const baseUrl = (typeof getBaseUrl === 'function' ? getBaseUrl() : 'https://restadmin20260810182511-b7gaaqbfesdxa3cu.centralindia-01.azurewebsites.net').replace(/\/+$/, '');
  const hubUrl = `${baseUrl}/hubs/order`;

  if (hubConnection && hubConnection.state === 'Connected') {
    if (restaurantId && restaurantId !== currentRestaurantId) {
      joinRestaurantGroup(restaurantId);
    }
    if (orderId && orderId !== currentOrderId) {
      joinOrderGroup(orderId);
    }
    return hubConnection;
  }

  try {
    hubConnection = new HubConnectionBuilder()
      .withUrl(hubUrl, {
        transport: HttpTransportType.WebSockets | HttpTransportType.ServerSentEvents | HttpTransportType.LongPolling,
        withCredentials: true,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(LogLevel.Warning)
      .build();

    // Central dispatcher for status changes (supporting both OnEvent and Event naming)
    const dispatchStatusChanged = (raw) => {
      console.log('⚡ [SignalR] Raw Order / Kitchen status update:', raw);
      if (!raw) return;

      const data = (raw && typeof raw === 'object' && raw.data) ? raw.data : raw;

      // Robust extraction of order ID across all possible casing / naming conventions
      const orderId = Number(
        data.orderId ||
        data.OrderId ||
        data.id ||
        data.Id ||
        data.order_id ||
        data.Order_Id ||
        data.orderNumber ||
        data.OrderNumber ||
        0
      );

      // Robust extraction of overall order status
      let orderStatus =
        data.orderStatus ||
        data.OrderStatus ||
        data.status ||
        data.Status ||
        data.orderState ||
        data.OrderState ||
        null;

      // Robust extraction of kitchen status
      let kitchenStatus =
        data.kitchenStatus ||
        data.KitchenStatus ||
        data.kitchenOrderStatus ||
        data.KitchenOrderStatus ||
        null;

      const oStLower = String(orderStatus || '').toLowerCase();
      if (oStLower.includes('serve') || oStLower.includes('deliver') || oStLower.includes('complete') || oStLower.includes('settled')) {
        kitchenStatus = 'Served';
      } else if (!kitchenStatus && orderStatus) {
        if (oStLower.includes('ready')) {
          kitchenStatus = 'Ready';
        } else if (oStLower.includes('prep') || oStLower.includes('cook')) {
          kitchenStatus = 'Preparing';
        } else if (oStLower.includes('confirm')) {
          kitchenStatus = 'Confirmed';
        }
      }

      if (!orderStatus && kitchenStatus) {
        orderStatus = kitchenStatus;
      }

      const paymentStatus =
        data.paymentStatus ||
        data.PaymentStatus ||
        null;

      const normalized = {
        ...data,
        id: orderId || data.id,
        orderId: orderId || data.orderId,
        kitchenStatus: kitchenStatus || data.kitchenStatus,
        orderStatus: orderStatus || data.orderStatus,
        status: orderStatus || data.status,
        paymentStatus: paymentStatus || data.paymentStatus,
        items: Array.isArray(data.items) ? data.items : Array.isArray(data.Items) ? data.Items : undefined,
      };

      const effectiveStatus = String(kitchenStatus || orderStatus || '').toLowerCase();
      const orderNum = orderId || data?.pickupToken || data?.tokenNumber || '';

      // Determine chime & notification
      if (effectiveStatus.includes('ready')) {
        playNotificationChime('ready');
        sendBrowserNotification(
          `🔔 Order #${orderNum} is READY!`,
          'Your dishes are prepared and are being delivered to your table.',
          `order-${orderNum}-ready`
        );
      } else if (effectiveStatus.includes('serve') || effectiveStatus.includes('deliver') || effectiveStatus.includes('complete')) {
        playNotificationChime('served');
        sendBrowserNotification(
          `🍽️ Order #${orderNum} Has Been Served`,
          'Your food has arrived at your table. Enjoy your feast!',
          `order-${orderNum}-served`
        );
      } else if (effectiveStatus.includes('cook') || effectiveStatus.includes('prep') || effectiveStatus.includes('kitchen')) {
        playNotificationChime('cooking');
        sendBrowserNotification(
          `👨‍🍳 Cooking Order #${orderNum}`,
          'The chef in the kitchen has started preparing your order.',
          `order-${orderNum}-cooking`
        );
      }

      statusListeners.forEach((cb) => {
        try { cb(normalized); } catch (e) { console.error(e); }
      });

      kitchenProgressListeners.forEach((cb) => {
        try { cb(normalized); } catch (e) { console.error(e); }
      });
    };

    const dispatchOrderCreated = (raw) => {
      console.log('⚡ [SignalR] Real-Time OrderCreated received:', raw);
      const data = (raw && typeof raw === 'object' && raw.data) ? raw.data : raw;
      playNotificationChime('cooking');
      orderCreatedListeners.forEach((cb) => {
        try { cb(data); } catch (e) { console.error(e); }
      });
    };

    // 1. Order Status Changed (from POS, Waiter, or Chef)
    hubConnection.on('OnOrderStatusChanged', dispatchStatusChanged);
    hubConnection.on('OrderStatusChanged', dispatchStatusChanged);

    // 2. Kitchen Status Changed (Specific KDS bump from CaptainMenza)
    hubConnection.on('OnKitchenStatusChanged', dispatchStatusChanged);
    hubConnection.on('KitchenStatusChanged', dispatchStatusChanged);

    // 3. Order Created (New KOT received from Table QR or Counter)
    hubConnection.on('OnOrderCreated', dispatchOrderCreated);
    hubConnection.on('OrderCreated', dispatchOrderCreated);

    // 6. Order Settled (Payment verified)
    hubConnection.on('OnOrderSettled', dispatchStatusChanged);
    hubConnection.on('OrderSettled', dispatchStatusChanged);

    // 6. Store Operating Status
    hubConnection.on('OnStoreOperatingStatusChanged', (data) => {
      console.log('⚡ [SignalR] Real-Time StoreOperatingStatusChanged received:', data);
      storeOperatingStatusListeners.forEach((cb) => {
        try { cb(data); } catch (e) { console.error(e); }
      });
    });

    // 7. CashFree payment verification
    hubConnection.on('OnPaymentVerified', (data) => {
      console.log('⚡ [SignalR] Real-Time PaymentVerified received:', data);
      paymentVerifiedListeners.forEach((cb) => {
        try { cb(data); } catch (e) { console.error(e); }
      });
    });

    // 8. Waiter / Service Request Acknowledged from MenzaServe
    const dispatchServiceRequestResolved = (data) => {
      console.log('⚡ [SignalR] Real-Time ServiceRequestResolved received:', data);
      playNotificationChime('ready');
      sendBrowserNotification(
        '🔔 Waiter Update',
        'Staff has acknowledged your table request and is on their way.',
        'waiter-resolved'
      );
      serviceRequestResolvedListeners.forEach((cb) => {
        try { cb(data); } catch (e) { console.error(e); }
      });
    };
    hubConnection.on('ServiceRequestResolved', dispatchServiceRequestResolved);
    hubConnection.on('OnServiceRequestResolved', dispatchServiceRequestResolved);

    // 9. Table Status Changed
    const dispatchTableStatusChanged = (raw) => {
      console.log('⚡ [SignalR] Real-Time TableStatusChanged received:', raw);
      const data = (raw && typeof raw === 'object' && raw.data) ? raw.data : raw;
      tableStatusListeners.forEach((cb) => {
        try { cb(data); } catch (e) { console.error(e); }
      });
    };
    hubConnection.on('OnTableStatusChanged', dispatchTableStatusChanged);
    hubConnection.on('TableStatusChanged', dispatchTableStatusChanged);

    // 10. Menu Item Availability Changed (In-stock / Sold-out real-time sync)
    const dispatchMenuItemAvailabilityChanged = (raw) => {
      console.log('⚡ [SignalR] Real-Time MenuItemAvailabilityChanged received:', raw);
      const data = (raw && typeof raw === 'object' && raw.data) ? raw.data : raw;
      menuItemAvailabilityListeners.forEach((cb) => {
        try { cb(data); } catch (e) { console.error(e); }
      });
    };
    hubConnection.on('OnMenuItemAvailabilityChanged', dispatchMenuItemAvailabilityChanged);
    hubConnection.on('MenuItemAvailabilityChanged', dispatchMenuItemAvailabilityChanged);

    await hubConnection.start();
    console.log('⚡ [SignalR] OrderNotificationHub Connected successfully to', hubUrl);

    if (restaurantId) {
      await joinRestaurantGroup(restaurantId);
    }
    if (orderId) {
      await joinOrderGroup(orderId);
    }

    hubConnection.onreconnected(async () => {
      console.log('⚡ [SignalR] Reconnected. Rejoining groups...');
      if (currentRestaurantId) await joinRestaurantGroup(currentRestaurantId);
      if (currentOrderId) await joinOrderGroup(currentOrderId);
    });

    return hubConnection;
  } catch (err) {
    console.warn('⚡ [SignalR] Connection warning (fallback to polling active):', err?.message || err);
    return null;
  }
}

/**
 * Join a restaurant group for real-time outlet broadcasts
 */
export async function joinRestaurantGroup(restaurantId) {
  if (!restaurantId) return;
  currentRestaurantId = String(restaurantId);

  if (hubConnection && hubConnection.state === 'Connected') {
    try {
      await hubConnection.invoke('JoinRestaurantGroup', currentRestaurantId);
      console.log(`⚡ [SignalR] Joined Restaurant_${currentRestaurantId} group`);
    } catch (err) {
      console.warn('Failed to join restaurant group:', err);
    }
  }
}

/**
 * Join a specific order group for targeted status updates
 */
export async function joinOrderGroup(orderId) {
  if (!orderId) return;
  currentOrderId = String(orderId);

  if (hubConnection && hubConnection.state === 'Connected') {
    try {
      await hubConnection.invoke('JoinOrderGroup', currentOrderId);
      console.log(`⚡ [SignalR] Joined Order_${currentOrderId} group`);
    } catch (err) {
      console.warn('Failed to join order group:', err);
    }
  }
}

/**
 * Leave a specific order group when modal is closed
 */
export async function leaveOrderGroup(orderId) {
  if (!orderId) return;
  const targetId = String(orderId);

  if (hubConnection && hubConnection.state === 'Connected') {
    try {
      await hubConnection.invoke('LeaveOrderGroup', targetId);
      console.log(`⚡ [SignalR] Left Order_${targetId} group`);
    } catch (err) {
      // ignore
    }
  }
}

/**
 * Subscribe to real-time order status change events
 */
export function onOrderStatusChanged(callback) {
  if (typeof callback === 'function') {
    statusListeners.add(callback);
  }
  return () => {
    statusListeners.delete(callback);
  };
}

/**
 * Subscribe to real-time kitchen progress change events
 */
export function onKitchenProgress(callback) {
  if (typeof callback === 'function') {
    kitchenProgressListeners.add(callback);
  }
  return () => {
    kitchenProgressListeners.delete(callback);
  };
}

/**
 * Subscribe to real-time new order created events
 */
export function onOrderCreated(callback) {
  if (typeof callback === 'function') {
    orderCreatedListeners.add(callback);
  }
  return () => {
    orderCreatedListeners.delete(callback);
  };
}

/**
 * Subscribe to real-time store operating status change events
 */
export function onStoreOperatingStatusChanged(callback) {
  if (typeof callback === 'function') {
    storeOperatingStatusListeners.add(callback);
  }
  return () => {
    storeOperatingStatusListeners.delete(callback);
  };
}

/**
 * Subscribe to real-time payment verified events
 */
export function onPaymentVerified(callback) {
  if (typeof callback === 'function') {
    paymentVerifiedListeners.add(callback);
  }
  return () => {
    paymentVerifiedListeners.delete(callback);
  };
}

/**
 * Subscribe to real-time service request / waiter call resolved events
 */
export function onServiceRequestResolved(callback) {
  if (typeof callback === 'function') {
    serviceRequestResolvedListeners.add(callback);
  }
  return () => {
    serviceRequestResolvedListeners.delete(callback);
  };
}

/**
 * Subscribe to real-time table status change events
 */
export function onTableStatusChanged(callback) {
  if (typeof callback === 'function') {
    tableStatusListeners.add(callback);
  }
  return () => {
    tableStatusListeners.delete(callback);
  };
}

/**
 * Subscribe to real-time menu item availability change events
 */
export function onMenuItemAvailabilityChanged(callback) {
  if (typeof callback === 'function') {
    menuItemAvailabilityListeners.add(callback);
  }
  return () => {
    menuItemAvailabilityListeners.delete(callback);
  };
}


