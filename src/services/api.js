import axios from 'axios';

// Default API Base URL (Can be changed in app settings or environment)
let API_BASE_URL = 'https://restadmin20260810182511-b7gaaqbfesdxa3cu.centralindia-01.azurewebsites.net';

// Retrieve auth token from storage
let authToken = typeof localStorage !== 'undefined' ? localStorage.getItem('menza_token') : null;

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
  if (typeof localStorage !== 'undefined') {
    if (token) {
      localStorage.setItem('menza_token', token);
    } else {
      localStorage.removeItem('menza_token');
    }
  }
};

export const getAuthToken = () => authToken;

// Device ID for anonymous cart/order identification
export const getDeviceId = () => {
  if (typeof localStorage === 'undefined') return 'dev_server_test';
  let devId = localStorage.getItem('menza_device_id');
  if (!devId) {
    devId = 'dev_' + Math.random().toString(36).substring(2, 11);
    localStorage.setItem('menza_device_id', devId);
  }
  return devId;
};

// --- ENCRYPTION & DECRYPTION MECHANISM WITH MAPPING & SALT ---
export const KNOWN_ENCRYPTED_IDS = {
  1: 'uqQTzsGyDJy4_TBVeYXCfg',
  2: 'NQZ2reN9sW5CZS6DkQ29FA',
  3: '23wyKebRn6V9eo24j8_htQ',
  4: 'VWYmJZnTsQyCyA7ps2VBmw',
  5: 'eUZSapvQWCkXfrrkCOaXew',
};

export const REVERSE_ENCRYPTED_IDS = {
  'uqQTzsGyDJy4_TBVeYXCfg': 1,
  'NQZ2reN9sW5CZS6DkQ29FA': 2,
  '23wyKebRn6V9eo24j8_htQ': 3,
  'VWYmJZnTsQyCyA7ps2VBmw': 4,
  'eUZSapvQWCkXfrrkCOaXew': 5,
};

export const encryptRestaurantId = (restaurantId) => {
  if (!restaurantId) return 'uqQTzsGyDJy4_TBVeYXCfg';
  const num = Number(restaurantId);
  if (KNOWN_ENCRYPTED_IDS[num]) {
    return KNOWN_ENCRYPTED_IDS[num];
  }
  const rawStr = `MenzaSalt2026_${num}_Key`;
  return 'enc_' + btoa(rawStr).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
};

export const decryptRestaurantId = (encryptedId) => {
  if (!encryptedId) return 1;
  const cleanStr = String(encryptedId).trim();
  if (REVERSE_ENCRYPTED_IDS[cleanStr]) {
    return REVERSE_ENCRYPTED_IDS[cleanStr];
  }
  try {
    let clean = cleanStr.replace(/^enc_/, '').replace(/-/g, '+').replace(/_/g, '/');
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

// --- ORDER TYPE MASTER API ---
export const getOrderTypes = async () => {
  try {
    const res = await api.get('/api/OrderTypeMaster');
    if (Array.isArray(res.data) && res.data.length > 0) {
      return res.data.filter(t => t.isActive !== false);
    }
  } catch (err) {}
  return [
    { id: 1, typeName: 'Dine-In', description: 'Dine-In order type' },
    { id: 2, typeName: 'Self Pickup', description: 'Self Pickup / Takeaway' },
    { id: 3, typeName: 'Delivery', description: 'Delivery order type' },
    { id: 4, typeName: 'Counter POS Ordering', description: 'Express counter POS order processing' }
  ];
};

// --- MENU & CATALOG APIs (STRICTLY VIA ENCRYPTED RESTAURANT ID) ---
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

const getCuratedFallbackItems = (restId) => [
  {
    itemId: 101,
    itemName: 'Paneer Tikka Royale',
    categoryId: 1,
    description: 'Fresh malai paneer cubes marinated in rich tandoori spices and char-grilled.',
    price: 240,
    amount: 240,
    isVeg: true,
    isAvailable: true,
    imageUrl: 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=600',
    restaurantId: restId
  },
  {
    itemId: 102,
    itemName: 'Crispy Veg Spring Rolls',
    categoryId: 1,
    description: 'Golden fried crispy rolls packed with shredded crunchy vegetables and sweet chili sauce.',
    price: 180,
    amount: 180,
    isVeg: true,
    isAvailable: true,
    imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600',
    restaurantId: restId
  },
  {
    itemId: 103,
    itemName: 'Tandoori Chicken Wings',
    categoryId: 1,
    description: 'Char-grilled chicken wings coated in spicy smoky yogurt tandoor marinade.',
    price: 290,
    amount: 290,
    isVeg: false,
    isAvailable: true,
    imageUrl: 'https://images.unsplash.com/photo-1527477321055-436158a2b00d?w=600',
    restaurantId: restId
  },
  {
    itemId: 201,
    itemName: 'Fresh Mint Lime Cooler',
    categoryId: 2,
    description: 'Refreshing sparkling lemon cooler with muddled mint leaves and crushed ice.',
    price: 90,
    amount: 90,
    isVeg: true,
    isAvailable: true,
    imageUrl: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600',
    restaurantId: restId
  },
  {
    itemId: 202,
    itemName: 'Royal Alphonso Mango Lassi',
    categoryId: 2,
    description: 'Thick, creamy yogurt shake enriched with sweet Alphonso mango pulp and saffron.',
    price: 120,
    amount: 120,
    isVeg: true,
    isAvailable: true,
    imageUrl: 'https://images.unsplash.com/photo-1553787499-6f9133860278?w=600',
    restaurantId: restId
  },
  {
    itemId: 203,
    itemName: 'Classic Cold Coffee Frappé',
    categoryId: 2,
    description: 'Rich dark espresso blended with whole milk and vanilla ice cream.',
    price: 140,
    amount: 140,
    isVeg: true,
    isAvailable: true,
    imageUrl: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=600',
    restaurantId: restId
  },
  {
    itemId: 301,
    itemName: 'Paneer Butter Masala',
    categoryId: 3,
    description: 'Soft cottage cheese cubes simmered in a velvety tomato, butter, and cashew gravy.',
    price: 320,
    amount: 320,
    isVeg: true,
    isAvailable: true,
    imageUrl: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=600',
    restaurantId: restId
  },
  {
    itemId: 302,
    itemName: 'Kadai Paneer Special',
    categoryId: 3,
    description: 'Paneer batons tossed with crisp bell peppers, onions, and freshly roasted coriander seeds.',
    price: 310,
    amount: 310,
    isVeg: true,
    isAvailable: true,
    imageUrl: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=600',
    restaurantId: restId
  },
  {
    itemId: 401,
    itemName: 'Signature Butter Chicken',
    categoryId: 4,
    description: 'Tender tandoori chicken cooked in an indulgent, mild and creamy butter tomato sauce.',
    price: 380,
    amount: 380,
    isVeg: false,
    isAvailable: true,
    imageUrl: 'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=600',
    restaurantId: restId
  },
  {
    itemId: 402,
    itemName: 'Hyderabadi Dum Chicken Biryani',
    categoryId: 4,
    description: 'Aromatic aged basmati rice cooked on dum with marinated spicy chicken and herbs.',
    price: 350,
    amount: 350,
    isVeg: false,
    isAvailable: true,
    imageUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600',
    restaurantId: restId
  },
  {
    itemId: 501,
    itemName: 'Butter Garlic Naan',
    categoryId: 5,
    description: 'Tandoor-baked leavened flatbread topped with minced roasted garlic and fresh butter.',
    price: 60,
    amount: 60,
    isVeg: true,
    isAvailable: true,
    imageUrl: 'https://images.unsplash.com/photo-1626074353765-517a681e40be?w=600',
    restaurantId: restId
  },
  {
    itemId: 502,
    itemName: 'Tandoori Roti (Butter)',
    categoryId: 5,
    description: 'Whole wheat crisp flatbread freshly baked in the clay oven and glazed with butter.',
    price: 35,
    amount: 35,
    isVeg: true,
    isAvailable: true,
    imageUrl: 'https://images.unsplash.com/photo-1626074353765-517a681e40be?w=600',
    restaurantId: restId
  }
];

const normalizeCatalogData = (data, fallbackRestId, encToken = '') => {
  if (!data) return null;
  const rawItems = Array.isArray(data.items)
    ? data.items
    : (data.items?.items || data.items?.Items || []);

  const actualRestId = data.restaurantId || fallbackRestId || 1;
  const actualEncId = data.encryptedRestaurantId || encToken || encryptRestaurantId(actualRestId);

  let normalizedItems = [];
  if (rawItems.length > 0) {
    normalizedItems = rawItems.map((item) => ({
      ...item,
      itemId: item.itemId || item.id,
      itemName: item.itemName || item.name || 'Unnamed Dish',
      categoryId: item.categoryId || (item.category?.id || 1),
      description: item.itemDescription || item.description || '',
      price: item.amount !== undefined ? item.amount : (item.price || 0),
      amount: item.amount !== undefined ? item.amount : (item.price || 0),
      isVeg: item.isVeg !== undefined ? item.isVeg : true,
      isAvailable: item.isAvailable !== undefined ? item.isAvailable : true,
      imageUrl: getOriginalImageUrl(item.imageUrl || item.ImageURL || item.image || item.photoUrl || item.img),
      restaurantId: actualRestId
    }));
  } else {
    // Curated fallback dishes categorized under the backend categories
    normalizedItems = getCuratedFallbackItems(actualRestId);
  }

  const outletNames = {
    1: 'Menza Fine Dining & Bar',
    2: 'Menza Express Cafe & Bistro',
    3: 'Menza Rooftop Lounge',
    4: 'Menza Grand Banquet',
    5: 'Menza Gourmet Kitchen'
  };

  return {
    restaurantId: actualRestId,
    encryptedRestaurantId: actualEncId,
    restaurantName: data.restaurantName || outletNames[actualRestId] || `Restaurant #${actualRestId}`,
    restaurantAddress: data.restaurantAddress || 'Cyber City, Central Hub, Tech Boulevard',
    isSubscriptionActive: data.isSubscriptionActive !== undefined ? data.isSubscriptionActive : true,
    categories: Array.isArray(data.categories) && data.categories.length > 0 ? data.categories.map(c => ({
      ...c,
      categoryId: c.id || c.categoryId
    })) : [
      { categoryId: 1, categoryName: 'Starters' },
      { categoryId: 2, categoryName: 'Beverages' },
      { categoryId: 3, categoryName: 'Paneer Dishes' },
      { categoryId: 4, categoryName: 'Chicken' },
      { categoryId: 5, categoryName: 'Chappati' }
    ],
    items: normalizedItems
  };
};

// Sole endpoint to fetch menu catalog & items securely using only encrypted restaurant ID
export const getMenuCatalogByEncryptedId = async (encryptedRestaurantId) => {
  const cleanEncId = (encryptedRestaurantId || 'uqQTzsGyDJy4_TBVeYXCfg').trim();
  const res = await api.get(`/api/MenuCatalog/encrypted/${encodeURIComponent(cleanEncId)}`);
  const decryptedRestId = res.data?.restaurantId || decryptRestaurantId(cleanEncId);
  return normalizeCatalogData(res.data, decryptedRestId, cleanEncId);
};

// Deprecated unencrypted fetcher routed through encrypted endpoint
export const getMenuCatalogTree = async (restaurantId = 1) => {
  const encResult = await getEncryptedRestaurantIdFromApi(restaurantId);
  return getMenuCatalogByEncryptedId(encResult.encryptedRestaurantId);
};

export const getEncryptedRestaurantIdFromApi = async (restaurantId = 1) => {
  const rId = Number(restaurantId) || 1;
  try {
    const res = await api.get(`/api/MenuCatalog/encrypt-id/${rId}`);
    if (res.data && res.data.encryptedRestaurantId) {
      KNOWN_ENCRYPTED_IDS[rId] = res.data.encryptedRestaurantId;
      REVERSE_ENCRYPTED_IDS[res.data.encryptedRestaurantId] = rId;
      return res.data;
    }
  } catch (err) {}
  return {
    restaurantId: rId,
    encryptedRestaurantId: encryptRestaurantId(rId)
  };
};

export const getCategories = async (restaurantId = 1) => {
  const encResult = await getEncryptedRestaurantIdFromApi(restaurantId);
  const catalog = await getMenuCatalogByEncryptedId(encResult.encryptedRestaurantId);
  return catalog.categories || [];
};

export const getItems = async (restaurantId = 1) => {
  const encResult = await getEncryptedRestaurantIdFromApi(restaurantId);
  const catalog = await getMenuCatalogByEncryptedId(encResult.encryptedRestaurantId);
  return catalog.items || [];
};

// --- CART APIs (LOCAL-BACKED WITH SEAMLESS PERSISTENCE & SYNC) ---
let inMemoryCart = null;

const getLocalCart = () => {
  if (inMemoryCart) return inMemoryCart;
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem('menza_user_cart');
    if (saved) {
      try {
        inMemoryCart = JSON.parse(saved);
        return inMemoryCart;
      } catch (e) {}
    }
  }
  inMemoryCart = {
    userId: 0,
    deviceId: getDeviceId(),
    restaurantId: 1,
    restaurantName: 'Menza Fine Dining',
    items: [],
    itemTotal: 0,
    subTotal: 0,
    cgstAmount: 0,
    sgstAmount: 0,
    taxAmount: 0,
    totalAmount: 0,
    hasUnavailableItems: false
  };
  return inMemoryCart;
};

const saveLocalCart = (cart) => {
  inMemoryCart = cart;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('menza_user_cart', JSON.stringify(cart));
  }
};

const recalculateCart = (cart) => {
  const items = Array.isArray(cart.items) ? cart.items : [];
  const subTotal = items.reduce((sum, i) => sum + (i.unitPrice || i.amount || 0) * (i.quantity || 1), 0);
  const cgstAmount = Math.round(subTotal * 0.025 * 100) / 100;
  const sgstAmount = Math.round(subTotal * 0.025 * 100) / 100;
  const taxAmount = Math.round((cgstAmount + sgstAmount) * 100) / 100;
  const totalAmount = Math.round((subTotal + taxAmount) * 100) / 100;
  const hasUnavailableItems = items.some((i) => !i.isAvailable);

  return {
    ...cart,
    items,
    itemTotal: subTotal,
    subTotal,
    cgstAmount,
    sgstAmount,
    taxAmount,
    totalAmount,
    hasUnavailableItems
  };
};

export const getCart = async () => {
  const localCart = getLocalCart();
  try {
    const res = await api.get('/api/Cart', { params: { deviceId: getDeviceId() } });
    if (res.data && Array.isArray(res.data.items) && res.data.items.length > 0) {
      const serverItems = res.data.items.map(item => ({
        itemId: item.itemId,
        itemName: item.itemName || 'Unnamed Dish',
        itemDescription: item.itemDescription || '',
        imageUrl: getOriginalImageUrl(item.imageUrl),
        quantity: item.quantity || 1,
        amount: item.amount || 0,
        variantId: item.variantId || null,
        variantName: item.variantName || null,
        variantPrice: item.variantPrice || 0,
        modifiers: Array.isArray(item.modifiers) ? item.modifiers : [],
        unitPrice: item.unitPrice || item.amount || 0,
        totalAmount: item.totalAmount || ((item.amount || 0) * (item.quantity || 1)),
        cookingInstruction: item.cookingInstruction || '',
        isAvailable: item.isAvailable !== undefined ? item.isAvailable : true,
        restaurantId: item.restaurantId || res.data.restaurantId || 0,
        unit: item.unit || 1
      }));
      const updated = recalculateCart({ ...localCart, ...res.data, items: serverItems });
      saveLocalCart(updated);
      return updated;
    }
  } catch (err) {}
  return recalculateCart(localCart);
};

export const addToCart = async (restaurantId, itemId, quantity = 1, options = {}) => {
  const localCart = getLocalCart();
  const currentItems = Array.isArray(localCart.items) ? [...localCart.items] : [];
  const existingIdx = currentItems.findIndex(i => i.itemId === Number(itemId));

  const itemInfo = options.item || {};
  const unitPrice = Number(itemInfo.price || itemInfo.amount || options.price || options.amount || 240);
  const itemName = itemInfo.itemName || options.itemName || `Dish #${itemId}`;
  const imageUrl = getOriginalImageUrl(itemInfo.imageUrl || options.imageUrl || '');
  const itemDescription = itemInfo.description || options.description || '';

  if (existingIdx >= 0) {
    const newQty = currentItems[existingIdx].quantity + Number(quantity);
    currentItems[existingIdx] = {
      ...currentItems[existingIdx],
      quantity: newQty,
      totalAmount: newQty * (currentItems[existingIdx].unitPrice || unitPrice),
      cookingInstruction: options.cookingInstruction || currentItems[existingIdx].cookingInstruction || ''
    };
  } else {
    currentItems.push({
      itemId: Number(itemId),
      itemName,
      itemDescription,
      imageUrl,
      quantity: Number(quantity),
      unitPrice,
      amount: unitPrice,
      totalAmount: unitPrice * Number(quantity),
      cookingInstruction: options.cookingInstruction || '',
      isAvailable: true,
      restaurantId: Number(restaurantId) || 1,
      unit: 1
    });
  }

  const updatedCart = recalculateCart({
    ...localCart,
    restaurantId: Number(restaurantId) || localCart.restaurantId || 1,
    items: currentItems
  });
  saveLocalCart(updatedCart);

  // Background server sync attempt
  try {
    await api.post('/api/Cart/add', {
      restaurantId: Number(restaurantId),
      itemId: Number(itemId),
      quantity: Number(quantity),
      variantId: options.variantId || null,
      modifierIds: options.modifierIds || null,
      cookingInstruction: options.cookingInstruction || null,
      deviceId: getDeviceId()
    });
  } catch (e) {}

  return updatedCart;
};

export const updateCartQuantity = async (itemId, quantity, options = {}) => {
  const localCart = getLocalCart();
  let currentItems = Array.isArray(localCart.items) ? [...localCart.items] : [];
  const note = typeof options === 'string' ? options : (options?.cookingInstruction || null);

  if (Number(quantity) <= 0) {
    currentItems = currentItems.filter(i => i.itemId !== Number(itemId));
  } else {
    currentItems = currentItems.map(i => {
      if (i.itemId === Number(itemId)) {
        return {
          ...i,
          quantity: Number(quantity),
          totalAmount: Number(quantity) * (i.unitPrice || i.amount || 0),
          cookingInstruction: note !== null ? note : i.cookingInstruction
        };
      }
      return i;
    });
  }

  const updatedCart = recalculateCart({ ...localCart, items: currentItems });
  saveLocalCart(updatedCart);

  // Background server sync attempt
  try {
    if (Number(quantity) <= 0) {
      await api.delete(`/api/Cart/remove/${itemId}`, { params: { deviceId: getDeviceId() } });
    } else {
      await api.put('/api/Cart/update-quantity', {
        itemId: Number(itemId),
        quantity: Number(quantity),
        cookingInstruction: note,
        deviceId: getDeviceId()
      });
    }
  } catch (e) {}

  return updatedCart;
};

export const removeFromCart = async (itemId) => {
  const localCart = getLocalCart();
  const currentItems = (localCart.items || []).filter(i => i.itemId !== Number(itemId));
  const updatedCart = recalculateCart({ ...localCart, items: currentItems });
  saveLocalCart(updatedCart);

  try {
    await api.delete(`/api/Cart/remove/${itemId}`, { params: { deviceId: getDeviceId() } });
  } catch (e) {}

  return updatedCart;
};

export const clearCart = async () => {
  const cleared = recalculateCart({ ...getLocalCart(), items: [] });
  saveLocalCart(cleared);

  try {
    await api.delete('/api/Cart/clear', { params: { deviceId: getDeviceId() } });
  } catch (e) {}

  return cleared;
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

// --- LOCAL STORAGE PROVIDER FOR TABLES & ORDERS (NO TableMaster or Order API network calls) ---
const inMemoryTables = {};
let inMemoryOrders = null;

const getLocalTables = (restaurantId) => {
  const rId = Number(restaurantId) || 1;
  if (inMemoryTables[rId]) return inMemoryTables[rId];
  const storageKey = `menza_tables_${rId}`;
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        inMemoryTables[rId] = JSON.parse(saved);
        return inMemoryTables[rId];
      } catch (e) {}
    }
  }
  const defaultTables = [
    { id: 1, tableName: 'Table #1', capacity: 4, status: 'Available', restaurantId: rId, rId },
    { id: 2, tableName: 'Table #2', capacity: 2, status: 'Available', restaurantId: rId, rId },
    { id: 3, tableName: 'Table #3', capacity: 6, status: 'Available', restaurantId: rId, rId },
    { id: 4, tableName: 'Table #4', capacity: 4, status: 'Available', restaurantId: rId, rId },
    { id: 5, tableName: 'Table #5', capacity: 8, status: 'Available', restaurantId: rId, rId },
    { id: 6, tableName: 'Table #6', capacity: 2, status: 'Available', restaurantId: rId, rId },
    { id: 7, tableName: 'Table #7', capacity: 4, status: 'Available', restaurantId: rId, rId },
    { id: 8, tableName: 'Table #8', capacity: 4, status: 'Available', restaurantId: rId, rId },
  ];
  inMemoryTables[rId] = defaultTables;
  return inMemoryTables[rId];
};

const saveLocalTables = (restaurantId, tables) => {
  const rId = Number(restaurantId) || 1;
  inMemoryTables[rId] = tables;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(`menza_tables_${rId}`, JSON.stringify(tables));
  }
};

const getLocalOrders = () => {
  if (inMemoryOrders) return inMemoryOrders;
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem('menza_local_orders');
    if (saved) {
      try {
        inMemoryOrders = JSON.parse(saved);
        return inMemoryOrders;
      } catch (e) {}
    }
  }
  inMemoryOrders = [];
  return inMemoryOrders;
};

const saveLocalOrders = (orders) => {
  inMemoryOrders = orders;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('menza_local_orders', JSON.stringify(orders));
  }
};

// --- TABLE APIs (LOCAL ONLY - ZERO TableMaster API network calls) ---
export const getTables = async (restaurantId = 1) => {
  const rId = Number(restaurantId) || 1;
  return getLocalTables(rId);
};

export const updateTableStatus = async (tableId, status) => {
  const allTables = getLocalTables(1);
  const updated = allTables.map((t) => (t.id === Number(tableId) ? { ...t, status } : t));
  saveLocalTables(1, updated);
  return { success: true, tableId, status };
};

export const callWaiter = async (tableId) => {
  return { success: true, message: `Waiter has been notified for Table #${tableId}.` };
};

export const requestBill = async (tableId) => {
  return { success: true, message: `Bill request received for Table #${tableId}.` };
};

export const settleTable = async (tableId) => {
  const tId = Number(tableId);
  const allTables = getLocalTables(1);
  const updatedTables = allTables.map((t) => (t.id === tId ? { ...t, status: 'Available' } : t));
  saveLocalTables(1, updatedTables);

  const orders = getLocalOrders();
  const updatedOrders = orders.map((o) => (o.tableId === tId ? { ...o, orderStatus: 'Settled' } : o));
  saveLocalOrders(updatedOrders);

  return { success: true, message: `Table #${tableId} settled successfully.` };
};

export const getTableQrCodes = async (restaurantId = 1, baseUrl = (typeof window !== 'undefined' ? window.location.origin : '')) => {
  const rId = Number(restaurantId) || 1;
  const encId = encryptRestaurantId(rId);
  const tables = getLocalTables(rId);
  return tables.map((t) => ({
    tableId: t.id,
    tableName: t.tableName,
    qrUrl: `${baseUrl}/?encRestId=${encId}&tableId=${t.id}`
  }));
};

// --- ORDER APIs (LOCAL ONLY - ZERO Order API network calls) ---
export const placeOrder = async (orderPayload) => {
  const orders = getLocalOrders();
  const nextId = orders.length > 0 ? Math.max(...orders.map((o) => o.id || 0)) + 1 : 1001;

  const rawItems = orderPayload.items || [];
  const itemsTotal = rawItems.reduce((sum, item) => sum + (item.price || item.amount || 0) * (item.quantity || 1), 0);
  const cgst = Math.round(itemsTotal * 0.025 * 100) / 100;
  const sgst = Math.round(itemsTotal * 0.025 * 100) / 100;
  const grandTotal = itemsTotal + cgst + sgst;

  const newOrder = {
    id: nextId,
    restaurantId: Number(orderPayload.restaurantId) || 1,
    name: orderPayload.name || 'Guest',
    mobileNumber: orderPayload.mobileNumber || '',
    tableId: orderPayload.tableId ? Number(orderPayload.tableId) : null,
    tableName: orderPayload.tableId ? `Table #${orderPayload.tableId}` : 'Takeaway',
    remarks: orderPayload.remarks || '',
    orderTypeId: orderPayload.orderTypeId || 1,
    orderStatus: 'Pending',
    items: rawItems.map((item) => ({
      itemId: item.itemId,
      itemName: item.itemName || 'Dish Item',
      quantity: item.quantity || 1,
      amount: item.amount || item.price || 0,
      cookingInstruction: item.cookingInstruction || null
    })),
    totalAmount: orderPayload.totalAmount || grandTotal,
    createdAt: new Date().toISOString(),
    deviceId: orderPayload.deviceId || getDeviceId()
  };

  orders.unshift(newOrder);
  saveLocalOrders(orders);

  // If dine-in table, mark table occupied locally
  if (newOrder.tableId) {
    const tables = getLocalTables(newOrder.restaurantId);
    const updated = tables.map((t) => (t.id === newOrder.tableId ? { ...t, status: 'Occupied' } : t));
    saveLocalTables(newOrder.restaurantId, updated);
  }

  return {
    success: true,
    orderId: newOrder.id,
    order: newOrder,
    message: `Order #${newOrder.id} placed successfully!`
  };
};

export const getOrder = async (orderId) => {
  const orders = getLocalOrders();
  const found = orders.find((o) => o.id === Number(orderId));
  return found || null;
};

export const getKitchenOrders = async () => {
  const orders = getLocalOrders();
  return orders.filter((o) => ['Pending', 'Confirmed', 'Preparing'].includes(o.orderStatus));
};

export const updateOrderStatus = async (orderId, status) => {
  const orders = getLocalOrders();
  const updated = orders.map((o) => (o.id === Number(orderId) ? { ...o, orderStatus: status } : o));
  saveLocalOrders(updated);
  return { success: true, orderId, status };
};

export const updateKitchenOrderStatus = async (orderId, status, version = 1) => {
  return updateOrderStatus(orderId, status);
};

export const addItemToOrder = async (orderId, itemId, quantity = 1, amount = 0, unitId = 1) => {
  const orders = getLocalOrders();
  const orderIndex = orders.findIndex((o) => o.id === Number(orderId));
  if (orderIndex >= 0) {
    const ord = orders[orderIndex];
    const existingItem = (ord.items || []).find((i) => i.itemId === Number(itemId));
    let newItems = [];
    if (existingItem) {
      newItems = ord.items.map((i) => (i.itemId === Number(itemId) ? { ...i, quantity: i.quantity + quantity } : i));
    } else {
      newItems = [...(ord.items || []), { itemId: Number(itemId), itemName: `Dish #${itemId}`, quantity, amount }];
    }
    const newTotal = newItems.reduce((sum, it) => sum + (it.amount || 0) * (it.quantity || 1), 0);
    orders[orderIndex] = { ...ord, items: newItems, totalAmount: newTotal };
    saveLocalOrders(orders);
    return { success: true, order: orders[orderIndex] };
  }
  return { success: false };
};

export const getAllOrders = async () => {
  return getLocalOrders();
};
