// Settings: your phone, business hours, reminders, Google Calendar, Do Not Call list.
import React, { useEffect, useState } from 'react';
import { Save, Trash2, Video } from 'lucide-react';
import type { AppSettings, CallScript, DncEntry, SetupStatus } from '../../types/outbound';
import { api, DAY_LABELS, fmtPhone, fmtWhen, hourLabel, TIMEZONES } from './api';
import { Button, Card, Field, Input, Notice, Select, TextArea, Toggle, useAction } from './ui';
import { DialerSettingsForm } from './DialerSettingsForm';

const OFFSET_CHOICES = [72, 48, 24, 4, 2, 1];

export const SettingsPanel: React.FC<{
  settings: AppSettings;
  scripts: CallScript[];
  status: SetupStatus | null;
  onSaved: (s: AppSettings) => void;
  refreshStatus: () => void;
}> = ({ settings, scripts, status, onSaved, refreshStatus }) => {
  const [s, setS] = useState(settings);
  const [msg, setMsg] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const { busy, run } = useAction(setMsg);
  const [dnc, setDnc] = useState<DncEntry[]>([]);
  const [dncText, setDncText] = useState('');

  useEffect(() => setS(settings), [settings]);
  const loadDnc = () => api.dnc().then(setDnc).catch(() => {});
  useEffect(() => {
    loadDnc();
  }, []);

  const bh = s.businessHours;
  const setBh = (patch: Partial<AppSettings['businessHours']>) => setS({ ...s, businessHours: { ...bh, ...patch } });

  const save = () =>
    run(async () => {
      const saved = await api.saveSettings(s);
      onSaved(saved);
      refreshStatus();
    }, 'Settings saved.');

  return (
    <div className="space-y-5">
      {msg && <Notice kind={msg.kind} onClose={() => setMsg(null)}>{msg.text}</Notice>}

      <Card title="Your business" actions={<Button kind="primary" disabled={busy} onClick={save}><Save className="w-3.5 h-3.5" /> Save settings</Button>}>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Field label="Business name" hint="What the AI says it's calling for.">
            <Input value={s.businessName} onChange={e => setS({ ...s, businessName: e.target.value })} />
          </Field>
          <Field label="Address" className="lg:col-span-2">
            <Input value={s.businessAddress} onChange={e => setS({ ...s, businessAddress: e.target.value })} />
          </Field>
          <Field label="Your phone (cell)" hint="Rings when you take over a call or place one.">
            <Input value={s.agentPhone} placeholder="(305) 555-0123" onChange={e => setS({ ...s, agentPhone: e.target.value })} />
          </Field>
          <Field label="Business line (caller ID)" hint="Your Twilio number. Blank = TWILIO_FROM_NUMBER.">
            <Input value={s.callerId} placeholder={status?.callerId || '+13055550100'} onChange={e => setS({ ...s, callerId: e.target.value })} />
          </Field>
          <Field label="Incoming calls are answered with" className="lg:col-span-3">
            <Select value={s.inboundScriptId} onChange={e => setS({ ...s, inboundScriptId: e.target.value })}>
              <option value="">The original built-in receptionist</option>
              {scripts.map(sc => (
                <option key={sc.id} value={sc.id}>
                  Script: {sc.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      <Card title="Appointments & reminders">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Field label="Open from">
            <Select value={bh.startHour} onChange={e => setBh({ startHour: Number(e.target.value) })}>
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>{hourLabel(h)}</option>
              ))}
            </Select>
          </Field>
          <Field label="Until">
            <Select value={bh.endHour} onChange={e => setBh({ endHour: Number(e.target.value) })}>
              {Array.from({ length: 24 }, (_, h) => h + 1).map(h => (
                <option key={h} value={h}>{hourLabel(h)}</option>
              ))}
            </Select>
          </Field>
          <Field label="Time zone">
            <Select value={bh.timezone} onChange={e => setBh({ timezone: e.target.value })}>
              {[...new Set([bh.timezone, ...TIMEZONES])].map(tz => (
                <option key={tz}>{tz}</option>
              ))}
            </Select>
          </Field>
          <Field label="Open days">
            <div className="flex flex-wrap gap-1">
              {DAY_LABELS.map((d, i) => {
                const on = bh.days.includes(i);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setBh({ days: on ? bh.days.filter(x => x !== i) : [...bh.days, i].sort() })}
                    className={`px-2 py-1.5 rounded-lg text-[11px] font-bold border ${on ? 'bg-cyan-600/30 border-cyan-500 text-cyan-200' : 'bg-slate-950 border-slate-700 text-slate-500'}`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label="Appointment length (min)">
            <Input type="number" value={s.defaultAppointmentMinutes} onChange={e => setS({ ...s, defaultAppointmentMinutes: Number(e.target.value) })} />
          </Field>
          <Field label="Appointments at the same time" hint="Number of staff who can see people at once.">
            <Input type="number" min={1} value={s.appointmentsPerSlot} onChange={e => setS({ ...s, appointmentsPerSlot: Number(e.target.value) })} />
          </Field>
          <Field label="Send reminders by">
            <Select value={s.reminderChannel} onChange={e => setS({ ...s, reminderChannel: e.target.value as any })}>
              <option value="sms">Text message</option>
              <option value="call">Phone call (texts if no answer)</option>
              <option value="both">Text and phone call</option>
            </Select>
          </Field>
          <Field label="Remind them">
            <div className="flex flex-wrap gap-1">
              {OFFSET_CHOICES.map(h => {
                const on = s.reminderOffsetsHours.includes(h);
                return (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setS({ ...s, reminderOffsetsHours: on ? s.reminderOffsetsHours.filter(x => x !== h) : [...s.reminderOffsetsHours, h] })}
                    className={`px-2 py-1.5 rounded-lg text-[11px] font-bold border ${on ? 'bg-amber-600/30 border-amber-500 text-amber-200' : 'bg-slate-950 border-slate-700 text-slate-500'}`}
                  >
                    {h >= 24 ? `${h / 24}d` : `${h}h`} before
                  </button>
                );
              })}
            </div>
          </Field>
        </div>
      </Card>

      <Card title={<span className="flex items-center gap-2"><Video className="w-4 h-4 text-cyan-400" /> Google Meet video calls</span>}>
        <div className="space-y-3 text-sm text-slate-300">
          {status?.googleConnected ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-emerald-300 font-bold">✓ Google Calendar connected.</span>
              <span className="text-xs text-slate-400">Video appointments get their own Meet link and calendar invite.</span>
              <Button small onClick={() => run(async () => { await api.disconnectGoogle(); refreshStatus(); }, 'Disconnected.')}>
                Disconnect
              </Button>
            </div>
          ) : status?.googleConfigured ? (
            <div className="flex items-center gap-3">
              <a href="/api/google/connect">
                <Button kind="primary">Connect Google Calendar</Button>
              </a>
              <span className="text-xs text-slate-400">You'll sign in with Google and allow calendar access.</span>
            </div>
          ) : (
            <Notice>
              To create a fresh Meet link for every video appointment, set up the Google connection (step 6 in the README). Until then, paste your
              personal Meet link below and every video appointment will use it.
            </Notice>
          )}
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Fallback Meet link" hint="Used when Google Calendar isn't connected, e.g. https://meet.google.com/abc-defg-hij">
              <Input value={s.staticMeetLink} onChange={e => setS({ ...s, staticMeetLink: e.target.value })} />
            </Field>
            <div className="pt-6">
              <Toggle
                checked={s.addAllToCalendar}
                onChange={v => setS({ ...s, addAllToCalendar: v })}
                label="Put every appointment on my Google Calendar, not only video ones"
              />
            </div>
          </div>
        </div>
      </Card>

      <Card title="Default dialer settings for new campaigns">
        <DialerSettingsForm value={s.defaultDialer} onChange={defaultDialer => setS({ ...s, defaultDialer })} />
        <div className="mt-4">
          <Button kind="primary" disabled={busy} onClick={save}>
            <Save className="w-3.5 h-3.5" /> Save settings
          </Button>
        </div>
      </Card>

      <Card title={`Do Not Call list (${dnc.length})`}>
        <p className="text-xs text-slate-400 mb-3">
          These numbers are never dialed. People are added automatically when they text STOP, say "stop calling", or press 9 on a reminder call. If you
          sell to new customers, also check numbers against the National Do Not Call Registry before uploading.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <TextArea rows={2} placeholder="Paste numbers to block, separated by commas or new lines" value={dncText} onChange={e => setDncText(e.target.value)} />
          <Button
            kind="danger"
            disabled={busy || !dncText.trim()}
            onClick={() => run(async () => { const r = await api.addDnc(dncText); setDncText(''); await loadDnc(); return r; }, (r: any) => `${r.added} numbers added.`)}
          >
            Add to list
          </Button>
        </div>
        <div className="mt-3 max-h-64 overflow-y-auto divide-y divide-slate-800">
          {dnc.map(d => (
            <div key={d.phone} className="flex items-center gap-3 py-1.5 text-xs">
              <span className="font-mono text-slate-200 w-36">{fmtPhone(d.phone)}</span>
              <span className="text-slate-500 flex-1">{d.reason}</span>
              <span className="text-slate-600">{fmtWhen(d.addedAt)}</span>
              <Button small onClick={() => window.confirm(`Remove ${d.phone} from the Do Not Call list?`) && run(async () => { await api.removeDnc(d.phone); await loadDnc(); })}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
