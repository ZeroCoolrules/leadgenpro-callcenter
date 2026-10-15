// Fetch helpers for the outbound dialer screens.
import type {
  AppSettings,
  Appointment,
  CallRecord,
  CallScript,
  Campaign,
  Contact,
  DncEntry,
  SetupStatus,
} from '../../types/outbound';

export type CampaignWithStats = Campaign & {
  stats: {
    total: number;
    remaining: number;
    booked: number;
    answered: number;
    voicemail: number;
    noAnswer: number;
    failed: number;
    dnc: number;
    activeCalls: number;
  };
};

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/outbound${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

export const api = {
  status: () => request<SetupStatus>('GET', '/status'),
  settings: () => request<AppSettings>('GET', '/settings'),
  saveSettings: (s: Partial<AppSettings>) => request<AppSettings>('PUT', '/settings', s),

  scripts: () => request<CallScript[]>('GET', '/scripts'),
  createScript: (s: Partial<CallScript>) => request<CallScript>('POST', '/scripts', s),
  saveScript: (s: CallScript) => request<CallScript>('PUT', `/scripts/${s.id}`, s),
  deleteScript: (id: string) => request('DELETE', `/scripts/${id}`),
  testScript: (id: string, history: { role: 'user' | 'assistant'; content: string }[], contactName?: string) =>
    request<{ reply: string; actions?: string[] }>('POST', `/scripts/${id}/test`, { history, contactName }),

  campaigns: () => request<CampaignWithStats[]>('GET', '/campaigns'),
  createCampaign: (c: Partial<Campaign>) => request<CampaignWithStats>('POST', '/campaigns', c),
  saveCampaign: (id: string, c: Partial<Campaign>) => request<CampaignWithStats>('PUT', `/campaigns/${id}`, c),
  deleteCampaign: (id: string) => request('DELETE', `/campaigns/${id}`),
  startCampaign: (id: string) => request<CampaignWithStats>('POST', `/campaigns/${id}/start`),
  pauseCampaign: (id: string) => request<CampaignWithStats>('POST', `/campaigns/${id}/pause`),
  recycleCampaign: (id: string) => request<{ recycled: number }>('POST', `/campaigns/${id}/recycle`),
  syncLeadgenpro: (id: string) =>
    request<{ fetched: number; added: number; skipped: number }>('POST', `/campaigns/${id}/leadgenpro-sync`),
  contacts: (id: string, q = '', status = '') =>
    request<{ total: number; contacts: Contact[] }>('GET', `/campaigns/${id}/contacts?q=${encodeURIComponent(q)}&status=${status}`),
  importContacts: (id: string, contacts: unknown[], consentConfirmed: boolean) =>
    request<{ added: number; duplicates: number; dnc: number; invalid: number; invalidSamples: string[] }>(
      'POST',
      `/campaigns/${id}/contacts`,
      { contacts, consentConfirmed },
    ),
  deleteContact: (id: string) => request('DELETE', `/contacts/${id}`),

  calls: () => request<{ active: CallRecord[]; recent: CallRecord[] }>('GET', '/calls'),
  takeover: (id: string) => request<CallRecord>('POST', `/calls/${id}/takeover`, {}),
  hangup: (id: string) => request('POST', `/calls/${id}/hangup`),
  manualCall: (phone: string, name?: string, contactId?: string) => request<CallRecord>('POST', '/calls/manual', { phone, name, contactId }),

  appointments: () => request<Appointment[]>('GET', '/appointments'),
  createAppointment: (a: Record<string, unknown>) => request<Appointment>('POST', '/appointments', a),
  importAppointments: (rows: unknown[], sendConfirmation: boolean) =>
    request<{ added: number; failed: number; errors: string[] }>('POST', '/appointments/import', { rows, sendConfirmation }),
  saveAppointment: (id: string, a: Record<string, unknown>) => request<Appointment>('PUT', `/appointments/${id}`, a),
  cancelAppointment: (id: string) => request<Appointment>('POST', `/appointments/${id}/cancel`),
  remindNow: (id: string) => request<{ message: string }>('POST', `/appointments/${id}/remind`),
  deleteAppointment: (id: string) => request('DELETE', `/appointments/${id}`),

  dnc: () => request<DncEntry[]>('GET', '/dnc'),
  addDnc: (phones: string) => request<{ added: number }>('POST', '/dnc', { phones }),
  removeDnc: (phone: string) => request('DELETE', `/dnc/${encodeURIComponent(phone)}`),
  disconnectGoogle: () => request('POST', '/google/disconnect'),
};

export const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'America/Puerto_Rico',
  'America/Toronto',
  'America/Vancouver',
  'Europe/London',
  'Australia/Sydney',
];

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function hourLabel(h: number) {
  if (h === 24) return '12 AM (midnight)';
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 === 0 ? 12 : h % 12} ${suffix}`;
}

export function fmtWhen(iso?: string, tz?: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-US', {
    timeZone: tz,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function fmtPhone(p?: string) {
  const m = (p || '').match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : p || '';
}
