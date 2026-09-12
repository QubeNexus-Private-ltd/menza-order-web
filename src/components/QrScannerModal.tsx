import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, Modal, StyleSheet } from 'react-native';
import { X, QrCode, Check } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { encryptRestaurantId, KNOWN_ENCRYPTED_IDS } from '../services/api';

export interface QrScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectScanResult: (encId: string, tableId: number) => void;
  activeEncryptedId?: string;
  activeRestaurantId?: number | string;
}

export default function QrScannerModal({
  visible,
  onClose,
  onSelectScanResult,
  activeEncryptedId,
  activeRestaurantId,
}: QrScannerModalProps) {
  const [manualText, setManualText] = useState<string>('');

  const parseQrText = (decodedText: string): { encId: string; tableId: number } => {
    let encId = activeEncryptedId || 'uqQTzsGyDJy4_TBVeYXCfg';
    let tableId = 1;

    try {
      if (decodedText.startsWith('{')) {
        const obj = JSON.parse(decodedText);
        if (obj.encRestId || obj.encryptedRestaurantId || obj.r) {
          encId = obj.encRestId || obj.encryptedRestaurantId || obj.r;
        } else if (obj.restaurantId) {
          encId = encryptRestaurantId(obj.restaurantId);
        }
        if (obj.tableId) tableId = Number(obj.tableId);
        return { encId, tableId };
      }
    } catch (e) {}

    const encMatch = decodedText.match(/(?:encRestId|r|enc)=([^&]+)/i);
    const restMatch = decodedText.match(/restaurantId=(\d+)/i);
    const tableMatch = decodedText.match(/tableId=(\d+)/i);

    if (encMatch) {
      encId = decodeURIComponent(encMatch[1]);
    } else if (restMatch) {
      encId = encryptRestaurantId(Number(restMatch[1]));
    } else if (decodedText.startsWith('uqQT') || decodedText.startsWith('NQZ2') || decodedText.startsWith('23wy') || decodedText.startsWith('enc_')) {
      encId = decodedText.trim();
    }

    if (tableMatch) tableId = Number(tableMatch[1]);

    if (!tableMatch && !isNaN(Number(decodedText))) {
      tableId = Number(decodedText);
    }

    return { encId, tableId };
  };

  useEffect(() => {
    if (visible) {
      const scanner = new Html5QrcodeScanner(
        'qr-reader',
        { fps: 10, qrbox: { width: 220, height: 220 } },
        /* verbose= */ false
      );

      scanner.render(
        (decodedText: string) => {
          scanner.clear();
          const parsed = parseQrText(decodedText);
          onSelectScanResult(parsed.encId, parsed.tableId);
          onClose();
        },
        (_error: any) => {
          // ignore scan frame errors
        }
      );

      return () => {
        try {
          scanner.clear();
        } catch (e) {}
      };
    }
  }, [visible]);

  if (!visible) return null;

  const handleManualSubmit = () => {
    if (!manualText.trim()) return;
    const parsed = parseQrText(manualText);
    onSelectScanResult(parsed.encId, parsed.tableId);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalBox}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <QrCode size={20} color="#10b981" />
              <Text style={styles.title}>Scan Encrypted Restaurant QR</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          {/* Camera Scanner Container */}
          <View style={styles.scannerWrapper}>
            <div id="qr-reader" style={{ width: '100%', borderRadius: 12, overflow: 'hidden' }} />
          </View>

          {/* Demo QR Simulation Pills for Multiple Outlets */}
          <View style={styles.quickSelectSection}>
            <Text style={styles.sectionLabel}>Test Encrypted QR Scans for Outlets:</Text>
            
            {/* Restaurant 1 Demo Pills */}
            <View style={styles.outletBlock}>
              <Text style={styles.outletName}>🍷 Menza Fine Dining (Encrypted ID: uqQTzsGy...)</Text>
              <View style={styles.tablesPillRow}>
                {[1, 2, 3, 4].map((tNum) => (
                  <TouchableOpacity
                    key={`r1_t${tNum}`}
                    style={styles.tablePillRest1}
                    onPress={() => {
                      onSelectScanResult(KNOWN_ENCRYPTED_IDS[1], tNum);
                      onClose();
                    }}
                  >
                    <Text style={styles.tablePillTextRest1}>Table #{tNum}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Restaurant 2 Demo Pills */}
            <View style={styles.outletBlock}>
              <Text style={styles.outletName}>☕ Menza Express Cafe (Encrypted ID: NQZ2reN9...)</Text>
              <View style={styles.tablesPillRow}>
                {[101, 102, 103, 104].map((tNum) => (
                  <TouchableOpacity
                    key={`r2_t${tNum}`}
                    style={styles.tablePillRest2}
                    onPress={() => {
                      onSelectScanResult(KNOWN_ENCRYPTED_IDS[2], tNum);
                      onClose();
                    }}
                  >
                    <Text style={styles.tablePillTextRest2}>Cafe Table #{tNum}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Manual Input Fallback */}
          <View style={styles.manualSection}>
            <TextInput
              style={styles.manualInput as any}
              placeholder="Paste QR URL e.g. ?encRestId=uqQTzsGyDJy4_TBVeYXCfg&tableId=3"
              placeholderTextColor="#64748b"
              value={manualText}
              onChangeText={setManualText}
            />
            <TouchableOpacity style={styles.manualSubmitBtn} onPress={handleManualSubmit}>
              <Check size={16} color="#0f172a" />
              <Text style={styles.manualSubmitBtnText}>Open Menu</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalBox: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#0f172a',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    gap: 14,
    maxHeight: '92%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 6,
  },
  scannerWrapper: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 8,
    alignItems: 'center',
  },
  quickSelectSection: {
    gap: 8,
  },
  sectionLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
  outletBlock: {
    gap: 6,
    backgroundColor: '#1e293b',
    padding: 10,
    borderRadius: 10,
  },
  outletName: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  tablesPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tablePillRest1: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10b981',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
  },
  tablePillTextRest1: {
    color: '#10b981',
    fontWeight: '800',
    fontSize: 11,
  },
  tablePillRest2: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: '#f59e0b',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
  },
  tablePillTextRest2: {
    color: '#f59e0b',
    fontWeight: '800',
    fontSize: 11,
  },
  manualSection: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  manualInput: {
    flex: 1,
    minWidth: 160,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    color: '#ffffff',
    fontSize: 12,
    outlineStyle: 'none',
  },
  manualSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#10b981',
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 10,
  },
  manualSubmitBtnText: {
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 12,
  },
});
