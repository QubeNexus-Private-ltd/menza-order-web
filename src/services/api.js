import axios from 'axios';
import {
  consumeRateLimit,
  checkRateLimit,
  getCooldownSeconds,
  resetRateLimit,
  broadcastRateLimitExceeded,
  onRateLimitExceeded,
  RATE_LIMIT_RULES,
} from './rateLimiter';

export {
  consumeRateLimit,
  checkRateLimit,
  getCooldownSeconds,
  resetRateLimit,
  broadcastRateLimitExceeded,
  onRateLimitExceeded,
  RATE_LIMIT_RULES,
};

/* =========================================================
   API CONFIG
========================================================= */

export const getBaseUrl = () => API_BASE_URL;

let API_BASE_URL =
  'https://restadmin20260810182511-b7gaaqbfesdxa3cu.centralindia-01.azurewebsites.net';

let authToken =
  typeof localStorage !== 'undefined'
    ? localStorage.getItem('menza_token')
    : null;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

/* =========================================================
   AXIOS INTERCEPTORS (AUTH & RATE LIMITING)
========================================================= */

api.interceptors.request.use(
  (config) => {
    if (authToken) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${authToken}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 429) {
      const retryAfter =
        Number(error.response.headers['retry-after']) ||
        error.response.data?.retryAfterSeconds ||
        30;
      const message =
        error.response.data?.message ||
        `Rate limit exceeded. Please wait ${retryAfter}s before retrying.`;

      broadcastRateLimitExceeded({
        status: 429,
        retryAfterSeconds: retryAfter,
        message,
        url: error.config?.url,
      });

      const rateLimitError = new Error(message);
      rateLimitError.name = 'RateLimitError';
      rateLimitError.status = 429;
      rateLimitError.retryAfterSeconds = retryAfter;
      rateLimitError.isRateLimited = true;
      return Promise.reject(rateLimitError);
    }
    return Promise.reject(error);
  }
);

/* =========================================================
   API BASE URL
========================================================= */

export const setApiBaseUrl = (url) => {
  if (!url) return;

  API_BASE_URL = url;
  api.defaults.baseURL = url;
};

export const setAuthToken = (token) => {
  authToken = token || null;

  if (typeof localStorage !== 'undefined') {
    if (token) {
      localStorage.setItem('menza_token', token);
    } else {
      localStorage.removeItem('menza_token');
    }
  }
};

export const getAuthToken = () => authToken;

/* =========================================================
   DEVICE ID
========================================================= */

export const getDeviceId = () => {
  if (typeof localStorage === 'undefined') {
    return 'dev_server_test';
  }

  let devId = localStorage.getItem('menza_device_id');

  if (!devId) {
    devId =
      'dev_' +
      Math.random().toString(36).substring(2, 11) +
      '_' +
      Date.now().toString(36);

    localStorage.setItem('menza_device_id', devId);
  }

  return devId;
};

/* =========================================================
   RESTAURANT ID ENCRYPTION
========================================================= */

export const KNOWN_ENCRYPTED_IDS = {
  1: 'uqQTzsGyDJy4_TBVeYXCfg',
  2: 'NQZ2reN9sW5CZS6DkQ29FA',
  3: '23wyKebRn6V9eo24j8_htQ',
  4: 'VWYmJZnTsQyCyA7ps2VBmw',
  5: 'eUZSapvQWCkXfrrkCOaXew',
};

export const REVERSE_ENCRYPTED_IDS = {
  uqQTzsGyDJy4_TBVeYXCfg: 1,
  NQZ2reN9sW5CZS6DkQ29FA: 2,
  '23wyKebRn6V9eo24j8_htQ': 3,
  VWYmJZnTsQyCyA7ps2VBmw: 4,
  eUZSapvQWCkXfrrkCOaXew: 5,
};

export const encryptRestaurantId = (restaurantId) => {
  const num = Number(restaurantId) || 1;

  if (KNOWN_ENCRYPTED_IDS[num]) {
    return KNOWN_ENCRYPTED_IDS[num];
  }

  const rawStr = `MenzaSalt2026_${num}_Key`;

  try {
    return (
      'enc_' +
      btoa(rawStr)
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
    );
  } catch (error) {
    return `enc_${num}`;
  }
};

export const decryptRestaurantId = (encryptedId) => {
  if (!encryptedId) return 1;

  const cleanStr = String(encryptedId).trim();

  if (REVERSE_ENCRYPTED_IDS[cleanStr]) {
    return REVERSE_ENCRYPTED_IDS[cleanStr];
  }

  try {
    let clean = cleanStr
      .replace(/^enc_/, '')
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    while (clean.length % 4 !== 0) {
      clean += '=';
    }

    const decodedStr = atob(clean);

    const match = decodedStr.match(
      /MenzaSalt2026_(\d+)_Key/
    );

    if (match && match[1]) {
      return Number(match[1]);
    }
  } catch (error) {}

  return 1;
};

/* =========================================================
   AUTH (STAFF)
========================================================= */

export const generateOtp = async (
  mobile,
  deviceId
) => {
  const cleanMobile = String(mobile || '').replace(/\D/g, '').slice(-10);
  consumeRateLimit('OTP_GENERATE', cleanMobile || getDeviceId());

  const res = await api.post(
    '/api/Auth/GenerateOtp',
    {
      mobileNumber: cleanMobile,
      mobile: cleanMobile,
      deviceId: deviceId || getDeviceId(),
    }
  );

  return res.data;
};

export const resendOtp = async (
  mobile,
  deviceId
) => {
  const cleanMobile = String(mobile || '').replace(/\D/g, '').slice(-10);
  consumeRateLimit('OTP_GENERATE', cleanMobile || getDeviceId());

  const res = await api.post(
    '/api/Auth/ResendOtp',
    {
      mobileNumber: cleanMobile,
      mobile: cleanMobile,
      deviceId: deviceId || getDeviceId(),
    }
  );

  return res.data;
};

export const loginWithOtp = async (
  mobile,
  otpCode
) => {
  const cleanMobile = String(mobile || '').replace(/\D/g, '').slice(-10);
  consumeRateLimit('OTP_VERIFY', cleanMobile || getDeviceId());

  const res = await api.post(
    '/api/Auth/Login',
    {
      mobileNumber: cleanMobile,
      mobile: cleanMobile,
      otpCode,
      otp: otpCode,
      deviceId: getDeviceId(),
    }
  );

  if (res.data?.token) {
    setAuthToken(res.data.token);
  }

  if (res.data?.accessToken) {
    setAuthToken(res.data.accessToken);
  }

  return res.data;
};

/* =========================================================
   CUSTOMER OTP & LOGIN
========================================================= */

export const generateCustomerOtp = async (
  mobile,
  restaurantId = null,
  encryptedRestaurantId = null
) => {
  const cleanMobile = String(mobile || '').replace(/\D/g, '').slice(-10);
  const deviceId = getDeviceId();

  consumeRateLimit('OTP_GENERATE', cleanMobile || deviceId);

  try {
    const res = await api.post(
      '/api/public/store/auth/generate-otp',
      {
        mobileNumber: cleanMobile,
        mobile: cleanMobile,
        deviceId,
        restaurantId,
        encryptedRestaurantId,
      }
    );
    return res.data;
  } catch (err) {
    if (err.isRateLimited) throw err;
    // Fallback to /api/Auth/GenerateOtp
    const res = await api.post(
      '/api/Auth/GenerateOtp',
      {
        mobileNumber: cleanMobile,
        mobile: cleanMobile,
        deviceId,
      }
    );
    return res.data;
  }
};

export const verifyCustomerOtpAndLogin = async (
  mobile,
  otpCode,
  name = '',
  restaurantId = null,
  encryptedRestaurantId = null
) => {
  const cleanMobile = String(mobile || '').replace(/\D/g, '').slice(-10);
  const deviceId = getDeviceId();

  consumeRateLimit('OTP_VERIFY', cleanMobile || deviceId);

  try {
    const res = await api.post(
      '/api/public/store/auth/verify-otp',
      {
        mobileNumber: cleanMobile,
        mobile: cleanMobile,
        otpCode,
        otp: otpCode,
        name,
        deviceId,
        restaurantId,
        encryptedRestaurantId,
      }
    );

    if (res.data?.token) {
      setAuthToken(res.data.token);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(
          'menza_customer_user',
          JSON.stringify(res.data)
        );
      }
    }

    return res.data;
  } catch (err) {
    if (err.isRateLimited) throw err;
    // Fallback to /api/Auth/Login
    const res = await api.post(
      '/api/Auth/Login',
      {
        mobileNumber: cleanMobile,
        mobile: cleanMobile,
        otpCode,
        otp: otpCode,
        name,
        deviceId,
        restaurantId,
      }
    );

    if (res.data?.token) {
      setAuthToken(res.data.token);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(
          'menza_customer_user',
          JSON.stringify(res.data)
        );
      }
    }

    return res.data;
  }
};

export const getSavedCustomer = () => {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem('menza_customer_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const clearCustomerAuth = () => {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('menza_customer_user');
    localStorage.removeItem('menza_token');
  }
  setAuthToken(null);
};

export const getMyRestaurants = async () => {
  try {
    const res = await api.get(
      '/api/Auth/MyRestaurants'
    );

    return res.data || [];
  } catch (error) {
    console.error(
      'getMyRestaurants error:',
      error
    );

    return [];
  }
};

export const switchRestaurant = async (
  restaurantId
) => {
  const res = await api.post(
    '/api/Auth/SwitchRestaurant',
    {
      restaurantId,
    }
  );

  return res.data;
};

/* =========================================================
   ORDER TYPES
========================================================= */

export const getOrderTypes = async (restaurantId = null) => {
  try {
    const url =
      restaurantId && Number(restaurantId) > 0
        ? `/api/OrderTypeMaster/restaurant/${restaurantId}/active`
        : '/api/OrderTypeMaster';

    const res = await api.get(url);

    if (
      Array.isArray(res.data) &&
      res.data.length > 0
    ) {
      return res.data.filter(
        (t) => t.isActive !== false
      );
    }
  } catch (error) {
    try {
      const fallbackRes = await api.get('/api/Order/Types');
      if (
        fallbackRes.data &&
        Array.isArray(fallbackRes.data) &&
        fallbackRes.data.length > 0
      ) {
        return fallbackRes.data.filter((t) => t.isActive !== false);
      }
    } catch {
      console.log(
        'OrderType API unavailable, using fallback.'
      );
    }
  }

  return [
    {
      id: 1,
      typeName: 'Dine-In',
      description: 'Dine-In order type',
    },
    {
      id: 2,
      typeName: 'Self Pickup',
      description: 'Self Pickup / Takeaway',
    },
    {
      id: 3,
      typeName: 'Delivery',
      description: 'Delivery order type',
    },
    {
      id: 4,
      typeName: 'Counter POS Ordering',
      description: 'Express counter POS order processing',
    },
  ];
};

/* =========================================================
   IMAGE URL & DEFAULTS
========================================================= */

export const IMAGE_NOT_AVAILABLE =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'><rect width='400' height='300' fill='%230f172a'/><rect x='2' y='2' width='396' height='296' rx='8' fill='none' stroke='%23334155' stroke-width='1.5'/><g transform='translate(200, 115)' text-anchor='middle'><rect x='-30' y='-30' width='60' height='60' rx='14' fill='%231e293b' stroke='%23334155' stroke-width='1.5'/><path d='M-14 -6 L-14 12 L14 12 L14 -6 Z' fill='none' stroke='%2364748b' stroke-width='2' stroke-linejoin='round'/><circle cx='-6' cy='-1' r='2.5' fill='%2364748b'/><path d='M-14 8 L-7 1 L0 7 L6 2 L14 8' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/><line x1='-18' y1='-18' x2='18' y2='18' stroke='%23ef4444' stroke-width='2.5' stroke-linecap='round'/><text y='56' fill='%2394a3b8' font-family='sans-serif' font-size='13' font-weight='600'>Image Not Available</text></g></svg>";

export const DEFAULT_ITEM_IMAGE = IMAGE_NOT_AVAILABLE;

export const DEFAULT_VEG_IMAGE =
  'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600';

export const DEFAULT_NON_VEG_IMAGE =
  'https://images.unsplash.com/photo-1544025162-d76694265947?w=600';

export const getDefaultItemImage = () => {
  return IMAGE_NOT_AVAILABLE;
};

const AZURE_BLOB_BASE =
  'https://screstdev.blob.core.windows.net/sarest/';

export const getOriginalImageUrl = (url) => {
  if (!url || typeof url !== 'string') {
    return '';
  }

  const trimmed = url.trim().replace(/^["']|["']$/g, '');

  if (
    !trimmed ||
    trimmed === 'null' ||
    trimmed === 'undefined'
  ) {
    return '';
  }

  // If already an absolute URL
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:')
  ) {
    // Correct legacy misspelled domain if present
    if (trimmed.includes('sarestaurantdev.blob.core.windows.net')) {
      return trimmed
        .replace('sarestaurantdev.blob.core.windows.net/screstdev/', 'screstdev.blob.core.windows.net/sarest/')
        .replace('sarestaurantdev.blob.core.windows.net/', 'screstdev.blob.core.windows.net/sarest/');
    }

    // Correct swapped storage account/container if present
    if (trimmed.includes('screstdev.blob.core.windows.net/screstdev/')) {
      return trimmed.replace('screstdev.blob.core.windows.net/screstdev/', 'screstdev.blob.core.windows.net/sarest/');
    }

    return trimmed;
  }

  let cleanPath = trimmed.replace(/^\/+/, '');

  if (cleanPath.startsWith('sarest/')) {
    cleanPath = cleanPath.substring('sarest/'.length);
  } else if (cleanPath.startsWith('screstdev/')) {
    cleanPath = cleanPath.substring('screstdev/'.length);
  }

  return `${AZURE_BLOB_BASE}${cleanPath}`;
};

export const getItemImageUrl = (imageUrl, isVeg = true) => {
  const original = getOriginalImageUrl(imageUrl);
  if (original) return original;
  return getDefaultItemImage(isVeg);
};

/* =========================================================
   UNIT DESCRIPTION HELPER
========================================================= */

export const getUnitDescription = (item) => {
  if (!item) return 'Piece';

  // 1. Direct text fields from API
  const direct =
    item.unitName ||
    item.unitDescription ||
    item.unitTypeName ||
    item.unitTitle ||
    item.unitOfMeasure ||
    item.uom ||
    item.unit_name ||
    item.unit?.name ||
    item.unit?.unitName ||
    item.unit?.description ||
    item.unit?.title;

  if (direct && typeof direct === 'string' && isNaN(Number(direct.trim()))) {
    return direct.trim();
  }

  // 2. Unit property itself if it's already a descriptive string
  if (typeof item.unit === 'string' && item.unit.trim() !== '' && isNaN(Number(item.unit.trim()))) {
    return item.unit.trim();
  }

  // 3. Map common numeric unit IDs to human-readable descriptions
  const rawId =
    item.unit !== undefined && item.unit !== null
      ? item.unit
      : (item.unitId || item.unitTypeId);
  const numId = Number(rawId);

  if (!isNaN(numId) && numId > 0) {
    switch (numId) {
      case 1:
        return 'Piece';
      case 2:
        return 'Plate';
      case 3:
        return 'Portion';
      case 4:
        return 'Serving';
      case 5:
        return 'Bowl';
      case 6:
        return 'Glass';
      case 7:
        return 'Cup';
      case 8:
        return 'Pack';
      case 9:
        return 'Bottle';
      default:
        return 'Piece';
    }
  }

  return 'Piece';
};

/* =========================================================
   FALLBACK MENU
========================================================= */

const getCuratedFallbackItems = () => [];

/* =========================================================
   NORMALIZE MENU
========================================================= */

const normalizeCatalogData = (
  data,
  fallbackRestId,
  encToken = ''
) => {
  if (!data) return null;

  const rawItems = Array.isArray(data.items)
    ? data.items
    : data.items?.items ||
      data.items?.Items ||
      [];

  const actualRestId =
    data.restaurantId ||
    fallbackRestId ||
    1;

  const actualEncId =
    data.encryptedRestaurantId ||
    encToken ||
    encryptRestaurantId(actualRestId);

  const normalizedItems = rawItems.map(
    (item) => ({
      ...item,

      itemId:
        item.itemId ||
        item.id,

      itemName:
        item.itemName ||
        item.name ||
        'Unnamed Dish',

      categoryId:
        item.categoryId ||
        item.category?.id ||
        1,

      description:
        item.itemDescription ||
        item.description ||
        '',

      price:
        item.amount !== undefined
          ? Number(item.amount)
          : Number(item.price || 0),

      amount:
        item.amount !== undefined
          ? Number(item.amount)
          : Number(item.price || 0),

      isVeg:
        item.isVeg !== undefined
          ? item.isVeg
          : true,

      isAvailable:
        item.isAvailable !== undefined
          ? item.isAvailable
          : true,

      imageUrl: getItemImageUrl(
        item.imageUrl ||
          item.ImageURL ||
          item.image ||
          item.photoUrl ||
          item.img,
        item.isVeg !== undefined ? item.isVeg : true
      ),

      preparationTimeMinutes:
        item.preparationTimeMinutes !== undefined && item.preparationTimeMinutes !== null
          ? Number(item.preparationTimeMinutes)
          : item.PreparationTimeMinutes !== undefined && item.PreparationTimeMinutes !== null
          ? Number(item.PreparationTimeMinutes)
          : 15,

      restaurantId:
        actualRestId,
    })
  );

  return {
    restaurantId: actualRestId,

    encryptedRestaurantId:
      actualEncId,

    restaurantName:
      data.restaurantName ||
      data.name ||
      (actualRestId ? `Restaurant #${actualRestId}` : 'Restaurant'),

    restaurantAddress:
      data.restaurantAddress ||
      data.address ||
      [data.address, data.city, data.state].filter(Boolean).join(', ') ||
      '',

    address:
      data.address ||
      data.restaurantAddress ||
      '',

    city:
      data.city ||
      '',

    state:
      data.state ||
      '',

    imageUrl:
      data.imageUrl ||
      data.ImageUrl ||
      data.restaurantImage ||
      data.RestaurantImage ||
      data.restaurantImageUrl ||
      data.RestaurantImageUrl ||
      data.bannerImage ||
      data.bannerUrl ||
      data.image ||
      data.Image ||
      data.storeImage ||
      data.storeImageUrl ||
      '',

    logoUrl:
      data.logoUrl ||
      data.LogoUrl ||
      data.storeImageUrl ||
      data.storeImage ||
      data.logo ||
      data.Logo ||
      data.restaurantLogo ||
      data.RestaurantLogo ||
      data.restaurantLogoUrl ||
      data.RestaurantLogoUrl ||
      data.storeLogo ||
      data.StoreLogo ||
      '',

    isSubscriptionActive:
      data.isSubscriptionActive !==
      undefined
        ? data.isSubscriptionActive
        : true,

    isTableOrderingEnabled:
      data.isTableOrderingEnabled !==
      undefined
        ? data.isTableOrderingEnabled
        : true,

    isTableBookingEnabled:
      data.isTableBookingEnabled !==
      undefined
        ? data.isTableBookingEnabled
        : true,

    isKitchenActive:
      data.isKitchenActive !== undefined
        ? Boolean(data.isKitchenActive)
        : data.IsKitchenActive !== undefined
        ? Boolean(data.IsKitchenActive)
        : data.isLiveKitchenStatusEnabled !== undefined
        ? Boolean(data.isLiveKitchenStatusEnabled)
        : data.IsLiveKitchenStatusEnabled !== undefined
        ? Boolean(data.IsLiveKitchenStatusEnabled)
        : true,

    isLiveKitchenStatusEnabled:
      data.isKitchenActive !== undefined
        ? Boolean(data.isKitchenActive)
        : data.IsKitchenActive !== undefined
        ? Boolean(data.IsKitchenActive)
        : data.isLiveKitchenStatusEnabled !== undefined
        ? Boolean(data.isLiveKitchenStatusEnabled)
        : data.IsLiveKitchenStatusEnabled !== undefined
        ? Boolean(data.IsLiveKitchenStatusEnabled)
        : true,

    tables:
      Array.isArray(data.tables) &&
      data.tables.length > 0
        ? data.tables
        : Array.isArray(data.availableTables)
        ? data.availableTables
        : [],

    categories:
      Array.isArray(data.categories) &&
      data.categories.length > 0
        ? data.categories.map((c) => ({
            ...c,
            categoryId:
              c.id ||
              c.categoryId,
          }))
        : [],

    items: normalizedItems,
  };
};

/* =========================================================
   MENU APIs
========================================================= */

export const getMenuCatalogByEncryptedId =
  async (encryptedRestaurantId) => {
    const cleanEncId = (
      encryptedRestaurantId ||
      encryptRestaurantId(1)
    ).trim();

    let catalogData = null;
    let decryptedRestId = 1;

    try {
      const pubRes = await api.get(
        `/api/public/store/menu?r=${encodeURIComponent(
          cleanEncId
        )}`
      );
      if (
        pubRes?.data &&
        (pubRes.data.restaurantId ||
          pubRes.data.items)
      ) {
        decryptedRestId =
          pubRes.data.restaurantId ||
          decryptRestaurantId(
            cleanEncId
          );
        catalogData = pubRes.data;
      }
    } catch (e) {
      console.log(
        'Public store menu fallback to MenuCatalog:',
        e?.message
      );
    }

    if (!catalogData) {
      try {
        const res = await api.get(
          `/api/MenuCatalog/encrypted/${encodeURIComponent(
            cleanEncId
          )}`
        );
        decryptedRestId =
          res.data?.restaurantId ||
          decryptRestaurantId(cleanEncId);
        catalogData = res.data;
      } catch (err) {
        console.log('MenuCatalog fallback failed:', err?.message);
      }
    }

    const normalized = normalizeCatalogData(
      catalogData || {},
      decryptedRestId,
      cleanEncId
    );

    // Augment with public store profile or RestaurantConfig to ensure full SAS logo and address
    try {
      const profile = await getStoreProfile(cleanEncId, decryptedRestId);
      if (profile) {
        const pLogo =
          profile.logoUrl ||
          profile.LogoUrl ||
          profile.storeImageUrl ||
          profile.storeImage ||
          profile.logo ||
          profile.Logo ||
          profile.restaurantLogo ||
          profile.restaurantLogoUrl ||
          profile.storeLogo;
        if (pLogo) {
          normalized.logoUrl = pLogo;
        }

        const pImg =
          profile.imageUrl ||
          profile.ImageUrl ||
          profile.bannerImage ||
          profile.bannerUrl ||
          profile.image ||
          profile.Image ||
          profile.restaurantImage ||
          profile.restaurantImageUrl ||
          profile.storeImageUrl ||
          profile.storeImage;
        if (pImg) {
          normalized.imageUrl = pImg;
        }

        if (profile.address || profile.Address) {
          normalized.address = profile.address || profile.Address;
        }
        if (profile.city || profile.City) {
          normalized.city = profile.city || profile.City;
        }
        if (profile.state || profile.State) {
          normalized.state = profile.state || profile.State;
        }

        const pAddress =
          profile.restaurantAddress ||
          profile.RestaurantAddress ||
          [
            profile.address || profile.Address,
            profile.city || profile.City,
            profile.state || profile.State,
          ]
            .filter(Boolean)
            .join(', ');
        if (pAddress) {
          normalized.restaurantAddress = pAddress;
        }

        const pName =
          profile.restaurantName ||
          profile.RestaurantName ||
          profile.restName ||
          profile.RestName;
        if (
          pName &&
          (normalized.restaurantName.startsWith('Restaurant #') ||
            !normalized.restaurantName)
        ) {
          normalized.restaurantName = pName;
        }

        if (profile.isKitchenActive !== undefined) {
          normalized.isKitchenActive = Boolean(profile.isKitchenActive);
        } else if (profile.IsKitchenActive !== undefined) {
          normalized.isKitchenActive = Boolean(profile.IsKitchenActive);
        }

        if (profile.isLiveKitchenStatusEnabled !== undefined) {
          normalized.isLiveKitchenStatusEnabled = Boolean(profile.isLiveKitchenStatusEnabled);
        } else if (profile.IsLiveKitchenStatusEnabled !== undefined) {
          normalized.isLiveKitchenStatusEnabled = Boolean(profile.IsLiveKitchenStatusEnabled);
        } else if (normalized.isKitchenActive !== undefined) {
          normalized.isLiveKitchenStatusEnabled = Boolean(normalized.isKitchenActive);
        }
      }
    } catch (profileErr) {
      console.warn('Profile augmentation error:', profileErr?.message);
    }

    return normalized;
  };

export const getStoreProfile = async (encryptedRestaurantId, restaurantId = 1) => {
  try {
    const encParam = encryptedRestaurantId
      ? `r=${encodeURIComponent(encryptedRestaurantId)}`
      : `restaurantId=${restaurantId}`;
    const res = await api.get(`/api/public/store/profile?${encParam}`);
    if (res?.data) {
      return res.data;
    }
  } catch (e) {
    try {
      const rId = Number(restaurantId) || 1;
      let res2 = null;
      try {
        res2 = await api.get(`/api/RestaurantConfig/${rId}/OperatingStatus`);
      } catch {
        res2 = await api.get(`/api/RestaurantConfig/OperatingStatus?restaurantId=${rId}`);
      }
      if (res2?.data) {
        return res2.data?.data ?? res2.data;
      }
    } catch {}
  }
  return null;
};

export const getEncryptedRestaurantIdFromApi =
  async (restaurantId = 1) => {
    const rId =
      Number(restaurantId) || 1;

    try {
      const res = await api.get(
        `/api/MenuCatalog/encrypt-id/${rId}`
      );

      if (
        res.data &&
        res.data.encryptedRestaurantId
      ) {
        KNOWN_ENCRYPTED_IDS[rId] =
          res.data.encryptedRestaurantId;

        REVERSE_ENCRYPTED_IDS[
          res.data.encryptedRestaurantId
        ] = rId;

        return res.data;
      }
    } catch (error) {
      console.log(
        'Encrypted restaurant API fallback:',
        error?.message
      );
    }

    return {
      restaurantId: rId,
      encryptedRestaurantId:
        encryptRestaurantId(rId),
    };
  };

export const getMenuCatalogTree =
  async (restaurantId = 1) => {
    const result =
      await getEncryptedRestaurantIdFromApi(
        restaurantId
      );

    return getMenuCatalogByEncryptedId(
      result.encryptedRestaurantId
    );
  };

export const getCategories =
  async (restaurantId = 1) => {
    const catalog =
      await getMenuCatalogTree(
        restaurantId
      );

    return catalog?.categories || [];
  };

export const getItems =
  async (restaurantId = 1) => {
    const catalog =
      await getMenuCatalogTree(
        restaurantId
      );

    return catalog?.items || [];
  };

/* =========================================================
   LOCAL CART
========================================================= */

let inMemoryCart = null;

const createEmptyCart = () => ({
  userId: 0,
  deviceId: getDeviceId(),
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

const getLocalCart = () => {
  if (inMemoryCart) {
    return inMemoryCart;
  }

  if (
    typeof localStorage !==
    'undefined'
  ) {
    const saved =
      localStorage.getItem(
        'menza_user_cart'
      );

    if (saved) {
      try {
        inMemoryCart =
          JSON.parse(saved);

        return inMemoryCart;
      } catch (error) {}
    }
  }

  inMemoryCart =
    createEmptyCart();

  return inMemoryCart;
};

const saveLocalCart = (cart) => {
  inMemoryCart = cart;

  if (
    typeof localStorage !==
    'undefined'
  ) {
    localStorage.setItem(
      'menza_user_cart',
      JSON.stringify(cart)
    );
  }
};

const recalculateCart = (cart) => {
  const items =
    Array.isArray(cart.items)
      ? cart.items
      : [];

  const subTotal = items.reduce(
    (sum, item) =>
      sum +
      Number(
        item.unitPrice ??
          item.amount ??
          item.price ??
          0
      ) *
        Number(item.quantity || 1),
    0
  );

  const roundedSubTotal =
    Math.round(subTotal * 100) /
    100;

  const discountAmount = Number(cart.discountAmount || 0);
  const taxableAmount = Math.max(0, roundedSubTotal - discountAmount);

  const cgstPercentage =
    cart.cgstPercentage !== undefined ? Number(cart.cgstPercentage) : 2.5;
  const sgstPercentage =
    cart.sgstPercentage !== undefined ? Number(cart.sgstPercentage) : 2.5;

  const cgstAmount =
    Math.round(taxableAmount * (cgstPercentage / 100) * 100) / 100;

  const sgstAmount =
    Math.round(taxableAmount * (sgstPercentage / 100) * 100) / 100;

  const taxAmount =
    Math.round(
      (cgstAmount +
        sgstAmount) *
        100
    ) / 100;

  const platformFee = Number(cart.platformFee || 0);

  const totalAmount =
    Math.round(
      (taxableAmount +
        taxAmount +
        platformFee) *
        100
    ) / 100;

  return {
    ...cart,
    items,
    itemTotal: roundedSubTotal,
    subTotal: roundedSubTotal,
    discountAmount,
    taxableAmount,
    cgstPercentage,
    sgstPercentage,
    gstNumber: cart.gstNumber || null,
    cgstAmount,
    sgstAmount,
    taxAmount,
    totalAmount,
    platformFee,
    hasUnavailableItems:
      items.some(
        (item) =>
          item.isAvailable === false
      ),
  };
};

/* =========================================================
   GET CART
========================================================= */

export const getCart = async () => {
  const localCart =
    getLocalCart();

  try {
    const res = await api.get(
      '/api/Cart',
      {
        params: {
          deviceId: getDeviceId(),
        },
      }
    );

    if (
      res.data &&
      Array.isArray(
        res.data.items
      )
    ) {
      const serverItems =
        res.data.items.map(
          (item) => ({
            itemId:
              item.itemId,

            itemName:
              item.itemName ||
              'Unnamed Dish',

            itemDescription:
              item.itemDescription ||
              '',

            imageUrl:
              getItemImageUrl(
                item.imageUrl,
                item.isVeg !== undefined ? item.isVeg : true
              ),

            quantity:
              Number(
                item.quantity || 1
              ),

            amount:
              Number(
                item.amount || 0
              ),

            unitPrice:
              Number(
                item.unitPrice ??
                  item.amount ??
                  0
              ),

            totalAmount:
              Number(
                item.totalAmount ??
                  Number(
                    item.amount || 0
                  ) *
                    Number(
                      item.quantity ||
                        1
                    )
              ),

            variantId:
              item.variantId ||
              null,

            variantName:
              item.variantName ||
              null,

            variantPrice:
              Number(
                item.variantPrice ||
                  0
              ),

            modifiers:
              Array.isArray(
                item.modifiers
              )
                ? item.modifiers
                : [],

            cookingInstruction:
              item.cookingInstruction ||
              '',

            isAvailable:
              item.isAvailable !==
              undefined
                ? item.isAvailable
                : true,

            restaurantId:
              item.restaurantId ||
              res.data.restaurantId ||
              0,

            unit:
              item.unit || 1,

            unitName:
              item.unitName ||
              getUnitDescription(item),
          })
        );

      const availableOrderTypes =
        Array.isArray(res.data.availableOrderTypes) && res.data.availableOrderTypes.length > 0
          ? res.data.availableOrderTypes
          : localCart.availableOrderTypes || [];

      const updated =
        recalculateCart({
          ...localCart,
          ...res.data,
          items: serverItems,
          gstNumber: res.data.gstNumber ?? localCart.gstNumber ?? null,
          cgstPercentage: res.data.cgstPercentage ?? localCart.cgstPercentage ?? 2.5,
          sgstPercentage: res.data.sgstPercentage ?? localCart.sgstPercentage ?? 2.5,
          cgstAmount: res.data.cgstAmount,
          sgstAmount: res.data.sgstAmount,
          availableOrderTypes,
        });

      saveLocalCart(updated);

      return updated;
    }
  } catch (error) {
    console.log(
      'Cart server sync unavailable:',
      error?.message
    );
  }

  return recalculateCart(
    localCart
  );
};

/* =========================================================
   ADD TO CART
========================================================= */

export const addToCart = async (
  restaurantId,
  itemId,
  quantity = 1,
  options = {}
) => {
  const localCart =
    getLocalCart();

  const currentItems = [
    ...(localCart.items || []),
  ];

  const itemInfo =
    options.item || {};

  const existingIndex =
    currentItems.findIndex(
      (item) =>
        Number(item.itemId) ===
        Number(itemId)
    );

  const unitPrice =
    Number(
      itemInfo.price ??
        itemInfo.amount ??
        options.price ??
        options.amount ??
        0
    );

  const itemName =
    itemInfo.itemName ||
    options.itemName ||
    `Dish #${itemId}`;

  const isItemVeg =
    itemInfo.isVeg !== undefined
      ? itemInfo.isVeg
      : options.isVeg !== undefined
      ? options.isVeg
      : true;

  const imageUrl =
    getItemImageUrl(
      itemInfo.imageUrl ||
        options.imageUrl ||
        '',
      isItemVeg
    );

  const unitName =
    itemInfo.unitName ||
    itemInfo.unitDescription ||
    options.unitName ||
    options.unitDescription ||
    getUnitDescription(itemInfo || options);

  const unitId = Number(
    itemInfo.unit ||
      itemInfo.unitId ||
      options.unit ||
      options.unitId ||
      1
  );

  const finalQuantity = Number(quantity || 1);

  if (existingIndex >= 0) {
    const oldItem =
      currentItems[
        existingIndex
      ];

    const newQty =
      Number(oldItem.quantity || 1) +
      Number(quantity);

    currentItems[
      existingIndex
    ] = {
      ...oldItem,
      quantity: newQty,
      unitName: oldItem.unitName || unitName,
      unitDescription: oldItem.unitDescription || unitName,
      totalAmount:
        Number(
          oldItem.unitPrice ||
            oldItem.amount ||
            unitPrice
        ) * newQty,
    };
  } else {
    currentItems.push({
      itemId:
        Number(itemId),

      itemName,

      itemDescription:
        itemInfo.description ||
        options.description ||
        '',

      imageUrl,

      quantity:
        finalQuantity,

      unitName,

      unitDescription:
        unitName,

      unit:
        unitId,

      unitId,

      unitPrice,

      amount:
        unitPrice,

      totalAmount:
        unitPrice *
        finalQuantity,

      variantId:
        options.variantId ||
        itemInfo.variantId ||
        null,

      variantName:
        options.variantName ||
        itemInfo.variantName ||
        null,

      variantPrice:
        Number(
          options.variantPrice ||
            itemInfo.variantPrice ||
            0
        ),

      modifiers:
        Array.isArray(
          options.modifiers ||
            itemInfo.modifiers
        )
          ? options.modifiers ||
            itemInfo.modifiers
          : [],

      cookingInstruction:
        options.cookingInstruction ||
        '',

      isVeg:
        isItemVeg,

      isAvailable: true,

      restaurantId:
        Number(restaurantId) || 1,
    });
  }

  const updatedCart =
    recalculateCart({
      ...localCart,
      restaurantId:
        Number(restaurantId) ||
        1,
      restaurantName:
        options.restaurantName ||
        localCart.restaurantName ||
        '',
      items:
        currentItems,
    });

  saveLocalCart(
    updatedCart
  );

  /* Background server sync */
  try {
    await api.post(
      '/api/Cart/add',
      {
        restaurantId:
          Number(restaurantId),

        itemId:
          Number(itemId),

        quantity:
          finalQuantity,

        unitName,

        unitId,

        unit:
          unitId,

        variantId:
          options.variantId ||
          null,

        modifierIds:
          options.modifierIds ||
          null,

        cookingInstruction:
          options.cookingInstruction ||
          null,

        deviceId:
          getDeviceId(),
      }
    );
  } catch (error) {
    console.log(
      'Cart add server sync failed:',
      error?.message
    );
  }

  return updatedCart;
};

/* =========================================================
   UPDATE CART QUANTITY
========================================================= */

export const updateCartQuantity =
  async (
    itemId,
    quantity,
    options = {}
  ) => {
    const localCart =
      getLocalCart();

    let items = [
      ...(localCart.items || []),
    ];

    const note =
      typeof options === 'string'
        ? options
        : options?.cookingInstruction ??
          null;

    if (
      Number(quantity) <= 0
    ) {
      items =
        items.filter(
          (item) =>
            Number(item.itemId) !==
            Number(itemId)
        );
    } else {
      items =
        items.map((item) => {
          if (
            Number(item.itemId) ===
            Number(itemId)
          ) {
            const newQty =
              Number(quantity);

            return {
              ...item,
              quantity:
                newQty,
              totalAmount:
                Number(
                  item.unitPrice ||
                    item.amount ||
                    0
                ) * newQty,
              cookingInstruction:
                note !== null
                  ? note
                  : item.cookingInstruction,
            };
          }

          return item;
        });
    }

    const updated =
      recalculateCart({
        ...localCart,
        items,
      });

    saveLocalCart(updated);

    try {
      if (
        Number(quantity) <= 0
      ) {
        await api.delete(
          `/api/Cart/remove/${itemId}`,
          {
            params: {
              deviceId:
                getDeviceId(),
            },
          }
        );
      } else {
        await api.put(
          '/api/Cart/update-quantity',
          {
            itemId:
              Number(itemId),

            quantity:
              Number(quantity),

            cookingInstruction:
              note,

            deviceId:
              getDeviceId(),
          }
        );
      }
    } catch (error) {
      console.log(
        'Cart quantity sync failed:',
        error?.message
      );
    }

    return updated;
  };

/* =========================================================
   REMOVE CART ITEM
========================================================= */

export const removeFromCart =
  async (itemId) => {
    const cart =
      getLocalCart();

    const items =
      (cart.items || [])
        .filter(
          (item) =>
            Number(item.itemId) !==
            Number(itemId)
        );

    const updated =
      recalculateCart({
        ...cart,
        items,
      });

    saveLocalCart(updated);

    try {
      await api.delete(
        `/api/Cart/remove/${itemId}`,
        {
          params: {
            deviceId:
              getDeviceId(),
          },
        }
      );
    } catch (error) {
      console.log(
        'Cart remove sync failed:',
        error?.message
      );
    }

    return updated;
  };

/* =========================================================
   CLEAR CART
========================================================= */

export const clearCart =
  async () => {
    const cleared =
      recalculateCart({
        ...getLocalCart(),
        items: [],
      });

    saveLocalCart(
      cleared
    );

    try {
      await api.delete(
        '/api/Cart/clear',
        {
          params: {
            deviceId:
              getDeviceId(),
          },
        }
      );
    } catch (error) {
      console.log(
        'Cart clear server sync failed:',
        error?.message
      );
    }

    return cleared;
  };

/* =========================================================
   LOCAL ORDERS
========================================================= */

let inMemoryOrders = null;

const getLocalOrders = () => {
  if (inMemoryOrders) {
    return inMemoryOrders;
  }

  if (
    typeof localStorage !==
    'undefined'
  ) {
    const saved =
      localStorage.getItem(
        'menza_local_orders'
      );

    if (saved) {
      try {
        inMemoryOrders =
          JSON.parse(saved);

        return inMemoryOrders;
      } catch (error) {}
    }
  }

  inMemoryOrders = [];

  return inMemoryOrders;
};

const saveLocalOrders = (
  orders
) => {
  inMemoryOrders = orders;

  if (
    typeof localStorage !==
    'undefined'
  ) {
    localStorage.setItem(
      'menza_local_orders',
      JSON.stringify(orders)
    );
  }
};

export const updateLocalOrderStatus = (orderId, orderStatus = null, kitchenStatus = null) => {
  if (!orderId) return;
  const numId = Number(orderId);
  const orders = getLocalOrders();
  let changed = false;
  const updatedOrders = orders.map((o) => {
    if (Number(o.id || o.orderId) === numId) {
      changed = true;
      const targetOrderStatus = orderStatus || o.orderStatus;
      let targetKitchenStatus = kitchenStatus || o.kitchenStatus;
      const stLower = String(targetOrderStatus || '').toLowerCase();
      if (stLower.includes('serve') || stLower.includes('deliver') || stLower.includes('complete') || stLower.includes('settled')) {
        targetKitchenStatus = 'Served';
      }
      return {
        ...o,
        orderStatus: targetOrderStatus,
        kitchenStatus: targetKitchenStatus,
      };
    }
    return o;
  });
  if (changed) {
    saveLocalOrders(updatedOrders);
  }
};

/* =========================================================
   NORMALIZE ORDER
   VERY IMPORTANT FOR TRACKER
========================================================= */

export const normalizeOrder = (
  order
) => {
  if (!order) {
    return null;
  }

  const rawItems =
    Array.isArray(order.items)
      ? order.items
      : [];

  const normalizedItems =
    rawItems.map(
      (item) => {
        const quantity =
          Number(
            item.quantity || 1
          );

        const amount =
          Number(
            item.amount ??
              item.unitPrice ??
              item.price ??
              0
          );

        return {
          itemId:
            item.itemId,

          itemName:
            item.itemName ||
            item.name ||
            'Dish Item',

          quantity,

          amount,

          unitPrice:
            amount,

          unitName:
            item.unitName ||
            item.unit ||
            null,

          totalAmount:
            Number(
              item.totalAmount ??
                amount *
                  quantity
            ),

          cookingInstruction:
            item.cookingInstruction ||
            null,

          preparationTimeMinutes:
            item.preparationTimeMinutes !== undefined && item.preparationTimeMinutes !== null
              ? Number(item.preparationTimeMinutes)
              : item.PreparationTimeMinutes !== undefined && item.PreparationTimeMinutes !== null
              ? Number(item.PreparationTimeMinutes)
              : undefined,
        };
      }
    );

  const calculatedSubtotal =
    normalizedItems.reduce(
      (sum, item) =>
        sum +
        item.amount *
          item.quantity,
      0
    );

  const cgst =
    Math.round(
      calculatedSubtotal *
        0.025 *
        100
    ) / 100;

  const sgst =
    Math.round(
      calculatedSubtotal *
        0.025 *
        100
    ) / 100;

  const calculatedTotal =
    Math.round(
      (calculatedSubtotal +
        cgst +
        sgst) *
        100
    ) / 100;

  const rawPaymentMode = (order.paymentMode || order.paymentMethod || 'CASH').toString().toUpperCase();
  const isOnline = rawPaymentMode.includes('ONLINE') || rawPaymentMode.includes('CASHFREE') || rawPaymentMode.includes('UPI') || order.isOnline === true;
  const paymentStatus = order.paymentStatus || (isOnline ? 'Paid' : 'Pending');
  const isSettled = isOnline || String(paymentStatus).toLowerCase() === 'paid' || order.isSettled === true || Boolean(order.settledDateUtc);
  const paymentType = order.paymentType || (isOnline ? 'Cashfree Online' : 'Counter Cash');
  const deliveryType = order.deliveryType || (order.tableId ? 'Dine-In' : 'Takeaway / Counter');
  const orderStatus = order.orderStatus || order.status || (isOnline ? 'Confirmed' : 'Placed');
  const requiresCashierConfirmation = !isOnline && !isSettled && (orderStatus === 'Placed' || orderStatus === 'Pending');

  return {
    ...order,

    id:
      Number(order.id),

    orderId:
      order.orderId ||
      Number(order.id),

    orderStatus,

    kitchenStatus: (() => {
      const rawKitchen =
        order.kitchenStatus ||
        order.KitchenStatus ||
        order.kitchenOrderStatus ||
        order.KitchenOrderStatus ||
        null;

      const stLower = String(orderStatus || '').toLowerCase();
      // If the master order status is already Served, Delivered, Completed, or Settled, the kitchen CANNOT be Pending
      if (stLower.includes('serve') || stLower.includes('deliver') || stLower.includes('complete') || stLower.includes('settled')) {
        return 'Served';
      }

      if (rawKitchen) {
        const rawLower = String(rawKitchen).toLowerCase();
        if (rawLower.includes('serve') || rawLower.includes('deliver') || rawLower.includes('complete') || rawLower.includes('settled')) return 'Served';
        if (rawLower.includes('ready')) return 'Ready';
        if (rawLower.includes('prep') || rawLower.includes('cook') || rawLower.includes('kitchen')) return 'Preparing';
        if (stLower.includes('ready')) return 'Ready';
        if (stLower.includes('prep') || stLower.includes('cook') || stLower.includes('kitchen')) return 'Preparing';
        if (rawLower.includes('pending') || rawLower.includes('placed') || rawLower.includes('new') || rawLower.includes('created')) {
          if (stLower.includes('confirm')) return 'Confirmed';
          return 'Pending';
        }
        return rawKitchen;
      }

      if (stLower.includes('ready')) return 'Ready';
      if (stLower.includes('prep') || stLower.includes('cook') || stLower.includes('kitchen')) return 'Preparing';
      if (stLower.includes('confirm')) return 'Confirmed';

      if (typeof localStorage !== 'undefined') {
        try {
          const savedRaw = localStorage.getItem('menza_active_order');
          if (savedRaw) {
            const parsed = JSON.parse(savedRaw);
            if (Number(parsed?.id || parsed?.orderId) === Number(order.id || order.orderId) && parsed.kitchenStatus) {
              const savedLower = String(parsed.kitchenStatus).toLowerCase();
              if (savedLower.includes('serve') || savedLower.includes('deliver') || savedLower.includes('complete') || savedLower.includes('settled')) return 'Served';
              return parsed.kitchenStatus;
            }
          }
        } catch {}
      }
      return null;
    })(),

    paymentStatus,

    paymentMode:
      isOnline ? 'ONLINE' : 'CASH',

    paymentType,

    deliveryType,

    isOnline,

    isSettled,

    requiresCashierConfirmation,

    tableName:
      order.tableName ||
      (
        order.tableId
          ? `Table #${order.tableId}`
          : 'Dine In'
      ),

    tableId:
      order.tableId
        ? Number(order.tableId)
        : null,

    items:
      normalizedItems,

    itemTotal:
      Number(
        order.itemTotal ??
          calculatedSubtotal
      ),

    subTotal:
      Number(
        order.subTotal ??
          calculatedSubtotal
      ),

    cgstAmount:
      Number(
        order.cgstAmount ??
          cgst
      ),

    sgstAmount:
      Number(
        order.sgstAmount ??
          sgst
      ),

    taxAmount:
      Number(
        order.taxAmount ??
          cgst + sgst
      ),

    totalAmount:
      Number(
        order.totalAmount ??
          calculatedTotal
      ),

    gstNumber:
      order.gstNumber ||
      null,

    cgstPercentage:
      order.cgstPercentage !== undefined
        ? Number(order.cgstPercentage)
        : 2.5,

    sgstPercentage:
      order.sgstPercentage !== undefined
        ? Number(order.sgstPercentage)
        : 2.5,

    paymentOrderId:
      order.paymentOrderId ||
      order.cashfreeOrderId ||
      null,

    cashfreeOrderId:
      order.cashfreeOrderId ||
      order.paymentOrderId ||
      null,

    createdDateUtc:
      order.createdDateUtc ||
      order.CreatedDateUtc ||
      order.createdAt ||
      order.createdOn ||
      order.orderDate ||
      null,

    estimatedPickupTime:
      order.estimatedPickupTime ||
      order.EstimatedPickupTime ||
      null,

    preparationTimeMinutes:
      order.preparationTimeMinutes !== undefined && order.preparationTimeMinutes !== null
        ? Number(order.preparationTimeMinutes)
        : order.PreparationTimeMinutes !== undefined && order.PreparationTimeMinutes !== null
        ? Number(order.PreparationTimeMinutes)
        : undefined,

    isKitchenActive:
      order.isKitchenActive !== undefined
        ? Boolean(order.isKitchenActive)
        : order.IsKitchenActive !== undefined
        ? Boolean(order.IsKitchenActive)
        : order.isLiveKitchenStatusEnabled !== undefined
        ? Boolean(order.isLiveKitchenStatusEnabled)
        : order.IsLiveKitchenStatusEnabled !== undefined
        ? Boolean(order.IsLiveKitchenStatusEnabled)
        : true,

    isLiveKitchenStatusEnabled:
      order.isKitchenActive !== undefined
        ? Boolean(order.isKitchenActive)
        : order.IsKitchenActive !== undefined
        ? Boolean(order.IsKitchenActive)
        : order.isLiveKitchenStatusEnabled !== undefined
        ? Boolean(order.isLiveKitchenStatusEnabled)
        : order.IsLiveKitchenStatusEnabled !== undefined
        ? Boolean(order.IsLiveKitchenStatusEnabled)
        : true,

    deviceId:
      order.deviceId ||
      getDeviceId(),
  };
};

/* =========================================================
   PLACE ORDER
========================================================= */

export const placeOrder =
  async (orderPayload) => {
    const rateLimitIdentifier =
      orderPayload?.tableId ||
      orderPayload?.mobileNumber ||
      getDeviceId();
    consumeRateLimit('PLACE_ORDER', rateLimitIdentifier);

    const orders =
      getLocalOrders();

    const nextId =
      orders.length > 0
        ? Math.max(
            ...orders.map(
              (o) =>
                Number(o.id) ||
                0
            )
          ) + 1
        : 1001;

    const rawItems =
      Array.isArray(
        orderPayload.items
      )
        ? orderPayload.items
        : [];

    const normalizedItems =
      rawItems.map(
        (item) => {
          const quantity =
            Number(
              item.quantity || 1
            );

          const amount =
            Number(
              item.amount ??
                item.unitPrice ??
                item.price ??
                0
            );

          return {
            itemId:
              item.itemId,

            itemName:
              item.itemName ||
              item.name ||
              'Dish Item',

            quantity,

            amount,

            unitPrice:
              amount,

            totalAmount:
              amount *
              quantity,

            cookingInstruction:
              item.cookingInstruction ||
              null,
          };
        }
      );

    const itemsTotal =
      normalizedItems.reduce(
        (sum, item) =>
          sum +
          item.amount *
            item.quantity,
        0
      );

    const cgst =
      Math.round(
        itemsTotal *
          0.025 *
          100
      ) / 100;

    const sgst =
      Math.round(
        itemsTotal *
          0.025 *
          100
      ) / 100;

    const grandTotal =
      Math.round(
        (itemsTotal +
          cgst +
          sgst) *
          100
      ) / 100;

    const backendItems = normalizedItems.map((item) => ({
      itemId: Number(item.itemId),
      quantity: Number(item.quantity || 1),
      unitId: Number(item.unit || item.unitId || 1),
      cookingInstruction: item.cookingInstruction || null,
    }));

    const returnUrl =
      orderPayload.returnUrl ||
      (typeof window !== 'undefined'
        ? `${window.location.origin}${window.location.pathname}?order_id={order_id}&restaurantId=${
            Number(orderPayload.restaurantId) || 1
          }${orderPayload.tableId ? `&tableId=${orderPayload.tableId}` : ''}`
        : null);

    const publicPlaceOrderPayload = {
      restaurantId: Number(orderPayload.restaurantId) || 1,
      encryptedRestaurantId: orderPayload.encryptedRestaurantId || '',
      tableId: orderPayload.tableId ? Number(orderPayload.tableId) : null,
      tableNumber: orderPayload.tableNumber
        ? String(orderPayload.tableNumber)
        : orderPayload.tableId
        ? String(orderPayload.tableId)
        : null,
      customerName: orderPayload.name || 'Guest Diner',
      customerPhone: orderPayload.mobileNumber || '',
      otpCode: orderPayload.otpCode || null,
      customerUserId: orderPayload.customerUserId || null,
      orderTypeId: Number(orderPayload.orderTypeId || 1),
      deliveryType:
        orderPayload.deliveryType ||
        (orderPayload.tableId ? 'Dine-In' : 'Takeaway / Counter'),
      paymentMode:
        (orderPayload.paymentStatus === 'Paid' || orderPayload.cashfreeOrderId || orderPayload.paymentOrderId)
          ? 'CASHFREE'
          : (orderPayload.paymentMode || (orderPayload.paymentMethod === 'cashfree' ? 'CASHFREE' : 'CASH')),
      paymentType:
        orderPayload.paymentType ||
        ((orderPayload.paymentMode === 'ONLINE' || orderPayload.paymentMode === 'CASHFREE' || orderPayload.paymentMethod === 'cashfree')
          ? 'ONLINE_CASHFREE'
          : 'COUNTER_CASH'),
      remarks: orderPayload.remarks || '',
      source: orderPayload.source || 'QR_DINEIN',
      paymentStatus:
        orderPayload.paymentStatus ||
        (orderPayload.paymentMethod === 'cashfree' ? 'Paid' : 'Pending'),
      orderStatus:
        orderPayload.orderStatus ||
        (orderPayload.paymentMethod === 'cashfree' ? 'Confirmed' : 'Placed'),
      paymentOrderId:
        orderPayload.paymentOrderId ||
        orderPayload.cashfreeOrderId ||
        null,
      cashfreeOrderId:
        orderPayload.cashfreeOrderId ||
        orderPayload.paymentOrderId ||
        null,
      gstNumber: orderPayload.gstNumber || null,
      cgstPercentage: orderPayload.cgstPercentage !== undefined ? Number(orderPayload.cgstPercentage) : 2.5,
      sgstPercentage: orderPayload.sgstPercentage !== undefined ? Number(orderPayload.sgstPercentage) : 2.5,
      cgstAmount: orderPayload.cgstAmount !== undefined ? Number(orderPayload.cgstAmount) : cgst,
      sgstAmount: orderPayload.sgstAmount !== undefined ? Number(orderPayload.sgstAmount) : sgst,
      taxAmount: orderPayload.taxAmount !== undefined ? Number(orderPayload.taxAmount) : (cgst + sgst),
      totalAmount: orderPayload.totalAmount !== undefined ? Number(orderPayload.totalAmount) : grandTotal,
      returnUrl,
      items: backendItems,
    };

    let serverOrderId = null;
    let paymentSessionId = null;
    let paymentLink = null;
    let lastErrorMsg = null;

    try {
      // Primary: Route customer orders to PublicDineInController (/api/public/store/order/place)
      const serverRes = await api.post(
        '/api/public/store/order/place',
        publicPlaceOrderPayload
      );
      if (serverRes?.data && (serverRes.data.orderId || serverRes.data.id)) {
        serverOrderId = Number(serverRes.data.orderId || serverRes.data.id);
        paymentSessionId = serverRes.data.paymentSessionId || null;
        paymentLink = serverRes.data.paymentLink || null;
      }
    } catch (publicErr) {
      console.warn(
        'PublicDineInController /api/public/store/order/place error:',
        publicErr?.response?.data || publicErr?.message
      );
      const publicErrorMsg =
        publicErr?.response?.data?.message ||
        publicErr?.response?.data?.error ||
        publicErr?.response?.data?.title;

      if (publicErrorMsg) {
        throw new Error(publicErrorMsg);
      }
      lastErrorMsg = publicErr?.message || 'Server error';

      try {
        const fallbackRes = await api.post('/api/Order/PlaceOrder', {
          ...publicPlaceOrderPayload,
          name: publicPlaceOrderPayload.customerName,
          mobileNumber: publicPlaceOrderPayload.customerPhone,
        });
        if (fallbackRes?.data && (fallbackRes.data.orderId || fallbackRes.data.id)) {
          serverOrderId = Number(fallbackRes.data.orderId || fallbackRes.data.id);
        }
      } catch (fallbackErr) {
        console.warn('Fallback /api/Order/PlaceOrder error:', fallbackErr?.message);
        const fallbackErrorMsg =
          fallbackErr?.response?.data?.message ||
          fallbackErr?.response?.data?.error ||
          fallbackErr?.response?.data?.title;
        if (fallbackErrorMsg) {
          throw new Error(fallbackErrorMsg);
        }
      }
    }

    if (!serverOrderId) {
      throw new Error(lastErrorMsg || 'Failed to place order on server. Please try again.');
    }

    const assignedId = serverOrderId;

    const newOrder =
      normalizeOrder({
        id: assignedId,

        restaurantId:
          Number(
            orderPayload.restaurantId
          ) || 1,

        name:
          orderPayload.name ||
          'Guest',

        mobileNumber:
          orderPayload.mobileNumber ||
          '',

        tableId:
          orderPayload.tableId
            ? Number(
                orderPayload.tableId
              )
            : null,

        tableName:
          orderPayload.tableId
            ? `Table #${orderPayload.tableId}`
            : 'Takeaway',

        remarks:
          orderPayload.remarks ||
          '',

        orderTypeId:
          Number(
            orderPayload.orderTypeId ||
              1
          ),

        orderStatus:
          orderPayload.orderStatus ||
          'Pending',

        paymentStatus:
          orderPayload.paymentStatus ||
          'Pending',

        paymentMethod:
          orderPayload.paymentMethod ||
          'CASHFREE_SPLIT',

        paymentOrderId:
          orderPayload.paymentOrderId ||
          null,

        items:
          normalizedItems,

        itemTotal:
          itemsTotal,

        subTotal:
          itemsTotal,

        cgstAmount:
          cgst,

        sgstAmount:
          sgst,

        taxAmount:
          cgst + sgst,

        totalAmount:
          Number(
            orderPayload.totalAmount ??
              grandTotal
          ),

        gstNumber:
          orderPayload.gstNumber ||
          null,

        cgstPercentage:
          orderPayload.cgstPercentage !== undefined
            ? Number(orderPayload.cgstPercentage)
            : 2.5,

        sgstPercentage:
          orderPayload.sgstPercentage !== undefined
            ? Number(orderPayload.sgstPercentage)
            : 2.5,

        cashfreeOrderId:
          orderPayload.cashfreeOrderId ||
          orderPayload.paymentOrderId ||
          null,

        paymentOrderId:
          orderPayload.paymentOrderId ||
          orderPayload.cashfreeOrderId ||
          null,

        createdAt:
          new Date().toISOString(),

        deviceId:
          orderPayload.deviceId ||
          getDeviceId(),
      });

    orders.unshift(
      newOrder
    );

    saveLocalOrders(
      orders
    );

    /* Mark dine-in table occupied */
    if (newOrder.tableId) {
      const tables =
        getLocalTables(
          newOrder.restaurantId
        );

      const updatedTables =
        tables.map(
          (table) =>
            table.id ===
            newOrder.tableId
              ? {
                  ...table,
                  status:
                    'Occupied',
                }
              : table
        );

      saveLocalTables(
        newOrder.restaurantId,
        updatedTables
      );
    }

    return {
      success: true,

      orderId:
        newOrder.id,

      order:
        newOrder,

      paymentSessionId,

      paymentLink,

      message:
        `Order #${newOrder.id} placed successfully!`,
    };
  };

/* =========================================================
   GET ACTIVE ORDER BY TABLE
========================================================= */

export const getActiveOrderByTable = async (tableId, restaurantId = null) => {
  if (!tableId) return null;
  try {
    const params = restaurantId ? { restaurantId } : undefined;
    const res = await api.get(`/api/Order/Table/${tableId}/Active`, { params });
    if (res?.data && (res.data.id || res.data.orderId)) {
      return normalizeOrder(res.data);
    }
  } catch (e) {
    // Fallback: check cached local orders
    try {
      const orders = getLocalOrders();
      const found = orders.find(
        (o) =>
          Number(o.tableId) === Number(tableId) &&
          !['Cancelled', 'Settled', 'Completed'].includes(o.orderStatus)
      );
      if (found) return normalizeOrder(found);
    } catch {}
  }
  return null;
};

/* =========================================================
   GET ORDER (Deduplicated with in-flight caching)
========================================================= */

const orderTrackInFlightCache = new Map();

export const getOrder = async (orderId, phone = '') => {
  if (!orderId) return null;

  const cacheKey = `${orderId}_${phone || ''}`;
  const now = Date.now();
  const cached = orderTrackInFlightCache.get(cacheKey);

  // Return existing in-flight promise if called within 2.5 seconds
  if (cached && now - cached.time < 2500) {
    return cached.promise;
  }

  const promise = (async () => {
    try {
      // Primary: Route to PublicDineInController tracking endpoint
      const res = await api.get(
        `/api/public/store/order/track/${orderId}${phone ? `?phone=${encodeURIComponent(phone)}` : ''}`
      );
      if (res?.data && (res.data.orderId || res.data.id)) {
        return normalizeOrder({
          ...res.data,
          id: res.data.orderId || res.data.id,
        });
      }
    } catch (e) {
      try {
        const orderRes = await api.get(`/api/Order/${orderId}`);
        if (orderRes?.data && orderRes.data.id) {
          return normalizeOrder(orderRes.data);
        }
      } catch (orderErr) {
        // Fallback to local
      }
    }

    const orders = getLocalOrders();
    const found = orders.find(
      (order) => Number(order.id) === Number(orderId)
    );

    return found ? normalizeOrder(found) : null;
  })();

  orderTrackInFlightCache.set(cacheKey, { promise, time: now });
  return promise;
};

/* =========================================================
   GET CURRENT DEVICE ORDERS
========================================================= */

export const getMyOrders =
  async () => {
    const deviceId =
      getDeviceId();

    const orders =
      getLocalOrders();

    return orders
      .filter(
        (order) =>
          order.deviceId ===
          deviceId
      )
      .map(
        normalizeOrder
      );
  };

/* =========================================================
   GET LATEST ORDER
========================================================= */

export const getLatestOrder =
  async () => {
    const orders =
      await getMyOrders();

    if (
      !orders ||
      orders.length === 0
    ) {
      return null;
    }

    return orders[0];
  };

/* =========================================================
   GET ALL ORDERS
========================================================= */

export const getAllOrders =
  async () => {
    return getLocalOrders().map(
      normalizeOrder
    );
  };

/* =========================================================
   GET RESTAURANT ORDERS (Active & Past)
========================================================= */

export const getRestaurantOrders = async (restaurantId = null, phone = '') => {
  const deviceId = getDeviceId();
  let serverOrders = [];

  try {
    if (phone) {
      const res = await api.get(
        `/api/public/store/order/customer-orders?phone=${encodeURIComponent(phone)}`
      );
      if (Array.isArray(res?.data)) {
        serverOrders = res.data;
      }
    }
  } catch (e) {}

  if (!serverOrders.length && restaurantId) {
    try {
      const res = await api.get(`/api/Order/Restaurant/${restaurantId}/active`);
      if (Array.isArray(res?.data)) {
        serverOrders = res.data;
      }
    } catch (e) {}
  }

  const localOrders = getLocalOrders();
  const all = [...serverOrders, ...localOrders];
  const uniqueMap = new Map();
  for (const o of all) {
    const id = Number(o.orderId || o.id);
    if (id && !uniqueMap.has(id)) {
      uniqueMap.set(id, normalizeOrder(o));
    }
  }

  return Array.from(uniqueMap.values()).sort(
    (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
  );
};

/* =========================================================
   KITCHEN ORDERS
========================================================= */

export const getKitchenOrders =
  async () => {
    const orders =
      getLocalOrders();

    return orders
      .filter(
        (order) =>
          [
            'Pending',
            'Confirmed',
            'Preparing',
          ].includes(
            order.orderStatus
          )
      )
      .map(
        normalizeOrder
      );
  };
  /* =========================================================
   LIVE KITCHEN ORDER API

   GET:
   /api/Order/Kitchen?restaurantId={restaurantId}

   This is the REAL backend API used for kitchen status.
========================================================= */

export const getLiveKitchenOrder = async (
  restaurantId,
  orderId = null
) => {
  const restId = Number(restaurantId);

  if (!restId || restId <= 0) {
    console.warn(
      'getLiveKitchenOrder: invalid restaurantId',
      restaurantId
    );

    return null;
  }

  try {
    console.log(
      '========================================'
    );

    console.log(
      'LIVE KITCHEN API REQUEST'
    );

    console.log(
      'Restaurant ID:',
      restId
    );

    console.log(
      'Order ID:',
      orderId
    );

    console.log(
      '========================================'
    );

    const response = await api.get(
      '/api/Order/Kitchen',
      {
        params: {
          restaurantId: restId,
        },
      }
    );

    const data = response?.data;

    console.log(
      'LIVE KITCHEN API RESPONSE:',
      data
    );

    if (!data) {
      return null;
    }

    /*
     * Backend may return:
     *
     * [
     *   { orderId: 82, status: "New" }
     * ]
     *
     * OR
     *
     * {
     *   orderId: 82,
     *   status: "New"
     * }
     *
     * OR
     *
     * {
     *   orders: [...]
     * }
     *
     * OR
     *
     * {
     *   data: [...]
     * }
     */

    let kitchenOrders = [];

    if (Array.isArray(data)) {

      kitchenOrders = data;

    } else if (
      Array.isArray(data.orders)
    ) {

      kitchenOrders = data.orders;

    } else if (
      Array.isArray(data.data)
    ) {

      kitchenOrders = data.data;

    } else {

      kitchenOrders = [data];

    }

    /*
     * If we are looking for one specific order,
     * find that order.
     */

    if (
      orderId !== null &&
      orderId !== undefined
    ) {

      const matchedOrder =
        kitchenOrders.find(
          (item) => {

            const backendOrderId =
              item?.orderId ??
              item?.id ??
              item?.orderID ??
              item?.OrderId;

            return (
              Number(backendOrderId) ===
              Number(orderId)
            );

          }
        );

      if (!matchedOrder) {

        console.log(
          'Kitchen order not found:',
          orderId
        );

        return null;
      }

      /*
       * Your Swagger API returns:
       *
       * "status": "New"
       *
       * But other endpoints may return:
       *
       * kitchenStatus
       * kitchenOrderStatus
       * orderStatus
       */

      const status =
        matchedOrder?.kitchenStatus ??
        matchedOrder?.kitchenOrderStatus ??
        matchedOrder?.orderStatus ??
        matchedOrder?.status ??
        'Pending';

      const backendId =
        matchedOrder?.orderId ??
        matchedOrder?.id ??
        matchedOrder?.orderID ??
        matchedOrder?.OrderId ??
        orderId;

      return {

        ...matchedOrder,

        id: Number(
          backendId
        ),

        orderId: Number(
          backendId
        ),

        /*
         * Normalize the backend status into
         * fields used by OrderTrackerModal.
         */

        orderStatus:
          status,

        kitchenStatus:
          status,

      };

    }

    /*
     * No orderId supplied.
     * Return all kitchen orders.
     */

    return kitchenOrders.map(
      (item) => {

        const backendId =
          item?.orderId ??
          item?.id ??
          item?.orderID ??
          item?.OrderId ??
          0;

        const status =
          item?.kitchenStatus ??
          item?.kitchenOrderStatus ??
          item?.orderStatus ??
          item?.status ??
          'Pending';

        return {

          ...item,

          id: Number(
            backendId
          ),

          orderId: Number(
            backendId
          ),

          orderStatus:
            status,

          kitchenStatus:
            status,

        };

      }
    );

  } catch (error) {

    console.warn(
      '========================================'
    );

    console.warn(
      'LIVE KITCHEN API ERROR'
    );

    console.warn(
      'Status:',
      error?.response?.status
    );

    console.warn(
      'Response:',
      error?.response?.data
    );

    console.warn(
      'Message:',
      error?.message
    );

    console.warn(
      '========================================'
    );

    /*
     * Do NOT crash the customer app if this
     * endpoint requires staff/admin authorization.
     */

    return null;
  }
};


/* =========================================================
   LIVE CUSTOMER ORDER TRACKING

   Priority:
   1. GET /api/Order/Kitchen
   2. Existing public order tracking API
========================================================= */

export const getLiveOrderTracking = async (
  orderId,
  restaurantId
) => {
  if (!orderId) {
    return null;
  }

  // 1. Primary: Use dedicated public order tracking endpoint (/api/public/store/order/track/{orderId})
  try {
    const publicOrder = await getOrder(orderId);
    if (publicOrder) {
      return publicOrder;
    }
  } catch (error) {
    console.warn('Public order tracking check failed:', error?.message);
  }

  // 2. Staff/Chef Fallback: Only hit internal /api/Order/Kitchen if staff token exists
  if (authToken && restaurantId) {
    try {
      const kitchenOrder = await getLiveKitchenOrder(restaurantId, orderId);
      if (kitchenOrder) {
        return normalizeOrder(kitchenOrder);
      }
    } catch (e) {
      // Staff endpoint unavailable or unauthorized
    }
  }

  return null;
};

/* =========================================================
   UPDATE ORDER STATUS
========================================================= */

export const updateOrderStatus =
  async (
    orderId,
    status
  ) => {
    const orders =
      getLocalOrders();

    const updated =
      orders.map(
        (order) =>
          Number(order.id) ===
          Number(orderId)
            ? {
                ...order,
                orderStatus:
                  status,
              }
            : order
      );

    saveLocalOrders(
      updated
    );

    return {
      success: true,
      orderId,
      status,
    };
  };

export const updateKitchenOrderStatus =
  async (
    orderId,
    status
  ) => {
    return updateOrderStatus(
      orderId,
      status
    );
  };

/* =========================================================
   ADD ITEM TO EXISTING ORDER
========================================================= */

export const addItemToOrder =
  async (
    orderId,
    itemId,
    quantity = 1,
    amount = 0,
    unitId = 1
  ) => {
    const orders =
      getLocalOrders();

    const index =
      orders.findIndex(
        (order) =>
          Number(order.id) ===
          Number(orderId)
      );

    if (index < 0) {
      return {
        success: false,
      };
    }

    const order =
      orders[index];

    const items = [
      ...(order.items || []),
    ];

    const existingIndex =
      items.findIndex(
        (item) =>
          Number(item.itemId) ===
          Number(itemId)
      );

    if (
      existingIndex >= 0
    ) {
      items[
        existingIndex
      ] = {
        ...items[
          existingIndex
        ],
        quantity:
          Number(
            items[
              existingIndex
            ].quantity || 1
          ) +
          Number(quantity),
      };
    } else {
      items.push({
        itemId:
          Number(itemId),

        itemName:
          `Dish #${itemId}`,

        quantity:
          Number(quantity),

        amount:
          Number(amount),

        unitPrice:
          Number(amount),

        totalAmount:
          Number(amount) *
          Number(quantity),
      });
    }

    const updatedOrder =
      normalizeOrder({
        ...order,
        items,
      });

    orders[index] =
      updatedOrder;

    saveLocalOrders(
      orders
    );

    return {
      success: true,
      order:
        updatedOrder,
    };
  };

/* =========================================================
   CASHFREE PAYMENT
========================================================= */

/*
   IMPORTANT:

   Payment initiation does NOT lose order information anymore.

   We create a local Pending order FIRST.
   Then Cashfree checkout starts.

   Therefore OrderTrackerModal already has:
   - Order ID
   - Items
   - Quantity
   - Price
   - Subtotal
   - CGST
   - SGST
   - Total
   - Pending status
*/

/* ---------------------------------------------------------
   Create pending payment order
--------------------------------------------------------- */

export const createPendingPaymentOrder =
  async (orderPayload) => {
    const result =
      await placeOrder({
        ...orderPayload,

        orderStatus:
          'Pending',

        paymentStatus:
          'Pending',

        paymentMethod:
          'CASHFREE_SPLIT',

        deviceId:
          getDeviceId(),
      });

    return result;
  };

/* ---------------------------------------------------------
   Initiate Cashfree Checkout
--------------------------------------------------------- */

export const initiateCashfreeCheckout =
  async (checkoutData) => {
    const restaurantId =
      Number(
        checkoutData.restaurantId
      ) || 1;

    const amount =
      Number(
        checkoutData.amount || 0
      );

    const customerName =
      checkoutData.customerName ||
      'Customer';

    const customerPhone =
      checkoutData.customerPhone ||
      '9999999999';

    const customerEmail =
      checkoutData.customerEmail ||
      'customer@menza.com';

    const tableNumber =
      checkoutData.tableNumber
        ? String(
            checkoutData.tableNumber
          )
        : '';

    const orderNotes =
      checkoutData.orderNotes ||
      '';

    const deviceId =
      getDeviceId();

    console.log(
      'Cashfree checkout request:',
      {
        restaurantId,
        amount,
        customerName,
        customerPhone,
        tableNumber,
        deviceId,
      }
    );

    const isTableOrdering = checkoutData.isTableOrderingEnabled !== false;
    const effectiveTable = isTableOrdering && tableNumber && String(tableNumber).trim() !== '' && String(tableNumber) !== '0'
      ? String(tableNumber).trim()
      : null;

    const encRestId =
      checkoutData.encryptedRestaurantId ||
      checkoutData.encRestId ||
      encryptRestaurantId(restaurantId);

    let returnUrl = checkoutData.returnUrl;
    if (!returnUrl && typeof window !== 'undefined') {
      const origin = window.location.origin;
      const pathname = window.location.pathname;
      returnUrl = `${origin}${pathname}?order_id={order_id}&r=${encodeURIComponent(encRestId)}${
        effectiveTable ? `&tableId=${encodeURIComponent(effectiveTable)}` : ''
      }`;
    } else if (returnUrl && typeof window !== 'undefined') {
      try {
        const parsed = new URL(returnUrl, window.location.origin);
        parsed.searchParams.delete('restaurantId');
        parsed.searchParams.delete('restId');
        parsed.searchParams.delete('id');
        parsed.searchParams.set('r', encRestId);
        returnUrl = parsed.toString();
      } catch (e) {}
    }

    const res =
      await api.post(
        '/api/CashFreepayment/initiate-checkout',
        {
          restaurantId,

          amount,

          customerName,

          customerPhone,

          customerEmail,

          tableNumber,

          orderNotes,

          returnUrl,

          deviceId,
        }
      );

    return res.data;
  };

/* =========================================================
   VERIFY CASHFREE PAYMENT
========================================================= */

export const verifyCashfreePayment =
  async (orderId) => {
    const res =
      await api.post(
        '/api/CashFreepayment/verify',
        {
          orderId,
        }
      );

    return res.data;
  };

/* =========================================================
   CASHFREE PAYMENT STATUS
========================================================= */

export const getCashfreePaymentStatus =
  async (orderId) => {
    const res =
      await api.get(
        `/api/CashFreepayment/status/${encodeURIComponent(
          orderId
        )}`
      );

    return res.data;
  };


/* =========================================================
   PUBLIC STORE CONFIRM PAYMENT (PublicDineInController)
========================================================= */

export const confirmOrderPayment = async (orderId, paymentOrderId = '') => {
  try {
    const res = await api.post(
      `/api/public/store/order/${orderId}/confirm-payment${
        paymentOrderId ? `?paymentOrderId=${encodeURIComponent(paymentOrderId)}` : ''
      }`
    );
    if (res?.data && (res.data.orderId || res.data.id)) {
      const normalized = normalizeOrder({
        ...res.data,
        id: res.data.orderId || res.data.id,
      });

      // Sync with local orders
      const orders = getLocalOrders();
      const updated = orders.map((o) =>
        Number(o.id) === Number(orderId)
          ? { ...o, paymentStatus: 'SUCCESS', orderStatus: 'Confirmed' }
          : o
      );
      saveLocalOrders(updated);

      return normalized;
    }
  } catch (err) {
    console.warn('Public confirm-payment error:', err?.message);
  }

  return updateOrderPaymentStatus(orderId, 'SUCCESS');
};

/* =========================================================
   PUBLIC STORE CHECKOUT INITIATION (PublicDineInController)
========================================================= */

export const initiatePublicOrderCheckout = async (orderId, returnUrl = null, notifyUrl = null) => {
  const queryParams = new URLSearchParams();
  if (returnUrl) queryParams.set('returnUrl', returnUrl);
  if (notifyUrl) queryParams.set('notifyUrl', notifyUrl);
  const qStr = queryParams.toString() ? `?${queryParams.toString()}` : '';

  const res = await api.post(`/api/public/store/order/${orderId}/checkout${qStr}`);
  return res.data;
};

/* =========================================================
   UPDATE PAYMENT STATUS
========================================================= */

export const updateOrderPaymentStatus =
  async (
    orderId,
    paymentStatus
  ) => {
    const orders =
      getLocalOrders();

    const updated =
      orders.map(
        (order) =>
          Number(order.id) ===
          Number(orderId)
            ? {
                ...order,
                paymentStatus,
                orderStatus:
                  paymentStatus ===
                  'SUCCESS'
                    ? 'Confirmed'
                    : order.orderStatus,
              }
            : order
      );

    saveLocalOrders(
      updated
    );

    return getOrder(
      orderId
    );
  };

/* =========================================================
   TABLES
========================================================= */

const inMemoryTables = {};

const getLocalTables = (
  restaurantId
) => {
  const rId =
    Number(restaurantId) || 1;

  if (
    inMemoryTables[rId]
  ) {
    return inMemoryTables[
      rId
    ];
  }

  const storageKey =
    `menza_tables_${rId}`;

  if (
    typeof localStorage !==
    'undefined'
  ) {
    const saved =
      localStorage.getItem(
        storageKey
      );

    if (saved) {
      try {
        inMemoryTables[
          rId
        ] = JSON.parse(
          saved
        );

        return inMemoryTables[
          rId
        ];
      } catch (error) {}
    }
  }

  return [];
};

const saveLocalTables = (
  restaurantId,
  tables
) => {
  const rId =
    Number(restaurantId) || 1;

  inMemoryTables[
    rId
  ] = tables;

  if (
    typeof localStorage !==
    'undefined'
  ) {
    localStorage.setItem(
      `menza_tables_${rId}`,
      JSON.stringify(
        tables
      )
    );
  }
};

export const getTables =
  async (
    restaurantId = 1
  ) => {
    return getLocalTables(
      restaurantId
    );
  };

export const updateTableStatus =
  async (
    tableId,
    status
  ) => {
    const tables =
      getLocalTables(1);

    const updated =
      tables.map(
        (table) =>
          Number(table.id) ===
          Number(tableId)
            ? {
                ...table,
                status,
              }
            : table
      );

    saveLocalTables(
      1,
      updated
    );

    return {
      success: true,
      tableId,
      status,
    };
  };

export const callWaiter =
  async (tableId, restaurantId = null, requestType = 'CALL_WAITER', message = '', customerName = '') => {
    consumeRateLimit('CALL_WAITER', String(tableId || 'default'));
    const tId = Number(tableId);
    const rId = restaurantId ? Number(restaurantId) : undefined;
    try {
      const payload = {
        tableId: tId,
        restaurantId: rId,
        requestType: requestType || 'CALL_WAITER',
        message: message || undefined,
        customerName: customerName || undefined
      };
      const response = await api.post('/api/PublicDineIn/service-request', payload);
      const d = response.data || {};
      const fallback = Boolean(d.fallbackToCounter);
      const activeCount = Number(d.activeWaiterCount || 0);
      const tableName = d.tableName || tableId;

      const userMsg = fallback
        ? `Request sent to counter staff. Help is on the way to Table ${tableName}!`
        : `Staff notified (${activeCount > 1 ? `${activeCount} waiters on floor` : 'waiter assigned'}). Help is on the way to Table ${tableName}!`;

      return {
        success: true,
        data: d,
        fallbackToCounter: fallback,
        activeWaiterCount: activeCount,
        message: userMsg,
      };
    } catch (err) {
      // Fallback: try direct Order table endpoint if available
      try {
        if (tId > 0) {
          await api.post(`/api/Order/Table/${tId}/CallWaiter`);
          return {
            success: true,
            message: `Staff has been notified for Table #${tableId}.`,
          };
        }
      } catch {
        // Ignore fallback error and throw original error
      }
      throw err;
    }
  };

export const requestBill =
  async (tableId, restaurantId = null) => {
    consumeRateLimit('REQUEST_BILL', String(tableId || 'default'));
    const tId = Number(tableId);
    const rId = restaurantId ? Number(restaurantId) : undefined;
    try {
      const payload = {
        tableId: tId,
        restaurantId: rId,
        requestType: 'REQUEST_BILL',
        message: 'Guest requested bill at table',
      };
      const response = await api.post('/api/PublicDineIn/service-request', payload);
      const d = response.data || {};
      const fallback = Boolean(d.fallbackToCounter);
      const tableName = d.tableName || tableId;

      const userMsg = fallback
        ? `Pre-bill request sent to counter staff for Table ${tableName}.`
        : `Bill request received for Table ${tableName}. Staff will bring your bill shortly.`;

      return {
        success: true,
        data: d,
        fallbackToCounter: fallback,
        message: userMsg,
      };
    } catch (err) {
      // Fallback: try direct Order table bill request
      try {
        if (tId > 0) {
          const fbRes = await api.post(`/api/Order/Table/${tId}/RequestBill`);
          return {
            success: true,
            message: fbRes.data?.message || `Bill request sent for Table #${tableId}.`,
          };
        }
      } catch {
        // Ignore fallback error and throw original error
      }
      throw err;
    }
  };

export const settleTable =
  async (tableId) => {
    const tId =
      Number(tableId);

    const tables =
      getLocalTables(1);

    const updatedTables =
      tables.map(
        (table) =>
          Number(table.id) ===
          tId
            ? {
                ...table,
                status:
                  'Available',
              }
            : table
      );

    saveLocalTables(
      1,
      updatedTables
    );

    const orders =
      getLocalOrders();

    const updatedOrders =
      orders.map(
        (order) =>
          Number(
            order.tableId
          ) === tId
            ? {
                ...order,
                orderStatus:
                  'Settled',
              }
            : order
      );

    saveLocalOrders(
      updatedOrders
    );

    return {
      success: true,
      message:
        `Table #${tableId} settled successfully.`,
    };
  };

/* =========================================================
   TABLE QR
========================================================= */

export const getTableQrCodes =
  async (
    restaurantId = 1,
    baseUrl =
      typeof window !==
      'undefined'
        ? window.location.origin
        : ''
  ) => {
    const rId =
      Number(restaurantId) || 1;

    const encId =
      encryptRestaurantId(
        rId
      );

    const tables =
      getLocalTables(
        rId
      );

    return tables.map(
      (table) => ({
        tableId:
          table.id,

        tableName:
          table.tableName,

        qrUrl:
          `${baseUrl}/?encRestId=${encId}&tableId=${table.id}`,
      })
    );
  };

export const getStoreOperatingStatus = async (restaurantId = 1) => {
  try {
    const rId = Number(restaurantId) || 1;
    let response = null;
    try {
      response = await api.get(`/api/RestaurantConfig/${rId}/OperatingStatus`);
    } catch (routeErr) {
      response = await api.get(`/api/RestaurantConfig/OperatingStatus?restaurantId=${rId}`);
    }
    const data = response.data?.data ?? response.data;
    if (typeof data === 'string') {
      return {
        restaurantId: rId,
        isOpen: data === 'OPEN',
        status: data,
        canPlaceOrder: data === 'OPEN',
        statusMessage: data === 'OPEN' ? 'Store is open.' : 'Store is closed.',
        isKitchenActive: data !== 'PAUSED',
        isLiveKitchenStatusEnabled: data !== 'PAUSED',
      };
    }
    return data ? {
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
    } : null;
  } catch (e) {
    console.warn('Failed to fetch store operating status:', e?.message);
    return null;
  }
};

/* =========================================================
   ESTIMATED PREPARATION TIME & COUNTDOWN HELPERS
========================================================= */

export const getOrderPreparationTimeMinutes = (order, catalog = null) => {
  if (!order) return 15;

  // 1. Direct order-level preparation time
  if (order.preparationTimeMinutes && Number(order.preparationTimeMinutes) > 0) {
    return Number(order.preparationTimeMinutes);
  }
  if (order.PreparationTimeMinutes && Number(order.PreparationTimeMinutes) > 0) {
    return Number(order.PreparationTimeMinutes);
  }

  // 2. Derive from items
  const rawItems = Array.isArray(order.items) ? order.items : [];
  let maxMinutes = 0;

  for (const it of rawItems) {
    const itPrep = Number(it.preparationTimeMinutes || it.PreparationTimeMinutes || 0);
    if (itPrep > 0) {
      maxMinutes = Math.max(maxMinutes, itPrep);
    } else if (catalog && Array.isArray(catalog.items)) {
      const match = catalog.items.find(
        (ci) => Number(ci.itemId || ci.id) === Number(it.itemId || it.id)
      );
      if (match?.preparationTimeMinutes > 0) {
        maxMinutes = Math.max(maxMinutes, Number(match.preparationTimeMinutes));
      }
    }
  }

  return maxMinutes > 0 ? maxMinutes : 15;
};

export const getOrderTargetEndTimeMs = (order, catalog = null) => {
  if (!order) return null;

  // 1. Direct estimated pickup time from backend
  const pickupTimeStr = order.estimatedPickupTime || order.EstimatedPickupTime;
  if (pickupTimeStr) {
    const pickupMs = new Date(pickupTimeStr).getTime();
    if (!isNaN(pickupMs) && pickupMs > 0) {
      return pickupMs;
    }
  }

  // 2. Base time = creation time or client start time
  const createdStr =
    order.createdDateUtc ||
    order.CreatedDateUtc ||
    order.createdAt ||
    order.createdOn ||
    order.orderDate;

  let baseMs = createdStr ? new Date(createdStr).getTime() : NaN;
  if (isNaN(baseMs) || baseMs <= 0) {
    baseMs = order._clientStartMs || Date.now();
  }

  const prepMinutes = getOrderPreparationTimeMinutes(order, catalog);
  return baseMs + prepMinutes * 60 * 1000;
};

export const isLiveKitchenActive = (order = null, catalog = null, storeOperatingStatus = null) => {
  if (order && order.isKitchenActive !== undefined) return Boolean(order.isKitchenActive);
  if (order && order.IsKitchenActive !== undefined) return Boolean(order.IsKitchenActive);
  if (order && order.isLiveKitchenStatusEnabled !== undefined) return Boolean(order.isLiveKitchenStatusEnabled);
  if (order && order.IsLiveKitchenStatusEnabled !== undefined) return Boolean(order.IsLiveKitchenStatusEnabled);

  if (catalog && catalog.isKitchenActive !== undefined) return Boolean(catalog.isKitchenActive);
  if (catalog && catalog.IsKitchenActive !== undefined) return Boolean(catalog.IsKitchenActive);
  if (catalog && catalog.isLiveKitchenStatusEnabled !== undefined) return Boolean(catalog.isLiveKitchenStatusEnabled);
  if (catalog && catalog.IsLiveKitchenStatusEnabled !== undefined) return Boolean(catalog.IsLiveKitchenStatusEnabled);

  if (storeOperatingStatus && storeOperatingStatus.isKitchenActive !== undefined) return Boolean(storeOperatingStatus.isKitchenActive);
  if (storeOperatingStatus && storeOperatingStatus.IsKitchenActive !== undefined) return Boolean(storeOperatingStatus.IsKitchenActive);
  if (storeOperatingStatus && storeOperatingStatus.isLiveKitchenStatusEnabled !== undefined) return Boolean(storeOperatingStatus.isLiveKitchenStatusEnabled);
  if (storeOperatingStatus && storeOperatingStatus.IsLiveKitchenStatusEnabled !== undefined) return Boolean(storeOperatingStatus.IsLiveKitchenStatusEnabled);

  return true;
};

export const getDecreasingPreparationCountdown = (order, catalog = null, storeOperatingStatus = null) => {
  const isKitchenActive = isLiveKitchenActive(order, catalog, storeOperatingStatus);
  const isKitchenDisabled = !isKitchenActive;

  if (!order) {
    return {
      formatted: isKitchenDisabled ? 'Order received' : '~15 mins remaining',
      shortFormatted: isKitchenDisabled ? 'Received' : '~15m left',
      diffSec: isKitchenDisabled ? 0 : 15 * 60,
      minutes: isKitchenDisabled ? 0 : 15,
      seconds: 0,
      isFinished: false,
      isOverdue: false,
      isAwaitingConfirmation: false,
      isTakeaway: false,
      isKitchenStatusDisabled: isKitchenDisabled,
      statusMessage: isKitchenDisabled ? 'Order received by restaurant.' : 'Estimated preparation: ~15 mins',
    };
  }

  const rawPaymentMode = String(order.paymentMode || order.paymentMethod || '').toUpperCase();
  const isOnline =
    rawPaymentMode.includes('ONLINE') ||
    rawPaymentMode.includes('CASHFREE') ||
    rawPaymentMode.includes('UPI') ||
    order.isOnline === true;
  const isSettled =
    isOnline ||
    String(order.paymentStatus || '').toLowerCase() === 'paid' ||
    order.isSettled === true ||
    Boolean(order.settledDateUtc);

  const orderStatus = String(order.orderStatus || order.status || '').toLowerCase();
  const kitchenStatus = String(order.kitchenStatus || '').toLowerCase();

  const isTakeaway =
    String(order.deliveryType || '').toLowerCase().includes('takeaway') ||
    String(order.deliveryType || '').toLowerCase().includes('counter') ||
    !order.tableId;

  const tokenStr =
    order.pickupToken ||
    (order.tokenNumber ? `TK-${order.tokenNumber}` : `TK-${order.id || ''}`);

  // Phase 3: Served or Settled
  const isFinished =
    orderStatus.includes('serve') ||
    orderStatus.includes('deliver') ||
    orderStatus.includes('complete') ||
    orderStatus.includes('settled') ||
    kitchenStatus.includes('serve') ||
    kitchenStatus.includes('deliver') ||
    kitchenStatus.includes('complete') ||
    kitchenStatus.includes('settled');

  // Ready state
  const isReady = orderStatus.includes('ready') || kitchenStatus.includes('ready');

  // Phase 1: Unconfirmed Cash Orders (Timer PAUSED until cashier approval)
  const isAwaitingConfirmation =
    order.requiresCashierConfirmation === true ||
    (!isOnline &&
      !isSettled &&
      (orderStatus === 'placed' || orderStatus === 'pending') &&
      (!kitchenStatus || kitchenStatus === 'pending' || kitchenStatus === 'new'));

  // If the restaurant opted out of Live Kitchen Status / KDS or kitchen is inactive, return simplified status without ticking timer
  if (isKitchenDisabled) {
    if (isFinished) {
      return {
        formatted: isTakeaway ? 'Order picked up' : 'Order served',
        shortFormatted: isTakeaway ? 'Picked Up' : 'Served',
        diffSec: 0,
        minutes: 0,
        seconds: 0,
        isFinished: true,
        isOverdue: false,
        isAwaitingConfirmation: false,
        isTakeaway,
        isKitchenStatusDisabled: true,
        statusMessage: isTakeaway
          ? 'Order collected. Enjoy your meal!'
          : 'Delivered to your table. Enjoy your feast!',
      };
    }

    if (isReady) {
      const readyMessage = isTakeaway
        ? `Ready! Please collect at counter (Token #${tokenStr})`
        : 'Plated! Server is bringing dishes to your table.';
      return {
        formatted: isTakeaway ? 'Ready for Pickup' : 'Ready to Serve',
        shortFormatted: 'Ready',
        diffSec: 0,
        minutes: 0,
        seconds: 0,
        isFinished: true,
        isOverdue: false,
        isAwaitingConfirmation: false,
        isTakeaway,
        isKitchenStatusDisabled: true,
        statusMessage: readyMessage,
      };
    }

    if (isAwaitingConfirmation) {
      return {
        formatted: 'Awaiting confirmation',
        shortFormatted: 'Awaiting approval',
        diffSec: 0,
        minutes: 0,
        seconds: 0,
        isFinished: false,
        isOverdue: false,
        isAwaitingConfirmation: true,
        isTakeaway,
        isKitchenStatusDisabled: true,
        statusMessage: 'Order received. Awaiting cashier confirmation.',
      };
    }

    return {
      formatted: 'Order confirmed',
      shortFormatted: 'Confirmed',
      diffSec: 0,
      minutes: 0,
      seconds: 0,
      isFinished: false,
      isOverdue: false,
      isAwaitingConfirmation: false,
      isTakeaway,
      isKitchenStatusDisabled: true,
      statusMessage: 'Order confirmed and received by restaurant.',
    };
  }

  if (isFinished) {
    return {
      formatted: isTakeaway ? 'Order picked up' : 'Order served',
      shortFormatted: isTakeaway ? 'Picked Up' : 'Served',
      diffSec: 0,
      minutes: 0,
      seconds: 0,
      isFinished: true,
      isOverdue: false,
      isAwaitingConfirmation: false,
      isTakeaway,
      isKitchenStatusDisabled: false,
      statusMessage: isTakeaway
        ? 'Order collected. Enjoy your meal!'
        : 'Delivered to your table. Enjoy your feast!',
    };
  }

  if (isReady) {
    const readyMessage = isTakeaway
      ? `Ready! Please collect at counter (Token #${tokenStr})`
      : 'Plated! Server is bringing dishes to your table.';
    return {
      formatted: 'Ready to serve!',
      shortFormatted: isTakeaway ? 'Ready for Pickup' : 'Ready to Serve',
      diffSec: 0,
      minutes: 0,
      seconds: 0,
      isFinished: true,
      isOverdue: false,
      isAwaitingConfirmation: false,
      isTakeaway,
      isKitchenStatusDisabled: false,
      statusMessage: readyMessage,
    };
  }

  const prepMinutes = getOrderPreparationTimeMinutes(order, catalog);

  if (isAwaitingConfirmation) {
    return {
      formatted: `~${prepMinutes}m once approved`,
      shortFormatted: 'Awaiting approval',
      diffSec: prepMinutes * 60,
      minutes: prepMinutes,
      seconds: 0,
      isFinished: false,
      isOverdue: false,
      isAwaitingConfirmation: true,
      isTakeaway,
      statusMessage: `Awaiting cashier confirmation (~${prepMinutes}m prep once accepted)`,
    };
  }

  // Phase 2: Active Preparation & Countdown
  const targetMs = getOrderTargetEndTimeMs(order, catalog);

  if (!targetMs) {
    return {
      formatted: `~${prepMinutes} mins remaining`,
      shortFormatted: `~${prepMinutes}m left`,
      diffSec: prepMinutes * 60,
      minutes: prepMinutes,
      seconds: 0,
      isFinished: false,
      isOverdue: false,
      isAwaitingConfirmation: false,
      isTakeaway,
      statusMessage: `Chef is cooking your dishes • ~${prepMinutes}m remaining`,
    };
  }

  const now = Date.now();
  const diffSec = Math.floor((targetMs - now) / 1000);

  if (diffSec <= 0) {
    return {
      formatted: 'Finishing touches...',
      shortFormatted: 'Almost ready!',
      diffSec: 0,
      minutes: 0,
      seconds: 0,
      isFinished: false,
      isOverdue: true,
      isAwaitingConfirmation: false,
      isTakeaway,
      statusMessage: 'Almost ready! Finishing touches in kitchen...',
    };
  }

  const minutes = Math.floor(diffSec / 60);
  const seconds = diffSec % 60;

  const timerText =
    minutes > 0
      ? `${minutes}m ${seconds.toString().padStart(2, '0')}s`
      : `${seconds}s`;

  return {
    formatted: `${timerText} remaining`,
    shortFormatted: `${timerText} left`,
    diffSec,
    minutes,
    seconds,
    isFinished: false,
    isOverdue: false,
    isAwaitingConfirmation: false,
    isTakeaway,
    statusMessage: `Chef is cooking your dishes • ${timerText} remaining`,
  };
};

/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default api;