# Secrets & PII — Not Tracked

This file is **tracked** so you know what to keep out of git. Real secrets go in **untracked** files listed below.

## What this project uses

- **Gemini API key** and **Google Custom Search CX** are **not** in the repo. They are entered in the extension’s Settings UI and stored only in Chrome’s local storage (per install). Safe to push.

## If you add local config later

Put any real secrets or PII in one of these (they are in `.gitignore` and will **not** be committed):

- `secrets.env`
- `secrets.json`
- `.env`
- `.env.local`
- `local-config.js` or `local-config.json`

Never commit those files or paste API keys/CX into source code.

## Optional: example for other devs

You can add a **tracked** example with fake values, e.g. `secrets.env.example`:

```bash
# Copy to secrets.env and fill in (secrets.env is gitignored)
# GEMINI_API_KEY=AIza...
# SEARCH_CX=0123456789...
```
