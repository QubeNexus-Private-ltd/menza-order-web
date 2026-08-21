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
  MessageSquare,
} from 'lucide-react';
import * as api from '../services/api';

const getOrderTypeIcon = (typeName) => {
  const lower = (typeName || '').toLowerCase();
  if (lower.includes('dine')) return '🍽️';
  if (lower.includes('pickup') || lower.includes('takeaway') || lower.includes('self')) return '🛍️';
  if (lower.includes('delivery')) return '🛵';
  if (lower.includes('counter') || lower.includes('pos')) return '🧾';
  return '📋';
};

const money = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(2) : '0.00';
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
  const [processingPayment, setProcessingPayment] = useState(false);
  const [fetchingCart, setFetchingCart] = useState(false);
  const [editingNotesItemId, setEditingNotesItemId] = useState(null);
  const [itemNoteText, setItemNoteText] = useState('');
  const [updatingItemId, setUpdatingItemId] = useState(null);
  const [removingItemId, setRemovingItemId] = useState(null);
  const [clearingCart, setClearingCart] = useState(false);
  const [savingNoteItemId, setSavingNoteItemId] = useState(null);

  // Keep the existing behavior: refresh the server cart whenever the modal opens.
 useEffect(() => {
  if (!visible || !onRefreshCart) return;

  let mounted = true;

  setFetchingCart(true);

  Promise.resolve(onRefreshCart())
    .catch((error) => {
      console.error('Cart refresh error:', error);

      if (mounted) {
        setErrorMsg('Unable to refresh cart. Please try again.');
      }
    })
    .finally(() => {
      if (mounted) {
        setFetchingCart(false);
      }
    });

  return () => {
    mounted = false;
  };
}, [visible]);
  const effectiveOrderTypes =
    Array.isArray(orderTypes) && orderTypes.length > 0
      ? orderTypes
      : [
          { id: 1, typeName: 'Dine-In', description: 'Dine-In order type' },
          { id: 2, typeName: 'Self Pickup', description: 'Self Pickup / Takeaway' },
          { id: 3, typeName: 'Delivery', description: 'Delivery order type' },
          { id: 4, typeName: 'Counter POS Ordering', description: 'Express counter POS order processing' },
        ];

  const activeCartItems =
    cart && Array.isArray(cart.items) ? cart.items : cartItems;

  // The backend is authoritative for these values.
  // The old frontend 2.5% tax calculation has intentionally been removed.
  const subTotal = Number(cart?.subTotal ?? 0);
  const discountAmount = Number(cart?.discountAmount ?? 0);
  const taxableAmount = Number(cart?.taxableAmount ?? 0);
  const cgst = Number(cart?.cgstAmount ?? 0);
  const sgst = Number(cart?.sgstAmount ?? 0);
  const taxAmount = Number(cart?.taxAmount ?? (cgst + sgst));
  const platformFee = Number(cart?.platformFee ?? 0);
  const grandTotal = Number(cart?.totalAmount ?? 0);
  const hasUnavailableItems =
    Boolean(cart?.hasUnavailableItems) ||
    activeCartItems.some((item) => item.isAvailable === false);

  const isItemBusy = (itemId) =>
    updatingItemId === itemId ||
    removingItemId === itemId ||
    savingNoteItemId === itemId;

  const handleOpenNoteEditor = (item) => {
    setErrorMsg('');
    setEditingNotesItemId(item.itemId);
    setItemNoteText(item.cookingInstruction || '');
  };

  const handleSaveNote = async (itemId, currentQty) => {
    if (!onUpdateCartQuantity) return;

    try {
      setErrorMsg('');
      setSavingNoteItemId(itemId);

      await onUpdateCartQuantity(
        itemId,
        currentQty,
        itemNoteText.trim() || null
      );

      setEditingNotesItemId(null);
      setItemNoteText('');
    } catch (error) {
      console.error('Save cart note error:', error);
      setErrorMsg(
        error?.response?.data?.message ||
          error?.message ||
          'Unable to save special instruction.'
      );
    } finally {
      setSavingNoteItemId(null);
    }
  };

  const handleQuantityChange = async (item, nextQuantity) => {
    if (!onUpdateCartQuantity || isItemBusy(item.itemId)) return;

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
      console.error('Update cart quantity error:', error);
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
    if (!onRemoveFromCart || isItemBusy(itemId)) return;

    try {
      setErrorMsg('');
      setRemovingItemId(itemId);
      await onRemoveFromCart(itemId);
    } catch (error) {
      console.error('Remove cart item error:', error);
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
      console.error('Clear cart error:', error);
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
      setErrorMsg('Please enter customer / guest name.');
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

    // Existing order business logic is preserved.
    const orderItems = activeCartItems.map((item) => ({
      itemId: item.itemId,
      quantity: item.quantity,
      unitId: item.unit || 1,
      cookingInstruction: item.cookingInstruction || null,
    }));

    const orderPayload = {
      restaurantId: restId,
      name: guestName.trim(),
      mobileNumber: mobileNumber.trim(),
      remarks: remarks.trim(),
      isHomeDelivery: false,
      orderTypeId,
      tableId: activeTable ? activeTable.id : null,
      tableNumber: activeTable ? String(activeTable.id) : '1',
      items: orderItems,
      paymentMode: paymentMethod === 'cashfree' ? 'ONLINE' : 'CASH',
      paymentMethod:
        paymentMethod === 'cashfree'
          ? 'CASHFREE_SPLIT'
          : 'COUNTER_CASH',
    };

    if (paymentMethod === 'cashfree') {
      setProcessingPayment(true);

      try {
        const checkoutRes = await api.initiateCashfreeCheckout({
          restaurantId: restId,
          amount: Math.round(grandTotal * 100) / 100,
          customerName: guestName.trim(),
          customerPhone: mobileNumber || '9999999999',
          tableNumber: activeTable ? String(activeTable.id) : '1',
          orderNotes: remarks,
        });

        if (checkoutRes && checkoutRes.paymentLink) {
          window.location.href = checkoutRes.paymentLink;
          return;
        }

        await onPlaceOrder({
          ...orderPayload,
          cashfreeOrderId: checkoutRes?.orderId || null,
        });
      } catch (err) {
        console.error('Cashfree checkout error:', err);

        // Preserve the existing fallback behavior.
        try {
          await onPlaceOrder(orderPayload);
        } catch (orderError) {
          console.error('Fallback place order error:', orderError);
          setErrorMsg(
            orderError?.response?.data?.message ||
              orderError?.message ||
              'Unable to place order.'
          );
        }
      } finally {
        setProcessingPayment(false);
      }
    } else {
      try {
        await onPlaceOrder(orderPayload);
      } catch (error) {
        console.error('Place order error:', error);
        setErrorMsg(
          error?.response?.data?.message ||
            error?.message ||
            'Unable to place order.'
        );
      }
    }
  };

  if (!visible) return null;

  const isLoadingState = loading || processingPayment;
  const totalQuantity = activeCartItems.reduce(
    (acc, item) => acc + Number(item.quantity || 0),
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
          <View style={styles.sheetHeader}>
            <View style={styles.headerTitleRow}>
              <ShoppingBag size={20} color="#10b981" />
              <View>
                <Text style={styles.headerTitle}>Your Order Basket</Text>
                {cart?.restaurantName ? (
                  <Text style={styles.headerSubTitle}>
                    {cart.restaurantName}
                  </Text>
                ) : null}
              </View>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.bodyScroll}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
          >
            {fetchingCart && activeCartItems.length === 0 ? (
              <View style={styles.emptyCartBox}>
                <ActivityIndicator size="large" color="#10b981" />
                <Text style={styles.emptyCartTitle}>
                  Loading Basket Items...
                </Text>
                <Text style={styles.emptyCartSub}>
                  Retrieving your cart items from the server.
                </Text>
              </View>
            ) : activeCartItems.length === 0 ? (
              <View style={styles.emptyCartBox}>
                <ShoppingBag size={48} color="#334155" />
                <Text style={styles.emptyCartTitle}>
                  Your Basket is Empty
                </Text>
                <Text style={styles.emptyCartSub}>
                  Browse our menu catalog and add delicious dishes.
                </Text>
              </View>
            ) : (
              <>
                {hasUnavailableItems && (
                  <View style={styles.outOfStockBanner}>
                    <AlertTriangle size={18} color="#f59e0b" />
                    <Text style={styles.outOfStockBannerText}>
                      Some items are currently unavailable. Please remove them
                      to place your order.
                    </Text>
                  </View>
                )}

                <View style={styles.itemsSection}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionTitle}>
                      Selected Items ({totalQuantity})
                    </Text>

                    <TouchableOpacity
                      onPress={handleClearCartClick}
                      disabled={clearingCart}
                    >
                      {clearingCart ? (
                        <ActivityIndicator size="small" color="#ef4444" />
                      ) : (
                        <Text style={styles.clearText}>Clear All</Text>
                      )}
                    </TouchableOpacity>
                  </View>

                  {activeCartItems.map((item) => {
                    const isEditingNote =
                      editingNotesItemId === item.itemId;

                    const itemUnitPrice = Number(
                      item.unitPrice ?? item.amount ?? 0
                    );

                    const itemLineTotal = Number(
                      item.totalAmount ??
                        itemUnitPrice * Number(item.quantity || 0)
                    );

                    const unitLabel =
                      item.unitName ||
                      (item.unit !== undefined &&
                      item.unit !== null &&
                      item.unit !== ''
                        ? `Unit #${item.unit}`
                        : null);

                    return (
                      <View
                        key={item.itemId}
                        style={[
                          styles.cartRowWrapper,
                          !item.isAvailable &&
                            styles.cartRowUnavailable,
                        ]}
                      >
                        <View style={styles.cartRow}>
                          <Image
                            source={{
                              uri:
                                item.imageUrl ||
                                'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600',
                            }}
                            style={styles.itemThumb}
                          />

                          <View style={styles.itemInfo}>
                            <View style={styles.itemNameRow}>
                              <Text
                                style={styles.itemName}
                                numberOfLines={2}
                              >
                                {item.itemName}
                              </Text>

                              {!item.isAvailable && (
                                <View style={styles.unavailBadge}>
                                  <Text style={styles.unavailBadgeText}>
                                    Out of Stock
                                  </Text>
                                </View>
                              )}
                            </View>

                            {item.variantName ? (
                              <Text style={styles.itemMetaText}>
                                Size: {item.variantName}
                              </Text>
                            ) : null}

                            {unitLabel ? (
                              <Text style={styles.itemMetaText}>
                                Unit: {unitLabel}
                              </Text>
                            ) : null}

                            <View style={styles.priceRow}>
                              <Text style={styles.priceLabel}>
                                Unit Price
                              </Text>
                              <Text style={styles.itemPriceSingle}>
                                ₹{money(itemUnitPrice)}
                              </Text>
                            </View>

                            {Array.isArray(item.modifiers) &&
                              item.modifiers.length > 0 && (
                                <View style={styles.modifierRow}>
                                  {item.modifiers.map((m) => (
                                    <View
                                      key={m.modifierId}
                                      style={styles.modifierBadge}
                                    >
                                      <Text
                                        style={styles.modifierBadgeText}
                                      >
                                        +{m.modifierName} (₹
                                        {money(m.extraPrice)})
                                      </Text>
                                    </View>
                                  ))}
                                </View>
                              )}

                            {item.cookingInstruction &&
                            !isEditingNote ? (
                              <TouchableOpacity
                                style={styles.instructionPill}
                                onPress={() =>
                                  handleOpenNoteEditor(item)
                                }
                              >
                                <MessageSquare
                                  size={11}
                                  color="#10b981"
                                />
                                <Text
                                  style={styles.instructionText}
                                  numberOfLines={1}
                                >
                                  {item.cookingInstruction}
                                </Text>
                              </TouchableOpacity>
                            ) : null}
                          </View>

                          <View style={styles.actionsRight}>
                            <View style={styles.qtyBox}>
                              <TouchableOpacity
                                style={styles.qtyBtn}
                                disabled={isItemBusy(item.itemId)}
                                onPress={() =>
                                  handleQuantityChange(
                                    item,
                                    Number(item.quantity || 0) - 1
                                  )
                                }
                              >
                                {updatingItemId === item.itemId ? (
                                  <ActivityIndicator
                                    size="small"
                                    color="#ffffff"
                                  />
                                ) : (
                                  <Minus size={12} color="#ffffff" />
                                )}
                              </TouchableOpacity>

                              <Text style={styles.qtyText}>
                                {item.quantity}
                              </Text>

                              <TouchableOpacity
                                style={styles.qtyBtn}
                                disabled={isItemBusy(item.itemId)}
                                onPress={() =>
                                  handleQuantityChange(
                                    item,
                                    Number(item.quantity || 0) + 1
                                  )
                                }
                              >
                                <Plus size={12} color="#ffffff" />
                              </TouchableOpacity>
                            </View>

                            <View style={styles.itemTotalRow}>
                              <Text style={styles.itemTotalLabel}>
                                Item Total
                              </Text>
                              <Text style={styles.itemSubtotal}>
                                ₹{money(itemLineTotal)}
                              </Text>
                            </View>

                            <TouchableOpacity
                              style={styles.trashBtn}
                              disabled={isItemBusy(item.itemId)}
                              onPress={() =>
                                handleRemoveItem(item.itemId)
                              }
                            >
                              {removingItemId === item.itemId ? (
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

                        {isEditingNote ? (
                          <View style={styles.inlineNoteBox}>
                            <TextInput
                              style={styles.inlineNoteInput}
                              placeholder="Special chef note (e.g. less spicy)..."
                              placeholderTextColor="#64748b"
                              value={itemNoteText}
                              onChangeText={setItemNoteText}
                              editable={
                                savingNoteItemId !== item.itemId
                              }
                            />

                            <TouchableOpacity
                              style={styles.saveNoteBtn}
                              disabled={
                                savingNoteItemId === item.itemId
                              }
                              onPress={() =>
                                handleSaveNote(
                                  item.itemId,
                                  item.quantity
                                )
                              }
                            >
                              {savingNoteItemId === item.itemId ? (
                                <ActivityIndicator
                                  size="small"
                                  color="#0f172a"
                                />
                              ) : (
                                <Text style={styles.saveNoteBtnText}>
                                  Save
                                </Text>
                              )}
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={styles.cancelNoteBtn}
                              disabled={
                                savingNoteItemId === item.itemId
                              }
                              onPress={() => {
                                setEditingNotesItemId(null);
                                setItemNoteText('');
                              }}
                            >
                              <Text style={styles.cancelNoteBtnText}>
                                Cancel
                              </Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          !item.cookingInstruction && (
                            <TouchableOpacity
                              style={styles.addNoteBtn}
                              onPress={() =>
                                handleOpenNoteEditor(item)
                              }
                            >
                              <MessageSquare
                                size={11}
                                color="#64748b"
                              />
                              <Text style={styles.addNoteBtnText}>
                                + Add special instruction
                              </Text>
                            </TouchableOpacity>
                          )
                        )}
                      </View>
                    );
                  })}
                </View>

                <View style={styles.formSection}>
                  <Text style={styles.sectionTitle}>Order Details</Text>

                  <View style={styles.orderTypeContainer}>
                    {effectiveOrderTypes.map((type) => {
                      const isSelected = orderTypeId === type.id;
                      const icon = getOrderTypeIcon(type.typeName);

                      return (
                        <TouchableOpacity
                          key={type.id}
                          style={[
                            styles.orderTypeTab,
                            isSelected &&
                              styles.orderTypeTabActive,
                          ]}
                          onPress={() => setOrderTypeId(type.id)}
                          activeOpacity={0.8}
                        >
                          <Text
                            style={[
                              styles.orderTypeText,
                              isSelected &&
                                styles.orderTypeTextActive,
                            ]}
                          >
                            {icon} {type.typeName}
                            {type.id === 1 && activeTable
                              ? ` (Table #${activeTable.id})`
                              : ''}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>
                      Customer Name *
                    </Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Enter guest / diner name"
                      placeholderTextColor="#64748b"
                      value={guestName}
                      onChangeText={setGuestName}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>
                      Mobile Number (Optional)
                    </Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Enter 10-digit mobile number"
                      placeholderTextColor="#64748b"
                      keyboardType="phone-pad"
                      value={mobileNumber}
                      onChangeText={setMobileNumber}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>
                      Order Remarks / Instructions
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
                      onChangeText={setRemarks}
                    />
                  </View>
                </View>

                <View style={styles.formSection}>
                  <Text style={styles.sectionTitle}>
                    Payment Method
                  </Text>

                  <View style={styles.paymentMethodRow}>
                    <TouchableOpacity
                      style={[
                        styles.paymentCard,
                        paymentMethod === 'cashfree' &&
                          styles.paymentCardActive,
                      ]}
                      onPress={() => setPaymentMethod('cashfree')}
                    >
                      <CreditCard
                        size={20}
                        color={
                          paymentMethod === 'cashfree'
                            ? '#10b981'
                            : '#94a3b8'
                        }
                      />
                      <View>
                        <Text
                          style={[
                            styles.paymentCardTitle,
                            paymentMethod === 'cashfree' &&
                              styles.paymentCardTitleActive,
                          ]}
                        >
                          Cashfree Direct Pay
                        </Text>
                        <Text style={styles.paymentCardSub}>
                          UPI • Cards • NetBanking
                        </Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.paymentCard,
                        paymentMethod === 'counter' &&
                          styles.paymentCardActive,
                      ]}
                      onPress={() => setPaymentMethod('counter')}
                    >
                      <Banknote
                        size={20}
                        color={
                          paymentMethod === 'counter'
                            ? '#10b981'
                            : '#94a3b8'
                        }
                      />
                      <View>
                        <Text
                          style={[
                            styles.paymentCardTitle,
                            paymentMethod === 'counter' &&
                              styles.paymentCardTitleActive,
                          ]}
                        >
                          Pay at Counter / Table
                        </Text>
                        <Text style={styles.paymentCardSub}>
                          Cash / POS at Table
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.summarySection}>
                  <Text style={styles.sectionTitle}>
                    Bill Breakdown
                  </Text>

                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>
                      Item Subtotal
                    </Text>
                    <Text style={styles.summaryValue}>
                      ₹{money(subTotal)}
                    </Text>
                  </View>

                  {discountAmount > 0 ? (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>
                        Discount
                      </Text>
                      <Text style={styles.discountValue}>
                        -₹{money(discountAmount)}
                      </Text>
                    </View>
                  ) : null}

                  {taxableAmount > 0 ? (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>
                        Taxable Amount
                      </Text>
                      <Text style={styles.summaryValue}>
                        ₹{money(taxableAmount)}
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>
                      CGST
                    </Text>
                    <Text style={styles.summaryValue}>
                      ₹{money(cgst)}
                    </Text>
                  </View>

                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>
                      SGST
                    </Text>
                    <Text style={styles.summaryValue}>
                      ₹{money(sgst)}
                    </Text>
                  </View>

                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>
                      Total Tax
                    </Text>
                    <Text style={styles.summaryValue}>
                      ₹{money(taxAmount)}
                    </Text>
                  </View>

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

                  <View style={styles.zeroFeeBadge}>
                    <ShieldCheck size={14} color="#10b981" />
                    <Text style={styles.zeroFeeBadgeText}>
                      Zero Platform Fee for Customers
                    </Text>
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.grandTotalRow}>
                    <Text style={styles.grandTotalLabel}>
                      Total Payable
                    </Text>
                    <Text style={styles.grandTotalValue}>
                      ₹{money(grandTotal)}
                    </Text>
                  </View>
                </View>

                {errorMsg ? (
                  <View style={styles.errorBanner}>
                    <AlertCircle size={16} color="#ef4444" />
                    <Text style={styles.errorText}>
                      {errorMsg}
                    </Text>
                  </View>
                ) : null}
              </>
            )}
          </ScrollView>

          {activeCartItems.length > 0 && (
            <View style={styles.footerContainer}>
              <TouchableOpacity
                style={[
                  styles.checkoutBtn,
                  (isLoadingState || hasUnavailableItems) &&
                    styles.checkoutBtnDisabled,
                ]}
                onPress={handleCheckout}
                disabled={isLoadingState || hasUnavailableItems}
                activeOpacity={0.85}
              >
                {isLoadingState ? (
                  <ActivityIndicator
                    size="small"
                    color="#0f172a"
                  />
                ) : (
                  <>
                    <Text style={styles.checkoutBtnText}>
                      {paymentMethod === 'cashfree'
                        ? 'PAY VIA CASHFREE'
                        : 'CONFIRM & PLACE ORDER'}{' '}
                      • ₹{money(grandTotal)}
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
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    minHeight: '60%',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },
  headerSubTitle: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  bodyScroll: {
    flex: 1,
  },
  bodyContent: {
    padding: 20,
    gap: 20,
  },
  emptyCartBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyCartTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 14,
  },
  emptyCartSub: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  outOfStockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: '#f59e0b',
    padding: 12,
    borderRadius: 12,
  },
  outOfStockBannerText: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  itemsSection: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
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
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  clearText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '600',
  },
  cartRowWrapper: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
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
    borderRadius: 10,
    backgroundColor: '#0f172a',
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
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  unavailBadge: {
    backgroundColor: '#ef4444',
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
    color: '#94a3b8',
    fontSize: 11,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 3,
  },
  priceLabel: {
    color: '#64748b',
    fontSize: 11,
  },
  itemPriceSingle: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  modifierRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  modifierBadge: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  modifierBadgeText: {
    color: '#a78bfa',
    fontSize: 10,
    fontWeight: '500',
  },
  instructionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 3,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  instructionText: {
    color: '#10b981',
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
    color: '#64748b',
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
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 6,
    paddingHorizontal: 8,
    height: 34,
    color: '#ffffff',
    fontSize: 11,
  },
  saveNoteBtn: {
    backgroundColor: '#10b981',
    paddingHorizontal: 10,
    height: 34,
    justifyContent: 'center',
    borderRadius: 6,
  },
  saveNoteBtnText: {
    color: '#0f172a',
    fontSize: 11,
    fontWeight: '700',
  },
  cancelNoteBtn: {
    paddingHorizontal: 6,
    height: 34,
    justifyContent: 'center',
  },
  cancelNoteBtnText: {
    color: '#94a3b8',
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
    backgroundColor: '#0f172a',
    borderRadius: 6,
    padding: 4,
  },
  qtyBtn: {
    width: 22,
    height: 22,
    borderRadius: 4,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    color: '#ffffff',
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
    color: '#64748b',
    fontSize: 9,
    textTransform: 'uppercase',
  },
  itemSubtotal: {
    color: '#10b981',
    fontWeight: '800',
    fontSize: 14,
  },
  trashBtn: {
    padding: 2,
  },
  formSection: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  orderTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 6,
    gap: 6,
  },
  orderTypeTab: {
    flex: 1,
    minWidth: '46%',
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  orderTypeTabActive: {
    backgroundColor: '#10b981',
  },
  orderTypeText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  orderTypeTextActive: {
    color: '#0f172a',
    fontWeight: '800',
  },
  inputGroup: {
    gap: 4,
  },
  inputLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  textInput: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    color: '#ffffff',
    fontSize: 14,
  },
  multilineInput: {
    height: 70,
    paddingVertical: 8,
  },
  paymentMethodRow: {
    gap: 10,
  },
  paymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    padding: 12,
  },
  paymentCardActive: {
    borderColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  paymentCardTitle: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '700',
  },
  paymentCardTitleActive: {
    color: '#ffffff',
  },
  paymentCardSub: {
    color: '#64748b',
    fontSize: 11,
  },
  summarySection: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    color: '#94a3b8',
    fontSize: 13,
  },
  summaryValue: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  discountValue: {
    color: '#10b981',
    fontSize: 13,
    fontWeight: '700',
  },
  zeroFeeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginTop: 4,
  },
  zeroFeeBadgeText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 4,
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  grandTotalLabel: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  grandTotalValue: {
    color: '#10b981',
    fontSize: 20,
    fontWeight: '800',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#ef4444',
    padding: 12,
    borderRadius: 10,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  footerContainer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    backgroundColor: '#0f172a',
  },
  checkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#10b981',
    paddingVertical: 14,
    borderRadius: 12,
  },
  checkoutBtnDisabled: {
    backgroundColor: '#334155',
    opacity: 0.6,
  },
  checkoutBtnText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});