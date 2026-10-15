# LeadGenPro SMS Forwarder (Android)

Turns a spare Android phone into an SMS gateway for LeadGenPro's Agentic SMS
Dispatch feature, as an alternative to paying for a Twilio number. The app
runs quietly in the background: every SMS the phone receives is forwarded as
an HTTP POST to your LeadGenPro `api/sms-webhook.php`, using the same form
fields (`From`, `To`, `Body`, `MessageSid`) Twilio sends — so the existing
webhook code doesn't need to know the difference.

## How it works

1. A `BroadcastReceiver` listens for `android.provider.Telephony.SMS_RECEIVED`.
2. Each inbound SMS is handed to a `WorkManager` job (`ForwardWorker`), which
   POSTs it to your configured dispatch URL with automatic retry/backoff if
   the network is briefly down.
3. `api/sms-webhook.php` matches the `To` number against the `twilioPhoneNumber`
   configured in a LeadGenPro user's Agent Settings to route it to the right
   account, exactly as it does for a real Twilio number.
4. The agent's reply is only returned in the HTTP response body (TwiML) —
   this app does not currently send the reply back out as an SMS. If you need
   two-way SMS without Twilio, you'd extend `MainActivity`/`ForwardWorker`
   with `SmsManager.sendTextMessage(...)` using the reply text from the
   response; that's intentionally left out here to keep the app minimal and
   auditable.

## Building it

You need [Android Studio](https://developer.android.com/studio) (this
project can't be compiled in a headless CI/CLI sandbox without the Android
SDK, so it wasn't pre-built into an APK).

1. Open the `mobile/sms-forwarder` folder as a project in Android Studio.
2. Let it sync Gradle (needs internet access to Google's Maven repo the
   first time, to download the Android Gradle Plugin and AndroidX libraries).
3. Build → Build Bundle(s) / APK(s) → Build APK(s), or just click Run with a
   phone connected over USB (enable Developer Options → USB debugging).
4. Install the APK on the phone that will act as your SMS gateway.

## Configuring the app

Open the app and fill in:

- **Dispatch Webhook URL** — `https://yourdomain.com/api/sms-webhook.php`
  (must be publicly reachable from the phone, i.e. not `localhost`).
- **This Phone's Number** — in E.164 format (e.g. `+15551234567`). This is
  sent as the `To` field and must exactly match the **Twilio Phone Number**
  value you set in LeadGenPro's Tools → SMS Dispatch → Agent Settings, or the
  webhook won't know which account to route the message to.
- **Shared Secret** (optional but recommended) — set the same value in Agent
  Settings' **Forwarder Secret** field. When set, the webhook rejects any
  POST that doesn't carry a matching `X-Forwarder-Secret` header, which stops
  a stranger who finds your webhook URL from injecting fake "SMS."

Tap **Grant SMS Permission**, accept the Android permission prompt, then
**Send Test Forward** to confirm connectivity before relying on it — a
successful test shows up as a new conversation in the SMS Dispatch dashboard.

## Battery / reliability notes

- Some Android OEMs (Samsung, Xiaomi, Huawei, OnePlus, …) aggressively kill
  background apps. If forwarded messages go missing, disable battery
  optimization for this app (Settings → Apps → SMS Forwarder → Battery →
  Unrestricted).
- Keep the phone charged and on Wi-Fi or a data plan; there's no SMS-based
  fallback if its internet connection drops (WorkManager will retry once
  connectivity returns, but only for messages it already received).
