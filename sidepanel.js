// CONFIG: Product Knowledge Map
const PRODUCTS = {
    "OptinMonster": { 
        role: "Expert OptinMonster Success Specialist", 
        // Point specifically to the docs folder to avoid marketing fluff
        site: "optinmonster.com/docs" 
    },
    "TrustPulse": { 
        role: "Expert TrustPulse Technical Support", 
        site: "trustpulse.com/docs" 
    },
    "Beacon": { 
        role: "Expert Beacon Lead Magnet Specialist", 
        site: "blog.beacon.by/docs"  // Check the actual docs URL for Beacon
    }
  };

  // --- MARKDOWN-LIKE TO HTML (for Summernote / rich text paste) ---
  /**
   * Escapes HTML so content is safe for insertion (no XSS).
   */
  function escapeHtml(text) {
    if (text == null) return '';
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Applies inline formatting: *** → strong+em, ** → strong, * → em.
   * Call on already-escaped text so we don't double-escape.
   */
  function applyInlineFormatting(escapedText) {
    if (!escapedText) return '';
    // Order matters: *** first, then **, then * (to avoid nesting issues)
    return escapedText
      .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>');
  }

  /**
   * Converts markdown-like plain text into semantic HTML (fragment only).
   * Used before clipboard write and for display in the extension so Summernote
   * and other rich editors receive formatted content. Does not double-convert
   * if input is already HTML.
   * @param {string} rawText - LLM output with * ** *** - 1. etc.
   * @returns {string} HTML fragment (no document wrapper)
   */
  function formatEmailTextToHTML(rawText) {
    if (rawText == null || typeof rawText !== 'string') return '';
    const trimmed = rawText.trim();
    if (!trimmed) return '';

    // Already HTML: avoid double conversion (editor-safe fragment)
    if (/<\/(?:p|ul|ol|li|strong|em|h[1-3]|br)\s*>/.test(trimmed) || /^\s*</.test(trimmed)) {
      return trimmed;
    }

    const blocks = trimmed.split(/\n\n+/);
    const out = [];

    const unorderedMarker = /^[-*•]\s+/;
    const orderedMarker = /^\d+\.\s+/;
    const h1 = /^#\s+(.+)$/;
    const h2 = /^##\s+(.+)$/;
    const h3 = /^###\s+(.+)$/;

    for (const block of blocks) {
      const lines = block.split(/\n/).map(l => l.trim());
      const nonEmpty = lines.filter(l => l.length > 0);
      if (nonEmpty.length === 0) continue;

      // Single line: check heading
      if (nonEmpty.length === 1) {
        const line = nonEmpty[0];
        let m = line.match(h3);
        if (m) { out.push('<h3>' + applyInlineFormatting(escapeHtml(m[1])) + '</h3>'); continue; }
        m = line.match(h2);
        if (m) { out.push('<h2>' + applyInlineFormatting(escapeHtml(m[1])) + '</h2>'); continue; }
        m = line.match(h1);
        if (m) { out.push('<h1>' + applyInlineFormatting(escapeHtml(m[1])) + '</h1>'); continue; }
      }

      // All lines unordered list?
      if (nonEmpty.every(l => unorderedMarker.test(l))) {
        const items = nonEmpty
          .map(l => l.replace(unorderedMarker, ''))
          .map(l => '<li>' + applyInlineFormatting(escapeHtml(l)) + '</li>')
          .join('');
        out.push('<ul>' + items + '</ul>');
        continue;
      }

      // All lines ordered list?
      if (nonEmpty.every(l => orderedMarker.test(l))) {
        const items = nonEmpty
          .map(l => l.replace(orderedMarker, ''))
          .map(l => '<li>' + applyInlineFormatting(escapeHtml(l)) + '</li>')
          .join('');
        out.push('<ol>' + items + '</ol>');
        continue;
      }

      // Paragraph: join with <br>, escape and inline-format
      const paraContent = nonEmpty
        .map(l => applyInlineFormatting(escapeHtml(l)))
        .join('<br>');
      out.push('<p>' + paraContent + '</p>');
    }

    // Merge consecutive same-type lists (e.g. two <ul> blocks → one <ul>)
    const merged = [];
    for (let i = 0; i < out.length; i++) {
      const current = out[i];
      const next = out[i + 1];
      const isUl = /^<ul>/.test(current);
      const isOl = /^<ol>/.test(current);
      if (isUl && next && /^<ul>/.test(next)) {
        merged.push(current.replace('</ul>', '') + next.replace(/^<ul>|<\/ul>$/g, '') + '</ul>');
        i++;
      } else if (isOl && next && /^<ol>/.test(next)) {
        merged.push(current.replace('</ol>', '') + next.replace(/^<ol>|<\/ol>$/g, '') + '</ol>');
        i++;
      } else {
        merged.push(current);
      }
    }
    return merged.join('\n\n');
  }

  // Insert incoming selection at cursor instead of replacing. Uses stored content + cursor when panel was closed.
  function insertAtCursor(fieldId, newText, storedContent, cursorStart, cursorEnd) {
    const el = document.getElementById(fieldId);
    if (!el || newText == null) return;
    const content = storedContent != null ? storedContent : el.value;
    const start = cursorStart != null ? cursorStart : el.selectionStart;
    const end = cursorEnd != null ? cursorEnd : el.selectionEnd;
    const before = content.slice(0, start);
    const after = content.slice(end);
    const newContent = before + newText + after;
    const newCursor = start + newText.length;
    el.value = newContent;
    el.setSelectionRange(newCursor, newCursor);
    el.focus();
    return { newContent, newCursor };
  }

  // Persist draft/prompt content and cursor on blur so context menu can insert at cursor from another tab
  function persistDraftState() {
    const d = document.getElementById('draft');
    const p = document.getElementById('prompt');
    chrome.storage.local.set({
      draftContent: d.value,
      lastDraftCursorStart: d.selectionStart,
      lastDraftCursorEnd: d.selectionEnd
    });
  }
  function persistPromptState() {
    const p = document.getElementById('prompt');
    chrome.storage.local.set({
      promptContent: p.value,
      lastPromptCursorStart: p.selectionStart,
      lastPromptCursorEnd: p.selectionEnd
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const draftEl = document.getElementById('draft');
    const promptEl = document.getElementById('prompt');

    // Load settings and any context from context menu (insert at cursor)
    chrome.storage.local.get([
      'geminiApiKey', 'searchCx',
      'draftText', 'draftContent', 'lastDraftCursorStart', 'lastDraftCursorEnd',
      'promptText', 'promptContent', 'lastPromptCursorStart', 'lastPromptCursorEnd'
    ], (result) => {
      if (result.geminiApiKey) document.getElementById('apiKey').value = result.geminiApiKey;
      if (result.searchCx) document.getElementById('searchCx').value = result.searchCx;

      if (result.draftText !== undefined && result.draftText !== '') {
        const content = result.draftContent ?? '';
        const start = result.lastDraftCursorStart ?? 0;
        const end = result.lastDraftCursorEnd ?? 0;
        const { newContent, newCursor } = insertAtCursor('draft', result.draftText, content, start, end) || {};
        if (newContent != null) {
          chrome.storage.local.set({ draftContent: newContent, lastDraftCursorStart: newCursor, lastDraftCursorEnd: newCursor });
        }
        chrome.storage.local.remove('draftText');
      } else if (result.draftContent !== undefined) {
        draftEl.value = result.draftContent;
      }

      if (result.promptText !== undefined && result.promptText !== '') {
        const content = result.promptContent ?? '';
        const start = result.lastPromptCursorStart ?? 0;
        const end = result.lastPromptCursorEnd ?? 0;
        const { newContent, newCursor } = insertAtCursor('prompt', result.promptText, content, start, end) || {};
        if (newContent != null) {
          chrome.storage.local.set({ promptContent: newContent, lastPromptCursorStart: newCursor, lastPromptCursorEnd: newCursor });
        }
        chrome.storage.local.remove('promptText');
      } else if (result.promptContent !== undefined) {
        promptEl.value = result.promptContent;
      }
    });
  });

  // Settings Toggle
  document.getElementById('toggleSettings').addEventListener('click', () => {
    const settings = document.getElementById('settingsSection');
    settings.style.display = settings.style.display === 'none' ? 'block' : 'none';
  });

  // Save Settings
  document.getElementById('saveSettings').addEventListener('click', () => {
    const apiKey = document.getElementById('apiKey').value;
    const cx = document.getElementById('searchCx').value;
    chrome.storage.local.set({ geminiApiKey: apiKey, searchCx: cx }, () => {
      document.getElementById('settingsSection').style.display = 'none';
      alert('Settings Saved!');
    });
  });

  // Context Menu Target: which field gets the next paste (draft vs prompt)
  document.getElementById('draft').addEventListener('focus', () => chrome.storage.local.set({ lastRightClickTarget: 'draft' }));
  document.getElementById('prompt').addEventListener('focus', () => chrome.storage.local.set({ lastRightClickTarget: 'prompt' }));

  // Persist content and cursor when leaving the field so context menu inserts at the right place
  document.getElementById('draft').addEventListener('blur', persistDraftState);
  document.getElementById('prompt').addEventListener('blur', persistPromptState);

  chrome.storage.onChanged.addListener((changes) => {
    const draftEl = document.getElementById('draft');
    const promptEl = document.getElementById('prompt');
    if (changes.draftText?.newValue !== undefined) {
      chrome.storage.local.get(['draftContent', 'lastDraftCursorStart', 'lastDraftCursorEnd'], (r) => {
        const content = r.draftContent ?? draftEl.value;
        const start = r.lastDraftCursorStart ?? draftEl.selectionStart;
        const end = r.lastDraftCursorEnd ?? draftEl.selectionEnd;
        const { newContent, newCursor } = insertAtCursor('draft', changes.draftText.newValue, content, start, end) || {};
        if (newContent != null) {
          chrome.storage.local.set({ draftContent: newContent, lastDraftCursorStart: newCursor, lastDraftCursorEnd: newCursor });
        }
        chrome.storage.local.remove('draftText');
      });
    }
    if (changes.promptText?.newValue !== undefined) {
      chrome.storage.local.get(['promptContent', 'lastPromptCursorStart', 'lastPromptCursorEnd'], (r) => {
        const content = r.promptContent ?? promptEl.value;
        const start = r.lastPromptCursorStart ?? promptEl.selectionStart;
        const end = r.lastPromptCursorEnd ?? promptEl.selectionEnd;
        const { newContent, newCursor } = insertAtCursor('prompt', changes.promptText.newValue, content, start, end) || {};
        if (newContent != null) {
          chrome.storage.local.set({ promptContent: newContent, lastPromptCursorStart: newCursor, lastPromptCursorEnd: newCursor });
        }
        chrome.storage.local.remove('promptText');
      });
    }
  });

  document.getElementById('clearContextBtn').addEventListener('click', () => {
    document.getElementById('draft').value = '';
    document.getElementById('prompt').value = '';
    document.getElementById('output').innerHTML = '';
    document.getElementById('output').style.display = 'none';
    chrome.storage.local.remove(['draftContent', 'lastDraftCursorStart', 'lastDraftCursorEnd', 'promptContent', 'lastPromptCursorStart', 'lastPromptCursorEnd']);
  });

  // --- GOOGLE SEARCH FUNCTION ---
  async function searchDocs(query, apiKey, cx) {
    if (!query || !cx) return null;
    try {
      const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}`;
      const res = await fetch(url);
      const data = await res.json();
      
      if (data.items && data.items.length > 0) {
        // Format results for the AI
        return data.items.slice(0, 3).map(item => `- [Title: ${item.title}](${item.link}): ${item.snippet}`).join("\n");
      }
      return "No relevant documentation found.";
    } catch (e) {
      console.error("Search failed", e);
      return "Search failed: " + e.message;
    }
  }
  
  // --- GENERATE FUNCTION ---
  document.getElementById('generateBtn').addEventListener('click', async () => {
    const draft = document.getElementById('draft').value;
    let promptExtra = document.getElementById('prompt').value;
    const goal = document.getElementById('goal').value;
    const audience = document.getElementById('audience').value;
    const tone = document.getElementById('tone').value;
    const product = document.getElementById('product').value;
    const useSearch = document.getElementById('useSearch').checked;
    const outputDiv = document.getElementById('output');
  
    // Get Keys
    const stored = await chrome.storage.local.get(['geminiApiKey', 'searchCx']);
    const apiKey = stored.geminiApiKey;
    const searchCx = stored.searchCx;
  
    if (!apiKey) {
      alert("Please enter your API Key in settings.");
      document.getElementById('settingsSection').style.display = 'block';
      return;
    }
  
    outputDiv.style.display = 'block';
    outputDiv.innerHTML = "Thinking...";
    outputDiv.classList.add("loading");
  
    // 1. Perform Search if requested
    let searchResults = "";
    if (useSearch) {
      if (!promptExtra) {
        alert("To use Search, please enter keywords in the 'Prompt' box (e.g. 'webhook setup').");
        outputDiv.classList.remove("loading");
        return;
      }
      outputDiv.innerHTML = `Searching docs for "${promptExtra}"...`;
      
      // We append the Site to the query to ensure we search the right product
      const query = `${promptExtra} site:${PRODUCTS[product].site}`;
      searchResults = await searchDocs(query, apiKey, searchCx);
    }
  
    // 2. Build the System Prompt
    const systemPrompt = `
  Role: ${PRODUCTS[product].role}.
  Objective: Rewrite/Write an email based on the draft and constraints.
  
  Context Provided:
  - Product: ${product}
  - Draft/Input: "${draft}"
  - Goal: ${goal}
  - Audience: ${audience}
  - Tone: ${tone}
  ${promptExtra ? `- Extra Prompt: "${promptExtra}"` : ""}
  ${searchResults ? `\n\nOFFICIAL DOCUMENTATION FOUND (Use these links!): \n${searchResults}` : ""}
  
  Guidelines:
  - Clarity is King: Short paragraphs.
  - Formatting: Use bullet points.
  - Branding: "${product}" (correct spelling).
  - DOCUMENTATION: If "Official Documentation" is provided above, YOU MUST incorporate the links into your reply where relevant.
  - NO LaTeX.
  
  You MUST reply using exactly this structure:
  
  REASON:
  [Brief explanation of changes.]
  
  VERSION A (The Polish):
  [Refined version of the draft.]
  
  VERSION B (The Revamp):
  [Reimagined version using the documentation links if available.]
  `;
  
    // 3. Call Gemini (using 1.5-flash for better free-tier quota; 2.0-flash often has limit 0)
    const model = "gemini-2.5-flash";
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt }] }] })
      });

      const data = await response.json();
      outputDiv.classList.remove("loading");

      if (data.candidates && data.candidates[0].content) {
        const raw = data.candidates[0].content.parts[0].text;
        const parsed = parseOutput(raw);
        outputDiv.innerHTML = renderOutput(parsed);
      } else {
        const err = data.error || {};
        const msg = err.message || "";
        const isQuota = err.code === 429 || msg.toLowerCase().includes("quota") || msg.includes("billing");
        if (isQuota) {
          outputDiv.innerHTML = "<div class='output-box reason'>" +
            "<strong>Quota exceeded</strong><br><br>" +
            escapeHtml(msg) + "<br><br>" +
            "• <a href='https://ai.google.dev/gemini-api/docs/rate-limits' target='_blank'>Rate limits</a><br>" +
            "• <a href='https://aistudio.google.com/apikey' target='_blank'>API key & usage</a>" +
            "</div>";
        } else {
          outputDiv.innerHTML = "<span class='output-box'>Error: " + escapeHtml(msg || JSON.stringify(data)) + "</span>";
        }
      }
    } catch (error) {
      outputDiv.classList.remove("loading");
      outputDiv.innerHTML = "<span class='output-box'>Network Error: " + escapeHtml(error.message) + "</span>";
    }
  });
  
  // ... [Keep your existing parseOutput and renderOutput functions exactly as they were] ...
  // Copy-Paste the parseOutput, renderOutput, and Copy Event Listener from your previous file here.
  // I omitted them to save space, but you MUST keep them!
  
  function parseOutput(raw) {
      const lower = raw.toLowerCase();
      const reasonLabel = "reason:";
      const versionALabel = "version a (the polish):";
      const versionBLabel = "version b (the revamp):";
      const iReason = lower.indexOf(reasonLabel);
      let iA = lower.indexOf("\n" + versionALabel);
      if (iA < 0) iA = lower.indexOf(versionALabel);
      let iB = lower.indexOf("\n" + versionBLabel);
      if (iB < 0) iB = lower.indexOf(versionBLabel);
      const skipA = iA >= 0 ? (raw.slice(iA).match(/^\n?version a\s*\(the polish\)\s*:\s*/i) || [""])[0].length : 0;
      const skipB = iB >= 0 ? (raw.slice(iB).match(/^\n?version b\s*\(the revamp\)\s*:\s*/i) || [""])[0].length : 0;
      let reason = "", versionA = "", versionB = "";
      if (iReason >= 0 && iA >= 0) reason = raw.slice(iReason + reasonLabel.length, iA).trim();
      if (iA >= 0 && iB >= 0) versionA = raw.slice(iA + skipA, iB).trim();
      if (iB >= 0) versionB = raw.slice(iB + skipB).trim();
      if (!reason && !versionA && !versionB) reason = raw;
      return { reason, versionA, versionB };
  }
  
  function renderOutput(parsed) {
      const { reason, versionA, versionB } = parsed;
      let html = "";
      if (reason) html += `<div class="output-section"><h3><strong>Why</strong></h3><div class="output-box reason">${escapeHtml(reason)}</div></div>`;
      // Email versions: show formatted HTML and store raw for clipboard (format applied on copy from same HTML)
      if (versionA) html += `<div class="output-section"><h3><strong>Suggestion A</strong></h3><div class="output-box email" id="sa" data-raw="${escapeHtml(versionA).replace(/"/g, '&quot;')}">${formatEmailTextToHTML(versionA)}</div><button class="copy-btn" data-copy-target="sa">Copy</button></div>`;
      if (versionB) html += `<div class="output-section"><h3><strong>Suggestion B</strong></h3><div class="output-box email" id="sb" data-raw="${escapeHtml(versionB).replace(/"/g, '&quot;')}">${formatEmailTextToHTML(versionB)}</div><button class="copy-btn" data-copy-target="sb">Copy</button></div>`;
      return html;
  }

  // Copy: write HTML (for Summernote) and plain text (fallback). Formatting applied before clipboard write.
  document.getElementById("output").addEventListener("click", async (e) => {
      const btn = e.target.closest(".copy-btn");
      if (!btn) return;
      const el = document.getElementById(btn.getAttribute("data-copy-target"));
      if (!el) return;
      // data-raw holds original markdown-like text (browser decodes attribute); use for HTML conversion
      const rawText = el.getAttribute("data-raw") ?? el.textContent.trim();
      const htmlFragment = formatEmailTextToHTML(rawText);
      const plainText = el.textContent.trim();
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([htmlFragment], { type: 'text/html' }),
            'text/plain': new Blob([plainText], { type: 'text/plain' })
          })
        ]);
      } catch (_) {
        await navigator.clipboard.writeText(plainText);
      }
      btn.textContent = "Copied!";
      setTimeout(() => btn.textContent = "Copy", 1500);
  });