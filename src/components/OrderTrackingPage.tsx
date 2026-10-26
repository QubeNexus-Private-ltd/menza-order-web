import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  ChefHat,
  CheckCircle2,
  Clock,
  UtensilsCrossed,
  MapPin,
  Phone,
  RefreshCw,
  Share2,
  ArrowLeft,
  AlertCircle,
  Receipt,
  Sparkles,
  CreditCard,
  Hash,
  Store,
  Check,
  ChevronRight,
  ShoppingBag,
  ExternalLink,
} from 'lucide-react';
import * as api from '../services/api';
import * as signalrService from '../services/signalr';
import { Order, OrderItem } from '../types';

export interface OrderTrackingPageProps {
  orderId: string | number;
  onExploreMenu?: (restaurantId: number, tableId?: number | null) => void;
  onScanQr?: () => void;
  initialOrder?: Order | null;
}

// Normalizes status strings for visual stepper
function getStepperStage(orderStatus?: string | null, kitchenStatus?: string | null): number {
  const os = String(orderStatus || '').toUpperCase().trim();
  const ks = String(kitchenStatus || '').toUpperCase().trim();

  if (os === 'CANCELLED' || os === 'CANCELED' || os === 'REJECTED') {
    return -1; // Cancelled state
  }

  if (os === 'SETTLED' || os === 'COMPLETED' || os === 'SERVED' || ks === 'SERVED' || ks === 'COMPLETED') {
    return 4; // Served / Settled
  }

  if (os === 'READY' || ks === 'READY') {
    return 3; // Ready
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
    return 2; // In Kitchen
  }

  if (os === 'CONFIRMED' || ks === 'CONFIRMED') {
    return 1; // Confirmed
  }

  return 0; // Placed
}

const STEPS = [
  { id: 0, label: 'Order Placed', desc: 'Received by kitchen' },
  { id: 1, label: 'Confirmed', desc: 'Accepted by chef' },
  { id: 2, label: 'In Kitchen', desc: 'Preparing fresh' },
  { id: 3, label: 'Ready', desc: 'Ready for table/pickup' },
  { id: 4, label: 'Served', desc: 'Enjoy your meal!' },
];

export default function OrderTrackingPage({
  orderId,
  onExploreMenu,
  onScanQr,
  initialOrder = null,
}: OrderTrackingPageProps) {
  const cleanOrderId = String(orderId || '').trim();

  const [order, setOrder] = useState<Order | null>(initialOrder);
  const [loading, setLoading] = useState<boolean>(!initialOrder);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [signalRConnected, setSignalRConnected] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Fetch Order Tracking Data from public API
  const loadOrder = useCallback(
    async (isManualRefresh = false) => {
      if (!cleanOrderId) return;
      if (isManualRefresh) setRefreshing(true);
      try {
        const data = await api.getOrder(cleanOrderId);
        if (data && (data.orderId || data.id)) {
          setOrder(data);
          setError(null);
        } else if (!order) {
          setError('Order details could not be found. Please verify the order number.');
        }
      } catch (err: any) {
        if (!order) {
          setError(
            err?.response?.data?.message ||
              'Order not found or unable to fetch live tracking details. Please verify your order number.'
          );
        }
      } finally {
        setLoading(false);
        if (isManualRefresh) setRefreshing(false);
      }
    },
    [cleanOrderId, order]
  );

  // Initial Load
  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  // Establish SignalR Hub Connection and join order room
  useEffect(() => {
    if (!cleanOrderId) return;

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
  }, [cleanOrderId, order?.restaurantId, loadOrder]);

  const handleShare = async () => {
    if (typeof window === 'undefined') return;
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Order #${cleanOrderId} - ${order?.restaurantName || 'Menza'}`,
          text: `Track live kitchen and order status for Order #${cleanOrderId}`,
          url,
        });
        return;
      } catch {}
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {}
  };

  const currentStage = getStepperStage(order?.orderStatus, order?.kitchenStatus);
  const isCancelled = currentStage === -1;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FBF9F9] text-[#1B1C1C] flex flex-col items-center justify-center p-4 font-['Hanken_Grotesk',sans-serif]">
        <div className="w-14 h-14 border-4 border-[#D33401] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-gray-700">
          Connecting to live order tracker...
        </p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-[#FBF9F9] text-[#1B1C1C] flex items-center justify-center p-4 font-['Hanken_Grotesk',sans-serif]">
        <div className="max-w-md w-full bg-white rounded-3xl border border-[#E0DDD8] p-8 text-center shadow-lg">
          <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Order Not Found</h2>
          <p className="text-sm text-gray-600 mb-6">
            {error || `Unable to find tracking details for Order #${cleanOrderId}.`}
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => loadOrder(true)}
              className="w-full py-3 bg-[#D33401] hover:bg-[#B82E01] text-white font-bold rounded-2xl transition flex items-center justify-center gap-2 shadow-md shadow-[#D33401]/20"
            >
              <RefreshCw className="w-4 h-4" /> Try Again
            </button>
            {onScanQr && (
              <button
                onClick={onScanQr}
                className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold rounded-2xl transition"
              >
                Scan Table QR
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const itemsList: OrderItem[] = (Array.isArray(order.items) && order.items.length > 0)
    ? order.items
    : (Array.isArray(order.orderItems) ? order.orderItems : []);

  const isDineIn = Boolean(order.tableName || order.tableId || (order.deliveryType && order.deliveryType.toLowerCase().includes('dine')));

  return (
    <div className="min-h-screen bg-[#FBF9F9] text-[#1B1C1C] pb-24 font-['Hanken_Grotesk',sans-serif]">
      {/* 1. Top App Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-[#E0DDD8] px-4 py-3 shadow-xs">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#D33401] to-[#FF6B35] flex items-center justify-center text-white shadow-md shadow-[#D33401]/20">
              <ChefHat className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base md:text-lg text-gray-900">
                  Order #{order.orderId || cleanOrderId}
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-[#FFF1EC] text-[#D33401]">
                  {order.deliveryType || (isDineIn ? 'Dine-In' : 'Takeaway')}
                </span>
              </div>
              <p className="text-xs text-gray-500 flex items-center gap-1 font-medium">
                <Store className="w-3 h-3 text-[#D33401]" />
                {order.restaurantName || 'Menza Outlet'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Live SignalR Pulse Indicator */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border transition ${
                signalRConnected
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  signalRConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}
              />
              <span className="hidden sm:inline">{signalRConnected ? 'Live' : 'Connecting'}</span>
            </div>

            {/* Refresh Button */}
            <button
              onClick={() => loadOrder(true)}
              disabled={refreshing}
              className="p-2 rounded-xl border border-[#E0DDD8] hover:bg-gray-50 text-gray-700 transition"
              title="Refresh Status"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#D33401]' : ''}`} />
            </button>

            {/* Share Button */}
            <button
              onClick={handleShare}
              className="p-2 rounded-xl border border-[#E0DDD8] hover:bg-gray-50 text-gray-700 transition"
              title="Share Tracking Link"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4 text-gray-700" />}
            </button>
          </div>
        </div>
      </header>

      {/* 2. Main Content Container */}
      <main className="max-w-3xl mx-auto px-4 pt-6 space-y-6">
        {/* Cancelled Banner */}
        {isCancelled && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3 text-red-800">
            <AlertCircle className="w-6 h-6 flex-shrink-0 text-red-600" />
            <div>
              <h3 className="font-bold text-sm">Order Cancelled</h3>
              <p className="text-xs text-red-700">
                This order was cancelled. Please speak with the restaurant cashier or staff for assistance.
              </p>
            </div>
          </div>
        )}

        {/* Live Status Highlight Card */}
        <div className={`border rounded-3xl p-6 shadow-sm relative overflow-hidden ${
          currentStage >= 1
            ? 'bg-gradient-to-br from-emerald-50/70 via-white to-emerald-50/30 border-emerald-300'
            : 'bg-gradient-to-br from-[#FFF5F0] via-white to-[#FFF9F6] border-[#D33401]/25'
        }`}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className={`text-xs uppercase font-extrabold tracking-wider flex items-center gap-1.5 ${
                currentStage >= 1 ? 'text-emerald-700' : 'text-[#D33401]'
              }`}>
                <Sparkles className="w-3.5 h-3.5" />
                Live Kitchen & Order Status
              </span>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-black text-gray-900 capitalize">
                  {String(order.orderStatus || 'Order Placed').replace(/_/g, ' ')}
                </h1>
                {currentStage >= 1 && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    {currentStage === 4 ? 'Done' : 'In Progress'}
                  </span>
                )}
              </div>
              {order.kitchenStatus && (
                <p className="text-sm font-medium text-gray-600">
                  Kitchen stage: <span className={currentStage >= 1 ? 'text-emerald-700 font-bold' : 'text-[#D33401] font-bold'}>{order.kitchenStatus}</span>
                </p>
              )}
            </div>

            {/* Table or Token Badge */}
            <div className="flex items-center gap-2.5 self-stretch sm:self-auto bg-white rounded-2xl p-3 border border-[#E0DDD8] shadow-xs">
              {order.tableName ? (
                <>
                  <div className="w-9 h-9 rounded-xl bg-[#FFF1EC] text-[#D33401] flex items-center justify-center">
                    <UtensilsCrossed className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-500">Table</span>
                    <p className="text-base font-extrabold text-gray-900 leading-none">
                      {order.tableName}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-9 h-9 rounded-xl bg-[#FFF1EC] text-[#D33401] flex items-center justify-center">
                    <Hash className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-500">Token</span>
                    <p className="text-base font-extrabold text-gray-900 leading-none">
                      {order.pickupToken || order.tokenNumber || `#${cleanOrderId}`}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Stepper Timeline */}
          {!isCancelled && (
            <div className={`mt-8 pt-6 border-t ${currentStage >= 1 ? 'border-emerald-200' : 'border-[#D33401]/15'}`}>
              <div className="grid grid-cols-5 gap-1 relative">
                {/* Connecting track line */}
                <div className="absolute top-4 left-6 right-6 h-1 bg-gray-200 -z-0" />
                <div
                  className={`absolute top-4 left-6 h-1 transition-all duration-700 -z-0 ${
                    currentStage >= 1 ? 'bg-emerald-600' : 'bg-[#D33401]'
                  }`}
                  style={{
                    width: `${Math.min(100, Math.max(0, (currentStage / (STEPS.length - 1)) * 100))}%`,
                  }}
                />

                {STEPS.map((step) => {
                  const isDone = currentStage > step.id;
                  const isCurrent = currentStage === step.id;

                  const stepColor = currentStage >= 1
                    ? (isDone
                        ? 'bg-emerald-600 text-white shadow-md'
                        : isCurrent
                        ? 'bg-emerald-600 text-white ring-4 ring-emerald-500/25 scale-110 shadow-lg'
                        : 'bg-white text-gray-400 border-2 border-gray-300')
                    : (isDone
                        ? 'bg-[#D33401] text-white shadow-md'
                        : isCurrent
                        ? 'bg-[#D33401] text-white ring-4 ring-[#D33401]/25 scale-110 shadow-lg'
                        : 'bg-white text-gray-400 border-2 border-gray-300');

                  const labelColor = isCurrent
                    ? (currentStage >= 1 ? 'text-emerald-700' : 'text-[#D33401]')
                    : (isDone ? 'text-gray-900' : 'text-gray-400');

                  return (
                    <div key={step.id} className="flex flex-col items-center text-center relative z-10">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-transform duration-300 ${stepColor}`}>
                        {isDone ? <Check className="w-4 h-4" /> : step.id + 1}
                      </div>
                      <span
                        className={`text-xs mt-2 font-bold leading-tight ${labelColor}`}
                      >
                        {step.label}
                      </span>
                      <span className="hidden sm:inline text-[10px] text-gray-500 mt-0.5">
                        {step.desc}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 3. Order Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Items Breakdown (2 cols) */}
          <div className="md:col-span-2 bg-white rounded-3xl border border-[#E0DDD8] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E0DDD8]">
              <h2 className="font-bold text-base text-gray-900 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[#D33401]" />
                Order Items ({itemsList.length})
              </h2>
              {order.createdDateUtc && (
                <span className="text-xs text-gray-500 font-medium">
                  {new Date(order.createdDateUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>

            <div className="divide-y divide-gray-100">
              {itemsList.map((item: OrderItem, idx: number) => {
                const itemQty = Number(item.quantity || 1);
                const itemPrice = Number(item.amount ?? item.unitPrice ?? item.price ?? 0);
                const itemTotal = Number(item.totalAmount ?? itemPrice * itemQty);

                return (
                  <div key={idx} className="py-3 flex items-start justify-between gap-3">
                    <div className="space-y-0.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-gray-900 break-words">
                          {item.itemName || item.name || 'Dish Item'}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-md font-bold bg-gray-100 text-gray-700 shrink-0">
                          x{itemQty}
                        </span>
                      </div>
                      {item.cookingInstruction && (
                        <p className="text-xs text-[#D33401] italic">
                          Note: {item.cookingInstruction}
                        </p>
                      )}
                      <span className="text-xs text-gray-500">
                        ₹{itemPrice.toFixed(2)} each
                      </span>
                    </div>

                    <span className="font-bold text-sm text-gray-900 shrink-0">
                      ₹{itemTotal.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Bill Summary */}
            <div className="pt-4 border-t border-[#E0DDD8] space-y-2 text-xs text-gray-600">
              <div className="flex justify-between">
                <span>Item Subtotal</span>
                <span className="font-semibold text-gray-900">
                  ₹{Number(order.itemTotal || order.subTotal || 0).toFixed(2)}
                </span>
              </div>
              {Number(order.taxAmount || ((order.cgstAmount || 0) + (order.sgstAmount || 0))) > 0 && (
                <div className="flex justify-between">
                  <span>Taxes (CGST + SGST)</span>
                  <span className="font-semibold text-gray-900">
                    ₹{Number(order.taxAmount || ((order.cgstAmount || 0) + (order.sgstAmount || 0))).toFixed(2)}
                  </span>
                </div>
              )}
              {Number(order.discountAmount) > 0 && (
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span>Discount</span>
                  <span>-₹{Number(order.discountAmount).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-dashed border-[#E0DDD8] text-base font-black text-gray-900">
                <span>Grand Total</span>
                <span className="text-[#D33401]">
                  ₹{Number(order.totalAmount || 0).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Payment & Restaurant Info (1 col) */}
          <div className="space-y-6">
            {/* Payment Summary Card */}
            <div className="bg-white rounded-3xl border border-[#E0DDD8] p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
                <CreditCard className="w-4 h-4 text-[#D33401]" />
                Payment Summary
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Status</span>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-extrabold ${
                      order.isSettled || String(order.paymentStatus).toUpperCase() === 'PAID'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {order.isSettled || String(order.paymentStatus).toUpperCase() === 'PAID' ? 'PAID' : 'PENDING'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Payment Mode</span>
                  <span className="text-xs font-semibold text-gray-800">
                    {order.paymentMode || order.paymentType || 'Cash / Counter'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Total Billed</span>
                  <span className="text-xs font-bold text-gray-900">
                    ₹{Number(order.totalAmount || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Restaurant Info Card */}
            <div className="bg-white rounded-3xl border border-[#E0DDD8] p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
                <Store className="w-4 h-4 text-[#D33401]" />
                {order.restaurantName || 'Menza Restaurant'}
              </div>

              {(order.address || order.city) && (
                <div className="flex items-start gap-2 text-xs text-gray-600">
                  <MapPin className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                  <span>{[order.address, order.city, order.state].filter(Boolean).join(', ')}</span>
                </div>
              )}

              {order.contactPhone && (
                <a
                  href={`tel:${order.contactPhone}`}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-[#D33401] text-[#D33401] hover:bg-[#FFF1EC] transition text-xs font-bold"
                >
                  <Phone className="w-3.5 h-3.5" /> Call Restaurant
                </a>
              )}
            </div>

            {/* Action Card: Explore Menu / Add More */}
            {onExploreMenu && (
              <button
                onClick={() => onExploreMenu(Number(order.restaurantId), Number(order.tableId || 0))}
                className="w-full py-3.5 bg-[#D33401] hover:bg-[#B82E01] text-white font-extrabold rounded-2xl transition flex items-center justify-center gap-2 shadow-md shadow-[#D33401]/25 text-sm"
              >
                <ShoppingBag className="w-4 h-4" />
                Explore Restaurant Menu
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
