/**
 * Hardware Canvas & WebGL Device Fingerprinting
 * 
 * Generates a stable, tamper-resistant 64-bit hardware signature that persists across:
 * - Incognito / Private Browsing tabs
 * - Cookie and LocalStorage flushes
 * - Dynamic IP / Network changes (Wi-Fi <-> Cellular)
 * - Browser tab reloads and session drops
 * 
 * Hardware Entropy Sources:
 * 1. 2D Canvas Font Rasterization & Sub-Pixel Anti-Aliasing Geometry
 * 2. 2D Canvas Color Alpha Blending & Radial Gradients
 * 3. WebGL GPU Unmasked Renderer & Vendor (e.g. Adreno, Mali, Apple Silicon GPU)
 * 4. WebGL Shader Precision & 3D Rasterization Signature
 * 5. Physical Screen Resolution (Native physical pixel matrix independent of zoom)
 * 6. CPU Hardware Concurrency, RAM memory bucket, Touch Capabilities, & Timezone
 */

// Fast, non-cryptographic 32-bit MurmurHash3 algorithm
function murmurhash3(key: string, seed = 0): string {
  let remainder = key.length & 3;
  let bytes = key.length - remainder;
  let h1 = seed;
  const c1 = 0xcc9e2d51;
  const c2 = 0x1b873593;
  let i = 0;

  while (i < bytes) {
    let k1 =
      (key.charCodeAt(i) & 0xff) |
      ((key.charCodeAt(++i) & 0xff) << 8) |
      ((key.charCodeAt(++i) & 0xff) << 16) |
      ((key.charCodeAt(++i) & 0xff) << 24);
    ++i;

    k1 = Math.imul(k1, c1);
    k1 = (k1 << 15) | (k1 >>> 17);
    k1 = Math.imul(k1, c2);

    h1 ^= k1;
    h1 = (h1 << 13) | (h1 >>> 19);
    h1 = Math.imul(h1, 5) + 0xe6546b64;
  }

  let k1 = 0;
  switch (remainder) {
    case 3:
      k1 ^= (key.charCodeAt(i + 2) & 0xff) << 16;
    case 2:
      k1 ^= (key.charCodeAt(i + 1) & 0xff) << 8;
    case 1:
      k1 ^= key.charCodeAt(i) & 0xff;
      k1 = Math.imul(k1, c1);
      k1 = (k1 << 15) | (k1 >>> 17);
      k1 = Math.imul(k1, c2);
      h1 ^= k1;
  }

  h1 ^= key.length;
  h1 ^= h1 >>> 16;
  h1 = Math.imul(h1, 0x85ebca6b);
  h1 ^= h1 >>> 13;
  h1 = Math.imul(h1, 0xc2b2ae35);
  h1 ^= h1 >>> 16;

  return (h1 >>> 0).toString(16).padStart(8, '0');
}

// 64-bit dual-seeded hash string
function hash64(str: string): string {
  const h1 = murmurhash3(str, 1337);
  const h2 = murmurhash3(str, 4242);
  return `${h1}${h2}`;
}

/**
 * 1. 2D Canvas Font Rasterization & Geometry Signature
 * Extracts hardware-level anti-aliasing and sub-pixel rasterization quirks
 */
function getCanvas2dFingerprint(): string {
  if (typeof window === 'undefined' || typeof document === 'undefined') return 'ssr_2d';
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 280;
    canvas.height = 60;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'no_2d_ctx';

    // Winding rule test
    ctx.rect(0, 0, 10, 10);
    ctx.rect(2, 2, 6, 6);
    const isWindingSupported = !ctx.isPointInPath(5, 5, 'evenodd');

    // Text rendering with multiple fonts and emojis
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial, sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);

    ctx.fillStyle = '#069';
    ctx.font = '11pt no-real-font-123, monospace, "Segoe UI Emoji"';
    ctx.fillText('MenzaPOS <canvas> 1.0 \ud83d\ude03 \u260e', 2, 15);

    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.font = '18pt Arial';
    ctx.fillText('MenzaPOS <canvas> 1.0 \ud83d\ude03 \u260e', 4, 45);

    // Radial gradient & composite operation
    const grad = ctx.createRadialGradient(75, 50, 5, 90, 60, 100);
    grad.addColorStop(0, '#f00');
    grad.addColorStop(0.5, '#00f');
    grad.addColorStop(1, '#0f0');
    ctx.fillStyle = grad;
    ctx.arc(75, 30, 20, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.fill();

    return canvas.toDataURL() + (isWindingSupported ? '_wind1' : '_wind0');
  } catch (e) {
    return 'canvas_2d_err';
  }
}

/**
 * 2. WebGL Hardware GPU Fingerprint
 * Extracts unmasked GPU vendor, renderer model, shader precision, and 3D raster pixels
 */
function getWebGLFingerprint(): string {
  if (typeof window === 'undefined' || typeof document === 'undefined') return 'ssr_webgl';
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return 'no_webgl';

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    let vendor = '';
    let renderer = '';
    if (debugInfo) {
      vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || '';
      renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';
    } else {
      vendor = gl.getParameter(gl.VENDOR) || '';
      renderer = gl.getParameter(gl.RENDERER) || '';
    }

    // Hardware parameters
    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 0;
    const maxViewportDims = (gl.getParameter(gl.MAX_VIEWPORT_DIMS) || []).join('x');
    const maxRenderbufferSize = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) || 0;

    // Render a 3D gradient triangle
    const vShader = gl.createShader(gl.VERTEX_SHADER);
    if (!vShader) return 'vshader_err';
    gl.shaderSource(vShader, 'attribute vec2 p;void main(){gl_Position=vec4(p,0,1);}');
    gl.compileShader(vShader);

    const fShader = gl.createShader(gl.FRAGMENT_SHADER);
    if (!fShader) return 'fshader_err';
    gl.shaderSource(fShader, 'precision mediump float;void main(){gl_FragColor=vec4(0.8,0.3,0.1,1);}');
    gl.compileShader(fShader);

    const prog = gl.createProgram();
    if (!prog) return 'prog_err';
    gl.attachShader(prog, vShader);
    gl.attachShader(prog, fShader);
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 0, 1]), gl.STATIC_DRAW);

    const p = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(p);
    gl.vertexAttribPointer(p, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    const pixels = new Uint8Array(4 * 4 * 4);
    gl.readPixels(0, 0, 4, 4, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    const pixelSig = Array.from(pixels).slice(0, 16).join(',');

    return `${vendor}|${renderer}|${maxTextureSize}|${maxViewportDims}|${maxRenderbufferSize}|${pixelSig}`;
  } catch (e) {
    return 'webgl_err';
  }
}

/**
 * 3. Physical Hardware Metrics
 * Evaluates native screen dimensions, CPU cores, RAM, and touch points
 */
function getHardwareProfile(): string {
  if (typeof window === 'undefined') return 'ssr_hw';
  try {
    const screen = window.screen || ({} as any);
    const nav = window.navigator || ({} as any);
    const dpr = window.devicePixelRatio || 1;

    // Physical screen resolution in real hardware dots (independent of browser zoom)
    const physW = Math.round((screen.width || 0) * dpr);
    const physH = Math.round((screen.height || 0) * dpr);
    const colorDepth = screen.colorDepth || 24;

    const cores = nav.hardwareConcurrency || 0;
    const ram = (nav as any).deviceMemory || 0;
    const touch = nav.maxTouchPoints || 0;
    const platform = nav.platform || '';
    const tz = Intl?.DateTimeFormat?.().resolvedOptions?.().timeZone || '';

    return `${physW}x${physH}x${colorDepth}_dpr${dpr}_cpu${cores}_ram${ram}_touch${touch}_${platform}_${tz}`;
  } catch (e) {
    return 'hw_profile_err';
  }
}

// In-memory memoized cache to compute hardware hash only once per browser session
let cachedHardwareFp: string | null = null;
let cachedDetails: Record<string, any> | null = null;

/**
 * Computes and returns the stable 64-bit Hardware Canvas Fingerprint.
 * Returns a 16-character hex hash, e.g. "9a8b7c6d5e4f3a2b"
 */
export function getHardwareFingerprint(): string {
  if (cachedHardwareFp) {
    return cachedHardwareFp;
  }

  // Check persistent storage first (if available in normal mode)
  if (typeof localStorage !== 'undefined') {
    try {
      const stored = localStorage.getItem('menza_hw_canvas_fp');
      if (stored && /^[a-f0-9]{16}$/i.test(stored)) {
        cachedHardwareFp = stored;
        return stored;
      }
    } catch {}
  }

  // Compute fresh hardware entropy
  const canvas2dRaw = getCanvas2dFingerprint();
  const webglRaw = getWebGLFingerprint();
  const hwProfileRaw = getHardwareProfile();

  const canvas2dHash = hash64(canvas2dRaw);
  const webglHash = hash64(webglRaw);
  const hwProfileHash = hash64(hwProfileRaw);

  const combinedSignature = `2d:${canvas2dHash}|gl:${webglHash}|hw:${hwProfileHash}`;
  const finalHash = hash64(combinedSignature);

  cachedHardwareFp = finalHash;
  cachedDetails = {
    canvas2dHash,
    webglHash,
    hwProfileHash,
    combinedHash: finalHash,
  };

  // Cache in localStorage if available
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem('menza_hw_canvas_fp', finalHash);
    } catch {}
  }

  return finalHash;
}

/**
 * Returns a standardized hardware device ID formatted as:
 * "dev_hw_<16-hex-hash>"
 * This is persistent across Incognito mode, cache clearing, and tab reloads.
 */
export function getHardwareCanvasDeviceId(): string {
  const fp = getHardwareFingerprint();
  return `dev_hw_${fp}`;
}

/**
 * Returns diagnostic metadata for telemetry & anti-fraud auditing
 */
export function getHardwareFingerprintMetadata(): Record<string, any> {
  if (!cachedDetails) {
    getHardwareFingerprint();
  }
  return {
    ...cachedDetails,
    timestamp: Date.now(),
    devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
  };
}
