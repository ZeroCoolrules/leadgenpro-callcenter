# LeadGenPro

## Project Overview
LeadGenPro is a powerful lead generation tool designed to help businesses capture and manage leads effectively. It offers a seamless user experience, integrates with popular marketing platforms, and provides analytics to help businesses grow their customer base.

## Features
- **User-Friendly Interface:** Easy to navigate dashboard for managing leads.
- **Integration:** Connects with various marketing tools like Mailchimp, HubSpot, and Zapier.
- **Analytics:** Provides insights into lead behavior and conversion rates.
- **Customizable Forms:** Create and modify lead capture forms to fit your business needs.
- **Real-Time Notifications:** Stay updated with instant notifications when new leads are captured.
- **Agentic SMS Dispatch:** An AI SMS agent (Tools → SMS Dispatch) that answers leads by text, checks availability, books appointments, sends reminders, and escalates tricky conversations to a human. See below for setup.

## Agentic SMS Dispatch

This ports the standalone "Dispatch Agentic System" SMS bot into LeadGen Pro so it shares the same leads database, API keys, and dashboard.

- **Backend:** `api/sms-agent.php` (the agent engine), `api/sms-webhook.php` (Twilio inbound webhook), `api/sms-simulate.php` (dashboard simulator), `api/sms-conversations.php`, `api/sms-appointments.php`, `api/sms-handoffs.php`, `api/sms-settings.php`, and `api/sms-process-reminders.php` (run on a cron schedule to dispatch appointment reminders).
- **Data:** SMS messages are logged on the existing `lead_activities` table (`activity_type = 'sms'`); new tables `sms_conversations`, `sms_availability`, `sms_appointments`, `sms_reminders`, and `sms_handoffs` hold everything specific to the dispatch flow (see `database.sql`).
- **AI engine:** Uses OpenAI function calling (`gpt-4o-mini`) when an OpenAI API key is configured in Tools → SMS Dispatch → Agent Settings. Without a key, the agent runs on a rules-based fallback ("Simulation Mode") so you can try the flow with no external services.
- **Going live with Twilio:** Set your Twilio phone number, Account SID, and Auth Token in Agent Settings, then point that number's SMS webhook to `https://yourdomain.com/api/sms-webhook.php`.
- **Going live without Twilio:** `mobile/sms-forwarder` is a small Android app you install on a spare phone instead — it forwards every SMS the phone receives to `api/sms-webhook.php` using the same fields Twilio sends, so no code changes are needed. Set that phone's number as the "Twilio Phone Number" in Agent Settings and configure a shared "Forwarder Secret" there so the webhook only accepts requests from your phone. See `mobile/sms-forwarder/README.md`.
- **Dashboard:** The SMS Dispatch tool tab includes a live simulator, conversation list, human handoff queue, and appointments view. It calls the real API when you're logged in with an account backed by a configured database, and degrades to a local, backend-free demo otherwise.

## Deploying to Render

LeadGenPro is a PHP/MySQL app, and Render has no native PHP runtime, so it ships as a Docker web service (`Dockerfile` in the repo root, Apache + PHP 8.2 + `pdo_mysql`).

1. **Database first — Render has no managed MySQL.** Provision MySQL somewhere else (PlanetScale, Railway, Aiven, AWS RDS, DigitalOcean, etc.), then load the schema: `mysql -h <host> -u <user> -p <database> < database.sql`.
2. **Create the web service.** In the Render dashboard, New → Blueprint, point it at this repo (it picks up `render.yaml` and the `Dockerfile` automatically). Or New → Web Service → Environment: Docker, if you'd rather configure it by hand.
3. **Set environment variables** on the service (Render dashboard → Environment): `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` (from step 1) and `APP_URL` (the `https://<your-service>.onrender.com` URL Render assigns — this gets added to the CORS allow-list automatically).
4. **Point the frontend at the API.** Edit the `API_BASE_URL` constant near the bottom of `login.html` and `register.html` to `https://<your-service>.onrender.com/api`, commit, and push (Render auto-deploys on push).
5. Log in with the seeded admin (`admin@leadgenpro.com` / `admin123`) and change the password immediately.

`api/config.php` reads `DB_HOST`/`DB_NAME`/`DB_USER`/`DB_PASSWORD` from the environment when present, falling back to its in-file placeholders otherwise — so the same codebase works unmodified on both a Render/Docker deploy and a classic cPanel install where you edit `config.php` directly.

## Quick Start
To get started with LeadGenPro, follow the quick start guide:
1. Clone the repository to your local machine:
   ```bash
   git clone https://github.com/ZeroCoolrules/leadgenpro.git
   cd leadgenpro
   ```
2. Install the required dependencies:
   ```bash
   npm install
   ```
3. Run the application:
   ```bash
   npm start
   ```

## System Requirements
- Node.js version 14 or higher
- npm version 6 or higher
- A modern web browser (Chrome, Firefox, Safari)

## Installation Instructions
1. **Clone the Repository:** Use the command given in the Quick Start section.
2. **Install Dependencies:** Run `npm install` in the project directory to install all necessary packages. 
3. **Set Up Environment Variables:** Create a `.env` file in the root directory and specify your configuration settings.
4. **Start the Application:** Use `npm start` to launch LeadGenPro.

## Configuration
Configuring LeadGenPro is straightforward. Use the `.env` file to set your preferences:
- `DATABASE_URL`: Connection string for your lead database.
- `EMAIL_SERVICE`: Choose the email service for notifications.
- `API_KEYS`: Include any necessary API keys for third-party integrations.

## Security Checklist
- Regularly update dependencies to minimize vulnerabilities.
- Use HTTPS for all network communications.
- Implement authentication for user access to sensitive areas of the application.
- Keep your `API_KEYS` safe and do not expose them in client-side code.

## Troubleshooting
If you encounter issues while using LeadGenPro:
- Check the terminal for error logs that may indicate what went wrong.
- Ensure that you have installed all required dependencies.
- Verify that your environment variables are set correctly.
- Consult the [GitHub issues page](https://github.com/ZeroCoolrules/leadgenpro/issues) for known issues and fixes.

## Support
For support, please open an issue on the [GitHub repository](https://github.com/ZeroCoolrules/leadgenpro/issues) or contact the project maintainers directly. We appreciate your contributions and feedback! 

---
LeadGenPro © 2026 by ZeroCoolrules. All rights reserved.