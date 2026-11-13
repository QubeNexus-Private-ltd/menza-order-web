import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  ChefHat,
  CheckCircle2,
  Clock,
  UtensilsCrossed,
  MapPin,
  Phone,
  RefreshCw,
  Share2,
  AlertCircle,
  IndianRupee,
  ReceiptText,
  Sparkles,
  CreditCard,
  Hash,
  Store,
  Check,
  ChevronRight,
  ShoppingBag,
  Printer,
  Download,
  Calendar,
  User,
  ShieldCheck,
  MessageCircle,
  Flame,
  ArrowRight,
  FileText,
  BadgeCheck,
  ExternalLink,
  Copy,
  ArrowLeft,
  X,
  Send,
  Eye,
  Info,
  QrCode,
  Building2,
  CheckCheck,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import * as api from '../services/api';
import * as signalrService from '../services/signalr';
import { OrderWhatsAppService } from '../services/whatsAppService';
import { Order, OrderItem } from '../types';

export interface OrderTrackingPageProps {
  orderId: string | number;
  onExploreMenu?: (restaurantId: number, tableId?: number | null) => void;
  onScanQr?: () => void;
  initialOrder?: Order | null;
  initialTab?: 'receipt' | 'tracker';
}

// Convert numbers to Indian Currency Words (e.g., "Six Hundred One Rupees Only")
function numberToWordsINR(amount: number): string {
  const n = Math.round(amount);
  if (n <= 0) return 'Zero Rupees Only';

  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertChunk(num: number): string {
    let str = '';
    if (num >= 100) {
      str += units[Math.floor(num / 100)] + ' Hundred ';
      num %= 100;
    }
    if (num >= 20) {
      str += tens[Math.floor(num / 10)] + ' ';
      num %= 10;
    }
    if (num > 0) {
      str += units[num] + ' ';
    }
    return str.trim();
  }

  let result = '';
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const remainder = n % 1000;

  if (crore > 0) result += convertChunk(crore) + ' Crore ';
  if (lakh > 0) result += convertChunk(lakh) + ' Lakh ';
  if (thousand > 0) result += convertChunk(thousand) + ' Thousand ';
  if (remainder > 0) result += convertChunk(remainder) + ' ';

  return result.trim() + ' Rupees Only';
}

// Stage progress normalizer
function getStepperStage(orderStatus?: string | null, kitchenStatus?: string | null): number {
  const os = String(orderStatus || '').toUpperCase().trim();
  const ks = String(kitchenStatus || '').toUpperCase().trim();

  if (os === 'CANCELLED' || os === 'CANCELED' || os === 'REJECTED') {
    return -1;
  }

  if (os === 'SETTLED' || os === 'COMPLETED' || os === 'SERVED' || ks === 'SERVED' || ks === 'COMPLETED') {
    return 4;
  }

  if (os === 'READY' || ks === 'READY') {
    return 3;
  }

  if (
    os === 'PREPARING' ||
    os === 'IN_KITCHEN' ||
    ks === 'PREPARING' ||
    ks === 'IN-PREPARATION' ||
    ks === 'IN_PREPARATION' ||
    ks === 'COOKING' ||
    ks === 'RECEIVED'
  ) {
    return 2;
  }

  if (os === 'CONFIRMED' || ks === 'CONFIRMED') {
    return 1;
  }

  return 0;
}

// 5-Step timeline configuration
const TIMELINE_STEPS = [
  { id: 0, title: 'Placed', subtitle: 'Ticket Generated', icon: Clock },
  { id: 1, title: 'Confirmed', subtitle: 'Kitchen Accepted', icon: CheckCircle2 },
  { id: 2, title: 'In Kitchen', subtitle: 'Cooking', icon: Flame },
  { id: 3, title: 'Food Ready', subtitle: 'Plated to Serve', icon: Sparkles },
  { id: 4, title: 'Served', subtitle: 'Settled & Completed', icon: Check },
];

// Rich Sample Demo Order for Instantaneous Review
const DEMO_ORDER: Order = {
  id: 1048,
  orderId: 1048,
  restaurantId: 1,
  restaurantName: 'MENZA GOURMET BISTRO & RESTAURANT PRIVATE LIMITED',
  address: 'Plot No. 128, 100 Feet Road, Indiranagar',
  city: 'Bengaluru',
  state: 'Karnataka - 560038',
  gstNumber: '29ABCDE1234F1Z5',
  contactPhone: '+91 98765 43210',
  customerName: 'Praveen Kumar',
  customerPhone: '9876543210',
  mobileNumber: '9876543210',
  tableName: 'Table 04',
  tableId: 4,
  pickupToken: 'TK-1048',
  deliveryType: 'Dine-In',
  orderStatus: 'Cooking',
  kitchenStatus: 'In-Preparation',
  isSettled: false,
  paymentStatus: 'PAID',
  paymentMode: 'UPI (GPay / PhonePe)',
  createdDateUtc: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
  itemTotal: 620,
  subTotal: 620,
  cgstAmount: 15.5,
  sgstAmount: 15.5,
  taxAmount: 31,
  discountAmount: 50,
  totalAmount: 601,
  items: [
    {
      id: 1,
      itemName: 'Paneer Butter Masala (Chef Special)',
      name: 'Paneer Butter Masala (Chef Special)',
      quantity: 1,
      price: 260,
      amount: 260,
      totalAmount: 260,
      isVeg: true,
      cookingInstruction: 'Medium spicy, finished with cream',
    },
    {
      id: 2,
      itemName: 'Butter Garlic Naan',
      name: 'Butter Garlic Naan',
      quantity: 3,
      price: 60,
      amount: 60,
      totalAmount: 180,
      isVeg: true,
    },
    {
      id: 3,
      itemName: 'Murgh Awadhi Dum Handi Biryani',
      name: 'Murgh Awadhi Dum Handi Biryani',
      quantity: 1,
      price: 180,
      amount: 180,
      totalAmount: 180,
      isVeg: false,
      cookingInstruction: 'Served with mirchi ka salan & raita',
    },
  ],
};

// Handcrafted Veg / Non-Veg Indicator
function VegBadge({ isVeg, name }: { isVeg?: boolean; name?: string }) {
  const itemName = (name || '').toLowerCase();
  const isDefinitelyVeg =
    isVeg !== undefined
      ? isVeg
      : !itemName.includes('chicken') &&
        !itemName.includes('mutton') &&
        !itemName.includes('fish') &&
        !itemName.includes('egg') &&
        !itemName.includes('prawn') &&
        !itemName.includes('meat') &&
        !itemName.includes('murgh');

  return (
    <span
      className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded-xs border shrink-0 ${
        isDefinitelyVeg ? 'border-emerald-700 bg-emerald-50' : 'border-amber-900 bg-amber-50'
      }`}
      title={isDefinitelyVeg ? 'Vegetarian' : 'Non-Vegetarian'}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          isDefinitelyVeg ? 'bg-emerald-700' : 'bg-amber-900'
        }`}
      />
    </span>
  );
}

export default function OrderTrackingPage({
  orderId,
  onExploreMenu,
  onScanQr,
  initialOrder = null,
  initialTab,
}: OrderTrackingPageProps) {
  const cleanOrderId = String(orderId || '').trim();
  const isExplicitDemo = cleanOrderId.toLowerCase() === 'demo' || cleanOrderId === 'sample';

  // Smart Initial Tab Selection: Default to formal Bill & Receipt
  const [activeTab, setActiveTab] = useState<'receipt' | 'tracker'>(() => {
    if (initialTab) return initialTab;
    if (typeof window !== 'undefined') {
      const p = window.location.pathname.toLowerCase();
      const s = new URLSearchParams(window.location.search);
      if (p.includes('/track') || s.get('tab') === 'tracker') {
        return 'tracker';
      }
    }
    return 'receipt'; // Immediate professional bill
  });

  const [order, setOrder] = useState<Order | null>(isExplicitDemo ? DEMO_ORDER : initialOrder);
  const [loading, setLoading] = useState<boolean>(!initialOrder && !isExplicitDemo);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [signalRConnected, setSignalRConnected] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // WhatsApp Interactive Modal
  const [whatsappModalOpen, setWhatsappModalOpen] = useState<boolean>(false);
  const [whatsappPhone, setWhatsappPhone] = useState<string>('');

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Fetch Order Data
  const loadOrder = useCallback(
    async (isManualRefresh = false) => {
      if (!cleanOrderId || isExplicitDemo) return;
      if (isManualRefresh) setRefreshing(true);
      try {
        const data = await api.getOrder(cleanOrderId);
        if (data && (data.orderId || data.id)) {
          setOrder(data);
          setError(null);
        } else if (!order) {
          setError('Order details could not be found. You can preview the sample professional bill below.');
        }
      } catch (err: any) {
        if (!order) {
          setError('Unable to load order details. You can preview the sample professional bill below.');
        }
      } finally {
        setLoading(false);
        if (isManualRefresh) setRefreshing(false);
      }
    },
    [cleanOrderId, isExplicitDemo, order]
  );

  useEffect(() => {
    if (!isExplicitDemo) {
      loadOrder();
    }
  }, [loadOrder, isExplicitDemo]);

  // Real-time WebSocket synchronization
  useEffect(() => {
    if (!cleanOrderId || isExplicitDemo) return;

    let isMounted = true;
    const targetRestId = order?.restaurantId ? Number(order.restaurantId) : null;

    signalrService
      .startSignalRConnection(targetRestId, cleanOrderId)
      .then(() => {
        if (isMounted) setSignalRConnected(true);
      })
      .catch(() => {
        if (isMounted) setSignalRConnected(false);
      });

    signalrService.joinOrderGroup(cleanOrderId);
    if (targetRestId) {
      signalrService.joinRestaurantGroup(targetRestId);
    }

    const unsubStatus = signalrService.onOrderStatusChanged((payload: any) => {
      const changedId = String(payload?.orderId || payload?.OrderId || payload?.id || payload?.Id || '');
      if (changedId === cleanOrderId) {
        setOrder((prev) => {
          if (!prev) return prev;
          const updatedStatus = payload?.newStatus || payload?.orderStatus || payload?.status || prev.orderStatus;
          const updatedKitchen = payload?.kitchenStatus || prev.kitchenStatus;
          return {
            ...prev,
            orderStatus: updatedStatus,
            kitchenStatus: updatedKitchen,
            isSettled: updatedStatus === 'SETTLED' || updatedStatus === 'Completed' || prev.isSettled,
          };
        });
        loadOrder();
      }
    });

    const unsubKitchen = signalrService.onKitchenProgress((payload: any) => {
      const changedId = String(payload?.orderId || payload?.OrderId || payload?.id || payload?.Id || '');
      if (changedId === cleanOrderId) {
        setOrder((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            kitchenStatus: payload?.kitchenStatus || payload?.status || prev.kitchenStatus,
          };
        });
        loadOrder();
      }
    });

    const unsubPayment = signalrService.onPaymentVerified((payload: any) => {
      const changedId = String(payload?.orderId || payload?.OrderId || payload?.id || payload?.Id || '');
      if (changedId === cleanOrderId) {
        setOrder((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            paymentStatus: 'PAID',
            isSettled: true,
          };
        });
        loadOrder();
      }
    });

    return () => {
      isMounted = false;
      unsubStatus();
      unsubKitchen();
      unsubPayment();
    };
  }, [cleanOrderId, order?.restaurantId, loadOrder, isExplicitDemo]);

  // Derived Data
  const activeOrderData = order || DEMO_ORDER;
  const itemsList: OrderItem[] = Array.isArray(activeOrderData.items) && activeOrderData.items.length > 0
    ? activeOrderData.items
    : Array.isArray(activeOrderData.orderItems)
    ? activeOrderData.orderItems
    : [];

  const isDineIn = Boolean(
    activeOrderData.tableName ||
    activeOrderData.tableId ||
    (activeOrderData.deliveryType && activeOrderData.deliveryType.toLowerCase().includes('dine'))
  );

  const subTotal = Number(activeOrderData.itemTotal || activeOrderData.subTotal || activeOrderData.orderAmount || 0);
  const cgst = Number(activeOrderData.cgstAmount || activeOrderData.cgst || 0);
  const sgst = Number(activeOrderData.sgstAmount || activeOrderData.sgst || 0);
  const tax = Number(activeOrderData.taxAmount || (cgst + sgst));
  const discount = Number(activeOrderData.discountAmount || 0);
  const grandTotal = Number(activeOrderData.totalAmount || subTotal + tax - discount);
  const isPaid = activeOrderData.isSettled || String(activeOrderData.paymentStatus || '').toUpperCase() === 'PAID';

  // Payment Mode Resolution: accurately extract paymentMode from the API response
  const paymentMode = (
    activeOrderData.paymentMode ||
    activeOrderData.PaymentMode ||
    activeOrderData.paymentMethod ||
    activeOrderData.PaymentMethod ||
    activeOrderData.paymentType ||
    activeOrderData.PaymentType ||
    ''
  ).toString().trim();

  // Statutory Tax & GST Bifurcation Rule:
  // If GST number is not present or cgst or sgst is 0 then do NOT do any bifurcation,
  // do not mention any GST, and explicitly mention net total is inclusive of all taxes.
  const rawGst = activeOrderData.gstNumber;
  const cleanGst = typeof rawGst === 'string' && rawGst.trim().length > 0 ? rawGst.trim() : null;
  const hasGstBifurcation = Boolean(cleanGst && cgst > 0 && sgst > 0);

  const orderTimeFormatted = activeOrderData.createdDateUtc || activeOrderData.createdAt
    ? new Date(activeOrderData.createdDateUtc || activeOrderData.createdAt!).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
    : 'Just now';

  const billUrl = typeof window !== 'undefined'
    ? window.location.href
    : `https://menzaorder.co.in/bill/${cleanOrderId || '1048'}`;

  const currentStage = getStepperStage(activeOrderData.orderStatus, activeOrderData.kitchenStatus);
  const isCancelled = currentStage === -1;

  // Handlers
  const handleCopyLink = async () => {
    if (typeof window === 'undefined') return;
    try {
      await navigator.clipboard.writeText(billUrl);
      showToast('Bill link copied to clipboard');
    } catch {
      showToast('Failed to copy link');
    }
  };

  const handleNativeShare = async () => {
    if (typeof window === 'undefined') return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${hasGstBifurcation ? 'Tax Invoice' : 'Bill'} #${cleanOrderId || '1048'} - ${activeOrderData.restaurantName || 'Menza'}`,
          text: `View official ${hasGstBifurcation ? 'tax invoice' : 'bill'} for Order #${cleanOrderId || '1048'}`,
          url: billUrl,
        });
        return;
      } catch {}
    }
    handleCopyLink();
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const triggerWhatsAppDispatch = (targetPhone: string) => {
    OrderWhatsAppService.shareWhatsAppReceipt(
      targetPhone,
      {
        restaurantName: activeOrderData.restaurantName || 'Menza Restaurant',
        orderId: cleanOrderId || '1048',
        customerName: activeOrderData.customerName,
        tableName: activeOrderData.tableName,
        orderType: activeOrderData.deliveryType || (isDineIn ? 'Dine-In' : 'Takeaway'),
        items: itemsList.map((it: any) => ({
          itemName: it.itemName || it.name,
          quantity: Number(it.quantity || 1),
          price: Number(it.amount ?? it.unitPrice ?? it.price ?? 0),
        })),
        subTotal,
        cgst,
        sgst,
        taxAmount: tax,
        discountAmount: discount,
        grandTotal,
        paymentMode: paymentMode || activeOrderData.paymentMode || (isPaid ? 'CASH' : 'Pending'),
        paymentStatus: activeOrderData.paymentStatus || (isPaid ? 'PAID' : 'Pending'),
        billUrl,
        gstNumber: hasGstBifurcation ? cleanGst : undefined,
      },
      activeOrderData
    );
  };

  const handleOpenWhatsAppShare = () => {
    const existingPhone = OrderWhatsAppService.resolveMobileNumber('', activeOrderData);
    if (existingPhone && existingPhone.length >= 10) {
      triggerWhatsAppDispatch(existingPhone);
    } else {
      setWhatsappPhone('');
      setWhatsappModalOpen(true);
    }
  };

  const handleConfirmWhatsAppModal = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = whatsappPhone.replace(/[^0-9]/g, '').slice(-10);
    if (clean.length < 10) {
      alert('Please enter a valid 10-digit mobile number.');
      return;
    }
    setWhatsappModalOpen(false);
    triggerWhatsAppDispatch(clean);
  };

  // Loading Screen
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6 font-sans">
        <div className="bg-white p-8 rounded-xl border-2 border-slate-300 shadow-md text-center max-w-sm w-full space-y-4">
          <div className="w-12 h-12 border-3 border-slate-200 border-t-slate-800 rounded-full animate-spin mx-auto" />
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Generating Official Invoice</h3>
            <p className="text-xs text-slate-500 mt-1">Invoice Order #{cleanOrderId}</p>
          </div>
        </div>
      </div>
    );
  }

  // Error / Not Found Screen
  if (error && !order) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-white rounded-xl border-2 border-slate-300 p-8 text-center shadow-lg">
          <div className="w-14 h-14 bg-red-50 text-red-700 rounded-xl flex items-center justify-center mx-auto mb-4 border border-red-200">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">Invoice Record Not Found</h2>
          <p className="text-xs text-slate-600 mb-6 leading-relaxed">
            Unable to retrieve billing record for Order #{cleanOrderId}. You can preview our sample tax invoice below.
          </p>
          <div className="flex flex-col gap-2.5">
            <button
              onClick={() => {
                setOrder(DEMO_ORDER);
                setError(null);
                showToast('Displaying sample GST tax invoice');
              }}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg transition text-xs cursor-pointer flex items-center justify-center gap-2"
            >
              <Eye className="w-4 h-4 text-emerald-400" /> View Sample Professional Bill
            </button>
            <button
              onClick={() => loadOrder(true)}
              className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition text-xs cursor-pointer flex items-center justify-center gap-2 border border-slate-300"
            >
              <RefreshCw className="w-4 h-4" /> Retry Query
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/90 text-slate-900 pb-24 sm:pb-16 font-sans antialiased">
      
      {/* 0. Print Stylesheet for High-Definition Physical & PDF Printing */}
      <style>{`
        @media print {
          body {
            background: #FFFFFF !important;
            color: #000000 !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .no-print, header, footer, .floating-dock, .menu-cta, .tab-switcher, .toast-container, .action-toolbar {
            display: none !important;
          }
          .printable-invoice-sheet {
            display: block !important;
            box-shadow: none !important;
            border: 2px solid #000000 !important;
            border-radius: 0 !important;
            padding: 24px !important;
            max-width: 100% !important;
            width: 100% !important;
            margin: 0 auto !important;
          }
          @page {
            size: auto;
            margin: 8mm;
          }
        }
      `}</style>

      {/* Floating Toast Notification */}
      {toastMsg && (
        <div className="toast-container fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-5 py-2.5 rounded-lg text-xs font-semibold shadow-2xl flex items-center gap-2 border border-slate-700 no-print animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* 1. Professional App Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-300 px-4 sm:px-6 py-3 no-print shadow-xs">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          
          <div className="flex items-center gap-3 min-w-0">
            {onExploreMenu && (
              <button
                onClick={() => onExploreMenu(Number(activeOrderData.restaurantId), Number(activeOrderData.tableId || 0))}
                className="p-1.5 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition cursor-pointer shrink-0"
                title="Back to Menu"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}

            <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold shrink-0">
              <Building2 className="w-5 h-5" />
            </div>

            <div className="min-w-0">
              <h1 className="font-bold text-sm sm:text-base text-slate-900 truncate">
                {activeOrderData.restaurantName || 'Menza Restaurant'}
              </h1>
              <p className="text-xs text-slate-500 font-medium truncate flex items-center gap-2 mt-0.5">
                <span>Tax Invoice #INV-{cleanOrderId || '1048'}</span>
                <span>•</span>
                <span className="font-semibold text-slate-700">{activeOrderData.tableName || (isDineIn ? 'Dine-In' : 'Takeaway')}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div
              className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold border ${
                signalRConnected
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-slate-50 text-slate-700 border-slate-300'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${signalRConnected ? 'bg-emerald-600' : 'bg-slate-400'}`} />
              <span>{signalRConnected ? 'Live Connection' : 'Offline'}</span>
            </div>

            <button
              onClick={() => loadOrder(true)}
              disabled={refreshing}
              className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 transition cursor-pointer"
              title="Refresh Invoice"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-slate-900' : ''}`} />
            </button>

            <button
              onClick={handleNativeShare}
              className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 transition cursor-pointer"
              title="Share Invoice Link"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* 2. Structured Tab Switcher (Uses IndianRupee & ReceiptText - ZERO Dollar Icon) */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-5 no-print tab-switcher">
        <div className="flex border-b-2 border-slate-300 bg-white rounded-t-xl overflow-hidden shadow-xs">
          <button
            onClick={() => setActiveTab('receipt')}
            className={`flex-1 py-3 px-4 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer border-r border-slate-200 ${
              activeTab === 'receipt'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <IndianRupee className="w-4 h-4 text-emerald-400" />
            <span>{hasGstBifurcation ? 'Tax Invoice & Bill' : 'Retail Bill & Receipt'}</span>
            <span className={`text-[11px] px-2 py-0.5 rounded font-bold tabular-nums ${
              activeTab === 'receipt' ? 'bg-slate-700 text-amber-300' : 'bg-slate-100 text-slate-700'
            }`}>
              ₹{grandTotal.toFixed(2)}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('tracker')}
            className={`flex-1 py-3 px-4 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'tracker'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Flame className="w-4 h-4" />
            <span>Kitchen & Order Status</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold uppercase tracking-wider ${
              activeTab === 'tracker' ? 'bg-slate-700 text-amber-300' : 'bg-slate-100 text-slate-700'
            }`}>
              {TIMELINE_STEPS[Math.max(0, currentStage)]?.title || 'Active'}
            </span>
          </button>
        </div>
      </div>

      {/* 3. Main Content Container */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-5 space-y-5">

        {/* ========================================================================= */}
        {/* VIEW 1: FORMAL PROFESSIONAL TAX INVOICE (Proper Borderline Accounting UI) */}
        {/* ========================================================================= */}
        {activeTab === 'receipt' && (
          <div className="space-y-4 animate-fadeIn">

            {/* Quick Action Toolbar directly above bill */}
            <div className="bg-white p-3 rounded-xl border border-slate-300 shadow-xs flex flex-wrap items-center justify-between gap-3 no-print action-toolbar">
              <div className="flex items-center gap-2 text-xs text-slate-700 font-semibold">
                <ReceiptText className="w-4 h-4 text-slate-700" />
                <span>
                  {hasGstBifurcation
                    ? 'GST Tax Invoice (Section 31 CGST Act • Rule 46)'
                    : 'Retail Bill / Receipt (Net total is inclusive of all taxes)'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleOpenWhatsAppShare}
                  className="py-2 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <MessageCircle className="w-3.5 h-3.5 fill-current" />
                  <span>Send via WhatsApp</span>
                </button>
                <button
                  onClick={handlePrint}
                  className="py-2 px-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <Download className="w-3.5 h-3.5 text-amber-400" />
                  <span>Download / Print PDF</span>
                </button>
              </div>
            </div>

            {/* ===================================================================== */}
            {/* THE FORMAL BILL FOLIO SHEET (Structured Corporate Restaurant Invoice) */}
            {/* ===================================================================== */}
            <div className="printable-invoice-sheet bg-white border-2 border-slate-400 rounded-xl shadow-lg p-6 sm:p-9 space-y-5">
              
              {/* Statutory Header Title Strip */}
              <div className="bg-slate-900 text-white px-4 py-2 rounded-t-md flex items-center justify-between text-[11px] font-bold uppercase tracking-wider -mx-6 sm:-mx-9 -mt-6 sm:-mt-9 mb-4">
                <span>{hasGstBifurcation ? 'Tax Invoice / Retail Bill' : 'Retail Bill / Cash Receipt'}</span>
                <span>Original for Recipient</span>
              </div>

              {/* Establishment Details Block */}
              <div className="text-center space-y-1 border-b-2 border-slate-800 pb-4">
                <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-slate-900">
                  {activeOrderData.restaurantName || 'Menza Restaurant'}
                </h2>
                
                {(activeOrderData.address || activeOrderData.city) && (
                  <p className="text-xs text-slate-600 max-w-xl mx-auto leading-relaxed">
                    {[activeOrderData.address, activeOrderData.city, activeOrderData.state].filter(Boolean).join(', ')}
                  </p>
                )}

                <div className="flex items-center justify-center gap-4 text-xs text-slate-700 pt-1 flex-wrap font-medium">
                  {hasGstBifurcation && cleanGst ? (
                    <span>GSTIN: <strong className="text-slate-900 font-bold">{cleanGst}</strong></span>
                  ) : null}
                  {(activeOrderData.fssaiNumber || activeOrderData.fssaiLicenseNumber || activeOrderData.fssaiLicNo || activeOrderData.fssai) ? (
                    <span>FSSAI Lic No: <strong className="text-slate-900 font-bold">{activeOrderData.fssaiNumber || activeOrderData.fssaiLicenseNumber || activeOrderData.fssaiLicNo || activeOrderData.fssai}</strong></span>
                  ) : null}
                  {activeOrderData.stateCode ? (
                    <span>State Code: <strong className="text-slate-900">{activeOrderData.stateCode}</strong></span>
                  ) : null}
                  {activeOrderData.contactPhone ? (
                    <span>Phone: <strong className="text-slate-900">{activeOrderData.contactPhone}</strong></span>
                  ) : null}
                </div>
              </div>

              {/* Meta Grid: 2x2 Structured Box */}
              <div className="border border-slate-300 rounded-lg overflow-hidden text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-300">
                  
                  {/* Left Column: Invoice Particulars */}
                  <div className="p-3.5 space-y-1.5 bg-white">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-1 mb-1">
                      Invoice Particulars
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Invoice Number:</span>
                      <strong className="text-slate-900 font-bold">INV-{cleanOrderId || '1048'}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Date & Time of Supply:</span>
                      <span className="text-slate-800 font-semibold">{orderTimeFormatted}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">POS Order Ticket:</span>
                      <strong className="text-slate-900">ORD-{cleanOrderId || '1048'}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Place of Supply:</span>
                      <span className="text-slate-800">Bengaluru, Karnataka (29)</span>
                    </div>
                  </div>

                  {/* Right Column: Customer & Dining Particulars */}
                  <div className="p-3.5 space-y-1.5 bg-white">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-1 mb-1">
                      Billed To / Guest Details
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Customer Name:</span>
                      <strong className="text-slate-900">{activeOrderData.customerName || 'Walk-in Guest'}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Customer Mobile:</span>
                      <span className="text-slate-800">
                        {activeOrderData.customerPhone || activeOrderData.mobileNumber || '+91 98765 43210'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Table / Service Mode:</span>
                      <strong className="text-slate-900">{activeOrderData.tableName || (isDineIn ? 'Dine-In Table' : 'Takeaway')}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Payment Settlement:</span>
                      <span className={`font-bold px-1.5 py-0.2 rounded text-[11px] ${
                        isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {isPaid ? 'PAID IN FULL (✓)' : 'PAYMENT PENDING'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Payment Mode:</span>
                      <strong className="text-slate-900 uppercase">
                        {paymentMode || (isPaid ? 'CASH' : 'PENDING')}
                      </strong>
                    </div>
                  </div>

                </div>
              </div>

              {/* Structured Itemized Table with Proper Borders and SAC code */}
              <div className="overflow-x-auto border-2 border-slate-300 rounded-lg">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b-2 border-slate-400 text-slate-800 font-bold uppercase tracking-wider">
                      <th className="py-2.5 px-3 text-center w-10 border-r border-slate-300">#</th>
                      <th className="py-2.5 px-3 border-r border-slate-300">Description of Food / Services</th>
                      {hasGstBifurcation && (
                        <th className="py-2.5 px-2.5 text-center w-20 border-r border-slate-300">HSN/SAC</th>
                      )}
                      <th className="py-2.5 px-3 text-center w-14 border-r border-slate-300">Qty</th>
                      <th className="py-2.5 px-3 text-right w-24 border-r border-slate-300">Rate (₹)</th>
                      <th className="py-2.5 px-3 text-right w-28">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {itemsList.map((item: OrderItem, idx: number) => {
                      const qty = Number(item.quantity || 1);
                      const rate = Number(item.amount ?? item.unitPrice ?? item.price ?? 0);
                      const rowTotal = Number(item.totalAmount ?? rate * qty);

                      return (
                        <tr key={idx} className="hover:bg-slate-50/70">
                          <td className="py-2.5 px-3 text-center text-slate-500 border-r border-slate-200">{idx + 1}</td>
                          <td className="py-2.5 px-3 border-r border-slate-200">
                            <div className="flex items-start gap-2">
                              <span className="mt-0.5"><VegBadge isVeg={item.isVeg} name={item.itemName || item.name} /></span>
                              <div>
                                <span className="font-bold text-slate-900 block">{item.itemName || item.name}</span>
                                {item.cookingInstruction && (
                                  <span className="text-[11px] text-slate-500 italic block mt-0.5">
                                    Note: {item.cookingInstruction}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          {hasGstBifurcation && (
                            <td className="py-2.5 px-2.5 text-center text-slate-600 border-r border-slate-200 font-semibold">996331</td>
                          )}
                          <td className="py-2.5 px-3 text-center font-bold text-slate-900 border-r border-slate-200 tabular-nums">{qty}</td>
                          <td className="py-2.5 px-3 text-right text-slate-800 border-r border-slate-200 font-semibold tabular-nums">₹{rate.toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900 tabular-nums">₹{rowTotal.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Financial Calculation Summary (Bordered Box) */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-start pt-1">
                
                {/* Left Side: Disclaimers & Words */}
                <div className="sm:col-span-6 space-y-3 text-xs text-slate-600 border border-slate-200 p-3.5 rounded-lg bg-slate-50/60">
                  <div>
                    <span className="font-bold text-slate-700 block uppercase text-[10px] tracking-wider">Amount Chargeable (in words):</span>
                    <strong className="text-slate-900 italic font-serif text-xs sm:text-sm">
                      {numberToWordsINR(grandTotal)}
                    </strong>
                  </div>

                  {/* GST Tax Breakup Mini Box OR Inclusive of all taxes Notice */}
                  {hasGstBifurcation ? (
                    <div className="pt-2 border-t border-slate-200 text-[11px] space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        GST Breakup Summary (SAC 996331 - 5% GST):
                      </div>
                      <div className="grid grid-cols-3 gap-1 bg-white p-2 rounded border border-slate-200 text-center font-medium">
                        <div>
                          <span className="text-[10px] text-slate-400 block">Taxable Val</span>
                          <strong>₹{(subTotal - discount).toFixed(2)}</strong>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">CGST (2.5%)</span>
                          <strong>₹{cgst.toFixed(2)}</strong>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">SGST (2.5%)</span>
                          <strong>₹{sgst.toFixed(2)}</strong>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-2 border-t border-slate-200">
                      <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-2.5 rounded-lg text-xs font-semibold flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Net total is inclusive of all taxes.</span>
                      </div>
                    </div>
                  )}
                  
                  <div className="pt-2 border-t border-slate-200 text-[11px] space-y-0.5 text-slate-500">
                    <p>• Goods & food items once sold/served cannot be exchanged or returned.</p>
                    <p>• Subject to local municipal and Bengaluru jurisdiction.</p>
                    <p className="font-medium text-slate-600">
                      {hasGstBifurcation
                        ? 'This is a certified computer-generated tax invoice under CGST Act, 2017.'
                        : 'This is a certified computer-generated bill.'}
                    </p>
                  </div>
                </div>

                {/* Right Side: Calculation Column */}
                <div className="sm:col-span-6 space-y-1.5 text-xs text-slate-700 border-2 border-slate-300 p-3.5 rounded-lg bg-white">
                  <div className="flex justify-between py-0.5">
                    <span className="font-medium">Total Item Subtotal:</span>
                    <strong className="text-slate-900 tabular-nums font-bold">₹{subTotal.toFixed(2)}</strong>
                  </div>

                  {discount > 0 && (
                    <div className="flex justify-between py-0.5 text-emerald-700 font-bold">
                      <span>Special Restaurant Promo Discount:</span>
                      <span className="tabular-nums font-bold">-₹{discount.toFixed(2)}</span>
                    </div>
                  )}

                  {hasGstBifurcation ? (
                    <>
                      <div className="flex justify-between py-0.5 border-t border-slate-100">
                        <span className="font-medium">Net Taxable Value:</span>
                        <strong className="text-slate-900 tabular-nums font-semibold">₹{(subTotal - discount).toFixed(2)}</strong>
                      </div>

                      <div className="flex justify-between py-0.5">
                        <span className="font-medium">CGST @ {activeOrderData.cgstPercentage ? `${activeOrderData.cgstPercentage}%` : '2.5%'}:</span>
                        <strong className="text-slate-900 tabular-nums font-bold">₹{cgst.toFixed(2)}</strong>
                      </div>

                      <div className="flex justify-between py-0.5">
                        <span className="font-medium">SGST @ {activeOrderData.sgstPercentage ? `${activeOrderData.sgstPercentage}%` : '2.5%'}:</span>
                        <strong className="text-slate-900 tabular-nums font-bold">₹{sgst.toFixed(2)}</strong>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between py-1.5 border-t border-slate-100 text-emerald-700 text-xs font-semibold">
                      <span>Taxes & Duties:</span>
                      <span>Net total is inclusive of all taxes</span>
                    </div>
                  )}

                  <div className="flex justify-between py-0.5 border-t border-slate-200 text-slate-500">
                    <span>Round Off (+/-):</span>
                    <span className="tabular-nums font-medium">₹0.00</span>
                  </div>

                  {/* Grand Total Double Border Line */}
                  <div className="border-t-2 border-b-4 border-double border-slate-900 py-2.5 mt-2 flex justify-between items-baseline">
                    <span className="font-black text-sm uppercase tracking-tight text-slate-900">
                      {hasGstBifurcation ? 'Net Invoice Amount:' : 'Net Payable Amount:'}
                    </span>
                    <span className="font-black text-xl sm:text-2xl text-slate-900 tabular-nums tracking-tight">
                      ₹{grandTotal.toFixed(2)}
                    </span>
                  </div>
                </div>

              </div>

              {/* Settlement & Verification Bar */}
              <div className="border-t-2 border-slate-800 pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
                
                {/* QR Code with Tax Verification */}
                <div className="flex items-center gap-3">
                  <div className="p-1.5 border border-slate-300 rounded bg-white shrink-0">
                    <QRCodeSVG value={billUrl} size={50} level="M" />
                  </div>
                  <div className="text-[11px] text-slate-600 leading-tight">
                    <strong className="text-slate-900 block font-bold">
                      {hasGstBifurcation ? 'GST Digital Verification' : 'Digital Order Verification'}
                    </strong>
                    <span>
                      {hasGstBifurcation
                        ? 'Scan with mobile camera to verify this tax invoice online.'
                        : 'Scan with mobile camera to verify this bill online.'}
                    </span>
                  </div>
                </div>

                {/* Settlement Badge */}
                <div className="border-2 border-slate-800 bg-slate-50 px-4 py-2 rounded-lg text-center sm:text-right space-y-0.5">
                  <div className="flex items-center justify-center sm:justify-end gap-1.5 text-emerald-700 font-black">
                    <CheckCheck className="w-4 h-4" />
                    <span>SETTLED IN FULL</span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Payment Mode: <strong className="text-slate-900 uppercase">{paymentMode || (isPaid ? 'CASH' : 'PENDING')}</strong>
                  </p>
                </div>

              </div>

              <div className="text-center text-[11px] text-slate-500 pt-2 border-t border-slate-200">
                <p>Thank you for dining with us! Please visit again. 🙏</p>
              </div>

            </div>

            {/* Re-order Menu Banner */}
            {onExploreMenu && (
              <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-300 shadow-xs flex items-center justify-between gap-4 no-print menu-cta">
                <div className="space-y-0.5">
                  <h4 className="font-bold text-sm text-slate-900">
                    Need extra desserts, beverages, or breads?
                  </h4>
                  <p className="text-xs text-slate-500">
                    Add items directly to your bill for {activeOrderData.tableName || 'Table 04'}
                  </p>
                </div>
                <button
                  onClick={() => onExploreMenu(Number(activeOrderData.restaurantId), Number(activeOrderData.tableId || 0))}
                  className="py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer shrink-0"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Browse Menu</span>
                </button>
              </div>
            )}

          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 2: STRUCTURED KITCHEN STATUS (Clean KDS Progress)                   */}
        {/* ========================================================================= */}
        {activeTab === 'tracker' && (
          <div className="space-y-5 animate-fadeIn">
            
            <div className="bg-white border-2 border-slate-300 rounded-xl p-6 sm:p-8 space-y-6 shadow-sm">
              
              {/* Headline */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      Live Kitchen Display Status
                    </span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-slate-900">
                    {currentStage === 4
                      ? 'Order Completed & Served'
                      : currentStage === 3
                      ? 'Dishes Ready to Serve'
                      : currentStage === 2
                      ? 'Chef is Preparing in Kitchen'
                      : currentStage === 1
                      ? 'Order Confirmed by Kitchen'
                      : 'Order Placed with Cashier'}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {currentStage === 4
                      ? 'Hope you enjoyed your meal! Visit us again soon.'
                      : currentStage === 3
                      ? `Staff is bringing your dishes to ${activeOrderData.tableName || 'your table'}.`
                      : currentStage === 2
                      ? `Fresh ingredients are cooking in the pans for ${activeOrderData.tableName || 'your table'}.`
                      : 'Your ticket is queued in the kitchen system.'}
                  </p>
                </div>

                <div className="border border-slate-300 rounded-lg p-3 bg-slate-50 text-right shrink-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Table Assigned</span>
                  <strong className="text-base font-black text-slate-900 block font-mono">
                    {activeOrderData.tableName || activeOrderData.pickupToken || `#${cleanOrderId || '1048'}`}
                  </strong>
                </div>
              </div>

              {/* 5-Step Stepper with Clean Borderlines */}
              <div className="py-2">
                <div className="relative">
                  <div className="absolute top-4 left-4 right-4 h-1 bg-slate-200 -z-0" />
                  <div
                    className="absolute top-4 left-4 h-1 bg-slate-900 transition-all duration-500 -z-0"
                    style={{
                      width: `${Math.min(100, Math.max(0, (currentStage / (TIMELINE_STEPS.length - 1)) * 100))}%`,
                    }}
                  />

                  <div className="grid grid-cols-5 gap-1 relative z-10">
                    {TIMELINE_STEPS.map((step) => {
                      const isDone = currentStage > step.id;
                      const isCurrent = currentStage === step.id;
                      const Icon = step.icon;

                      const circleClass = isDone
                        ? 'bg-slate-900 text-white border-2 border-slate-900'
                        : isCurrent
                        ? 'bg-slate-900 text-amber-400 ring-4 ring-slate-200 border-2 border-slate-900 scale-105'
                        : 'bg-white text-slate-400 border-2 border-slate-300';

                      return (
                        <div key={step.id} className="flex flex-col items-center text-center">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold transition-all ${circleClass}`}>
                            {isDone ? <Check className="w-4 h-4 stroke-[3]" /> : <Icon className="w-3.5 h-3.5" />}
                          </div>
                          <span className={`text-[11px] sm:text-xs mt-2 font-bold ${
                            isCurrent ? 'text-slate-900 font-extrabold' : isDone ? 'text-slate-800' : 'text-slate-400'
                          }`}>
                            {step.title}
                          </span>
                          <span className="hidden sm:inline text-[10px] text-slate-400 mt-0.5">
                            {step.subtitle}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Dishes Preparation Grid */}
              <div className="pt-2 border-t border-slate-200">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  Items Ordered ({itemsList.length})
                </h4>
                <div className="border border-slate-300 rounded-lg divide-y divide-slate-200 text-xs">
                  {itemsList.map((it, idx) => (
                    <div key={idx} className="p-3 flex items-center justify-between bg-white">
                      <div className="flex items-center gap-2 min-w-0">
                        <VegBadge isVeg={it.isVeg} name={it.itemName || it.name} />
                        <span className="font-bold text-slate-900 truncate">{it.itemName || it.name}</span>
                      </div>
                      <span className="font-bold bg-slate-100 border border-slate-300 px-2 py-0.5 rounded text-slate-800">
                        Qty: {it.quantity || 1}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Back to Receipt Callout */}
              <div className="flex items-center justify-between border border-slate-300 bg-slate-50 p-4 rounded-lg text-xs">
                <div>
                  <span className="text-slate-600">Total bill for this ticket is </span>
                  <strong className="text-slate-900 font-bold tabular-nums">₹{grandTotal.toFixed(2)}</strong>
                </div>
                <button
                  onClick={() => setActiveTab('receipt')}
                  className="py-2 px-3.5 bg-slate-900 text-white font-bold rounded-md hover:bg-slate-800 transition cursor-pointer flex items-center gap-1.5"
                >
                  <ReceiptText className="w-3.5 h-3.5" />
                  <span>View Tax Invoice</span>
                </button>
              </div>

            </div>

          </div>
        )}

      </main>

      {/* ========================================================================= */}
      {/* 4. MOBILE BOTTOM FIXED DOCK                                               */}
      {/* ========================================================================= */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-300 p-3 shadow-lg no-print sm:hidden floating-dock">
        <div className="flex items-center gap-2 max-w-md mx-auto">
          <button
            onClick={handleOpenWhatsAppShare}
            className="flex-1 py-3 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer"
          >
            <MessageCircle className="w-4 h-4 fill-current" />
            <span>WhatsApp Bill</span>
          </button>
          
          <button
            onClick={handlePrint}
            className="flex-1 py-3 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer"
          >
            <Download className="w-4 h-4 text-amber-400" />
            <span>Download PDF</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. INTERACTIVE WHATSAPP DISPATCH MODAL                                     */}
      {/* ========================================================================= */}
      {whatsappModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 no-print animate-fadeIn">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 space-y-4 shadow-2xl border border-slate-300 relative">
            <button
              onClick={() => setWhatsappModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-emerald-600 fill-current" />
                <span>Send Bill to WhatsApp</span>
              </h3>
              <p className="text-xs text-slate-600">
                Enter the customer's 10-digit mobile number to deliver this official tax invoice & PDF link.
              </p>
            </div>

            <form onSubmit={handleConfirmWhatsAppModal} className="space-y-3.5 pt-1">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Recipient Mobile Number
                </label>
                <div className="flex items-center border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus-within:border-slate-800 focus-within:bg-white transition">
                  <span className="text-xs font-bold text-slate-600 mr-2 shrink-0">🇮🇳 +91</span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="98765 43210"
                    value={whatsappPhone}
                    onChange={(e) => setWhatsappPhone(e.target.value)}
                    autoFocus
                    className="w-full bg-transparent text-xs font-bold text-slate-900 outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setWhatsappModalOpen(false)}
                  className="flex-1 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Bill</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
