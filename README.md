# Candor Research

AI-powered UX research interview tool — hosted on GitHub Pages, powered by SMART and Supabase.

## Live URLs
- **Admin portal:** https://chngclarence.github.io/candor-research/
- **Participant page:** https://chngclarence.github.io/candor-research/interview.html

## Requirements
- Must be on **Shopee WiFi or VPN** to use AI features (SMART agent is internal)
- Supabase account for data storage

## Setup

### 1. Supabase
1. Create a project at [supabase.com](https://supabase.com)
2. Go to SQL Editor → paste contents of `supabase_schema.sql` → Run
3. Go to Storage → create a bucket named `candor-files` → set to **Public**

### 2. Config
1. Copy `config.js` to your local folder (it is gitignored)
2. Fill in your credentials:
   - `SUPABASE_URL` and `SUPABASE_KEY` from Supabase Settings → API Keys
   - `SMART_URL`, `SMART_HASH_ID`, `SMART_KEY` from smart.shopee.io Integration tab

### 3. Deploy
1. Push all files to GitHub (except `config.js`)
2. Go to repo Settings → Pages → Source: **Deploy from branch** → Branch: **main** → Save
3. Upload `config.js` manually via GitHub UI (Add file → Create new file)

## Architecture
- **Frontend:** GitHub Pages (static HTML/CSS/JS)
- **Database:** Supabase (PostgreSQL)
- **File storage:** Supabase Storage
- **AI:** SMART agent at smart.shopee.io (requires Shopee network)

## Files
| File | Purpose |
|---|---|
| `index.html` | Admin portal |
| `interview.html` | Participant interview page |
| `config.js` | Credentials (gitignored) |
| `db.js` | Supabase database layer |
| `smart.js` | SMART AI API calls |
| `supabase_schema.sql` | Database table setup |
