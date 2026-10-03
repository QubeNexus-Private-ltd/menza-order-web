import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, ActivityIndicator } from 'react-native';
import { X, Camera, AlertCircle, RefreshCw } from 'lucide-react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';

export interface QrScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectScanResult: (encId: string, tableId: string | number | null) => void;
}

export default function QrScannerModal({
  visible,
  onClose,
  onSelectScanResult,
}: QrScannerModalProps) {
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const parseQrText = (decodedText: string): { encId: string; tableId: string | number | null } => {
    let encId = '';
    let tableId: string | number | null = null;
    const text = (decodedText || '').trim();

    // 1. JSON QR
    if (text.startsWith('{') && text.endsWith('}')) {
      try {
        const obj = JSON.parse(text);
        encId = obj.r || obj.encRestId || obj.encryptedRestaurantId || (obj.restaurantId ? String(obj.restaurantId) : '');
        if (obj.tableId || obj.table) tableId = obj.tableId || obj.table;
        return { encId, tableId };
      } catch {}
    }

    // 2. URL parsing
    try {
      if (text.includes('http://') || text.includes('https://') || text.includes('?') || text.includes('/dinein/')) {
        const urlStr = text.startsWith('http') ? text : `https://dummy.com/${text.replace(/^\//, '')}`;
        const u = new URL(urlStr);
        const qR = u.searchParams.get('r') || u.searchParams.get('encRestId') || u.searchParams.get('enc') || u.searchParams.get('restaurantId');
        const qT = u.searchParams.get('tableId') || u.searchParams.get('table');
        if (qR) encId = qR;
        if (qT) tableId = qT;

        const dineInMatch = u.pathname.match(/\/dinein\/([^\/]+)(?:\/([^\/]+))?/);
        if (dineInMatch) {
          if (dineInMatch[1]) encId = dineInMatch[1];
          if (dineInMatch[2]) tableId = dineInMatch[2];
        }
      }
    } catch {}

    // 3. Fallback Regex
    if (!encId) {
      const encMatch = text.match(/(?:encRestId|r|enc)=([^&]+)/i);
      const restMatch = text.match(/restaurantId=([^&]+)/i);
      if (encMatch) {
        encId = decodeURIComponent(encMatch[1]);
      } else if (restMatch) {
        encId = decodeURIComponent(restMatch[1]);
      } else {
        encId = text;
      }
    }

    if (!tableId) {
      const tableMatch = text.match(/(?:tableId|table)=([^&]+)/i);
      if (tableMatch) {
        tableId = decodeURIComponent(tableMatch[1]);
      }
    }

    return { encId, tableId };
  };

  const stopScanner = async (scanner: Html5Qrcode | null) => {
    if (!scanner) return;
    try {
      if (scanner.getState() === Html5QrcodeScannerState.SCANNING) {
        await scanner.stop();
      }
      scanner.clear();
    } catch (e) {
      console.warn('Scanner stop error:', e);
    }
  };

  const startCamera = async () => {
    setIsLoading(true);
    setCameraError(null);

    try {
      // Ensure #qr-reader element is ready in DOM
      const readerEl = document.getElementById('qr-reader');
      if (!readerEl) return;

      // Clean up previous instance if any
      if (scannerRef.current) {
        await stopScanner(scannerRef.current);
      }

      const html5QrCode = new Html5Qrcode('qr-reader');
      scannerRef.current = html5QrCode;

      const onScanSuccess = async (decodedText: string) => {
        await stopScanner(html5QrCode);
        const parsed = parseQrText(decodedText);
        onSelectScanResult(parsed.encId, parsed.tableId);
        onClose();
      };

      const qrConfig = {
        fps: 15,
        qrbox: { width: 240, height: 240 },
        aspectRatio: 1.0,
      };

      try {
        await html5QrCode.start(
          { facingMode: 'environment' },
          qrConfig,
          onScanSuccess,
          () => {} // per-frame scan error, safe to ignore
        );
      } catch (backCamErr) {
        console.warn('Back camera unavailable, attempting any camera...', backCamErr);
        const cameras = await Html5Qrcode.getCameras();
        if (cameras && cameras.length > 0) {
          await html5QrCode.start(
            cameras[0].id,
            qrConfig,
            onScanSuccess,
            () => {}
          );
        } else {
          throw new Error('No camera found on this device.');
        }
      }

      setIsLoading(false);
    } catch (err: any) {
      console.error('Camera start failed:', err);
      setIsLoading(false);
      setCameraError(
        err?.message?.includes('Permission') || err?.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera access in your browser settings.'
          : 'Unable to open camera. Please check your camera permissions.'
      );
    }
  };

  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        startCamera();
      }, 100);
      return () => {
        clearTimeout(timer);
        if (scannerRef.current) {
          stopScanner(scannerRef.current);
        }
      };
    } else {
      if (scannerRef.current) {
        stopScanner(scannerRef.current);
      }
      setCameraError(null);
      setIsLoading(true);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalBox}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <div className="w-8 h-8 rounded-lg bg-[#D33401]/10 flex items-center justify-center">
                <Camera size={18} color="#D33401" />
              </div>
              <div>
                <Text style={styles.title}>Scan QR Code</Text>
                <Text style={styles.subtitle}>Point camera at your table QR</Text>
              </div>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={20} color="#747878" />
            </TouchableOpacity>
          </View>

          {/* Camera Viewport */}
          <View style={styles.cameraContainer}>
            {isLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1B1C1C] text-white z-10 p-4">
                <ActivityIndicator size="large" color="#D33401" />
                <span className="text-xs font-semibold text-gray-300 mt-3">Opening camera...</span>
              </div>
            )}

            {cameraError ? (
              <div className="p-6 flex flex-col items-center justify-center text-center bg-red-50/10 rounded-2xl h-64">
                <AlertCircle size={36} color="#ef4444" className="mb-3" />
                <p className="text-xs text-red-200 mb-4 max-w-xs leading-relaxed">{cameraError}</p>
                <button
                  onClick={startCamera}
                  className="px-4 py-2 bg-[#D33401] hover:bg-[#b82d01] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw size={14} />
                  <span>Try Again</span>
                </button>
              </div>
            ) : (
              <div
                id="qr-reader"
                style={{
                  width: '100%',
                  borderRadius: 16,
                  overflow: 'hidden',
                  backgroundColor: '#000',
                  minHeight: 280,
                }}
              />
            )}
          </View>

          {/* Bottom helper text */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Align the QR code within the frame to order</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalBox: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E0DDD8',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    color: '#1B1C1C',
    fontSize: 16,
    fontWeight: '800',
  },
  subtitle: {
    color: '#747878',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: '#F5F4F0',
  },
  cameraContainer: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000000',
    position: 'relative',
    minHeight: 280,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
  },
  footerText: {
    color: '#747878',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
});
