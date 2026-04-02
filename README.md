# Candor Research 🦦

AI-powered research interview tool — hosted on GitHub Pages, powered by SMART and Supabase.

## Live URLs
- **Admin portal:** https://chngclarence.github.io/candor-research/
- **Participant page:** https://chngclarence.github.io/candor-research/interview.html?pin=XXXXXX

---

## Architecture
- **Frontend:** GitHub Pages (static HTML/CSS/JS) — public
- **Database:** Supabase (PostgreSQL) — cloud
- **File storage:** Supabase Storage (`candor-files` bucket) — public
- **AI:** SMART agent at smart.shopee.io — **Shopee internal network only**
- **Auth:** Supabase Google OAuth — restricted to @shopee.com and @spxexpress.com

---

## Files
| File | Purpose |
|---|---|
| `index.html` | Admin portal — create sessions, view transcripts, generate summaries |
| `interview.html` | Participant interview page |
| `config.js` | Credentials — **gitignored, never commit secrets** |
| `auth.js` | Google OAuth layer |
| `db.js` | Supabase data layer |
| `smart.js` | SMART AI API calls |
| `proxy.js` | Local CORS proxy — bridges GitHub Pages → SMART |
| `supabase_schema.sql` | Initial database schema |
| `supabase_migration.sql` | Round 1 schema migration |
| `supabase_migration_r2.sql` | Round 2 schema migration |

---

## First-Time Setup

### 1. Supabase
1. Create a project at [supabase.com](https://supabase.com)
2. SQL Editor → paste `supabase_schema.sql` → Run
3. SQL Editor → paste `supabase_migration.sql` → Run
4. SQL Editor → paste `supabase_migration_r2.sql` → Run
5. Storage → create bucket named `candor-files` → set to **Public**
6. Storage → Policies → add INSERT policy allowing `anon` and `authenticated` roles

### 2. Config
Edit `config.js` with your credentials:
```javascript
const CONFIG = {
  SUPABASE_URL: 'https://your-project.supabase.co',
  SUPABASE_KEY: 'your-publishable-key',
  SMART_URL: 'http://localhost:3333',   // update to laptop IP for demo
  SMART_HASH_ID: 'your-hash-id',
  SMART_KEY: 'your-smart-key',
  BASE_URL: 'https://chngclarence.github.io/candor-research',
};
```

### 3. Deploy to GitHub Pages
1. Push all files to GitHub (**do not push** `config.js` with real credentials)
2. Repo Settings → Pages → Source: **Deploy from branch** → Branch: **main** → Save
3. Add `config.js` via GitHub UI (Add file → Create new file) with real credentials
4. Pages rebuilds in ~2 minutes

---

## Demo Setup (Multi-User on Shopee WiFi)

> The SMART agent is on Shopee internal network. GitHub Pages cannot reach it directly.
> A local proxy on your laptop bridges the gap.

### Before the demo
1. Connect your laptop to **Shopee office WiFi**
2. Find your laptop's local IP:
   ```bash
   ipconfig getifaddr en0
   # e.g. 192.168.1.42
   ```
3. Edit `config.js` — change `SMART_URL`:
   ```javascript
   SMART_URL: 'http://192.168.1.42:3333',
   ```
4. Update `config.js` in GitHub so all participant devices get the right proxy URL
5. Start the proxy:
   ```bash
   node proxy.js
   ```
6. Verify the SMART status pill shows green in the admin portal

### During the demo
- All participant devices must be on the **same Shopee WiFi network**
- Admin portal: open on your laptop (or any device on same network)
- Participants: open their invite link on their own devices
- Their AI requests route → your laptop IP → proxy → SMART ✓

### After the demo
```bash
Ctrl + C   # stop proxy immediately
```
Revert `SMART_URL` back to `http://localhost:3333` in `config.js` and push to GitHub.

---

## Security & Risks

| Risk | Level | Notes |
|---|---|---|
| SMART credentials in public GitHub | Low | SMART requires Shopee network — credentials useless externally |
| Supabase publishable key exposed | Very Low | Designed to be public — RLS policies are the real guard |
| Laptop IP hardcoded in config.js | Medium | Manage manually — never leave real IP committed after demo |
| Proxy has no authentication | Low | Anyone on same WiFi could call it — acceptable for internal demo |
| Participant data in Supabase | Low | Internal staff only — confirm data residency for sensitive research |

**Key rules:**
- Stop proxy immediately after every demo (`Ctrl+C`)
- Never leave a real laptop IP committed to GitHub
- Regenerate SMART keys periodically from the Integration tab

---

## SMART Agent Configuration

Agent: **Clarence Claude** at smart.shopee.io

System prompt:
```
You are an expert AI assistant that can take on different roles
depending on the task given to you in each message.

Your primary uses:
1. Research Interviewer — conducting warm, structured interviews
   one question at a time
2. Research Designer — reviewing research materials and asking
   clarifying questions
3. Research Analyst — synthesising interview transcripts into
   structured summaries

In every message you receive, the full context and instructions
for your current role will be provided. Follow those instructions
precisely.

For language: respond in the language specified in the instructions.
If the participant writes in a different language, continue naturally
in the instructed language without commenting on it.
```

---

## Easter Eggs
- Click the **Candor logo 5 times rapidly** → Snake game 🐍
- Publish a session → confetti + Candor the Otter 🦦
- Dashboard milestone celebration on every 5th response ⭐

---

## Pending Enhancements
| # | Feature | Notes |
|---|---|---|
| 20 | Voice chat (STT + TTS) | Web Speech API — nice to have |
| 27 | Summary version history | Track regenerations over time |
| 41 | Participant email / anonymity toggle | Optional email capture |
