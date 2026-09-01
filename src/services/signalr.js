import { HubConnectionBuilder, LogLevel, HttpTransportType } from '@microsoft/signalr';
import { getBaseUrl } from './api';

let hubConnection = null;
let currentRestaurantId = null;
let currentOrderId = null;
const statusListeners = new Set();
const orderCreatedListeners = new Set();

const storeOperatingStatusListeners = new Set();
const paymentVerifiedListeners = new Set();

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
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(LogLevel.Warning)
      .build();

    // Event listener: OnOrderStatusChanged
    hubConnection.on('OnOrderStatusChanged', (data) => {
      console.log('⚡ [SignalR] Real-Time OrderStatusChanged received:', data);
      statusListeners.forEach((callback) => {
        try {
          callback(data);
        } catch (e) {
          console.error('Error in SignalR status listener:', e);
        }
      });
    });

    // Event listener: OnOrderCreated
    hubConnection.on('OnOrderCreated', (data) => {
      console.log('⚡ [SignalR] Real-Time OrderCreated received:', data);
      orderCreatedListeners.forEach((callback) => {
        try {
          callback(data);
        } catch (e) {
          console.error('Error in SignalR order created listener:', e);
        }
      });
    });

    // Event listener: OnOrderSettled
    hubConnection.on('OnOrderSettled', (data) => {
      console.log('⚡ [SignalR] Real-Time OrderSettled received:', data);
      statusListeners.forEach((callback) => {
        try {
          callback(data);
        } catch (e) {
          console.error('Error in SignalR settled listener:', e);
        }
      });
    });

    // Event listener: OnKitchenStatusChanged
    hubConnection.on('OnKitchenStatusChanged', (data) => {
      console.log('⚡ [SignalR] Real-Time KitchenStatusChanged received:', data);
      statusListeners.forEach((callback) => {
        try {
          callback(data);
        } catch (e) {
          console.error('Error in SignalR kitchen listener:', e);
        }
      });
    });

    // Event listener: OnStoreOperatingStatusChanged
    hubConnection.on('OnStoreOperatingStatusChanged', (data) => {
      console.log('⚡ [SignalR] Real-Time StoreOperatingStatusChanged received:', data);
      storeOperatingStatusListeners.forEach((callback) => {
        try {
          callback(data);
        } catch (e) {
          console.error('Error in SignalR store status listener:', e);
        }
      });
    });

    // Event listener: OnPaymentVerified (CashFree Webhook -> Azure Function settlement)
    hubConnection.on('OnPaymentVerified', (data) => {
      console.log('⚡ [SignalR] Real-Time PaymentVerified received:', data);
      paymentVerifiedListeners.forEach((callback) => {
        try {
          callback(data);
        } catch (e) {
          console.error('Error in SignalR payment verified listener:', e);
        }
      });
    });

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
 * Subscribe to real-time payment verified events from CashFree / Azure Function
 */
export function onPaymentVerified(callback) {
  if (typeof callback === 'function') {
    paymentVerifiedListeners.add(callback);
  }
  return () => {
    paymentVerifiedListeners.delete(callback);
  };
}
