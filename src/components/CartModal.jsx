import React, { useState } from 'react';
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
import { X, Plus, Minus, ShoppingBag, ArrowRight, Check, AlertCircle, CreditCard, Banknote, ShieldCheck } from 'lucide-react';
import * as api from '../services/api';

export default function CartModal({
  visible,
  onClose,
  cartItems,
  onUpdateCartQuantity,
  onClearCart,
  onPlaceOrder,
  activeTable,
  catalog,
  loading,
}) {
  const [guestName, setGuestName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [remarks, setRemarks] = useState('');
  const [orderTypeId, setOrderTypeId] = useState(1); // 1 = Dine In, 2 = Takeaway
  const [paymentMethod, setPaymentMethod] = useState('cashfree'); // 'cashfree' | 'counter'
  const [errorMsg, setErrorMsg] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);

  const itemsTotal = cartItems.reduce((sum, item) => sum + item.amount * item.quantity, 0);
  const cgst = itemsTotal * 0.025;
  const sgst = itemsTotal * 0.025;
  // Platform fee is NOT charged to customers (0 fee for customer)
  const grandTotal = itemsTotal + cgst + sgst;

  const handleCheckout = async () => {
    if (!guestName.trim()) {
      setErrorMsg('Please enter customer / guest name.');
      return;
    }
    setErrorMsg('');

    const restId = catalog ? catalog.restaurantId : 1;
    const orderPayload = {
      name: guestName,
      mobileNumber: mobileNumber,
      remarks: remarks,
      isHomeDelivery: false,
      orderTypeId: orderTypeId,
      tableId: activeTable ? activeTable.id : null,
      paymentMethod: paymentMethod === 'cashfree' ? 'CASHFREE_SPLIT' : 'COUNTER_CASH'
    };

    if (paymentMethod === 'cashfree') {
      setProcessingPayment(true);
      try {
        const checkoutRes = await api.initiateCashfreeCheckout({
          restaurantId: restId,
          amount: Math.round(grandTotal * 100) / 100,
          customerName: guestName,
          customerPhone: mobileNumber || '9999999999',
          tableNumber: activeTable ? String(activeTable.id) : '1',
          orderNotes: remarks
        });

        if (checkoutRes && checkoutRes.paymentLink) {
          window.location.href = checkoutRes.paymentLink;
          return;
        }

        // Proceed to place order with session tracking
        onPlaceOrder({
          ...orderPayload,
          cashfreeOrderId: checkoutRes?.orderId || null
        });
      } catch (err) {
        console.error('Cashfree checkout error:', err);
        // Fallback to order placement if gateway returns offline response
        onPlaceOrder(orderPayload);
      } finally {
        setProcessingPayment(false);
      }
    } else {
      onPlaceOrder(orderPayload);
    }
  };

  if (!visible) return null;

  const isLoadingState = loading || processingPayment;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={styles.headerTitleRow}>
              <ShoppingBag size={20} color="#10b981" />
              <Text style={styles.headerTitle}>Your Order Basket</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.bodyContent}>
            {cartItems.length === 0 ? (
              <View style={styles.emptyCartBox}>
                <ShoppingBag size={48} color="#334155" />
                <Text style={styles.emptyCartTitle}>Your Basket is Empty</Text>
                <Text style={styles.emptyCartSub}>Browse our menu catalog and add your favorite dishes.</Text>
              </View>
            ) : (
              <>
                {/* Cart Items List */}
                <View style={styles.itemsSection}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionTitle}>Selected Items ({cartItems.length})</Text>
                    <TouchableOpacity onPress={onClearCart}>
                      <Text style={styles.clearText}>Clear All</Text>
                    </TouchableOpacity>
                  </View>

                  {cartItems.map((item) => (
                    <View key={item.itemId} style={styles.cartRow}>
                      <Image
                        source={{ uri: item.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600' }}
                        style={styles.itemThumb}
                      />
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName} numberOfLines={1}>{item.itemName}</Text>
                        <Text style={styles.itemPriceSingle}>₹{item.amount} each</Text>
                      </View>

                      {/* Quantity Controls */}
                      <View style={styles.qtyBox}>
                        <TouchableOpacity
                          style={styles.qtyBtn}
                          onPress={() => onUpdateCartQuantity(item.itemId, item.quantity - 1)}
                        >
                          <Minus size={12} color="#ffffff" />
                        </TouchableOpacity>
                        <Text style={styles.qtyText}>{item.quantity}</Text>
                        <TouchableOpacity
                          style={styles.qtyBtn}
                          onPress={() => onUpdateCartQuantity(item.itemId, item.quantity + 1)}
                        >
                          <Plus size={12} color="#ffffff" />
                        </TouchableOpacity>
                      </View>

                      <Text style={styles.itemSubtotal}>₹{item.amount * item.quantity}</Text>
                    </View>
                  ))}
                </View>

                {/* Order Options */}
                <View style={styles.formSection}>
                  <Text style={styles.sectionTitle}>Order Details</Text>

                  {/* Dine-In / Takeaway selector */}
                  <View style={styles.orderTypeContainer}>
                    <TouchableOpacity
                      style={[styles.orderTypeTab, orderTypeId === 1 && styles.orderTypeTabActive]}
                      onPress={() => setOrderTypeId(1)}
                    >
                      <Text style={[styles.orderTypeText, orderTypeId === 1 && styles.orderTypeTextActive]}>
                        🍽️ Dine In {activeTable ? `(Table #${activeTable.id})` : ''}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.orderTypeTab, orderTypeId === 2 && styles.orderTypeTabActive]}
                      onPress={() => setOrderTypeId(2)}
                    >
                      <Text style={[styles.orderTypeText, orderTypeId === 2 && styles.orderTypeTextActive]}>
                        🛍️ Takeaway / Counter
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Input Fields */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Customer Name *</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Enter guest name"
                      placeholderTextColor="#64748b"
                      value={guestName}
                      onChangeText={setGuestName}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Mobile Number (Optional)</Text>
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
                    <Text style={styles.inputLabel}>Special Instructions / Notes</Text>
                    <TextInput
                      style={[styles.textInput, styles.multilineInput]}
                      placeholder="Less spicy, extra cheese, cutlery needed..."
                      placeholderTextColor="#64748b"
                      multiline
                      value={remarks}
                      onChangeText={setRemarks}
                    />
                  </View>
                </View>

                {/* Payment Selection Section */}
                <View style={styles.formSection}>
                  <Text style={styles.sectionTitle}>Payment Method</Text>
                  <View style={styles.paymentMethodRow}>
                    <TouchableOpacity
                      style={[styles.paymentCard, paymentMethod === 'cashfree' && styles.paymentCardActive]}
                      onPress={() => setPaymentMethod('cashfree')}
                    >
                      <CreditCard size={20} color={paymentMethod === 'cashfree' ? '#10b981' : '#94a3b8'} />
                      <View>
                        <Text style={[styles.paymentCardTitle, paymentMethod === 'cashfree' && styles.paymentCardTitleActive]}>
                          Cashfree Easy Split
                        </Text>
                        <Text style={styles.paymentCardSub}>UPI • Cards • NetBanking</Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.paymentCard, paymentMethod === 'counter' && styles.paymentCardActive]}
                      onPress={() => setPaymentMethod('counter')}
                    >
                      <Banknote size={20} color={paymentMethod === 'counter' ? '#10b981' : '#94a3b8'} />
                      <View>
                        <Text style={[styles.paymentCardTitle, paymentMethod === 'counter' && styles.paymentCardTitleActive]}>
                          Pay at Counter
                        </Text>
                        <Text style={styles.paymentCardSub}>Cash / POS at Table</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Price Summary Breakdown */}
                <View style={styles.summarySection}>
                  <Text style={styles.sectionTitle}>Bill Breakdown</Text>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Subtotal</Text>
                    <Text style={styles.summaryValue}>₹{itemsTotal.toFixed(2)}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>CGST (2.5%)</Text>
                    <Text style={styles.summaryValue}>₹{cgst.toFixed(2)}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>SGST (2.5%)</Text>
                    <Text style={styles.summaryValue}>₹{sgst.toFixed(2)}</Text>
                  </View>

                  {/* Customer zero platform fee guarantee banner */}
                  <View style={styles.zeroFeeBadge}>
                    <ShieldCheck size={14} color="#10b981" />
                    <Text style={styles.zeroFeeBadgeText}>Zero Platform Fee for Customers</Text>
                  </View>

                  <View style={styles.divider} />
                  <View style={styles.grandTotalRow}>
                    <Text style={styles.grandTotalLabel}>Total Payable</Text>
                    <Text style={styles.grandTotalValue}>₹{grandTotal.toFixed(2)}</Text>
                  </View>
                </View>

                {errorMsg ? (
                  <View style={styles.errorBanner}>
                    <AlertCircle size={16} color="#ef4444" />
                    <Text style={styles.errorText}>{errorMsg}</Text>
                  </View>
                ) : null}
              </>
            )}
          </ScrollView>

          {/* Footer Submit Button */}
          {cartItems.length > 0 && (
            <View style={styles.footerContainer}>
              <TouchableOpacity
                style={styles.checkoutBtn}
                onPress={handleCheckout}
                disabled={isLoadingState}
                activeOpacity={0.85}
              >
                {isLoadingState ? (
                  <ActivityIndicator size="small" color="#0f172a" />
                ) : (
                  <>
                    <Text style={styles.checkoutBtnText}>
                      {paymentMethod === 'cashfree' ? 'PAY VIA CASHFREE' : 'CONFIRM & PLACE ORDER'} • ₹{grandTotal.toFixed(2)}
                    </Text>
                    <ArrowRight size={18} color="#0f172a" />
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
  cartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  itemThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  itemPriceSingle: {
    color: '#94a3b8',
    fontSize: 12,
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
  itemSubtotal: {
    color: '#10b981',
    fontWeight: '700',
    fontSize: 14,
    minWidth: 60,
    textAlign: 'right',
  },
  formSection: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  orderTypeContainer: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  orderTypeTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
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
    outlineStyle: 'none',
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
  checkoutBtnText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
