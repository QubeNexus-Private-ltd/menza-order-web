/**
 * Application Configuration & Environment Variable Manager
 * 
 * Centralizes all environment configuration values loaded from .env via Vite / dotenv.
 * Eliminates hardcoded URLs, sensitive seeds, and credentials from source code for security.
 */

// Helper to safely read string environment variables
const readEnv = (key: string, defaultValue = ''): string => {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key] !== undefined) {
    const val = String(import.meta.env[key]).trim();
    if (val.length > 0) return val;
  }
  return defaultValue;
};

// Helper to safely read number environment variables
const readEnvNumber = (key: string, defaultValue: number): number => {
  const val = readEnv(key);
  if (!val) return defaultValue;
  const num = Number(val);
  return isNaN(num) ? defaultValue : num;
};

// Raw base values
const rawApiBase = readEnv(
  'VITE_API_BASE_URL',
  'https://menzaposapi20260927220419-efbdafa3buaccge8.centralindia-01.azurewebsites.net'
);
const cleanApiBase = rawApiBase.replace(/\/+$/, '').replace(/\/api$/, '');

const rawBlobBase = readEnv(
  'VITE_AZURE_BLOB_BASE_URL',
  'https://screstdev.blob.core.windows.net/sarest/'
);
const cleanBlobBase = rawBlobBase.replace(/\/+$/, '') + '/';

const rawSignalRUrl = readEnv('VITE_SIGNALR_HUB_URL', '');
const cleanSignalRUrl = rawSignalRUrl
  ? rawSignalRUrl.replace(/\/+$/, '')
  : `${cleanApiBase}/hubs/order`;

export const ENV = {
  /**
   * Backend REST API Base URL
   */
  API_BASE_URL: cleanApiBase,

  /**
   * SignalR Real-Time WebSocket Hub URL
   */
  SIGNALR_HUB_URL: cleanSignalRUrl,

  /**
   * Azure Blob Storage Base CDN URL for images
   */
  AZURE_BLOB_BASE_URL: cleanBlobBase,

  /**
   * Encryption salt seed used for hashing/obfuscating IDs
   */
  ENCRYPTION_SALT: readEnv('VITE_ENCRYPTION_SALT', 'MenzaSalt2026'),

  /**
   * Cashfree Gateway Environment: 'production' | 'sandbox'
   */
  CASHFREE_MODE: (readEnv('VITE_CASHFREE_MODE', 'production').toLowerCase() === 'sandbox'
    ? 'sandbox'
    : 'production') as 'production' | 'sandbox',

  /**
   * Axios Request Timeout in ms (default: 7000ms)
   */
  API_TIMEOUT_MS: readEnvNumber('VITE_API_TIMEOUT_MS', 7000),

  /**
   * Public Web Application Origin (for generating QR codes and share links)
   */
  APP_URL: readEnv('VITE_APP_URL', 'https://menza-order-web.vercel.app'),

  /**
   * Default Veg Fallback Image CDN
   */
  DEFAULT_VEG_IMAGE: readEnv(
    'VITE_DEFAULT_VEG_IMAGE',
    'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600'
  ),

  /**
   * Default Non-Veg Fallback Image CDN
   */
  DEFAULT_NON_VEG_IMAGE: readEnv(
    'VITE_DEFAULT_NON_VEG_IMAGE',
    'https://images.unsplash.com/photo-1544025162-d76694265947?w=600'
  ),

  /**
   * Application Display Name
   */
  APP_NAME: readEnv('VITE_APP_NAME', 'MenzaOrder'),

  /**
   * Vite Runtime Mode ('development' | 'production')
   */
  MODE: typeof import.meta !== 'undefined' && import.meta.env?.MODE ? import.meta.env.MODE : 'production',
  IS_PROD: Boolean(typeof import.meta !== 'undefined' && import.meta.env?.PROD),
  IS_DEV: Boolean(typeof import.meta !== 'undefined' && import.meta.env?.DEV),
} as const;

export default ENV;
