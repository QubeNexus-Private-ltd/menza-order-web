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
  Smartphone,
  RefreshCw,
  Send,
  Check,
} from 'lucide-react';
import * as api from '../services/api';
import { joinOrderGroup } from '../services/signalr';
import { Catalog, Table, StoreOperatingStatus, OrderItem } from '../types';
import { ENV } from '../config/env';

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
}: CartModalProps) {
  const [guestName, setGuestName] = useState<string>('');
  const [mobileNumber, setMobileNumber] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [orderTypeId, setOrderTypeId] = useState<number>(1);
  const [paymentMethod, setPaymentMethod] = useState<string>('cashfree');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [processingPayment, setProcessingPayment] = useState<boolean>(false);
  const [fetchingCart, setFetchingCart] = useState<boolean>(false);
  const [updatingItemId, setUpdatingItemId] = useState<any>(null);
  const [removingItemId, setRemovingItemId] = useState<any>(null);
  const [clearingCart, setClearingCart] = useState<boolean>(false);
  const [liveOrderTypes, setLiveOrderTypes] = useState<any[]>([]);

  /* Customer OTP Verification State */
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const [isOtpSent, setIsOtpSent] = useState<boolean>(false);
  const [otpCode, setOtpCode] = useState<string>('');
  const [otpCountdown, setOtpCountdown] = useState<number>(0);
  const [isSendingOtp, setIsSendingOtp] = useState<boolean>(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState<boolean>(false);
  const [otpSuccessMsg, setOtpSuccessMsg] = useState<string>('');
  const [verifiedCustomer, setVerifiedCustomer] = useState<any>(null);

  // Check saved customer login on mount or modal open
  useEffect(() => {
    if (!visible) return;
    const saved = api.getSavedCustomer();
    if (saved && (saved.mobile || saved.token)) {
      if (saved.mobile) setMobileNumber(saved.mobile);
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
    const cleanMobile = mobileNumber.replace(/\D/g, '').slice(-10);
    if (cleanMobile.length < 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number.');
      return;
    }

    try {
      setErrorMsg('');
      setOtpSuccessMsg('');
      setIsSendingOtp(true);

      const restId = cart?.restaurantId || catalog?.restaurantId || null;
      const encRestId = catalog?.encryptedRestaurantId || null;

      await api.generateCustomerOtp(cleanMobile, restId, encRestId);
      setIsOtpSent(true);
      setOtpCountdown(60);
      setOtpSuccessMsg(`OTP sent to +91 ${cleanMobile}`);
    } catch (err: any) {
      console.error('Send OTP error:', err);
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
    const cleanMobile = mobileNumber.replace(/\D/g, '').slice(-10);
    const cleanOtp = otpCode.trim();

    if (cleanMobile.length < 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number.');
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
      } else {
        setErrorMsg('Invalid or expired OTP code.');
      }
    } catch (err: any) {
      console.error('Verify OTP error:', err);
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

  // Refresh server cart and fetch live OrderTypeMaster whenever the modal opens.
  useEffect(() => {
    if (!visible) return;

    let mounted = true;

    const fetchCartAndOrderTypes = async () => {
      setFetchingCart(true);

      try {
        if (onRefreshCart) {
          await onRefreshCart();
        }

        const restId =
          cart?.restaurantId ||
          catalog?.restaurantId ||
          null;

        const types = await api.getOrderTypes(restId);

        if (
          mounted &&
          Array.isArray(types) &&
          types.length > 0
        ) {
          setLiveOrderTypes(types);
        }
      } catch (error) {
        console.error(
          'Cart and OrderTypeMaster refresh error:',
          error
        );

        if (mounted) {
          setErrorMsg(
            'Unable to refresh cart. Please try again.'
          );
        }
      } finally {
        if (mounted) {
          setFetchingCart(false);
        }
      }
    };

    fetchCartAndOrderTypes();

    return () => {
      mounted = false;
    };
  }, [visible]);

  const effectiveOrderTypes =
    Array.isArray(liveOrderTypes) &&
    liveOrderTypes.length > 0
      ? liveOrderTypes
      : Array.isArray(cart?.availableOrderTypes) &&
        cart.availableOrderTypes.length > 0
      ? cart.availableOrderTypes
      : Array.isArray(orderTypes) &&
        orderTypes.length > 0
      ? orderTypes
      : [
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
            description:
              'Express counter POS order processing',
          },
        ];

  const activeCartItems =
    cart && Array.isArray(cart.items)
      ? cart.items
      : cartItems;

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

  // GST percentage resolution: Check cart first, then catalog, default to 2.5% if restaurant has GST
  const cgstPercentage = Number(
    cart?.cgstPercentage ??
    catalog?.cgstPercentage ??
    2.5
  );
  const sgstPercentage = Number(
    cart?.sgstPercentage ??
    catalog?.sgstPercentage ??
    2.5
  );
  const gstNumber = cart?.gstNumber || catalog?.gstNumber || null;

  // Determine if GST is present
  const hasGst = cgstPercentage > 0 || sgstPercentage > 0 || Boolean(gstNumber);

  // CGST and SGST calculation: use cart if > 0, otherwise compute from taxableAmount
  const cgst = Number(cart?.cgstAmount ?? 0) > 0
    ? Number(cart.cgstAmount)
    : (hasGst ? Math.round(taxableAmount * (cgstPercentage / 100) * 100) / 100 : 0);

  const sgst = Number(cart?.sgstAmount ?? 0) > 0
    ? Number(cart.sgstAmount)
    : (hasGst ? Math.round(taxableAmount * (sgstPercentage / 100) * 100) / 100 : 0);

  const taxAmount = Math.round((cgst + sgst) * 100) / 100;
  const platformFee = Number(
    cart?.platformFee ?? 0
  );

  // Grand Total MUST strictly sum GST amount in the total and display on screen!
  const grandTotal = Math.round(
    (taxableAmount + taxAmount + platformFee) * 100
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

      await onRemoveFromCart(itemId);
    } catch (error: any) {
      console.error(
        'Remove cart item error:',
        error
      );

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

      await onClearCart();
    } catch (error: any) {
      console.error(
        'Clear cart error:',
        error
      );

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

    const cleanMobile = mobileNumber.trim();

    if (!cleanMobile) {
      setErrorMsg(
        'Please enter your 10-digit mobile number.'
      );
      return;
    }

    const phoneDigits = cleanMobile.replace(
      /\D/g,
      ''
    );

    if (phoneDigits.length < 10) {
      setErrorMsg(
        'Please enter a valid 10-digit mobile number.'
      );
      return;
    }

    const cleanPhone = phoneDigits.slice(-10);

    // Verify Customer Mobile & OTP before proceeding
    if (!isVerified) {
      if (isOtpSent && otpCode.trim().length >= 4) {
        try {
          await handleVerifyOtp();
        } catch (e) {
          return;
        }
      } else {
        setErrorMsg(
          'Mobile verification required. Please click "Get OTP" to verify your number before placing the order.'
        );
        if (!isOtpSent) {
          handleSendOtp();
        }
        return;
      }
    }

    if (activeTable?.isCleaning) {
      setErrorMsg(
        `Table ${activeTable.tableName || activeTable.id} is currently being sanitized. Please wait for staff to complete turnover.`
      );
      return;
    }

    if (activeTable?.isReserved) {
      setErrorMsg(
        `Table ${activeTable.tableName || activeTable.id} is reserved for scheduled guests. Please speak to staff to be seated.`
      );
      return;
    }

    if (activeTable?.occupiedByOther) {
      setErrorMsg(
        `Table ${activeTable.tableName || activeTable.id} is currently occupied by another party. Orders cannot be placed for this table.`
      );
      return;
    }

    if (hasUnavailableItems) {
      setErrorMsg(
        'Please remove out-of-stock items from your cart before proceeding.'
      );
      return;
    }

    if (storeOperatingStatus && storeOperatingStatus.canPlaceOrder === false) {
      setErrorMsg(
        storeOperatingStatus.statusMessage ||
        (storeOperatingStatus.status === 'PAUSED'
          ? `Kitchen is temporarily paused (${storeOperatingStatus.remainingPauseMinutes || 0}m left). Reopening soon.`
          : 'Kitchen is currently closed for ordering.')
      );
      return;
    }

    if (!activeCartItems.length) {
      setErrorMsg('Your cart is empty.');
      return;
    }

    setErrorMsg('');

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

    const orderPayload = {
      restaurantId: restId,
      name: guestName.trim(),
      mobileNumber: cleanPhone,
      otpCode: isVerified ? null : (otpCode.trim() || null),
      customerUserId: verifiedCustomer?.userId || null,
      remarks: remarks.trim(),
      isHomeDelivery: false,
      orderTypeId,
      tableId: activeTable
        ? activeTable.id
        : null,
      tableNumber: activeTable
        ? String(activeTable.id)
        : '1',
      items: orderItems,
      deliveryType: activeTable ? 'Dine-In' : 'Takeaway / Counter',
      paymentMode:
        paymentMethod === 'cashfree'
          ? 'ONLINE'
          : 'CASH',
      paymentType:
        paymentMethod === 'cashfree'
          ? 'ONLINE_CASHFREE'
          : 'COUNTER_CASH',
      paymentMethod:
        paymentMethod === 'cashfree'
          ? 'CASHFREE_SPLIT'
          : 'COUNTER_CASH',
      paymentStatus:
        paymentMethod === 'cashfree'
          ? 'Paid'
          : 'Pending',
      orderStatus:
        paymentMethod === 'cashfree'
          ? 'Confirmed'
          : 'Placed',
      isOnline: paymentMethod === 'cashfree',
      isSettled: paymentMethod === 'cashfree',
      requiresCashierConfirmation: paymentMethod !== 'cashfree',
      source: 'QR_DINEIN',
      gstNumber: gstNumber || null,
      cgstPercentage,
      sgstPercentage,
      subTotal,
      cgstAmount: cgst,
      sgstAmount: sgst,
      taxAmount,
      totalAmount: grandTotal,
    };

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
          checkoutRes?.payment_session_id ||
          checkoutRes?.data
            ?.paymentSessionId;

        const paymentLink =
          checkoutRes?.paymentLink ||
          checkoutRes?.payment_link ||
          checkoutRes?.data?.paymentLink;

        const cashfreeOrderId =
          checkoutRes?.orderId ||
          checkoutRes?.order_id ||
          checkoutRes?.data?.orderId;

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
          deliveryType: activeTable ? 'Dine-In' : 'Takeaway / Counter',
          paymentMode: 'CASHFREE',
          paymentType: 'ONLINE_CASHFREE',
          paymentStatus: 'Paid',
          orderStatus: 'Confirmed',
          paymentOrderId: cashfreeOrderId,
          cashfreeOrderId,
          subTotal: subTotal,
          itemTotal: subTotal,
          orderAmount: subTotal,
          cgstAmount: cgst,
          sgstAmount: sgst,
          taxAmount: cgst + sgst,
          totalAmount: grandTotal,
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

        if (
          typeof window !== 'undefined' &&
          (window as any).Cashfree &&
          paymentSessionId
        ) {
          try {
            const cfMode =
              ENV.CASHFREE_MODE ||
              (checkoutRes?.environment?.toLowerCase() === 'production' ||
              checkoutRes?.data?.environment?.toLowerCase() === 'production'
                ? 'production'
                : 'sandbox');

            const cashfree =
              (window as any).Cashfree({
                mode: cfMode,
              });

            cashfree.checkout({
              paymentSessionId:
                paymentSessionId,
              redirectTarget: '_self',
            });

            return;
          } catch (sdkError) {
            console.warn(
              'Cashfree SDK checkout fallback to paymentLink:',
              sdkError
            );
          }
        }

        if (paymentLink) {
          window.location.href =
            paymentLink;
          return;
        }
      } catch (err: any) {
        console.error(
          'Cashfree checkout API error:',
          err
        );

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
    loading || processingPayment;

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
          {processingPayment && (
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
                Connecting to Cashfree Payment Gateway...
              </Text>

              <Text
                style={
                  styles.paymentProcessingSubtitle
                }
              >
                Please wait while we redirect you to secure checkout. Do not close or refresh this page.
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
                  color="#334155"
                />

                <Text
                  style={
                    styles.emptyCartTitle
                  }
                >
                  Your Basket is Empty
                </Text>

                <Text
                  style={
                    styles.emptyCartSub
                  }
                >
                  Browse our menu catalog and add delicious dishes.
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
                  <Text
                    style={styles.sectionTitle}
                  >
                    Order Details
                  </Text>

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
                            type.typeName
                          );

                        return (
                          <TouchableOpacity
                            key={type.id}
                            style={[
                              styles.orderTypeTab,
                              isSelected &&
                                styles.orderTypeTabActive,
                            ]}
                            onPress={() =>
                              setOrderTypeId(
                                type.id
                              )
                            }
                            activeOpacity={0.8}
                          >
                            <Text
                              style={[
                                styles.orderTypeText,
                                isSelected &&
                                  styles.orderTypeTextActive,
                              ]}
                            >
                              {icon}{' '}
                              {type.id === 1
                              ? 'Dine-in'
                              : type.typeName}
                            </Text>
                          </TouchableOpacity>
                        );
                      }
                    )}
                  </View>

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

                  {/* Customer Mobile & OTP Verification Flow */}
                  {isVerified ? (
                    <View style={styles.verifiedCard}>
                      <View style={styles.verifiedCardLeft}>
                        <View style={styles.verifiedIconWrap}>
                          <ShieldCheck size={20} color="#15803d" />
                        </View>
                        <View>
                          <View style={styles.verifiedBadgeRow}>
                            <Text style={styles.verifiedBadgeText}>
                              ✓ Mobile Verified
                            </Text>
                          </View>
                          <Text style={styles.verifiedMobileText}>
                            +91 {mobileNumber} {guestName ? `(${guestName})` : ''}
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        onPress={handleResetVerification}
                        style={styles.changePhoneBtn}
                      >
                        <Text style={styles.changePhoneBtnText}>Change</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.inputGroup}>
                      <View style={styles.inputLabelRow}>
                        <Text style={styles.inputLabel}>
                          Mobile Number *
                        </Text>
                        <Text style={styles.inputHelperText}>
                          (Verification required)
                        </Text>
                      </View>

                      <View style={styles.phoneInputRow}>
                        <TextInput
                          style={[
                            styles.textInput,
                            styles.phoneInputFlex,
                          ] as any}
                          placeholder="Enter 10-digit mobile number *"
                          placeholderTextColor="#64748b"
                          keyboardType="phone-pad"
                          maxLength={15}
                          value={mobileNumber}
                          onChangeText={(val) => {
                            setMobileNumber(val);
                            if (isOtpSent) {
                              setIsOtpSent(false);
                              setOtpCode('');
                            }
                          }}
                        />

                        <TouchableOpacity
                          style={[
                            styles.sendOtpBtn,
                            (isSendingOtp || mobileNumber.replace(/\D/g, '').length < 10) &&
                              styles.sendOtpBtnDisabled,
                          ]}
                          disabled={isSendingOtp || mobileNumber.replace(/\D/g, '').length < 10}
                          onPress={handleSendOtp}
                          activeOpacity={0.8}
                        >
                          {isSendingOtp ? (
                            <ActivityIndicator size="small" color="#ffffff" />
                          ) : (
                            <View style={styles.sendOtpBtnContent}>
                              <Smartphone size={14} color="#ffffff" />
                              <Text style={styles.sendOtpBtnText}>
                                {isOtpSent ? 'Resend' : 'Get OTP'}
                              </Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      </View>

                      {/* Success / Info message banner */}
                      {otpSuccessMsg ? (
                        <View style={styles.otpSuccessBanner}>
                          <CheckCircle2 size={14} color="#15803d" />
                          <Text style={styles.otpSuccessBannerText}>
                            {otpSuccessMsg}
                          </Text>
                        </View>
                      ) : null}

                      {/* OTP Input & Verification Card */}
                      {isOtpSent && (
                        <View style={styles.otpCard}>
                          <View style={styles.otpCardHeader}>
                            <View style={styles.otpCardHeaderLeft}>
                              <KeyRound size={16} color="#D33401" />
                              <Text style={styles.otpCardTitle}>
                                Enter 6-Digit OTP
                              </Text>
                            </View>
                            <Text style={styles.otpCardSubtitle}>
                              Sent to +91 {mobileNumber.replace(/\D/g, '').slice(-10)}
                            </Text>
                          </View>

                          <View style={styles.otpInputRow}>
                            <TextInput
                              style={styles.otpInput as any}
                              placeholder="• • • • • •"
                              placeholderTextColor="#94a3b8"
                              keyboardType="number-pad"
                              maxLength={6}
                              value={otpCode}
                              onChangeText={setOtpCode}
                              autoFocus
                            />

                            <TouchableOpacity
                              style={[
                                styles.verifyOtpBtn,
                                (isVerifyingOtp || otpCode.trim().length < 4) &&
                                  styles.verifyOtpBtnDisabled,
                              ]}
                              disabled={isVerifyingOtp || otpCode.trim().length < 4}
                              onPress={handleVerifyOtp}
                              activeOpacity={0.8}
                            >
                              {isVerifyingOtp ? (
                                <ActivityIndicator size="small" color="#ffffff" />
                              ) : (
                                <View style={styles.verifyOtpBtnContent}>
                                  <Check size={14} color="#ffffff" />
                                  <Text style={styles.verifyOtpBtnText}>
                                    Verify OTP
                                  </Text>
                                </View>
                              )}
                            </TouchableOpacity>
                          </View>

                          <View style={styles.otpFooterRow}>
                            {otpCountdown > 0 ? (
                              <Text style={styles.countdownText}>
                                Resend available in {otpCountdown}s
                              </Text>
                            ) : (
                              <TouchableOpacity
                                onPress={handleSendOtp}
                                disabled={isSendingOtp}
                                style={styles.resendBtn}
                              >
                                <RefreshCw size={12} color="#D33401" />
                                <Text style={styles.resendBtnText}>
                                  Resend OTP
                                </Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      )}
                    </View>
                  )}

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

                <View
                  style={styles.formSection}
                >
                  <Text
                    style={styles.sectionTitle}
                  >
                    Payment Method
                  </Text>

                  <View
                    style={
                      styles.paymentMethodRow
                    }
                  >
                    <View
                      style={[
                        styles.paymentCard,
                        styles.paymentCardActive,
                        { flex: 1 }
                      ]}
                    >
                      <CreditCard
                        size={22}
                        color="#10b981"
                      />

                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.paymentCardTitle,
                            styles.paymentCardTitleActive,
                          ]}
                        >
                          Online Direct Pay
                        </Text>

                        <Text
                          style={
                            styles.paymentCardSub
                          }
                        >
                          UPI (GPay / PhonePe / Paytm) • Cards • NetBanking
                        </Text>
                        <Text style={{ fontSize: 11, color: '#10b981', fontWeight: '700', marginTop: 4 }}>
                          ⚡ Instant Auto-Confirmed & Kitchen Dispatched
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Prefer to Pay with Cash Banner */}
                  <View style={{
                    marginTop: 12,
                    padding: 12,
                    borderRadius: 10,
                    backgroundColor: '#fffbeb',
                    borderWidth: 1,
                    borderColor: '#fde68a',
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    gap: 10,
                  }}>
                    <AlertCircle size={18} color="#b45309" style={{ marginTop: 2, flexShrink: 0 }} />
                    <Text style={{
                      flex: 1,
                      fontSize: 12,
                      color: '#92400e',
                      lineHeight: 18,
                      fontWeight: '600'
                    }}>
                      Prefer to pay with Cash? Your waiter can take your order directly at your table/Give order at POS Counter.
                    </Text>
                  </View>
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

                  {gstNumber ? (
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
                        GSTIN: {gstNumber}
                      </Text>
                    </View>
                  ) : null}

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
                      Zero Platform & Payment Gateway Fee for Customers
                    </Text>
                  </View>

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
                  Boolean(activeTable?.isLocked || activeTable?.occupiedByOther)
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
                        : (activeTable?.isOccupied
                            ? 'PAY ONLINE & ADD TO TABLE TAB'
                            : 'PAY ONLINE & PLACE ORDER (UPI / CARDS)') + ` • ₹${money(grandTotal)}`}
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
});
