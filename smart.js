// ============================================================
//  Candor Research — SMART Agent API
//  Calls smart.shopee.io directly from the browser.
//  Requires user to be on Shopee WiFi or VPN.
// ============================================================

const SMART = (() => {

  async function call(prompt, threadId = null, userEmail = '') {
    const message = { input_str: prompt };
    if (threadId) message.thread_id = threadId;

    const res = await fetch(`${CONFIG.SMART_URL}?app=candor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint_deployment_hash_id: CONFIG.SMART_HASH_ID,
        endpoint_deployment_key:     CONFIG.SMART_KEY,
        user_id:                     userEmail || 'candor-user@shopee.com',
        message,
      }),
    });

    if (!res.ok) throw new Error(`SMART error ${res.status}`);
    const result = await res.json();
    if (result.error) throw new Error(result.error);

    return {
      text:     extractReply(result),
      threadId: extractThreadId(result),
    };
  }

  function extractReply(result) {
    try { if (result.data.response.response_str) return result.data.response.response_str; } catch(e){}
    try { if (result.data.output) return result.data.output; } catch(e){}
    try { if (result.output) return result.output; } catch(e){}
    try { if (result.message) return result.message; } catch(e){}
    try { if (result.data.message) return result.data.message; } catch(e){}
    return JSON.stringify(result);
  }

  function extractThreadId(result) {
    try { return result.data.response.thread_id || null; } catch(e) { return null; }
  }

  // Interview — first message carries full system prompt as preamble
  async function interview(systemPrompt, userMessage, threadId, isFirst, userEmail) {
    const prompt = isFirst
      ? `${systemPrompt}\n\n---\n\nInstruction: Begin the interview now.\n\n${userMessage}`
      : userMessage;
    return call(prompt, threadId, userEmail);
  }

  // Clarification / preview — builds full conversation as single prompt
  async function clarify(systemPrompt, messages, threadId, userEmail) {
    const history = (messages || []).map(m => {
      const role = m.role === 'assistant' ? 'Assistant' : 'Researcher';
      return `${role}: ${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`;
    }).join('\n\n');
    const prompt = `${systemPrompt}\n\n---\n\n${history}\n\nAssistant:`;
    return call(prompt, threadId, userEmail);
  }

  // Summary generation
  async function summarise(session, transcripts, userEmail) {
    const combined = transcripts.map(t => {
      const msgs = (t.transcript || []).filter(m => typeof m.content === 'string');
      return `=== ${t.name} (${t.role}) ===\n` +
        msgs.map(m => `${m.role === 'assistant' ? 'AI' : t.name}: ${m.content}`).join('\n');
    }).join('\n\n');

    const prompt =
      `You are a senior UX researcher synthesising interview findings. Be specific, quote participants.\n\n` +
      `Product: ${session.product}\nGoal: ${session.goal}\nParticipants: ${transcripts.length}\n\n` +
      `TRANSCRIPTS:\n${combined}\n\n` +
      `Write a research summary with these sections:\n` +
      `## Key Insights\n## Pain Points\n## Positive Signals\n## Verbatim Quotes\n## Recommended Next Steps\n## Participant Overview`;

    return call(prompt, null, userEmail);
  }

  return { call, interview, clarify, summarise };
})();
