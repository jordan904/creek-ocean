# Creek Assistant — Chat Worker

Cloudflare Worker that powers the "Creek Assistant" chat widget: answers
questions using Cloudflare Workers AI (free — no card, no separate account,
runs on the same Cloudflare account as the Worker itself), and emails lead
details (via Web3Forms — also free, no domain verification needed) when a
visitor fills out the in-chat contact form.

## Setup

### 1. Workers AI — no signup needed
Nothing to configure here. The `[ai]` binding in `wrangler.toml` gives the
Worker access to Cloudflare's free hosted models automatically, on the same
Cloudflare account used to deploy the Worker. Free tier is a daily allocation
of "Neurons" (Cloudflare's compute unit) — comfortably enough for a
low-volume lead-capture chatbot. No API key, no card, nothing to set as a
secret. If you ever want higher quality answers and are willing to pay, this
is the one piece that could later be swapped for a paid model — not required.

### 2. Web3Forms (free email delivery, two inboxes)
Web3Forms ties each access key to one destination inbox, and we need two
(general inquiries vs. careers/resumes):
- Go to **web3forms.com** and create an access key using `admin@creek.construction`
  — this is the "general" key.
- Create a second access key using `career@creek.construction` — this is the
  "careers" key.
- No domain verification, no cost, no card required.

### 3. Deploy to Cloudflare Workers
```bash
cd chatbot-worker
npx wrangler login
npx wrangler secret put WEB3FORMS_ACCESS_KEY_GENERAL
npx wrangler secret put WEB3FORMS_ACCESS_KEY_CAREERS
npx wrangler deploy
```

This gives you a URL like: `https://creek-chatbot.YOUR_ACCOUNT.workers.dev`

### 4. Point the widget at it
In `../chatbot/chatbot.js`, set `CHAT_API_BASE` to that Worker URL.

## Endpoints
- `POST /chat` — `{ messages: [{ role, content }] }` → `{ reply }`
- `POST /lead` — `{ name, email, phone?, type, description, transcript? }` → `{ ok: true }`
  routes to the careers Web3Forms key for resume/career inquiries, otherwise
  the general key.

## Conversation logging
Each chat conversation is saved to the `CHAT_LOGS` KV binding (namespace
`CREEK_CHAT_LOGS`) under `session:<id>`, where the id is a random UUID the
widget keeps in `sessionStorage`. Entries expire after 90 days. This matches
what `privacy-policy.html` tells visitors, so keep the two in sync.

To read logs, always pass `--remote` (without it, wrangler reads a local
simulated store and shows nothing):
```bash
npx wrangler kv key list --namespace-id ae80fbd4452e4661be246af6e1874ed9 --remote
npx wrangler kv key get --namespace-id ae80fbd4452e4661be246af6e1874ed9 --remote "session:<id>"
```

## Notes
- `ALLOWED_ORIGINS` in `wrangler.toml` controls CORS — update it if the live
  domain changes.
- No client-side API keys: everything sensitive stays in Worker secrets.
- Consider adding a Cloudflare rate-limiting rule on `/chat` and `/lead` in
  the dashboard if usage grows, to cap cost from abuse.
