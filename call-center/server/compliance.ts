// Phone numbers, time zones, calling-hours and Do-Not-Call checks.
import type { DialerSettings } from '../src/types/outbound';
import { db, save } from './store';

const DEFAULT_COUNTRY = (process.env.DEFAULT_COUNTRY_CODE || '1').replace(/\D/g, '');

// Returns E.164 (+13055550123) or '' if it doesn't look like a phone number.
export function normalizePhone(input: unknown): string {
  const raw = String(input ?? '').trim();
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (raw.startsWith('+')) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : '';
  if (DEFAULT_COUNTRY === '1') {
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
    return '';
  }
  if (digits.startsWith('00')) return `+${digits.slice(2)}`;
  if (digits.length >= 8 && digits.length <= 15) return `+${DEFAULT_COUNTRY}${digits.replace(/^0/, '')}`;
  return '';
}

export function isValidTimezone(tz?: string): boolean {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const TZ_NAMES: Record<string, string> = {
  eastern: 'America/New_York', est: 'America/New_York', edt: 'America/New_York', et: 'America/New_York',
  central: 'America/Chicago', cst: 'America/Chicago', cdt: 'America/Chicago', ct: 'America/Chicago',
  mountain: 'America/Denver', mst: 'America/Denver', mdt: 'America/Denver', mt: 'America/Denver',
  pacific: 'America/Los_Angeles', pst: 'America/Los_Angeles', pdt: 'America/Los_Angeles', pt: 'America/Los_Angeles',
  arizona: 'America/Phoenix', alaska: 'America/Anchorage', akst: 'America/Anchorage', hawaii: 'Pacific/Honolulu', hst: 'Pacific/Honolulu',
};

// Accepts "America/Chicago" or everyday names like "Central", "CST", "Pacific time".
export function normalizeTimezone(input?: string): string | undefined {
  const raw = String(input || '').trim();
  if (!raw) return undefined;
  const key = raw.toLowerCase().replace(/\s*(standard|daylight)?\s*time$/, '').trim();
  if (TZ_NAMES[key]) return TZ_NAMES[key];
  return raw.includes('/') && isValidTimezone(raw) ? raw : undefined;
}

// Wall-clock parts of `date` in a given time zone.
export function zonedParts(date: Date, tz: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
  }).formatToParts(date);
  const get = (t: string) => parts.find(p => p.type === t)?.value || '';
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return {
    year: +get('year'),
    month: +get('month'),
    day: +get('day'),
    hour: +get('hour'),
    minute: +get('minute'),
    weekday: weekdays.indexOf(get('weekday')),
  };
}

// Converts a local wall time ("2026-10-20T14:30") in `tz` to a UTC Date.
export function zonedToUtc(local: string, tz: string): Date | null {
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})/);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  // Two passes handle DST edges.
  let ts = guess;
  for (let i = 0; i < 2; i++) {
    const p = zonedParts(new Date(ts), tz);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    ts += guess - asUtc;
  }
  return new Date(ts);
}

// Federal rule (TCPA): no telemarketing calls before 8am or after 9pm, called party's local time.
const LEGAL_START = 8;
const LEGAL_END = 21;
const US_MAINLAND_ZONES = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles'];

function insideWindow(date: Date, tz: string, s: Pick<DialerSettings, 'callingHoursStart' | 'callingHoursEnd' | 'callingDays'>) {
  const p = zonedParts(date, tz);
  const start = Math.max(LEGAL_START, s.callingHoursStart);
  const end = Math.min(LEGAL_END, s.callingHoursEnd);
  const minutes = p.hour * 60 + p.minute;
  return s.callingDays.includes(p.weekday) && minutes >= start * 60 && minutes < end * 60;
}

export function canCallNow(contactTz: string | undefined, s: DialerSettings, now = new Date()): boolean {
  if (isValidTimezone(contactTz)) return insideWindow(now, contactTz!, s);
  if (s.unknownTimezoneMode === 'strict' && DEFAULT_COUNTRY === '1') {
    return US_MAINLAND_ZONES.every(tz => insideWindow(now, tz, s));
  }
  return insideWindow(now, s.timezone, s);
}

// ── Do Not Call list ────────────────────────────────────────────────────────
export function isDnc(phone: string): boolean {
  const p = normalizePhone(phone);
  return !!p && db.dnc.some(d => d.phone === p);
}

export function addDnc(phone: string, reason: string): boolean {
  const p = normalizePhone(phone);
  if (!p || isDnc(p)) return false;
  db.dnc.push({ phone: p, reason, addedAt: new Date().toISOString() });
  for (const c of db.contacts) {
    if (c.phone === p && c.status !== 'completed' && c.status !== 'booked') c.status = 'dnc';
  }
  save();
  console.log(`[DNC] added ${p} (${reason})`);
  return true;
}

export function removeDnc(phone: string) {
  const p = normalizePhone(phone);
  const i = db.dnc.findIndex(d => d.phone === p);
  if (i >= 0) {
    db.dnc.splice(i, 1);
    save();
  }
}

const OPT_OUT_SPEECH =
  /\b(stop calling|don'?t call|do not call|remove me|take me off|unsubscribe|lose my number|never call|stop contacting)\b/i;

export function soundsLikeOptOut(text: string): boolean {
  return OPT_OUT_SPEECH.test(text);
}
