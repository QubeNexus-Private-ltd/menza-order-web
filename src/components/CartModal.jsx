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
  Banknote,
  ShieldCheck,
  AlertTriangle,
  ImageOff,
} from 'lucide-react';
import * as api from '../services/api';

function ItemImageWithFallback({
  uri,
  isVeg,
  style,
  resizeMode = 'cover',
}) {
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

const getOrderTypeIcon = (typeName) => {
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

const money = (value) => {
  const number = Number(value);

  return Number.isFinite(number)
    ? number.toFixed(2)
    : '0.00';
};

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
}) {
  const [guestName, setGuestName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [remarks, setRemarks] = useState('');
  const [orderTypeId, setOrderTypeId] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState('cashfree');
  const [errorMsg, setErrorMsg] = useState('');
  const [processingPayment, setProcessingPayment] =
    useState(false);
  const [fetchingCart, setFetchingCart] = useState(false);
  const [updatingItemId, setUpdatingItemId] = useState(null);
  const [removingItemId, setRemovingItemId] = useState(null);
  const [clearingCart, setClearingCart] = useState(false);
  const [liveOrderTypes, setLiveOrderTypes] = useState([]);

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

  // Backend is authoritative for billing values.
  const subTotal = Number(cart?.subTotal ?? 0);
  const discountAmount = Number(
    cart?.discountAmount ?? 0
  );
  const taxableAmount = Number(
    cart?.taxableAmount ?? 0
  );
  const cgst = Number(cart?.cgstAmount ?? 0);
  const sgst = Number(cart?.sgstAmount ?? 0);
  const cgstPercentage = Number(
    cart?.cgstPercentage ?? 2.5
  );
  const sgstPercentage = Number(
    cart?.sgstPercentage ?? 2.5
  );
  const gstNumber = cart?.gstNumber || null;
  const taxAmount = Number(
    cart?.taxAmount ?? cgst + sgst
  );
  const platformFee = Number(
    cart?.platformFee ?? 0
  );
  const grandTotal = Number(
    cart?.totalAmount ?? 0
  );

  const hasUnavailableItems =
    Boolean(cart?.hasUnavailableItems) ||
    activeCartItems.some(
      (item) => item.isAvailable === false
    );

  const isItemBusy = (itemId) =>
    updatingItemId === itemId ||
    removingItemId === itemId;

  const handleQuantityChange = async (
    item,
    nextQuantity
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
    } catch (error) {
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

  const handleRemoveItem = async (itemId) => {
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
    } catch (error) {
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
    } catch (error) {
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

    if (hasUnavailableItems) {
      setErrorMsg(
        'Please remove out-of-stock items from your cart before proceeding.'
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
      (item) => ({
        itemId: item.itemId,
        quantity: item.quantity,
        unitId: item.unit || 1,
        cookingInstruction:
          item.cookingInstruction || null,
      })
    );

    const cleanPhone = phoneDigits.slice(-10);

    const orderPayload = {
      restaurantId: restId,
      name: guestName.trim(),
      mobileNumber: cleanPhone,
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
      paymentMode:
        paymentMethod === 'cashfree'
          ? 'ONLINE'
          : 'CASH',
      paymentMethod:
        paymentMethod === 'cashfree'
          ? 'CASHFREE_SPLIT'
          : 'COUNTER_CASH',
      paymentStatus: 'Pending',
      orderStatus:
        paymentMethod === 'cashfree'
          ? 'PendingPayment'
          : 'Placed',
      source: 'QR_DINEIN',
      gstNumber: gstNumber || null,
      cgstPercentage,
      sgstPercentage,
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

        const checkoutRes =
          await api.initiateCashfreeCheckout({
            restaurantId: restId,
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

        await api.createPendingPaymentOrder({
          ...orderPayload,
          tableId:
            isTableOrdering && activeTable
              ? activeTable.id
              : null,
          tableNumber: effectiveTable,
          paymentStatus: 'Pending',
          orderStatus: 'PendingPayment',
          paymentOrderId: cashfreeOrderId,
          cashfreeOrderId,
          subTotal: subTotal,
          cgstAmount: cgst,
          sgstAmount: sgst,
          totalAmount: grandTotal,
        });

        if (
          typeof window !== 'undefined' &&
          window.Cashfree &&
          paymentSessionId
        ) {
          try {
            const cashfree =
              window.Cashfree({
                mode: 'sandbox',
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

        await onPlaceOrder({
          ...orderPayload,
          paymentStatus:
            checkoutRes?.status ===
              'SUCCESS' ||
            checkoutRes?.status === 'PAID'
              ? 'SUCCESS'
              : 'Pending',
          paymentOrderId:
            cashfreeOrderId,
          cashfreeOrderId,
        });
      } catch (err) {
        console.error(
          'Cashfree checkout API error:',
          err
        );

        setErrorMsg(
          err?.response?.data?.message ||
            err?.message ||
            'Unable to initiate Cashfree payment. Please try again or choose Pay at Counter.'
        );

        setProcessingPayment(false);
      }
    } else {
      try {
        await onPlaceOrder(
          orderPayload
        );
      } catch (error) {
        console.error(
          'Place order error:',
          error
        );

        setErrorMsg(
          error?.response?.data?.message ||
            error?.message ||
            'Unable to place order.'
        );
      }
    }
  };

  if (!visible) return null;

  const isLoadingState =
    loading || processingPayment;

  const totalQuantity =
    activeCartItems.reduce(
      (acc, item) =>
        acc + Number(item.quantity || 0),
      0
    );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
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
                      Selected Items (
                      {totalQuantity})
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
                    (item) => {
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

                      const unitDescription =
                        api.getUnitDescription
                          ? api.getUnitDescription(
                              item
                            )
                          : item.unitName ||
                            'Piece';

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

                              {/* Changed:
                                  "Unit: Plate"
                                  is now simply "Plate"
                              */}
                              {unitDescription ? (
                                <Text
                                  style={
                                    styles.itemMetaText
                                  }
                                >
                                  {
                                    unitDescription
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
                                      styles.quantityBadgeText
                                    }
                                  >
                                    Quantity:{' '}
                                    <Text
                                      style={
                                        styles.quantityBadgeBold
                                      }
                                    >
                                      {
                                        item.quantity
                                      }
                                    </Text>

                                    {unitDescription
                                      ? ` • ${unitDescription}`
                                      : ''}
                                  </Text>
                                </View>
                              </View>

                              {/* Unit Price row removed */}

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
                                    (m) => (
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
                                  {
                                    item.quantity
                                  }{' '}
                                  × ₹
                                  {money(
                                    itemUnitPrice
                                  )}
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
                      (type) => {
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
                              {
                                type.typeName
                              }

                              {type.id ===
                                1 &&
                              activeTable
                                ? ` (Table #${activeTable.id})`
                                : ''}
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
                        styles.textInput
                      }
                      placeholder="Enter guest / diner name"
                      placeholderTextColor="#64748b"
                      value={guestName}
                      onChangeText={
                        setGuestName
                      }
                    />
                  </View>

                  <View
                    style={styles.inputGroup}
                  >
                    <Text
                      style={styles.inputLabel}
                    >
                      Mobile Number *
                    </Text>

                    <TextInput
                      style={
                        styles.textInput
                      }
                      placeholder="Enter 10-digit mobile number *"
                      placeholderTextColor="#64748b"
                      keyboardType="phone-pad"
                      maxLength={15}
                      value={
                        mobileNumber
                      }
                      onChangeText={
                        setMobileNumber
                      }
                    />
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
                      ]}
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
                    <TouchableOpacity
                      style={[
                        styles.paymentCard,
                        paymentMethod ===
                          'cashfree' &&
                          styles.paymentCardActive,
                      ]}
                      onPress={() =>
                        setPaymentMethod(
                          'cashfree'
                        )
                      }
                    >
                      <CreditCard
                        size={20}
                        color={
                          paymentMethod ===
                          'cashfree'
                            ? '#10b981'
                            : '#94a3b8'
                        }
                      />

                      <View>
                        <Text
                          style={[
                            styles.paymentCardTitle,
                            paymentMethod ===
                              'cashfree' &&
                              styles.paymentCardTitleActive,
                          ]}
                        >
                          Cashfree Direct Pay
                        </Text>

                        <Text
                          style={
                            styles.paymentCardSub
                          }
                        >
                          UPI • Cards • NetBanking
                        </Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.paymentCard,
                        paymentMethod ===
                          'counter' &&
                          styles.paymentCardActive,
                      ]}
                      onPress={() =>
                        setPaymentMethod(
                          'counter'
                        )
                      }
                    >
                      <Banknote
                        size={20}
                        color={
                          paymentMethod ===
                          'counter'
                            ? '#10b981'
                            : '#94a3b8'
                        }
                      />

                      <View>
                        <Text
                          style={[
                            styles.paymentCardTitle,
                            paymentMethod ===
                              'counter' &&
                              styles.paymentCardTitleActive,
                          ]}
                        >
                          Pay at Counter / Table
                        </Text>

                        <Text
                          style={
                            styles.paymentCardSub
                          }
                        >
                          Cash / POS at Table
                        </Text>
                      </View>
                    </TouchableOpacity>
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
                      Total Tax
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

                  {platformFee > 0 ? (
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
                        Platform Fee
                      </Text>

                      <Text
                        style={
                          styles.summaryValue
                        }
                      >
                        ₹
                        {money(
                          platformFee
                        )}
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
                      Zero Platform Fee for Customers
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
                    hasUnavailableItems) &&
                    styles.checkoutBtnDisabled,
                ]}
                onPress={
                  handleCheckout
                }
                disabled={
                  isLoadingState ||
                  hasUnavailableItems
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
                      {paymentMethod ===
                      'cashfree'
                        ? 'PAY VIA CASHFREE'
                        : 'CONFIRM & PLACE ORDER'}{' '}
                      • ₹
                      {money(
                        grandTotal
                      )}
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
    backgroundColor:
      'rgba(27, 28, 28, 0.65)',
    justifyContent: 'flex-end',
  },

  sheetContainer: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    minHeight: '60%',
    borderWidth: 1,
    borderColor: '#E0DDD8',
  },

  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0DDD8',
    backgroundColor: '#FBF9F9',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },

  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  headerTitle: {
    color: '#1B1C1C',
    fontSize: 18,
    fontWeight: '800',
  },

  headerSubTitle: {
    color: '#D33401',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },

  closeBtn: {
    padding: 6,
  },

  bodyScroll: {
    flex: 1,
    backgroundColor: '#FBF9F9',
  },

  bodyContent: {
    padding: 20,
    gap: 16,
  },

  emptyCartBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },

  emptyCartTitle: {
    color: '#1B1C1C',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 14,
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
    gap: 10,
    backgroundColor:
      'rgba(211, 52, 1, 0.1)',
    borderWidth: 1,
    borderColor: '#D33401',
    padding: 12,
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
    padding: 16,
    gap: 12,
  },

  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
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
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEDED',
    gap: 8,
  },

  cartRowUnavailable: {
    opacity: 0.65,
  },

  cartRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },

  itemThumb: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#EFEDED',
  },

  noImageThumb: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#EFEDED',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E0DDD8',
  },

  itemInfo: {
    flex: 1,
    gap: 3,
  },

  itemNameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },

  itemName: {
    color: '#1B1C1C',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },

  unavailBadge: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 6,
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
    marginTop: 3,
    marginBottom: 2,
  },

  quantityBadge: {
    backgroundColor: '#EFEDED',
    borderWidth: 1,
    borderColor: '#E0DDD8',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },

  quantityBadgeText: {
    color: '#1B1C1C',
    fontSize: 11,
    fontWeight: '500',
  },

  quantityBadgeBold: {
    color: '#1B1C1C',
    fontWeight: '800',
    fontSize: 12,
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
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 3,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },

  instructionText: {
    color: '#1B1C1C',
    fontSize: 11,
    fontWeight: '500',
    flexShrink: 1,
  },

  addNoteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },

  addNoteBtnText: {
    color: '#747878',
    fontSize: 11,
  },

  inlineNoteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },

  inlineNoteInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0DDD8',
    borderRadius: 6,
    paddingHorizontal: 8,
    height: 34,
    color: '#1B1C1C',
    fontSize: 11,
  },

  saveNoteBtn: {
    backgroundColor: '#1B1C1C',
    paddingHorizontal: 10,
    height: 34,
    justifyContent: 'center',
    borderRadius: 6,
  },

  saveNoteBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },

  cancelNoteBtn: {
    paddingHorizontal: 6,
    height: 34,
    justifyContent: 'center',
  },

  cancelNoteBtnText: {
    color: '#747878',
    fontSize: 11,
  },

  actionsRight: {
    alignItems: 'flex-end',
    gap: 7,
    minWidth: 82,
  },

  qtyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EFEDED',
    borderRadius: 6,
    padding: 3,
    borderWidth: 1,
    borderColor: '#E0DDD8',
  },

  qtyBtn: {
    width: 22,
    height: 22,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  qtyText: {
    color: '#1B1C1C',
    fontWeight: '700',
    fontSize: 13,
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
    fontSize: 14,
  },

  trashBtn: {
    padding: 2,
  },

  formSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0DDD8',
    padding: 16,
    gap: 12,
  },

  orderTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#EFEDED',
    borderRadius: 10,
    padding: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: '#E0DDD8',
  },

  orderTypeTab: {
    flex: 1,
    minWidth: '46%',
    paddingVertical: 9,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },

  orderTypeTabActive: {
    backgroundColor: '#1B1C1C',
  },

  orderTypeText: {
    color: '#444748',
    fontSize: 12,
    fontWeight: '600',
  },

  orderTypeTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },

  inputGroup: {
    gap: 6,
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
    paddingVertical: 10,
    color: '#1B1C1C',
    fontSize: 13,
  },

  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },

  paymentMethodRow: {
    gap: 8,
  },

  paymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0DDD8',
    borderRadius: 12,
  },

  paymentCardActive: {
    borderColor: '#1B1C1C',
    backgroundColor: '#EFEDED',
  },

  paymentCardTitle: {
    color: '#1B1C1C',
    fontSize: 13,
    fontWeight: '700',
  },

  paymentCardTitleActive: {
    color: '#1B1C1C',
  },

  paymentCardSub: {
    color: '#747878',
    fontSize: 11,
    marginTop: 2,
  },

  summarySection: {
    backgroundColor: '#EFEDED',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0DDD8',
    padding: 16,
    gap: 10,
  },

  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  summaryLabel: {
    color: '#444748',
    fontSize: 13,
  },

  summaryValue: {
    color: '#1B1C1C',
    fontSize: 13,
    fontWeight: '600',
  },

  discountValue: {
    color: '#15803d',
    fontSize: 13,
    fontWeight: '700',
  },

  zeroFeeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DCFCE7',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginTop: 4,
  },

  zeroFeeBadgeText: {
    color: '#15803d',
    fontSize: 12,
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
    marginVertical: 4,
  },

  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  grandTotalLabel: {
    color: '#1B1C1C',
    fontSize: 16,
    fontWeight: '800',
  },

  grandTotalValue: {
    color: '#1B1C1C',
    fontSize: 21,
    fontWeight: '800',
  },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor:
      'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: '#ef4444',
    padding: 12,
    borderRadius: 10,
  },

  errorText: {
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },

  footerContainer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E0DDD8',
    backgroundColor: '#FBF9F9',
  },

  checkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#D33401',
    paddingVertical: 14,
    borderRadius: 16,
    shadowColor: '#D33401',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    height: 54,
  },

  checkoutBtnDisabled: {
    backgroundColor: '#A8A29E',
    opacity: 0.6,
  },

  checkoutBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  paymentProcessingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor:
      'rgba(251, 249, 249, 0.95)',
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    borderRadius: 24,
  },

  paymentProcessingTitle: {
    color: '#1B1C1C',
    fontSize: 17,
    fontWeight: '700',
    marginTop: 16,
    textAlign: 'center',
  },

  paymentProcessingSubtitle: {
    color: '#747878',
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 18,
  },
});