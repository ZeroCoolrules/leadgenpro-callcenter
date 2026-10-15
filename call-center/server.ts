import './server/env';
import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { chatCompletion, llmConfig, llmReachable } from './server/llm';
import { buildMessages, isEscalation, parseAgentReply } from './server/agent';
import { INITIAL_CLIENTS } from './src/data/seedData';
import { basicAuth } from './server/auth';
import { rememberBaseUrl, requireTwilioSignature, callerId } from './server/twilio';
import { registerOutbound } from './server/outboundRoutes';
import { startDialer } from './server/dialer';
import { handleAppointmentSms, startReminders } from './server/reminders';
import { addDnc } from './server/compliance';
import { addLine, customerConferenceTwiml, findCallBySid, newCall, openingTwiml } from './server/calls';
import { db } from './server/store';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const PRODUCTION = process.env.NODE_ENV === 'production' || process.argv.includes('--prod');

// Render (and most hosts) sit behind a proxy; trust it so https URLs are right.
app.set('trust proxy', true);

// Password-protect the dashboard and API when ADMIN_PASSWORD is set.
app.use(basicAuth);

// Enable JSON and URL-encoded body parsing (for Twilio webhook form posts)
app.use(express.json({ limit: '15mb' })); // big enough for large contact lists
app.use(express.urlencoded({ extended: true }));

// Remember our public address (used when placing outbound calls) and only
// accept webhooks that Twilio really signed.
app.use((req, res, next) => {
  rememberBaseUrl(req);
  next();
});
app.use('/api/webhooks/twilio', requireTwilioSignature);

// Live phone conversations, keyed by caller number. Kept in memory so the AI
// remembers earlier messages from the same person across SMS/voice turns.
const MAX_HISTORY = 12;
const phoneHistory = new Map<string, { role: string; text: string }[]>();

function remember(key: string, role: 'user' | 'model', text: string) {
  const h = phoneHistory.get(key) || [];
  h.push({ role, text });
  phoneHistory.set(key, h.slice(-MAX_HISTORY));
}

// Pick the business that owns the dialed number, falling back to the first one.
function clientForNumber(to: string) {
  const digits = String(to || '').replace(/\D/g, '').slice(-10);
  return (
    INITIAL_CLIENTS.find(c => c.trackingPhoneNumber.replace(/\D/g, '').slice(-10) === digits) ||
    INITIAL_CLIENTS[0]
  );
}

function xmlEscape(s: string): string {
  return s.replace(/[<>&'"]/g, ch => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[ch]!));
}

function sendTwiml(res: Response, body: string) {
  res.set('Content-Type', 'text/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n${body}\n</Response>`);
}

// Runs one AI turn for a live caller; falls back to a safe reply if the model is down or slow.
async function liveAgentReply(from: string, to: string, text: string): Promise<string> {
  const client = clientForNumber(to);
  const lead = { name: 'Customer', phone: from };
  let reply = `Hi! I can help schedule your appointment at ${client.name}. What day and time are you looking for?`;
  try {
    const raw = await chatCompletion(buildMessages(client, lead, phoneHistory.get(from), text));
    if (raw) reply = parseAgentReply(raw).reply;
  } catch (err: any) {
    console.error('[AI] fallback reply used:', err.message);
  }
  remember(from, 'user', text);
  remember(from, 'model', reply);
  return reply;
}

// 1. Health endpoint
app.get('/api/health', async (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    system: 'Agentic Dispatch Host',
    llm: { baseUrl: llmConfig.baseUrl, model: llmConfig.model, reachable: await llmReachable() },
    port: PORT,
  });
});

// 2. AI chat endpoint used by the dashboard / phone simulator
app.post('/api/agent/chat', async (req: Request, res: Response) => {
  const { message, client, lead, history } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message text required' });
  }

  try {
    const raw = await chatCompletion(buildMessages(client, lead, history, message));
    if (!raw) throw new Error('Empty model response');
    res.json(parseAgentReply(raw));
  } catch (error: any) {
    // Model offline: tell the browser so it uses its built-in deterministic engine.
    console.error('[AI] chat error:', error.message);
    res.status(503).json({ error: 'AI model unavailable', details: error.message });
  }
});

// 3. Twilio Inbound SMS Webhook
// Twilio sends POST with Form URL-encoded: From, To, Body, MessageSid
const OPT_OUT = new Set(['stop', 'stopall', 'unsubscribe', 'cancel', 'end', 'quit']);
app.post('/api/webhooks/twilio/sms', async (req: Request, res: Response) => {
  const from = String(req.body.From || '');
  const to = String(req.body.To || '');
  const body = String(req.body.Body || '').trim();
  console.log(`[Twilio SMS] ${from} -> ${to}: "${body}"`);

  // Twilio handles STOP/opt-out replies itself; don't send anything extra.
  // We also add them to our Do Not Call list so the dialer skips them.
  if (!body || OPT_OUT.has(body.toLowerCase())) {
    phoneHistory.delete(from);
    if (body) addDnc(from, `texted ${body.toUpperCase()}`);
    return sendTwiml(res, '');
  }

  // Replies to appointment reminders (C / R / X, or "can we move it?").
  const apptReply = await handleAppointmentSms(from, body);
  if (apptReply !== null) {
    console.log(`[Twilio SMS] appointment reply to ${from}: "${apptReply}"`);
    return sendTwiml(res, apptReply ? `    <Message>${xmlEscape(apptReply)}</Message>` : '');
  }

  const reply = await liveAgentReply(from, to, body);
  console.log(`[Twilio SMS] reply to ${from}: "${reply}"`);
  sendTwiml(res, `    <Message>${xmlEscape(reply)}</Message>`);
});

// 4. Twilio Inbound Voice Webhook
const VOICE = process.env.TWILIO_VOICE || 'Polly.Joanna';
function gather(prompt: string): string {
  return `    <Gather input="speech" speechTimeout="auto" action="/api/webhooks/twilio/voice/gather" method="POST">
        <Say voice="${VOICE}">${xmlEscape(prompt)}</Say>
    </Gather>
    <Say voice="${VOICE}">I didn't catch that. Please call back or send us a text. Goodbye.</Say>`;
}

app.post('/api/webhooks/twilio/voice', (req: Request, res: Response) => {
  const from = String(req.body.From || 'Unknown');
  const client = clientForNumber(String(req.body.To || ''));
  console.log(`[Twilio Voice] inbound call from ${from}`);
  phoneHistory.delete(from);
  // Track the call so it shows under Live Calls and can be taken over.
  const call = newCall({
    kind: 'inbound',
    direction: 'inbound',
    from,
    to: String(req.body.To || callerId()),
    callSid: String(req.body.CallSid || ''),
    state: 'ai',
    answeredAt: new Date().toISOString(),
  });
  // A script chosen in Dialer Settings → Inbound script runs the call.
  if (db.settings.inboundScriptId && db.scripts.some(s => s.id === db.settings.inboundScriptId)) {
    return sendTwiml(res, openingTwiml(call));
  }
  const greeting = `Thank you for calling ${client.name}. What service would you like to book, and what day and time works for you?`;
  addLine(call, 'ai', greeting);
  sendTwiml(res, gather(greeting));
});

// 5. Speech result from <Gather>: answer with the AI and keep listening
app.post('/api/webhooks/twilio/voice/gather', async (req: Request, res: Response) => {
  const from = String(req.body.From || 'Unknown');
  const to = String(req.body.To || '');
  const speech = String(req.body.SpeechResult || '').trim();
  console.log(`[Twilio Voice] ${from} said: "${speech}"`);
  const call = findCallBySid(String(req.body.CallSid || ''));
  if (call?.takenOver) return sendTwiml(res, customerConferenceTwiml(call, 'One moment please.'));

  if (!speech) {
    return sendTwiml(res, gather('Sorry, could you repeat that?'));
  }

  if (call) addLine(call, 'caller', speech);
  const reply = await liveAgentReply(from, to, speech);
  if (call) addLine(call, 'ai', reply);
  if (isEscalation(reply) && process.env.HUMAN_FORWARD_NUMBER) {
    return sendTwiml(
      res,
      `    <Say voice="${VOICE}">${xmlEscape(reply)}</Say>\n    <Dial>${xmlEscape(process.env.HUMAN_FORWARD_NUMBER)}</Dial>`,
    );
  }
  sendTwiml(res, gather(reply));
});

// 6. Outbound dialer, reminders, scripts, settings + their Twilio webhooks
registerOutbound(app);

// 7. Frontend: Vite dev middleware, or the prebuilt bundle in production
async function startServer() {
  if (PRODUCTION) {
    const dist = path.resolve('dist');
    if (!fs.existsSync(path.join(dist, 'index.html'))) {
      throw new Error('dist/ not found. Run "npm run build" first.');
    }
    app.use(express.static(dist));
    app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  }

  startDialer();
  startReminders();

  app.listen(PORT, '0.0.0.0', async () => {
    console.log(`🚀 Agentic Dispatch Host running on http://localhost:${PORT} (${PRODUCTION ? 'production' : 'dev'})`);
    const ok = await llmReachable();
    console.log(
      ok
        ? `🤖 AI model ready: ${llmConfig.model} @ ${llmConfig.baseUrl}`
        : `⚠️  AI model not reachable at ${llmConfig.baseUrl}. Install Ollama and run "ollama pull ${llmConfig.model}". Using built-in fallback replies until then.`,
    );
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
