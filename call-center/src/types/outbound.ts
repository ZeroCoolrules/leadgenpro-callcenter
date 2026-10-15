// Shared types for the outbound dialer, appointment reminders and scripts.
// Used by both the server (server/*.ts) and the dashboard (src/components/outbound/*).

export type ContactStatus =
  | 'pending'
  | 'calling'
  | 'answered'
  | 'voicemail'
  | 'no_answer'
  | 'busy'
  | 'failed'
  | 'completed'
  | 'booked'
  | 'dnc';

export interface Contact {
  id: string;
  campaignId: string;
  name: string;
  phone: string; // E.164, e.g. +13055550123
  email?: string;
  timezone?: string; // IANA, e.g. America/Chicago
  notes?: string;
  extra?: Record<string, string>; // any other spreadsheet columns, shown to the AI
  status: ContactStatus;
  attempts: number;
  lastAttemptAt?: string;
  nextAttemptAt?: string;
  lastOutcome?: string;
  createdAt: string;
}

export interface DialerSettings {
  maxConcurrentCalls: number; // lines dialing at once
  delayAfterCallSeconds: number; // wait after a call ends before the next dial
  maxAttempts: number; // total tries per contact
  retryDelayMinutes: number; // wait before retrying no-answer / busy
  callingHoursStart: number; // 0-23, contact's local time (never earlier than 8)
  callingHoursEnd: number; // 0-23, exclusive (never later than 21)
  callingDays: number[]; // 0=Sun … 6=Sat
  timezone: string; // used when a contact has no timezone
  unknownTimezoneMode: 'strict' | 'campaign'; // strict = must be inside hours in every US mainland zone
  machineDetection: boolean;
  leaveVoicemail: boolean;
  ringTimeoutSeconds: number;
}

export type CampaignMode = 'ai' | 'agent';
export type CampaignStatus = 'draft' | 'running' | 'paused' | 'completed';

export interface Campaign {
  id: string;
  name: string;
  mode: CampaignMode; // ai = AI talks using the script; agent = answered calls ring your phone
  scriptId: string;
  status: CampaignStatus;
  settings: DialerSettings;
  consentConfirmed: boolean;
  createdAt: string;
  lastCallEndedAt?: string;
  lastError?: string;
  failuresInRow?: number;
}

export interface ScriptObjection {
  objection: string;
  response: string;
}

export type ScriptPurpose = 'outbound' | 'reminder' | 'inbound';

export interface CallScript {
  id: string;
  name: string;
  purpose: ScriptPurpose;
  agentName: string;
  opening: string;
  goal: string;
  talkingPoints: string;
  questions: string;
  objections: ScriptObjection[];
  closing: string;
  voicemail: string;
  rules: string;
  updatedAt: string;
}

export type AppointmentStatus = 'scheduled' | 'confirmed' | 'reschedule_requested' | 'cancelled' | 'completed';

export interface Appointment {
  id: string;
  name: string;
  phone: string;
  email?: string;
  service: string;
  startsAt: string; // ISO UTC
  durationMinutes: number;
  video: boolean;
  meetLink?: string;
  calendarEventId?: string;
  status: AppointmentStatus;
  remindersSent: string[];
  notes?: string;
  history: { at: string; text: string }[];
  createdAt: string;
}

export type CallKind = 'campaign' | 'reminder' | 'manual' | 'inbound';
export type CallState =
  | 'queued'
  | 'ringing'
  | 'ai'
  | 'human'
  | 'completed'
  | 'no-answer'
  | 'busy'
  | 'failed'
  | 'canceled'
  | 'voicemail';

export interface TranscriptLine {
  speaker: 'ai' | 'caller' | 'human' | 'system';
  text: string;
  at: string;
}

export interface CallRecord {
  id: string;
  callSid?: string;
  kind: CallKind;
  direction: 'inbound' | 'outbound';
  campaignId?: string;
  contactId?: string;
  appointmentId?: string;
  name?: string;
  to: string;
  from: string;
  state: CallState;
  mode?: 'script' | 'reschedule' | 'reminder_menu';
  startedAt: string;
  answeredAt?: string;
  endedAt?: string;
  durationSec?: number;
  transcript: TranscriptLine[];
  outcome?: string;
  takenOver: boolean;
  silentTurns: number;
  lastActivityAt?: string;
}

export interface BusinessHoursSetting {
  startHour: number;
  endHour: number;
  days: number[];
  timezone: string;
}

export interface AppSettings {
  businessName: string;
  businessAddress: string;
  agentPhone: string; // your cell: takeover and "agent" campaigns ring this
  callerId: string; // Twilio number used for outbound calls/texts (blank = TWILIO_FROM_NUMBER)
  businessHours: BusinessHoursSetting;
  defaultAppointmentMinutes: number;
  appointmentsPerSlot: number; // how many appointments may overlap (staff count)
  reminderOffsetsHours: number[];
  reminderChannel: 'sms' | 'call' | 'both';
  staticMeetLink: string;
  addAllToCalendar: boolean;
  inboundScriptId: string; // blank = old built-in receptionist
  defaultDialer: DialerSettings;
}

export interface DncEntry {
  phone: string;
  reason: string;
  addedAt: string;
}

export interface SetupStatus {
  twilioConfigured: boolean;
  callerId: string;
  publicUrl: string;
  adminPasswordSet: boolean;
  dialerLocked: boolean;
  persistentStorage: boolean;
  dataDir: string;
  llmConfigured: boolean;
  googleConfigured: boolean;
  googleConnected: boolean;
  agentPhoneSet: boolean;
  signatureCheck: boolean;
  leadgenproConfigured: boolean;
}
