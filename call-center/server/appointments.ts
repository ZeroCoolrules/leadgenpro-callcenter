// Appointment booking rules: open-slot checks, suggestions, create/move/cancel,
// and the confirmation / reminder text messages.
import type { Appointment } from '../src/types/outbound';
import { db, newId, save } from './store';
import { isDnc, normalizePhone, zonedParts, zonedToUtc } from './compliance';
import { formatWhen, firstName } from './scripts';
import { cancelCalendarEvent, syncAppointmentToCalendar } from './google';
import { sendSms, twilioConfigured } from './twilio';

const SLOT_STEP_MIN = 30;

function overlapCount(start: Date, minutes: number, excludeId?: string): number {
  const s = start.getTime();
  const e = s + minutes * 60000;
  return db.appointments.filter(a => {
    if (a.id === excludeId || a.status === 'cancelled') return false;
    const as = new Date(a.startsAt).getTime();
    const ae = as + a.durationMinutes * 60000;
    return as < e && s < ae;
  }).length;
}

// Returns '' if the slot is bookable, otherwise a short reason.
export function slotProblem(start: Date, minutes: number, excludeId?: string): string {
  const { businessHours: bh, appointmentsPerSlot } = db.settings;
  if (start.getTime() < Date.now() + 15 * 60000) return 'that time has already passed';
  const p = zonedParts(start, bh.timezone);
  const end = zonedParts(new Date(start.getTime() + minutes * 60000), bh.timezone);
  if (!bh.days.includes(p.weekday)) return "we're closed that day";
  const startMin = p.hour * 60 + p.minute;
  const endMin = end.day === p.day ? end.hour * 60 + end.minute : 24 * 60;
  if (startMin < bh.startHour * 60 || endMin > bh.endHour * 60) return "that's outside our hours";
  if (overlapCount(start, minutes, excludeId) >= Math.max(1, appointmentsPerSlot)) return 'that time is already booked';
  return '';
}

export function suggestSlots(minutes: number, count = 3, excludeId?: string, from = new Date()): Date[] {
  const out: Date[] = [];
  let t = Math.ceil((from.getTime() + 60 * 60000) / (SLOT_STEP_MIN * 60000)) * SLOT_STEP_MIN * 60000;
  const limit = from.getTime() + 21 * 24 * 3600000;
  while (out.length < count && t < limit) {
    const d = new Date(t);
    if (!slotProblem(d, minutes, excludeId)) {
      out.push(d);
      t += 3 * 3600000; // spread suggestions out a bit
    } else {
      t += SLOT_STEP_MIN * 60000;
    }
  }
  return out;
}

export function takenSlotsText(excludeId?: string): string[] {
  const tz = db.settings.businessHours.timezone;
  const now = Date.now();
  const horizon = now + 14 * 24 * 3600000;
  const busy = db.appointments.filter(a => {
    const t = new Date(a.startsAt).getTime();
    return a.id !== excludeId && a.status !== 'cancelled' && t > now && t < horizon;
  });
  // With several staff only fully-booked times matter.
  if (db.settings.appointmentsPerSlot > 1) {
    return busy
      .filter(a => overlapCount(new Date(a.startsAt), a.durationMinutes, excludeId) >= db.settings.appointmentsPerSlot)
      .map(a => formatWhen(a.startsAt, tz));
  }
  return busy.slice(0, 40).map(a => formatWhen(a.startsAt, tz));
}

export function slotsSentence(slots: Date[]): string {
  const tz = db.settings.businessHours.timezone;
  const labels = slots.map(d => formatWhen(d.toISOString(), tz));
  if (!labels.length) return "I don't see any openings in the next few weeks. Someone from our team will reach out to find a time.";
  if (labels.length === 1) return `The closest opening is ${labels[0]}.`;
  return `I can do ${labels.slice(0, -1).join(', ')} or ${labels[labels.length - 1]}. Which works best?`;
}

function log(a: Appointment, text: string) {
  a.history.push({ at: new Date().toISOString(), text });
}

export interface NewAppointment {
  name: string;
  phone: string;
  email?: string;
  service?: string;
  startsAt: Date;
  durationMinutes?: number;
  video?: boolean;
  notes?: string;
  meetLink?: string;
  source: string;
}

export function createAppointment(input: NewAppointment): Appointment {
  const a: Appointment = {
    id: newId('apt'),
    name: input.name || 'Customer',
    phone: normalizePhone(input.phone),
    email: input.email || undefined,
    service: input.service || 'Appointment',
    startsAt: input.startsAt.toISOString(),
    durationMinutes: input.durationMinutes || db.settings.defaultAppointmentMinutes,
    video: !!input.video,
    meetLink: input.meetLink || (input.video ? db.settings.staticMeetLink || undefined : undefined),
    status: 'scheduled',
    remindersSent: [],
    notes: input.notes,
    history: [],
    createdAt: new Date().toISOString(),
  };
  log(a, `Created (${input.source})`);
  db.appointments.push(a);
  save();
  return a;
}

// Runs calendar sync in the background; failures are logged on the appointment.
export async function syncCalendar(a: Appointment) {
  try {
    await syncAppointmentToCalendar(a);
    if (a.video && !a.meetLink && db.settings.staticMeetLink) a.meetLink = db.settings.staticMeetLink;
  } catch (err: any) {
    log(a, `Google Calendar error: ${err.message}`);
    console.error('[calendar]', err.message);
  }
  save();
}

export async function rescheduleAppointment(a: Appointment, start: Date, source: string) {
  const old = a.startsAt;
  a.startsAt = start.toISOString();
  a.status = 'scheduled';
  log(a, `Rescheduled from ${formatWhen(old, db.settings.businessHours.timezone)} (${source})`);
  save();
  await syncCalendar(a);
}

export async function cancelAppointment(a: Appointment, source: string) {
  a.status = 'cancelled';
  log(a, `Cancelled (${source})`);
  save();
  try {
    await cancelCalendarEvent(a);
  } catch (err: any) {
    log(a, `Google Calendar error: ${err.message}`);
  }
  save();
}

export function confirmAppointment(a: Appointment, source: string) {
  a.status = 'confirmed';
  log(a, `Confirmed (${source})`);
  save();
}

function whereText(a: Appointment): string {
  if (a.video) return a.meetLink ? `Join by video: ${a.meetLink}` : "We'll text you the video link.";
  return db.settings.businessAddress ? `Location: ${db.settings.businessAddress}` : '';
}

export function confirmationSms(a: Appointment): string {
  const when = formatWhen(a.startsAt, db.settings.businessHours.timezone);
  return [
    `You're booked with ${db.settings.businessName}: ${a.service} on ${when}.`,
    whereText(a),
    'Reply R to reschedule or X to cancel.',
  ]
    .filter(Boolean)
    .join(' ');
}

export function reminderSms(a: Appointment): string {
  const when = formatWhen(a.startsAt, db.settings.businessHours.timezone);
  return [
    `Hi ${firstName(a.name)}, reminder of your ${a.service} with ${db.settings.businessName} on ${when}.`,
    whereText(a),
    'Reply C to confirm, R to reschedule, or X to cancel. Reply STOP to opt out.',
  ]
    .filter(Boolean)
    .join(' ');
}

export async function textAppointment(a: Appointment, body: string, what: string): Promise<boolean> {
  if (!twilioConfigured() || !a.phone || isDnc(a.phone)) return false;
  try {
    await sendSms(a.phone, body);
    log(a, `Text sent: ${what}`);
    return true;
  } catch (err: any) {
    log(a, `Text failed (${what}): ${err.message}`);
    return false;
  } finally {
    save();
  }
}

// "2026-10-20" + "2:30 PM", "10/20/2026 14:30", etc. → UTC Date in the business time zone.
export function parseLocalDateTime(dateText: string, timeText = ''): Date | null {
  const tz = db.settings.businessHours.timezone;
  let s = `${dateText || ''} ${timeText || ''}`.trim();
  if (!s) return null;
  // Already a full ISO timestamp with zone
  if (/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}.*(Z|[+-]\d{2}:?\d{2})$/.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  let y: number, mo: number, d: number;
  let m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    [y, mo, d] = [+m[1], +m[2], +m[3]];
  } else if ((m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/))) {
    [mo, d, y] = [+m[1], +m[2], +m[3]];
    if (y < 100) y += 2000;
  } else {
    const parsed = new Date(s);
    if (isNaN(parsed.getTime())) return null;
    [y, mo, d] = [parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate()];
  }
  s = s.replace(m ? m[0] : '', ' ');
  let hh = 9, mm = 0;
  const t = [...s.matchAll(/(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/gi)].find(x => x[2] || x[3]);
  if (t) {
    hh = +t[1];
    mm = +(t[2] || 0);
    const ap = (t[3] || '').toLowerCase();
    if (ap.startsWith('p') && hh < 12) hh += 12;
    if (ap.startsWith('a') && hh === 12) hh = 0;
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return zonedToUtc(`${y}-${pad(mo)}-${pad(d)}T${pad(hh)}:${pad(mm)}`, tz);
}
