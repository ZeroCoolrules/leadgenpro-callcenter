// Small JSON-file database for the dialer, reminders and scripts.
//
// Everything lives in one file (DATA_DIR/outbound.json). Writes are batched and
// atomic (write temp file, then rename) so a crash never leaves a half-written
// file. On Render, point DATA_DIR at a persistent disk or the data resets on
// every deploy/restart.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type {
  AppSettings,
  Appointment,
  CallRecord,
  CallScript,
  Campaign,
  Contact,
  DialerSettings,
  DncEntry,
} from '../src/types/outbound';
import { DEFAULT_SCRIPTS } from './scripts';

export interface Db {
  version: 1;
  settings: AppSettings;
  campaigns: Campaign[];
  contacts: Contact[];
  scripts: CallScript[];
  appointments: Appointment[];
  calls: CallRecord[];
  dnc: DncEntry[];
  google: { refreshToken?: string; connectedAt?: string };
}

const MAX_CALLS_KEPT = 3000;

export const DATA_DIR = path.resolve(process.env.DATA_DIR || 'data');
const DB_FILE = path.join(DATA_DIR, 'outbound.json');

export const DEFAULT_DIALER: DialerSettings = {
  maxConcurrentCalls: 1,
  delayAfterCallSeconds: 15,
  maxAttempts: 3,
  retryDelayMinutes: 60,
  callingHoursStart: 9,
  callingHoursEnd: 20,
  callingDays: [1, 2, 3, 4, 5, 6],
  timezone: 'America/New_York',
  unknownTimezoneMode: 'strict',
  machineDetection: true,
  leaveVoicemail: true,
  ringTimeoutSeconds: 25,
};

function defaultSettings(): AppSettings {
  return {
    businessName: process.env.BUSINESS_NAME || 'our office',
    businessAddress: '',
    agentPhone: process.env.AGENT_PHONE || process.env.HUMAN_FORWARD_NUMBER || '',
    callerId: '',
    businessHours: { startHour: 9, endHour: 17, days: [1, 2, 3, 4, 5], timezone: 'America/New_York' },
    defaultAppointmentMinutes: 30,
    appointmentsPerSlot: 1,
    reminderOffsetsHours: [24, 2],
    reminderChannel: 'sms',
    staticMeetLink: '',
    addAllToCalendar: false,
    inboundScriptId: '',
    defaultDialer: { ...DEFAULT_DIALER },
  };
}

function freshDb(): Db {
  return {
    version: 1,
    settings: defaultSettings(),
    campaigns: [],
    contacts: [],
    scripts: DEFAULT_SCRIPTS.map(s => ({ ...s, updatedAt: new Date().toISOString() })),
    appointments: [],
    calls: [],
    dnc: [],
    google: {},
  };
}

function load(): Db {
  try {
    const raw = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    const base = freshDb();
    return {
      ...base,
      ...raw,
      settings: { ...base.settings, ...raw.settings, defaultDialer: { ...DEFAULT_DIALER, ...raw.settings?.defaultDialer } },
      google: raw.google || {},
    };
  } catch (err: any) {
    if (err.code !== 'ENOENT') console.error('[store] could not read', DB_FILE, err.message);
    return freshDb();
  }
}

export const db: Db = load();

let saveTimer: NodeJS.Timeout | null = null;

function writeNow() {
  saveTimer = null;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (db.calls.length > MAX_CALLS_KEPT) db.calls.splice(0, db.calls.length - MAX_CALLS_KEPT);
    const tmp = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, DB_FILE);
  } catch (err: any) {
    console.error('[store] save failed:', err.message);
  }
}

// Call after any change. Saves within half a second.
export function save() {
  if (!saveTimer) saveTimer = setTimeout(writeNow, 500);
}

export function flush() {
  if (saveTimer) clearTimeout(saveTimer);
  writeNow();
}

process.on('SIGTERM', () => {
  flush();
  process.exit(0);
});
process.on('SIGINT', () => {
  flush();
  process.exit(0);
});

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}

// On Render the app folder is wiped on every deploy/restart, so data is only
// safe when DATA_DIR points at a mounted disk outside it. Elsewhere (your own
// computer, a VM) the local folder is fine.
export function storageLooksPersistent(): boolean {
  if (!process.env.RENDER) return true;
  return !DATA_DIR.startsWith(process.cwd());
}
