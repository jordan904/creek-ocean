# Creek Assistant: Chat Worker

Cloudflare Worker behind the "Creek Assistant" chat widget. It answers
questions using Cloudflare Workers AI (free, no card or separate account
needed) and emails lead details through Web3Forms (also free) when a visitor
uses the in-chat contact form or the site's project inquiry form.

## Setup

### 1. Workers AI: no signup needed
Nothing to configure. The `[ai]` binding in `wrangler.toml` gives the Worker
access to Cloudflare's hosted models on the same account used to deploy it.
The free tier is a daily allocation of "Neurons" (Cloudflare's compute unit),
which is plenty for a low-volume lead-capture chatbot. If higher-quality
answers are ever wanted, this is the one piece that could be swapped for a
paid model.

### 2. Web3Forms (free email delivery, two inboxes)
Web3Forms ties each access key to one inbox, and Creek uses two:
- a "general" key created with `admin@creek.construction`
- a "careers" key created with `career@creek.construction`

No domain verification, cost, or card required.

### 3. Deploy
```bash
cd chatbot-worker
npx wrangler login
npx wrangler secret put WEB3FORMS_ACCESS_KEY_GENERAL
npx wrangler secret put WEB3FORMS_ACCESS_KEY_CAREERS
npx wrangler deploy
```

Deployed at `https://creek-chatbot.jordan-574.workers.dev`. That URL is set as
`CHAT_API_BASE` in `../chatbot/chatbot.js` and is also used directly by the
project inquiry form in `../index.html`.

## Endpoints
- `POST /chat`: `{ messages: [{ role, content }], sessionId }` returns `{ reply }`
- `POST /lead`: `{ name, email, phone?, type, description, transcript? }` returns `{ ok: true }`.
  Resume and career inquiries go to the careers key; everything else goes to
  the general key.

## Conversation logging
Each chat conversation is saved to the `CHAT_LOGS` KV binding (namespace
`CREEK_CHAT_LOGS`) under `session:<id>`, where the id is a random UUID the
widget keeps in `sessionStorage`. Entries expire after 90 days. This matches
what `../privacy-policy.html` tells visitors, so keep the two in sync.

To read logs, always pass `--remote` (without it, wrangler reads a local
simulated store and shows nothing):
```bash
npx wrangler kv key list --namespace-id ae80fbd4452e4661be246af6e1874ed9 --remote
npx wrangler kv key get --namespace-id ae80fbd4452e4661be246af6e1874ed9 --remote "session:<id>"
```

## System prompt
The prompt in `worker.js` is built from `../Creek Website Chatbot Answers.pdf`
(the client's questionnaire, kept out of the public repo). Business hours are
Mon to Fri, 8:00 AM to 5:00 PM Atlantic; `getAtlanticStatus()` uses the same
hours, so change both together.

## Notes
- `ALLOWED_ORIGINS` in `wrangler.toml` controls CORS. Update it when the live
  domain changes.
- No client-side API keys: everything sensitive stays in Worker secrets.
- Consider a Cloudflare rate-limiting rule on `/chat` and `/lead` if usage
  grows, to cap abuse.
