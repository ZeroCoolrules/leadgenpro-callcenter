// HTTP routes for the outbound dialer, reminders, scripts and settings, plus the
// Twilio webhooks those features use.
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import type { AppSettings, CallScript, Campaign, Contact, DialerSettings, SetupStatus } from '../src/types/outbound';
import { db, DATA_DIR, DEFAULT_DIALER, newId, save, storageLooksPersistent } from './store';
import { addDnc, isDnc, isValidTimezone, normalizePhone, normalizeTimezone, removeDnc } from './compliance';
import {
  callerId,
  createCall,
  publicBaseUrl,
  say,
  sendTwiml,
  signatureCheckEnabled,
  twiml,
  twilioConfigured,
} from './twilio';
import {
  agentMissed,
  findCall,
  findCallBySid,
  handleTurn,
  hangUp,
  isActive,
  newCall,
  openingTwiml,
  addLine,
  ringAgent,
  customerConferenceTwiml,
  runAi,
  scriptFor,
  promptContext,
  takeOver,
} from './calls';
import { campaignStats, onCallEnded } from './dialer';
import { reminderAnswerTwiml, reminderChoice, reminderVoicemail, sendReminder } from './reminders';
import {
  cancelAppointment,
  confirmationSms,
  createAppointment,
  parseLocalDateTime,
  rescheduleAppointment,
  syncCalendar,
  textAppointment,
} from './appointments';
import { fillPlaceholders } from './scripts';
import { adminPasswordSet } from './auth';
import { disconnectGoogle, finishGoogleAuth, googleAuthUrl, googleConfigured, googleConnected } from './google';
import { llmConfig } from './llm';

const PRODUCTION = process.env.NODE_ENV === 'production' || process.argv.includes('--prod') || !!process.env.RENDER;

// Without a password anyone who finds the URL could start calls on your Twilio account.
function dialerLocked() {
  return PRODUCTION && !adminPasswordSet();
}

const clamp = (v: any, min: number, max: number, dflt: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : dflt;
};

function cleanDialer(input: any, base: DialerSettings): DialerSettings {
  const i = input || {};
  const start = clamp(i.callingHoursStart, 8, 20, base.callingHoursStart);
  const days = Array.isArray(i.callingDays) ? i.callingDays.map(Number).filter((d: number) => d >= 0 && d <= 6) : base.callingDays;
  return {
    maxConcurrentCalls: clamp(i.maxConcurrentCalls, 1, 10, base.maxConcurrentCalls),
    delayAfterCallSeconds: clamp(i.delayAfterCallSeconds, 0, 3600, base.delayAfterCallSeconds),
    maxAttempts: clamp(i.maxAttempts, 1, 10, base.maxAttempts),
    retryDelayMinutes: clamp(i.retryDelayMinutes, 1, 10080, base.retryDelayMinutes),
    callingHoursStart: start,
    callingHoursEnd: clamp(i.callingHoursEnd, start + 1, 21, Math.max(start + 1, base.callingHoursEnd)),
    callingDays: [...new Set<number>(days)].sort(),
    timezone: isValidTimezone(i.timezone) ? i.timezone : base.timezone,
    unknownTimezoneMode: i.unknownTimezoneMode === 'campaign' ? 'campaign' : i.unknownTimezoneMode === 'strict' ? 'strict' : base.unknownTimezoneMode,
    machineDetection: typeof i.machineDetection === 'boolean' ? i.machineDetection : base.machineDetection,
    leaveVoicemail: typeof i.leaveVoicemail === 'boolean' ? i.leaveVoicemail : base.leaveVoicemail,
    ringTimeoutSeconds: clamp(i.ringTimeoutSeconds, 10, 60, base.ringTimeoutSeconds),
  };
}

function cleanSettings(i: any, cur: AppSettings): AppSettings {
  const bh = i.businessHours || {};
  const start = clamp(bh.startHour, 0, 23, cur.businessHours.startHour);
  const str = (v: any, d: string, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : d);
  const offsets = Array.isArray(i.reminderOffsetsHours)
    ? [...new Set<number>(i.reminderOffsetsHours.map(Number).filter((n: number) => n > 0 && n <= 24 * 14))].sort((a, b) => b - a)
    : cur.reminderOffsetsHours;
  return {
    businessName: str(i.businessName, cur.businessName, 120) || 'our office',
    businessAddress: str(i.businessAddress, cur.businessAddress),
    agentPhone: i.agentPhone !== undefined ? normalizePhone(i.agentPhone) : cur.agentPhone,
    callerId: i.callerId !== undefined ? normalizePhone(i.callerId) : cur.callerId,
    businessHours: {
      startHour: start,
      endHour: clamp(bh.endHour, start + 1, 24, Math.max(start + 1, cur.businessHours.endHour)),
      days: Array.isArray(bh.days) ? [...new Set<number>(bh.days.map(Number).filter((d: number) => d >= 0 && d <= 6))].sort() : cur.businessHours.days,
      timezone: isValidTimezone(bh.timezone) ? bh.timezone : cur.businessHours.timezone,
    },
    defaultAppointmentMinutes: clamp(i.defaultAppointmentMinutes, 5, 480, cur.defaultAppointmentMinutes),
    appointmentsPerSlot: clamp(i.appointmentsPerSlot, 1, 50, cur.appointmentsPerSlot),
    reminderOffsetsHours: offsets,
    reminderChannel: ['sms', 'call', 'both'].includes(i.reminderChannel) ? i.reminderChannel : cur.reminderChannel,
    staticMeetLink: str(i.staticMeetLink, cur.staticMeetLink),
    addAllToCalendar: typeof i.addAllToCalendar === 'boolean' ? i.addAllToCalendar : cur.addAllToCalendar,
    inboundScriptId: typeof i.inboundScriptId === 'string' ? i.inboundScriptId : cur.inboundScriptId,
    defaultDialer: cleanDialer(i.defaultDialer, cur.defaultDialer),
  };
}

function cleanScript(i: any, cur?: CallScript): CallScript {
  const str = (v: any, d = '', max = 4000) => (typeof v === 'string' ? v.slice(0, max) : d);
  return {
    id: cur?.id || newId('scr'),
    name: str(i.name, cur?.name || 'New script', 120) || 'Untitled script',
    purpose: ['outbound', 'reminder', 'inbound'].includes(i.purpose) ? i.purpose : cur?.purpose || 'outbound',
    agentName: str(i.agentName, cur?.agentName || 'Ava', 60),
    opening: str(i.opening, cur?.opening),
    goal: str(i.goal, cur?.goal),
    talkingPoints: str(i.talkingPoints, cur?.talkingPoints),
    questions: str(i.questions, cur?.questions),
    objections: Array.isArray(i.objections)
      ? i.objections.slice(0, 40).map((o: any) => ({ objection: str(o?.objection, '', 300), response: str(o?.response, '', 1000) }))
      : cur?.objections || [],
    closing: str(i.closing, cur?.closing),
    voicemail: str(i.voicemail, cur?.voicemail, 1000),
    rules: str(i.rules, cur?.rules),
    updatedAt: new Date().toISOString(),
  };
}

function setupStatus(): SetupStatus {
  return {
    twilioConfigured: twilioConfigured(),
    callerId: callerId(),
    publicUrl: publicBaseUrl(),
    adminPasswordSet: adminPasswordSet(),
    dialerLocked: dialerLocked(),
    persistentStorage: storageLooksPersistent(),
    dataDir: DATA_DIR,
    llmConfigured: !!llmConfig.apiKey || !/api\.groq\.com/.test(llmConfig.baseUrl),
    googleConfigured: googleConfigured(),
    googleConnected: googleConnected(),
    agentPhoneSet: !!db.settings.agentPhone,
    signatureCheck: signatureCheckEnabled(),
  };
}

const wrap =
  (fn: (req: Request, res: Response) => Promise<any> | any) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res)).catch(err => {
      console.error('[api]', req.method, req.path, err.message);
      res.status(400).json({ error: err.message });
    });

const fail = (msg: string) => {
  throw new Error(msg);
};

export function registerOutbound(app: Express) {
  const api = express.Router();
  api.use(express.json({ limit: '15mb' }));

  api.get('/status', (req, res) => res.json(setupStatus()));

  api.use((req, res, next) => {
    if (!dialerLocked()) return next();
    res.status(403).json({ error: 'Set ADMIN_PASSWORD in Render (Environment tab) to unlock the dialer. This keeps strangers from using your phone line.' });
  });

  // ── Settings ──────────────────────────────────────────────────────────────
  api.get('/settings', (req, res) => res.json(db.settings));
  api.put('/settings', wrap((req, res) => {
    db.settings = cleanSettings(req.body || {}, db.settings);
    save();
    res.json(db.settings);
  }));

  // ── Scripts ───────────────────────────────────────────────────────────────
  api.get('/scripts', (req, res) => res.json(db.scripts));
  api.post('/scripts', wrap((req, res) => {
    const s = cleanScript(req.body || {});
    db.scripts.push(s);
    save();
    res.json(s);
  }));
  api.put('/scripts/:id', wrap((req, res) => {
    const i = db.scripts.findIndex(s => s.id === req.params.id);
    if (i < 0) fail('Script not found');
    db.scripts[i] = cleanScript(req.body || {}, db.scripts[i]);
    save();
    res.json(db.scripts[i]);
  }));
  api.delete('/scripts/:id', wrap((req, res) => {
    if (db.scripts.length <= 1) fail('Keep at least one script');
    if (db.campaigns.some(c => c.scriptId === req.params.id && c.status === 'running')) fail('A running campaign uses this script. Pause it first.');
    db.scripts = db.scripts.filter(s => s.id !== req.params.id);
    if (db.settings.inboundScriptId === req.params.id) db.settings.inboundScriptId = '';
    save();
    res.json({ ok: true });
  }));
  // Chat with the AI using a script, to test it before calling real people.
  api.post('/scripts/:id/test', wrap(async (req, res) => {
    const script = db.scripts.find(s => s.id === req.params.id) || fail('Script not found');
    const sample = { name: String(req.body.contactName || 'Jordan Smith'), phone: '+15555550100' };
    const history = (Array.isArray(req.body.history) ? req.body.history : [])
      .slice(-16)
      .map((h: any) => ({ role: h.role === 'assistant' ? 'assistant' : 'user', content: String(h.content || '').slice(0, 1000) }));
    const opening = fillPlaceholders(script!.opening, script!, { settings: db.settings, contact: sample });
    if (!history.length) return res.json({ reply: opening });
    const reply = await runAi(script!, { settings: db.settings, contact: sample, channel: 'voice', mode: script!.purpose === 'reminder' ? 'reschedule' : 'script' }, [
      { role: 'assistant', content: opening },
      ...history,
    ]);
    const actions = [
      reply.bookedLocal && `Would book: ${reply.bookedLocal}${reply.video ? ' (video)' : ''}`,
      reply.transfer && 'Would transfer the call to you',
      reply.optout && 'Would add to Do Not Call list',
      reply.end && 'Would hang up',
    ].filter(Boolean);
    res.json({ reply: reply.text, actions });
  }));

  // ── Campaigns & contacts ──────────────────────────────────────────────────
  api.get('/campaigns', (req, res) => res.json(db.campaigns.map(c => ({ ...c, stats: campaignStats(c) }))));
  api.post('/campaigns', wrap((req, res) => {
    const b = req.body || {};
    const c: Campaign = {
      id: newId('cmp'),
      name: String(b.name || 'New campaign').slice(0, 120),
      mode: b.mode === 'agent' ? 'agent' : 'ai',
      scriptId: db.scripts.some(s => s.id === b.scriptId) ? b.scriptId : (db.scripts.find(s => s.purpose === 'outbound') || db.scripts[0]).id,
      status: 'draft',
      settings: cleanDialer(b.settings, db.settings.defaultDialer),
      consentConfirmed: !!b.consentConfirmed,
      createdAt: new Date().toISOString(),
    };
    db.campaigns.push(c);
    save();
    res.json({ ...c, stats: campaignStats(c) });
  }));
  api.put('/campaigns/:id', wrap((req, res) => {
    const c = db.campaigns.find(x => x.id === req.params.id) || fail('Campaign not found');
    const b = req.body || {};
    if (typeof b.name === 'string') c!.name = b.name.slice(0, 120);
    if (b.mode === 'ai' || b.mode === 'agent') c!.mode = b.mode;
    if (db.scripts.some(s => s.id === b.scriptId)) c!.scriptId = b.scriptId;
    if (b.settings) c!.settings = cleanDialer(b.settings, c!.settings);
    if (typeof b.consentConfirmed === 'boolean') c!.consentConfirmed = b.consentConfirmed;
    save();
    res.json({ ...c, stats: campaignStats(c!) });
  }));
  api.delete('/campaigns/:id', wrap((req, res) => {
    const c = db.campaigns.find(x => x.id === req.params.id) || fail('Campaign not found');
    if (c!.status === 'running') fail('Pause the campaign first');
    db.campaigns = db.campaigns.filter(x => x.id !== c!.id);
    db.contacts = db.contacts.filter(x => x.campaignId !== c!.id);
    save();
    res.json({ ok: true });
  }));
  api.post('/campaigns/:id/start', wrap((req, res) => {
    const c = db.campaigns.find(x => x.id === req.params.id) || fail('Campaign not found');
    if (!twilioConfigured()) fail('Twilio is not set up yet. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER in Render.');
    if (!publicBaseUrl()) fail('The server does not know its public web address yet. Set PUBLIC_BASE_URL.');
    if (!c!.consentConfirmed) fail('Please confirm you have permission to call these contacts.');
    if (c!.mode === 'agent' && !db.settings.agentPhone) fail('Agent mode rings your phone. Add your phone number in Settings first.');
    if (!db.contacts.some(x => x.campaignId === c!.id)) fail('Upload some contacts first.');
    c!.status = 'running';
    c!.lastError = undefined;
    c!.failuresInRow = 0;
    save();
    res.json({ ...c, stats: campaignStats(c!) });
  }));
  api.post('/campaigns/:id/pause', wrap((req, res) => {
    const c = db.campaigns.find(x => x.id === req.params.id) || fail('Campaign not found');
    c!.status = 'paused';
    save();
    res.json({ ...c, stats: campaignStats(c!) });
  }));
  // Puts unreached contacts back in the queue for another round.
  api.post('/campaigns/:id/recycle', wrap((req, res) => {
    const c = db.campaigns.find(x => x.id === req.params.id) || fail('Campaign not found');
    let n = 0;
    for (const x of db.contacts) {
      if (x.campaignId === c!.id && ['no_answer', 'busy', 'failed', 'voicemail'].includes(x.status) && !isDnc(x.phone)) {
        x.status = 'pending';
        x.attempts = 0;
        x.nextAttemptAt = undefined;
        n++;
      }
    }
    if (c!.status === 'completed') c!.status = 'paused';
    save();
    res.json({ recycled: n });
  }));

  api.get('/campaigns/:id/contacts', (req, res) => {
    const q = String(req.query.q || '').toLowerCase();
    const status = String(req.query.status || '');
    const list = db.contacts.filter(
      x => x.campaignId === req.params.id && (!status || x.status === status) && (!q || x.name.toLowerCase().includes(q) || x.phone.includes(q)),
    );
    res.json({ total: list.length, contacts: list.slice(0, 500) });
  });

  api.post('/campaigns/:id/contacts', wrap((req, res) => {
    const c = db.campaigns.find(x => x.id === req.params.id) || fail('Campaign not found');
    const rows: any[] = Array.isArray(req.body?.contacts) ? req.body.contacts.slice(0, 50000) : [];
    if (req.body?.consentConfirmed) c!.consentConfirmed = true;
    const existing = new Set(db.contacts.filter(x => x.campaignId === c!.id).map(x => x.phone));
    const invalid: string[] = [];
    let added = 0, duplicates = 0, dnc = 0;
    for (const r of rows) {
      const phone = normalizePhone(r.phone);
      if (!phone) {
        invalid.push(`${r.name || ''} ${r.phone || ''}`.trim() || '(blank row)');
        continue;
      }
      if (existing.has(phone)) {
        duplicates++;
        continue;
      }
      existing.add(phone);
      const onDnc = isDnc(phone);
      if (onDnc) dnc++;
      const extra: Record<string, string> = {};
      for (const [k, v] of Object.entries(r.extra || {})) if (v !== '' && v != null) extra[String(k).slice(0, 60)] = String(v).slice(0, 500);
      const contact: Contact = {
        id: newId('ct'),
        campaignId: c!.id,
        name: String(r.name || '').slice(0, 120),
        phone,
        email: r.email ? String(r.email).slice(0, 200) : undefined,
        timezone: normalizeTimezone(r.timezone),
        notes: r.notes ? String(r.notes).slice(0, 1000) : undefined,
        extra,
        status: onDnc ? 'dnc' : 'pending',
        attempts: 0,
        createdAt: new Date().toISOString(),
      };
      db.contacts.push(contact);
      added++;
    }
    if (c!.status === 'completed' && added) c!.status = 'paused';
    save();
    res.json({ added, duplicates, dnc, invalid: invalid.length, invalidSamples: invalid.slice(0, 10) });
  }));

  api.delete('/contacts/:id', wrap((req, res) => {
    db.contacts = db.contacts.filter(x => x.id !== req.params.id);
    save();
    res.json({ ok: true });
  }));

  // ── Calls ─────────────────────────────────────────────────────────────────
  api.get('/calls', (req, res) => {
    const active = db.calls.filter(isActive).reverse();
    const recent = db.calls.filter(c => !isActive(c)).slice(-100).reverse();
    res.json({ active, recent });
  });
  api.post('/calls/:id/takeover', wrap(async (req, res) => {
    const call = findCall(req.params.id) || fail('Call not found');
    await takeOver(call!, String(req.body?.phone || db.settings.agentPhone));
    res.json(call);
  }));
  api.post('/calls/:id/hangup', wrap(async (req, res) => {
    const call = findCall(req.params.id) || fail('Call not found');
    await hangUp(call!);
    res.json({ ok: true });
  }));
  // You place a call yourself: Twilio rings your phone, then connects the customer.
  api.post('/calls/manual', wrap(async (req, res) => {
    if (!twilioConfigured()) fail('Twilio is not set up yet.');
    const agent = db.settings.agentPhone || fail('Add your phone number in Settings first.');
    const to = normalizePhone(req.body?.phone) || fail('That phone number does not look right.');
    if (isDnc(to!)) fail('This number is on your Do Not Call list.');
    const contact = req.body?.contactId ? db.contacts.find(x => x.id === req.body.contactId) : undefined;
    const call = newCall({ kind: 'manual', direction: 'outbound', to: to!, from: callerId(), name: req.body?.name || contact?.name, contactId: contact?.id, state: 'human' });
    const base = publicBaseUrl();
    const r = await createCall({
      to: agent!,
      twiml: twiml(`${say(`Connecting your call to ${call.name || 'the customer'}.`)}<Dial callerId="${callerId()}" timeout="30"><Number>${to}</Number></Dial>`),
      statusCallback: base ? `${base}/api/webhooks/twilio/call/status?callId=${call.id}` : undefined,
      timeout: 25,
    });
    call.callSid = r.sid;
    addLine(call, 'system', `Ringing your phone, then ${to}`);
    res.json(call);
  }));

  // ── Appointments ──────────────────────────────────────────────────────────
  api.get('/appointments', (req, res) => {
    const cutoff = Date.now() - 30 * 86400000;
    res.json(db.appointments.filter(a => new Date(a.startsAt).getTime() > cutoff).sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
  });
  const addAppointment = async (r: any, source: string, notify: boolean) => {
    const phone = normalizePhone(r.phone) || fail(`Bad phone number for ${r.name || 'a row'}`);
    const start = (r.startsAt ? new Date(r.startsAt) : parseLocalDateTime(r.date, r.time)) || fail(`Could not read the date/time for ${r.name || phone}`);
    if (isNaN(start!.getTime())) fail(`Could not read the date/time for ${r.name || phone}`);
    if (db.appointments.some(x => x.phone === phone && x.startsAt === start!.toISOString() && x.status !== 'cancelled')) {
      fail(`${r.name || phone} is already booked at that time`);
    }
    const video = r.video === true || /^(y|yes|true|1|video|meet|google meet|zoom)$/i.test(String(r.video || '').trim());
    const a = createAppointment({
      name: String(r.name || 'Customer'),
      phone: phone!,
      email: r.email ? String(r.email) : undefined,
      service: r.service ? String(r.service) : undefined,
      startsAt: start!,
      durationMinutes: clamp(r.durationMinutes, 5, 480, db.settings.defaultAppointmentMinutes),
      video,
      meetLink: r.meetLink ? String(r.meetLink) : undefined,
      notes: r.notes ? String(r.notes) : undefined,
      source,
    });
    await syncCalendar(a);
    if (notify) await textAppointment(a, confirmationSms(a), 'booking confirmation');
    return a;
  };
  api.post('/appointments', wrap(async (req, res) => {
    res.json(await addAppointment(req.body || {}, 'added in dashboard', !!req.body?.sendConfirmation));
  }));
  api.post('/appointments/import', wrap(async (req, res) => {
    const rows: any[] = Array.isArray(req.body?.rows) ? req.body.rows.slice(0, 5000) : [];
    let added = 0;
    const errors: string[] = [];
    for (const r of rows) {
      try {
        await addAppointment(r, 'imported', !!req.body?.sendConfirmation);
        added++;
      } catch (err: any) {
        errors.push(err.message);
      }
    }
    res.json({ added, failed: errors.length, errors: errors.slice(0, 10) });
  }));
  api.put('/appointments/:id', wrap(async (req, res) => {
    const a = db.appointments.find(x => x.id === req.params.id) || fail('Appointment not found');
    const b = req.body || {};
    for (const k of ['name', 'email', 'service', 'notes', 'meetLink'] as const) if (typeof b[k] === 'string') (a as any)[k] = b[k];
    if (b.phone) a!.phone = normalizePhone(b.phone) || a!.phone;
    if (typeof b.video === 'boolean') a!.video = b.video;
    if (b.durationMinutes) a!.durationMinutes = clamp(b.durationMinutes, 5, 480, a!.durationMinutes);
    if (b.status === 'confirmed' || b.status === 'completed' || b.status === 'scheduled') a!.status = b.status;
    const start = b.startsAt ? new Date(b.startsAt) : b.date ? parseLocalDateTime(b.date, b.time) : null;
    if (start && !isNaN(start.getTime()) && start.toISOString() !== a!.startsAt) {
      await rescheduleAppointment(a!, start, 'changed in dashboard');
      if (b.sendConfirmation) await textAppointment(a!, confirmationSms(a!), 'reschedule confirmation');
    } else {
      await syncCalendar(a!);
    }
    save();
    res.json(a);
  }));
  api.post('/appointments/:id/cancel', wrap(async (req, res) => {
    const a = db.appointments.find(x => x.id === req.params.id) || fail('Appointment not found');
    await cancelAppointment(a!, 'cancelled in dashboard');
    res.json(a);
  }));
  api.post('/appointments/:id/remind', wrap(async (req, res) => {
    const a = db.appointments.find(x => x.id === req.params.id) || fail('Appointment not found');
    res.json({ message: await sendReminder(a!) });
  }));
  api.delete('/appointments/:id', wrap((req, res) => {
    db.appointments = db.appointments.filter(x => x.id !== req.params.id);
    save();
    res.json({ ok: true });
  }));

  // ── Do Not Call ───────────────────────────────────────────────────────────
  api.get('/dnc', (req, res) => res.json([...db.dnc].reverse()));
  api.post('/dnc', wrap((req, res) => {
    const list = String(req.body?.phones || '').split(/[\s,;]+/).filter(Boolean);
    let added = 0;
    for (const p of list) if (addDnc(p, String(req.body?.reason || 'added manually'))) added++;
    res.json({ added });
  }));
  api.delete('/dnc/:phone', wrap((req, res) => {
    removeDnc(req.params.phone);
    res.json({ ok: true });
  }));

  api.post('/google/disconnect', wrap((req, res) => {
    disconnectGoogle();
    res.json({ ok: true });
  }));

  app.use('/api/outbound', api);

  // ── Google sign-in (browser redirects) ────────────────────────────────────
  app.get('/api/google/connect', (req, res) => {
    if (dialerLocked()) return res.status(403).send('Set ADMIN_PASSWORD first.');
    if (!googleConfigured()) return res.status(400).send('Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Render first (see README).');
    res.redirect(googleAuthUrl());
  });
  app.get('/api/google/callback', async (req, res) => {
    try {
      if (req.query.error) throw new Error(String(req.query.error));
      await finishGoogleAuth(String(req.query.code || ''), String(req.query.state || ''));
      res.redirect('/?google=connected');
    } catch (err: any) {
      res.status(400).send(`Google connection failed: ${String(err.message).replace(/[<>]/g, '')}. <a href="/">Back</a>`);
    }
  });

  // ── Twilio webhooks for outbound calls ────────────────────────────────────
  // (Signature check for every /api/webhooks/twilio route is applied in server.ts.)
  const hook = express.Router();

  hook.post('/call/answer', (req, res) => {
    const call = findCall(String(req.query.callId || ''));
    if (!call) return sendTwiml(res, '<Hangup/>');
    call.callSid = call.callSid || req.body.CallSid;
    call.answeredAt = new Date().toISOString();
    const answeredBy = String(req.body.AnsweredBy || '');

    if (/^machine|^fax/.test(answeredBy)) {
      call.state = 'voicemail';
      call.outcome = 'Voicemail';
      let vm = '';
      if (call.kind === 'reminder') vm = reminderVoicemail(call);
      else {
        const campaign = db.campaigns.find(c => c.id === call.campaignId);
        const script = scriptFor(call);
        if (campaign?.settings.leaveVoicemail && script.voicemail) vm = fillPlaceholders(script.voicemail, script, promptContext(call));
      }
      if (answeredBy === 'fax' || !vm) {
        addLine(call, 'system', 'Reached voicemail, hung up');
        return sendTwiml(res, '<Hangup/>');
      }
      addLine(call, 'ai', `(voicemail) ${vm}`);
      return sendTwiml(res, `${say(vm)}<Hangup/>`);
    }

    if (call.kind === 'reminder') return sendTwiml(res, reminderAnswerTwiml(call));

    const campaign = db.campaigns.find(c => c.id === call.campaignId);
    if (campaign?.mode === 'agent' && db.settings.agentPhone) {
      call.takenOver = true;
      call.state = 'human';
      ringAgent(call, db.settings.agentPhone).catch(err => {
        console.error('[agent mode] could not ring your phone:', err.message);
        agentMissed(call).catch(() => {});
      });
      return sendTwiml(res, customerConferenceTwiml(call, 'Hi, please hold for just a moment.'));
    }
    sendTwiml(res, openingTwiml(call));
  });

  hook.post('/call/turn', async (req, res) => {
    const call = findCall(String(req.query.callId || ''));
    if (!call) return sendTwiml(res, '<Hangup/>');
    const heard = String(req.body.SpeechResult || '').trim() || (req.body.Digits ? `pressed ${req.body.Digits}` : '');
    sendTwiml(res, await handleTurn(call, heard));
  });

  hook.post('/reminder/choice', async (req, res) => {
    const call = findCall(String(req.query.callId || ''));
    if (!call) return sendTwiml(res, '<Hangup/>');
    sendTwiml(res, await reminderChoice(call, String(req.body.Digits || ''), String(req.body.SpeechResult || '').trim()));
  });

  // Twilio reports ringing / answered / finished here.
  hook.post('/call/status', (req, res) => {
    const call = findCall(String(req.query.callId || '')) || findCallBySid(String(req.body.CallSid || ''));
    res.status(204).end();
    if (!call) return;
    const st = String(req.body.CallStatus || '');
    call.callSid = call.callSid || req.body.CallSid;
    call.lastActivityAt = new Date().toISOString();
    if (st === 'ringing' && call.state === 'queued') call.state = 'ringing';
    if (st === 'in-progress' && !call.answeredAt) call.answeredAt = new Date().toISOString();
    if (['completed', 'busy', 'no-answer', 'failed', 'canceled'].includes(st) && !call.endedAt) {
      call.endedAt = new Date().toISOString();
      call.durationSec = Number(req.body.CallDuration || 0);
      call.state = st === 'completed' ? (call.state === 'voicemail' ? 'voicemail' : 'completed') : (st as any);
      if (!call.outcome) call.outcome = st === 'completed' ? 'Talked' : st;
      onCallEnded(call);
    }
    save();
  });

  // Status of the leg that rings your phone during a takeover.
  hook.post('/agent-status', (req, res) => {
    res.status(204).end();
    const call = findCall(String(req.query.callId || ''));
    const st = String(req.body.CallStatus || '');
    if (call && ['no-answer', 'busy', 'failed', 'canceled'].includes(st)) {
      agentMissed(call).catch(err => console.error('[takeover] could not return call to AI:', err.message));
    }
  });

  app.use('/api/webhooks/twilio', hook);
}
