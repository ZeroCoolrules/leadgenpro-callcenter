// Google Calendar + Google Meet links for appointments.
//
// Setup (once): create an OAuth client in Google Cloud (see README), set
// GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, then click "Connect Google
// Calendar" in the dashboard. The refresh token is saved in the app's data file.
import crypto from 'crypto';
import type { Appointment } from '../src/types/outbound';
import { db, save } from './store';
import { publicBaseUrl } from './twilio';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'primary';
const SCOPE = 'https://www.googleapis.com/auth/calendar.events';

export function googleConfigured() {
  return !!(CLIENT_ID && CLIENT_SECRET);
}
export function googleConnected() {
  return googleConfigured() && !!db.google.refreshToken;
}

function redirectUri() {
  return `${publicBaseUrl()}/api/google/callback`;
}

const pendingStates = new Set<string>();

export function googleAuthUrl(): string {
  const state = crypto.randomBytes(12).toString('hex');
  pendingStates.add(state);
  const q = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

export async function finishGoogleAuth(code: string, state: string) {
  if (!pendingStates.delete(state)) throw new Error('This sign-in link expired. Please click Connect again.');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: redirectUri(),
      grant_type: 'authorization_code',
    }),
  });
  const data: any = await res.json();
  if (!res.ok || !data.refresh_token) throw new Error(data.error_description || data.error || 'Google did not return a refresh token');
  db.google = { refreshToken: data.refresh_token, connectedAt: new Date().toISOString() };
  accessToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  save();
}

export function disconnectGoogle() {
  db.google = {};
  accessToken = null;
  save();
}

let accessToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (accessToken && accessToken.expiresAt > Date.now()) return accessToken.value;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: db.google.refreshToken || '',
      grant_type: 'refresh_token',
    }),
  });
  const data: any = await res.json();
  if (!res.ok) throw new Error(`Google token refresh failed: ${data.error_description || data.error}`);
  accessToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  return accessToken.value;
}

async function calendarFetch(method: string, path: string, body?: any) {
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}${path}`, {
    method,
    headers: { Authorization: `Bearer ${await getAccessToken()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000),
  });
  if (res.status === 204) return {};
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Google Calendar ${res.status}: ${data?.error?.message || 'error'}`);
  return data;
}

function eventTimes(a: Appointment) {
  const end = new Date(new Date(a.startsAt).getTime() + a.durationMinutes * 60000);
  return { start: { dateTime: a.startsAt }, end: { dateTime: end.toISOString() } };
}

// Creates or moves the calendar event for an appointment. Adds a Meet link for video appointments.
export async function syncAppointmentToCalendar(a: Appointment): Promise<void> {
  if (!googleConnected()) return;
  if (!a.video && !db.settings.addAllToCalendar) return;
  if (a.calendarEventId) {
    await calendarFetch('PATCH', `/events/${a.calendarEventId}?sendUpdates=all`, eventTimes(a));
    return;
  }
  const event = await calendarFetch('POST', `/events?conferenceDataVersion=1&sendUpdates=all`, {
    summary: `${a.service} – ${a.name}`,
    description: `Booked by Call AI Center.\nPhone: ${a.phone}${a.notes ? `\nNotes: ${a.notes}` : ''}`,
    ...eventTimes(a),
    attendees: a.email ? [{ email: a.email }] : undefined,
    conferenceData: a.video
      ? { createRequest: { requestId: a.id, conferenceSolutionKey: { type: 'hangoutsMeet' } } }
      : undefined,
  });
  a.calendarEventId = event.id;
  if (a.video && event.hangoutLink) a.meetLink = event.hangoutLink;
}

export async function cancelCalendarEvent(a: Appointment) {
  if (!googleConnected() || !a.calendarEventId) return;
  await calendarFetch('DELETE', `/events/${a.calendarEventId}?sendUpdates=all`);
  a.calendarEventId = undefined;
}
