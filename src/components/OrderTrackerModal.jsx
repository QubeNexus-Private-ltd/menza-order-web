import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, StyleSheet } from 'react-native';
import { X, Clock, CheckCircle2, Flame, Utensils, Award } from 'lucide-react';

export default function OrderTrackerModal({ visible, onClose, order }) {
  if (!visible || !order) return null;

  const STATUSES = ['Pending', 'Confirmed', 'Preparing', 'Ready', 'Delivered'];
  const currentIdx = STATUSES.indexOf(order.orderStatus) !== -1 ? STATUSES.indexOf(order.orderStatus) : 1;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalBox}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.orderIdText}>ORDER #{order.id}</Text>
              <Text style={styles.tableNameText}>{order.tableName || 'Dine In'}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollBody} contentContainerStyle={styles.scrollContent}>
            {/* Status Visual Tracker */}
            <View style={styles.trackerCard}>
              <Text style={styles.trackerHeading}>Live Kitchen Status</Text>

              <View style={styles.timeline}>
                {STATUSES.map((st, idx) => {
                  const isDone = idx <= currentIdx;
                  const isCurrent = idx === currentIdx;
                  return (
                    <View key={st} style={styles.timelineStep}>
                      <View style={[styles.dot, isDone && styles.dotDone, isCurrent && styles.dotCurrent]}>
                        {isDone ? (
                          <CheckCircle2 size={14} color="#0f172a" />
                        ) : (
                          <Text style={styles.stepNum}>{idx + 1}</Text>
                        )}
                      </View>
                      <Text style={[styles.stepLabel, isDone && styles.stepLabelDone]}>{st}</Text>
                      {idx < STATUSES.length - 1 && (
                        <View style={[styles.line, idx < currentIdx && styles.lineDone]} />
                      )}
                    </View>
                  );
                })}
              </View>

              <View style={styles.statusCallout}>
                <Flame size={20} color="#f59e0b" />
                <View>
                  <Text style={styles.calloutTitle}>
                    {order.orderStatus === 'Preparing'
                      ? 'Chef is cooking your order!'
                      : order.orderStatus === 'Ready'
                      ? 'Order is ready for serving!'
                      : order.orderStatus === 'Delivered'
                      ? 'Enjoy your meal!'
                      : 'Order received by restaurant kitchen.'}
                  </Text>
                  <Text style={styles.calloutSub}>Estimated preparation time ~ 15 to 20 mins</Text>
                </View>
              </View>
            </View>

            {/* Items Summary */}
            <View style={styles.itemsCard}>
              <Text style={styles.cardTitle}>Ordered Items</Text>
              {order.items && order.items.map((item, idx) => (
                <View key={idx} style={styles.itemRow}>
                  <Text style={styles.itemQty}>{item.quantity}x</Text>
                  <Text style={styles.itemName}>{item.itemName}</Text>
                  <Text style={styles.itemPrice}>₹{item.amount * item.quantity}</Text>
                </View>
              ))}

              <View style={styles.divider} />

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total Payable</Text>
                <Text style={styles.totalValue}>₹{order.totalAmount}</Text>
              </View>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
              <Text style={styles.doneBtnText}>Back to Menu</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#0f172a',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
    overflow: 'hidden',
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  orderIdText: {
    color: '#10b981',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  tableNameText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  closeBtn: {
    padding: 4,
  },
  scrollBody: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 16,
  },
  trackerCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    gap: 16,
  },
  trackerHeading: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  timeline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  timelineStep: {
    alignItems: 'center',
    position: 'relative',
    flex: 1,
  },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
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
    fontSize: 11,
    fontWeight: '700',
  },
  stepLabel: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 6,
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
    gap: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: '#f59e0b',
    padding: 12,
    borderRadius: 12,
  },
  calloutTitle: {
    color: '#f59e0b',
    fontWeight: '700',
    fontSize: 13,
  },
  calloutSub: {
    color: '#cbd5e1',
    fontSize: 11,
  },
  itemsCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemQty: {
    color: '#10b981',
    fontWeight: '800',
    fontSize: 13,
  },
  itemName: {
    flex: 1,
    color: '#ffffff',
    fontSize: 13,
  },
  itemPrice: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 4,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  totalValue: {
    color: '#10b981',
    fontWeight: '800',
    fontSize: 18,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  doneBtn: {
    backgroundColor: '#334155',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
});
