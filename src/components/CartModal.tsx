import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  Modal,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import {
  X,
  Plus,
  Minus,
  Trash2,
  ShoppingBag,
  ArrowRight,
  AlertCircle,
  CreditCard,
  IndianRupee,
  ShieldCheck,
  AlertTriangle,
  ImageOff,
  CheckCircle2,
  KeyRound,
  RefreshCw,
  Send,
  Check,
  Utensils,
  Clock,
  Sparkles,
  MapPin,
  LocateFixed,
  Bike,
  Home,
  Briefcase,
} from 'lucide-react';
import * as api from '../services/api';
import { joinOrderGroup } from '../services/signalr';
import { Catalog, Table, StoreOperatingStatus, OrderItem } from '../types';
import { ENV } from '../config/env';
import { logger } from '../services/logger';
import { openRazorpayCheckout } from '../services/razorpayPayment';
import DeliveryLocationMap from './DeliveryLocationMap';

interface ItemImageWithFallbackProps {
  uri?: string;
  isVeg?: boolean;
  style?: any;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
}

function ItemImageWithFallback({
  uri,
  isVeg,
  style,
  resizeMode = 'cover',
}: ItemImageWithFallbackProps) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [uri]);

  const hasValidUri =
    uri &&
    typeof uri === 'string' &&
    uri.trim() !== '' &&
    uri !== api.IMAGE_NOT_AVAILABLE;

  if (!hasValidUri || hasError) {
    return (
      <View style={[style, styles.noImageThumb]}>
        <ImageOff size={18} color="#64748b" />
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={style}
      resizeMode={resizeMode}
      onError={() => setHasError(true)}
    />
  );
}

const getOrderTypeIcon = (typeName?: string): string => {
  const lower = (typeName || '').toLowerCase();

  if (lower.includes('dine')) return '🍽️';

  if (
    lower.includes('pickup') ||
    lower.includes('takeaway') ||
    lower.includes('self')
  ) {
    return '🛍️';
  }

  if (lower.includes('delivery')) return '🛵';

  if (lower.includes('counter') || lower.includes('pos')) {
    return '🧾';
  }

  return '📋';
};

const money = (value: number | string | undefined | null): string => {
  const number = Number(value);

  return Number.isFinite(number)
    ? number.toFixed(2)
    : '0.00';
};

const getQuantityUnitText = (quantity: any, item: any, catalog: any = null): string => {
  const qty = Number(quantity || 1);
  const catalogItem = Array.isArray(catalog?.items)
    ? catalog.items.find((ci: any) => Number(ci.itemId || ci.id) === Number(item?.itemId || item?.id))
    : null;

  let unit =
    item?.unitName ||
    item?.unitDescription ||
    catalogItem?.unitName ||
    catalogItem?.unitDescription;

  if (!unit || !isNaN(Number(unit))) {
    if (typeof api.getUnitDescription === 'function') {
      unit = api.getUnitDescription(item || catalogItem);
    }
  }

  if (!unit || typeof unit !== 'string' || unit.trim() === '') {
    unit = 'no.';
  }

  const cleanUnit = unit.trim();
  const lower = cleanUnit.toLowerCase();

  if (
    lower === 'no.' ||
    lower === 'no' ||
    lower === 'nos' ||
    lower === 'nos.' ||
    lower === 'pc' ||
    lower === 'pcs'
  ) {
    return `${qty}${cleanUnit}`;
  }

  return `${qty} ${cleanUnit}`;
};

/**
 * Probes Cashfree API with timeout to auto-detect whether the paymentSessionId
 * was generated in Cashfree Sandbox or Production.
 * Eliminates "payment_session_id is not present or is invalid" errors caused by mode mismatches.
 */
async function detectCashfreeMode(
  sessionId: string,
  preferredMode: 'sandbox' | 'production' = 'sandbox'
): Promise<'sandbox' | 'production'> {
  if (typeof window === 'undefined' || !sessionId) return preferredMode;

  const testMode = async (mode: 'sandbox' | 'production'): Promise<boolean> => {
    try {
      const url =
        mode === 'production'
          ? 'https://api.cashfree.com/pg/view/sessions/checkout'
          : 'https://sandbox.cashfree.com/pg/view/sessions/checkout';

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1500);

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `payment_session_id=${encodeURIComponent(sessionId)}`,
        signal: controller.signal,
      });

      clearTimeout(timer);
      return res.status === 200;
    } catch {
      return false;
    }
  };

  try {
    const preferredOk = await testMode(preferredMode);
    if (preferredOk) return preferredMode;

    const alternateMode: 'sandbox' | 'production' =
      preferredMode === 'production' ? 'sandbox' : 'production';
    const alternateOk = await testMode(alternateMode);
    if (alternateOk) {
      console.log(`⚡ [Cashfree] Auto-detected environment mismatch: Switching from ${preferredMode} to ${alternateMode}`);
      return alternateMode;
    }
  } catch (e) {
    console.warn('Cashfree mode auto-detection failed, using preferred mode:', e);
  }

  return preferredMode;
}

/**
 * Dynamically ensures Cashfree JS SDK v3 is loaded and available on window.Cashfree
 */
function loadCashfreeSdk(): Promise<any> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Cashfree SDK is only available in browser environments'));
      return;
    }

    if ((window as any).Cashfree) {
      resolve((window as any).Cashfree);
      return;
    }

    const scriptId = 'cashfree-js-sdk-v3';
    let script = document.getElementById(scriptId) as HTMLScriptElement;
    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
      script.async = true;
      document.head.appendChild(script);
    }

    script.onload = () => {
      if ((window as any).Cashfree) {
        resolve((window as any).Cashfree);
      } else {
        reject(new Error('Cashfree SDK script loaded, but window.Cashfree is undefined'));
      }
    };

    script.onerror = () => {
      reject(new Error('Failed to load Cashfree JS SDK from CDN'));
    };
  });
}

export interface CartModalProps {
  visible: boolean;
  onClose: () => void;
  cart?: any;
  cartItems?: OrderItem[] | any[];
  onUpdateCartQuantity?: (itemId: number | string, quantity: number, instruction?: string | null) => Promise<any> | any;
  onRemoveFromCart?: (itemId: number | string) => Promise<any> | any;
  onClearCart?: () => Promise<any> | any;
  onPlaceOrder?: (orderPayload: any) => Promise<any> | any;
  onRefreshCart?: () => Promise<any> | any;
  activeTable?: Table | any;
  catalog?: Catalog | any;
  orderTypes?: any[];
  loading?: boolean;
  storeOperatingStatus?: StoreOperatingStatus | any;
  onOrderConfirmed?: (orderId?: any) => void;
}

export default function CartModal({
  visible,
  onClose,
  cart,
  cartItems = [],
  onUpdateCartQuantity,
  onRemoveFromCart,
  onClearCart,
  onPlaceOrder,
  onRefreshCart,
  activeTable,
  catalog,
  orderTypes = [],
  loading,
  storeOperatingStatus,
  onOrderConfirmed,
}: CartModalProps) {
  // Comprehensive table & dynamic QR detection
  const isDynamicQrFromUrl = typeof window !== 'undefined' && (
    window.location.pathname.includes('/mzt_') ||
    window.location.search.includes('mzt_') ||
    window.location.href.includes('mzt_') ||
    window.location.pathname.toLowerCase().includes('/dinein')
  );

  const isDynamicQr = Boolean(
    isDynamicQrFromUrl ||
    (activeTable && (
      activeTable.qrType === 'TABLE_INSTORE' ||
      activeTable.isTimeBound ||
      (typeof activeTable.tableSessionToken === 'string' && activeTable.tableSessionToken.startsWith('mzt_')) ||
      (typeof activeTable.sessionRemainingSeconds === 'number' && activeTable.sessionRemainingSeconds >= 0)
    ))
  );

  const isTableOrder = Boolean(
    isDynamicQr ||
    Boolean(activeTable && (activeTable.id || activeTable.tableName || activeTable.tableNumber)) ||
    (typeof window !== 'undefined' && (
      window.location.pathname.toLowerCase().includes('/dinein') ||
      new URLSearchParams(window.location.search).has('tableId') ||
      new URLSearchParams(window.location.search).has('t') ||
      new URLSearchParams(window.location.search).has('table') ||
      new URLSearchParams(window.location.search).has('tablenum')
    )) ||
    (typeof localStorage !== 'undefined' && Boolean(localStorage.getItem('menza_last_table_id')))
  );

  const isPostpaidTable = Boolean(activeTable && String(activeTable.dineInPaymentMode || '').toUpperCase() === 'POSTPAID');
  const isPrepaidTable = !isPostpaidTable && Boolean(isTableOrder || isDynamicQr);

  const [gatewayConfig, setGatewayConfig] = useState<{ paymentGateway?: string; isRazorpay?: boolean; isCashfree?: boolean } | null>(null);

  useEffect(() => {
    if (visible) {
      api.getPaymentGatewayConfig().then((cfg) => {
        if (cfg) setGatewayConfig(cfg);
      }).catch(() => {});
    }
  }, [visible]);

  const isRazorpayActive = Boolean(
    catalog?.isRazorpayEnabled ||
    catalog?.razorpay ||
    storeOperatingStatus?.isRazorpayEnabled ||
    storeOperatingStatus?.razorpay ||
    gatewayConfig?.isRazorpay
  );
  const activeOnlineGateway: 'razorpay' | 'cashfree' = isRazorpayActive ? 'razorpay' : 'cashfree';

  const isPayAtCounterOnly = false;

  const [guestName, setGuestName] = useState<string>('');
  const [mobileNumber, setMobileNumber] = useState<string>('');
  const [mobileError, setMobileError] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [orderTypeId, setOrderTypeId] = useState<number>(() => {
    if (isTableOrder || isDynamicQr || activeTable) return 1;
    if (catalog?.isSelfPickupEnabled !== false) return 2;
    if (catalog?.isDeliveryEnabled) return 3;
    return 1;
  });
  const [paymentMethod, setPaymentMethod] = useState<string>('payatcounter');

  const handleMobileNumberChange = (val: string) => {
    const clean = api.sanitizeIndianMobile(val);
    setMobileNumber(clean);
    if (errorMsg) setErrorMsg('');
    if (clean.length > 0 && !/^[6-9]/.test(clean)) {
      setMobileError('Indian mobile number must start with 6, 7, 8, or 9');
    } else if (clean.length > 0 && clean.length < 10) {
      setMobileError('Mobile number must be exactly 10 digits');
    } else {
      setMobileError('');
    }
  };

  useEffect(() => {
    if (isTableOrder || isDynamicQr || activeTable) {
      setOrderTypeId(1);
    }
  }, [isTableOrder, isDynamicQr, activeTable, visible]);

  const [errorMsg, setErrorMsg] = useState<string>('');
  const [processingPayment, setProcessingPayment] = useState<boolean>(false);
  const [submittingOrder, setSubmittingOrder] = useState<boolean>(false);
  const [fetchingCart, setFetchingCart] = useState<boolean>(false);
  const [updatingItemId, setUpdatingItemId] = useState<any>(null);
  const [removingItemId, setRemovingItemId] = useState<any>(null);
  const [clearingCart, setClearingCart] = useState<boolean>(false);
  const [liveOrderTypes, setLiveOrderTypes] = useState<any[]>([]);
  const [orderTypesLoading, setOrderTypesLoading] = useState<boolean>(false);

  // Table orders and Dynamic QRs must strictly default and lock to Dine-In (OrderTypeId: 1)
  useEffect(() => {
    if (isTableOrder || isDynamicQr || activeTable) {
      setOrderTypeId(1);
    }
  }, [isTableOrder, isDynamicQr, activeTable, visible]);

  const allowDeliveryOption = Boolean(
    !isTableOrder &&
    !isDynamicQr &&
    !activeTable &&
    catalog?.isDeliveryEnabled
  );
  const isDeliveryOrder = Boolean(allowDeliveryOption && Number(orderTypeId) === 3);

  // Reset Delivery selection only if delivery is not permitted for the current session
  useEffect(() => {
    if (orderTypeId === 3 && !allowDeliveryOption) {
      setOrderTypeId((isTableOrder || isDynamicQr || activeTable) ? 1 : 2);
    }
  }, [orderTypeId, allowDeliveryOption, isTableOrder, isDynamicQr, activeTable]);

  /* Customer OTP Verification State */
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const [isOtpSent, setIsOtpSent] = useState<boolean>(false);
  const [otpCode, setOtpCode] = useState<string>('');
  const [otpCountdown, setOtpCountdown] = useState<number>(0);
  const [isSendingOtp, setIsSendingOtp] = useState<boolean>(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState<boolean>(false);
  const [otpSuccessMsg, setOtpSuccessMsg] = useState<string>('');
  const [verifiedCustomer, setVerifiedCustomer] = useState<any>(null);

  // Reset modal overlay states on close
  useEffect(() => {
    if (!visible) {
      setProcessingPayment(false);
      setSubmittingOrder(false);
      setErrorMsg('');
    }
  }, [visible]);

  // Check saved customer login on mount or modal open
  useEffect(() => {
    if (!visible) return;
    const saved = api.getSavedCustomer();
    if (saved && (saved.mobile || saved.token)) {
      if (saved.mobile) setMobileNumber(api.sanitizeIndianMobile(saved.mobile));
      if (saved.name && (!guestName || guestName.startsWith('Guest '))) {
        setGuestName(saved.name);
      }
      setIsVerified(true);
      setVerifiedCustomer(saved);
    }
  }, [visible]);

  // Countdown timer effect
  useEffect(() => {
    if (otpCountdown <= 0) return;
    const timer = setInterval(() => {
      setOtpCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [otpCountdown]);

  const handleSendOtp = async () => {
    const cleanMobile = api.sanitizeIndianMobile(mobileNumber);
    if (!api.isValidIndianMobile(cleanMobile)) {
      setErrorMsg('Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.');
      setMobileError('Must be a valid 10-digit Indian mobile number (starts with 6-9)');
      return;
    }

    try {
      setErrorMsg('');
      setMobileError('');
      setOtpSuccessMsg('');
      setIsSendingOtp(true);

      const restId = cart?.restaurantId || catalog?.restaurantId || null;
      const encRestId = catalog?.encryptedRestaurantId || null;

      logger.auth('OTP_REQUESTED', `Customer requested OTP verification for mobile: ${cleanMobile}`, {
        phone: cleanMobile,
        restaurantId: restId,
      });

      await api.generateCustomerOtp(cleanMobile, restId, encRestId);
      setIsOtpSent(true);
      setOtpCountdown(60);
      setOtpSuccessMsg(`OTP sent to +91 ${cleanMobile}`);
    } catch (err: any) {
      console.error('Send OTP error:', err);
      logger.error('AUTH', 'OTP_REQUEST_FAILED', err, { phone: cleanMobile });
      if (err?.isRateLimited) {
        if (err.retryAfterSeconds) {
          setOtpCountdown(err.retryAfterSeconds);
        }
        setErrorMsg(err.message);
      } else {
        setErrorMsg(
          err?.response?.data?.message ||
            err?.message ||
            'Failed to send OTP. Please try again.'
        );
      }
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    const cleanMobile = api.sanitizeIndianMobile(mobileNumber);
    const cleanOtp = otpCode.trim();

    if (!api.isValidIndianMobile(cleanMobile)) {
      setErrorMsg('Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.');
      setMobileError('Must be a valid 10-digit Indian mobile number');
      return;
    }

    if (!cleanOtp || cleanOtp.length < 4) {
      setErrorMsg('Please enter the 6-digit OTP code.');
      return;
    }

    try {
      setErrorMsg('');
      setOtpSuccessMsg('');
      setIsVerifyingOtp(true);

      const restId = cart?.restaurantId || catalog?.restaurantId || null;
      const encRestId = catalog?.encryptedRestaurantId || null;

      logger.auth('OTP_VERIFYING', `Customer submitting OTP for verification`, {
        phone: cleanMobile,
        restaurantId: restId,
      });

      const authData = await api.verifyCustomerOtpAndLogin(
        cleanMobile,
        cleanOtp,
        guestName.trim(),
        restId,
        encRestId
      );

      if (authData) {
        setIsVerified(true);
        setIsOtpSent(false);
        setOtpCode('');
        setVerifiedCustomer(authData);
        if (authData.name && !guestName) {
          setGuestName(authData.name);
        }
        setOtpSuccessMsg('Mobile verified successfully!');
        logger.setCustomerPhone(cleanMobile);
        logger.auth('OTP_VERIFIED', `Customer mobile verified successfully`, {
          phone: cleanMobile,
          customerName: authData.name,
          userId: authData.userId,
        });
      } else {
        logger.warn('AUTH', 'OTP_INVALID', 'Customer entered invalid or expired OTP code', { phone: cleanMobile });
        setErrorMsg('Invalid or expired OTP code.');
      }
    } catch (err: any) {
      console.error('Verify OTP error:', err);
      logger.error('AUTH', 'OTP_VERIFICATION_FAILED', err, { phone: cleanMobile });
      if (err?.isRateLimited) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg(
          err?.response?.data?.message ||
            err?.message ||
            'OTP verification failed. Please try again.'
        );
      }
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleResetVerification = () => {
    api.clearCustomerAuth();
    setIsVerified(false);
    setIsOtpSent(false);
    setOtpCode('');
    setVerifiedCustomer(null);
    setOtpSuccessMsg('');
  };

  // Fetch live OrderTypeMaster from API whenever the modal opens or restaurant changes
  useEffect(() => {
    let mounted = true;

    const fetchOrderTypes = async () => {
      try {
        setOrderTypesLoading(true);
        const restId =
          cart?.restaurantId ||
          catalog?.restaurantId ||
          (typeof window !== 'undefined'
            ? new URLSearchParams(window.location.search).get('restaurantId') ||
              localStorage.getItem('menza_last_rest_id')
            : null);

        const types = await api.getOrderTypes(restId ? Number(restId) : null);

        if (mounted && Array.isArray(types) && types.length > 0) {
          setLiveOrderTypes(types);
        }
      } catch (error) {
        console.warn('Failed to fetch live OrderTypeMaster in CartModal:', error);
      } finally {
        if (mounted) {
          setOrderTypesLoading(false);
        }
      }
    };

    if (visible) {
      fetchOrderTypes();
    }

    return () => {
      mounted = false;
    };
  }, [visible, cart?.restaurantId, catalog?.restaurantId]);

  // Refresh server cart items whenever the modal opens
  useEffect(() => {
    if (!visible || !onRefreshCart) return;

    let mounted = true;

    const refresh = async () => {
      setFetchingCart(true);
      try {
        await onRefreshCart();
      } catch (error) {
        console.warn('Cart refresh warning:', error);
      } finally {
        if (mounted) {
          setFetchingCart(false);
        }
      }
    };

    refresh();

    return () => {
      mounted = false;
    };
  }, [visible]);

  const effectiveOrderTypes = React.useMemo(() => {
    let rawList: any[] = [];
    if (Array.isArray(liveOrderTypes) && liveOrderTypes.length > 0) {
      rawList = liveOrderTypes;
    } else if (Array.isArray(orderTypes) && orderTypes.length > 0) {
      rawList = orderTypes;
    } else if (Array.isArray(cart?.availableOrderTypes) && cart.availableOrderTypes.length > 0) {
      rawList = cart.availableOrderTypes;
    } else {
      rawList = [
        { id: 1, typeName: 'Dine-In', description: 'Dine-In order type' },
        { id: 2, typeName: 'Self Pickup', description: 'Self Pickup / Takeaway' },
        { id: 4, typeName: 'Counter POS Ordering', description: 'Express counter POS order processing' },
      ];
    }

    // Filter order types strictly by restaurant configuration flags
    rawList = rawList.filter((t: any) => {
      const typeName = String(t.typeName || t.name || t.code || '').toLowerCase();
      const desc = String(t.description || '').toLowerCase();
      const tId = Number(t.id);
      const isDelivType = tId === 3 || typeName.includes('delivery') || desc.includes('delivery');
      const isPickupType = tId === 2 || typeName.includes('pickup') || typeName.includes('takeaway');
      const isDineInType = tId === 1 || typeName.includes('dine');

      if (isDelivType && !allowDeliveryOption) {
        return false;
      }
      if (isPickupType && catalog?.isSelfPickupEnabled === false && !isTableOrder && !isDynamicQr && !activeTable) {
        return false;
      }
      if (isDineInType && catalog?.isDineInEnabled === false && !isTableOrder && !isDynamicQr && !activeTable) {
        return false;
      }
      return true;
    });

    if (allowDeliveryOption) {
      const hasDeliveryType = rawList.some(
        (t: any) =>
          Number(t.id) === 3 ||
          String(t.typeName || t.name || t.code || '').toLowerCase().includes('delivery')
      );
      if (!hasDeliveryType) {
        rawList = [
          ...rawList,
          { id: 3, typeName: 'Delivery', description: 'Home delivery from restaurant' },
        ];
      }
    }

    if (isTableOrder || isDynamicQr || activeTable) {
      const hasDineIn = rawList.some((t: any) => t.id === 1 || String(t.typeName || t.name).toLowerCase().includes('dine'));
      if (!hasDineIn) {
        return [
          { id: 1, typeName: 'Dine-In', description: 'Dine-In table ordering' },
          ...rawList,
        ];
      }
      const dineInItem = rawList.find((t: any) => t.id === 1 || String(t.typeName || t.name).toLowerCase().includes('dine'));
      const otherItems = rawList.filter((t: any) => t !== dineInItem);
      return [dineInItem, ...otherItems];
    }
    return rawList;
  }, [liveOrderTypes, orderTypes, cart?.availableOrderTypes, isTableOrder, isDynamicQr, activeTable, allowDeliveryOption, catalog?.isSelfPickupEnabled, catalog?.isDineInEnabled]);

  // Ensure selected orderTypeId always belongs to the restaurant's active configured types
  useEffect(() => {
    if (isTableOrder || isDynamicQr || activeTable) {
      if (orderTypeId !== 1) setOrderTypeId(1);
      return;
    }
    if (!Array.isArray(effectiveOrderTypes) || effectiveOrderTypes.length === 0) return;
    const isValidCurrent = effectiveOrderTypes.some((t: any) => Number(t.id) === Number(orderTypeId));
    if (!isValidCurrent) {
      const preferred =
        effectiveOrderTypes.find((t: any) => Number(t.id) === 2) ||
        effectiveOrderTypes.find((t: any) => Number(t.id) === 3) ||
        effectiveOrderTypes[0];
      if (preferred?.id) {
        setOrderTypeId(Number(preferred.id));
      }
    }
  }, [effectiveOrderTypes, orderTypeId, isTableOrder, isDynamicQr, activeTable]);

  const activeCartItems =
    cart && Array.isArray(cart.items)
      ? cart.items
      : cartItems;

  // Auto-clear cart if table session expires while viewing or using cart
  useEffect(() => {
    if (activeTable && Boolean(activeTable.isSessionExpired) && !Boolean(activeTable.isDiningActive)) {
      if (activeCartItems.length > 0 && onClearCart) {
        onClearCart();
      }
    }
  }, [activeTable?.isSessionExpired, activeTable?.isDiningActive, activeCartItems.length, onClearCart]);

  // Items Subtotal calculated from active items
  const itemsSubTotal = (activeCartItems || []).reduce(
    (sum: number, item: any) =>
      sum +
      (Number(
        item.unitPrice ??
          item.amount ??
          item.price ??
          0
      ) || 0) *
        (Number(item.quantity) || 1),
    0
  );

  const subTotal = Number(cart?.subTotal ?? 0) > 0 ? Number(cart.subTotal) : Math.round(itemsSubTotal * 100) / 100;
  const discountAmount = Number(
    cart?.discountAmount ?? 0
  );
  const taxableAmount = Math.max(0, subTotal - discountAmount);

  // GST calculation rule: If gstNumber is not present, no GST is calculated (0 tax).
  // If gstNumber is present, calculate GST as per restaurant configuration.
  const rawGst = cart?.gstNumber || catalog?.gstNumber || null;
  const cleanGstNumber = typeof rawGst === 'string' && rawGst.trim().length > 0 ? rawGst.trim() : null;
  const hasGst = Boolean(cleanGstNumber);

  const cgstPercentage = hasGst
    ? Number(cart?.cgstPercentage ?? catalog?.cgstPercentage ?? 2.5)
    : 0;
  const sgstPercentage = hasGst
    ? Number(cart?.sgstPercentage ?? catalog?.sgstPercentage ?? 2.5)
    : 0;

  // CGST and SGST calculation: use cart if > 0 and hasGst, otherwise compute from taxableAmount
  const cgst = hasGst
    ? (Number(cart?.cgstAmount ?? 0) > 0
        ? Number(cart.cgstAmount)
        : Math.round(taxableAmount * (cgstPercentage / 100) * 100) / 100)
    : 0;

  const sgst = hasGst
    ? (Number(cart?.sgstAmount ?? 0) > 0
        ? Number(cart.sgstAmount)
        : Math.round(taxableAmount * (sgstPercentage / 100) * 100) / 100)
    : 0;

  const taxAmount = hasGst ? Math.round((cgst + sgst) * 100) / 100 : 0;

  /* Home Delivery Location, Saved Addresses & Serviceability State */
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | 'gps' | null>(null);
  const [deliveryLabel, setDeliveryLabel] = useState<'Home' | 'Work' | 'Other'>('Home');
  const [deliveryAddressText, setDeliveryAddressText] = useState<string>('');
  const [deliveryHouseFlat, setDeliveryHouseFlat] = useState<string>('');
  const [deliveryLandmark, setDeliveryLandmark] = useState<string>('');
  const [deliveryCity, setDeliveryCity] = useState<string>('');
  const [deliveryPincode, setDeliveryPincode] = useState<string>('');
  const [deliveryLat, setDeliveryLat] = useState<number | null>(() => api.getLastCustomerLocation()?.lat ?? null);
  const [deliveryLng, setDeliveryLng] = useState<number | null>(() => api.getLastCustomerLocation()?.lng ?? null);
  const [gpsDetecting, setGpsDetecting] = useState<boolean>(false);
  const [gpsError, setGpsError] = useState<string>('');
  const [showDeliveryMap, setShowDeliveryMap] = useState<boolean>(true);
  const [serviceability, setServiceability] = useState<any>(null);
  const [checkingServiceability, setCheckingServiceability] = useState<boolean>(false);
  const [savingAddress, setSavingAddress] = useState<boolean>(false);

  useEffect(() => {
    if (!visible || !isDeliveryOrder) return;
    let active = true;
    const cleanMob = api.sanitizeIndianMobile(mobileNumber || '');
    api.getCustomerDeliveryAddresses(cleanMob).then((list) => {
      if (!active || !Array.isArray(list)) return;
      setSavedAddresses(list);
      if (list.length > 0 && !selectedAddressId && !deliveryAddressText) {
        const def = list.find((a) => a.isDefault) || list[0];
        if (def) {
          setSelectedAddressId(def.id || null);
          setDeliveryLabel((def.label as any) || 'Home');
          setDeliveryAddressText(def.fullAddress || '');
          setDeliveryHouseFlat(def.houseFlatFloor || '');
          setDeliveryLandmark(def.landmark || '');
          setDeliveryCity(def.city || '');
          setDeliveryPincode(def.pincode || '');
          if (typeof def.latitude === 'number' && typeof def.longitude === 'number') {
            setDeliveryLat(def.latitude);
            setDeliveryLng(def.longitude);
          }
        }
      }
    }).catch(() => {});
    return () => { active = false; };
  }, [visible, isDeliveryOrder]);

  useEffect(() => {
    if (!visible || !isDeliveryOrder) {
      setServiceability(null);
      return;
    }
    if (deliveryLat === null || deliveryLng === null || isNaN(deliveryLat) || isNaN(deliveryLng)) {
      return;
    }
    let active = true;
    setCheckingServiceability(true);
    api.checkDeliveryServiceability({
      encryptedRestaurantId: catalog?.encryptedRestaurantId || '',
      restaurantId: catalog?.restaurantId || null,
      customerLat: deliveryLat,
      customerLng: deliveryLng,
      orderSubTotal: taxableAmount,
    }).then((res) => {
      if (active && res) setServiceability(res);
    }).catch(() => {
      if (active) setServiceability(null);
    }).finally(() => {
      if (active) setCheckingServiceability(false);
    });
    return () => { active = false; };
  }, [visible, isDeliveryOrder, deliveryLat, deliveryLng, taxableAmount, catalog?.encryptedRestaurantId, catalog?.restaurantId]);

  const handleSelectSavedAddress = (addr: any) => {
    setSelectedAddressId(addr.id || null);
    setDeliveryLabel((addr.label as any) || 'Home');
    setDeliveryAddressText(addr.fullAddress || '');
    setDeliveryHouseFlat(addr.houseFlatFloor || '');
    setDeliveryLandmark(addr.landmark || '');
    setDeliveryCity(addr.city || '');
    setDeliveryPincode(addr.pincode || '');
    if (typeof addr.latitude === 'number' && typeof addr.longitude === 'number') {
      setDeliveryLat(addr.latitude);
      setDeliveryLng(addr.longitude);
      setShowDeliveryMap(true);
    }
    setGpsError('');
    setErrorMsg('');
  };

  const applyReverseGeocodedAddressWeb = async (lat: number, lng: number) => {
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`,
        { headers: { Accept: 'application/json' } }
      );
      if (resp.ok) {
        const data = await resp.json();
        const addr = data?.address || {};
        const city = addr.city || addr.town || addr.village || addr.state_district || '';
        const postcode = addr.postcode || '';
        const formatted = data?.display_name || '';
        if (city) setDeliveryCity(city);
        if (postcode) setDeliveryPincode(postcode);
        if (formatted) {
          setDeliveryAddressText((prev) =>
            !prev.trim() || prev.startsWith('Pinned Location') ? formatted : prev
          );
          api.saveLastCustomerLocation({ lat, lng, label: city || 'Pinned GPS Location', city });
          return;
        }
      }
    } catch {}
    setDeliveryAddressText((prev) =>
      !prev.trim() || prev.startsWith('Pinned Location')
        ? `Pinned Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`
        : prev
    );
  };

  const handleMapLocationChange = (lat: number, lng: number) => {
    setSelectedAddressId('gps');
    setDeliveryLat(lat);
    setDeliveryLng(lng);
    setGpsError('');
    setErrorMsg('');
    api.saveLastCustomerLocation({ lat, lng, label: 'Pinned Map Location' });
    applyReverseGeocodedAddressWeb(lat, lng);
  };

  const handleDetectGpsLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsError('Browser GPS is unavailable. Please select a saved address or allow location permissions.');
      return;
    }
    setGpsDetecting(true);
    setGpsError('');
    setShowDeliveryMap(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setSelectedAddressId('gps');
        setDeliveryLat(lat);
        setDeliveryLng(lng);
        api.saveLastCustomerLocation({ lat, lng, label: 'Pinned GPS Location' });
        applyReverseGeocodedAddressWeb(lat, lng);
        setGpsDetecting(false);
      },
      (err) => {
        setGpsDetecting(false);
        setGpsError(
          err?.code === 1
            ? 'Location permission denied. Enable browser location to verify delivery radius.'
            : 'Unable to detect GPS coordinates right now. Please try again.'
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  };

  const handleSaveCurrentAddress = async () => {
    if (deliveryLat === null || deliveryLng === null) {
      setGpsError('Please detect GPS coordinates before saving this address.');
      return;
    }
    if (!deliveryAddressText.trim() && !deliveryHouseFlat.trim()) {
      setGpsError('Please enter your street address or house/flat number.');
      return;
    }
    setSavingAddress(true);
    setGpsError('');
    try {
      const saved = await api.saveCustomerDeliveryAddress({
        label: deliveryLabel,
        recipientName: guestName.trim() || undefined,
        mobileNumber: api.sanitizeIndianMobile(mobileNumber || '') || undefined,
        fullAddress: deliveryAddressText.trim() || deliveryHouseFlat.trim(),
        houseFlatFloor: deliveryHouseFlat.trim() || undefined,
        landmark: deliveryLandmark.trim() || undefined,
        city: deliveryCity.trim() || catalog?.city || undefined,
        pincode: deliveryPincode.trim() || undefined,
        latitude: deliveryLat,
        longitude: deliveryLng,
        isDefault: savedAddresses.length === 0,
      });
      if (saved) {
        setSavedAddresses((prev) => [saved, ...prev.filter((a) => Number(a.id) !== Number(saved.id))]);
        setSelectedAddressId(saved.id || 'gps');
      }
    } catch (e: any) {
      setGpsError(e?.response?.data?.message || e?.message || 'Could not save address.');
    } finally {
      setSavingAddress(false);
    }
  };

  const handleDeleteSavedAddress = async (addrId: number) => {
    try {
      await api.deleteCustomerDeliveryAddress(addrId, mobileNumber);
      setSavedAddresses((prev) => prev.filter((a) => Number(a.id) !== Number(addrId)));
      if (selectedAddressId === addrId) {
        setSelectedAddressId(null);
      }
    } catch {}
  };

  const rawCatalogDeliveryFee = Number(catalog?.deliveryFee ?? 0);
  const freeDeliveryThreshold = Number(catalog?.freeDeliveryAbove ?? 0);
  const minDeliveryOrderAmount = Number(serviceability?.minDeliveryOrderAmount ?? catalog?.minDeliveryOrderAmount ?? 0);
  const fallbackDeliveryFee =
    freeDeliveryThreshold > 0 && taxableAmount >= freeDeliveryThreshold
      ? 0
      : rawCatalogDeliveryFee;

  const deliveryFee = isDeliveryOrder
    ? Number(serviceability?.deliveryFee ?? fallbackDeliveryFee)
    : 0;
  const deliveryGstAmount =
    isDeliveryOrder && hasGst && deliveryFee > 0
      ? Number(
          serviceability?.deliveryGstAmount ??
            Math.round(deliveryFee * 0.05 * 100) / 100
        )
      : 0;
  const platformFee = isDeliveryOrder
    ? Number(serviceability?.platformFee ?? 10)
    : Number(cart?.platformFee ?? 0);
  const totalTaxAmount = Math.round((taxAmount + deliveryGstAmount) * 100) / 100;

  // Strict business rule: Home delivery orders must ALWAYS be prepaid online.
  const deliveryRequiresOnline = Boolean(isDeliveryOrder);
  const deliveryAllowsCod = false;

  useEffect(() => {
    if (isDeliveryOrder) {
      if (paymentMethod !== activeOnlineGateway) {
        setPaymentMethod(activeOnlineGateway);
      }
    } else if (paymentMethod !== 'payatcounter') {
      setPaymentMethod('payatcounter');
    }
  }, [isDeliveryOrder, paymentMethod, activeOnlineGateway]);

  // Grand Total: strictly sum item GST + delivery fee + delivery GST (5%) + platform fee
  const grandTotal = Math.round(
    (taxableAmount + totalTaxAmount + deliveryFee + platformFee) * 100
  ) / 100;

  const hasUnavailableItems =
    Boolean(cart?.hasUnavailableItems) ||
    activeCartItems.some(
      (item: any) => item.isAvailable === false
    );

  const isItemBusy = (itemId: any) =>
    updatingItemId === itemId ||
    removingItemId === itemId;

  const handleQuantityChange = async (
    item: any,
    nextQuantity: number
  ) => {
    if (
      !onUpdateCartQuantity ||
      isItemBusy(item.itemId)
    ) {
      return;
    }

    if (nextQuantity <= 0) {
      await handleRemoveItem(item.itemId);
      return;
    }

    try {
      setErrorMsg('');
      setUpdatingItemId(item.itemId);

      logger.cart('CART_QUANTITY_CHANGED', `Changed quantity of ${item.itemName || item.name || item.itemId} to ${nextQuantity}`, {
        itemId: item.itemId,
        nextQuantity,
      });

      await onUpdateCartQuantity(
        item.itemId,
        nextQuantity,
        item.cookingInstruction || null
      );
    } catch (error: any) {
      console.error(
        'Update cart quantity error:',
        error
      );
      logger.error('CART', 'CART_QUANTITY_UPDATE_FAILED', error, { itemId: item.itemId, nextQuantity });

      setErrorMsg(
        error?.response?.data?.message ||
          error?.message ||
          'Unable to update item quantity.'
      );
    } finally {
      setUpdatingItemId(null);
    }
  };

  const handleRemoveItem = async (itemId: any) => {
    if (
      !onRemoveFromCart ||
      isItemBusy(itemId)
    ) {
      return;
    }

    try {
      setErrorMsg('');
      setRemovingItemId(itemId);

      logger.cart('CART_ITEM_REMOVED', `Removed item #${itemId} from cart`, { itemId });

      await onRemoveFromCart(itemId);
    } catch (error: any) {
      console.error(
        'Remove cart item error:',
        error
      );
      logger.error('CART', 'CART_ITEM_REMOVE_FAILED', error, { itemId });

      setErrorMsg(
        error?.response?.data?.message ||
          error?.message ||
          'Unable to remove item from cart.'
      );
    } finally {
      setRemovingItemId(null);
    }
  };

  const handleClearCartClick = async () => {
    if (!onClearCart || clearingCart) return;

    try {
      setErrorMsg('');
      setClearingCart(true);

      logger.cart('CART_CLEARED', 'Customer cleared all items from cart');

      await onClearCart();
    } catch (error: any) {
      console.error(
        'Clear cart error:',
        error
      );
      logger.error('CART', 'CART_CLEAR_FAILED', error);

      setErrorMsg(
        error?.response?.data?.message ||
          error?.message ||
          'Unable to clear cart.'
      );
    } finally {
      setClearingCart(false);
    }
  };

  const handleCheckout = async () => {
    if (!guestName.trim()) {
      setErrorMsg(
        'Please enter customer / guest name.'
      );
      return;
    }

    const cleanMobile = api.sanitizeIndianMobile(mobileNumber);

    if (!cleanMobile) {
      setErrorMsg('Please enter your 10-digit mobile number.');
      setMobileError('Mobile number is required.');
      return;
    }

    if (cleanMobile.length !== 10) {
      setErrorMsg('Indian mobile number must be exactly 10 digits.');
      setMobileError('Must be exactly 10 digits.');
      return;
    }

    if (!/^[6-9]/.test(cleanMobile)) {
      setErrorMsg('Indian mobile number must start with 6, 7, 8, or 9.');
      setMobileError('Must start with 6, 7, 8, or 9.');
      return;
    }

    if (!api.isValidIndianMobile(cleanMobile)) {
      setErrorMsg('Please enter a valid 10-digit Indian mobile number.');
      setMobileError('Invalid Indian mobile number.');
      return;
    }

    setMobileError('');
    const cleanPhone = cleanMobile;

    // Direct checkout: mobile OTP verification removed
    if (activeTable?.isCleaning) {
      logger.warn('CHECKOUT', 'CHECKOUT_BLOCKED_CLEANING', `Checkout blocked: Table ${activeTable.tableName || activeTable.id} is cleaning`);
      setErrorMsg(
        `Table ${activeTable.tableName || activeTable.id} is currently being sanitized. Please wait for staff to complete turnover.`
      );
      return;
    }

    if (activeTable?.isReserved) {
      logger.warn('CHECKOUT', 'CHECKOUT_BLOCKED_RESERVED', `Checkout blocked: Table ${activeTable.tableName || activeTable.id} is reserved`);
      setErrorMsg(
        `Table ${activeTable.tableName || activeTable.id} is reserved for scheduled guests. Please speak to staff to be seated.`
      );
      return;
    }

    if (activeTable?.occupiedByOther) {
      logger.warn('CHECKOUT', 'CHECKOUT_BLOCKED_OCCUPIED', `Checkout blocked: Table ${activeTable.tableName || activeTable.id} is occupied by another party`);
      setErrorMsg(
        `Table ${activeTable.tableName || activeTable.id} is currently occupied by another party. Orders cannot be placed for this table.`
      );
      return;
    }

    if (hasUnavailableItems) {
      logger.warn('CHECKOUT', 'CHECKOUT_BLOCKED_UNAVAILABLE_ITEMS', 'Checkout blocked: Out of stock items present in cart');
      setErrorMsg(
        'Please remove out-of-stock items from your cart before proceeding.'
      );
      return;
    }

    if (storeOperatingStatus && storeOperatingStatus.canPlaceOrder === false) {
      logger.warn('CHECKOUT', 'CHECKOUT_BLOCKED_STORE_STATUS', `Checkout blocked: Kitchen status is ${storeOperatingStatus.status}`);
      setErrorMsg(
        storeOperatingStatus.statusMessage ||
        (storeOperatingStatus.status === 'PAUSED'
          ? `Kitchen is temporarily paused (${storeOperatingStatus.remainingPauseMinutes || 0}m left). Reopening soon.`
          : 'Kitchen is currently closed for ordering.')
      );
      return;
    }

    if (activeTable && Boolean(activeTable.isSessionExpired) && !Boolean(activeTable.isDiningActive)) {
      logger.warn('CHECKOUT', 'CHECKOUT_BLOCKED_SESSION_EXPIRED', `Checkout blocked: Table ${activeTable.tableName || activeTable.id} ordering session expired`);
      setErrorMsg('Your in-store table ordering session has expired (15-minute limit). Please re-scan your table QR code to place an order.');
      if (onClearCart) {
        onClearCart();
      }
      return;
    }

    if (!activeCartItems.length) {
      setErrorMsg('Your cart is empty.');
      return;
    }

    if (isDeliveryOrder) {
      if (deliveryLat === null || deliveryLng === null || isNaN(deliveryLat) || isNaN(deliveryLng)) {
        setErrorMsg('Please detect your GPS location or choose a saved address to verify delivery availability.');
        return;
      }
      if (!deliveryAddressText.trim() && !deliveryHouseFlat.trim()) {
        setErrorMsg('Please enter your delivery house/flat or street address.');
        return;
      }
      if (checkingServiceability) {
        setErrorMsg('Verifying delivery range and charges. Please wait a moment.');
        return;
      }
      if (!serviceability) {
        setErrorMsg('Unable to verify delivery serviceability for this location. Please retry GPS detection.');
        return;
      }
      if (serviceability.isServiceable === false) {
        setErrorMsg(serviceability.reason || 'Delivery is currently not available for your selected location or order value.');
        return;
      }
      if (minDeliveryOrderAmount > 0 && taxableAmount < minDeliveryOrderAmount) {
        setErrorMsg(`Minimum order amount for home delivery is ₹${money(minDeliveryOrderAmount)}.`);
        return;
      }
      if (paymentMethod !== 'razorpay' && paymentMethod !== 'cashfree') {
        setErrorMsg('Prepaid online payment is required for home delivery orders.');
        setPaymentMethod(activeOnlineGateway);
        return;
      }
    }

    setErrorMsg('');

    logger.checkout('CHECKOUT_STARTED', `Customer initiated checkout: ₹${grandTotal} (${activeCartItems.length} items)`, {
      itemsCount: activeCartItems.length,
      subTotal,
      grandTotal,
      paymentMethod,
      customerName: guestName.trim(),
      phone: cleanPhone,
      tableId: activeTable?.id,
    });

    const restId =
      (cart && cart.restaurantId) ||
      (catalog ? catalog.restaurantId : 1);

    const orderItems = activeCartItems.map(
      (item: any) => {
        const itemPrice = Number(item.price ?? item.unitPrice ?? item.amount ?? 0);
        const itemQty = Number(item.quantity || 1);
        const itemLineTotal = Number(item.totalAmount ?? (itemPrice * itemQty));

        return {
          itemId: item.itemId,
          itemName: item.itemName || item.name || '',
          quantity: itemQty,
          unitId: item.unit || 1,
          unitName: item.unitName || null,
          price: itemPrice,
          unitPrice: itemPrice,
          amount: itemPrice,
          totalAmount: itemLineTotal,
          cookingInstruction:
            item.cookingInstruction || null,
        };
      }
    );

    const effectiveTableId = activeTable?.id ||
      (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tableId') : null) ||
      (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('table') : null) ||
      (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('t') : null) ||
      null;

    const effectiveTableName = activeTable?.tableName ||
      (activeTable?.id ? `Table ${activeTable.id}` : (effectiveTableId ? `Table ${effectiveTableId}` : 'Dine-In Table'));

    const effectiveTableToken =
      activeTable?.tableSessionToken ||
      activeTable?.encryptedTableId ||
      (typeof window !== 'undefined' ? window.location.pathname.split('/').find(p => p.startsWith('mzt_')) : null) ||
      (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('t') : null) ||
      null;

    const isThisTableOrder = Boolean(isTableOrder || isDynamicQr || effectiveTableId || effectiveTableToken);

    const orderPayload = {
      restaurantId: restId,
      name: guestName.trim(),
      mobileNumber: cleanPhone,
      otpCode: isVerified ? null : (otpCode.trim() || null),
      customerUserId: verifiedCustomer?.userId || null,
      remarks: remarks.trim(),
      isHomeDelivery: isDeliveryOrder,
      orderTypeId: isThisTableOrder ? 1 : orderTypeId,
      tableId: isThisTableOrder ? effectiveTableId : null,
      tableNumber: isThisTableOrder ? effectiveTableName : null,
      encryptedTableId: isThisTableOrder ? (activeTable?.encryptedTableId || effectiveTableToken || null) : null,
      tableSessionToken: isThisTableOrder ? effectiveTableToken : null,
      deliveryAddressId: isDeliveryOrder && typeof selectedAddressId === 'number' ? selectedAddressId : null,
      deliveryAddressLabel: isDeliveryOrder ? deliveryLabel : null,
      deliveryAddress: isDeliveryOrder ? (deliveryAddressText.trim() || deliveryHouseFlat.trim()) : null,
      deliveryHouseFlatFloor: isDeliveryOrder ? (deliveryHouseFlat.trim() || null) : null,
      deliveryLandmark: isDeliveryOrder ? (deliveryLandmark.trim() || null) : null,
      deliveryLatitude: isDeliveryOrder ? deliveryLat : null,
      deliveryLongitude: isDeliveryOrder ? deliveryLng : null,
      deliveryFee: isDeliveryOrder ? deliveryFee : 0,
      deliveryGstAmount: isDeliveryOrder ? deliveryGstAmount : 0,
      platformFee,
      items: orderItems,
      deliveryType: isThisTableOrder ? 'Dine-In' : (isDeliveryOrder ? 'Delivery' : (orderTypeId === 1 ? 'Dine-In' : 'Takeaway / Counter')),
      paymentMode: 'CASH',
      paymentType: 'COUNTER_CASH',
      paymentMethod: 'COUNTER_CASH',
      paymentStatus: 'Pending',
      orderStatus: 'Placed',
      isOnline: false,
      isSettled: false,
      requiresCashierConfirmation: true,
      deviceId: api.getDeviceId(),
      hardwareFingerprint: api.getHardwareFingerprint(),
      source: isThisTableOrder ? 'QR_DINEIN' : 'STORE_WEB',
      gstNumber: cleanGstNumber,
      cgstPercentage: hasGst ? cgstPercentage : 0,
      sgstPercentage: hasGst ? sgstPercentage : 0,
      subTotal,
      cgstAmount: hasGst ? cgst : 0,
      sgstAmount: hasGst ? sgst : 0,
      taxAmount: totalTaxAmount,
      totalAmount: grandTotal,
    };

    // Direct Counter / Pay at Counter Order Flow
    const isDirectPlaceOrder = paymentMethod !== 'cashfree' && paymentMethod !== 'razorpay';

    if (isDirectPlaceOrder) {
      // Store Profile & Dine-In orders: Pay at Counter with Cashier Confirmation Required
      setSubmittingOrder(true);
      setProcessingPayment(false);
      try {
        const directCounterOrderPayload = {
          ...orderPayload,
          tableId: isThisTableOrder ? effectiveTableId : null,
          tableNumber: isThisTableOrder ? effectiveTableName : null,
          encryptedTableId: isThisTableOrder ? (activeTable?.encryptedTableId || effectiveTableToken || null) : null,
          tableSessionToken: isThisTableOrder ? effectiveTableToken : null,
          paymentMode: 'CASH',
          paymentType: 'COUNTER_CASH',
          paymentMethod: 'COUNTER_CASH',
          paymentStatus: 'Pending',
          orderStatus: 'Placed',
          isOnline: false,
          isSettled: false,
          requiresCashierConfirmation: true,
          source: isThisTableOrder ? 'QR_DINEIN' : 'STORE_WEB',
          deliveryType: isThisTableOrder ? 'Dine-In' : (isDeliveryOrder ? 'Delivery' : (orderTypeId === 1 ? 'Dine-In' : 'Takeaway / Counter')),
          orderTypeId: isThisTableOrder ? 1 : orderTypeId,
        };

        logger.checkout('CHECKOUT_COUNTER_SUBMIT', `Customer placed counter order for ${isThisTableOrder ? effectiveTableName : 'Storefront Counter'}: ₹${grandTotal}`, {
          tableId: isThisTableOrder ? effectiveTableId : null,
          tableName: isThisTableOrder ? effectiveTableName : null,
          grandTotal,
          itemsCount: orderItems.length,
          paymentMode: 'COUNTER_CASH',
          requiresCashierConfirmation: true,
        });

        if (typeof onPlaceOrder === 'function') {
          await onPlaceOrder(directCounterOrderPayload);
        } else {
          await api.placeOrder(directCounterOrderPayload);
        }

        setSubmittingOrder(false);
        setProcessingPayment(false);
        onClose();
        if (typeof onClearCart === 'function') {
          await onClearCart();
        }
        return; // ABSOLUTE RETURN
      } catch (placeErr: any) {
        console.error('Counter place order error:', placeErr);
        logger.error('CHECKOUT', 'CHECKOUT_COUNTER_FAILED', placeErr, {
          tableId: isThisTableOrder ? effectiveTableId : null,
          amount: grandTotal,
        });
        setErrorMsg(placeErr?.response?.data?.message || placeErr?.message || 'Unable to place order. Please alert restaurant staff.');
        setSubmittingOrder(false);
        setProcessingPayment(false);
        return;
      }
    }

    // Double-guard: Online Payment is enabled ONLY for Home Delivery orders
    if (!isDeliveryOrder || isThisTableOrder || isDynamicQr) {
      setErrorMsg('Online payment is available only for Home Delivery orders. Please pay at counter.');
      setPaymentMethod('payatcounter');
      setProcessingPayment(false);
      return;
    }

    // 3. Razorpay Online Prepaid Checkout Flow
    if (paymentMethod === 'razorpay') {
      setProcessingPayment(true);
      try {
        const isTableOrdering = catalog?.isTableOrderingEnabled !== false;
        const effectiveTable = isTableOrdering && activeTable ? String(activeTable.id) : null;
        const encRestId = catalog?.encryptedRestaurantId || api.encryptRestaurantId(restId);

        logger.payment('RAZORPAY_INITIATED', `Initiating Razorpay checkout for ₹${grandTotal}`, {
          amount: grandTotal,
          isDeliveryOrder,
        });

        const checkoutRes: any = await api.initiateRazorpayCheckout({
          restaurantId: restId,
          encryptedRestaurantId: encRestId,
          amount: Math.round(grandTotal * 100) / 100,
          customerName: guestName.trim(),
          customerPhone: cleanPhone,
          customerEmail: `${cleanPhone}@menza.customer`,
          tableNumber: effectiveTable || '',
          orderNotes: remarks.trim(),
        });

        const razorpayOrderId =
          checkoutRes?.orderId ||
          checkoutRes?.OrderId ||
          checkoutRes?.paymentSessionId ||
          checkoutRes?.data?.orderId;

        const razorpayKeyId =
          checkoutRes?.keyId ||
          checkoutRes?.KeyId ||
          checkoutRes?.data?.keyId ||
          catalog?.razorpayKeyId;

        const amountPaise = Math.round(Number(checkoutRes?.amount ?? grandTotal) * 100);

        if (!razorpayOrderId || !razorpayKeyId) {
          throw new Error('Razorpay payment gateway did not return a valid order ID or key.');
        }

        const pendingRazorpayOrderPayload = {
          ...orderPayload,
          restaurantId: restId,
          encryptedRestaurantId: encRestId,
          customerName: guestName.trim() || 'Guest Diner',
          name: guestName.trim() || 'Guest Diner',
          customerPhone: cleanPhone,
          mobileNumber: cleanPhone,
          customerEmail: `${cleanPhone}@menza.customer`,
          otpCode: isVerified ? null : (otpCode.trim() || null),
          customerUserId: verifiedCustomer?.userId || null,
          tableId: isTableOrdering && activeTable ? activeTable.id : null,
          tableNumber: effectiveTable,
          orderTypeId: activeTable ? 1 : orderTypeId,
          deliveryType: activeTable ? 'Dine-In' : (isDeliveryOrder ? 'Delivery' : (orderTypeId === 1 ? 'Dine-In' : 'Takeaway / Counter')),
          paymentMode: 'RAZORPAY',
          paymentType: 'ONLINE_RAZORPAY',
          paymentMethod: 'RAZORPAY',
          paymentStatus: 'Paid',
          orderStatus: 'Confirmed',
          isOnline: true,
          isSettled: true,
          requiresCashierConfirmation: false,
          paymentOrderId: razorpayOrderId,
          razorpayOrderId,
          subTotal,
          itemTotal: subTotal,
          orderAmount: subTotal,
          gstNumber: cleanGstNumber,
          cgstPercentage: hasGst ? cgstPercentage : 0,
          sgstPercentage: hasGst ? sgstPercentage : 0,
          cgstAmount: hasGst ? cgst : 0,
          sgstAmount: hasGst ? sgst : 0,
          deliveryFee: isDeliveryOrder ? deliveryFee : 0,
          deliveryGstAmount: isDeliveryOrder ? deliveryGstAmount : 0,
          platformFee,
          taxAmount: totalTaxAmount,
          totalAmount: grandTotal,
          deviceId: api.getDeviceId(),
          hardwareFingerprint: api.getHardwareFingerprint(),
          items: orderItems,
          createdAt: new Date().toISOString(),
        };

        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('pending_rzp_order_' + razorpayOrderId, JSON.stringify(pendingRazorpayOrderPayload));
            localStorage.setItem('pending_rzp_order_latest', JSON.stringify(pendingRazorpayOrderPayload));
            joinOrderGroup(razorpayOrderId);
          } catch {}
        }

        const rzpSuccess = await openRazorpayCheckout({
          key: razorpayKeyId,
          amountPaise,
          currency: checkoutRes?.currency || 'INR',
          name: catalog?.restaurantName || 'MenzaOrder',
          description: isDeliveryOrder ? 'Home Delivery Order' : 'Food Order',
          orderId: razorpayOrderId,
          prefill: {
            name: guestName.trim(),
            contact: cleanPhone,
            email: `${cleanPhone}@menza.customer`,
          },
          notes: {
            restaurantId: String(restId),
            orderType: isDeliveryOrder ? 'Delivery' : 'Pickup',
          },
        });

        const verifyRes: any = await api.verifyRazorpayPayment({
          orderId: rzpSuccess.razorpay_order_id || razorpayOrderId,
          restaurantId: restId,
          razorpayPaymentId: rzpSuccess.razorpay_payment_id,
          razorpaySignature: rzpSuccess.razorpay_signature,
        });

        const verifiedStatus = String(verifyRes?.paymentStatus || verifyRes?.status || '').toUpperCase();
        if (!['SUCCESS', 'PAID', 'CAPTURED', 'COMPLETED'].includes(verifiedStatus)) {
          throw new Error('Razorpay payment could not be verified. Please contact support if money was debited.');
        }

        const finalPayload = {
          ...pendingRazorpayOrderPayload,
          razorpayOrderId: rzpSuccess.razorpay_order_id || razorpayOrderId,
          razorpayPaymentId: rzpSuccess.razorpay_payment_id,
          paymentOrderId: rzpSuccess.razorpay_order_id || razorpayOrderId,
          transactionId: rzpSuccess.razorpay_payment_id,
        };

        let placedRes: any = null;
        if (typeof onPlaceOrder === 'function') {
          placedRes = await onPlaceOrder(finalPayload);
        } else {
          placedRes = await api.placeOrder(finalPayload);
        }

        const placedOrderId = placedRes?.id || placedRes?.orderId || razorpayOrderId;

        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem('pending_rzp_order_' + razorpayOrderId);
            localStorage.removeItem('pending_rzp_order_latest');
          } catch {}
        }

        setProcessingPayment(false);
        onClose();
        if (typeof onClearCart === 'function') {
          await onClearCart();
        }
        if (typeof onOrderConfirmed === 'function') {
          onOrderConfirmed(placedOrderId);
        }
        return;
      } catch (rzpErr: any) {
        logger.error('PAYMENT', 'RAZORPAY_CHECKOUT_FAILED', rzpErr, { amount: grandTotal });
        setErrorMsg(
          rzpErr?.isDismissed
            ? 'Payment cancelled. Please complete Razorpay payment to place your order.'
            : (rzpErr?.response?.data?.message || rzpErr?.message || 'Razorpay payment failed. Please try again.')
        );
        setProcessingPayment(false);
        return;
      }
    }

    if (paymentMethod === 'cashfree') {
      setProcessingPayment(true);

      try {
        const isTableOrdering =
          catalog?.isTableOrderingEnabled !== false;

        const effectiveTable =
          isTableOrdering && activeTable
            ? String(activeTable.id)
            : null;

        const encRestId =
          catalog?.encryptedRestaurantId ||
          api.encryptRestaurantId(restId);

        const returnOrigin = typeof window !== 'undefined' ? window.location.origin : '';
        const returnPathname = typeof window !== 'undefined' ? window.location.pathname : '';
        const customReturnUrl = `${returnOrigin}${returnPathname}?order_id={order_id}&r=${encodeURIComponent(encRestId)}${
          effectiveTable ? `&tableId=${encodeURIComponent(effectiveTable)}` : ''
        }`;

        logger.payment('PAYMENT_INITIATED', `Initiating Cashfree checkout for ₹${grandTotal}`, {
          amount: grandTotal,
          tableNumber: effectiveTable,
          returnUrl: customReturnUrl,
        });

        const checkoutRes: any =
          await api.initiateCashfreeCheckout({
            restaurantId: restId,
            encryptedRestaurantId: encRestId,
            amount:
              Math.round(grandTotal * 100) / 100,
            customerName: guestName.trim(),
            customerPhone: cleanPhone,
            customerEmail: `${cleanPhone}@menza.customer`,
            tableNumber:
              effectiveTable || '',
            isTableOrderingEnabled:
              isTableOrdering,
            orderNotes: remarks.trim(),
            returnUrl: customReturnUrl,
          });

        const paymentSessionId =
          checkoutRes?.paymentSessionId ||
          checkoutRes?.PaymentSessionId ||
          checkoutRes?.payment_session_id ||
          checkoutRes?.data?.paymentSessionId ||
          checkoutRes?.data?.PaymentSessionId ||
          checkoutRes?.data?.payment_session_id ||
          checkoutRes?.order_token ||
          checkoutRes?.orderToken;

        let paymentLink =
          checkoutRes?.paymentLink ||
          checkoutRes?.PaymentLink ||
          checkoutRes?.payment_link ||
          checkoutRes?.data?.paymentLink ||
          checkoutRes?.data?.PaymentLink ||
          checkoutRes?.data?.payment_link ||
          checkoutRes?.instrumentResponseUrl ||
          checkoutRes?.data?.instrumentResponseUrl;

        const cashfreeOrderId =
          checkoutRes?.orderId ||
          checkoutRes?.OrderId ||
          checkoutRes?.order_id ||
          checkoutRes?.data?.orderId ||
          checkoutRes?.data?.OrderId ||
          checkoutRes?.data?.order_id ||
          checkoutRes?.cfOrderId ||
          checkoutRes?.data?.cfOrderId;

        logger.payment('PAYMENT_SESSION_CREATED', `Cashfree order: ${cashfreeOrderId || 'N/A'}, session: ${paymentSessionId ? 'present' : 'none'}`, {
          cashfreeOrderId,
          hasSessionId: Boolean(paymentSessionId),
          hasPaymentLink: Boolean(paymentLink),
        });

        // Store pending order in session/local storage to be placed ONLY AFTER payment is confirmed
        const pendingOrderPayload = {
          ...orderPayload,
          restaurantId: restId,
          encryptedRestaurantId: encRestId,
          customerName: guestName.trim() || 'Guest Diner',
          name: guestName.trim() || 'Guest Diner',
          customerPhone: cleanPhone,
          mobileNumber: cleanPhone,
          customerEmail: `${cleanPhone}@menza.customer`,
          otpCode: isVerified ? null : (otpCode.trim() || null),
          customerUserId: verifiedCustomer?.userId || null,
          tableId:
            isTableOrdering && activeTable
              ? activeTable.id
              : null,
          tableNumber: effectiveTable,
          orderTypeId: activeTable ? 1 : orderTypeId,
          deliveryType: activeTable ? 'Dine-In' : (isDeliveryOrder ? 'Delivery' : (orderTypeId === 1 ? 'Dine-In' : 'Takeaway / Counter')),
          paymentMode: 'CASHFREE',
          paymentType: 'ONLINE_CASHFREE',
          paymentStatus: 'Paid',
          orderStatus: 'Confirmed',
          paymentOrderId: cashfreeOrderId,
          cashfreeOrderId,
          subTotal: subTotal,
          itemTotal: subTotal,
          orderAmount: subTotal,
          gstNumber: cleanGstNumber,
          cgstPercentage: hasGst ? cgstPercentage : 0,
          sgstPercentage: hasGst ? sgstPercentage : 0,
          cgstAmount: hasGst ? cgst : 0,
          sgstAmount: hasGst ? sgst : 0,
          taxAmount: totalTaxAmount,
          totalAmount: grandTotal,
          deviceId: api.getDeviceId(),
          hardwareFingerprint: api.getHardwareFingerprint(),
          items: orderItems,
          createdAt: new Date().toISOString(),
        };

        if (typeof window !== 'undefined') {
          try {
            if (cashfreeOrderId) {
              sessionStorage.setItem(
                'pending_cf_order_' + cashfreeOrderId,
                JSON.stringify(pendingOrderPayload)
              );
              localStorage.setItem(
                'pending_cf_order_' + cashfreeOrderId,
                JSON.stringify(pendingOrderPayload)
              );
            }
            localStorage.setItem(
              'pending_cf_order_latest',
              JSON.stringify(pendingOrderPayload)
            );
            localStorage.setItem('menza_last_rest_id', String(restId));
            if (encRestId) {
              localStorage.setItem('menza_last_enc_rest_id', String(encRestId));
            }
            if (effectiveTable) {
              localStorage.setItem('menza_last_table_id', String(effectiveTable));
            }
            // Join real-time SignalR order group for instant settlement updates
            if (cashfreeOrderId) {
              joinOrderGroup(cashfreeOrderId);
            }
          } catch (storageErr) {
            console.warn('Could not cache pending order payload:', storageErr);
          }
        }

        if (paymentSessionId) {
          const preferredMode =
            (checkoutRes?.environment?.toLowerCase() === 'production' ||
            checkoutRes?.data?.environment?.toLowerCase() === 'production')
              ? 'production'
              : (checkoutRes?.environment?.toLowerCase() === 'sandbox' ||
                checkoutRes?.data?.environment?.toLowerCase() === 'sandbox')
              ? 'sandbox'
              : ENV.CASHFREE_MODE;

          // Probe Cashfree API to verify whether this session belongs to Sandbox or Production
          const detectedMode = await detectCashfreeMode(paymentSessionId, preferredMode);

          // If no paymentLink was returned by backend, generate direct hosted fallback URL
          if (!paymentLink) {
            paymentLink = `https://${detectedMode === 'sandbox' ? 'payments-test' : 'payments'}.cashfree.com/order/#${paymentSessionId}`;
          }

          logger.payment('PAYMENT_SESSION_READY', `Cashfree order: ${cashfreeOrderId || 'N/A'}, mode: ${detectedMode}`, {
            cashfreeOrderId,
            mode: detectedMode,
            hasSessionId: true,
            hasPaymentLink: Boolean(paymentLink),
          });

          try {
            const CashfreeConstructor = await loadCashfreeSdk();
            const cashfree = CashfreeConstructor({
              mode: detectedMode,
            });

            logger.payment('PAYMENT_CHECKOUT_REDIRECT', `Submitting checkout via Cashfree JS SDK in ${detectedMode} mode`, {
              cashfreeOrderId,
              mode: detectedMode,
            });

            cashfree.checkout({
              paymentSessionId: paymentSessionId,
              redirectTarget: '_self',
            });

            return;
          } catch (sdkError: any) {
            console.warn(
              'Cashfree SDK checkout fallback to paymentLink:',
              sdkError
            );
            logger.error('PAYMENT', 'PAYMENT_SDK_ERROR', sdkError, {
              cashfreeOrderId,
              paymentSessionId,
              mode: detectedMode,
            });

            if (paymentLink && typeof window !== 'undefined') {
              window.location.href = paymentLink;
              return;
            }
          }
        } else if (paymentLink && typeof window !== 'undefined') {
          window.location.href = paymentLink;
          return;
        } else {
          throw new Error('Payment gateway did not return a valid payment session. Please try again.');
        }
      } catch (err: any) {
        console.error(
          'Cashfree checkout API error:',
          err
        );

        logger.error('PAYMENT', 'PAYMENT_INITIATION_FAILED', err, {
          amount: grandTotal,
          cleanPhone,
        });

        setErrorMsg(
          err?.response?.data?.message ||
            err?.message ||
            'Unable to initiate online payment. Please try again or ask your waiter to take your order.'
        );

        setProcessingPayment(false);
      }
    } else {
      setErrorMsg(
        'QR ordering requires Online Payment (Cashfree/UPI) before order creation. Prefer to pay with Cash? Your waiter can take your order directly at your table/Give order at POS Counter.'
      );
    }
  };

  if (!visible) return null;

  const isLoadingState =
    loading || submittingOrder || processingPayment;

  const selectedItemsCount = activeCartItems.length;

  return (
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={onClose}
      >
      <View style={styles.overlay} className="responsive-modal-overlay">
        <View style={styles.sheetContainer} className="responsive-modal-sheet">
          {submittingOrder && (
            <View
              style={
                styles.paymentProcessingOverlay
              }
            >
              <ActivityIndicator
                size="large"
                color="#10b981"
              />

              <Text
                style={
                  styles.paymentProcessingTitle
                }
              >
                Placing Your Table Order...
              </Text>

              <Text
                style={
                  styles.paymentProcessingSubtitle
                }
              >
                Sending your order directly to the restaurant kitchen. Please wait a moment.
              </Text>
            </View>
          )}

          {processingPayment && !isTableOrder && !isDynamicQr && !isPayAtCounterOnly && (
            <View
              style={
                styles.paymentProcessingOverlay
              }
            >
              <ActivityIndicator
                size="large"
                color="#10b981"
              />

              <Text
                style={
                  styles.paymentProcessingTitle
                }
              >
                {paymentMethod === 'razorpay'
                  ? 'Connecting to Razorpay Payment Gateway...'
                  : 'Connecting to Cashfree Payment Gateway...'}
              </Text>

              <Text
                style={
                  styles.paymentProcessingSubtitle
                }
              >
                {paymentMethod === 'razorpay'
                  ? 'Complete your secure prepaid payment in the Razorpay window. Do not refresh this page.'
                  : 'Please wait while we redirect you to secure checkout. Do not close or refresh this page.'}
              </Text>
            </View>
          )}

          <View style={styles.sheetHeader}>
            <View
              style={styles.headerTitleRow}
            >
              <ShoppingBag
                size={20}
                color="#10b981"
              />

              <View>
                <Text
                  style={styles.headerTitle}
                >
                  Your Order Basket
                </Text>

                {cart?.restaurantName ? (
                  <Text
                    style={
                      styles.headerSubTitle
                    }
                  >
                    {cart.restaurantName}
                  </Text>
                ) : null}
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
            >
              <X
                size={20}
                color="#94a3b8"
              />
            </TouchableOpacity>
          </View>

          {/* Prominent Table Session Countdown Banner */}
          {Boolean(isTableOrder || isDynamicQr) && (
            <View style={[
              styles.cartTopSessionBar,
              activeTable?.isSessionExpired
                ? styles.cartTopSessionBarExpired
                : (typeof activeTable?.sessionRemainingSeconds === 'number' && activeTable.sessionRemainingSeconds <= 180)
                ? styles.cartTopSessionBarUrgent
                : styles.cartTopSessionBarActive
            ]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={[
                  styles.cartTopSessionIconBox,
                  activeTable?.isSessionExpired
                    ? { backgroundColor: '#fee2e2' }
                    : (typeof activeTable?.sessionRemainingSeconds === 'number' && activeTable.sessionRemainingSeconds <= 180)
                    ? { backgroundColor: '#fef3c7' }
                    : { backgroundColor: '#dcfce7' }
                ]}>
                  <Clock
                    size={18}
                    color={
                      activeTable?.isSessionExpired
                        ? '#dc2626'
                        : (typeof activeTable?.sessionRemainingSeconds === 'number' && activeTable.sessionRemainingSeconds <= 180)
                        ? '#d97706'
                        : '#15803d'
                    }
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[
                    styles.cartTopSessionTitle,
                    activeTable?.isSessionExpired
                      ? { color: '#b91c1c' }
                      : (typeof activeTable?.sessionRemainingSeconds === 'number' && activeTable.sessionRemainingSeconds <= 180)
                      ? { color: '#b45309' }
                      : { color: '#166534' }
                  ]}>
                    {activeTable?.isSessionExpired
                      ? '⚠️ Table Ordering Session Expired'
                      : typeof activeTable?.sessionRemainingSeconds === 'number' && activeTable.sessionRemainingSeconds > 0
                      ? `⏱️ Table Session: ${Math.floor(activeTable.sessionRemainingSeconds / 60)}m ${String(activeTable.sessionRemainingSeconds % 60).padStart(2, '0')}s remaining`
                      : `Table ${activeTable?.tableName || activeTable?.id || 'Dine-In'} Session Active`}
                  </Text>
                  <Text style={[
                    styles.cartTopSessionSub,
                    activeTable?.isSessionExpired
                      ? { color: '#991b1b' }
                      : (typeof activeTable?.sessionRemainingSeconds === 'number' && activeTable.sessionRemainingSeconds <= 180)
                      ? { color: '#92400e' }
                      : { color: '#15803d' }
                  ]}>
                    {activeTable?.isSessionExpired
                      ? 'The 15-minute table session limit was reached. Please re-scan your table QR code to place an order.'
                      : typeof activeTable?.sessionRemainingSeconds === 'number' && activeTable.sessionRemainingSeconds <= 180
                      ? 'Session expiring soon! Please tap Place Order below before your table session finishes.'
                      : 'Please place your order before the dynamic 15-minute table session ends.'}
                  </Text>
                </View>
              </View>
            </View>
          )}

          <ScrollView
            style={styles.bodyScroll}
            contentContainerStyle={
              styles.bodyContent
            }
            keyboardShouldPersistTaps="handled"
          >
            {fetchingCart &&
            activeCartItems.length === 0 ? (
              <View
                style={styles.emptyCartBox}
              >
                <ActivityIndicator
                  size="large"
                  color="#10b981"
                />

                <Text
                  style={
                    styles.emptyCartTitle
                  }
                >
                  Loading Basket Items...
                </Text>

                <Text
                  style={
                    styles.emptyCartSub
                  }
                >
                  Retrieving your cart items from the server.
                </Text>
              </View>
            ) : activeCartItems.length ===
              0 ? (
              <View
                style={styles.emptyCartBox}
              >
                <ShoppingBag
                  size={48}
                  color={Boolean(activeTable?.isSessionExpired && !activeTable?.isDiningActive) ? "#dc2626" : "#334155"}
                />

                <Text
                  style={[
                    styles.emptyCartTitle,
                    Boolean(activeTable?.isSessionExpired && !activeTable?.isDiningActive) && { color: '#dc2626' }
                  ]}
                >
                  {Boolean(activeTable?.isSessionExpired && !activeTable?.isDiningActive)
                    ? 'Table Session Expired'
                    : 'Your Basket is Empty'}
                </Text>

                <Text
                  style={
                    styles.emptyCartSub
                  }
                >
                  {Boolean(activeTable?.isSessionExpired && !activeTable?.isDiningActive)
                    ? 'The 15-minute table session limit was reached and your cart has been cleared. Please re-scan your table QR code to place a new order.'
                    : 'Browse our menu catalog and add delicious dishes.'}
                </Text>
              </View>
            ) : (
              <>
                {activeTable?.isCleaning ? (
                  <View style={[styles.tableOccupiedCartBanner, { backgroundColor: '#f0f9ff', borderColor: '#bae6fd' }]}>
                    <AlertCircle size={18} color="#0284c7" />
                    <Text style={[styles.tableOccupiedCartBannerText, { color: '#0369a1' }]}>
                      Table {activeTable.tableName || activeTable.id} is being sanitized. Please wait a moment.
                    </Text>
                  </View>
                ) : activeTable?.isReserved ? (
                  <View style={[styles.tableOccupiedCartBanner, { backgroundColor: '#faf5ff', borderColor: '#e9d5ff' }]}>
                    <AlertCircle size={18} color="#7c3aed" />
                    <Text style={[styles.tableOccupiedCartBannerText, { color: '#6d28d9' }]}>
                      Table {activeTable.tableName || activeTable.id} is reserved. Please consult staff.
                    </Text>
                  </View>
                ) : activeTable?.occupiedByOther ? (
                  <View style={styles.tableOccupiedCartBanner}>
                    <AlertCircle size={18} color="#e11d48" />
                    <Text style={styles.tableOccupiedCartBannerText}>
                      Table {activeTable.tableName || activeTable.id} is occupied by another party. Online ordering is locked for this table.
                    </Text>
                  </View>
                ) : activeTable?.isOccupied ? (
                  <View style={[styles.tableOccupiedCartBanner, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
                    <Check size={18} color="#15803d" />
                    <Text style={[styles.tableOccupiedCartBannerText, { color: '#166534' }]}>
                      Table {activeTable.tableName || activeTable.id} (Active Session) • Items will be added to your table bill.
                    </Text>
                  </View>
                ) : null}

                {hasUnavailableItems && (
                  <View
                    style={
                      styles.outOfStockBanner
                    }
                  >
                    <AlertTriangle
                      size={18}
                      color="#f59e0b"
                    />

                    <Text
                      style={
                        styles.outOfStockBannerText
                      }
                    >
                      Some items are currently unavailable. Please remove them
                      to place your order.
                    </Text>
                  </View>
                )}

                <View
                  style={styles.itemsSection}
                >
                  <View
                    style={
                      styles.sectionHeaderRow
                    }
                  >
                    <Text
                      style={
                        styles.sectionTitle
                      }
                    >
                      {selectedItemsCount === 1 ? 'Selected Item' : 'Selected Items'} (
                      {selectedItemsCount})
                    </Text>

                    <TouchableOpacity
                      onPress={
                        handleClearCartClick
                      }
                      disabled={clearingCart}
                    >
                      {clearingCart ? (
                        <ActivityIndicator
                          size="small"
                          color="#ef4444"
                        />
                      ) : (
                        <Text
                          style={
                            styles.clearText
                          }
                        >
                          Clear All
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>

                  {activeCartItems.map(
                    (item: any) => {
                      const itemUnitPrice =
                        Number(
                          item.unitPrice ??
                            item.amount ??
                            0
                        );

                      const itemLineTotal =
                        Number(
                          item.totalAmount ??
                            itemUnitPrice *
                              Number(
                                item.quantity ||
                                  0
                              )
                        );

                      return (
                        <View
                          key={
                            item.itemId
                          }
                          style={[
                            styles.cartRowWrapper,
                            !item.isAvailable &&
                              styles.cartRowUnavailable,
                          ]}
                        >
                          <View
                            style={
                              styles.cartRow
                            }
                          >
                            <ItemImageWithFallback
                              uri={
                                item.imageUrl
                              }
                              isVeg={
                                item.isVeg
                              }
                              style={
                                styles.itemThumb
                              }
                            />

                            <View
                              style={
                                styles.itemInfo
                              }
                            >
                              <View
                                style={
                                  styles.itemNameRow
                                }
                              >
                                <Text
                                  style={
                                    styles.itemName
                                  }
                                  numberOfLines={
                                    2
                                  }
                                >
                                  {
                                    item.itemName
                                  }
                                </Text>

                                {!item.isAvailable && (
                                  <View
                                    style={
                                      styles.unavailBadge
                                    }
                                  >
                                    <Text
                                      style={
                                        styles.unavailBadgeText
                                      }
                                    >
                                      Out of Stock
                                    </Text>
                                  </View>
                                )}
                              </View>

                              {item.variantName ? (
                                <Text
                                  style={
                                    styles.itemMetaText
                                  }
                                >
                                  {
                                    item.variantName
                                  }
                                </Text>
                              ) : null}

                              <View
                                style={
                                  styles.quantityBadgeRow
                                }
                              >
                                <View
                                  style={
                                    styles.quantityBadge
                                  }
                                >
                                  <Text
                                    style={
                                      styles.quantityBadgeBold
                                    }
                                  >
                                    {getQuantityUnitText(item.quantity, item, catalog)}
                                  </Text>
                                </View>
                              </View>

                              {Array.isArray(
                                item.modifiers
                              ) &&
                              item.modifiers
                                .length >
                                0 && (
                                <View
                                  style={
                                    styles.modifierRow
                                  }
                                >
                                  {item.modifiers.map(
                                    (m: any) => (
                                      <View
                                        key={
                                          m.modifierId
                                        }
                                        style={
                                          styles.modifierBadge
                                        }
                                      >
                                        <Text
                                          style={
                                            styles.modifierBadgeText
                                          }
                                        >
                                          +
                                          {
                                            m.modifierName
                                          }{' '}
                                          (₹
                                          {money(
                                            m.extraPrice
                                          )}
                                          )
                                        </Text>
                                      </View>
                                    )
                                  )}
                                </View>
                              )}

                              {item.cookingInstruction ? (
                                <View
                                  style={
                                    styles.instructionPill
                                  }
                                >
                                  <Text
                                    style={
                                      styles.instructionText
                                    }
                                    numberOfLines={
                                      1
                                    }
                                  >
                                    {
                                      item.cookingInstruction
                                    }
                                  </Text>
                                </View>
                              ) : null}
                            </View>

                            <View
                              style={
                                styles.actionsRight
                              }
                            >
                              <View
                                style={
                                  styles.qtyBox
                                }
                              >
                                <TouchableOpacity
                                  style={
                                    styles.qtyBtn
                                  }
                                  disabled={isItemBusy(
                                    item.itemId
                                  )}
                                  onPress={() =>
                                    handleQuantityChange(
                                      item,
                                      Number(
                                        item.quantity ||
                                          0
                                      ) - 1
                                    )
                                  }
                                >
                                  {updatingItemId ===
                                  item.itemId ? (
                                    <ActivityIndicator
                                      size="small"
                                      color="#ffffff"
                                    />
                                  ) : (
                                    <Minus
                                      size={12}
                                      color="#ffffff"
                                    />
                                  )}
                                </TouchableOpacity>

                                <Text
                                  style={
                                    styles.qtyText
                                  }
                                >
                                  {
                                    item.quantity
                                  }
                                </Text>

                                <TouchableOpacity
                                  style={
                                    styles.qtyBtn
                                  }
                                  disabled={isItemBusy(
                                    item.itemId
                                  )}
                                  onPress={() =>
                                    handleQuantityChange(
                                      item,
                                      Number(
                                        item.quantity ||
                                          0
                                      ) + 1
                                    )
                                  }
                                >
                                  <Plus
                                    size={12}
                                    color="#ffffff"
                                  />
                                </TouchableOpacity>
                              </View>

                              <View
                                style={
                                  styles.itemTotalRow
                                }
                              >
                                <Text
                                  style={
                                    styles.itemTotalLabel
                                  }
                                >
                                  {Number(item.quantity) > 1
                                    ? `${item.quantity} × ₹${money(itemUnitPrice)}`
                                    : `₹${money(itemUnitPrice)} each`}
                                </Text>

                                <Text
                                  style={
                                    styles.itemSubtotal
                                  }
                                >
                                  ₹
                                  {money(
                                    itemLineTotal
                                  )}
                                </Text>
                              </View>

                              <TouchableOpacity
                                style={
                                  styles.trashBtn
                                }
                                disabled={isItemBusy(
                                  item.itemId
                                )}
                                onPress={() =>
                                  handleRemoveItem(
                                    item.itemId
                                  )
                                }
                              >
                                {removingItemId ===
                                item.itemId ? (
                                  <ActivityIndicator
                                    size="small"
                                    color="#ef4444"
                                  />
                                ) : (
                                  <Trash2
                                    size={15}
                                    color="#ef4444"
                                  />
                                )}
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      );
                    }
                  )}
                </View>

                <View
                  style={styles.formSection}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text
                      style={styles.sectionTitle}
                    >
                      Order Type
                    </Text>
                    {(isTableOrder || isDynamicQr || activeTable) ? (
                      <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        backgroundColor: '#ecfdf5',
                        borderWidth: 1,
                        borderColor: '#a7f3d0',
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 12,
                      }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#047857' }}>
                          Table {activeTable?.tableName || activeTable?.id || 'Dine-In'} (Dine-In)
                        </Text>
                      </View>
                    ) : null}

                    {Boolean(isTableOrder || isDynamicQr) && (
                      typeof activeTable?.sessionRemainingSeconds === 'number' && activeTable.sessionRemainingSeconds > 0 && !activeTable?.isSessionExpired ? (
                        <View style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                          backgroundColor: activeTable.sessionRemainingSeconds <= 180 ? '#fff7ed' : '#ecfdf5',
                          borderWidth: 1,
                          borderColor: activeTable.sessionRemainingSeconds <= 180 ? '#fed7aa' : '#a7f3d0',
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 12,
                        }}>
                          <Clock size={11} color={activeTable.sessionRemainingSeconds <= 180 ? '#c2410c' : '#047857'} />
                          <Text style={{
                            fontSize: 11,
                            fontWeight: '700',
                            color: activeTable.sessionRemainingSeconds <= 180 ? '#c2410c' : '#047857'
                          }}>
                            {Math.floor(activeTable.sessionRemainingSeconds / 60)}m {String(activeTable.sessionRemainingSeconds % 60).padStart(2, '0')}s left
                          </Text>
                        </View>
                      ) : activeTable?.isSessionExpired ? (
                        <View style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                          backgroundColor: '#fef2f2',
                          borderWidth: 1,
                          borderColor: '#fecaca',
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 12,
                        }}>
                          <AlertCircle size={11} color="#dc2626" />
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#b91c1c' }}>
                            Session Expired
                          </Text>
                        </View>
                      ) : null
                    )}
                  </View>

                  <View
                    style={
                      styles.orderTypeContainer
                    }
                  >
                    {effectiveOrderTypes.map(
                      (type: any) => {
                        const isSelected =
                          orderTypeId ===
                          type.id;

                        const icon =
                          getOrderTypeIcon(
                            type.typeName || type.code || type.name
                          );

                        const isLockedForTable = Boolean((isTableOrder || isDynamicQr || activeTable) && type.id !== 1);
                        const isDelivery = Boolean(
                          Number(type.id) === 3 ||
                          String(type.typeName || type.name || type.code || '').toLowerCase().includes('delivery')
                        );

                        if (isDelivery && !allowDeliveryOption) {
                          return null;
                        }

                        return (
                          <TouchableOpacity
                            key={type.id}
                            style={[
                              styles.orderTypeTab,
                              isSelected &&
                                styles.orderTypeTabActive,
                              isLockedForTable && {
                                opacity: 0.45,
                              },
                            ]}
                            onPress={() => {
                              if (isLockedForTable) {
                                setErrorMsg(`You are seated at Table ${activeTable.tableName || activeTable.id}. Table orders must be Dine-In.`);
                                return;
                              }
                              setErrorMsg('');
                              setOrderTypeId(type.id);
                            }}
                            activeOpacity={isLockedForTable ? 1 : 0.8}
                          >
                            <Text
                              style={[
                                styles.orderTypeText,
                                isSelected &&
                                  styles.orderTypeTextActive,
                              ]}
                            >
                              {icon}{' '}
                              {type.typeName || type.name || 'Dine-In'}
                            </Text>
                          </TouchableOpacity>
                        );
                      }
                    )}
                  </View>

                  {isDeliveryOrder && (
                    <View
                      style={{
                        marginTop: 12,
                        marginBottom: 14,
                        padding: 14,
                        borderRadius: 16,
                        backgroundColor: '#eff6ff',
                        borderWidth: 1,
                        borderColor: '#bfdbfe',
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Bike size={16} color="#1d4ed8" />
                          <Text style={{ fontSize: 13.5, fontWeight: '800', color: '#1e3a8a' }}>
                            Delivery Location &amp; Address
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={handleDetectGpsLocation}
                          disabled={gpsDetecting}
                          activeOpacity={0.8}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 5,
                            backgroundColor: '#2563eb',
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: 10,
                          }}
                        >
                          {gpsDetecting ? (
                            <ActivityIndicator size="small" color="#ffffff" />
                          ) : (
                            <LocateFixed size={13} color="#ffffff" />
                          )}
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#ffffff' }}>
                            {gpsDetecting ? 'Detecting...' : (deliveryLat !== null ? 'Update GPS' : 'Use Current GPS')}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {/* Saved Addresses Chips */}
                      {savedAddresses.length > 0 && (
                        <View style={{ marginBottom: 10 }}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#334155', marginBottom: 6 }}>
                            Saved Addresses
                          </Text>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                              {savedAddresses.map((addr: any) => {
                                const isSel = selectedAddressId === addr.id;
                                return (
                                  <View
                                    key={addr.id}
                                    style={{
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      gap: 6,
                                      paddingHorizontal: 10,
                                      paddingVertical: 6,
                                      borderRadius: 10,
                                      borderWidth: 1,
                                      borderColor: isSel ? '#2563eb' : '#cbd5e1',
                                      backgroundColor: isSel ? '#dbeafe' : '#ffffff',
                                    }}
                                  >
                                    <TouchableOpacity
                                      onPress={() => handleSelectSavedAddress(addr)}
                                      style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
                                    >
                                      {addr.label === 'Work' ? (
                                        <Briefcase size={12} color={isSel ? '#1d4ed8' : '#64748b'} />
                                      ) : (
                                        <Home size={12} color={isSel ? '#1d4ed8' : '#64748b'} />
                                      )}
                                      <Text style={{ fontSize: 11.5, fontWeight: '700', color: isSel ? '#1e3a8a' : '#334155', maxWidth: 140 }} numberOfLines={1}>
                                        {addr.label}: {addr.houseFlatFloor || addr.fullAddress}
                                      </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => handleDeleteSavedAddress(addr.id)}>
                                      <Trash2 size={12} color="#94a3b8" />
                                    </TouchableOpacity>
                                  </View>
                                );
                              })}
                            </View>
                          </ScrollView>
                        </View>
                      )}

                      {/* Embedded Live Map Preview for Delivery / Update GPS */}
                      {deliveryLat !== null && deliveryLng !== null && (
                        <View style={{ marginBottom: 8 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                            <Text style={{ fontSize: 11, fontWeight: '700', color: '#1e3a8a' }}>
                              Delivery Pin Map
                            </Text>
                            <TouchableOpacity onPress={() => setShowDeliveryMap((prev) => !prev)}>
                              <Text style={{ fontSize: 11, fontWeight: '700', color: '#2563eb' }}>
                                {showDeliveryMap ? 'Hide Map' : 'Show Map'}
                              </Text>
                            </TouchableOpacity>
                          </View>
                          {showDeliveryMap && (
                            <DeliveryLocationMap
                              latitude={deliveryLat}
                              longitude={deliveryLng}
                              restaurantLat={catalog?.latitude ?? null}
                              restaurantLng={catalog?.longitude ?? null}
                              restaurantName={catalog?.restaurantName || 'Restaurant'}
                              onChangeLocation={handleMapLocationChange}
                            />
                          )}
                        </View>
                      )}

                      {/* Address Label Selector */}
                      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                        {(['Home', 'Work', 'Other'] as const).map((lbl) => (
                          <TouchableOpacity
                            key={lbl}
                            onPress={() => setDeliveryLabel(lbl)}
                            style={{
                              paddingHorizontal: 10,
                              paddingVertical: 5,
                              borderRadius: 8,
                              backgroundColor: deliveryLabel === lbl ? '#1e40af' : '#ffffff',
                              borderWidth: 1,
                              borderColor: deliveryLabel === lbl ? '#1e40af' : '#cbd5e1',
                            }}
                          >
                            <Text style={{ fontSize: 11, fontWeight: '700', color: deliveryLabel === lbl ? '#ffffff' : '#475569' }}>
                              {lbl}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      <TextInput
                        style={[styles.textInput, { backgroundColor: '#ffffff', marginBottom: 8 }] as any}
                        placeholder="House / Flat / Floor No. *"
                        placeholderTextColor="#64748b"
                        value={deliveryHouseFlat}
                        onChangeText={setDeliveryHouseFlat}
                      />

                      <TextInput
                        style={[styles.textInput, { backgroundColor: '#ffffff', marginBottom: 8 }] as any}
                        placeholder="Street, Area / Colony, Full Address *"
                        placeholderTextColor="#64748b"
                        value={deliveryAddressText}
                        onChangeText={setDeliveryAddressText}
                      />

                      <TextInput
                        style={[styles.textInput, { backgroundColor: '#ffffff', marginBottom: 8 }] as any}
                        placeholder="Nearby Landmark (optional)"
                        placeholderTextColor="#64748b"
                        value={deliveryLandmark}
                        onChangeText={setDeliveryLandmark}
                      />

                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 }}>
                          <MapPin size={13} color={deliveryLat !== null ? '#15803d' : '#dc2626'} />
                          <Text style={{ fontSize: 11, fontWeight: '600', color: deliveryLat !== null ? '#166534' : '#b91c1c' }} numberOfLines={1}>
                            {deliveryLat !== null && deliveryLng !== null
                              ? `GPS Locked (${deliveryLat.toFixed(4)}, ${deliveryLng.toFixed(4)})`
                              : 'GPS location required to verify distance'}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={handleSaveCurrentAddress}
                          disabled={savingAddress}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                            backgroundColor: '#ffffff',
                            borderWidth: 1,
                            borderColor: '#93c5fd',
                            paddingHorizontal: 9,
                            paddingVertical: 5,
                            borderRadius: 8,
                          }}
                        >
                          <Plus size={12} color="#1d4ed8" />
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#1d4ed8' }}>
                            {savingAddress ? 'Saving...' : 'Save Address'}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {gpsError ? (
                        <Text style={{ fontSize: 11, fontWeight: '600', color: '#dc2626', marginTop: 6 }}>
                          {gpsError}
                        </Text>
                      ) : null}

                      {/* Live Delivery Serviceability Status */}
                      {checkingServiceability ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                          <ActivityIndicator size="small" color="#2563eb" />
                          <Text style={{ fontSize: 11.5, fontWeight: '600', color: '#1e40af' }}>
                            Checking delivery radius &amp; fee...
                          </Text>
                        </View>
                      ) : serviceability ? (
                        <View
                          style={{
                            marginTop: 8,
                            padding: 9,
                            borderRadius: 10,
                            backgroundColor: serviceability.isServiceable ? '#dcfce7' : '#fee2e2',
                            borderWidth: 1,
                            borderColor: serviceability.isServiceable ? '#86efac' : '#fca5a5',
                          }}
                        >
                          <Text style={{ fontSize: 11.5, fontWeight: '700', color: serviceability.isServiceable ? '#166534' : '#991b1b' }}>
                            {serviceability.isServiceable
                              ? `✓ Deliverable (~${Number(serviceability.estimatedRoadDistanceKm || serviceability.straightDistanceKm || 0).toFixed(1)} km road) • ${deliveryFee > 0 ? `Fee ₹${deliveryFee}` : 'Free Delivery'}`
                              : `✕ ${serviceability.reason || 'Out of delivery range or below minimum order'}`}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  )}

                  <View
                    style={styles.inputGroup}
                  >
                    <Text
                      style={styles.inputLabel}
                    >
                      Customer Name *
                    </Text>

                    <TextInput
                      style={
                        styles.textInput as any
                      }
                      placeholder="Enter guest / diner name"
                      placeholderTextColor="#64748b"
                      value={guestName}
                      onChangeText={
                        setGuestName
                      }
                    />
                  </View>

                  {/* Customer Mobile Number */}
                  <View style={styles.inputGroup}>
                    <View style={styles.labelRow}>
                      <Text style={styles.inputLabel}>
                        Mobile Number *
                      </Text>
                      {mobileNumber.length === 10 && /^[6-9]\d{9}$/.test(mobileNumber) ? (
                        <View style={styles.validBadge}>
                          <CheckCircle2 size={13} color="#16a34a" />
                          <Text style={styles.validBadgeText}>Valid Indian Mobile</Text>
                        </View>
                      ) : null}
                    </View>

                    <View
                      style={[
                        styles.phoneInputContainer,
                        Boolean(mobileError) && styles.phoneInputContainerError,
                      ]}
                    >
                      <View style={styles.phoneCountryPrefix}>
                        <Text style={styles.phoneCountryFlag}>🇮🇳</Text>
                        <Text style={styles.phoneCountryCode}>+91</Text>
                      </View>

                      <TextInput
                        style={styles.phoneTextInput as any}
                        placeholder="9876543210"
                        placeholderTextColor="#94a3b8"
                        keyboardType="phone-pad"
                        maxLength={10}
                        value={mobileNumber}
                        onChangeText={handleMobileNumberChange}
                      />
                    </View>

                    {mobileError ? (
                      <Text style={styles.inputErrorText}>
                        {mobileError}
                      </Text>
                    ) : (
                      <Text style={styles.inputHintText}>
                        Accepts only 10-digit Indian mobile number starting with 6, 7, 8, or 9
                      </Text>
                    )}
                  </View>

                  <View
                    style={styles.inputGroup}
                  >
                    <Text
                      style={styles.inputLabel}
                    >
                      Order Remarks /
                      Instructions
                    </Text>

                    <TextInput
                      style={[
                        styles.textInput,
                        styles.multilineInput,
                      ] as any}
                      placeholder="Cutlery needed, quick service, etc..."
                      placeholderTextColor="#64748b"
                      multiline
                      value={remarks}
                      onChangeText={
                        setRemarks
                      }
                    />
                  </View>
                </View>

                {(isTableOrder || isDynamicQr || activeTable) && (
                  <View style={{
                    marginTop: 14,
                    padding: 14,
                    borderRadius: 14,
                    backgroundColor: '#f0fdf4',
                    borderWidth: 1,
                    borderColor: '#bbf7d0',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                  }}>
                    <View style={{
                      width: 38,
                      height: 38,
                      borderRadius: 19,
                      backgroundColor: '#dcfce7',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <Utensils size={18} color="#15803d" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#166534' }}>
                        Dine-In • Table {activeTable?.tableName || activeTable?.tableNumber || activeTable?.id || 'Table'}
                      </Text>
                      <Text style={{ fontSize: 11, color: '#15803d', marginTop: 3, lineHeight: 16 }}>
                        Select your preferred payment method below.
                      </Text>
                      {typeof activeTable?.sessionRemainingSeconds === 'number' && activeTable.sessionRemainingSeconds > 0 && (
                        <Text style={{ fontSize: 11, color: '#166534', fontWeight: '700', marginTop: 3 }}>
                          ⏱ Table Session: {Math.floor(activeTable.sessionRemainingSeconds / 60)}m {String(activeTable.sessionRemainingSeconds % 60).padStart(2, '0')}s remaining
                        </Text>
                      )}
                    </View>
                  </View>
                )}

                <View style={styles.formSection}>
                  <Text style={styles.sectionTitle}>
                    Payment Method
                  </Text>

                  {/* Online Payment (Razorpay / Cashfree Gateway) enabled ONLY for Home Delivery */}
                  {!isTableOrder && !isDynamicQr && isDeliveryOrder && (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => setPaymentMethod(activeOnlineGateway)}
                      style={[styles.paymentMethodRow, { marginBottom: 10 }]}
                    >
                      <View
                        style={[
                          styles.paymentCard,
                          (paymentMethod === 'cashfree' || paymentMethod === 'razorpay') && styles.paymentCardActive,
                          (paymentMethod === 'cashfree' || paymentMethod === 'razorpay') && { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
                          { flex: 1 },
                        ]}
                      >
                        <CreditCard size={22} color={(paymentMethod === 'cashfree' || paymentMethod === 'razorpay') ? '#1d4ed8' : '#64748b'} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.paymentCardTitle, (paymentMethod === 'cashfree' || paymentMethod === 'razorpay') && { color: '#1e3a8a' }]}>
                            Pay Online (UPI / Cards / NetBanking)
                          </Text>
                          <Text style={[styles.paymentCardSub, (paymentMethod === 'cashfree' || paymentMethod === 'razorpay') && { color: '#1d4ed8' }]}>
                            {isRazorpayActive
                              ? 'Instant Prepaid Checkout • Secured by Razorpay'
                              : 'Instant Prepaid Checkout • Secured by Cashfree'}
                          </Text>
                        </View>
                        {(paymentMethod === 'cashfree' || paymentMethod === 'razorpay') ? (
                          <CheckCircle2 size={18} color="#1d4ed8" />
                        ) : (
                          <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: '#cbd5e1' }} />
                        )}
                      </View>
                    </TouchableOpacity>
                  )}

                  {/* Pay at Counter / Cash on Delivery option */}
                  {!(isDeliveryOrder && deliveryRequiresOnline && !deliveryAllowsCod) ? (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => setPaymentMethod('payatcounter')}
                      style={[styles.paymentMethodRow, { marginTop: 10 }]}
                    >
                      <View
                        style={[
                          styles.paymentCard,
                          paymentMethod === 'payatcounter' && styles.paymentCardActive,
                          paymentMethod === 'payatcounter' && { borderColor: '#10b981', backgroundColor: '#f0fdf4' },
                          { flex: 1 }
                        ]}
                      >
                        <IndianRupee size={22} color={paymentMethod === 'payatcounter' ? '#15803d' : '#64748b'} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.paymentCardTitle, paymentMethod === 'payatcounter' && { color: '#166534' }]}>
                            {isDeliveryOrder ? 'Cash on Delivery' : 'Pay at Counter'}
                          </Text>
                          <Text style={[styles.paymentCardSub, paymentMethod === 'payatcounter' && { color: '#15803d' }]}>
                            {isDeliveryOrder
                              ? 'Pay cash / UPI upon doorstep arrival'
                              : 'Cash / UPI at Counter • Cashier Confirmation Required'}
                          </Text>
                          <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '500', marginTop: 4 }}>
                            Dishes prepared once cashier accepts order
                          </Text>
                        </View>
                        {paymentMethod === 'payatcounter' ? (
                          <CheckCircle2 size={18} color="#15803d" />
                        ) : (
                          <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: '#cbd5e1' }} />
                        )}
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <View style={{ marginTop: 8, padding: 10, borderRadius: 10, backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#fde68a' }}>
                      <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#92400e' }}>
                        🔒 Prepaid online payment is required for home delivery orders.
                      </Text>
                    </View>
                  )}
                </View>

                <View
                  style={styles.summarySection}
                >
                  <Text
                    style={styles.sectionTitle}
                  >
                    Bill Breakdown
                  </Text>

                  <View
                    style={styles.summaryRow}
                  >
                    <Text
                      style={styles.summaryLabel}
                    >
                      Item Subtotal
                    </Text>

                    <Text
                      style={styles.summaryValue}
                    >
                      ₹{money(subTotal)}
                    </Text>
                  </View>

                  {discountAmount > 0 ? (
                    <View
                      style={
                        styles.summaryRow
                      }
                    >
                      <Text
                        style={
                          styles.summaryLabel
                        }
                      >
                        Discount
                      </Text>

                      <Text
                        style={
                          styles.discountValue
                        }
                      >
                        -₹
                        {money(
                          discountAmount
                        )}
                      </Text>
                    </View>
                  ) : null}

                  {taxableAmount > 0 ? (
                    <View
                      style={
                        styles.summaryRow
                      }
                    >
                      <Text
                        style={
                          styles.summaryLabel
                        }
                      >
                        Taxable Amount
                      </Text>

                      <Text
                        style={
                          styles.summaryValue
                        }
                      >
                        ₹
                        {money(
                          taxableAmount
                        )}
                      </Text>
                    </View>
                  ) : null}

                  {hasGst && taxAmount > 0 ? (
                    <>
                      <View
                        style={styles.summaryRow}
                      >
                        <Text
                          style={styles.summaryLabel}
                        >
                          CGST{' '}
                          {cgstPercentage >
                          0
                            ? `(${cgstPercentage}%)`
                            : ''}
                        </Text>

                        <Text
                          style={styles.summaryValue}
                        >
                          ₹{money(cgst)}
                        </Text>
                      </View>

                      <View
                        style={styles.summaryRow}
                      >
                        <Text
                          style={styles.summaryLabel}
                        >
                          SGST{' '}
                          {sgstPercentage >
                          0
                            ? `(${sgstPercentage}%)`
                            : ''}
                        </Text>

                        <Text
                          style={styles.summaryValue}
                        >
                          ₹{money(sgst)}
                        </Text>
                      </View>

                      <View
                        style={styles.summaryRow}
                      >
                        <Text
                          style={styles.summaryLabel}
                        >
                          Total Tax (GST)
                        </Text>

                        <Text
                          style={styles.summaryValue}
                        >
                          ₹
                          {money(
                            taxAmount
                          )}
                        </Text>
                      </View>
                    </>
                  ) : null}

                  {hasGst && cleanGstNumber ? (
                    <View
                      style={
                        styles.summaryRow
                      }
                    >
                      <Text
                        style={
                          styles.gstNumberLabel
                        }
                      >
                        GSTIN: {cleanGstNumber}
                      </Text>
                    </View>
                  ) : null}

                  {isDeliveryOrder ? (
                    <>
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>
                          Delivery Fee
                        </Text>
                        <Text style={[styles.summaryValue, deliveryFee === 0 && { color: '#15803d', fontWeight: '700' }]}>
                          {deliveryFee === 0 ? 'FREE' : `₹${money(deliveryFee)}`}
                        </Text>
                      </View>
                      {hasGst && deliveryGstAmount > 0 ? (
                        <View style={styles.summaryRow}>
                          <Text style={styles.summaryLabel}>
                            Delivery GST (5%)
                          </Text>
                          <Text style={styles.summaryValue}>
                            ₹{money(deliveryGstAmount)}
                          </Text>
                        </View>
                      ) : null}
                      {platformFee > 0 ? (
                        <View style={styles.summaryRow}>
                          <Text style={styles.summaryLabel}>
                            Platform Fee
                          </Text>
                          <Text style={styles.summaryValue}>
                            ₹{money(platformFee)}
                          </Text>
                        </View>
                      ) : null}
                    </>
                  ) : (
                    <View
                      style={
                        styles.zeroFeeBadge
                      }
                    >
                      <ShieldCheck
                        size={14}
                        color="#10b981"
                      />

                      <Text
                        style={
                          styles.zeroFeeBadgeText
                        }
                      >
                        Zero Platform &amp; Payment Gateway Fee for Customers
                      </Text>
                    </View>
                  )}

                  <View
                    style={styles.divider}
                  />

                  <View
                    style={
                      styles.grandTotalRow
                    }
                  >
                    <Text
                      style={
                        styles.grandTotalLabel
                      }
                    >
                      Total Payable
                    </Text>

                    <Text
                      style={
                        styles.grandTotalValue
                      }
                    >
                      ₹
                      {money(
                        grandTotal
                      )}
                    </Text>
                  </View>
                </View>

                {errorMsg ? (
                  <View
                    style={
                      styles.errorBanner
                    }
                  >
                    <AlertCircle
                      size={16}
                      color="#ef4444"
                    />

                    <Text
                      style={
                        styles.errorText
                      }
                    >
                      {errorMsg}
                    </Text>
                  </View>
                ) : null}
              </>
            )}
          </ScrollView>

          {activeCartItems.length > 0 && (
            <View
              style={styles.footerContainer}
            >
              {Boolean(isTableOrder || isDynamicQr) && (
                <View style={[
                  styles.sessionFooterBadge,
                  activeTable?.isSessionExpired
                    ? styles.sessionFooterBadgeExpired
                    : (typeof activeTable?.sessionRemainingSeconds === 'number' && activeTable.sessionRemainingSeconds <= 180)
                    ? styles.sessionFooterBadgeUrgent
                    : styles.sessionFooterBadgeActive
                ]}>
                  <Clock
                    size={14}
                    color={
                      activeTable?.isSessionExpired
                        ? '#dc2626'
                        : (typeof activeTable?.sessionRemainingSeconds === 'number' && activeTable.sessionRemainingSeconds <= 180)
                        ? '#c2410c'
                        : '#15803d'
                    }
                  />
                  <Text style={[
                    styles.sessionFooterBadgeText,
                    activeTable?.isSessionExpired
                      ? { color: '#b91c1c' }
                      : (typeof activeTable?.sessionRemainingSeconds === 'number' && activeTable.sessionRemainingSeconds <= 180)
                      ? { color: '#9a3412' }
                      : { color: '#166534' }
                  ]}>
                    {activeTable?.isSessionExpired
                      ? '⚠️ Table session expired (15-min limit). Please re-scan table QR to order.'
                      : typeof activeTable?.sessionRemainingSeconds === 'number' && activeTable.sessionRemainingSeconds > 0
                      ? `⏱️ Table Session: ${Math.floor(activeTable.sessionRemainingSeconds / 60)}m ${String(activeTable.sessionRemainingSeconds % 60).padStart(2, '0')}s remaining to place order`
                      : `Table ${activeTable?.tableName || activeTable?.id || 'Dine-In'} ordering window active`}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.checkoutBtn,
                  (isLoadingState ||
                    hasUnavailableItems ||
                    (storeOperatingStatus && !storeOperatingStatus.canPlaceOrder) ||
                    activeTable?.isLocked ||
                    activeTable?.occupiedByOther) &&
                    styles.checkoutBtnDisabled,
                ]}
                onPress={
                  handleCheckout
                }
                disabled={
                  isLoadingState ||
                  hasUnavailableItems ||
                  Boolean(storeOperatingStatus && !storeOperatingStatus.canPlaceOrder) ||
                  Boolean(activeTable?.isLocked || activeTable?.occupiedByOther) || Boolean(activeTable?.isSessionExpired && !activeTable?.isDiningActive)
                }
                activeOpacity={0.85}
              >
                {isLoadingState ? (
                  <ActivityIndicator
                    size="small"
                    color="#0f172a"
                  />
                ) : (
                  <>
                    <Text
                      style={
                        styles.checkoutBtnText
                      }
                    >
                      {activeTable?.isCleaning
                        ? 'TABLE BEING SANITIZED • PLEASE WAIT'
                        : activeTable?.isReserved
                        ? 'TABLE RESERVED • CONTACT STAFF'
                        : activeTable?.occupiedByOther
                        ? 'TABLE OCCUPIED • ORDERING LOCKED'
                        : storeOperatingStatus && !storeOperatingStatus.canPlaceOrder
                        ? (storeOperatingStatus.status === 'PAUSED'
                            ? `KITCHEN PAUSED (${storeOperatingStatus.remainingPauseMinutes || 0}M LEFT)`
                            : 'KITCHEN CLOSED FOR ORDERING')
                        : Boolean(activeTable?.isSessionExpired && !activeTable?.isDiningActive)
                        ? 'SESSION EXPIRED • RE-SCAN TABLE QR'
                        : ((paymentMethod === 'razorpay' || paymentMethod === 'cashfree')
                            ? `PAY & PLACE ORDER • ₹${money(grandTotal)}`
                            : `PLACE ORDER • ₹${money(grandTotal)}`)}
                    </Text>

                    <ArrowRight
                      size={18}
                      color="#0f172a"
                    />
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(27, 28, 28, 0.65)',
    justifyContent: 'flex-end',
  },

  sheetContainer: {
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    minHeight: '55%',
    borderWidth: 1,
    borderColor: '#E0DDD8',
    overflow: 'hidden',
  },

  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E0DDD8',
    backgroundColor: '#FBF9F9',
  },

  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },

  headerTitle: {
    color: '#1B1C1C',
    fontSize: 17,
    fontWeight: '800',
  },

  headerSubTitle: {
    color: '#D33401',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },

  closeBtn: {
    padding: 6,
    borderRadius: 8,
  },

  bodyScroll: {
    flex: 1,
    backgroundColor: '#FBF9F9',
  },

  bodyContent: {
    padding: 16,
    gap: 14,
  },

  emptyCartBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },

  emptyCartTitle: {
    color: '#1B1C1C',
    fontSize: 17,
    fontWeight: '700',
    marginTop: 12,
  },

  emptyCartSub: {
    color: '#747878',
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },

  outOfStockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(211, 52, 1, 0.1)',
    borderWidth: 1,
    borderColor: '#D33401',
    padding: 10,
    borderRadius: 12,
  },

  outOfStockBannerText: {
    color: '#D33401',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },

  itemsSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0DDD8',
    padding: 14,
    gap: 10,
  },

  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },

  sectionTitle: {
    color: '#1B1C1C',
    fontSize: 15,
    fontWeight: '700',
  },

  clearText: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '600',
  },

  cartRowWrapper: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEDED',
    gap: 6,
  },

  cartRowUnavailable: {
    opacity: 0.65,
  },

  cartRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },

  itemThumb: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: '#EFEDED',
    flexShrink: 0,
  },

  noImageThumb: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: '#EFEDED',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E0DDD8',
    flexShrink: 0,
  },

  itemInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },

  itemNameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    flexWrap: 'wrap',
  },

  itemName: {
    color: '#1B1C1C',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    minWidth: 100,
  },

  unavailBadge: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },

  unavailBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '700',
  },

  itemMetaText: {
    color: '#747878',
    fontSize: 11,
  },

  quantityBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 2,
  },

  quantityBadge: {
    backgroundColor: '#EFEDED',
    borderWidth: 1,
    borderColor: '#E0DDD8',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },

  quantityBadgeText: {
    color: '#1B1C1C',
    fontSize: 10,
    fontWeight: '500',
  },

  quantityBadgeBold: {
    color: '#1B1C1C',
    fontWeight: '800',
    fontSize: 11,
  },

  modifierRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },

  modifierBadge: {
    backgroundColor: '#EFEDED',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },

  modifierBadgeText: {
    color: '#1B1C1C',
    fontSize: 10,
    fontWeight: '500',
  },

  instructionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFEDED',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 2,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },

  instructionText: {
    color: '#1B1C1C',
    fontSize: 10,
    fontWeight: '500',
    flexShrink: 1,
  },

  actionsRight: {
    alignItems: 'flex-end',
    gap: 6,
    flexShrink: 0,
  },

  qtyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFEDED',
    borderRadius: 6,
    padding: 2,
    borderWidth: 1,
    borderColor: '#E0DDD8',
  },

  qtyBtn: {
    width: 22,
    height: 22,
    borderRadius: 4,
    backgroundColor: '#D33401',
    alignItems: 'center',
    justifyContent: 'center',
  },

  qtyText: {
    color: '#1B1C1C',
    fontWeight: '700',
    fontSize: 12,
    minWidth: 14,
    textAlign: 'center',
  },

  itemTotalRow: {
    alignItems: 'flex-end',
    gap: 1,
  },

  itemTotalLabel: {
    color: '#747878',
    fontSize: 9,
    textTransform: 'uppercase',
  },

  itemSubtotal: {
    color: '#1B1C1C',
    fontWeight: '800',
    fontSize: 13,
  },

  trashBtn: {
    padding: 4,
  },

  formSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0DDD8',
    padding: 14,
    gap: 10,
  },

  orderTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#EFEDED',
    borderRadius: 10,
    padding: 3,
    gap: 4,
    borderWidth: 1,
    borderColor: '#E0DDD8',
  },

  orderTypeTab: {
    flex: 1,
    minWidth: '46%',
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },

  orderTypeTabActive: {
    backgroundColor: '#1B1C1C',
  },

  orderTypeText: {
    color: '#444748',
    fontSize: 11,
    fontWeight: '600',
  },

  orderTypeTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },

  inputGroup: {
    gap: 4,
  },

  inputLabel: {
    color: '#1B1C1C',
    fontSize: 12,
    fontWeight: '600',
  },

  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  validBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  validBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
  },

  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0DDD8',
    borderRadius: 10,
    overflow: 'hidden',
  },

  phoneInputContainerError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },

  phoneCountryPrefix: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 10,
    paddingRight: 10,
    backgroundColor: '#F8FAFC',
    alignSelf: 'stretch',
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    justifyContent: 'center',
  },

  phoneCountryFlag: {
    fontSize: 14,
  },

  phoneCountryCode: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },

  phoneTextInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: '#1B1C1C',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    outlineStyle: 'none',
  },

  inputErrorText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },

  inputHintText: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },

  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0DDD8',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: '#1B1C1C',
    fontSize: 13,
    outlineStyle: 'none',
  },

  multilineInput: {
    minHeight: 70,
    textAlignVertical: 'top',
  },

  paymentMethodRow: {
    gap: 8,
  },

  paymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0DDD8',
    borderRadius: 12,
  },

  paymentCardActive: {
    borderColor: '#D33401',
    backgroundColor: '#FFF1EC',
  },

  paymentCardTitle: {
    color: '#1B1C1C',
    fontSize: 13,
    fontWeight: '700',
  },

  paymentCardTitleActive: {
    color: '#D33401',
  },

  paymentCardSub: {
    color: '#747878',
    fontSize: 11,
    marginTop: 1,
  },

  summarySection: {
    backgroundColor: '#EFEDED',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0DDD8',
    padding: 14,
    gap: 8,
  },

  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  summaryLabel: {
    color: '#444748',
    fontSize: 12,
  },

  summaryValue: {
    color: '#1B1C1C',
    fontSize: 12,
    fontWeight: '600',
  },

  discountValue: {
    color: '#15803d',
    fontSize: 12,
    fontWeight: '700',
  },

  zeroFeeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DCFCE7',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginTop: 2,
  },

  zeroFeeBadgeText: {
    color: '#15803d',
    fontSize: 11,
    fontWeight: '600',
  },

  gstNumberLabel: {
    color: '#747878',
    fontSize: 11,
    fontWeight: '500',
    fontStyle: 'italic',
  },

  divider: {
    height: 1,
    backgroundColor: '#E0DDD8',
    marginVertical: 3,
  },

  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 2,
  },

  grandTotalLabel: {
    color: '#1B1C1C',
    fontSize: 15,
    fontWeight: '800',
  },

  grandTotalValue: {
    color: '#1B1C1C',
    fontSize: 20,
    fontWeight: '800',
  },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: '#ef4444',
    padding: 10,
    borderRadius: 10,
  },

  errorText: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },

  footerContainer: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#E0DDD8',
    backgroundColor: '#FBF9F9',
  },

  checkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#D33401',
    paddingVertical: 13,
    borderRadius: 16,
    shadowColor: '#D33401',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    minHeight: 48,
  },

  checkoutBtnDisabled: {
    backgroundColor: '#A8A29E',
    opacity: 0.6,
  },

  checkoutBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
  },

  paymentProcessingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(251, 249, 249, 0.95)',
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    borderRadius: 24,
  },

  paymentProcessingTitle: {
    color: '#1B1C1C',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 14,
    textAlign: 'center',
  },

  paymentProcessingSubtitle: {
    color: '#747878',
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 17,
  },

  /* Verification and OTP Styles */
  inputLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  inputHelperText: {
    color: '#D33401',
    fontSize: 11,
    fontWeight: '600',
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  phoneInputFlex: {
    flex: 1,
  },
  sendOtpBtn: {
    backgroundColor: '#D33401',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 85,
    minHeight: 42,
  },
  sendOtpBtnDisabled: {
    backgroundColor: '#cbd5e1',
  },
  sendOtpBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sendOtpBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  verifiedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f0fdf4',
    borderWidth: 1.5,
    borderColor: '#86efac',
    borderRadius: 14,
    padding: 12,
  },
  verifiedCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  verifiedIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#dcfce7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifiedBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  verifiedBadgeText: {
    color: '#15803d',
    fontSize: 12,
    fontWeight: '700',
  },
  verifiedMobileText: {
    color: '#1e293b',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  changePhoneBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  changePhoneBtnText: {
    color: '#15803d',
    fontSize: 11,
    fontWeight: '700',
  },
  otpSuccessBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#86efac',
    padding: 8,
    borderRadius: 8,
    marginTop: 6,
  },
  otpSuccessBannerText: {
    color: '#15803d',
    fontSize: 11,
    fontWeight: '600',
  },
  otpCard: {
    backgroundColor: '#FFF7F4',
    borderWidth: 1.5,
    borderColor: '#FFD6C9',
    borderRadius: 14,
    padding: 12,
    marginTop: 8,
    gap: 10,
  },
  otpCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  otpCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  otpCardTitle: {
    color: '#9A2501',
    fontSize: 13,
    fontWeight: '700',
  },
  otpCardSubtitle: {
    color: '#747878',
    fontSize: 11,
  },
  otpInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  otpInput: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#FFBBAB',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    fontWeight: '800',
    color: '#1B1C1C',
    textAlign: 'center',
    letterSpacing: 4,
  },
  verifyOtpBtn: {
    backgroundColor: '#15803d',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 42,
  },
  verifyOtpBtnDisabled: {
    backgroundColor: '#cbd5e1',
  },
  verifyOtpBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  verifyOtpBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  otpFooterRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  countdownText: {
    color: '#747878',
    fontSize: 11,
    fontWeight: '500',
  },
  resendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  resendBtnText: {
    color: '#D33401',
    fontSize: 11,
    fontWeight: '700',
  },
  tableOccupiedCartBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    gap: 10,
  },
  tableOccupiedCartBannerText: {
    flex: 1,
    color: '#be123c',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
  },
  cartTopSessionBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  cartTopSessionBarActive: {
    backgroundColor: '#f0fdf4',
    borderBottomColor: '#bbf7d0',
  },
  cartTopSessionBarUrgent: {
    backgroundColor: '#fffbeb',
    borderBottomColor: '#fde68a',
  },
  cartTopSessionBarExpired: {
    backgroundColor: '#fef2f2',
    borderBottomColor: '#fecaca',
  },
  cartTopSessionIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cartTopSessionTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  cartTopSessionSub: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
    lineHeight: 15,
  },
  sessionFooterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  sessionFooterBadgeActive: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  sessionFooterBadgeUrgent: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
  },
  sessionFooterBadgeExpired: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  sessionFooterBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  // Direct NPCI UPI Modal Styles
  upiModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    zIndex: 9999,
  },
  upiModalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    width: '100%',
    maxWidth: 440,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 10,
  },
  upiModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  upiModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  upiAmountCard: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    marginVertical: 10,
  },
  upiAmountLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  upiAmountValue: {
    fontSize: 28,
    fontWeight: '900',
    color: '#15803d',
    marginVertical: 4,
  },
  upiOrderBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    marginTop: 2,
  },
  upiOrderBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803d',
  },
  upiPayeeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    marginVertical: 6,
    gap: 8,
  },
  upiPayeeLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  upiPayeeName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 2,
  },
  upiPayeeId: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0284c7',
    marginTop: 1,
  },
  upiCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
  },
  upiCopyBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  upiSectionHeading: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  upiAppBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#15803d',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#15803d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  upiAppBtnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  upiAppBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  upiAppBtnSecondary: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
  },
  upiAppBtnSecondaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  upiQrToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    marginVertical: 6,
  },
  upiQrToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  upiQrBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    marginVertical: 8,
  },
  upiQrHint: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 8,
    textAlign: 'center',
  },
  upiAutoReturnCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#dcfce7',
    borderRadius: 10,
    padding: 10,
    marginVertical: 6,
  },
  upiAutoReturnText: {
    flex: 1,
    fontSize: 11,
    color: '#166534',
    lineHeight: 16,
    fontWeight: '500',
  },
  upiUtrCard: {
    backgroundColor: '#fafaf9',
    borderWidth: 1,
    borderColor: '#e7e5e4',
    borderRadius: 12,
    padding: 12,
    marginVertical: 8,
  },
  upiUtrTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#292524',
    marginBottom: 6,
  },
  upiUtrInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  upiUtrInput: {
    flex: 1,
    height: 42,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d6d3d1',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: '600',
    color: '#1c1917',
    letterSpacing: 1,
  },
  upiPasteBtn: {
    backgroundColor: '#e7e5e4',
    paddingHorizontal: 12,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  upiPasteBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#44403c',
  },
  upiUtrError: {
    color: '#dc2626',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  upiUtrHelpBox: {
    backgroundColor: '#f5f5f4',
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
    gap: 4,
  },
  upiUtrHelpItem: {
    fontSize: 11,
    color: '#57534e',
    lineHeight: 15,
  },
  upiModalFooter: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 8,
  },
  upiSubmitUtrBtn: {
    backgroundColor: '#15803d',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upiSubmitUtrBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  upiCancelBtn: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  upiCancelBtnText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
});
