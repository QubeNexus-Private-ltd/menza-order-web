/**
 * Vercel Serverless Function: Production Log Ingestion for MenzaOrder
 * Endpoint: POST /api/log
 *
 * Receives structured client logs, errors, exceptions, and diagnostics
 * from customer ordering sessions and emits structured JSON to Vercel
 * runtime stdout/stderr for display in Vercel Logs & Log Drains (Axiom, Datadog, etc.).
 */
export default async function handler(req, res) {
  // CORS & Options preflight support
  if (req.method === 'OPTIONS') {
    if (res && typeof res.setHeader === 'function') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      return res.status(204).end();
    }
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  // Handle Node.js runtime (req, res)
  if (res && typeof res.status === 'function') {
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      let body = req.body;
      if (typeof Buffer !== 'undefined' && Buffer.isBuffer(body)) {
        try {
          body = JSON.parse(body.toString('utf-8'));
        } catch {
          body = {};
        }
      } else if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch {
          body = {};
        }
      } else if (!body) {
        body = {};
      }

      const {
        level = 'INFO',
        category = 'ORDER_WEB',
        event = 'CLIENT_EVENT',
        message = 'No message provided',
        sessionId = 'unknown_session',
        restaurantId,
        restaurantName,
        tableId,
        tableName,
        orderId,
        customerPhone,
        metadata,
        errorName,
        errorMessage,
        errorStack,
        screen,
        url,
        clientTimestamp,
        durationMs,
        apiEndpoint,
        httpMethod,
        statusCode,
      } = body;

      const structuredLog = {
        timestamp: new Date().toISOString(),
        service: 'menza-order-web',
        environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'production',
        vercelRegion: process.env.VERCEL_REGION || 'local',
        clientReported: true,
        sessionId,
        level,
        category,
        event,
        message,
        restaurant: {
          id: restaurantId || null,
          name: restaurantName || null,
        },
        table: {
          id: tableId || null,
          name: tableName || null,
        },
        order: {
          id: orderId || null,
        },
        customer: {
          phone: customerPhone || null,
        },
        metadata: metadata || undefined,
        api: apiEndpoint
          ? {
              endpoint: apiEndpoint,
              method: httpMethod,
              statusCode,
              durationMs,
            }
          : undefined,
        error:
          errorName || errorMessage || errorStack
            ? {
                name: errorName,
                message: errorMessage,
                stack: errorStack,
              }
            : undefined,
        context: {
          screen,
          url,
          clientTimestamp,
          clientIp: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown',
          userAgent: req.headers['user-agent'] || 'unknown',
        },
      };

      const serialized = JSON.stringify(structuredLog);
      const restLabel = restaurantName ? `${restaurantName} (#${restaurantId})` : (restaurantId ? `#${restaurantId}` : 'N/A');
      const tableLabel = tableName ? `${tableName}` : (tableId ? `#${tableId}` : 'N/A');
      const summary = `⚡ [${level}] [${category}:${event}] ${message} | Session: ${sessionId} | Rest: ${restLabel} | Table: ${tableLabel}`;

      if (level === 'ERROR') {
        console.error(`${summary}\n${serialized}`);
      } else if (level === 'WARN') {
        console.warn(`${summary}\n${serialized}`);
      } else {
        console.log(`${summary}\n${serialized}`);
      }

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          service: 'menza-order-web',
          level: 'ERROR',
          category: 'LOG_INGESTION',
          event: 'INGESTION_FAILURE',
          message: err?.message || 'Failed to process incoming client log',
        })
      );
      return res.status(400).json({ success: false, error: 'Invalid log payload' });
    }
  }

  // Handle Edge / Web Fetch API runtime (req: Request)
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  try {
    const rawText = await req.text().catch(() => '');
    let body = {};
    try {
      body = rawText ? JSON.parse(rawText) : {};
    } catch {
      body = {};
    }

    const {
      level = 'INFO',
      category = 'ORDER_WEB',
      event = 'CLIENT_EVENT',
      message = 'No message provided',
      sessionId = 'unknown_session',
      restaurantId,
      restaurantName,
      tableId,
      tableName,
      orderId,
      customerPhone,
      metadata,
      errorName,
      errorMessage,
      errorStack,
      screen,
      url,
      clientTimestamp,
      durationMs,
      apiEndpoint,
      httpMethod,
      statusCode,
    } = body;

    const structuredLog = {
      timestamp: new Date().toISOString(),
      service: 'menza-order-web',
      environment: process.env.VERCEL_ENV || 'production',
      vercelRegion: process.env.VERCEL_REGION || 'local',
      clientReported: true,
      sessionId,
      level,
      category,
      event,
      message,
      restaurant: {
        id: restaurantId || null,
        name: restaurantName || null,
      },
      table: {
        id: tableId || null,
        name: tableName || null,
      },
      order: {
        id: orderId || null,
      },
      customer: {
        phone: customerPhone || null,
      },
      metadata: metadata || undefined,
      api: apiEndpoint
        ? {
            endpoint: apiEndpoint,
            method: httpMethod,
            statusCode,
            durationMs,
          }
        : undefined,
      error:
        errorName || errorMessage || errorStack
          ? {
              name: errorName,
              message: errorMessage,
              stack: errorStack,
            }
          : undefined,
      context: {
        screen,
        url,
        clientTimestamp,
        clientIp: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
        userAgent: req.headers.get('user-agent') || 'unknown',
      },
    };

    const serialized = JSON.stringify(structuredLog);
    const restLabel = restaurantName ? `${restaurantName} (#${restaurantId})` : (restaurantId ? `#${restaurantId}` : 'N/A');
    const tableLabel = tableName ? `${tableName}` : (tableId ? `#${tableId}` : 'N/A');
    const summary = `⚡ [${level}] [${category}:${event}] ${message} | Session: ${sessionId} | Rest: ${restLabel} | Table: ${tableLabel}`;

    if (level === 'ERROR') {
      console.error(`${summary}\n${serialized}`);
    } else if (level === 'WARN') {
      console.warn(`${summary}\n${serialized}`);
    } else {
      console.log(`${summary}\n${serialized}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        service: 'menza-order-web',
        level: 'ERROR',
        category: 'LOG_INGESTION',
        event: 'INGESTION_FAILURE',
        message: err?.message || 'Failed to process incoming client log',
      })
    );
    return new Response(JSON.stringify({ success: false, error: 'Invalid log payload' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}
