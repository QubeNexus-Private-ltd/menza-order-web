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
  Flame,
  CreditCard,
  Receipt,
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

  const normalizedStatus =
    order.orderStatus || 'Pending';

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
              <Text style={styles.orderIdText}>
                ORDER #{order.id}
              </Text>

              <Text style={styles.tableNameText}>
                {order.tableName ||
                  (order.tableId
                    ? `Table #${order.tableId}`
                    : 'Takeaway')}
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

            {/* ORDER SUCCESS */}
            <View style={styles.successCard}>
              <View style={styles.successIcon}>
                <CheckCircle2
                  size={28}
                  color="#10b981"
                />
              </View>

              <View style={styles.successTextBox}>
                <Text style={styles.successTitle}>
                  Order Received
                </Text>

                <Text style={styles.successSubtitle}>
                  Your order has been sent to
                  the restaurant kitchen.
                </Text>
              </View>
            </View>

            {/* STATUS */}
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
                      : 'Order received by restaurant kitchen.'}
                  </Text>

                  <Text
                    style={
                      styles.calloutSub
                    }
                  >
                    Estimated preparation time
                    ~ 15 to 20 mins
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
                  Ordered Items
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
                          ₹
                          {unitPrice.toFixed(
                            2
                          )}{' '}
                          each
                        </Text>
                      </View>

                      <Text
                        style={
                          styles.itemPrice
                        }
                      >
                        ₹
                        {itemTotal.toFixed(
                          2
                        )}
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
                  CGST
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
                  SGST
                </Text>

                <Text
                  style={styles.billValue}
                >
                  ₹{sgst.toFixed(2)}
                </Text>
              </View>

              <View
                style={styles.divider}
              />

              <View
                style={styles.totalRow}
              >
                <Text
                  style={styles.totalLabel}
                >
                  Total Payable
                </Text>

                <Text
                  style={styles.totalValue}
                >
                  ₹{total.toFixed(2)}
                </Text>
              </View>
            </View>

            {/* PAYMENT */}
            <View style={styles.paymentCard}>
              <View
                style={styles.paymentIcon}
              >
                <CreditCard
                  size={18}
                  color="#10b981"
                />
              </View>

              <View>
                <Text
                  style={styles.paymentTitle}
                >
                  Payment
                </Text>

                <Text
                  style={
                    styles.paymentStatus
                  }
                >
                  {String(
                    paymentStatus
                  ).toUpperCase()}
                </Text>
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

  paymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 14,
  },

  paymentIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor:
      'rgba(16,185,129,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  paymentTitle: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },

  paymentStatus: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '900',
    marginTop: 3,
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