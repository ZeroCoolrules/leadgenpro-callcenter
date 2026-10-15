// The outbound auto dialer. Every few seconds it looks at running campaigns
// and starts the next call when a line is free, the wait-after-call has
// passed, and it's inside calling hours for that contact.
import type { CallRecord, Campaign, Contact } from '../src/types/outbound';
import { db, save } from './store';
import { canCallNow, isDnc } from './compliance';
import { createCall, publicBaseUrl, twilioConfigured, callerId } from './twilio';
import { isActive, newCall, sweepStaleCalls } from './calls';
import { onReminderCallEnded } from './reminders';

const TICK_MS = 3000;
const RETRY_STATES = new Set(['pending', 'no_answer', 'busy', 'failed', 'voicemail']);
const FATAL_TWILIO = /21211|21214|21215|21216|21217|21219|21401|21612|13224|not a valid phone|unverified/i;

export function campaignStats(c: Campaign) {
  const list = db.contacts.filter(x => x.campaignId === c.id);
  const count = (pred: (x: Contact) => boolean) => list.filter(pred).length;
  return {
    total: list.length,
    remaining: count(x => isDialable(c, x, false)),
    booked: count(x => x.status === 'booked'),
    answered: count(x => x.status === 'answered' || x.status === 'completed'),
    voicemail: count(x => x.status === 'voicemail'),
    noAnswer: count(x => x.status === 'no_answer' || x.status === 'busy'),
    failed: count(x => x.status === 'failed'),
    dnc: count(x => x.status === 'dnc'),
    activeCalls: db.calls.filter(k => k.campaignId === c.id && isActive(k)).length,
  };
}

function isDialable(c: Campaign, x: Contact, checkTime = true): boolean {
  if (!RETRY_STATES.has(x.status)) return false;
  if (x.attempts >= c.settings.maxAttempts) return false;
  if (isDnc(x.phone)) return false;
  if (checkTime && x.nextAttemptAt && new Date(x.nextAttemptAt).getTime() > Date.now()) return false;
  return true;
}

function nextContact(c: Campaign): Contact | undefined {
  for (const x of db.contacts) {
    if (x.campaignId !== c.id || !isDialable(c, x)) continue;
    if (!canCallNow(x.timezone, c.settings)) continue;
    return x;
  }
  return undefined;
}

async function dial(c: Campaign, contact: Contact) {
  const base = publicBaseUrl();
  contact.status = 'calling';
  contact.attempts += 1;
  contact.lastAttemptAt = new Date().toISOString();
  const call = newCall({
    kind: 'campaign',
    direction: 'outbound',
    campaignId: c.id,
    contactId: contact.id,
    name: contact.name,
    to: contact.phone,
    from: callerId(),
  });
  try {
    const res = await createCall({
      to: contact.phone,
      url: `${base}/api/webhooks/twilio/call/answer?callId=${call.id}`,
      statusCallback: `${base}/api/webhooks/twilio/call/status?callId=${call.id}`,
      machineDetection: c.settings.machineDetection,
      timeout: c.settings.ringTimeoutSeconds,
    });
    call.callSid = res.sid;
    c.failuresInRow = 0;
    c.lastError = undefined;
  } catch (err: any) {
    console.error(`[dialer] call to ${contact.phone} failed:`, err.message);
    call.state = 'failed';
    call.endedAt = new Date().toISOString();
    call.outcome = err.message;
    if (FATAL_TWILIO.test(err.message)) contact.attempts = c.settings.maxAttempts;
    c.failuresInRow = (c.failuresInRow || 0) + 1;
    c.lastError = err.message;
    if (c.failuresInRow >= 5) {
      c.status = 'paused';
      c.lastError = `Paused after 5 failed calls in a row. Last error: ${err.message}`;
    }
    onCallEnded(call);
  }
  save();
}

// Updates the contact and campaign once a call is over.
export function onCallEnded(call: CallRecord) {
  if (call.kind === 'reminder') onReminderCallEnded(call);
  const campaign = call.campaignId ? db.campaigns.find(c => c.id === call.campaignId) : undefined;
  if (campaign) campaign.lastCallEndedAt = new Date().toISOString();
  const contact = call.contactId ? db.contacts.find(c => c.id === call.contactId) : undefined;
  if (contact && campaign) {
    if (isDnc(contact.phone)) contact.status = 'dnc';
    else if (contact.status === 'booked') {
      /* keep */
    } else if (call.state === 'completed') contact.status = 'answered';
    else if (call.state === 'voicemail') contact.status = 'voicemail';
    else if (call.state === 'busy') contact.status = 'busy';
    else if (call.state === 'no-answer' || call.state === 'canceled') contact.status = 'no_answer';
    else contact.status = 'failed';
    contact.lastOutcome = call.outcome || call.state;
    if (RETRY_STATES.has(contact.status) && contact.attempts < campaign.settings.maxAttempts) {
      contact.nextAttemptAt = new Date(Date.now() + campaign.settings.retryDelayMinutes * 60000).toISOString();
    }
  }
  save();
}

let ticking = false;
async function tick() {
  if (ticking) return;
  ticking = true;
  try {
    sweepStaleCalls(onCallEnded);
    if (!twilioConfigured() || !publicBaseUrl()) return;
    for (const c of db.campaigns) {
      if (c.status !== 'running') continue;
      const s = c.settings;
      const active = db.calls.filter(k => k.campaignId === c.id && isActive(k)).length;
      if (active >= Math.max(1, s.maxConcurrentCalls)) continue;
      if (c.lastCallEndedAt && Date.now() - new Date(c.lastCallEndedAt).getTime() < s.delayAfterCallSeconds * 1000) continue;
      const contact = nextContact(c);
      if (contact) {
        await dial(c, contact);
        continue;
      }
      const remaining = db.contacts.some(x => x.campaignId === c.id && (isDialable(c, x, false) || x.status === 'calling'));
      if (!remaining && active === 0) {
        c.status = 'completed';
        save();
        console.log(`[dialer] campaign "${c.name}" finished`);
      }
    }
  } catch (err: any) {
    console.error('[dialer] tick error:', err.message);
  } finally {
    ticking = false;
  }
}

export function startDialer() {
  // Calls left "calling" by a restart can't be tracked any more.
  for (const x of db.contacts) if (x.status === 'calling') x.status = 'failed';
  setInterval(tick, TICK_MS);
}
