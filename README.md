# LeadGen Pro + Call Center

Two existing apps, kept as separate services, combined in one repo:

- **`/leadgenpro`** — the PHP/MySQL lead-gen web app (leads, campaigns, SMS agent).
- **`/call-center`** — the Node/Express/React AI call + SMS engine (real Twilio
  send, consent/DNC/TCPA handling, webhook signature validation, outbound
  dialer, appointment booking and reminders).

They're different stacks (PHP/MySQL vs Node/React, no shared build), so this
is a monorepo of two services rather than a merged codebase. Each deploys
independently — see each folder's own README/Dockerfile/render.yaml.

## How they connect

`call-center` can pull leads from `leadgenpro` and report back how each call
went, over `leadgenpro`'s existing API-key-protected REST API:

- `GET /leadgenpro/api/leads.php?status=new` — leads waiting to be called
- `POST /leadgenpro/api/call-center-outcome.php` — new endpoint; logs the
  call/SMS outcome against the lead (`lead_activities` + `leads.status`)

Setup:

1. In `leadgenpro`, create (or reuse) a user and copy their `api_key`
   (`users.api_key` in the database — the admin seed user already has one).
2. In `call-center`, set `LEADGENPRO_BASE_URL` (e.g.
   `https://your-leadgenpro-install.example.com`) and `LEADGENPRO_API_KEY`
   to that key (see `call-center/.env.example`).
3. In the call-center dashboard, open **Outbound Dialer → Campaigns**, pick
   a campaign, and click **Sync from leadgenpro** to pull in leads with
   `status = 'new'` and a phone number. Each one is tagged with its
   leadgenpro lead ID (`contact.extra.leadgenpro_lead_id`).
4. When a call to one of those contacts ends, `call-center` reports the
   outcome (booked / voicemail / no answer / not interested / etc.), call
   duration and transcript back to leadgenpro automatically
   (`server/dialer.ts` → `server/leadgenpro.ts`).

Reporting is best-effort and fire-and-forget: if leadgenpro is unreachable,
the call-center dialer logs it and keeps going rather than blocking on it.

**Not yet built:** inbound SMS conversations in call-center don't report
outcomes back to leadgenpro yet (only outbound voice campaign calls do),
and leads aren't synced automatically on a schedule — syncing is a manual
button click for now. Both are reasonable next steps if this needs to run
unattended.

## What was left out

`call-center`'s upstream history included a leftover casino mini-app
(blackjack/roulette/slots, a wallet, an operator portal, a casino-themed
header) from the template it was remixed from. None of it was reachable from
the actual call-center dashboard (`src/App.tsx` never imports it), so it was
dropped on import here rather than carried along as dead code.
