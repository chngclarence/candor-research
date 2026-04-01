// ============================================================
//  Candor Research — Database Layer (Supabase)
// ============================================================

const DB = (() => {
  const headers = () => ({
    'Content-Type': 'application/json',
    'apikey': CONFIG.SUPABASE_KEY,
    'Authorization': `Bearer ${CONFIG.SUPABASE_KEY}`,
    'Prefer': 'return=representation',
  });

  const url = (table, query = '') =>
    `${CONFIG.SUPABASE_URL}/rest/v1/${table}${query}`;

  async function request(method, table, query = '', body = null) {
    const opts = { method, headers: headers() };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(url(table, query), opts);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `DB error ${res.status}`);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : [];
  }

  // ── PIN ──────────────────────────────────────────────────
  async function generatePin() {
    const existing = await request('GET', 'sessions', '?select=pin');
    const pins = existing.map(r => r.pin);
    let pin, attempts = 0;
    do {
      pin = String(Math.floor(100000 + Math.random() * 900000));
      if (++attempts > 200) throw new Error('PIN generation failed');
    } while (pins.includes(pin));
    return pin;
  }

  // ── Sessions ─────────────────────────────────────────────
  async function getSessions(filter = 'mine', userEmail = '') {
    const rows = await request('GET', 'sessions', '?select=*,participants(count)&order=created_at.desc');
    return rows.map(s => {
      const isOwner = s.created_by === userEmail;
      const isCoAdmin = (s.co_admins || []).includes(userEmail);
      return {
        ...s,
        is_owner: isOwner,
        is_co_admin: isCoAdmin,
        can_view: isOwner || isCoAdmin || filter === 'all',
      };
    }).filter(s => s.can_view);
  }

  async function getSession(pin) {
    const rows = await request('GET', 'sessions', `?pin=eq.${pin}&select=*`);
    if (!rows.length) throw new Error('Session not found');
    return rows[0];
  }

  async function createSession(data) {
    const pin = await generatePin();
    const totalQ = Math.round((parseInt(data.duration_mins || 7) / 7) * 8) + 2;
    const row = {
      pin,
      product: data.product,
      goal: data.goal,
      persona: data.persona || '',
      duration_mins: parseInt(data.duration_mins || 7),
      focus: data.focus || [],
      total_questions: totalQ,
      language: data.language || 'English',
      status: 'active',
      file_ids: data.file_ids || [],
      custom_questions: data.custom_questions || '',
      context_url: data.context_url || '',
      interview_prompt: data.interview_prompt || '',
      created_by: data.created_by || '',
      co_admins: [],
    };
    const result = await request('POST', 'sessions', '', row);
    return Array.isArray(result) ? result[0] : result;
  }

  async function updateSession(pin, updates) {
    return request('PATCH', 'sessions', `?pin=eq.${pin}`, updates);
  }

  async function deleteSession(pin) {
    return request('DELETE', 'sessions', `?pin=eq.${pin}`);
  }

  async function addCoAdmin(pin, email) {
    const session = await getSession(pin);
    const coAdmins = [...(session.co_admins || [])];
    if (coAdmins.includes(email)) throw new Error('Already a co-admin');
    coAdmins.push(email);
    await updateSession(pin, { co_admins: coAdmins });
    return coAdmins;
  }

  async function removeCoAdmin(pin, email) {
    const session = await getSession(pin);
    const coAdmins = (session.co_admins || []).filter(e => e !== email);
    await updateSession(pin, { co_admins: coAdmins });
    return coAdmins;
  }

  // ── Participants ──────────────────────────────────────────
  async function validatePin(pin) {
    try {
      const session = await getSession(pin);
      if (session.status !== 'active') return { valid: false, error: 'This session is not currently active.' };
      return { valid: true, session };
    } catch(e) {
      return { valid: false, error: 'Invalid PIN. Please check your invite.' };
    }
  }

  async function startParticipant(pin, name, role, language) {
    return request('POST', 'participants', '', {
      pin, name, role, language,
      started_at: new Date().toISOString(),
      status: 'started',
      transcript: [],
    });
  }

  async function saveTranscript(pin, name, transcript) {
    // Find the started participant record
    const rows = await request('GET', 'participants',
      `?pin=eq.${pin}&name=eq.${encodeURIComponent(name)}&status=eq.started&order=started_at.desc&limit=1`);
    if (!rows.length) throw new Error('Participant record not found');
    const id = rows[0].id;

    // Update transcript and mark completed
    await request('PATCH', 'participants', `?id=eq.${id}`, {
      transcript,
      status: 'completed',
      completed_at: new Date().toISOString(),
    });

    // Increment response count on session
    const session = await getSession(pin);
    await updateSession(pin, { response_count: (session.response_count || 0) + 1 });
  }

  async function getTranscripts(pin) {
    return request('GET', 'participants',
      `?pin=eq.${pin}&status=eq.completed&select=*&order=completed_at.desc`);
  }

  // ── File Upload (Supabase Storage) ────────────────────────
  async function uploadFile(base64, mimeType, filename) {
    // Convert base64 to blob
    const byteChars = atob(base64);
    const byteArr = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
    const blob = new Blob([byteArr], { type: mimeType });

    const safeName = `${Date.now()}_${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const uploadUrl = `${CONFIG.SUPABASE_URL}/storage/v1/object/candor-files/${safeName}`;

    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'apikey': CONFIG.SUPABASE_KEY,
        'Authorization': `Bearer ${CONFIG.SUPABASE_KEY}`,
        'Content-Type': mimeType,
      },
      body: blob,
    });

    if (!res.ok) throw new Error('Upload failed');
    return {
      fileId: safeName,
      viewUrl: `${CONFIG.SUPABASE_URL}/storage/v1/object/public/candor-files/${safeName}`,
    };
  }

  // ── Summary ───────────────────────────────────────────────
  async function saveSummary(pin, summary) {
    await updateSession(pin, { summary });
  }

  async function exportSession(pin) {
    const session = await getSession(pin);
    const transcripts = await getTranscripts(pin);
    const lines = [
      `# Candor Research Export`,
      `**Product:** ${session.product}`,
      `**Goal:** ${session.goal}`,
      `**PIN:** ${session.pin}`,
      `**Created by:** ${session.created_by}`,
      `**Date:** ${new Date(session.created_at).toLocaleDateString('en-SG')}`,
      `**Responses:** ${transcripts.length}`,
      `---`,
    ];
    if (session.summary) lines.push(`# AI Summary\n${session.summary}\n---`);
    lines.push(`# Transcripts`);
    transcripts.forEach(t => {
      lines.push(`## ${t.name} — ${t.role} (${t.language})`);
      lines.push(`*${new Date(t.completed_at).toLocaleString('en-SG')}*`);
      (t.transcript || []).forEach(m => {
        if (typeof m.content === 'string')
          lines.push(`**${m.role === 'assistant' ? 'AI' : t.name}:** ${m.content}`);
      });
      lines.push('---');
    });
    return { content: lines.join('\n\n'), filename: `candor_${pin}_export.md` };
  }

  return {
    getSessions, getSession, createSession, updateSession, deleteSession,
    addCoAdmin, removeCoAdmin, validatePin, startParticipant, saveTranscript,
    getTranscripts, uploadFile, saveSummary, exportSession, generatePin,
  };
})();
