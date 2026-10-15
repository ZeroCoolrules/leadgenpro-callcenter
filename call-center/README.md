# Call AI Center

AI receptionist that answers real SMS and phone calls and books appointments.

**No Google account, no Gemini key, no Cloud Run bill.** The AI runs on your own
computer with [Ollama](https://ollama.com) (free), and the app runs as a plain
Node server you start yourself.

## 1. Install

```bash
# Node 20+ required
npm install
cp .env.example .env
```

## 2. Start the free local AI

1. Install Ollama: https://ollama.com/download
2. Download a model (one time):

```bash
ollama pull llama3.2
```

Ollama keeps running in the background on `http://localhost:11434`. That's it —
the defaults in `.env` already point there.

> Prefer a different model? Set `LLM_MODEL` (e.g. `qwen2.5`, `mistral`).
> Want a hosted provider instead? Any OpenAI-compatible API works: set
> `LLM_BASE_URL`, `LLM_MODEL` and `LLM_API_KEY`.

## 3. Run the app

```bash
npm run dev     # development, hot reload
npm start       # production: builds the UI and serves it
```

Open http://localhost:3000. Check http://localhost:3000/api/health — `llm.reachable`
should be `true`. If the model is offline the app still works using built-in
fallback replies.

## 4. Go live with real phone calls & texts (real time)

Twilio needs a public HTTPS URL to reach your computer. Use a free Cloudflare
tunnel (no account needed):

```bash
# install: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
cloudflared tunnel --url http://localhost:3000
```

It prints a URL like `https://something.trycloudflare.com`. In the
[Twilio Console](https://console.twilio.com) → Phone Numbers → your number:

| Setting              | Value (HTTP POST)                                    |
| -------------------- | ---------------------------------------------------- |
| A message comes in   | `https://<your-tunnel>/api/webhooks/twilio/sms`      |
| A call comes in      | `https://<your-tunnel>/api/webhooks/twilio/voice`    |

Now text or call your Twilio number — the AI replies live and remembers the
conversation per caller. Set `HUMAN_FORWARD_NUMBER` in `.env` to transfer
callers who ask for a person.

The only cost is the Twilio phone number itself (about $1.15/month, covered by
Twilio's free trial credit).

## 5. Host it online with Render

Render can't run the local AI, so the app uses Groq's free hosted model instead.

1. Get a free Groq API key at https://console.groq.com/keys.
2. In Render: **New + → Blueprint**, connect this GitHub repo, and click **Apply**.
   `render.yaml` sets the build, start command and settings. Paste your Groq key
   into `LLM_API_KEY` when asked.
3. When the deploy is live, copy your URL (e.g. `https://call-ai-center.onrender.com`)
   and set these on your Twilio number (HTTP POST):
   - A message comes in: `https://YOUR-URL/api/webhooks/twilio/sms`
   - A call comes in: `https://YOUR-URL/api/webhooks/twilio/voice`

> Render's free plan sleeps after 15 minutes with no traffic and takes up to a
> minute to wake, which is longer than Twilio waits. The first call or text after
> a quiet spell can fail. The Starter plan stays awake.

## 6. Outbound dialer, appointment reminders & live takeover

Open the dashboard and click the **Outbound Dialer** tab. It has five parts:

- **Campaigns & Lists**: upload numbers from Excel (.xlsx), CSV, a text file,
  exported phone contacts (.vcf), or paste them. Pick a script and start dialing.
- **Live Calls**: watch what the AI and the person are saying in real time.
  Click **Take over** and your cell rings; answer it and you're on the call
  (the customer hears hold music until you pick up). You can also call anyone
  yourself from here.
- **Appointment Reminders**: add appointments or import them from Excel/CSV.
  Reminders go out by text and/or phone call. People reply **C** to confirm,
  **R** to reschedule (the AI finds a new open time with them), or **X** to
  cancel. On a reminder call they press 1, 2 or 3, or just say it.
- **Scripts**: edit what the AI says: opening line, goal, key points,
  questions, answers to objections, closing, voicemail and rules. Test a
  script by chatting with it before it calls anyone.
- **Settings**: your business details, your cell number for takeovers,
  business hours, reminder timing, Google Meet, and the Do Not Call list.

### Setup, step by step

**Step 1. Twilio keys.** In the [Twilio Console](https://console.twilio.com) home
page, copy the **Account SID** and **Auth Token**. Note your Twilio phone number.

> A Twilio *trial* account can only call numbers you've verified and plays a
> trial message first. Upgrade the account (add a card) before calling customers.

**Step 2. Add settings in Render.** Open your service → **Environment** and add:

| Key                  | Value                                         |
| -------------------- | --------------------------------------------- |
| `ADMIN_PASSWORD`     | A password you choose (username is `admin`)   |
| `TWILIO_ACCOUNT_SID` | From step 1 (starts with `AC`)                |
| `TWILIO_AUTH_TOKEN`  | From step 1                                   |
| `TWILIO_FROM_NUMBER` | Your Twilio number, like `+13055550100`       |

Click **Save Changes**. Render restarts the app; your browser will now ask for
the password. The dialer stays locked until `ADMIN_PASSWORD` is set so nobody
else can make calls on your account.

**Step 3. Keep your data and keep it awake (needed for real use).** On the
free plan Render wipes saved files on every deploy and puts the app to sleep
after 15 quiet minutes, so lists and appointments disappear and reminders
don't go out while it sleeps. To fix both:

1. In Render, open the service → **Settings** → **Instance Type** → choose
   **Starter** ($7/month).
2. Open **Disks** → **Add Disk**: name `data`, mount path `/var/data`, size
   1 GB (about $0.25/month).
3. In **Environment** add `DATA_DIR` = `/var/data`.

The dialer screen shows a yellow warning until this is done.

**Step 4. Twilio number settings.** In Twilio → Phone Numbers → your number,
keep the two webhooks from section 5 and also set **Call status changes** to
`https://YOUR-URL/api/webhooks/twilio/call/status` (HTTP POST). This lets the
dashboard know when incoming calls end.

**Step 5. Fill in Settings** in the Outbound Dialer tab: business name,
address, **your cell number** (for takeovers), business hours and reminder
timing. Then click **Save settings**.

**Step 6 (optional). Google Meet links.** Without this you can paste one
personal Meet link in Settings and every video appointment uses it. To create
a new Meet link and calendar invite for each video appointment:

1. Go to [console.cloud.google.com](https://console.cloud.google.com), create a
   project, then **APIs & Services → Library** → enable **Google Calendar API**.
2. **APIs & Services → OAuth consent screen**: choose **External**, fill in the
   app name and your email, add the scope `.../auth/calendar.events`, then click
   **Publish app** (so the connection doesn't expire after 7 days). Google will
   show an "unverified app" warning when you connect; click **Advanced → Continue**.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID** →
   type **Web application**. Under **Authorized redirect URIs** add
   `https://YOUR-URL/api/google/callback`.
4. Copy the client ID and secret into Render as `GOOGLE_CLIENT_ID` and
   `GOOGLE_CLIENT_SECRET`, then save.
5. In the dashboard: Outbound Dialer → Settings → **Connect Google Calendar**.

### Running a campaign

1. **Campaigns & Lists → Create campaign.**
2. **Upload list**: drop in your file, check the column labels (Phone is
   required; add a "Time zone" column like `America/Chicago` for people outside
   your area), tick the permission box, and click **Add contacts**.
3. **Script & dialer settings**: choose the script and whether the AI talks or
   your phone rings when someone answers. Set:
   - **Wait after a call ends**: pause before the next dial.
   - **Calls at the same time**: start with 1.
   - **Tries per contact** and **Retry after**.
   - **Call between / Days**: in each contact's local time (8 AM–9 PM max).
   - Voicemail detection and message.
4. Click **Start dialing**, then watch **Live Calls**.

When the AI books someone, the appointment is created, they get a confirmation
text, and reminders are scheduled automatically.

### Rules the dialer follows for you

- Never calls before 8 AM or after 9 PM in the contact's time zone, and only on
  the days you pick. Contacts with no time zone are only called when it's within
  your hours everywhere from Eastern to Pacific.
- Skips anyone on the **Do Not Call list**. People are added automatically when
  they text STOP, say "stop calling" or "don't call me", or press 9 on a reminder call.
- The AI says it's an automated assistant.
- Twilio webhooks are checked with your Auth Token, so nobody can fake calls to
  your server.

**If calls or texts stop getting answers** after you add `TWILIO_AUTH_TOKEN`, the
signature check may be rejecting them (the Render logs say "rejected unsigned/invalid
webhook"). Make sure the token matches the Twilio account that owns the number. As a
last resort you can add `TWILIO_VALIDATE_SIGNATURE` = `false` in Render.

**What's still on you:** only call people who agreed to hear from you (the
upload screen asks you to confirm this). Calls with an AI voice count as
"artificial voice" calls under the TCPA, which need the person's prior consent,
and written consent for sales calls. If you call new prospects, check your list
against the [National Do Not Call Registry](https://telemarketing.donotcall.gov)
first. This isn't legal advice; check the rules for your industry and state.

## Endpoints

| Method | Path                                  | Purpose                          |
| ------ | ------------------------------------- | -------------------------------- |
| GET    | `/api/health`                         | Server + AI model status         |
| POST   | `/api/agent/chat`                     | AI reply for the dashboard       |
| POST   | `/api/webhooks/twilio/sms`            | Inbound SMS → AI reply (TwiML)   |
| POST   | `/api/webhooks/twilio/voice`          | Inbound call greeting            |
| POST   | `/api/webhooks/twilio/voice/gather`   | Caller speech → AI spoken reply  |
| POST   | `/api/webhooks/twilio/call/status`    | Call ended / answered updates    |
| *      | `/api/outbound/*`                     | Dialer, reminders, scripts (dashboard, password protected) |
