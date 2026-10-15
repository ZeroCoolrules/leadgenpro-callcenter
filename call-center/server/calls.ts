// Live phone calls: the call log, the AI conversation loop on a call, booking
// from a call, and taking a call over (moving it into a conference with you).
import type { CallRecord, CallScript, Contact, TranscriptLine } from '../src/types/outbound';
import { db, newId, save } from './store';
import { chatCompletion, type ChatTurn } from './llm';
import { buildScriptPrompt, fillPlaceholders, type PromptOptions } from './scripts';
import { addDnc, normalizePhone, soundsLikeOptOut, zonedToUtc } from './compliance';
import {
  confirmationSms,
  createAppointment,
  rescheduleAppointment,
  slotProblem,
  slotsSentence,
  suggestSlots,
  syncCalendar,
  takenSlotsText,
  textAppointment,
} from './appointments';
import { createCall, publicBaseUrl, say, twiml, updateCall, xmlEscape } from './twilio';

export const ACTIVE_STATES = new Set(['queued', 'ringing', 'ai', 'human']);

export function isActive(c: CallRecord) {
  return ACTIVE_STATES.has(c.state);
}

export function findCall(id: string) {
  return db.calls.find(c => c.id === id);
}
export function findCallBySid(sid: string) {
  return sid ? db.calls.find(c => c.callSid === sid) : undefined;
}

export function newCall(fields: Partial<CallRecord> & Pick<CallRecord, 'kind' | 'direction' | 'to' | 'from'>): CallRecord {
  const now = new Date().toISOString();
  const call: CallRecord = {
    id: newId('call'),
    state: 'queued',
    startedAt: now,
    lastActivityAt: now,
    transcript: [],
    takenOver: false,
    silentTurns: 0,
    ...fields,
  };
  db.calls.push(call);
  save();
  return call;
}

export function addLine(call: CallRecord, speaker: TranscriptLine['speaker'], text: string) {
  const at = new Date().toISOString();
  call.transcript.push({ speaker, text, at });
  call.lastActivityAt = at;
  save();
}

export function contactFor(call: CallRecord): Contact | undefined {
  return call.contactId ? db.contacts.find(c => c.id === call.contactId) : undefined;
}

export function scriptFor(call: CallRecord): CallScript {
  let id = '';
  if (call.campaignId) id = db.campaigns.find(c => c.id === call.campaignId)?.scriptId || '';
  else if (call.kind === 'inbound') id = db.settings.inboundScriptId;
  const byPurpose = (p: string) => db.scripts.find(s => s.purpose === p);
  return (
    db.scripts.find(s => s.id === id) ||
    (call.kind === 'reminder' ? byPurpose('reminder') : call.kind === 'inbound' ? byPurpose('inbound') : byPurpose('outbound')) ||
    db.scripts[0]
  );
}

export function promptContext(call: CallRecord) {
  const contact = contactFor(call);
  const appointment = call.appointmentId ? db.appointments.find(a => a.id === call.appointmentId) : undefined;
  return {
    settings: db.settings,
    contact: contact || { name: call.name || '', phone: call.direction === 'inbound' ? call.from : call.to },
    appointment,
  };
}

// ── Reply tags from the AI ──────────────────────────────────────────────────
export interface ParsedReply {
  text: string;
  bookedLocal?: string;
  video: boolean;
  transfer: boolean;
  optout: boolean;
  end: boolean;
}

export function parseReply(raw: string): ParsedReply {
  const booked = raw.match(/\[\[\s*BOOKED\s*:\s*(\d{4}-\d{2}-\d{2}[T ]\d{1,2}:\d{2})\s*\]\]/i);
  const has = (tag: string) => new RegExp(`\\[\\[\\s*${tag}\\s*\\]\\]`, 'i').test(raw);
  return {
    text: raw.replace(/\[\[[^\]]*\]\]/g, '').replace(/\s+\n/g, '\n').trim(),
    bookedLocal: booked?.[1].replace(' ', 'T'),
    video: has('VIDEO'),
    transfer: has('TRANSFER'),
    optout: has('OPTOUT'),
    end: has('END'),
  };
}

export async function runAi(
  script: CallScript,
  opts: PromptOptions,
  history: { role: 'user' | 'assistant'; content: string }[],
): Promise<ParsedReply> {
  const messages: ChatTurn[] = [{ role: 'system', content: buildScriptPrompt(script, opts) }, ...history];
  const raw = await chatCompletion(messages);
  if (!raw) throw new Error('Empty AI reply');
  return parseReply(raw);
}

function historyFromTranscript(call: CallRecord) {
  return call.transcript
    .filter(t => t.speaker === 'ai' || t.speaker === 'caller')
    .slice(-16)
    .map(t => ({ role: (t.speaker === 'ai' ? 'assistant' : 'user') as 'user' | 'assistant', content: t.text }));
}

// Books (or moves) an appointment from the AI's [[BOOKED]] tag.
// Returns text to say instead of the AI's reply when the time doesn't work.
export async function applyBooking(
  opts: { appointmentId?: string; name: string; phone: string; video: boolean; source: string; contact?: Contact },
  local: string,
): Promise<{ ok: boolean; message?: string; appointmentId?: string }> {
  const tz = db.settings.businessHours.timezone;
  const start = zonedToUtc(local, tz);
  if (!start) return { ok: false };
  const existing = opts.appointmentId ? db.appointments.find(a => a.id === opts.appointmentId) : undefined;
  const minutes = existing?.durationMinutes || db.settings.defaultAppointmentMinutes;
  const problem = slotProblem(start, minutes, existing?.id);
  if (problem) {
    return { ok: false, message: `Sorry, ${problem}. ${slotsSentence(suggestSlots(minutes, 3, existing?.id, start > new Date() ? new Date(start.getTime() - 86400000) : new Date()))}` };
  }
  if (existing) {
    if (opts.video) existing.video = true;
    await rescheduleAppointment(existing, start, opts.source);
    await textAppointment(existing, confirmationSms(existing), 'reschedule confirmation');
    return { ok: true, appointmentId: existing.id };
  }
  const appt = createAppointment({
    name: opts.name,
    phone: opts.phone,
    service: opts.contact?.extra?.service || 'Appointment',
    startsAt: start,
    video: opts.video,
    source: opts.source,
    notes: opts.contact?.notes,
  });
  if (opts.contact) opts.contact.status = 'booked';
  await syncCalendar(appt);
  await textAppointment(appt, confirmationSms(appt), 'booking confirmation');
  return { ok: true, appointmentId: appt.id };
}

// ── TwiML building blocks ───────────────────────────────────────────────────
export function gatherTwiml(call: CallRecord, prompt: string): string {
  return `<Gather input="speech dtmf" speechTimeout="auto" actionOnEmptyResult="true" language="en-US" action="/api/webhooks/twilio/call/turn?callId=${call.id}" method="POST">
    ${say(prompt)}
</Gather>
<Redirect method="POST">/api/webhooks/twilio/call/turn?callId=${call.id}</Redirect>`;
}

function conferenceName(call: CallRecord) {
  return `takeover-${call.id}`;
}

export function customerConferenceTwiml(call: CallRecord, intro = 'Please hold while I connect you with a team member.') {
  return `${say(intro)}
<Dial><Conference startConferenceOnEnter="false" endConferenceOnExit="true" beep="false">${conferenceName(call)}</Conference></Dial>
${say('Thank you for calling. Goodbye.')}`;
}

// The AI's turn after the caller speaks. Returns TwiML body.
export async function handleTurn(call: CallRecord, heard: string): Promise<string> {
  if (call.takenOver) return customerConferenceTwiml(call, 'One moment please.');
  if (!heard) {
    call.silentTurns += 1;
    save();
    if (call.silentTurns >= 2) {
      addLine(call, 'system', 'No response, call ended.');
      return `${say("I'm not hearing anything, so I'll let you go. Goodbye.")}<Hangup/>`;
    }
    return gatherTwiml(call, 'Sorry, are you still there?');
  }
  call.silentTurns = 0;
  addLine(call, 'caller', heard);

  const ctx = promptContext(call);
  const script = scriptFor(call);

  if (soundsLikeOptOut(heard)) {
    addDnc(call.direction === 'inbound' ? call.from : call.to, 'asked not to be called (on call)');
    call.outcome = 'Opted out';
    const bye = `I'm sorry about that. I've removed your number and you won't be called again. Goodbye.`;
    addLine(call, 'ai', bye);
    return `${say(bye)}<Hangup/>`;
  }

  let reply: ParsedReply;
  try {
    reply = await runAi(script, { ...ctx, channel: 'voice', mode: call.mode === 'reschedule' ? 'reschedule' : 'script', takenSlots: takenSlotsText(call.appointmentId) }, historyFromTranscript(call));
  } catch (err: any) {
    console.error('[AI] call turn failed:', err.message);
    reply = { text: "Sorry, I'm having a little trouble. Let me get someone from our team to help you.", video: false, transfer: true, optout: false, end: false };
  }

  let text = reply.text || 'Sorry, could you say that again?';

  if (reply.optout) {
    addDnc(call.direction === 'inbound' ? call.from : call.to, 'asked not to be contacted (AI)');
    call.outcome = 'Opted out';
    addLine(call, 'ai', text);
    return `${say(text)}<Hangup/>`;
  }

  if (reply.bookedLocal) {
    const contact = contactFor(call);
    const result = await applyBooking(
      {
        appointmentId: call.mode === 'reschedule' ? call.appointmentId : undefined,
        name: ctx.contact?.name || 'Customer',
        phone: call.direction === 'inbound' ? call.from : call.to,
        video: reply.video,
        source: `${call.kind} call`,
        contact,
      },
      reply.bookedLocal,
    );
    if (result.ok) {
      call.outcome = call.mode === 'reschedule' ? 'Rescheduled' : 'Booked';
      if (!call.appointmentId) call.appointmentId = result.appointmentId;
    } else if (result.message) {
      text = result.message;
      reply.end = false;
    }
  }

  addLine(call, 'ai', text);

  if (reply.transfer && db.settings.agentPhone) return transferFromWebhook(call, text);
  if (reply.end) return `${say(text)}<Hangup/>`;
  return gatherTwiml(call, text);
}

// First thing the AI says when a script-driven call connects.
export function openingTwiml(call: CallRecord): string {
  const script = scriptFor(call);
  const opening = fillPlaceholders(script.opening, script, promptContext(call));
  call.state = 'ai';
  call.mode = call.mode || 'script';
  addLine(call, 'ai', opening);
  return gatherTwiml(call, opening);
}

// ── Take over ───────────────────────────────────────────────────────────────
// Rings your phone into the caller's private conference room.
export async function ringAgent(call: CallRecord, agentPhone: string) {
  const to = normalizePhone(agentPhone);
  if (!to) throw new Error('Set your phone number in Dialer Settings first');
  const who = call.name || (call.direction === 'inbound' ? call.from : call.to);
  const base = publicBaseUrl();
  addLine(call, 'system', `Ringing your phone (${to})`);
  await createCall({
    to,
    twiml: twiml(`${say(`Connecting you to ${who}.`)}<Dial><Conference startConferenceOnEnter="true" endConferenceOnExit="true" beep="false">${xmlEscape(conferenceName(call))}</Conference></Dial>`),
    statusCallback: base ? `${base}/api/webhooks/twilio/agent-status?callId=${call.id}` : undefined,
    timeout: 25,
  });
}

// Used while answering a Twilio webhook: the caller goes to the conference via
// the TwiML we return, so only your phone needs to be rung.
export function transferFromWebhook(call: CallRecord, intro?: string): string {
  call.takenOver = true;
  call.state = 'human';
  addLine(call, 'system', 'Transferring to a team member');
  ringAgent(call, db.settings.agentPhone).catch(err => {
    console.error('[transfer] could not ring your phone:', err.message);
    agentMissed(call).catch(() => {});
  });
  return customerConferenceTwiml(call, intro);
}

// Moves a live caller into a private conference (they hear hold music) and rings you into it.
export async function takeOver(call: CallRecord, agentPhone: string) {
  if (!normalizePhone(agentPhone)) throw new Error('Set your phone number in Dialer Settings first');
  if (!call.callSid || !isActive(call)) throw new Error('This call is no longer live');
  if (call.takenOver) return;
  call.takenOver = true;
  call.state = 'human';
  addLine(call, 'system', 'Taken over by a team member');
  await updateCall(call.callSid, { twiml: twiml(customerConferenceTwiml(call)) });
  await ringAgent(call, agentPhone);
}

// Your phone didn't pick up: put the caller back with the AI.
export async function agentMissed(call: CallRecord) {
  if (!call.takenOver || !call.callSid || !isActive(call)) return;
  call.takenOver = false;
  call.state = 'ai';
  const text = "Sorry, nobody is available right now. I can keep helping you, or someone will call you back. What would you like to do?";
  addLine(call, 'system', 'Your phone did not answer, call returned to the AI');
  addLine(call, 'ai', text);
  await updateCall(call.callSid, { twiml: twiml(gatherTwiml(call, text)) });
}

export async function hangUp(call: CallRecord) {
  if (call.callSid && isActive(call)) await updateCall(call.callSid, { status: 'completed' });
}

// Marks calls that never got a final status (e.g. missed webhook) as finished.
export function sweepStaleCalls(onEnded: (c: CallRecord) => void) {
  const now = Date.now();
  for (const c of db.calls) {
    if (!isActive(c)) continue;
    const idle = now - new Date(c.lastActivityAt || c.startedAt).getTime();
    const limit = c.state === 'human' ? 3 * 3600000 : c.state === 'queued' || c.state === 'ringing' ? 5 * 60000 : 20 * 60000;
    if (idle > limit) {
      c.state = c.answeredAt ? 'completed' : 'failed';
      c.endedAt = new Date().toISOString();
      c.outcome = c.outcome || 'No final status from Twilio';
      onEnded(c);
    }
  }
}
