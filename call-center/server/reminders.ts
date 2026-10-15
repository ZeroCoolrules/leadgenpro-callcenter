// Appointment reminders by text and/or phone call, with confirm / reschedule /
// cancel by keypad, voice, or text reply.
import type { Appointment, CallRecord } from '../src/types/outbound';
import { db, save } from './store';
import { canCallNow, isDnc, addDnc, normalizePhone } from './compliance';
import { callerId, createCall, publicBaseUrl, say, twilioConfigured } from './twilio';
import {
  cancelAppointment,
  confirmAppointment,
  reminderSms,
  takenSlotsText,
  textAppointment,
} from './appointments';
import { addLine, applyBooking, gatherTwiml, newCall, runAi, scriptFor, transferFromWebhook, promptContext } from './calls';
import { fillPlaceholders, firstName, formatWhen } from './scripts';

const TICK_MS = 30000;

function upcoming(a: Appointment) {
  return a.status !== 'cancelled' && a.status !== 'completed' && new Date(a.startsAt).getTime() > Date.now();
}

function reminderKey(a: Appointment, offset: number) {
  return `${offset}h@${a.startsAt}`;
}

// Picks the reminder that's due now. If several are due (e.g. booked late),
// only the closest one is sent and the earlier ones are skipped.
function dueOffset(a: Appointment): number | null {
  const left = new Date(a.startsAt).getTime() - Date.now();
  const due = db.settings.reminderOffsetsHours
    .filter(h => h > 0 && left <= h * 3600000 && !a.remindersSent.includes(reminderKey(a, h)))
    .sort((x, y) => x - y);
  if (!due.length) return null;
  for (const h of due.slice(1)) a.remindersSent.push(reminderKey(a, h));
  return due[0];
}

export async function sendReminder(a: Appointment): Promise<string> {
  if (!twilioConfigured()) return 'Twilio is not set up';
  if (isDnc(a.phone)) return 'Number is on the Do Not Call list';
  const channel = db.settings.reminderChannel;
  const wantCall = channel !== 'sms' && a.status !== 'confirmed';
  const hours = { ...db.settings.defaultDialer, callingHoursStart: 8, callingHoursEnd: 21, callingDays: [0, 1, 2, 3, 4, 5, 6], timezone: db.settings.businessHours.timezone, unknownTimezoneMode: 'campaign' as const };
  const callOk = wantCall && !!publicBaseUrl() && canCallNow(db.settings.businessHours.timezone, hours);

  let sent = '';
  if (channel !== 'call' || !callOk) {
    if (await textAppointment(a, reminderSms(a), 'reminder')) sent = 'text';
  }
  if (callOk) {
    const base = publicBaseUrl();
    const call = newCall({
      kind: 'reminder',
      direction: 'outbound',
      appointmentId: a.id,
      name: a.name,
      to: a.phone,
      from: callerId(),
      mode: 'reminder_menu',
    });
    try {
      const res = await createCall({
        to: a.phone,
        url: `${base}/api/webhooks/twilio/call/answer?callId=${call.id}`,
        statusCallback: `${base}/api/webhooks/twilio/call/status?callId=${call.id}`,
        machineDetection: true,
        timeout: 25,
      });
      call.callSid = res.sid;
      a.history.push({ at: new Date().toISOString(), text: 'Reminder call placed' });
      sent = sent ? `${sent} and call` : 'call';
    } catch (err: any) {
      call.state = 'failed';
      call.outcome = err.message;
      a.history.push({ at: new Date().toISOString(), text: `Reminder call failed: ${err.message}` });
    }
  }
  save();
  return sent ? `Reminder sent by ${sent}` : 'Reminder could not be sent (see appointment history)';
}

async function tick() {
  if (!twilioConfigured()) return;
  for (const a of db.appointments) {
    if (!upcoming(a)) continue;
    const offset = dueOffset(a);
    if (offset === null) continue;
    a.remindersSent.push(reminderKey(a, offset));
    save();
    await sendReminder(a).catch(err => console.error('[reminders]', err.message));
  }
}

export function startReminders() {
  setInterval(tick, TICK_MS);
  setTimeout(tick, 5000);
}

// Reminder call didn't reach a person: fall back to a text so they still get it.
export function onReminderCallEnded(call: CallRecord) {
  const a = call.appointmentId ? db.appointments.find(x => x.id === call.appointmentId) : undefined;
  if (!a || call.answeredAt || db.settings.reminderChannel !== 'call') return;
  if (['no-answer', 'busy', 'failed', 'canceled'].includes(call.state)) {
    textAppointment(a, reminderSms(a), 'reminder (call not answered)');
  }
}

// ── Reminder phone call ─────────────────────────────────────────────────────
function menuTwiml(call: CallRecord, a: Appointment, intro: string) {
  const video = a.video ? ' This is a video appointment, and the Google Meet link has been texted to you.' : '';
  return `<Gather input="dtmf speech" numDigits="1" speechTimeout="auto" actionOnEmptyResult="true" hints="confirm, reschedule, cancel, representative" action="/api/webhooks/twilio/reminder/choice?callId=${call.id}" method="POST">
  ${say(`${intro}${video} Press 1 or say confirm to keep it. Press 2 or say reschedule to pick a new time. Press 3 to cancel. Press 0 to talk to someone.`)}
</Gather>
<Redirect method="POST">/api/webhooks/twilio/reminder/choice?callId=${call.id}</Redirect>`;
}

export function reminderAnswerTwiml(call: CallRecord): string {
  const a = db.appointments.find(x => x.id === call.appointmentId);
  if (!a) return `${say('Sorry, we could not find your appointment. Goodbye.')}<Hangup/>`;
  const script = scriptFor(call);
  const intro = fillPlaceholders(script.opening, script, promptContext(call));
  call.state = 'ai';
  addLine(call, 'ai', intro);
  return menuTwiml(call, a, intro);
}

export function reminderVoicemail(call: CallRecord): string {
  const script = scriptFor(call);
  return script.voicemail ? fillPlaceholders(script.voicemail, script, promptContext(call)) : '';
}

export async function reminderChoice(call: CallRecord, digits: string, speech: string): Promise<string> {
  const a = db.appointments.find(x => x.id === call.appointmentId);
  if (!a) return `${say('Goodbye.')}<Hangup/>`;
  const heard = speech.toLowerCase();
  if (speech || digits) addLine(call, 'caller', speech || `pressed ${digits}`);
  const choice =
    digits.charAt(0) ||
    (/reschedul|change|move|different|another/.test(heard) ? '2'
      : /cancel/.test(heard) ? '3'
      : /stop calling|do not call|don'?t call/.test(heard) ? '9'
      : /person|human|representative|someone|agent|operator/.test(heard) ? '0'
      : /confirm|yes|keep|that works|sounds good/.test(heard) ? '1'
      : '');
  const script = scriptFor(call);
  const ctx = promptContext(call);
  const tz = db.settings.businessHours.timezone;

  if (choice === '1') {
    confirmAppointment(a, 'reminder call');
    call.outcome = 'Confirmed';
    const bye = fillPlaceholders(script.closing, script, ctx);
    addLine(call, 'ai', bye);
    return `${say(bye)}<Hangup/>`;
  }
  if (choice === '2') {
    a.status = 'reschedule_requested';
    call.mode = 'reschedule';
    save();
    const ask = 'No problem. What day and time would work better for you?';
    addLine(call, 'ai', ask);
    return gatherTwiml(call, ask);
  }
  if (choice === '3') {
    await cancelAppointment(a, 'reminder call');
    call.outcome = 'Cancelled';
    const bye = `Okay, your appointment on ${formatWhen(a.startsAt, tz)} has been cancelled. If you'd like to book again, just call or text us. Goodbye.`;
    addLine(call, 'ai', bye);
    return `${say(bye)}<Hangup/>`;
  }
  if (choice === '0' && db.settings.agentPhone) {
    return transferFromWebhook(call);
  }
  if (choice === '9') {
    addDnc(a.phone, 'opted out on reminder call');
    call.outcome = 'Opted out';
    return `${say("Understood. You won't receive any more reminder calls. Goodbye.")}<Hangup/>`;
  }
  call.silentTurns += 1;
  save();
  if (call.silentTurns >= 2) {
    return `${say(`No problem. Your appointment is still on for ${formatWhen(a.startsAt, tz)}. Goodbye.`)}<Hangup/>`;
  }
  return menuTwiml(call, a, 'Sorry, I didn\'t get that.');
}

// ── Text replies to reminders ───────────────────────────────────────────────
interface SmsSession {
  appointmentId: string;
  history: { role: 'user' | 'assistant'; content: string }[];
  expires: number;
}
const smsSessions = new Map<string, SmsSession>();

function appointmentForPhone(phone: string): Appointment | undefined {
  const p = normalizePhone(phone);
  return db.appointments
    .filter(a => a.phone === p && a.status !== 'cancelled' && a.status !== 'completed' && new Date(a.startsAt).getTime() > Date.now() - 3600000)
    .sort((x, y) => x.startsAt.localeCompare(y.startsAt))[0];
}

// Returns the text to reply with, or null if this message isn't about an appointment.
export async function handleAppointmentSms(from: string, body: string): Promise<string | null> {
  const phone = normalizePhone(from);
  const text = body.trim();
  const word = text.toLowerCase().replace(/[^a-z0-9]/g, '');
  let session = smsSessions.get(phone);
  if (session && session.expires < Date.now()) {
    smsSessions.delete(phone);
    session = undefined;
  }
  const a = session ? db.appointments.find(x => x.id === session!.appointmentId) : appointmentForPhone(phone);
  if (!a) return null;
  const tz = db.settings.businessHours.timezone;
  const when = formatWhen(a.startsAt, tz);

  if (!session) {
    if (['c', 'confirm', 'confirmed', 'yes', 'y', '1'].includes(word)) {
      confirmAppointment(a, 'text reply');
      return `Thanks ${firstName(a.name)}! You're confirmed for ${when}. See you then.`;
    }
    if (['x', '3', 'cancelappt', 'cancelappointment'].includes(word)) {
      await cancelAppointment(a, 'text reply');
      return `Your appointment on ${when} has been cancelled. Text us anytime to book again.`;
    }
    const wantsMove = ['r', '2', 'reschedule'].includes(word) || /reschedul|move (it|my)|change (the|my) (time|appointment)|different (day|time)|can'?t make it/i.test(text);
    if (!wantsMove) return null;
    a.status = 'reschedule_requested';
    save();
    session = { appointmentId: a.id, history: [], expires: Date.now() + 2 * 3600000 };
    smsSessions.set(phone, session);
    if (['r', '2', 'reschedule'].includes(word)) {
      const ask = `Sure! What day and time works better for you? Your current time is ${when}.`;
      session.history.push({ role: 'user', content: 'I need to reschedule.' }, { role: 'assistant', content: ask });
      return ask;
    }
  }

  session.history.push({ role: 'user', content: text });
  session.expires = Date.now() + 2 * 3600000;
  const script = db.scripts.find(s => s.purpose === 'reminder') || db.scripts[0];
  let reply;
  try {
    reply = await runAi(script, { settings: db.settings, contact: { name: a.name, phone: a.phone }, appointment: a, channel: 'sms', mode: 'reschedule', takenSlots: takenSlotsText(a.id) }, session.history.slice(-12));
  } catch (err: any) {
    console.error('[AI] sms reschedule failed:', err.message);
    return "Thanks! Someone from our team will text you shortly to find a new time.";
  }
  let out = reply.text;
  if (reply.optout) {
    addDnc(phone, 'asked not to be contacted (text)');
    smsSessions.delete(phone);
    return out || "Understood, we won't contact you again.";
  }
  if (reply.bookedLocal) {
    const result = await applyBooking({ appointmentId: a.id, name: a.name, phone, video: reply.video, source: 'text reply' }, reply.bookedLocal);
    if (result.ok) {
      smsSessions.delete(phone);
      // applyBooking already texted the confirmation with the new time.
      return '';
    }
    if (result.message) out = result.message;
  }
  session.history.push({ role: 'assistant', content: out });
  return out;
}
