// Minimal Twilio REST client (plain fetch, no SDK) plus webhook signature checks.
import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { db } from './store';

const SID = process.env.TWILIO_ACCOUNT_SID || '';
const TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const API_BASE = process.env.TWILIO_API_BASE || 'https://api.twilio.com'; // override only for testing

export function twilioConfigured(): boolean {
  return !!(SID && TOKEN && callerId());
}

export function callerId(): string {
  return db.settings.callerId || process.env.TWILIO_FROM_NUMBER || '';
}

// Public https URL Twilio uses to reach this server.
let seenBaseUrl = '';
export function publicBaseUrl(): string {
  return (process.env.PUBLIC_BASE_URL || process.env.RENDER_EXTERNAL_URL || seenBaseUrl).replace(/\/+$/, '');
}
export function rememberBaseUrl(req: Request) {
  const host = req.get('host');
  if (host && !/^(localhost|127\.|0\.0\.0\.0)/.test(host)) seenBaseUrl = `${req.protocol}://${host}`;
}

type Params = Record<string, string | number | boolean | string[] | undefined>;

async function twilioRequest(method: 'POST' | 'GET' | 'DELETE', path: string, params: Params = {}): Promise<any> {
  if (!SID || !TOKEN) throw new Error('Twilio is not set up (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN missing)');
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '') continue;
    if (Array.isArray(v)) v.forEach(x => body.append(k, x));
    else body.append(k, String(v));
  }
  const res = await fetch(`${API_BASE}/2010-04-01/Accounts/${SID}${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${SID}:${TOKEN}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: method === 'POST' ? body : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${data.message || text.slice(0, 200)}`);
  return data;
}

export interface CreateCallOptions {
  to: string;
  url?: string;
  twiml?: string;
  statusCallback?: string;
  machineDetection?: boolean;
  timeout?: number;
}

export async function createCall(o: CreateCallOptions): Promise<{ sid: string }> {
  return twilioRequest('POST', '/Calls.json', {
    To: o.to,
    From: callerId(),
    Url: o.url,
    Twiml: o.twiml,
    Method: 'POST',
    StatusCallback: o.statusCallback,
    StatusCallbackMethod: 'POST',
    StatusCallbackEvent: o.statusCallback ? ['initiated', 'ringing', 'answered', 'completed'] : undefined,
    MachineDetection: o.machineDetection ? 'DetectMessageEnd' : undefined,
    Timeout: o.timeout,
  });
}

// Replace what a live call is doing (e.g. move it into a conference) or hang it up.
export async function updateCall(sid: string, change: { twiml?: string; status?: 'completed' }) {
  return twilioRequest('POST', `/Calls/${sid}.json`, { Twiml: change.twiml, Status: change.status });
}

export async function sendSms(to: string, body: string): Promise<{ sid: string }> {
  return twilioRequest('POST', '/Messages.json', { To: to, From: callerId(), Body: body });
}

// ── TwiML helpers ───────────────────────────────────────────────────────────
export const VOICE = process.env.TWILIO_VOICE || 'Polly.Joanna';

export function xmlEscape(s: string): string {
  return String(s).replace(/[<>&'"]/g, ch => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[ch]!));
}

export function twiml(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n${body}\n</Response>`;
}

export function sendTwiml(res: Response, body: string) {
  res.set('Content-Type', 'text/xml');
  res.send(twiml(body));
}

export function say(text: string): string {
  return `<Say voice="${VOICE}">${xmlEscape(text)}</Say>`;
}

// ── Webhook signature check ─────────────────────────────────────────────────
// Twilio signs every webhook with your Auth Token. Rejecting unsigned requests
// stops strangers from faking calls/texts to your server.
export function twilioSignatureValid(req: Request): boolean {
  const signature = req.get('x-twilio-signature');
  if (!signature) return false;
  const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  const params = req.body && typeof req.body === 'object' ? req.body : {};
  const data = Object.keys(params)
    .sort()
    .reduce((acc, k) => acc + k + params[k], url);
  const expected = crypto.createHmac('sha1', TOKEN).update(Buffer.from(data, 'utf-8')).digest('base64');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function signatureCheckEnabled(): boolean {
  return !!TOKEN && process.env.TWILIO_VALIDATE_SIGNATURE !== 'false';
}

export function requireTwilioSignature(req: Request, res: Response, next: NextFunction) {
  if (!signatureCheckEnabled() || twilioSignatureValid(req)) return next();
  console.warn(`[Twilio] rejected unsigned/invalid webhook ${req.originalUrl}`);
  res.status(403).send('Invalid Twilio signature');
}
