export interface MenuItem {
  itemId?: number;
  id?: number;
  itemName?: string;
  name?: string;
  price?: number;
  amount?: number;
  unitPrice?: number;
  totalAmount?: number;
  unit?: number | string;
  unitId?: number;
  unitName?: string;
  unitDescription?: string;
  description?: string;
  imageUrl?: string;
  image?: string;
  isVeg?: boolean;
  isAvailable?: boolean;
  categoryId?: number;
  categoryName?: string;
  variantId?: number;
  variantName?: string;
  modifiers?: any[];
  cookingInstruction?: string;
  preparationTimeMinutes?: number;
  quantity?: number;
  [key: string]: any;
}

export interface OrderItem extends MenuItem {
  quantity: number;
}

export interface Order {
  id?: number | string;
  orderId?: number | string;
  Id?: number | string;
  OrderId?: number | string;
  restaurantId?: number | string;
  encryptedRestaurantId?: string;
  tableId?: number | string | null;
  TableId?: number | string | null;
  encryptedTableId?: string | null;
  tableName?: string;
  tableNumber?: string | number;
  customerName?: string;
  customerPhone?: string;
  mobileNumber?: string;
  maskedMobileNumber?: string;
  items?: OrderItem[];
  orderItems?: OrderItem[];
  OrderItems?: OrderItem[];
  Items?: OrderItem[];
  orderDetails?: OrderItem[];
  subTotal?: number;
  orderAmount?: number;
  itemTotal?: number;
  cgstAmount?: number;
  cgst?: number;
  sgstAmount?: number;
  sgst?: number;
  cgstPercentage?: number;
  sgstPercentage?: number;
  gstNumber?: string;
  taxAmount?: number;
  totalAmount?: number;
  paymentStatus?: string;
  paymentMode?: string;
  paymentMethod?: string;
  paymentType?: string;
  paymentOrderId?: string;
  cashfreeOrderId?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  upiUtr?: string;
  isHomeDelivery?: boolean;
  deliveryAddress?: string | null;
  deliveryFee?: number;
  deliveryGstAmount?: number;
  platformFee?: number;
  fssaiNumber?: string | null;
  stateCode?: string | null;
  orderStatus?: string;
  status?: string;
  kitchenStatus?: string;
  KitchenStatus?: string;
  kitchenOrderStatus?: string;
  isKitchenActive?: boolean;
  IsKitchenActive?: boolean;
  deliveryType?: string;
  remarks?: string;
  createdDateUtc?: string;
  createdAt?: string;
  CreatedDateUtc?: string;
  CreatedAt?: string;
  pickupToken?: string;
  tokenNumber?: string | number;
  TokenNumber?: string | number;
  isOnline?: boolean;
  isSettled?: boolean;
  requiresCashierConfirmation?: boolean;
  deviceId?: string;
  hardwareFingerprint?: string;
  logoUrl?: string;
  restaurantName?: string;
  address?: string;
  city?: string;
  state?: string;
  contactPhone?: string;
  [key: string]: any;
}

export interface Table {
  id?: number;
  tableId?: number;
  tableNumber?: string | number;
  tableName?: string;
  qrCode?: string;
  encryptedTableId?: string;
  status?: string;
  isOccupied?: boolean;
  isLocked?: boolean;
  isCleaning?: boolean;
  isReserved?: boolean;
  occupiedByOther?: boolean;
  capacity?: number;
  [key: string]: any;
}

export interface Category {
  categoryId?: number;
  id?: number;
  categoryName?: string;
  name?: string;
  imageUrl?: string;
  icon?: string;
  items?: MenuItem[];
  [key: string]: any;
}

export interface Catalog {
  restaurantId?: number;
  encryptedRestaurantId?: string;
  restaurantName?: string;
  address?: string;
  city?: string;
  state?: string;
  contactNumber?: string;
  contactPhone?: string;
  gstNumber?: string;
  cgstPercentage?: number;
  sgstPercentage?: number;
  hasGst?: boolean;
  logoUrl?: string;
  imageUrl?: string;
  bannerImageUrl?: string;
  isKitchenActive?: boolean;
  isDeliveryEnabled?: boolean;
  isDineInEnabled?: boolean;
  isSelfPickupEnabled?: boolean;
  deliveryRadiusKm?: number;
  deliveryFee?: number;
  freeDeliveryAbove?: number;
  minDeliveryOrderAmount?: number;
  isPaymentRequiredForDelivery?: boolean;
  allowCashOnDelivery?: boolean;
  isRazorpayEnabled?: boolean;
  razorpay?: boolean;
  razorpayKeyId?: string | null;
  fssaiNumber?: string | null;
  stateCode?: string | null;
  dietaryType?: string;
  cuisines?: string[];
  latitude?: number | null;
  longitude?: number | null;
  avgPrepTimeMinutes?: number;
  ratingAvg?: number;
  ratingCount?: number;
  categories?: Category[];
  items?: MenuItem[];
  bankerUpiId?: string;
  bankerAccountHolderName?: string;
  upiId?: string;
  [key: string]: any;
}

export interface NearbyRestaurantCard {
  restaurantId: number;
  encryptedRestaurantId: string;
  restaurantName: string;
  address?: string | null;
  city?: string | null;
  bannerImageUrl?: string | null;
  logoUrl?: string | null;
  dietaryType?: string | null;
  cuisines?: string[];
  isOpen?: boolean;
  operatingStatus?: string;
  isDeliveryEnabled?: boolean;
  isDineInEnabled?: boolean;
  isSelfPickupEnabled?: boolean;
  distanceKm?: number | null;
  estimatedRoadDistanceKm?: number | null;
  isWithinDeliveryRadius?: boolean;
  deliveryRadiusKm?: number;
  deliveryFee?: number;
  freeDeliveryAbove?: number | null;
  minDeliveryOrderAmount?: number;
  avgPrepTimeMinutes?: number;
  ratingAvg?: number;
  ratingCount?: number;
}

export interface CustomerDeliveryAddress {
  id?: number;
  userId?: number | null;
  deviceId?: string | null;
  mobileNumber?: string | null;
  label: string;
  recipientName?: string | null;
  fullAddress: string;
  houseFlatFloor?: string | null;
  landmark?: string | null;
  city?: string | null;
  pincode?: string | null;
  latitude: number;
  longitude: number;
  isDefault?: boolean;
}

export interface DeliveryServiceabilityResponse {
  isServiceable: boolean;
  isDeliveryEnabled: boolean;
  isPaymentRequiredForDelivery: boolean;
  allowCashOnDelivery: boolean;
  straightDistanceKm: number;
  estimatedRoadDistanceKm: number;
  maxRadiusKm: number;
  deliveryFee: number;
  deliveryGstAmount: number;
  platformFee: number;
  minDeliveryOrderAmount: number;
  minOrderShortfall: number;
  reason?: string | null;
}

export interface StoreOperatingStatus {
  canPlaceOrder?: boolean;
  isKitchenActive?: boolean;
  status?: string;
  remainingPauseMinutes?: number;
  isLiveKitchenStatusEnabled?: boolean;
  requiresCashierConfirmation?: boolean;
  isOnlinePaymentEnabled?: boolean;
  isPayAtCounterEnabled?: boolean;
  isRazorpayEnabled?: boolean;
  razorpay?: boolean;
  paymentGateway?: string;
  [key: string]: any;
}

export interface StaffUser {
  id?: number;
  name?: string;
  email?: string;
  mobile?: string;
  role?: string;
  restaurantId?: number;
  token?: string;
  [key: string]: any;
}

export interface Restaurant {
  id?: number;
  name?: string;
  restaurantName?: string;
  address?: string;
  city?: string;
  phone?: string;
  gstNumber?: string;
  cgstPercentage?: number;
  sgstPercentage?: number;
  [key: string]: any;
}
