# WhatsApp Group Summarizer — App Plan

## Overview

Add a WhatsApp group summarizer feature to the existing app. Users connect their WhatsApp via **Green API**, select a group, and trigger on-demand AI summaries that appear in a **web dashboard**.

---

## Architecture

```
WhatsApp Group
     │
     │  (Green API polls/webhooks)
     ▼
Green API (REST)
     │
     │  fetch messages
     ▼
Vercel Serverless Functions
     │          │
     │          │  summarize with OpenAI
     │          ▼
     │       OpenAI GPT-4o-mini
     │          │
     │          │  save summary
     ▼          ▼
         Firestore DB
              │
              │  read summaries
              ▼
       React Dashboard (web)
```

---

## Implementation Plan

### Phase 1 — Green API Integration (Backend)

**New file:** `api/whatsapp-messages.ts`

- Accepts: `{ instanceId, apiToken, chatId, count }`
- Calls Green API `getChatHistory` endpoint to fetch the last N messages
- Returns: array of `{ sender, message, timestamp }`
- Secrets stored as Vercel environment variables (never exposed to client)

**New file:** `api/whatsapp-summarize.ts`

- Accepts: `{ instanceId, apiToken, chatId, messageCount }`
- Internally calls `whatsapp-messages` logic, then sends messages to OpenAI
- Prompt instructs GPT-4o-mini to produce a concise bullet-point summary of topics, decisions, and key info
- Saves the resulting summary to Firestore (`families/{familyId}/whatsappSummaries/{id}`)
- Returns the summary to the client

**Green API endpoints used:**
- `GET /waInstance{instanceId}/getChatHistory/{apiTokenInstance}` — fetch message history
- No webhook needed for on-demand mode

---

### Phase 2 — Data Model (Firestore)

```
families/{familyId}/
  whatsappConfig/               ← single doc per family
    instanceId: string          (Green API instance ID)
    apiToken: string            (Green API token)
    chatId: string              (e.g. "1234567890-1234567890@g.us")
    chatName: string            (display name)
    messageCount: number        (how many messages to include, default 200)

  whatsappSummaries/{id}/       ← one doc per generated summary
    createdAt: Timestamp
    messageCount: number
    content: string             (markdown bullet-point summary)
    generatedBy: string         (uid)
```

Config (instanceId, apiToken) is stored server-side only via Vercel env vars for the owner, or optionally encrypted in Firestore for multi-family use.

---

### Phase 3 — Frontend Components

**New file:** `src/components/WhatsAppSummary.tsx`

Sections:
1. **Setup panel** — input fields for Green API `instanceId`, `apiToken`, and group `chatId`. A "Find Groups" button lists available groups for easy selection. Config saved to Firestore.
2. **Summarize Now button** — triggers `/api/whatsapp-summarize`. Shows a loading spinner while the API call runs.
3. **Summaries dashboard** — scrollable list of past summaries, each showing:
   - Date/time generated
   - Number of messages covered
   - Expandable markdown summary content
   - "Copy" button

**Integration:** Add a "WhatsApp Summary" tab to the existing top-level navigation in `App.tsx`.

---

### Phase 4 — Configuration & Secrets

#### Vercel Environment Variables

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | Already exists |
| `GREEN_API_INSTANCE_ID` | Green API instance ID |
| `GREEN_API_TOKEN` | Green API API token |

For multi-user/family support, store per-family credentials encrypted in Firestore instead of env vars.

---

## Cost Estimate

### Green API
| Plan | Price | Messages/month | Suitable for |
|---|---|---|---|
| Developer (free) | $0 | 1,000 | Testing / low volume |
| Basic | ~$39/mo | Unlimited | Active group (< 5k msg/mo) |
| Business | ~$59/mo | Unlimited + priority | High-traffic groups |

> **Realistic cost for a busy family/friends group:** **~$39/month** for the Green API Basic plan.

### OpenAI (GPT-4o-mini)
Pricing (as of 2025): **$0.15 per 1M input tokens / $0.60 per 1M output tokens**

Estimate per summary:
- 200 messages × ~50 tokens avg = **~10,000 input tokens**
- Summary output ≈ **~500 tokens**
- Cost per summary: ~$0.0015 + $0.0003 ≈ **< $0.01**

| Summaries/month | OpenAI cost |
|---|---|
| 10 | ~$0.02 |
| 50 | ~$0.10 |
| 200 | ~$0.40 |

> OpenAI cost is essentially **negligible** for on-demand use.

### Firebase (Firestore)
- Storing text summaries is tiny. Free Spark tier (50k reads/20k writes per day) is more than sufficient.
- **Cost: $0** for typical usage.

### Vercel (Serverless Functions)
- Hobby tier is free. Function invocations for on-demand summarization are well within limits.
- **Cost: $0** for typical usage.

### Total Monthly Cost Estimate

| Scenario | Green API | OpenAI | Firebase | Vercel | **Total** |
|---|---|---|---|---|---|
| Testing | $0 (dev plan) | < $0.01 | $0 | $0 | **~$0** |
| Light use (1 summary/day) | $39 | ~$0.45 | $0 | $0 | **~$39.45** |
| Heavy use (10 summaries/day) | $39 | ~$4.50 | $0 | $0 | **~$43.50** |

> The dominant cost is the **Green API subscription (~$39/mo)**. Everything else is negligible.

---

## Implementation Steps (ordered)

1. [ ] Create a Green API account and connect WhatsApp via QR code scan
2. [ ] Add `api/whatsapp-summarize.ts` serverless function
3. [ ] Add Firestore data model for config and summaries
4. [ ] Build `WhatsAppSummary.tsx` React component (setup + dashboard)
5. [ ] Wire the new tab into `App.tsx` navigation
6. [ ] Add environment variables to Vercel dashboard
7. [ ] Test end-to-end with a real WhatsApp group

---

## Key External Resources

- **Green API docs:** https://green-api.com/en/docs/
- **Green API pricing:** https://green-api.com/en/tariffs/
- **OpenAI pricing:** https://openai.com/api/pricing/
