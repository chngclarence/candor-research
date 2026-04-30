// ============================================================
//  Candor Research — Config Template
//  Copy this file to config.js and fill in your values.
//  config.js is gitignored — never commit it.
// ============================================================

const CONFIG = {
  // Supabase
  SUPABASE_URL:     'https://your-project.supabase.co',
  SUPABASE_KEY:     'your-anon-key',

  // Google OAuth
  GOOGLE_CLIENT_ID: 'your-google-oauth-client-id',

  // SMART Agent — routes through local proxy to bypass CORS
  // Set SMART_URL to your ngrok URL when running proxy.js
  SMART_URL:        'http://10.22.74.15:3333',  // dedicated proxy laptop (candor-smart-proxy)
  SMART_HASH_ID:    'your-smart-hash-id',
  SMART_KEY:        'your-smart-key',

  // App
  BASE_URL:         'https://chngclarence.github.io/candor-research',
  ALLOWED_DOMAINS:  ['shopee.com', 'spxexpress.com'],
};
