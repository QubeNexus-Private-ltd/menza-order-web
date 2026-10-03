import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {
  X,
  Bell,
  BellRing,
  Droplets,
  Receipt,
  Sparkles,
  CheckCircle2,
  Clock,
  Utensils,
  QrCode,
  AlertCircle,
} from 'lucide-react';
import { checkRateLimit } from '../services/rateLimiter';
import { Catalog, Table } from '../types';
import { logger } from '../services/logger';

export interface ServiceOption {
  id: string;
  title: string;
  subtitle: string;
  icon: any;
  badge?: string;
  color: string;
  bg: string;
  border: string;
  activeBg: string;
}

const SERVICE_OPTIONS: ServiceOption[] = [
  {
    id: 'CALL_WAITER',
    title: 'Call Waiter',
    subtitle: 'Assistance at your table',
    icon: Bell,
    badge: 'Popular',
    color: '#EA580C',
    bg: '#FFF7ED',
    border: '#FED7AA',
    activeBg: '#FFEDD5',
  },
  {
    id: 'REQUEST_WATER',
    title: 'Drinking Water',
    subtitle: 'Fresh water refill',
    icon: Droplets,
    color: '#0284C7',
    bg: '#F0F9FF',
    border: '#BAE6FD',
    activeBg: '#E0F2FE',
  },
  {
    id: 'REQUEST_BILL',
    title: 'Request Bill',
    subtitle: 'Pre-bill & invoice',
    icon: Receipt,
    color: '#16A34A',
    bg: '#F0FDF4',
    border: '#BBF7D0',
    activeBg: '#DCFCE7',
  },
  {
    id: 'CLEAN_TABLE',
    title: 'Clean Table',
    subtitle: 'Table wipe & cleanup',
    icon: Sparkles,
    color: '#7C3AED',
    bg: '#F5F3FF',
    border: '#DDD6FE',
    activeBg: '#EDE9FE',
  },
];

export interface SuccessInfo {
  message: string;
  fallbackToCounter: boolean;
  activeWaiterCount: number;
}

export interface CallWaiterModalProps {
  visible: boolean;
  onClose: () => void;
  activeTable?: Table | null;
  catalog?: Catalog | null;
  initialRequestType?: string;
  onCallWaiter?: (requestType: string, customNote: string) => Promise<any> | any;
  onRequestBill?: () => Promise<any> | any;
  openScanner?: () => void;
}

export default function CallWaiterModal({
  visible,
  onClose,
  activeTable,
  catalog,
  initialRequestType = 'CALL_WAITER',
  onCallWaiter,
  onRequestBill,
  openScanner,
}: CallWaiterModalProps) {
  const [selectedType, setSelectedType] = useState<string>(initialRequestType || 'CALL_WAITER');
  const [customNote, setCustomNote] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [successInfo, setSuccessInfo] = useState<SuccessInfo | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);

  // Sync initial type when opening
  useEffect(() => {
    if (visible) {
      setSelectedType(initialRequestType || 'CALL_WAITER');
      setCustomNote('');
      setSuccessInfo(null);
      setErrorMessage('');
    }
  }, [visible, initialRequestType]);

  // Live cooldown timer ticker
  useEffect(() => {
    if (!visible) return;

    const updateCooldown = () => {
      const tableId = activeTable?.id || activeTable?.tableId || 'default';
      const waiterLimit = checkRateLimit('CALL_WAITER', String(tableId));
      const billLimit = checkRateLimit('REQUEST_BILL', String(tableId));
      const maxRemaining = Math.max(
        waiterLimit.retryAfterSeconds || 0,
        billLimit.retryAfterSeconds || 0
      );
      setCooldownSeconds(maxRemaining);
    };

    updateCooldown();
    const interval = setInterval(updateCooldown, 1000);
    return () => clearInterval(interval);
  }, [visible, activeTable]);

  const tableName =
    activeTable?.tableName ||
    activeTable?.name ||
    (activeTable?.id ? `Table #${activeTable.id}` : '');

  const restaurantName =
    catalog?.restaurantName ||
    catalog?.storeName ||
    'Restaurant';

  const handleSubmit = async () => {
    if (!activeTable) {
      setErrorMessage('Please scan your table QR code to request waiter assistance.');
      return;
    }

    if (cooldownSeconds > 0) {
      setErrorMessage(`Please wait ${cooldownSeconds}s before sending another alert.`);
      return;
    }

    setSubmitting(true);
    setErrorMessage('');
    logger.service('SERVICE_REQUESTED', `Customer requested ${selectedOption?.title || selectedType} at table ${tableName || activeTable.id}`, {
      serviceType: selectedType,
      tableId: activeTable.id,
      tableName,
      note: customNote.trim(),
    });

    try {
      let result: any = null;
      if (selectedType === 'REQUEST_BILL' && typeof onRequestBill === 'function') {
        result = await onRequestBill();
      } else if (typeof onCallWaiter === 'function') {
        result = await onCallWaiter(selectedType, customNote.trim());
      }

      logger.service('SERVICE_DISPATCHED', `Service request sent successfully: ${selectedType}`, {
        activeWaiterCount: result?.activeWaiterCount,
        fallbackToCounter: result?.fallbackToCounter,
      });

      setSuccessInfo({
        message: result?.message || `Help is on the way to ${tableName || 'your table'}!`,
        fallbackToCounter: Boolean(result?.fallbackToCounter),
        activeWaiterCount: Number(result?.activeWaiterCount || 0),
      });

      // Auto close modal after 3 seconds on success
      setTimeout(() => {
        if (typeof onClose === 'function') {
          onClose();
        }
      }, 3000);
    } catch (err: any) {
      console.error('Call waiter error:', err);
      logger.error('SERVICE', 'SERVICE_REQUEST_FAILED', err, {
        serviceType: selectedType,
        tableId: activeTable?.id,
      });
      if (err?.isRateLimited) {
        setErrorMessage(err.message || 'Rate limit active. Please wait a moment.');
      } else {
        setErrorMessage(err?.message || 'Failed to alert staff. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const selectedOption = SERVICE_OPTIONS.find((opt) => opt.id === selectedType) || SERVICE_OPTIONS[0];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay} className="responsive-modal-overlay">
        <View style={styles.modalBox} className="responsive-modal-sheet">
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIconWrap}>
                <BellRing size={20} color="#EA580C" strokeWidth={2.4} />
              </View>
              <View>
                <Text style={styles.headerTitle}>Call Waiter</Text>
                <Text style={styles.headerSubtitle} numberOfLines={1}>
                  {tableName ? `${tableName} • ${restaurantName}` : restaurantName}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <X size={19} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Body Content */}
          <ScrollView
            style={styles.bodyScroll}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Empty Table Warning (if guest opens without seated table) */}
            {!activeTable ? (
              <View style={styles.noTableBox}>
                <View style={styles.noTableIconWrap}>
                  <QrCode size={32} color="#EA580C" />
                </View>
                <Text style={styles.noTableTitle}>Scan Your Dining Table QR</Text>
                <Text style={styles.noTableDesc}>
                  To summon a waiter or request water & bill, please scan the QR code located on your dining table.
                </Text>

                {typeof openScanner === 'function' && (
                  <TouchableOpacity
                    style={styles.scanBtn}
                    onPress={() => {
                      onClose();
                      openScanner();
                    }}
                    activeOpacity={0.8}
                  >
                    <QrCode size={16} color="#FFFFFF" strokeWidth={2.2} />
                    <Text style={styles.scanBtnText}>Scan Table QR Code</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : successInfo ? (
              /* Success Confirmation View */
              <View style={styles.successContainer}>
                <View style={styles.successIconCircle}>
                  <CheckCircle2 size={46} color="#16A34A" strokeWidth={2.2} />
                </View>
                <Text style={styles.successTitle}>Request Sent to Floor Staff!</Text>
                <Text style={styles.successDesc}>
                  {successInfo.message}
                </Text>

                {successInfo.fallbackToCounter ? (
                  <View style={styles.fallbackPill}>
                    <AlertCircle size={14} color="#B45309" />
                    <Text style={styles.fallbackPillText}>
                      Sent to Counter Staff (floor team assigned)
                    </Text>
                  </View>
                ) : (
                  <View style={styles.activeStaffPill}>
                    <Bell size={13} color="#15803D" />
                    <Text style={styles.activeStaffPillText}>
                      Waiter on duty alerted for {tableName}
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  style={styles.doneBtn}
                  onPress={onClose}
                  activeOpacity={0.8}
                >
                  <Text style={styles.doneBtnText}>Close</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* Main Service Request Options */
              <View style={styles.formContainer}>
                <View style={styles.tableBadgeRow}>
                  <View style={styles.tableBadge}>
                    <Utensils size={13} color="#D33401" />
                    <Text style={styles.tableBadgeText}>{tableName}</Text>
                  </View>
                  <Text style={styles.tableBadgeHint}>Select service needed</Text>
                </View>

                {/* 2x2 Grid of Preset Requests */}
                <View style={styles.grid}>
                  {SERVICE_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const isSelected = selectedType === opt.id;

                    return (
                      <TouchableOpacity
                        key={opt.id}
                        style={[
                          styles.optionCard,
                          {
                            backgroundColor: isSelected ? opt.activeBg : '#FFFFFF',
                            borderColor: isSelected ? opt.color : '#E2E8F0',
                          },
                          isSelected && styles.optionCardSelected,
                        ]}
                        onPress={() => {
                          setSelectedType(opt.id);
                          setErrorMessage('');
                        }}
                        activeOpacity={0.8}
                      >
                        <View
                          style={[
                            styles.optionIconBox,
                            {
                              backgroundColor: opt.bg,
                              borderColor: opt.border,
                            },
                          ]}
                        >
                          <Icon size={20} color={opt.color} strokeWidth={2.2} />
                        </View>

                        <View style={styles.optionTextWrap}>
                          <Text
                            style={[
                              styles.optionTitle,
                              isSelected && { color: opt.color, fontWeight: '800' },
                            ]}
                            numberOfLines={1}
                          >
                            {opt.title}
                          </Text>
                          <Text style={styles.optionSubtitle} numberOfLines={1}>
                            {opt.subtitle}
                          </Text>
                        </View>

                        {isSelected && (
                          <View
                            style={[
                              styles.selectedCheckDot,
                              { backgroundColor: opt.color },
                            ]}
                          >
                            <CheckCircle2 size={12} color="#FFFFFF" />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Optional Message / Special Instructions */}
                <View style={styles.noteSection}>
                  <Text style={styles.noteLabel}>Special note for staff (Optional):</Text>
                  <TextInput
                    style={styles.noteInput}
                    placeholder={`e.g. Extra napkins, clean glasses, or baby chair...`}
                    placeholderTextColor="#94A3B8"
                    value={customNote}
                    onChangeText={(txt) => {
                      if (txt.length <= 120) setCustomNote(txt);
                    }}
                    maxLength={120}
                    multiline={false}
                  />
                  <Text style={styles.charCount}>{customNote.length}/120</Text>
                </View>

                {/* Cooldown / Rate Limit Banner */}
                {cooldownSeconds > 0 && (
                  <View style={styles.cooldownBanner}>
                    <Clock size={15} color="#D97706" />
                    <Text style={styles.cooldownText}>
                      Floor staff notified. Wait {cooldownSeconds}s before buzzing again.
                    </Text>
                  </View>
                )}

                {/* Error Banner */}
                {Boolean(errorMessage) && (
                  <View style={styles.errorBanner}>
                    <AlertCircle size={15} color="#DC2626" />
                    <Text style={styles.errorText}>{errorMessage}</Text>
                  </View>
                )}

                {/* Action Button */}
                <TouchableOpacity
                  style={[
                    styles.submitBtn,
                    (submitting || cooldownSeconds > 0) && styles.submitBtnDisabled,
                  ]}
                  onPress={handleSubmit}
                  disabled={submitting || cooldownSeconds > 0}
                  activeOpacity={0.85}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Bell size={18} color="#FFFFFF" strokeWidth={2.4} />
                      <Text style={styles.submitBtnText}>
                        {cooldownSeconds > 0
                          ? `Cooldown Active (${cooldownSeconds}s)`
                          : `Ring Bell: ${selectedOption.title}`}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  bodyScroll: {
    maxHeight: 520,
  },
  bodyContent: {
    padding: 20,
    paddingBottom: 28,
  },
  formContainer: {
    gap: 0,
  },
  tableBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  tableBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF1EC',
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F3C8BA',
  },
  tableBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#D33401',
  },
  tableBadgeHint: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  optionCard: {
    width: '48.5%',
    minWidth: 140,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    position: 'relative',
    alignItems: 'flex-start',
    gap: 8,
  },
  optionCardSelected: {
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  optionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  optionTextWrap: {
    width: '100%',
  },
  optionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  optionSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  selectedCheckDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteSection: {
    marginTop: 16,
    position: 'relative',
  },
  noteLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },
  noteInput: {
    height: 44,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#0F172A',
  },
  charCount: {
    fontSize: 10.5,
    color: '#94A3B8',
    textAlign: 'right',
    marginTop: 4,
  },
  cooldownBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 12,
  },
  cooldownText: {
    fontSize: 11.5,
    color: '#B45309',
    fontWeight: '600',
    flex: 1,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 12,
  },
  errorText: {
    fontSize: 11.5,
    color: '#B91C1C',
    fontWeight: '600',
    flex: 1,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EA580C',
    height: 48,
    borderRadius: 14,
    marginTop: 18,
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnDisabled: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  noTableBox: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 12,
  },
  noTableIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#FFF7ED',
    borderWidth: 1.5,
    borderColor: '#FED7AA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noTableTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  noTableDesc: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 320,
  },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EA580C',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  scanBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 12,
  },
  successIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  successTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  successDesc: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 320,
  },
  fallbackPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginTop: 4,
  },
  fallbackPillText: {
    fontSize: 11.5,
    color: '#B45309',
    fontWeight: '600',
  },
  activeStaffPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginTop: 4,
  },
  activeStaffPillText: {
    fontSize: 11.5,
    color: '#15803D',
    fontWeight: '600',
  },
  doneBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  doneBtnText: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '700',
  },
});
