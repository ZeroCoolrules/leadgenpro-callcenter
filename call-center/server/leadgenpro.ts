// Thin client for leadgenpro's lead API. When LEADGENPRO_BASE_URL and
// LEADGENPRO_API_KEY are set, the dialer can pull leads from leadgenpro and
// report back how each call went, instead of leads only ever being entered
// by hand in this dashboard.
const BASE = (process.env.LEADGENPRO_BASE_URL || '').replace(/\/+$/, '');
const API_KEY = process.env.LEADGENPRO_API_KEY || '';

export function leadgenproConfigured(): boolean {
  return !!(BASE && API_KEY);
}

async function request(path: string, init: RequestInit = {}): Promise<any> {
  if (!leadgenproConfigured()) throw new Error('leadgenpro is not configured (LEADGENPRO_BASE_URL / LEADGENPRO_API_KEY missing)');
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok || data.success === false) throw new Error(`leadgenpro ${res.status}: ${data.error || text.slice(0, 200)}`);
  return data;
}

export interface LeadgenproLead {
  id: number;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  company_name: string | null;
  industry: string | null;
}

// Leads with status 'new' and a phone number, newest first.
export async function fetchNewLeads(limit = 200): Promise<LeadgenproLead[]> {
  const data = await request(`/api/leads.php?status=new&limit=${Math.max(1, Math.min(500, limit))}`);
  return (Array.isArray(data.data) ? data.data : []).filter((l: any) => l && l.phone);
}

export type LeadgenproOutcome =
  | 'meeting_booked'
  | 'callback_requested'
  | 'not_interested'
  | 'voicemail'
  | 'no_answer'
  | 'wrong_number'
  | 'other';

export interface ReportOutcomeInput {
  leadId: number;
  channel: 'voice' | 'sms';
  outcome: LeadgenproOutcome;
  callId?: string;
  durationSeconds?: number;
  recordingUrl?: string;
  transcript?: string;
  notes?: string;
}

// Fire-and-forget: logs the call/SMS outcome against the lead in leadgenpro
// (lead_activities + leads.status) so it shows up there without anyone
// copying it over by hand. Never throws — a reporting failure should not
// break the dialer.
export async function reportOutcome(input: ReportOutcomeInput): Promise<void> {
  if (!leadgenproConfigured()) return;
  try {
    await request('/api/call-center-outcome.php', {
      method: 'POST',
      body: JSON.stringify({
        lead_id: input.leadId,
        channel: input.channel,
        outcome: input.outcome,
        call_id: input.callId,
        duration_seconds: input.durationSeconds,
        recording_url: input.recordingUrl,
        transcript: input.transcript,
        notes: input.notes,
      }),
    });
  } catch (err: any) {
    console.error('[leadgenpro] could not report outcome:', err.message);
  }
}
