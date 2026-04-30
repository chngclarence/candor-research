// ============================================================
//  Candor Research — Local SMART Proxy
//  Run this on your laptop while on Shopee WiFi
//  Command: node proxy.js
// ============================================================
const http = require('http');
const https = require('https');
const os = require('os');

const PORT = 3333;
const SMART_URL = 'https://smart.shopee.io/apis/smart/v1/orchestrator/deployments/invoke';

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

const server = http.createServer((req, res) => {
  // Allow requests from any origin (GitHub Pages, localhost, colleagues on same network)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
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

  // Collect request body
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    // Forward to SMART
    const smartReq = https.request(SMART_URL, {
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
        console.log(`[${new Date().toLocaleTimeString()}] SMART call → ${smartRes.statusCode} (from ${req.socket.remoteAddress})`);
      });
    });

    smartReq.on('error', err => {
      console.error('SMART error:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    });

    smartReq.write(body);
    smartReq.end();
  });
});

// Bind to 0.0.0.0 so colleagues on the same WiFi can reach this proxy
server.listen(PORT, '0.0.0.0', () => {
  const localIP = getLocalIP();
  console.log(`
╔═══════════════════════════════════════════════════╗
║   Candor Research — SMART Proxy                   ║
║                                                   ║
║   Local:    http://localhost:${PORT}                  ║
║   Network:  http://${localIP}:${PORT}          ║
║                                                   ║
║   Keep this terminal open during sessions         ║
║   Must be on Shopee WiFi / VPN                    ║
║                                                   ║
║   Share the Network URL with colleagues           ║
║   (they must be on the same WiFi)                 ║
╚═══════════════════════════════════════════════════╝
  `);
});
