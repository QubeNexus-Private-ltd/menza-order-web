/**
 * Enterprise Production Logger for MenzaOrder (Vercel Log Drain & Ingestion)
 *
 * Provides end-to-end customer session tracking, correlation IDs,
 * masked sensitive data, and telemetry for customer journeys:
 * (QR Scan -> Menu Browsing -> Cart -> Checkout -> OTP -> Payment -> KDS Kitchen Tracking).
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
export type LogCategory =
  | 'SESSION'
  | 'NAVIGATION'
  | 'MENU'
  | 'CART'
  | 'CHECKOUT'
  | 'AUTH'
  | 'PAYMENT'
  | 'ORDER'
  | 'SERVICE'
  | 'SIGNALR'
  | 'API'
  | 'SYSTEM'
  | 'ERROR';

export interface LogEntry {
  timestamp: string;
  clientTimestamp: number;
  sessionId: string;
  level: LogLevel;
  category: LogCategory;
  event: string;
  message: string;
  metadata?: Record<string, any>;
  screen?: string;
  url?: string;
  restaurantId?: number | string;
  restaurantName?: string;
  tableId?: number | string;
  tableName?: string;
  orderId?: number | string;
  customerPhone?: string;
  durationMs?: number;
  errorName?: string;
  errorMessage?: string;
  errorStack?: string;
  statusCode?: number;
  apiEndpoint?: string;
  httpMethod?: string;
}

/**
 * Masks phone numbers for privacy & compliance (e.g. 9876543210 -> 98765****0)
 */
export function maskPhone(phone?: string | null): string {
  if (!phone) return '';
  const cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.length < 6) return '***';
  return `${cleaned.slice(0, 5)}****${cleaned.slice(-1)}`;
}

/**
 * Retrieves or creates a persistent session ID for the user's browser session
 */
function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return 'server_session';
  try {
    let sid = sessionStorage.getItem('menza_session_id');
    if (!sid) {
      sid = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      sessionStorage.setItem('menza_session_id', sid);
    }
    return sid;
  } catch {
    return `sess_${Date.now()}_local`;
  }
}

class Logger {
  private static instance: Logger;
  private sessionId: string;
  private currentScreen?: string;
  private currentRestaurantId?: number | string;
  private currentRestaurantName?: string;
  private currentTableId?: number | string;
  private currentTableName?: string;
  private currentOrderId?: number | string;
  private currentCustomerPhone?: string;
  private isDispatchingToApi = false;
  private recentLogHashes: Set<string> = new Set();

  private constructor() {
    this.sessionId = getOrCreateSessionId();
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public getSessionId(): string {
    return this.sessionId;
  }

  public setContext(context: {
    screen?: string;
    restaurantId?: number | string;
    restaurantName?: string;
    tableId?: number | string;
    tableName?: string;
    orderId?: number | string;
    customerPhone?: string;
  }): void {
    if (context.screen !== undefined) this.currentScreen = context.screen;
    if (context.restaurantId !== undefined) this.currentRestaurantId = context.restaurantId;
    if (context.restaurantName !== undefined) this.currentRestaurantName = context.restaurantName;
    if (context.tableId !== undefined) this.currentTableId = context.tableId;
    if (context.tableName !== undefined) this.currentTableName = context.tableName;
    if (context.orderId !== undefined) this.currentOrderId = context.orderId;
    if (context.customerPhone !== undefined) this.currentCustomerPhone = maskPhone(context.customerPhone);
  }

  public setScreen(screen: string): void {
    this.currentScreen = screen;
  }

  public setRestaurantId(id: number | string | undefined, name?: string): void {
    this.currentRestaurantId = id;
    if (name) this.currentRestaurantName = name;
  }

  public setTableId(id: number | string | undefined, name?: string): void {
    this.currentTableId = id;
    if (name) this.currentTableName = name;
  }

  public setOrderId(id: number | string | undefined): void {
    this.currentOrderId = id;
  }

  public setCustomerPhone(phone: string | undefined): void {
    this.currentCustomerPhone = maskPhone(phone);
  }

  private shouldLog(level: LogLevel): boolean {
    const isDev = Boolean(import.meta.env?.DEV);
    if (isDev) return true;
    return level === 'INFO' || level === 'WARN' || level === 'ERROR';
  }

  private normalizeError(err: any): { name: string; message: string; stack?: string; status?: number } {
    if (!err) return { name: 'UnknownError', message: 'No error details provided' };
    if (typeof err === 'string') return { name: 'Error', message: err };

    const name = err.name || err.constructor?.name || 'Error';
    let message = err.message || 'An unexpected error occurred';
    let status = err.response?.status || err.status;

    if (err.response?.data) {
      const data = err.response.data;
      if (typeof data === 'string') {
        message = data;
      } else if (data.message) {
        message = data.message;
      } else if (data.error) {
        message = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
      }
    }

    const stack = err.stack ? err.stack.split('\n').slice(0, 4).join('\n') : undefined;
    return { name, message, status, stack };
  }

  private createEntry(
    level: LogLevel,
    category: LogCategory,
    event: string,
    message: string,
    metadata?: Record<string, any>,
    extraContext?: Partial<LogEntry>
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      clientTimestamp: Date.now(),
      sessionId: this.sessionId,
      level,
      category,
      event,
      message,
      metadata,
      screen: extraContext?.screen || this.currentScreen,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      restaurantId: extraContext?.restaurantId || this.currentRestaurantId,
      restaurantName: extraContext?.restaurantName || this.currentRestaurantName,
      tableId: extraContext?.tableId || this.currentTableId,
      tableName: extraContext?.tableName || this.currentTableName,
      orderId: extraContext?.orderId || this.currentOrderId,
      customerPhone: extraContext?.customerPhone || this.currentCustomerPhone,
      apiEndpoint: extraContext?.apiEndpoint,
      httpMethod: extraContext?.httpMethod,
      statusCode: extraContext?.statusCode,
      durationMs: extraContext?.durationMs,
      errorName: extraContext?.errorName,
      errorMessage: extraContext?.errorMessage,
      errorStack: extraContext?.errorStack,
    };
  }

  private dispatch(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) return;

    // Deduplicate rapid identical logs (e.g. repeated clicks within 1 sec)
    const logHash = `${entry.category}:${entry.event}:${entry.message}`;
    if (this.recentLogHashes.has(logHash)) {
      return;
    }
    this.recentLogHashes.add(logHash);
    setTimeout(() => this.recentLogHashes.delete(logHash), 1200);

    const isDev = Boolean(import.meta.env?.DEV);

    if (isDev) {
      const prefix = `⚡ [${entry.level}] [${entry.category}:${entry.event}]`;
      switch (entry.level) {
        case 'DEBUG':
          console.debug(prefix, entry.message, entry.metadata || '');
          break;
        case 'INFO':
          console.info(prefix, entry.message, entry.metadata || '');
          break;
        case 'WARN':
          console.warn(prefix, entry.message, entry.metadata || '');
          break;
        case 'ERROR':
          console.error(prefix, entry.message, entry.errorName || '', entry.metadata || '');
          break;
      }
    } else {
      // Production: Structured JSON in browser console
      const json = JSON.stringify(entry);
      if (entry.level === 'ERROR') {
        console.error(json);
      } else if (entry.level === 'WARN') {
        console.warn(json);
      } else {
        console.log(json);
      }
    }

    // Stream all production-level events (INFO, WARN, ERROR) to Vercel /api/log
    if (typeof window !== 'undefined' && !this.isDispatchingToApi) {
      this.isDispatchingToApi = true;
      try {
        const payload = JSON.stringify(entry);
        let sent = false;

        // 1. Try navigator.sendBeacon with explicit application/json Blob
        if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
          try {
            const blob = new Blob([payload], { type: 'application/json' });
            sent = navigator.sendBeacon('/api/log', blob);
          } catch {
            sent = false;
          }
        }

        // 2. Reliable keepalive fetch fallback
        if (!sent && typeof fetch !== 'undefined') {
          fetch('/api/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            keepalive: true,
          }).catch(() => {});
        }
      } catch {
        // Prevent logging errors from bubbling
      } finally {
        this.isDispatchingToApi = false;
      }
    }
  }

  // Generic methods
  public debug(category: LogCategory, event: string, message: string, metadata?: Record<string, any>): void {
    this.dispatch(this.createEntry('DEBUG', category, event, message, metadata));
  }

  public info(category: LogCategory, event: string, message: string, metadata?: Record<string, any>): void {
    this.dispatch(this.createEntry('INFO', category, event, message, metadata));
  }

  public warn(category: LogCategory, event: string, message: string, metadata?: Record<string, any>): void {
    this.dispatch(this.createEntry('WARN', category, event, message, metadata));
  }

  public error(
    category: LogCategory,
    event: string,
    errorOrMessage: any,
    metadata?: Record<string, any>,
    extraContext?: Partial<LogEntry>
  ): void {
    const norm = this.normalizeError(errorOrMessage);
    const msg = norm.message || (typeof errorOrMessage === 'string' ? errorOrMessage : 'An error occurred');
    const entry = this.createEntry('ERROR', category, event, msg, metadata, {
      ...extraContext,
      errorName: norm.name,
      errorMessage: norm.message,
      errorStack: norm.stack,
      statusCode: extraContext?.statusCode || norm.status,
    });
    this.dispatch(entry);
  }

  // Domain-specific logging helpers for fast, typed logging across components
  public nav(event: string, message: string, metadata?: Record<string, any>): void {
    this.dispatch(this.createEntry('INFO', 'NAVIGATION', event, message, metadata));
  }

  public menu(event: string, message: string, metadata?: Record<string, any>): void {
    this.dispatch(this.createEntry('INFO', 'MENU', event, message, metadata));
  }

  public cart(event: string, message: string, metadata?: Record<string, any>): void {
    this.dispatch(this.createEntry('INFO', 'CART', event, message, metadata));
  }

  public checkout(event: string, message: string, metadata?: Record<string, any>): void {
    this.dispatch(this.createEntry('INFO', 'CHECKOUT', event, message, metadata));
  }

  public auth(event: string, message: string, metadata?: Record<string, any>): void {
    this.dispatch(this.createEntry('INFO', 'AUTH', event, message, metadata));
  }

  public payment(event: string, message: string, metadata?: Record<string, any>): void {
    const level: LogLevel = event.endsWith('_FAILED') || event.endsWith('_TIMEOUT') ? 'ERROR' : 'INFO';
    this.dispatch(this.createEntry(level, 'PAYMENT', event, message, metadata));
  }

  public order(event: string, message: string, metadata?: Record<string, any>): void {
    const level: LogLevel = event.endsWith('_FAILED') ? 'ERROR' : 'INFO';
    this.dispatch(this.createEntry(level, 'ORDER', event, message, metadata));
  }

  public service(event: string, message: string, metadata?: Record<string, any>): void {
    this.dispatch(this.createEntry('INFO', 'SERVICE', event, message, metadata));
  }

  public api(
    event: 'API_REQUEST' | 'API_RESPONSE' | 'API_ERROR' | 'API_SLOW_REQUEST',
    message: string,
    metadata?: Record<string, any>,
    extraContext?: Partial<LogEntry>
  ): void {
    const level: LogLevel = event === 'API_ERROR' ? 'ERROR' : event === 'API_SLOW_REQUEST' ? 'WARN' : 'INFO';
    this.dispatch(this.createEntry(level, 'API', event, message, metadata, extraContext));
  }

  public signalr(
    event: 'SIGNALR_CONNECTED' | 'SIGNALR_RECONNECTING' | 'SIGNALR_DISCONNECTED' | 'SIGNALR_ERROR' | 'SIGNALR_EVENT',
    message: string,
    metadata?: Record<string, any>
  ): void {
    const level: LogLevel = event === 'SIGNALR_ERROR' ? 'ERROR' : event === 'SIGNALR_DISCONNECTED' ? 'WARN' : 'INFO';
    this.dispatch(this.createEntry(level, 'SIGNALR', event, message, metadata));
  }
}

export const logger = Logger.getInstance();

/**
 * Initializes global browser error and unhandled promise rejection listeners
 */
export function initGlobalErrorLogging(): void {
  if (typeof window === 'undefined') return;

  const sid = logger.getSessionId();

  // Initial startup diagnostic
  logger.info('SESSION', 'SESSION_STARTED', `Customer session initiated on ${navigator.userAgent || 'unknown device'}`, {
    sessionId: sid,
    url: window.location.href,
    pathname: window.location.pathname,
    search: window.location.search,
    screen: `${window.innerWidth}x${window.innerHeight}`,
    language: navigator.language,
    referrer: document.referrer || '',
  });

  window.addEventListener('error', (event) => {
    logger.error('SYSTEM', 'UNCAUGHT_BROWSER_ERROR', event.error || event.message, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      sessionId: sid,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    logger.error('SYSTEM', 'UNHANDLED_PROMISE_REJECTION', event.reason, {
      reason: String(event.reason),
      sessionId: sid,
    });
  });
}
