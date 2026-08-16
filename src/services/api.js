import axios from 'axios';

// Default API Base URL (Can be changed in app settings or environment)
let API_BASE_URL = 'https://restadmin20260709004236-csgzcba5dafabad2.centralindia-01.azurewebsites.net';

// Retrieve auth token from storage
let authToken = localStorage.getItem('menza_token') || null;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

export const setApiBaseUrl = (url) => {
  API_BASE_URL = url;
  api.defaults.baseURL = url;
};

export const setAuthToken = (token) => {
  authToken = token;
  if (token) {
    localStorage.setItem('menza_token', token);
  } else {
    localStorage.removeItem('menza_token');
  }
};

export const getAuthToken = () => authToken;

// Device ID for anonymous cart/order identification
export const getDeviceId = () => {
  let devId = localStorage.getItem('menza_device_id');
  if (!devId) {
    devId = 'dev_' + Math.random().toString(36).substring(2, 11);
    localStorage.setItem('menza_device_id', devId);
  }
  return devId;
};

// --- ENCRYPTION & DECRYPTION MECHANISM WITH SALT ---
export const encryptRestaurantId = (restaurantId) => {
  if (!restaurantId) return '';
  const num = Number(restaurantId);
  const rawStr = `MenzaSalt2026_${num}_Key`;
  return 'enc_' + btoa(rawStr).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
};

export const decryptRestaurantId = (encryptedId) => {
  if (!encryptedId) return 1;
  try {
    let clean = encryptedId.replace(/^enc_/, '').replace(/-/g, '+').replace(/_/g, '/');
    while (clean.length % 4 !== 0) {
      clean += '=';
    }
    const decodedStr = atob(clean);
    const match = decodedStr.match(/MenzaSalt2026_(\d+)_Key/);
    if (match && match[1]) {
      return Number(match[1]);
    }
  } catch (e) {}
  return 1;
};

// --- AUTH APIs ---
export const generateOtp = async (mobile, deviceId) => {
  const res = await api.post('/api/Auth/GenerateOtp', { mobile, deviceId: deviceId || getDeviceId() });
  return res.data;
};

export const loginWithOtp = async (mobile, otpCode) => {
  const res = await api.post('/api/Auth/Login', { mobile, otpCode, deviceId: getDeviceId() });
  if (res.data && res.data.token) {
    setAuthToken(res.data.token);
  }
  return res.data;
};

export const getMyRestaurants = async () => {
  try {
    const res = await api.get('/api/Auth/MyRestaurants');
    return res.data;
  } catch (err) {
    return [];
  }
};

export const switchRestaurant = async (restaurantId) => {
  const res = await api.post('/api/Auth/SwitchRestaurant', { restaurantId });
  return res.data;
};

// --- MENU & CATALOG APIs ---
const AZURE_BLOB_BASE = 'https://sarestaurantdev.blob.core.windows.net/screstdev/';

export const getOriginalImageUrl = (url) => {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return '';
  
  // 1. If it's already a full HTTP/HTTPS URL or Data URI (Azure Blob SAS / Direct Azure Blob URL)
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
    return trimmed;
  }
  
  // 2. Clean leading slashes
  const cleanPath = trimmed.replace(/^\//, '');
  
  // 3. If path contains container name 'screstdev/'
  if (cleanPath.startsWith('screstdev/')) {
    return `https://sarestaurantdev.blob.core.windows.net/${cleanPath}`;
  }
  
  // 4. If path is a container-relative Azure Blob path (e.g. '2026/07/31/abc.png' or 'images/abc.png')
  if (cleanPath.includes('/')) {
    return `${AZURE_BLOB_BASE}${cleanPath}`;
  }
  
  // 5. Fallback relative path on server
  return `${AZURE_BLOB_BASE}${cleanPath}`;
};

const normalizeCatalogData = (data, fallbackRestId) => {
  if (!data) return null;
  const rawItems = Array.isArray(data.items)
    ? data.items
    : (data.items?.items || data.items?.Items || []);

  const normalizedItems = rawItems.map((item) => ({
    ...item,
    itemId: item.itemId || item.id,
    itemName: item.itemName || item.name || 'Unnamed Dish',
    description: item.itemDescription || item.description || '',
    price: item.amount !== undefined ? item.amount : (item.price || 0),
    amount: item.amount !== undefined ? item.amount : (item.price || 0),
    isVeg: item.isVeg !== undefined ? item.isVeg : true,
    isAvailable: item.isAvailable !== undefined ? item.isAvailable : true,
    imageUrl: getOriginalImageUrl(item.imageUrl || item.ImageURL || item.image || item.photoUrl || item.img)
  }));

  return {
    restaurantId: data.restaurantId || fallbackRestId,
    encryptedRestaurantId: data.encryptedRestaurantId || encryptRestaurantId(data.restaurantId || fallbackRestId),
    restaurantName: data.restaurantName || `Restaurant #${data.restaurantId || fallbackRestId}`,
    restaurantAddress: data.restaurantAddress || '',
    isSubscriptionActive: data.isSubscriptionActive !== undefined ? data.isSubscriptionActive : true,
    categories: Array.isArray(data.categories) ? data.categories : [],
    items: normalizedItems
  };
};

export const getMenuCatalogTree = async (restaurantId = 1) => {
  const rId = Number(restaurantId) || 1;
  const res = await api.get(`/api/MenuCatalog/restaurant/${rId}`);
  return normalizeCatalogData(res.data, rId);
};

export const getMenuCatalogByEncryptedId = async (encryptedRestaurantId) => {
  const res = await api.get(`/api/MenuCatalog/encrypted/${encodeURIComponent(encryptedRestaurantId)}`);
  const decryptedRestId = decryptRestaurantId(encryptedRestaurantId);
  return normalizeCatalogData(res.data, decryptedRestId);
};

export const getEncryptedRestaurantIdFromApi = async (restaurantId = 1) => {
  const rId = Number(restaurantId) || 1;
  try {
    const res = await api.get(`/api/MenuCatalog/encrypt-id/${rId}`);
    return res.data;
  } catch (err) {
    return {
      restaurantId: rId,
      encryptedRestaurantId: encryptRestaurantId(rId)
    };
  }
};

export const getCategories = async (restaurantId = 1) => {
  try {
    const res = await api.get('/api/CategoryMaster', { params: { restaurantId } });
    return res.data.items || res.data;
  } catch (err) {
    return [];
  }
};

export const getItems = async (restaurantId = 1, categoryId = null) => {
  const rId = Number(restaurantId) || 1;
  try {
    const res = await api.get('/api/ItemMaster', { params: { restaurantId: rId, categoryId } });
    return res.data.items || res.data;
  } catch (err) {
    return [];
  }
};

// --- CART APIs ---
export const getCart = async () => {
  try {
    const res = await api.get('/api/Cart', { params: { deviceId: getDeviceId() } });
    return res.data;
  } catch (err) {
    return { userId: 0, items: [], totalAmount: 0 };
  }
};

export const addToCart = async (restaurantId, itemId, quantity = 1) => {
  const res = await api.post('/api/Cart/add', {
    restaurantId,
    itemId,
    quantity,
    deviceId: getDeviceId()
  });
  return res.data;
};

export const updateCartQuantity = async (itemId, quantity) => {
  const res = await api.put('/api/Cart/update-quantity', {
    itemId,
    quantity,
    deviceId: getDeviceId()
  });
  return res.data;
};

export const removeFromCart = async (itemId) => {
  const res = await api.delete(`/api/Cart/remove/${itemId}`, { params: { deviceId: getDeviceId() } });
  return res.data;
};

export const clearCart = async () => {
  const res = await api.delete('/api/Cart/clear', { params: { deviceId: getDeviceId() } });
  return res.data;
};

// --- CASHFREE PAYMENT APIs ---
export const initiateCashfreeCheckout = async (checkoutData) => {
  const res = await api.post('/api/CashFreepayment/initiate-checkout', {
    restaurantId: checkoutData.restaurantId || 1,
    amount: checkoutData.amount,
    customerName: checkoutData.customerName || 'Customer',
    customerPhone: checkoutData.customerPhone || '9999999999',
    customerEmail: checkoutData.customerEmail || 'customer@menza.com',
    tableNumber: checkoutData.tableNumber || '',
    orderNotes: checkoutData.orderNotes || '',
    deviceId: getDeviceId()
  });
  return res.data;
};

export const verifyCashfreePayment = async (orderId) => {
  const res = await api.post('/api/CashFreepayment/verify', { orderId });
  return res.data;
};

export const getCashfreePaymentStatus = async (orderId) => {
  const res = await api.get(`/api/CashFreepayment/status/${orderId}`);
  return res.data;
};

// --- TABLE APIs ---
export const getTables = async (restaurantId = 1) => {
  const rId = Number(restaurantId) || 1;
  try {
    const res = await api.get(`/api/TableMaster/restaurant/${rId}`);
    return res.data;
  } catch (err) {
    return [];
  }
};

export const updateTableStatus = async (tableId, status) => {
  const res = await api.put(`/api/Order/Table/${tableId}/Status`, JSON.stringify(status), {
    headers: { 'Content-Type': 'application/json' }
  });
  return res.data;
};

export const callWaiter = async (tableId) => {
  const res = await api.post(`/api/Order/Table/${tableId}/CallWaiter`);
  return res.data;
};

export const requestBill = async (tableId) => {
  const res = await api.post(`/api/Order/Table/${tableId}/RequestBill`);
  return res.data;
};

export const settleTable = async (tableId) => {
  const res = await api.post(`/api/Order/Table/${tableId}/Settle`);
  return res.data;
};

export const getTableQrCodes = async (restaurantId = 1, baseUrl = window.location.origin) => {
  const rId = Number(restaurantId) || 1;
  const res = await api.get(`/api/Order/Restaurant/${rId}/Tables/Qr`, { params: { baseUrl } });
  return res.data;
};

// --- ORDER APIs ---
export const placeOrder = async (orderPayload) => {
  const res = await api.post('/api/Order', {
    ...orderPayload,
    deviceId: orderPayload.deviceId || getDeviceId()
  });
  return res.data;
};

export const getOrder = async (orderId) => {
  const res = await api.get(`/api/Order/${orderId}`);
  return res.data;
};

export const getKitchenOrders = async () => {
  try {
    const res = await api.get('/api/Order/Kitchen');
    return res.data;
  } catch (err) {
    return [];
  }
};

export const updateOrderStatus = async (orderId, status) => {
  const res = await api.put(`/api/Order/${orderId}/Status`, JSON.stringify(status), {
    headers: { 'Content-Type': 'application/json' }
  });
  return res.data;
};

export const updateKitchenOrderStatus = async (orderId, status, version = 1) => {
  const res = await api.put(`/api/Order/${orderId}/Kitchen/Status?version=${version}`, JSON.stringify(status), {
    headers: { 'Content-Type': 'application/json' }
  });
  return res.data;
};

export const addItemToOrder = async (orderId, itemId, quantity, amount, unitId = 1) => {
  const res = await api.post(`/api/Order/${orderId}/Item`, {
    itemId,
    quantity,
    amount,
    unitId
  });
  return res.data;
};

export const getAllOrders = async () => {
  try {
    const res = await api.get('/api/Order');
    return res.data;
  } catch (err) {
    return [];
  }
};
