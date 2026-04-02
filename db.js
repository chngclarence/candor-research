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

  async function createSession(data, asDraft = false) {
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
      // Issue 35: draft support
      status: asDraft ? 'draft' : 'active',
      file_ids: data.file_ids || [],
      custom_questions: data.custom_questions || '',
      context_url: data.context_url || '',
      interview_prompt: data.interview_prompt || '',
      created_by: data.created_by || '',
      co_admins: [],
      roles: data.roles || [],
      // Issue 52: interviewer name
      interviewer_name: data.interviewer_name || 'Candor',
      // Issue 41-revised: require email from participants
      require_email: data.require_email || false,
    };
    const result = await request('POST', 'sessions', '', row);
    return Array.isArray(result) ? result[0] : result;
  }

  // Issue 38: full session update for editing
  async function updateSession(pin, updates) {
    return request('PATCH', 'sessions', `?pin=eq.${pin}`, updates);
  }

  // Issue 35: save draft without PIN generation — reuse createSession with asDraft=true
  async function saveDraft(data) {
    return createSession(data, true);
  }

  // Issue 38: update existing session fields
  async function editSession(pin, data) {
    const totalQ = Math.round((parseInt(data.duration_mins || 7) / 7) * 8) + 2;
    const updates = {
      product: data.product,
      goal: data.goal,
      persona: data.persona || '',
      duration_mins: parseInt(data.duration_mins || 7),
      focus: data.focus || [],
      total_questions: totalQ,
      language: data.language || 'English',
      custom_questions: data.custom_questions || '',
      context_url: data.context_url || '',
      interview_prompt: data.interview_prompt || '',
      roles: data.roles || [],
      interviewer_name: data.interviewer_name || 'Candor',
    };
    if (data.require_email !== undefined) updates.require_email = data.require_email;
    if (data.file_ids !== undefined) updates.file_ids = data.file_ids;
    return updateSession(pin, updates);
  }

  // Issue 39: soft delete — archive
  async function archiveSession(pin) {
    return updateSession(pin, { status: 'archived' });
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

  async function startParticipant(pin, name, role, language, market, email) {
    return request('POST', 'participants', '', {
      pin, name, role, language, market: market || '',
      email: email || null,
      started_at: new Date().toISOString(),
      status: 'started',
      transcript: [],
    });
  }

  async function saveTranscript(pin, name, transcript, participantId) {
    let id = participantId;
    if (!id) {
      const rows = await request('GET', 'participants',
        `?pin=eq.${pin}&name=eq.${encodeURIComponent(name)}&status=eq.started&order=started_at.desc&limit=1`);
      if (!rows.length) throw new Error('Participant record not found');
      id = rows[0].id;
    }
    await request('PATCH', 'participants', `?id=eq.${id}`, {
      transcript,
      status: 'completed',
      completed_at: new Date().toISOString(),
    });
    const session = await getSession(pin);
    const newCount = (session.response_count || 0) + 1;
    await updateSession(pin, { response_count: newCount });
    return newCount;
  }

  async function saveFeedback(pin, name, rating, comment, participantId) {
    let id = participantId;
    if (!id) {
      const rows = await request('GET', 'participants',
        `?pin=eq.${pin}&name=eq.${encodeURIComponent(name)}&order=started_at.desc&limit=1`);
      if (!rows.length) return;
      id = rows[0].id;
    }
    await request('PATCH', 'participants', `?id=eq.${id}`, {
      experience_rating: rating,
      experience_comment: comment,
    });
  }

  async function getTranscripts(pin) {
    return request('GET', 'participants',
      `?pin=eq.${pin}&status=eq.completed&select=*&order=completed_at.desc`);
  }

  // Issue 23: get avg rating for a session
  async function getAvgRating(pin) {
    const rows = await request('GET', 'participants',
      `?pin=eq.${pin}&status=eq.completed&select=experience_rating`);
    const rated = rows.filter(r => r.experience_rating);
    if (!rated.length) return null;
    return (rated.reduce((a, r) => a + r.experience_rating, 0) / rated.length).toFixed(1);
  }

  // ── File Upload ───────────────────────────────────────────
  async function uploadFile(base64, mimeType, filename) {
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
    return { fileId: safeName };
  }

  // Signed URLs for private candor-files bucket (expires in 1 hour by default)
  async function getSignedUrls(fileIds, expiresIn = 3600) {
    if (!fileIds || !fileIds.length) return [];
    const res = await fetch(
      `${CONFIG.SUPABASE_URL}/storage/v1/object/sign/candor-files`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': CONFIG.SUPABASE_KEY,
          'Authorization': `Bearer ${CONFIG.SUPABASE_KEY}`,
        },
        body: JSON.stringify({ paths: fileIds, expiresIn }),
      }
    );
    if (!res.ok) throw new Error('Failed to generate signed URLs');
    const data = await res.json();
    // Returns array of { path, signedURL, error }
    return data.map(item =>
      item.signedURL
        ? `${CONFIG.SUPABASE_URL}/storage/v1${item.signedURL}`
        : null
    );
  }

  // ── Summary ───────────────────────────────────────────────
  // Issue 26: save with timestamp and response count
  async function saveSummary(pin, summary, responseCount) {
    await updateSession(pin, {
      summary,
      summary_generated_at: new Date().toISOString(),
      summary_response_count: responseCount || 0,
    });
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
    if (session.summary) lines.push(`# Research Summary\n${session.summary}\n---`);
    lines.push(`# Transcripts`);
    transcripts.forEach(t => {
      lines.push(`## ${t.name} — ${t.role} · ${t.market || ''} (${t.language})`);
      lines.push(`*${new Date(t.completed_at).toLocaleString('en-SG')}*`);
      (t.transcript || []).forEach(m => {
        if (typeof m.content === 'string')
          lines.push(`**${m.role === 'assistant' ? (session.interviewer_name || 'Candor') : t.name}:** ${m.content}`);
      });
      lines.push('---');
    });
    return { content: lines.join('\n\n'), filename: `candor_${pin}_export.md` };
  }

  return {
    getSessions, getSession, createSession, updateSession, saveDraft, editSession,
    archiveSession, deleteSession, addCoAdmin, removeCoAdmin, validatePin,
    startParticipant, saveTranscript, saveFeedback, getTranscripts, getAvgRating,
    uploadFile, getSignedUrls, saveSummary, exportSession, generatePin,
  };
})();
