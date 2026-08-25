/**
 * Rate Limiter Service for MenzaOrder
 * 
 * Implements sliding window and minimum-interval rate limiting algorithms
 * to protect sensitive actions (OTP, Waiter Calling, Bill Request, Order Placement, etc.)
 * from spamming, double submissions, brute-force attacks, and server overload.
 */

// Preset rule configurations
export const RATE_LIMIT_RULES = {
  OTP_GENERATE: {
    maxRequests: 3,
    windowMs: 60 * 1000,       // 3 attempts per 60 seconds
    minIntervalMs: 30 * 1000,   // Minimum 30s between consecutive OTP requests
    actionName: 'OTP Request',
    errorMessage: 'Too many OTP requests. Please wait {seconds}s before requesting a new code.',
  },

  OTP_VERIFY: {
    maxRequests: 5,
    windowMs: 60 * 1000,       // 5 verification attempts per 60 seconds
    minIntervalMs: 1000,
    actionName: 'OTP Verification',
    errorMessage: 'Too many invalid attempts. Please wait {seconds}s before trying again.',
  },

  PLACE_ORDER: {
    maxRequests: 1,
    windowMs: 4 * 1000,        // 1 order placement per 4 seconds
    minIntervalMs: 4000,
    actionName: 'Place Order',
    errorMessage: 'An order request is already processing. Please wait {seconds}s.',
  },

  CALL_WAITER: {
    maxRequests: 1,
    windowMs: 30 * 1000,       // 1 waiter call per 30 seconds
    minIntervalMs: 30 * 1000,
    actionName: 'Call Waiter',
    errorMessage: 'Waiter has already been notified. Please wait {seconds}s before buzzing again.',
  },

  REQUEST_BILL: {
    maxRequests: 1,
    windowMs: 30 * 1000,       // 1 bill request per 30 seconds
    minIntervalMs: 30 * 1000,
    actionName: 'Request Bill',
    errorMessage: 'Bill request already submitted. Please wait {seconds}s.',
  },

  CART_MUTATION: {
    maxRequests: 25,
    windowMs: 10 * 1000,       // Max 25 cart updates in 10 seconds
    minIntervalMs: 100,
    actionName: 'Cart Update',
    errorMessage: 'Please slow down cart updates.',
  },

  GLOBAL_API: {
    maxRequests: 60,
    windowMs: 60 * 1000,       // 60 requests per minute
    minIntervalMs: 50,
    actionName: 'API Request',
    errorMessage: 'Network rate limit exceeded. Please wait {seconds}s.',
  },
};

// In-memory record storage: key -> array of timestamp numbers [t1, t2, ...]
const requestStore = new Map();

/**
 * Generates a storage key for action + optional identifier
 */
function getStorageKey(actionType, identifier = 'default') {
  return `${actionType}::${identifier}`;
}

/**
 * Checks if an action is currently rate-limited without recording a new attempt
 * 
 * @param {string} actionType - One of RATE_LIMIT_RULES keys or custom name
 * @param {string} [identifier='default'] - e.g. mobile number, tableId, or deviceId
 * @param {object} [customRule] - Optional rule override
 * @returns {{ isAllowed: boolean, retryAfterSeconds: number, remaining: number, message: string }}
 */
export function checkRateLimit(actionType, identifier = 'default', customRule = null) {
  const rule = customRule || RATE_LIMIT_RULES[actionType] || RATE_LIMIT_RULES.GLOBAL_API;
  const key = getStorageKey(actionType, identifier);
  const now = Date.now();

  let timestamps = requestStore.get(key) || [];

  // Filter out timestamps outside the sliding window
  const windowStart = now - rule.windowMs;
  timestamps = timestamps.filter((t) => t > windowStart);
  requestStore.set(key, timestamps);

  // Check 1: Minimum interval between consecutive requests
  if (rule.minIntervalMs && timestamps.length > 0) {
    const lastTimestamp = timestamps[timestamps.length - 1];
    const timeSinceLast = now - lastTimestamp;
    if (timeSinceLast < rule.minIntervalMs) {
      const waitMs = rule.minIntervalMs - timeSinceLast;
      const retryAfterSeconds = Math.ceil(waitMs / 1000);
      const message = (rule.errorMessage || 'Please wait {seconds}s before trying again.').replace(
        '{seconds}',
        String(retryAfterSeconds)
      );
      return {
        isAllowed: false,
        retryAfterSeconds,
        remaining: 0,
        message,
      };
    }
  }

  // Check 2: Maximum requests in sliding window
  if (timestamps.length >= rule.maxRequests) {
    const oldestInWindow = timestamps[0];
    const waitMs = rule.windowMs - (now - oldestInWindow);
    const retryAfterSeconds = Math.max(1, Math.ceil(waitMs / 1000));
    const message = (rule.errorMessage || 'Rate limit reached. Please wait {seconds}s.').replace(
      '{seconds}',
      String(retryAfterSeconds)
    );
    return {
      isAllowed: false,
      retryAfterSeconds,
      remaining: 0,
      message,
    };
  }

  const remaining = rule.maxRequests - timestamps.length;
  return {
    isAllowed: true,
    retryAfterSeconds: 0,
    remaining,
    message: '',
  };
}

/**
 * Records an attempt for the given action and identifier
 * 
 * @param {string} actionType
 * @param {string} [identifier='default']
 */
export function recordRateLimitAttempt(actionType, identifier = 'default') {
  const key = getStorageKey(actionType, identifier);
  const now = Date.now();
  const timestamps = requestStore.get(key) || [];
  timestamps.push(now);
  requestStore.set(key, timestamps);
}

/**
 * Consumes a rate limit token: checks and records in one step.
 * Throws a RateLimitError if limit is exceeded.
 * 
 * @param {string} actionType
 * @param {string} [identifier='default']
 * @param {object} [customRule]
 * @returns {{ allowed: boolean, remaining: number }}
 */
export function consumeRateLimit(actionType, identifier = 'default', customRule = null) {
  const check = checkRateLimit(actionType, identifier, customRule);
  if (!check.isAllowed) {
    const error = new Error(check.message);
    error.name = 'RateLimitError';
    error.retryAfterSeconds = check.retryAfterSeconds;
    error.actionType = actionType;
    error.isRateLimited = true;
    throw error;
  }

  recordRateLimitAttempt(actionType, identifier);
  return {
    allowed: true,
    remaining: check.remaining - 1,
  };
}

/**
 * Retrieves remaining cooldown seconds for an action (0 if ready)
 */
export function getCooldownSeconds(actionType, identifier = 'default', customRule = null) {
  const check = checkRateLimit(actionType, identifier, customRule);
  return check.retryAfterSeconds;
}

/**
 * Resets rate limit store for a specific action/identifier or all
 */
export function resetRateLimit(actionType = null, identifier = null) {
  if (!actionType) {
    requestStore.clear();
    return;
  }

  if (identifier) {
    requestStore.delete(getStorageKey(actionType, identifier));
  } else {
    for (const key of requestStore.keys()) {
      if (key.startsWith(`${actionType}::`)) {
        requestStore.delete(key);
      }
    }
  }
}

/**
 * Global rate limit event broadcaster for UI components
 */
const listeners = new Set();

export function onRateLimitExceeded(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function broadcastRateLimitExceeded(payload) {
  listeners.forEach((cb) => {
    try {
      cb(payload);
    } catch (e) {
      console.error('Rate limit listener error:', e);
    }
  });
}
