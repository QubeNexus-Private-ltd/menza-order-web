/**
 * Production Client Logger for MenzaOrder (Vercel Ingestion Enabled)
 *
 * In development: Logs rich, readable terminal/console messages.
 * In production: Outputs structured JSON, and forwards WARNINGS, ERRORS,
 * and critical ordering/payment events to /api/log for Vercel runtime ingestion.
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
export type LogCategory =
  | 'ORDER'
  | 'CART'
  | 'PAYMENT'
  | 'AUTH'
  | 'API'
  | 'SIGNALR'
  | 'TABLE'
  | 'MENU'
  | 'NAVIGATION'
  | 'SYSTEM'
  | 'ERROR';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  event: string;
  message: string;
  metadata?: Record<string, any>;
  screen?: string;
  url?: string;
  restaurantId?: number | string;
  tableId?: number | string;
  orderId?: number | string;
  clientTimestamp?: number;
  durationMs?: number;
  errorName?: string;
  errorMessage?: string;
  errorStack?: string;
  statusCode?: number;
  apiEndpoint?: string;
  httpMethod?: string;
}

class Logger {
  private static instance: Logger;
  private currentScreen?: string;
  private currentRestaurantId?: number | string;
  private currentTableId?: number | string;
  private currentOrderId?: number | string;
  private isDispatchingToApi = false;

  private constructor() {}

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public setContext(context: {
    screen?: string;
    restaurantId?: number | string;
    tableId?: number | string;
    orderId?: number | string;
  }): void {
    if (context.screen !== undefined) this.currentScreen = context.screen;
    if (context.restaurantId !== undefined) this.currentRestaurantId = context.restaurantId;
    if (context.tableId !== undefined) this.currentTableId = context.tableId;
    if (context.orderId !== undefined) this.currentOrderId = context.orderId;
  }

  public setScreen(screen: string): void {
    this.currentScreen = screen;
  }

  public setRestaurantId(id: number | string | undefined): void {
    this.currentRestaurantId = id;
  }

  public setTableId(id: number | string | undefined): void {
    this.currentTableId = id;
  }

  public setOrderId(id: number | string | undefined): void {
    this.currentOrderId = id;
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
      level,
      category,
      event,
      message,
      metadata,
      screen: extraContext?.screen || this.currentScreen,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      restaurantId: extraContext?.restaurantId || this.currentRestaurantId,
      tableId: extraContext?.tableId || this.currentTableId,
      orderId: extraContext?.orderId || this.currentOrderId,
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

    const isDev = Boolean(import.meta.env?.DEV);

    if (isDev) {
      const prefix = `[MenzaOrder:${entry.category}:${entry.event}]`;
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
      // Production: structured JSON log to client console
      const json = JSON.stringify(entry);
      if (entry.level === 'ERROR') {
        console.error(json);
      } else if (entry.level === 'WARN') {
        console.warn(json);
      } else {
        console.log(json);
      }
    }

    // Forward all INFO, WARN, and ERROR events to Vercel /api/log
    const shouldForwardToVercel =
      typeof window !== 'undefined' &&
      !this.isDispatchingToApi &&
      (entry.level === 'ERROR' || entry.level === 'WARN' || entry.level === 'INFO');

    if (shouldForwardToVercel) {
      this.isDispatchingToApi = true;
      try {
        const payload = JSON.stringify(entry);
        let sent = false;

        // Try navigator.sendBeacon with explicit application/json Blob
        if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
          try {
            const blob = new Blob([payload], { type: 'application/json' });
            sent = navigator.sendBeacon('/api/log', blob);
          } catch {
            sent = false;
          }
        }

        // Reliable fetch fallback with keepalive: true
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

  public order(
    event: 'ORDER_INITIATED' | 'ORDER_PLACED' | 'ORDER_FAILED' | 'ORDER_STATUS_CHANGED',
    message: string,
    metadata?: Record<string, any>
  ): void {
    const level: LogLevel = event === 'ORDER_FAILED' ? 'ERROR' : 'INFO';
    this.dispatch(this.createEntry(level, 'ORDER', event, message, metadata));
  }

  public payment(
    event: 'PAYMENT_INITIATED' | 'PAYMENT_VERIFIED' | 'PAYMENT_FAILED' | 'PAYMENT_TIMEOUT',
    message: string,
    metadata?: Record<string, any>
  ): void {
    const level: LogLevel = event.endsWith('_FAILED') || event.endsWith('_TIMEOUT') ? 'ERROR' : 'INFO';
    this.dispatch(this.createEntry(level, 'PAYMENT', event, message, metadata));
  }
}

export const logger = Logger.getInstance();

/**
 * Initializes global browser error and unhandled promise rejection listeners
 * to catch all unhandled crashes and stream them into Vercel runtime logs.
 */
export function initGlobalErrorLogging(): void {
  if (typeof window === 'undefined') return;

  // Emit immediate startup diagnostic so Vercel logs show every device connection
  logger.info('SYSTEM', 'APP_BOOT', `MenzaOrder Web Client loaded on ${navigator.userAgent || 'unknown device'}`, {
    url: window.location.href,
    pathname: window.location.pathname,
    search: window.location.search,
    screen: `${window.innerWidth}x${window.innerHeight}`,
    referrer: document.referrer || '',
  });

  window.addEventListener('error', (event) => {
    logger.error('SYSTEM', 'UNCAUGHT_BROWSER_ERROR', event.error || event.message, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    logger.error('SYSTEM', 'UNHANDLED_PROMISE_REJECTION', event.reason, {
      reason: String(event.reason),
    });
  });
}
