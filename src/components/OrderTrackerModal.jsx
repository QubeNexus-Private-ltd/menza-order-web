import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  StyleSheet,
} from 'react-native';
import {
  X,
  CheckCircle2,
  Clock,
  Flame,
  CreditCard,
  Receipt,
  User,
  Phone,
  Calendar,
  Tag,
  MessageSquare,
  Building,
} from 'lucide-react';

export default function OrderTrackerModal({
  visible,
  onClose,
  order,
}) {
  if (!visible || !order) return null;

  const STATUSES = [
    'Pending',
    'Confirmed',
    'Preparing',
    'Ready',
    'Delivered',
  ];

  const isOnline =
    order.paymentMode === 'ONLINE' ||
    order.paymentMode === 'CASHFREE' ||
    order.paymentMode === 'UPI' ||
    order.paymentMethod === 'cashfree' ||
    order.paymentMethod === 'CASHFREE_SPLIT';

  const isPaid =
    order.paymentStatus === 'Paid' ||
    order.paymentStatus === 'SUCCESS' ||
    order.paymentStatus === 'PAID';

  const isAwaitingPayment = isOnline && !isPaid;

  const rawStatus = order.orderStatus || 'Pending';
  const normalizedStatus = isAwaitingPayment ? 'Pending' : rawStatus;

  const currentIdx =
    STATUSES.indexOf(normalizedStatus) >= 0
      ? STATUSES.indexOf(normalizedStatus)
      : 0;

  const items = Array.isArray(order.items)
    ? order.items
    : [];

  const subtotal =
    Number(
      order.subTotal ??
        order.itemTotal ??
        items.reduce(
          (sum, item) =>
            sum +
            Number(
              item.amount ??
                item.unitPrice ??
                item.price ??
                0
            ) *
              Number(item.quantity || 1),
          0
        )
    ) || 0;

  const cgst =
    Number(order.cgstAmount ?? 0) ||
    Math.round(subtotal * 0.025 * 100) / 100;

  const sgst =
    Number(order.sgstAmount ?? 0) ||
    Math.round(subtotal * 0.025 * 100) / 100;

  const total =
    Number(
      order.totalAmount ??
        subtotal + cgst + sgst
    ) || 0;

  const paymentStatus =
    order.paymentStatus ||
    order.paymentMethod ||
    'Pending';

  const tokenNumber =
    order.pickupToken ||
    (order.tokenNumber ? `TK-${String(order.tokenNumber).padStart(3, '0')}` : `TK-${String(order.id).padStart(3, '0')}`);

  const formattedDate = order.createdDateUtc
    ? new Date(order.createdDateUtc).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : new Date().toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });

  const channelText = order.tableName
    ? `Dine-In • ${order.tableName}`
    : order.tableId
    ? `Dine-In • Table #${order.tableId}`
    : 'Direct Quick QR Order (Counter / Takeaway)';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalBox}>

          {/* HEADER */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerTopRow}>
                <Text style={styles.orderIdText}>
                  ORDER #{order.id}
                </Text>
                <View style={styles.tokenBadge}>
                  <Tag size={12} color="#10b981" />
                  <Text style={styles.tokenBadgeText}>{tokenNumber}</Text>
                </View>
              </View>

              <Text style={styles.tableNameText}>
                {channelText}
              </Text>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
            >
              <X
                size={21}
                color="#94a3b8"
              />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollBody}
            contentContainerStyle={
              styles.scrollContent
            }
            showsVerticalScrollIndicator={false}
          >

            {/* ORDER STATUS BANNER */}
            <View style={[styles.successCard, isAwaitingPayment && { borderColor: 'rgba(245, 158, 11, 0.3)', backgroundColor: 'rgba(245, 158, 11, 0.08)' }]}>
              <View style={[styles.successIcon, isAwaitingPayment && { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}>
                {isAwaitingPayment ? (
                  <Clock
                    size={28}
                    color="#f59e0b"
                  />
                ) : (
                  <CheckCircle2
                    size={28}
                    color="#10b981"
                  />
                )}
              </View>

              <View style={styles.successTextBox}>
                <Text style={[styles.successTitle, isAwaitingPayment && { color: '#f59e0b' }]}>
                  {isAwaitingPayment
                    ? 'Payment Pending'
                    : isPaid
                    ? 'Payment Confirmed & Order Confirmed'
                    : 'Order Placed (Pay at Counter)'}
                </Text>

                <Text style={styles.successSubtitle}>
                  {isAwaitingPayment
                    ? 'Awaiting online payment. Your order will be sent to the kitchen once payment is marked PAID.'
                    : 'Your order has been confirmed and dispatched to the restaurant kitchen.'}
                </Text>
              </View>
            </View>

            {/* CUSTOMER & ORDER INFO CARD */}
            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIcon}>
                  <User size={16} color="#10b981" />
                </View>
                <Text style={styles.cardTitle}>Order & Customer Details</Text>
              </View>

              <View style={styles.infoGrid}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Customer Name:</Text>
                  <Text style={styles.infoValue}>
                    {order.customerName || order.name || 'Guest Diner'}
                  </Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Mobile Number:</Text>
                  <Text style={styles.infoValue}>
                    {order.mobileNumber || order.customerPhone || 'N/A'}
                  </Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Order Time:</Text>
                  <Text style={styles.infoValue}>{formattedDate}</Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Dining Channel:</Text>
                  <Text style={styles.infoValue}>{channelText}</Text>
                </View>

                {order.remarks ? (
                  <View style={styles.remarksBox}>
                    <MessageSquare size={13} color="#f59e0b" />
                    <Text style={styles.remarksText}>
                      Special Request: {order.remarks}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* STATUS TIMELINE */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                Live Kitchen Status
              </Text>

              <View style={styles.timeline}>
                {STATUSES.map(
                  (status, index) => {
                    const isDone =
                      index <= currentIdx;

                    const isCurrent =
                      index === currentIdx;

                    return (
                      <View
                        key={status}
                        style={styles.timelineStep}
                      >
                        <View
                          style={[
                            styles.dot,
                            isDone &&
                              styles.dotDone,
                            isCurrent &&
                              styles.dotCurrent,
                          ]}
                        >
                          {isDone ? (
                            <CheckCircle2
                              size={14}
                              color="#07130f"
                            />
                          ) : (
                            <Text
                              style={
                                styles.stepNum
                              }
                            >
                              {index + 1}
                            </Text>
                          )}
                        </View>

                        <Text
                          style={[
                            styles.stepLabel,
                            isDone &&
                              styles.stepLabelDone,
                          ]}
                        >
                          {status}
                        </Text>

                        {index <
                          STATUSES.length - 1 && (
                          <View
                            style={[
                              styles.line,
                              index <
                                currentIdx &&
                                styles.lineDone,
                            ]}
                          />
                        )}
                      </View>
                    );
                  }
                )}
              </View>

              <View style={styles.statusCallout}>
                <Flame
                  size={20}
                  color="#f59e0b"
                />

                <View
                  style={
                    styles.calloutTextBox
                  }
                >
                  <Text
                    style={
                      styles.calloutTitle
                    }
                  >
                    {normalizedStatus ===
                    'Preparing'
                      ? 'Chef is cooking your order!'
                      : normalizedStatus ===
                        'Ready'
                      ? 'Order is ready for serving!'
                      : normalizedStatus ===
                        'Delivered'
                      ? 'Enjoy your meal!'
                      : isAwaitingPayment
                      ? 'Awaiting payment confirmation before kitchen prep.'
                      : 'Order confirmed and queued in kitchen.'}
                  </Text>

                  <Text
                    style={
                      styles.calloutSub
                    }
                  >
                    Estimated preparation time ~ 15 to 20 mins
                  </Text>
                </View>
              </View>
            </View>

            {/* ORDER ITEMS */}
            <View style={styles.card}>
              <View
                style={styles.sectionHeader}
              >
                <View
                  style={styles.sectionIcon}
                >
                  <Receipt
                    size={17}
                    color="#10b981"
                  />
                </View>

                <Text
                  style={styles.cardTitle}
                >
                  Ordered Items ({items.reduce((s, i) => s + (Number(i.quantity) || 1), 0)})
                </Text>
              </View>

              {items.length === 0 ? (
                <View
                  style={styles.emptyItems}
                >
                  <Text
                    style={styles.emptyText}
                  >
                    No item details available
                  </Text>
                </View>
              ) : (
                items.map((item, index) => {
                  const quantity =
                    Number(
                      item.quantity || 1
                    );

                  const unitPrice =
                    Number(
                      item.unitPrice ??
                        item.amount ??
                        item.price ??
                        0
                    );

                  const itemTotal =
                    Number(
                      item.totalAmount ??
                        unitPrice *
                          quantity
                    );

                  const unitDesc = item.unitName || item.unitDescription || (item.unit ? `Unit #${item.unit}` : '');

                  return (
                    <View
                      key={
                        item.itemId ??
                        index
                      }
                      style={styles.itemRow}
                    >
                      <View
                        style={
                          styles.itemQtyBox
                        }
                      >
                        <Text
                          style={
                            styles.itemQty
                          }
                        >
                          {quantity}x
                        </Text>
                      </View>

                      <View
                        style={
                          styles.itemInfo
                        }
                      >
                        <Text
                          style={
                            styles.itemName
                          }
                        >
                          {item.itemName ||
                            item.name ||
                            'Dish Item'}
                        </Text>

                        <Text
                          style={
                            styles.unitPrice
                          }
                        >
                          {unitDesc ? `${unitDesc} • ` : ''}₹{unitPrice.toFixed(2)} each
                        </Text>

                        {item.cookingInstruction ? (
                          <Text style={styles.itemInstruction}>
                            Note: {item.cookingInstruction}
                          </Text>
                        ) : null}
                      </View>

                      <Text
                        style={
                          styles.itemPrice
                        }
                      >
                        ₹{itemTotal.toFixed(2)}
                      </Text>
                    </View>
                  );
                })
              )}

              <View
                style={styles.divider}
              />

              {/* BILL */}
              <View
                style={styles.billRow}
              >
                <Text
                  style={styles.billLabel}
                >
                  Subtotal
                </Text>

                <Text
                  style={styles.billValue}
                >
                  ₹{subtotal.toFixed(2)}
                </Text>
              </View>

              <View
                style={styles.billRow}
              >
                <Text
                  style={styles.billLabel}
                >
                  CGST (2.5%)
                </Text>

                <Text
                  style={styles.billValue}
                >
                  ₹{cgst.toFixed(2)}
                </Text>
              </View>

              <View
                style={styles.billRow}
              >
                <Text
                  style={styles.billLabel}
                >
                  SGST (2.5%)
                </Text>

                <Text
                  style={styles.billValue}
                >
                  ₹{sgst.toFixed(2)}
                </Text>
              </View>

              {order.gstNumber ? (
                <View
                  style={styles.billRow}
                >
                  <Text
                    style={[styles.billLabel, { fontStyle: 'italic', color: '#64748b' }]}
                  >
                    GSTIN
                  </Text>

                  <Text
                    style={[styles.billValue, { color: '#94a3b8', fontSize: 12, fontWeight: '700' }]}
                  >
                    {order.gstNumber}
                  </Text>
                </View>
              ) : null}

              <View
                style={styles.divider}
              />

              <View
                style={styles.totalRow}
              >
                <Text
                  style={styles.totalLabel}
                >
                  Total Amount {isPaid ? 'Paid' : 'Payable'}
                </Text>

                <Text
                  style={styles.totalValue}
                >
                  ₹{total.toFixed(2)}
                </Text>
              </View>
            </View>

            {/* PAYMENT DETAILS CARD */}
            <View style={styles.paymentCard}>
              <View
                style={styles.paymentIcon}
              >
                <CreditCard
                  size={18}
                  color="#10b981"
                />
              </View>

              <View style={styles.paymentTextBox}>
                <View style={styles.paymentHeaderRow}>
                  <Text
                    style={styles.paymentTitle}
                  >
                    Payment Method
                  </Text>
                  <View style={[styles.paymentBadge, isPaid ? styles.paymentBadgePaid : styles.paymentBadgePending]}>
                    <Text style={[styles.paymentBadgeText, isPaid ? { color: '#10b981' } : { color: '#f59e0b' }]}>
                      {isPaid ? 'PAID VIA CASHFREE' : isOnline ? 'PAYMENT PENDING' : 'PAY AT COUNTER'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.paymentDetailsSub}>
                  Mode: {isOnline ? 'Online Gateway (Cashfree)' : 'Cash / Counter Settlement'}
                </Text>

                {order.cashfreeOrderId || order.paymentOrderId ? (
                  <Text style={styles.paymentTxnId}>
                    Ref ID: {order.cashfreeOrderId || order.paymentOrderId}
                  </Text>
                ) : null}
              </View>
            </View>

          </ScrollView>

          {/* FOOTER */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.doneBtn}
              onPress={onClose}
            >
              <Text
                style={styles.doneBtnText}
              >
                Back to Menu
              </Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor:
      'rgba(0,0,0,0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  modalBox: {
    width: '100%',
    maxWidth: 540,
    maxHeight: '90%',
    backgroundColor: '#0f172a',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#1e293b',
    overflow: 'hidden',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },

  headerLeft: {
    flex: 1,
  },

  orderIdText: {
    color: '#10b981',
    fontSize: 17,
    fontWeight: '900',
  },

  tableNameText: {
    marginTop: 4,
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },

  closeBtn: {
    padding: 5,
  },

  scrollBody: {
    flex: 1,
  },

  scrollContent: {
    padding: 18,
    gap: 14,
  },

  successCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor:
      'rgba(16,185,129,0.10)',
    borderWidth: 1,
    borderColor:
      'rgba(16,185,129,0.35)',
    borderRadius: 16,
    padding: 15,
  },

  successIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor:
      'rgba(16,185,129,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },

  successTextBox: {
    flex: 1,
  },

  successTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },

  successSubtitle: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 4,
    lineHeight: 16,
  },

  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
  },

  cardTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },

  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor:
      'rgba(16,185,129,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },

  timeline: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 20,
    marginBottom: 18,
  },

  timelineStep: {
    flex: 1,
    alignItems: 'center',
    position: 'relative',
  },

  dot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },

  dotDone: {
    backgroundColor: '#10b981',
  },

  dotCurrent: {
    borderWidth: 3,
    borderColor: '#f59e0b',
  },

  stepNum: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '800',
  },

  stepLabel: {
    color: '#64748b',
    fontSize: 9,
    fontWeight: '700',
    marginTop: 7,
    textAlign: 'center',
  },

  stepLabelDone: {
    color: '#ffffff',
  },

  line: {
    position: 'absolute',
    top: 12,
    left: '50%',
    width: '100%',
    height: 2,
    backgroundColor: '#334155',
    zIndex: 1,
  },

  lineDone: {
    backgroundColor: '#10b981',
  },

  statusCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor:
      'rgba(245,158,11,0.12)',
    borderWidth: 1,
    borderColor:
      'rgba(245,158,11,0.45)',
    borderRadius: 12,
    padding: 12,
  },

  calloutTextBox: {
    flex: 1,
    marginLeft: 10,
  },

  calloutTitle: {
    color: '#f59e0b',
    fontWeight: '800',
    fontSize: 12,
  },

  calloutSub: {
    color: '#cbd5e1',
    fontSize: 10,
    marginTop: 3,
  },

  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },

  itemQtyBox: {
    width: 42,
  },

  itemQty: {
    color: '#10b981',
    fontWeight: '900',
    fontSize: 13,
  },

  itemInfo: {
    flex: 1,
  },

  itemName: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },

  unitPrice: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 3,
  },

  itemPrice: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },

  emptyItems: {
    paddingVertical: 20,
    alignItems: 'center',
  },

  emptyText: {
    color: '#64748b',
    fontSize: 12,
  },

  divider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 8,
  },

  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },

  billLabel: {
    color: '#94a3b8',
    fontSize: 12,
  },

  billValue: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
  },

  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },

  totalLabel: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },

  totalValue: {
    color: '#10b981',
    fontSize: 20,
    fontWeight: '900',
  },

  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  tokenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderWidth: 1,
    borderColor: '#10b981',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },

  tokenBadgeText: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  infoGrid: {
    marginTop: 6,
    gap: 8,
  },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  infoLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '500',
  },

  infoValue: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '700',
  },

  remarksBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
    borderRadius: 8,
    padding: 8,
    marginTop: 4,
  },

  remarksText: {
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },

  itemInstruction: {
    color: '#f59e0b',
    fontSize: 10,
    fontStyle: 'italic',
    marginTop: 2,
  },

  paymentCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 14,
  },

  paymentIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: 'rgba(16,185,129,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  paymentTextBox: {
    flex: 1,
  },

  paymentHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  paymentTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },

  paymentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },

  paymentBadgePaid: {
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderColor: '#10b981',
  },

  paymentBadgePending: {
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderColor: '#f59e0b',
  },

  paymentBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },

  paymentDetailsSub: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 4,
  },

  paymentTxnId: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 2,
  },

  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },

  doneBtn: {
    backgroundColor: '#334155',
    paddingVertical: 13,
    borderRadius: 11,
    alignItems: 'center',
  },

  doneBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
});