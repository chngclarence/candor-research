// ============================================================
//  Candor Research - Local SMART Proxy
//  Run this on your laptop while on Shopee WiFi / VPN
//  Command: npm start
// ============================================================
const http = require('http');
const https = require('https');
const os = require('os');


const PORT = Number.parseInt(process.env.PORT || '3333', 10);
const BIND_HOST = process.env.BIND_HOST || process.env.PROXY_HOST || '0.0.0.0';
const DEFAULT_SMART_URL = 'https://smart.shopee.io/apis/smart/v1/orchestrator/deployments/invoke';
const REQUEST_TIMEOUT_MS = Number.parseInt(process.env.REQUEST_TIMEOUT_MS || '30000', 10);
const MAX_BODY_BYTES = Number.parseInt(process.env.MAX_BODY_BYTES || String(2 * 1024 * 1024), 10);
const PROXY_TOKEN = process.env.PROXY_TOKEN || '';


// Whitelist of allowed SMART endpoints. Add new Candor apps here only after review.
const ENDPOINTS = {
  candor: process.env.CANDOR_SMART_URL || process.env.SMART_URL || DEFAULT_SMART_URL,
};


const smartEndpoints = {};
for (const [app, endpoint] of Object.entries(ENDPOINTS)) {
  try {
    smartEndpoints[app] = new URL(endpoint);
  } catch (err) {
    console.error(`Invalid SMART endpoint for ${app}: ${endpoint}`);
    console.error(err.message);
    process.exit(1);
  }
}


// Get local network IP for display
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'unknown';
}


function setCorsHeaders(res) {
  // Allow requests from GitHub Pages, localhost, and colleagues on the same network.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Proxy-Token');
}


function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}


function isAuthorized(req) {
  if (!PROXY_TOKEN) return true;

  const authHeader = req.headers.authorization || '';
  const proxyTokenHeader = req.headers['x-proxy-token'] || '';

  return authHeader === `Bearer ${PROXY_TOKEN}` || proxyTokenHeader === PROXY_TOKEN;
}


function getRequestApp(req) {
  const requestUrl = new URL(req.url, 'http://localhost');
  return requestUrl.searchParams.get('app') || 'candor';
}


function forwardToSmart(app, smartEndpoint, body, req, res) {
  const smartReq = https.request(smartEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': req.headers['content-type'] || 'application/json',
      'Content-Length': body.length,
    },
  }, smartRes => {
    const chunks = [];

    smartRes.on('data', chunk => chunks.push(chunk));
    smartRes.on('end', () => {
      const responseBody = Buffer.concat(chunks);
      const statusCode = smartRes.statusCode || 502;

      res.writeHead(statusCode, {
        'Content-Type': smartRes.headers['content-type'] || 'application/json',
      });
      res.end(responseBody);

      console.log(`[${new Date().toISOString()}] [${app}] SMART call -> ${statusCode} (${body.length} bytes from ${req.socket.remoteAddress})`);
    });
  });

  smartReq.setTimeout(REQUEST_TIMEOUT_MS, () => {
    smartReq.destroy(new Error(`SMART request timed out after ${REQUEST_TIMEOUT_MS}ms`));
  });

  smartReq.on('error', err => {
    console.error(`[${new Date().toISOString()}] [${app}] SMART error: ${err.message}`);

    if (!res.writableEnded) {
      sendJson(res, 502, { error: err.message });
    }
  });

  smartReq.write(body);
  smartReq.end();
}


const server = http.createServer((req, res) => {
  setCorsHeaders(res);

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    sendJson(res, 200, {
      ok: true,
      service: 'candor-smart-proxy',
      uptimeSeconds: Math.round(process.uptime()),
      localIP: getLocalIP(),
      port: PORT,
      networkUrl: `http://${getLocalIP()}:${PORT}`,
      allowedApps: Object.keys(smartEndpoints),
    });
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 404, { error: 'Not found' });
    return;
  }

  if (!isAuthorized(req)) {
    sendJson(res, 401, { error: 'Unauthorized' });
    return;
  }

  const app = getRequestApp(req);
  const smartEndpoint = smartEndpoints[app];
  if (!smartEndpoint) {
    sendJson(res, 400, {
      error: `Unknown app: "${app}"`,
      allowedApps: Object.keys(smartEndpoints),
    });
    return;
  }

  // Collect request body
  const chunks = [];
  let bytes = 0;

  req.on('data', chunk => {
    bytes += chunk.length;

    if (bytes > MAX_BODY_BYTES) {
      sendJson(res, 413, { error: `Request body exceeds ${MAX_BODY_BYTES} bytes` });
      req.destroy();
      return;
    }

    chunks.push(chunk);
  });

  req.on('end', () => {
    if (res.writableEnded) return;

    forwardToSmart(app, smartEndpoint, Buffer.concat(chunks), req, res);
  });

  req.on('error', err => {
    if (!res.writableEnded) {
      sendJson(res, 400, { error: err.message });
    }
  });
});


// Bind to 0.0.0.0 so colleagues on the same WiFi can reach this proxy
server.listen(PORT, BIND_HOST, () => {
  const localIP = getLocalIP();
  console.log(`
╔═══════════════════════════════════════════════════╗
║   Candor Research - SMART Proxy                   ║
║                                                   ║
║   Local:    http://localhost:${PORT}                  ║
║   Network:  http://${localIP}:${PORT}          ║
║   Health:   http://localhost:${PORT}/health          ║
║                                                   ║
║   Managed by launchd when installed              ║
║   Must be on Shopee WiFi / VPN                   ║
║   Allowed apps: ${Object.keys(smartEndpoints).join(', ')}                    ║
║                                                   ║
║   Share the Network URL with colleagues           ║
║   (they must be on the same WiFi)                 ║
╚═══════════════════════════════════════════════════╝
  `);
});


server.on('error', err => {
  console.error(`[${new Date().toISOString()}] Server error: ${err.message}`);
  process.exit(1);
});


function shutdown(signal) {
  console.log(`[${new Date().toISOString()}] ${signal} received; shutting down.`);

  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}


process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
