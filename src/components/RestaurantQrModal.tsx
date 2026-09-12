import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
} from 'react-native';
import {
  X,
  QrCode,
  Download,
  Printer,
  Copy,
  Check,
  Store,
  Share2,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { encryptRestaurantId } from '../services/api';
import { Catalog, Table } from '../types';

export interface DownloadQrCodeImageOptions {
  svgElementId: string;
  title?: string;
  subtitle?: string;
  fileName?: string;
  tableNumber?: string | number | null;
}

export interface DownloadQrCodeSvgOptions {
  svgElementId: string;
  fileName?: string;
}

export interface RestaurantQrModalProps {
  visible: boolean;
  onClose: () => void;
  catalog?: Catalog | null;
  restaurantName?: string;
  activeTable?: Table | null;
  tables?: Table[];
}

/**
 * Utility to generate a high-res branded PNG image from an SVG QR code element
 */
export function downloadQrCodeImage({
  svgElementId,
  title = 'Menza Restaurant',
  subtitle = 'Scan with Phone to View Menu & Order',
  fileName = 'restaurant-qr.png',
  tableNumber = null,
}: DownloadQrCodeImageOptions) {
  const svg = document.getElementById(svgElementId);
  if (!svg) {
    console.warn(`SVG element with id "${svgElementId}" not found for download.`);
    return;
  }

  const svgData = new XMLSerializer().serializeToString(svg);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const img = new Image();

  img.onload = () => {
    const scale = 2;
    const width = 360 * scale;
    const height = 470 * scale;
    canvas.width = width;
    canvas.height = height;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#D33401';
    ctx.fillRect(0, 0, width, 8 * scale);

    ctx.fillStyle = '#1B1C1C';
    ctx.font = `bold ${18 * scale}px 'Plus Jakarta Sans', -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(title, width / 2, 42 * scale);

    if (tableNumber) {
      ctx.fillStyle = '#FFF1EC';
      const badgeW = 130 * scale;
      const badgeH = 22 * scale;
      ctx.fillRect((width - badgeW) / 2, 54 * scale, badgeW, badgeH);
      ctx.fillStyle = '#D33401';
      ctx.font = `bold ${11 * scale}px 'Plus Jakarta Sans', sans-serif`;
      ctx.fillText(`TABLE #${tableNumber}`, width / 2, 69 * scale);
    } else {
      ctx.fillStyle = '#747878';
      ctx.font = `500 ${11 * scale}px 'Plus Jakarta Sans', sans-serif`;
      ctx.fillText(subtitle, width / 2, 64 * scale);
    }

    const qrSize = 220 * scale;
    const qrX = (width - qrSize) / 2;
    const qrY = 90 * scale;

    ctx.fillStyle = '#FBF9F9';
    ctx.strokeStyle = '#E0DDD8';
    ctx.lineWidth = 1 * scale;
    ctx.fillRect(
      qrX - 10 * scale,
      qrY - 10 * scale,
      qrSize + 20 * scale,
      qrSize + 20 * scale
    );
    ctx.strokeRect(
      qrX - 10 * scale,
      qrY - 10 * scale,
      qrSize + 20 * scale,
      qrSize + 20 * scale
    );

    ctx.drawImage(img, qrX, qrY, qrSize, qrSize);

    ctx.fillStyle = '#1B1C1C';
    ctx.font = `bold ${13 * scale}px 'Plus Jakarta Sans', sans-serif`;
    ctx.fillText('📱 Scan with Camera to Order', width / 2, 345 * scale);

    ctx.fillStyle = '#747878';
    ctx.font = `500 ${11 * scale}px 'Plus Jakarta Sans', sans-serif`;
    ctx.fillText(
      'No App Download Required • Instant Ordering',
      width / 2,
      368 * scale
    );

    ctx.strokeStyle = '#EFEDED';
    ctx.beginPath();
    ctx.moveTo(30 * scale, 395 * scale);
    ctx.lineTo(width - 30 * scale, 395 * scale);
    ctx.stroke();

    ctx.fillStyle = '#D33401';
    ctx.font = `bold ${12 * scale}px 'Plus Jakarta Sans', sans-serif`;
    ctx.fillText('⚡ MenzaOrder Digital Dining', width / 2, 430 * scale);

    try {
      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = fileName;
      downloadLink.href = pngFile;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    } catch (err) {
      console.error('QR download error:', err);
    }
  };

  img.src =
    'data:image/svg+xml;base64,' +
    btoa(unescape(encodeURIComponent(svgData)));
}

/**
 * Utility to download QR code as vector SVG file
 */
export function downloadQrCodeSvg({
  svgElementId,
  fileName = 'restaurant-qr.svg',
}: DownloadQrCodeSvgOptions) {
  const svg = document.getElementById(svgElementId);
  if (!svg) return;

  const svgData = new XMLSerializer().serializeToString(svg);
  const blob = new Blob([svgData], {
    type: 'image/svg+xml;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function RestaurantQrModal({
  visible,
  onClose,
  catalog,
  restaurantName,
  activeTable,
  tables = [],
}: RestaurantQrModalProps) {
  const [selectedTableId, setSelectedTableId] = useState<number | string | null>(
    activeTable ? activeTable.id : null
  );
  const [copied, setCopied] = useState(false);
  const [qrReady, setQrReady] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!visible) {
      setQrReady(false);
      return;
    }

    const frame = requestAnimationFrame(() => setQrReady(true));

    return () => cancelAnimationFrame(frame);
  }, [visible]);

  const restName =
    restaurantName || catalog?.restaurantName || 'Menza Fine Dining';

  const restId = catalog?.restaurantId || 1;
  const encId =
    catalog?.encryptedRestaurantId || encryptRestaurantId(restId);

  const targetUrl = selectedTableId
    ? `${window.location.origin}/?encRestId=${encId}&tableId=${selectedTableId}`
    : `${window.location.origin}/?encRestId=${encId}`;

  const qrElementId = `modal-qr-code-${selectedTableId || 'main'}`;

  const handleCopyLink = async () => {
    try {
      if (!navigator.clipboard) {
        console.warn('Clipboard API is not available.');
        return;
      }

      await navigator.clipboard.writeText(targetUrl);
      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 2500);
    } catch (error) {
      console.error('Copy QR link error:', error);
    }
  };

  const handleShare = async () => {
    if (sharing) return;

    try {
      setSharing(true);

      if (navigator.share) {
        await navigator.share({
          title: `${restName} - Digital Menu`,
          text: selectedTableId
            ? `Scan or open this link to view the menu and order from Table #${selectedTableId}.`
            : `View the ${restName} digital menu and place your order.`,
          url: targetUrl,
        });
      } else {
        await handleCopyLink();
      }
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        console.error('QR share error:', error);

        try {
          await handleCopyLink();
        } catch (copyError) {
          console.error('QR share fallback error:', copyError);
        }
      }
    } finally {
      setSharing(false);
    }
  };

  const handleDownloadPng = () => {
    const tableLabel = selectedTableId
      ? `table-${selectedTableId}`
      : 'main';

    const cleanRestName = restName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-');

    const fileName = `${cleanRestName}-qr-${tableLabel}.png`;

    downloadQrCodeImage({
      svgElementId: qrElementId,
      title: restName,
      subtitle: 'Scan to View Menu & Order',
      fileName,
      tableNumber: selectedTableId,
    });
  };

  const handleDownloadSvg = () => {
    const tableLabel = selectedTableId
      ? `table-${selectedTableId}`
      : 'main';

    const cleanRestName = restName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-');

    const fileName = `${cleanRestName}-qr-${tableLabel}.svg`;

    downloadQrCodeSvg({
      svgElementId: qrElementId,
      fileName,
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay} className="responsive-modal-overlay">
        <View style={styles.modalBox} className="responsive-modal-sheet">
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.headerIconBox}>
                <QrCode size={18} color="#D33401" />
              </View>

              <View>
                <Text style={styles.title}>Restaurant QR Code</Text>
                <Text style={styles.subTitle} numberOfLines={1}>
                  {restName}
                </Text>
              </View>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color="#747878" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.bodyScroll}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.selectorSection}>
              <Text style={styles.selectorLabel}>
                Select QR Destination:
              </Text>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.pillsRow}
              >
                <TouchableOpacity
                  style={[
                    styles.pill,
                    selectedTableId === null && styles.pillActive,
                  ]}
                  onPress={() => setSelectedTableId(null)}
                >
                  <Store
                    size={13}
                    color={
                      selectedTableId === null
                        ? '#ffffff'
                        : '#444748'
                    }
                  />

                  <Text
                    style={[
                      styles.pillText,
                      selectedTableId === null &&
                        styles.pillTextActive,
                    ]}
                  >
                    Main Outlet (All)
                  </Text>
                </TouchableOpacity>

                {tables.map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    style={[
                      styles.pill,
                      selectedTableId === t.id &&
                        styles.pillActive,
                    ]}
                    onPress={() => setSelectedTableId(t.id)}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        selectedTableId === t.id &&
                          styles.pillTextActive,
                      ]}
                    >
                      {t.tableName || `Table #${t.id}`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.qrCardPreview}>
              <View style={styles.qrCardHeader}>
                <Text style={styles.qrCardTitle}>{restName}</Text>

                <Text style={styles.qrCardSub}>
                  {selectedTableId
                    ? `Table #${selectedTableId} • Dine-In Ordering`
                    : 'Digital Menu & Instant Ordering'}
                </Text>
              </View>

              <View style={styles.qrCodeWrapper}>
                {qrReady ? (
                  <QRCodeSVG
                    id={qrElementId}
                    value={targetUrl}
                    size={190}
                    bgColor="#ffffff"
                    fgColor="#1B1C1C"
                    level="Q"
                  />
                ) : (
                  <View style={styles.qrPlaceholder}>
                    <QrCode
                      size={54}
                      color="#D33401"
                      strokeWidth={1.8}
                    />

                    <Text style={styles.qrLoadingText}>
                      Preparing QR...
                    </Text>
                  </View>
                )}
              </View>

              <Text style={styles.qrCardInstruction}>
                📱 Scan with camera to browse menu & place orders
              </Text>

              <View style={styles.urlBox}>
                <Text style={styles.urlText} numberOfLines={1}>
                  {targetUrl}
                </Text>

                <TouchableOpacity
                  style={styles.copyBtn}
                  onPress={handleCopyLink}
                >
                  {copied ? (
                    <Check size={14} color="#15803d" />
                  ) : (
                    <Copy size={14} color="#747878" />
                  )}

                  <Text
                    style={[
                      styles.copyBtnText,
                      copied && { color: '#15803d' },
                    ]}
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.actionsGrid}>
              <TouchableOpacity
                style={styles.downloadPrimaryBtn}
                onPress={handleDownloadPng}
                activeOpacity={0.85}
              >
                <Download size={18} color="#ffffff" />

                <Text style={styles.downloadPrimaryBtnText}>
                  DOWNLOAD QR IMAGE (PNG)
                </Text>
              </TouchableOpacity>

              <View style={styles.secondaryActionsRow}>
                <TouchableOpacity
                  style={styles.secondaryActionBtn}
                  onPress={handleShare}
                  disabled={sharing}
                >
                  {sharing ? (
                    <Share2 size={15} color="#D33401" />
                  ) : (
                    <Share2 size={15} color="#1B1C1C" />
                  )}

                  <Text style={styles.secondaryActionBtnText}>
                    {sharing ? 'Sharing...' : 'Share QR'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryActionBtn}
                  onPress={handleDownloadSvg}
                >
                  <Download size={15} color="#1B1C1C" />

                  <Text style={styles.secondaryActionBtnText}>
                    Download Vector (SVG)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryActionBtn}
                  onPress={handlePrint}
                >
                  <Printer size={15} color="#1B1C1C" />

                  <Text style={styles.secondaryActionBtnText}>
                    Print QR Card
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(27, 28, 28, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },

  modalBox: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E0DDD8',
    overflow: 'hidden',
    maxHeight: '92%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
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

  headerIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#FFF1EC',
    borderWidth: 1,
    borderColor: '#F3C8BA',
    alignItems: 'center',
    justifyContent: 'center',
  },

  title: {
    color: '#1B1C1C',
    fontSize: 16,
    fontWeight: '800',
  },

  subTitle: {
    color: '#747878',
    fontSize: 11,
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
    padding: 18,
    gap: 14,
  },

  selectorSection: {
    gap: 6,
  },

  selectorLabel: {
    color: '#1B1C1C',
    fontSize: 12,
    fontWeight: '700',
  },

  pillsRow: {
    flexDirection: 'row',
    gap: 6,
    paddingRight: 10,
  },

  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EFEDED',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E0DDD8',
  },

  pillActive: {
    backgroundColor: '#D33401',
    borderColor: '#D33401',
  },

  pillText: {
    color: '#444748',
    fontSize: 11,
    fontWeight: '700',
  },

  pillTextActive: {
    color: '#ffffff',
  },

  qrCardPreview: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0DDD8',
    padding: 20,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },

  qrCardHeader: {
    alignItems: 'center',
    gap: 3,
  },

  qrCardTitle: {
    color: '#1B1C1C',
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },

  qrCardSub: {
    color: '#747878',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },

  qrCodeWrapper: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EFEDED',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },

  qrPlaceholder: {
    width: 190,
    height: 190,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FBF9F9',
    borderRadius: 8,
    gap: 8,
  },

  qrLoadingText: {
    color: '#747878',
    fontSize: 11,
    fontWeight: '600',
  },

  qrCardInstruction: {
    color: '#1B1C1C',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },

  urlBox: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FBF9F9',
    borderWidth: 1,
    borderColor: '#E0DDD8',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  urlText: {
    flex: 1,
    color: '#747878',
    fontSize: 11,
  },

  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#EFEDED',
    borderRadius: 6,
  },

  copyBtnText: {
    color: '#1B1C1C',
    fontSize: 11,
    fontWeight: '700',
  },

  actionsGrid: {
    gap: 10,
    marginTop: 4,
  },

  downloadPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#D33401',
    paddingVertical: 14,
    borderRadius: 16,
    shadowColor: '#D33401',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    minHeight: 48,
  },

  downloadPrimaryBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
  },

  secondaryActionsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },

  secondaryActionBtn: {
    flex: 1,
    minWidth: 130,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#EFEDED',
    borderWidth: 1,
    borderColor: '#E0DDD8',
    paddingVertical: 10,
    borderRadius: 12,
  },

  secondaryActionBtnText: {
    color: '#1B1C1C',
    fontSize: 11,
    fontWeight: '700',
  },
});
