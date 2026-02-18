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
  
  document.addEventListener('DOMContentLoaded', () => {
    // Load settings
    chrome.storage.local.get(['geminiApiKey', 'searchCx', 'draftText', 'promptText'], (result) => {
      if (result.geminiApiKey) document.getElementById('apiKey').value = result.geminiApiKey;
      if (result.searchCx) document.getElementById('searchCx').value = result.searchCx;
      
      if (result.draftText) {
        document.getElementById('draft').value = result.draftText;
        chrome.storage.local.remove('draftText');
      }
      if (result.promptText) {
        document.getElementById('prompt').value = result.promptText;
        chrome.storage.local.remove('promptText');
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
  
  // Context Menu Target Logic
  document.getElementById('draft').addEventListener('focus', () => chrome.storage.local.set({ lastRightClickTarget: 'draft' }));
  document.getElementById('prompt').addEventListener('focus', () => chrome.storage.local.set({ lastRightClickTarget: 'prompt' }));
  
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.draftText?.newValue) document.getElementById('draft').value = changes.draftText.newValue;
    if (changes.promptText?.newValue) document.getElementById('prompt').value = changes.promptText.newValue;
  });
  
  document.getElementById('clearContextBtn').addEventListener('click', () => {
    document.getElementById('draft').value = '';
    document.getElementById('prompt').value = '';
    document.getElementById('output').innerHTML = '';
    document.getElementById('output').style.display = 'none';
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
      if (versionA) html += `<div class="output-section"><h3><strong>Suggestion A</strong></h3><div class="output-box email" id="sa">${escapeHtml(versionA)}</div><button class="copy-btn" data-copy-target="sa">Copy</button></div>`;
      if (versionB) html += `<div class="output-section"><h3><strong>Suggestion B</strong></h3><div class="output-box email" id="sb">${escapeHtml(versionB)}</div><button class="copy-btn" data-copy-target="sb">Copy</button></div>`;
      return html;
  }
  
  function escapeHtml(text) { const div = document.createElement("div"); div.textContent = text; return div.innerHTML; }
  
  document.getElementById("output").addEventListener("click", async (e) => {
      const btn = e.target.closest(".copy-btn");
      if (!btn) return;
      const el = document.getElementById(btn.getAttribute("data-copy-target"));
      if (el) await navigator.clipboard.writeText(el.textContent.trim());
      btn.textContent = "Copied!";
      setTimeout(() => btn.textContent = "Copy", 1500);
  });