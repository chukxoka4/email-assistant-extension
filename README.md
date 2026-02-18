# Gemini Email Assistant

Chrome extension: AI email assistant using the Gemini API. Supports product-specific docs (OptinMonster, TrustPulse, Beacon), goals, audience, tone, and optional “Search Official Docs” via Google Custom Search.

## Setup

1. Clone this repo (or open the folder).
2. In Chrome: go to **chrome://extensions** → enable **Developer mode** → **Load unpacked** → select this project folder.
3. Open the extension (toolbar icon or right‑click → “Send to Email Assistant”), open **Settings**, and enter your **Gemini API key** and (optional) **Google Search Engine ID (CX)**. They are stored only in Chrome storage, not in any file.

See **SECRETS-NOT-TRACKED.md** for what never gets committed.

## Git and your extension

The extension runs **directly from this folder**. When you:

- **Pull** or **switch branches**: the files on disk change. Chrome may keep using the old in-memory version until you **reload** the extension.
- **Reload**: open **chrome://extensions**, find “Gemini Email Assistant”, and click the **reload** (circular) icon. Then the extension uses the latest code from the current branch.

So: after every `git pull` or `git checkout <branch>`, reload the extension once to avoid confusion.

## Branches

- **master** — main line; keep it stable and push to GitHub from here.
- **personal** — your personal experiments and tweaks; merge or cherry-pick into `master` when you want to keep changes.

Create the personal branch from `master` and switch to it when you want to try things without affecting `master`.
