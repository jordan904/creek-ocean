# Creek Assistant: Chat Worker

Cloudflare Worker behind the "Creek Assistant" chat widget. It answers
questions using Cloudflare Workers AI (free, no card or separate account
needed) and saves each conversation for review. Lead emails are sent
from the browser, not from this Worker (see Setup step 2).

## Setup

### 1. Workers AI: no signup needed
Nothing to configure. The `[ai]` binding in `wrangler.toml` gives the Worker
access to Cloudflare's hosted models on the same account used to deploy it.
The free tier is a daily allocation of "Neurons" (Cloudflare's compute unit),
which is plenty for a low-volume lead-capture chatbot. If higher-quality
answers are ever wanted, this is the one piece that could be swapped for a
paid model.

### 2. Lead emails (Web3Forms, sent from the browser)
This Worker does not send email. The in-chat contact form and the page contact
form send straight from the visitor's browser to Web3Forms (see `sendLead` in
`../chatbot/chatbot.js`). Sending from the Worker failed because Web3Forms
rate-limits Cloudflare's shared outbound IPs ("Rate limit exceeded. IP
temporarily blocked"). Web3Forms access keys are public by design and live in
`chatbot.js`; restrict them to the site's domains in the Web3Forms dashboard.

### 3. Deploy
```bash
cd chatbot-worker
npx wrangler login
npx wrangler deploy
```

Deployed at `https://creek-chatbot.jordan-574.workers.dev`. That URL is set as
`CHAT_API_BASE` in `../chatbot/chatbot.js`.

## Endpoints
- `POST /chat`: `{ messages: [{ role, content }], sessionId }` returns `{ reply }`

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
- Consider a Cloudflare rate-limiting rule on `/chat` if usage
  grows, to cap abuse.
