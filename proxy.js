// ============================================================
//  Candor Research — Local SMART Proxy
//  Run this on your laptop while on Shopee WiFi
//  Command: node proxy.js
// ============================================================
const http = require('http');
const https = require('https');
const os = require('os');

const PORT = 3333;

// Whitelist of allowed SMART endpoints — add new apps here
const ENDPOINTS = {
  candor: 'https://smart.shopee.io/apis/smart/v1/orchestrator/deployments/invoke',
};

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

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  // Resolve app from query string e.g. POST /?app=candor
  const app = new URL(req.url, `http://localhost`).searchParams.get('app') || 'candor';
  const targetUrl = ENDPOINTS[app];

  if (!targetUrl) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `Unknown app: "${app}". Allowed: ${Object.keys(ENDPOINTS).join(', ')}` }));
    return;
  }

  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    const target = new URL(targetUrl);
    const smartReq = https.request(target, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, smartRes => {
      let response = '';
      smartRes.on('data', chunk => response += chunk);
      smartRes.on('end', () => {
        res.writeHead(smartRes.statusCode, { 'Content-Type': 'application/json' });
        res.end(response);
        console.log(`[${new Date().toLocaleTimeString()}] [${app}] SMART call → ${smartRes.statusCode} (from ${req.socket.remoteAddress})`);
      });
    });

    smartReq.on('error', err => {
      console.error(`[${app}] SMART error:`, err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    });

    smartReq.write(body);
    smartReq.end();
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const localIP = getLocalIP();
  console.log(`
╔═══════════════════════════════════════════════════╗
║   Candor Research — SMART Proxy                   ║
║                                                   ║
║   Local:    http://localhost:${PORT}                  ║
║   Network:  http://${localIP}:${PORT}          ║
║                                                   ║
║   Allowed apps: ${Object.keys(ENDPOINTS).join(', ')}                    ║
║                                                   ║
║   Keep this terminal open during sessions         ║
║   Must be on Shopee WiFi / VPN                    ║
╚═══════════════════════════════════════════════════╝
  `);
});
