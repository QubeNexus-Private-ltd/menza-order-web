/**
 * Razorpay Standard Web Checkout Service
 * Loads https://checkout.razorpay.com/v1/checkout.js dynamically and opens the modal checkout.
 */

export interface RazorpayCheckoutOptions {
  key: string;
  amountPaise: number;
  currency?: string;
  name: string;
  description?: string;
  orderId: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  themeColor?: string;
}

export interface RazorpayPaymentSuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export function loadRazorpaySdk(): Promise<any> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Razorpay Checkout SDK is only available in browser environments.'));
      return;
    }

    if ((window as any).Razorpay) {
      resolve((window as any).Razorpay);
      return;
    }

    const scriptId = 'razorpay-checkout-js';
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      document.head.appendChild(script);
    }

    script.addEventListener('load', () => {
      if ((window as any).Razorpay) {
        resolve((window as any).Razorpay);
      } else {
        reject(new Error('Razorpay SDK loaded, but window.Razorpay is unavailable.'));
      }
    });

    script.addEventListener('error', () => {
      reject(new Error('Failed to load Razorpay Checkout SDK from CDN.'));
    });
  });
}

export async function openRazorpayCheckout(
  options: RazorpayCheckoutOptions
): Promise<RazorpayPaymentSuccessResponse> {
  const RazorpayConstructor = await loadRazorpaySdk();

  return new Promise<RazorpayPaymentSuccessResponse>((resolve, reject) => {
    let settled = false;

    const rzp = new RazorpayConstructor({
      key: options.key,
      amount: options.amountPaise,
      currency: options.currency || 'INR',
      name: options.name || 'MenzaOrder',
      description: options.description || 'Food Order Payment',
      order_id: options.orderId,
      prefill: {
        name: options.prefill?.name || '',
        email: options.prefill?.email || '',
        contact: options.prefill?.contact || '',
      },
      notes: options.notes || {},
      theme: {
        color: options.themeColor || '#D33401',
      },
      handler: (response: RazorpayPaymentSuccessResponse) => {
        if (settled) return;
        settled = true;
        resolve(response);
      },
      modal: {
        ondismiss: () => {
          if (settled) return;
          settled = true;
          const err: any = new Error('Payment window closed before completion.');
          err.isDismissed = true;
          reject(err);
        },
      },
    });

    if (typeof rzp.on === 'function') {
      rzp.on('payment.failed', (failureEvent: any) => {
        if (settled) return;
        settled = true;
        const msg =
          failureEvent?.error?.description ||
          failureEvent?.error?.reason ||
          'Razorpay payment failed.';
        reject(new Error(msg));
      });
    }

    rzp.open();
  });
}
