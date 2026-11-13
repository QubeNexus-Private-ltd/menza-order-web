import * as api from './api';

export interface WhatsAppReceiptData {
  restaurantName: string;
  orderId: number | string;
  customerName?: string;
  customerPhone?: string;
  tableName?: string;
  orderType?: string;
  items: Array<{ itemName?: string; name?: string; quantity: number; price?: number; amount?: number; unitPrice?: number }>;
  subTotal?: number;
  cgst?: number;
  sgst?: number;
  taxAmount?: number;
  discountAmount?: number;
  grandTotal: number;
  paymentMode?: string;
  paymentStatus?: string;
  billUrl?: string;
  gstNumber?: string | null;
}

export class OrderWhatsAppService {
  /**
   * Resolves a valid 10-digit Indian mobile number from various possible order properties or user input.
   */
  static resolveMobileNumber(phone?: string, order?: any): string {
    const candidates = [
      phone,
      order?.mobileNumber,
      order?.customerPhone,
      order?.phone,
      order?.customerMobile,
      order?.MobileNumber,
      order?.CustomerPhone,
      order?.mobile,
    ];

    for (const c of candidates) {
      if (typeof c === 'string' && !c.includes('*')) {
        const digits = c.replace(/[^0-9]/g, '');
        if (digits.length >= 10) {
          return digits.slice(-10);
        }
      }
    }

    // Fallback to customer session or active order in local storage
    try {
      const savedUser = api.getSavedCustomer();
      const userPhone = savedUser?.mobile || savedUser?.mobileNumber || savedUser?.phone;
      if (userPhone && typeof userPhone === 'string' && !userPhone.includes('*')) {
        const digits = userPhone.replace(/[^0-9]/g, '');
        if (digits.length >= 10) return digits.slice(-10);
      }

      const activeOrd = api.getSavedActiveOrder();
      const activePhone = activeOrd?.mobileNumber || activeOrd?.customerPhone || activeOrd?.phone;
      if (activePhone && typeof activePhone === 'string' && !activePhone.includes('*')) {
        const digits = activePhone.replace(/[^0-9]/g, '');
        if (digits.length >= 10) return digits.slice(-10);
      }
    } catch {}

    return '';
  }

  /**
   * Formats a clean, structured tax invoice receipt text including a direct PDF view/download link.
   */
  static formatReceiptMessage(receiptData: WhatsAppReceiptData): string {
    const itemsText = (receiptData.items || [])
      .map((it) => {
        const name = it.itemName || it.name || 'Item';
        const price = Number(it.price ?? it.unitPrice ?? it.amount ?? 0);
        const qty = Number(it.quantity || 1);
        return `• ${qty}x ${name} - ₹${(price * qty).toFixed(2)}`;
      })
      .join('\n');

    const cleanOrderId = String(receiptData.orderId || '').replace(/[^0-9]/g, '') || receiptData.orderId;
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://menzaorder.co.in';
    const billUrl = receiptData.billUrl || `${origin}/bill/${cleanOrderId}`;

    const cleanGst = (receiptData.gstNumber || '').trim();
    const hasGstBifurcation = Boolean(cleanGst && (receiptData.cgst ?? 0) > 0 && (receiptData.sgst ?? 0) > 0);

    const lines: string[] = [
      `*${receiptData.restaurantName}*`,
      hasGstBifurcation
        ? `🧾 *Tax Invoice / Bill: Order #${cleanOrderId}*`
        : `🧾 *Bill / Receipt: Order #${cleanOrderId}*`,
    ];

    if (receiptData.tableName) {
      lines.push(`📍 Table: ${receiptData.tableName}${receiptData.orderType ? ` (${receiptData.orderType})` : ''}`);
    } else if (receiptData.orderType) {
      lines.push(`📦 Type: ${receiptData.orderType}`);
    }

    if (receiptData.customerName) {
      lines.push(`👤 Customer: ${receiptData.customerName}`);
    }

    lines.push('--------------------------------');
    if (itemsText) {
      lines.push(itemsText);
      lines.push('--------------------------------');
    }

    if (receiptData.subTotal && receiptData.subTotal > 0) {
      lines.push(`Subtotal: ₹${receiptData.subTotal.toFixed(2)}`);
    }

    if (hasGstBifurcation) {
      const tax = receiptData.taxAmount ?? ((receiptData.cgst || 0) + (receiptData.sgst || 0));
      if (tax > 0) {
        lines.push(`Taxes (CGST+SGST): ₹${tax.toFixed(2)}`);
      }
    } else {
      lines.push(`_Net total is inclusive of all taxes_`);
    }

    if (receiptData.discountAmount && receiptData.discountAmount > 0) {
      lines.push(`Discount: -₹${receiptData.discountAmount.toFixed(2)}`);
    }

    const payStatus = receiptData.paymentStatus ? ` (${receiptData.paymentStatus.toUpperCase()})` : '';
    lines.push(`*Grand Total: ₹${Number(receiptData.grandTotal || 0).toFixed(2)}${payStatus}*`);

    if (receiptData.paymentMode) {
      lines.push(`Payment Mode: ${receiptData.paymentMode}`);
    }

    lines.push('--------------------------------');
    lines.push(`📄 *Download / View Official PDF Bill:*`);
    lines.push(billUrl);
    lines.push('--------------------------------');
    lines.push('Thank you for dining with us! 🙏');

    return lines.join('\n');
  }

  /**
   * Dispatches WhatsApp receipt without creating duplicate browser tabs or triggering session lockouts.
   * Leverages official WhatsApp Universal API links (wa.me / api.whatsapp.com) with popup-blocker resilience.
   */
  static shareWhatsAppReceipt(phone: string, receiptData: WhatsAppReceiptData, order?: any): void {
    if (typeof window === 'undefined') return;

    let cleanPhone = this.resolveMobileNumber(phone, order);

    if (!cleanPhone || cleanPhone.length < 10) {
      const entered = window.prompt('Enter 10-digit WhatsApp mobile number:', cleanPhone || '');
      if (!entered) return;
      cleanPhone = (entered || '').replace(/[^0-9]/g, '').slice(-10);
    }

    if (!cleanPhone || cleanPhone.length < 10) {
      alert('Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    const fullPhone = `91${cleanPhone}`;
    const msg = this.formatReceiptMessage(receiptData);

    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const encodedText = encodeURIComponent(msg);

    const targetUrl = isMobile
      ? `https://wa.me/${fullPhone}?text=${encodedText}`
      : `https://api.whatsapp.com/send?phone=${fullPhone}&text=${encodedText}`;

    let targetWindow: Window | null = null;
    try {
      targetWindow = window.open(targetUrl, 'menza_whatsapp_tab');
      if (targetWindow) {
        targetWindow.focus();
      }
    } catch {}

    if (!targetWindow || targetWindow.closed || typeof targetWindow.closed === 'undefined') {
      try {
        const link = document.createElement('a');
        link.href = targetUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch {
        window.location.href = targetUrl;
      }
    }
  }

  /**
   * Generates a direct WhatsApp web/app click-to-chat URL with prefilled receipt text
   */
  static getWhatsAppReceiptUrl(phone: string, receiptData: WhatsAppReceiptData, order?: any): string {
    let cleanPhone = this.resolveMobileNumber(phone, order);
    const fullPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const msg = this.formatReceiptMessage(receiptData);

    return `https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`;
  }
}
