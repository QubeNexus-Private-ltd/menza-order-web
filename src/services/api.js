import axios from 'axios';

/* =========================================================
   API CONFIG
========================================================= */

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
   AXIOS INTERCEPTOR
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
   AUTH
========================================================= */

export const generateOtp = async (
  mobile,
  deviceId
) => {
  const res = await api.post(
    '/api/Auth/GenerateOtp',
    {
      mobile,
      deviceId: deviceId || getDeviceId(),
    }
  );

  return res.data;
};

export const loginWithOtp = async (
  mobile,
  otpCode
) => {
  const res = await api.post(
    '/api/Auth/Login',
    {
      mobile,
      otpCode,
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

export const getOrderTypes = async () => {
  try {
    const res = await api.get(
      '/api/OrderTypeMaster'
    );

    if (
      Array.isArray(res.data) &&
      res.data.length > 0
    ) {
      return res.data.filter(
        (t) => t.isActive !== false
      );
    }
  } catch (error) {
    console.log(
      'OrderType API unavailable, using fallback.'
    );
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
   IMAGE URL
========================================================= */

const AZURE_BLOB_BASE =
  'https://sarestaurantdev.blob.core.windows.net/screstdev/';

export const getOriginalImageUrl = (url) => {
  if (!url || typeof url !== 'string') {
    return '';
  }

  const trimmed = url.trim();

  if (
    !trimmed ||
    trimmed === 'null' ||
    trimmed === 'undefined'
  ) {
    return '';
  }

  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:')
  ) {
    return trimmed;
  }

  const cleanPath = trimmed.replace(/^\/+/, '');

  if (cleanPath.startsWith('screstdev/')) {
    return `https://sarestaurantdev.blob.core.windows.net/${cleanPath}`;
  }

  return `${AZURE_BLOB_BASE}${cleanPath}`;
};

/* =========================================================
   FALLBACK MENU
========================================================= */

const getCuratedFallbackItems = (
  restaurantId
) => [
  {
    itemId: 101,
    itemName: 'Paneer Tikka Royale',
    categoryId: 1,
    description:
      'Fresh malai paneer cubes marinated in rich tandoori spices and char-grilled.',
    price: 240,
    amount: 240,
    isVeg: true,
    isAvailable: true,
    imageUrl:
      'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=600',
    restaurantId,
  },
  {
    itemId: 102,
    itemName: 'Crispy Veg Spring Rolls',
    categoryId: 1,
    description:
      'Golden fried crispy rolls packed with shredded crunchy vegetables and sweet chili sauce.',
    price: 180,
    amount: 180,
    isVeg: true,
    isAvailable: true,
    imageUrl:
      'https://images.unsplash.com/photo-1544025162-d76694265947?w=600',
    restaurantId,
  },
  {
    itemId: 103,
    itemName: 'Tandoori Chicken Wings',
    categoryId: 1,
    description:
      'Char-grilled chicken wings coated in spicy smoky yogurt tandoor marinade.',
    price: 290,
    amount: 290,
    isVeg: false,
    isAvailable: true,
    imageUrl:
      'https://images.unsplash.com/photo-1527477321055-436158a2b00d?w=600',
    restaurantId,
  },
  {
    itemId: 201,
    itemName: 'Fresh Mint Lime Cooler',
    categoryId: 2,
    description:
      'Refreshing sparkling lemon cooler with muddled mint leaves and crushed ice.',
    price: 90,
    amount: 90,
    isVeg: true,
    isAvailable: true,
    imageUrl:
      'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600',
    restaurantId,
  },
  {
    itemId: 202,
    itemName: 'Royal Alphonso Mango Lassi',
    categoryId: 2,
    description:
      'Thick creamy yogurt shake enriched with sweet Alphonso mango pulp.',
    price: 120,
    amount: 120,
    isVeg: true,
    isAvailable: true,
    imageUrl:
      'https://images.unsplash.com/photo-1553787499-6f9133860278?w=600',
    restaurantId,
  },
  {
    itemId: 203,
    itemName: 'Classic Cold Coffee Frappé',
    categoryId: 2,
    description:
      'Rich dark espresso blended with whole milk and vanilla ice cream.',
    price: 140,
    amount: 140,
    isVeg: true,
    isAvailable: true,
    imageUrl:
      'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=600',
    restaurantId,
  },
  {
    itemId: 301,
    itemName: 'Paneer Butter Masala',
    categoryId: 3,
    description:
      'Soft cottage cheese cubes simmered in a velvety tomato, butter and cashew gravy.',
    price: 320,
    amount: 320,
    isVeg: true,
    isAvailable: true,
    imageUrl:
      'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=600',
    restaurantId,
  },
  {
    itemId: 302,
    itemName: 'Kadai Paneer Special',
    categoryId: 3,
    description:
      'Paneer tossed with crisp bell peppers, onions and roasted coriander.',
    price: 310,
    amount: 310,
    isVeg: true,
    isAvailable: true,
    imageUrl:
      'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=600',
    restaurantId,
  },
  {
    itemId: 401,
    itemName: 'Signature Butter Chicken',
    categoryId: 4,
    description:
      'Tender tandoori chicken cooked in mild creamy butter tomato sauce.',
    price: 380,
    amount: 380,
    isVeg: false,
    isAvailable: true,
    imageUrl:
      'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=600',
    restaurantId,
  },
  {
    itemId: 402,
    itemName: 'Hyderabadi Dum Chicken Biryani',
    categoryId: 4,
    description:
      'Aromatic basmati rice cooked on dum with marinated spicy chicken.',
    price: 350,
    amount: 350,
    isVeg: false,
    isAvailable: true,
    imageUrl:
      'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600',
    restaurantId,
  },
  {
    itemId: 501,
    itemName: 'Butter Garlic Naan',
    categoryId: 5,
    description:
      'Tandoor baked naan topped with roasted garlic and butter.',
    price: 60,
    amount: 60,
    isVeg: true,
    isAvailable: true,
    imageUrl:
      'https://images.unsplash.com/photo-1626074353765-517a681e40be?w=600',
    restaurantId,
  },
  {
    itemId: 502,
    itemName: 'Tandoori Roti (Butter)',
    categoryId: 5,
    description:
      'Whole wheat crisp flatbread freshly baked in clay oven.',
    price: 35,
    amount: 35,
    isVeg: true,
    isAvailable: true,
    imageUrl:
      'https://images.unsplash.com/photo-1626074353765-517a681e40be?w=600',
    restaurantId,
  },
];

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

  let normalizedItems = [];

  if (rawItems.length > 0) {
    normalizedItems = rawItems.map(
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

        imageUrl: getOriginalImageUrl(
          item.imageUrl ||
            item.ImageURL ||
            item.image ||
            item.photoUrl ||
            item.img
        ),

        restaurantId:
          actualRestId,
      })
    );
  } else {
    normalizedItems =
      getCuratedFallbackItems(
        actualRestId
      );
  }

  return {
    restaurantId: actualRestId,

    encryptedRestaurantId:
      actualEncId,

    restaurantName:
      data.restaurantName ||
      `Restaurant #${actualRestId}`,

    restaurantAddress:
      data.restaurantAddress ||
      'Cyber City, Central Hub, Tech Boulevard',

    isSubscriptionActive:
      data.isSubscriptionActive !==
      undefined
        ? data.isSubscriptionActive
        : true,

    categories:
      Array.isArray(data.categories) &&
      data.categories.length > 0
        ? data.categories.map((c) => ({
            ...c,
            categoryId:
              c.id ||
              c.categoryId,
          }))
        : [
            {
              categoryId: 1,
              categoryName: 'Starters',
            },
            {
              categoryId: 2,
              categoryName: 'Beverages',
            },
            {
              categoryId: 3,
              categoryName: 'Paneer Dishes',
            },
            {
              categoryId: 4,
              categoryName: 'Chicken',
            },
            {
              categoryId: 5,
              categoryName: 'Chappati',
            },
          ],

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

    const res = await api.get(
      `/api/MenuCatalog/encrypted/${encodeURIComponent(
        cleanEncId
      )}`
    );

    const decryptedRestId =
      res.data?.restaurantId ||
      decryptRestaurantId(cleanEncId);

    return normalizeCatalogData(
      res.data,
      decryptedRestId,
      cleanEncId
    );
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

  const cgstAmount =
    Math.round(
      roundedSubTotal *
        0.025 *
        100
    ) / 100;

  const sgstAmount =
    Math.round(
      roundedSubTotal *
        0.025 *
        100
    ) / 100;

  const taxAmount =
    Math.round(
      (cgstAmount +
        sgstAmount) *
        100
    ) / 100;

  const totalAmount =
    Math.round(
      (roundedSubTotal +
        taxAmount) *
        100
    ) / 100;

  return {
    ...cart,
    items,
    itemTotal: roundedSubTotal,
    subTotal: roundedSubTotal,
    taxableAmount:
      roundedSubTotal,
    cgstAmount,
    sgstAmount,
    taxAmount,
    totalAmount,
    platformFee:
      Number(cart.platformFee || 0),
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
              getOriginalImageUrl(
                item.imageUrl
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
          })
        );

      const updated =
        recalculateCart({
          ...localCart,
          ...res.data,
          items: serverItems,
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

  const imageUrl =
    getOriginalImageUrl(
      itemInfo.imageUrl ||
        options.imageUrl ||
        ''
    );

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
        Number(quantity),

      unitPrice,

      amount:
        unitPrice,

      totalAmount:
        unitPrice *
        Number(quantity),

      cookingInstruction:
        options.cookingInstruction ||
        '',

      isAvailable: true,

      restaurantId:
        Number(restaurantId) || 1,

      unit: 1,
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
          Number(quantity),

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

/* =========================================================
   NORMALIZE ORDER
   VERY IMPORTANT FOR TRACKER
========================================================= */

const normalizeOrder = (
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

          totalAmount:
            Number(
              item.totalAmount ??
                amount *
                  quantity
            ),

          cookingInstruction:
            item.cookingInstruction ||
            null,
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

  return {
    ...order,

    id:
      Number(order.id),

    orderId:
      order.orderId ||
      Number(order.id),

    orderStatus:
      order.orderStatus ||
      order.status ||
      'Pending',

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

    const newOrder =
      normalizeOrder({
        id: nextId,

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

      message:
        `Order #${newOrder.id} placed successfully!`,
    };
  };

/* =========================================================
   GET ORDER
========================================================= */

export const getOrder =
  async (orderId) => {
    const orders =
      getLocalOrders();

    const found =
      orders.find(
        (order) =>
          Number(order.id) ===
          Number(orderId)
      );

    return found
      ? normalizeOrder(
          found
        )
      : null;
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

  const defaultTables =
    [
      1, 2, 3, 4, 5, 6, 7, 8,
    ].map((id) => ({
      id,
      tableName:
        `Table #${id}`,
      capacity:
        id === 2 ||
        id === 6
          ? 2
          : id === 3
          ? 6
          : id === 5
          ? 8
          : 4,
      status:
        'Available',
      restaurantId:
        rId,
      rId,
    }));

  inMemoryTables[
    rId
  ] = defaultTables;

  return defaultTables;
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
  async (tableId) => ({
    success: true,
    message:
      `Waiter has been notified for Table #${tableId}.`,
  });

export const requestBill =
  async (tableId) => ({
    success: true,
    message:
      `Bill request received for Table #${tableId}.`,
  });

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

/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default api;