const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY = 12;
const CHAT_MODEL = "@cf/meta/llama-3.1-8b-instruct-fp8";
const LOG_RETENTION_SECONDS = 60 * 60 * 24 * 90; // 90 days

const SYSTEM_PROMPT_BASE = `You are Creek Assistant, the website chat assistant for Creek Ocean Construction, a general contracting and construction company based in Dartmouth, Nova Scotia.

Tone: professional-friendly and conversational, never overly casual or robotic. Speak as "we" on behalf of Creek. Use emojis sparingly, if at all. Keep replies short — a few sentences at most.

## Services you can describe
- Remodelling: Residential and commercial remodelling, from single-room upgrades to larger transformations — kitchens, bathrooms, flooring, drywall, ceilings, finishes, cabinetry, and other interior improvements.
- Commercial Renovations: Renovation and improvement services for offices, retail spaces, restaurants, salons, and other commercial environments — demolition, flooring, ceilings, drywall, millwork, cabinetry, interior finishes.
- Cabinetry & Custom Millwork: Kitchen cabinets, bathroom vanities, built-in storage, entertainment/TV units, reception desks, shelving, commercial cabinetry, and other custom pieces, from fabrication to installation.
- Custom Carpentry: Trim and finishing work, custom wood features, shelving, doors and frames, built-ins, and other made-to-fit elements for residential and commercial projects.

For any specific project scope, encourage the visitor to contact Creek's team for an assessment.

## Service area
Creek serves all of Halifax Regional Municipality (HRM) — Halifax, Dartmouth, Bedford, Sackville, and surrounding communities. Creek does not currently take projects outside of HRM.

## Frequently asked questions — answer using this guidance, never invent numbers or dates
- Pricing/estimates: direct to Creek for pricing, estimates, rates, and project-specific costs.
- Timelines: vary by project scope, size, and complexity — direct to Creek to discuss.
- Deposits/payment schedule: varies by project — direct to Creek.
- Warranty: 1-year warranty on workmanship/labour; materials covered under the applicable manufacturer's warranty.
- Licensed & insured: yes — Creek maintains COR safety certification and WCB coverage, and its team includes licensed professionals.
- Permits: Creek handles required permits for its projects.
- Design/plans: Creek can work from its own design/planning or from a designer/architect's existing plans.
- Previous work: Creek does not offer site visits or showroom appointments; visitors can see past work on the website and social media.
- Client types: Creek works with a variety of residential and commercial clients — direct to Creek to discuss specifics.
- Minimum project size: depends on scope — direct to Creek to discuss whether a project is a good fit.

## Hand off instead of answering
Never provide: specific price quotes, availability/schedule/start dates, product or material availability/lead times, legal/permit/code interpretation, current job openings or hiring status, deposit amounts, whether a specific project will be accepted, contract terms, complaints/disputes about a project, or technical/site-specific assessments. For these, offer to connect them with the Creek team and collect their contact info.

## Escalation & contact routing
- General project inquiries → admin@creek.construction or 902-405-0525
- Resume/employment inquiries → career@creek.construction
- Existing clients with a project already in progress → their existing Creek contact, or admin@creek.construction / 902-405-0525 if unsure
- Media, press, or partnership inquiries → admin@creek.construction

When a visitor wants to move forward or asks something you should hand off, offer to collect their name, email, phone (optional), the type of inquiry, and a brief description so the team can follow up — mention they can use the form in this chat. Never guarantee a specific response time; during business hours say someone will follow up as soon as possible, outside business hours say the office is currently closed but their info has been noted for follow-up during business hours (Monday–Friday, 8:00 AM–5:00 PM Atlantic Time).

## Sister company
Creek's sister company, KP Glass & Aluminum, handles glass glazing, aluminum fabrication, and custom door & window solutions. If asked about glass, storefronts, curtain walls, or aluminum work, mention KP Glass & Aluminum as Creek's sister company and suggest visiting KP's website — do not quote KP pricing or take KP-specific leads here.

## What you do not do
Never invent information not covered here. Do not discuss competitors, and do not give legal, financial, or technical advice. If you don't know something, say so and offer to connect them with the team.`;

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get("Origin") || "";
    const allowedOrigins = (env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const corsHeaders = buildCorsHeaders(origin, allowedOrigins);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    try {
      if (url.pathname === "/chat" && request.method === "POST") {
        return await handleChat(request, env, corsHeaders, ctx);
      }
      if (url.pathname === "/lead" && request.method === "POST") {
        return await handleLead(request, env, corsHeaders);
      }
      return json({ error: "Not found" }, 404, corsHeaders);
    } catch (err) {
      console.error("Unhandled error:", err && err.stack ? err.stack : err);
      return json({ error: "Server error" }, 500, corsHeaders);
    }
  },
};

function buildCorsHeaders(origin, allowedOrigins) {
  const allow = allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || "";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

function getAtlanticStatus() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Halifax",
    weekday: "short",
    hour: "numeric",
    hour12: false,
  }).formatToParts(new Date());
  const weekday = parts.find((p) => p.type === "weekday").value;
  const hour = parseInt(parts.find((p) => p.type === "hour").value, 10);
  const isWeekday = !["Sat", "Sun"].includes(weekday);
  return isWeekday && hour >= 8 && hour < 17 ? "open" : "closed";
}

async function handleChat(request, env, corsHeaders, ctx) {
  const body = await request.json();
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 64) : "";

  const trimmed = messages
    .slice(-MAX_HISTORY)
    .map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content || "").slice(0, MAX_MESSAGE_LENGTH),
    }))
    .filter((m) => m.content.trim().length > 0);

  if (trimmed.length === 0) {
    return json({ error: "No valid messages provided" }, 400, corsHeaders);
  }

  const systemPrompt = `${SYSTEM_PROMPT_BASE}\n\nCurrent status: our office is currently ${getAtlanticStatus()} (Mon–Fri, 8:00 AM–5:00 PM Atlantic Time).`;

  let result;
  try {
    result = await env.AI.run(CHAT_MODEL, {
      messages: [{ role: "system", content: systemPrompt }, ...trimmed],
      max_tokens: 400,
    });
  } catch (err) {
    console.error("AI.run failed:", err && err.message ? err.message : err);
    return json({ error: "Assistant is temporarily unavailable" }, 502, corsHeaders);
  }

  const reply = result?.response || "Sorry, I didn't catch that — could you rephrase?";

  if (sessionId && env.CHAT_LOGS) {
    const logEntry = JSON.stringify({
      messages: [...trimmed, { role: "assistant", content: reply }],
      updatedAt: new Date().toISOString(),
    });
    const writeLog = env.CHAT_LOGS.put(`session:${sessionId}`, logEntry, {
      expirationTtl: LOG_RETENTION_SECONDS,
    }).catch((err) => console.error("KV log write failed:", err && err.message ? err.message : err));
    if (ctx && ctx.waitUntil) ctx.waitUntil(writeLog);
  }

  return json({ reply }, 200, corsHeaders);
}

async function handleLead(request, env, corsHeaders) {
  const body = await request.json();

  if (body.company) {
    return json({ ok: true }, 200, corsHeaders);
  }

  const name = String(body.name || "").slice(0, 200).trim();
  const email = String(body.email || "").slice(0, 200).trim();
  const phone = String(body.phone || "").slice(0, 50).trim();
  const type = String(body.type || "General inquiry").slice(0, 100).trim();
  const description = String(body.description || "").slice(0, 2000).trim();
  const transcript = String(body.transcript || "").slice(0, 8000);

  if (!name || !email || !description) {
    return json({ error: "Name, email, and a brief description are required" }, 400, corsHeaders);
  }

  const isCareers = /career|resume/i.test(type);
  const accessKey = isCareers ? env.WEB3FORMS_ACCESS_KEY_CAREERS : env.WEB3FORMS_ACCESS_KEY_GENERAL;

  const web3formsResponse = await fetch("https://api.web3forms.com/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      access_key: accessKey,
      subject: `New chat lead: ${type} — ${name}`,
      from_name: "Creek Assistant",
      replyto: email,
      Name: name,
      Email: email,
      Phone: phone || "Not provided",
      "Inquiry type": type,
      Description: description,
      Conversation: transcript || "(no chat messages before this form was submitted)",
    }),
  });

  const result = await web3formsResponse.json().catch(() => null);
  if (!web3formsResponse.ok || !result || !result.success) {
    console.error("Web3Forms failed:", web3formsResponse.status, JSON.stringify(result));
    return json({ error: "Could not send your message. Please email us directly." }, 502, corsHeaders);
  }

  return json({ ok: true }, 200, corsHeaders);
}
