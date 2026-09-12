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
  totalAmount?: number;
  paymentStatus?: string;
  paymentMode?: string;
  paymentMethod?: string;
  paymentType?: string;
  paymentOrderId?: string;
  cashfreeOrderId?: string;
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
  logoUrl?: string;
  imageUrl?: string;
  isKitchenActive?: boolean;
  categories?: Category[];
  items?: MenuItem[];
  [key: string]: any;
}

export interface StoreOperatingStatus {
  canPlaceOrder?: boolean;
  isKitchenActive?: boolean;
  status?: string;
  remainingPauseMinutes?: number;
  isLiveKitchenStatusEnabled?: boolean;
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
  [key: string]: any;
}
