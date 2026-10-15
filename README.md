# LeadGen Pro + Call Center

Two existing apps, kept as separate services, combined in one repo:

- **`/leadgenpro`** — the PHP/MySQL lead-gen web app (leads, campaigns, SMS agent).
- **`/call-center`** — the Node/Express/React AI call + SMS engine (real Twilio
  send, consent/DNC/TCPA handling, webhook signature validation, outbound
  dialer, appointment booking and reminders).

They're different stacks (PHP/MySQL vs Node/React, no shared build), so this
is a monorepo of two services rather than a merged codebase. Each deploys
independently — see each folder's own README/Dockerfile/render.yaml.

## How they're meant to connect

`leadgenpro` already exposes an API-key-protected REST API built for exactly
this:

- `GET/POST /leadgenpro/api/leads.php` — list/create/update leads
- `POST /leadgenpro/api/ai-call.php` — trigger a call and log the outcome
  (currently wired to Bland AI as a placeholder)

The plan is for `call-center` to pull leads from `leadgenpro/api/leads.php`
and report call/SMS outcomes back through `leadgenpro/api/ai-call.php`
instead of Bland AI, so leads and outcomes live in one place
(`leads` / `campaign_leads` / `lead_activities` in leadgenpro's MySQL
database) while `call-center` keeps doing the actual dialing, texting and
compliance work.

**Not yet built:** the actual HTTP calls from `call-center` to `leadgenpro`'s
API (and vice versa for inbound leads). Today the two apps still run fully
independently with their own data stores. This is the next piece of work.

## What was left out

`call-center`'s upstream history included a leftover casino mini-app
(blackjack/roulette/slots, a wallet, an operator portal, a casino-themed
header) from the template it was remixed from. None of it was reachable from
the actual call-center dashboard (`src/App.tsx` never imports it), so it was
dropped on import here rather than carried along as dead code.
