# Candor Research

> AI that conducts async 1:1 interviews with your users.

Set up in minutes, share a PIN link, AI handles the rest. Adapts follow-up questions dynamically based on each response. Synthesises findings into a summary, ready to export and share.

---

## Live URLs
- **Admin portal:** https://chngclarence.github.io/candor-research/
- **Participant page:** https://chngclarence.github.io/candor-research/interview.html?pin=XXXXXX

---

## What it is

Candor Research is an internal AI-powered user research tool built for Shopee. It lets anyone — product, ops, strategy, HR — run structured research conversations with the people who matter, without scheduling calls, taking notes, or doing manual synthesis.

**Who it's for:**
- **Product** — testing features with users before or after shipping
- **Ops** — understanding why a process isn't being followed, or what's making a workflow harder than it should be
- **Strategy** — sensing where pain is accumulating across markets before it shows up in data
- **HR / People** — running structured listening sessions without holding 30 individual calls

---

## How it works

1. **Admin creates a session** — defines the research topic, goal, duration, language, participant roles, and optionally uploads materials (screenshots, mockups, PDFs)
2. **AI reviews the setup** — asks clarifying questions to sharpen the interview design
3. **Admin publishes** — gets a 6-digit PIN and shareable link
4. **Participants join** — open the link, enter their details and PIN, no app or account needed
5. **AI conducts the interview** — one question at a time, adapting follow-up questions dynamically based on each response. Takes 7–10 minutes
6. **Admin reviews findings** — transcripts appear in real time. One click generates an AI summary across all responses

---

## File structure

```
candor-research/
├── index.html        # Admin portal — create sessions, view transcripts, generate summaries
├── interview.html    # Participant interview page
├── auth.js           # Google OAuth layer
├── db.js             # Supabase database layer (sessions, participants, transcripts, scores)
├── smart.js          # SMART AI API calls
├── config.js         # Configuration — Supabase keys, SMART credentials, base URL (gitignored)
├── config.example.js # Config template — copy this to config.js and fill in values
├── proxy.js          # Local SMART proxy server (not committed — create locally)
├── supabase_schema.sql
└── README.md
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML/CSS/JS — no framework |
| Database | Supabase (Postgres + Storage) |
| AI / LLM | Shopee SMART platform (Claude-based) |
| Auth | Google OAuth via Supabase |
| File storage | Supabase Storage (`candor-files` — private, `candor-public` — public) |
| Hosting | GitHub Pages |
| Proxy | Node.js local server + ngrok |

---

## Architecture

```
Participant browser
       ↓
interview.html (GitHub Pages)
       ↓
proxy.js (Node.js on dedicated laptop, exposed via ngrok)
       ↓
Shopee SMART API (smart.shopee.io) — requires Shopee WiFi / VPN
       ↓
LLM response back to participant
```

File uploads and session data go directly to Supabase — no proxy needed for those.

---

## Local setup

### Prerequisites
- Node.js (v18+)
- A machine connected to Shopee WiFi or VPN (for SMART calls)
- ngrok account (free tier sufficient)
- Supabase project with the schema below

### 1. Clone the repo
```bash
git clone https://github.com/chngclarence/candor-research.git
cd candor-research
```

### 2. Create config.js
Copy `config.example.js` to `config.js` and fill in your values:
```javascript
const CONFIG = {
  SUPABASE_URL:    'https://your-project.supabase.co',
  SUPABASE_KEY:    'your-anon-key',
  GOOGLE_CLIENT_ID: 'your-google-oauth-client-id',
  SMART_URL:       'https://your-ngrok-url',
  SMART_HASH_ID:   'your-smart-hash-id',
  SMART_KEY:       'your-smart-key',
  BASE_URL:        'https://chngclarence.github.io/candor-research',
  ALLOWED_DOMAINS: ['shopee.com', 'spxexpress.com'],
};
```

`config.js` is gitignored — never commit it.

### 3. Run the proxy
```bash
node proxy.js
```

In a second terminal tab:
```bash
ngrok http 3333
```

Copy the `https://xxx.ngrok-free.app` URL and paste it into `config.js` as `SMART_URL`.

### 4. Keep it running permanently (dedicated proxy laptop)
```bash
npm install -g pm2
pm2 start proxy.js
pm2 start "ngrok http 3333" --name candor-ngrok
pm2 save
pm2 startup  # follow the printed command to auto-start on reboot
```

---

## Supabase schema

```sql
-- Sessions
CREATE TABLE sessions (
  pin text PRIMARY KEY,
  product text,
  goal text,
  persona text,
  duration_mins integer DEFAULT 7,
  focus text[],
  total_questions integer,
  language text DEFAULT 'English',
  status text DEFAULT 'active',
  file_ids text[],
  custom_questions text,
  context_url text,
  interview_prompt text,
  created_by text,
  co_admins text[],
  roles text[],
  interviewer_name text DEFAULT 'Candor',
  require_email boolean DEFAULT false,
  response_count integer DEFAULT 0,
  summary text,
  summary_generated_at timestamptz,
  summary_response_count integer,
  created_at timestamptz DEFAULT now()
);

-- Participants
CREATE TABLE participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pin text REFERENCES sessions(pin),
  name text,
  email text,
  role text,
  language text,
  market text,
  transcript jsonb,
  status text DEFAULT 'started',
  experience_rating integer,
  experience_comment text,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Snake leaderboard
CREATE TABLE snake_scores (
  email text PRIMARY KEY,
  score integer NOT NULL,
  achieved_at timestamptz DEFAULT now()
);
```

---

## Supabase storage buckets

| Bucket | Visibility | Purpose |
|---|---|---|
| `candor-files` | **Private** | User-uploaded materials (images, PDFs). Accessed via signed URLs (1hr expiry) |
| `candor-public` | **Public** | Static assets — mascot images |

Mascot images live at:
`candor-public/mascot/mascot-happy.png`
`candor-public/mascot/mascot-clipboard.png`
`candor-public/mascot/mascot-surprised.png`

---

## Key features

- **7 languages** — English, Bahasa Indonesia, Vietnamese, Thai, Filipino, Brazilian Portuguese, Mandarin
- **Materials panel** — images zoom on click, PDFs render via Google Docs Viewer
- **Voice input** — push-to-talk with live transcript, auto-sends on stop
- **TTS** — AI reads questions aloud, female voice priority (Samantha → Karen → Google UK English Female), mute toggle
- **Replay button** — hover any AI message to replay it
- **Anonymous mode** — participants can opt out of name recording
- **Email collection** — optional per-session toggle
- **Focus areas** — Sentiment, Pain Points, Workflows, Motivations, Clarity, Trust, Unmet Needs, Decision Making
- **AI summary** — synthesises all transcripts into structured findings
- **Export** — full session export as `.md`
- **Snake game** — hidden easter egg (click the otter logo), org leaderboard top 20

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

## Deployment

The frontend is served via **GitHub Pages** — push to `main` and it's live.

```bash
git add .
git commit -m "your message"
git push
```

The proxy runs separately on a dedicated laptop — not deployed to GitHub Pages.

---

## Security notes

- `candor-files` bucket is **private** — all participant-uploaded files are served via signed URLs with 1-hour expiry
- `config.js` is gitignored — never commit API keys
- The SMART proxy only forwards POST requests — no other routes exposed
- ngrok provides HTTPS termination — no mixed content browser warnings
- Participant interviews are PIN-gated — sessions must be active to accept responses
- Stop proxy immediately after every session (`Ctrl+C` or `pm2 stop all`)
- Regenerate SMART keys periodically from the Integration tab

---

## Planned features (backlog)

- Session permissions system (Owner / Editor / Viewer roles, Share modal)
- Supabase Edge Function to replace laptop-based proxy (removes ngrok dependency)
- HTML file upload support with sandboxed preview
- Org-wide session sharing
- Snake leaderboard scoped to org email domains

---

## Maintainer

Clarence Chng — Shopee
`clarence.chngkh@shopee.com`
