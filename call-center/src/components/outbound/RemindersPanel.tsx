// Appointment reminders: add or import appointments, see who confirmed or
// rescheduled, and send a reminder right now.
import React, { useEffect, useState } from 'react';
import { Bell, CalendarPlus, Upload, Video, X, Trash2, Save } from 'lucide-react';
import type { AppSettings, Appointment } from '../../types/outbound';
import { api, fmtPhone, fmtWhen } from './api';
import { Badge, Button, Card, Field, Input, Notice, Toggle, useAction } from './ui';
import { ImportWizard } from './ImportWizard';

function toLocalInput(iso: string, tz: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      .formatToParts(new Date(iso))
      .map(x => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

const EMPTY = { name: '', phone: '', email: '', service: '', date: '', durationMinutes: 0, video: false, notes: '', sendConfirmation: true };

export const RemindersPanel: React.FC<{ settings: AppSettings | null; googleConnected: boolean }> = ({ settings, googleConnected }) => {
  const [list, setList] = useState<Appointment[]>([]);
  const [msg, setMsg] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const { busy, run } = useAction(setMsg);
  const [mode, setMode] = useState<'' | 'add' | 'import'>('');
  const [form, setForm] = useState(EMPTY);
  const [sendConfirmation, setSendConfirmation] = useState(false);
  const [wizardKey, setWizardKey] = useState(0);
  const [editing, setEditing] = useState<{ id: string; date: string } | null>(null);
  const [showPast, setShowPast] = useState(false);
  const tz = settings?.businessHours.timezone || 'America/New_York';

  const load = () => api.appointments().then(setList).catch(err => setMsg({ kind: 'error', text: err.message }));
  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  const now = Date.now();
  const shown = list.filter(a => showPast || new Date(a.startsAt).getTime() > now - 3600000);
  const offsets = settings?.reminderOffsetsHours || [];
  const channel = { sms: 'text message', call: 'phone call (text if no answer)', both: 'text and phone call' }[settings?.reminderChannel || 'sms'];

  return (
    <div className="space-y-5">
      {msg && <Notice kind={msg.kind} onClose={() => setMsg(null)}>{msg.text}</Notice>}

      <Card
        title={
          <span className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-400" /> Appointment reminders
          </span>
        }
        actions={
          <>
            <Button kind="primary" onClick={() => setMode(mode === 'add' ? '' : 'add')}>
              <CalendarPlus className="w-3.5 h-3.5" /> Add appointment
            </Button>
            <Button onClick={() => setMode(mode === 'import' ? '' : 'import')}>
              <Upload className="w-3.5 h-3.5" /> Import from Excel / CSV
            </Button>
          </>
        }
      >
        <p className="text-xs text-slate-400">
          Reminders go out by <strong className="text-slate-200">{channel}</strong>{' '}
          {offsets.length ? `${offsets.map(h => (h >= 24 && h % 24 === 0 ? `${h / 24} day${h > 24 ? 's' : ''}` : `${h} hour${h > 1 ? 's' : ''}`)).join(' and ')} before` : '(no reminder times set)'}.
          People can reply <strong>C</strong> to confirm, <strong>R</strong> to reschedule with the AI, or <strong>X</strong> to cancel. On a reminder call they press
          1, 2 or 3, or just say it. Change this under Settings.
        </p>

        {mode === 'add' && (
          <div className="mt-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Field label="Name">
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Phone">
              <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label={`Date & time (${tz})`}>
              <Input type="datetime-local" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
            </Field>
            <Field label="Service">
              <Input value={form.service} placeholder="e.g. Consultation" onChange={e => setForm({ ...form, service: e.target.value })} />
            </Field>
            <Field label="Email (optional)" hint="Gets the Google Calendar invite.">
              <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Length (minutes)">
              <Input type="number" value={form.durationMinutes || settings?.defaultAppointmentMinutes || 30} onChange={e => setForm({ ...form, durationMinutes: Number(e.target.value) })} />
            </Field>
            <Field label="Notes" className="lg:col-span-2">
              <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </Field>
            <div className="sm:col-span-2 lg:col-span-4 space-y-2">
              <Toggle
                checked={form.video}
                onChange={video => setForm({ ...form, video })}
                label={
                  <>
                    <strong>Video appointment (Google Meet).</strong>{' '}
                    {googleConnected ? 'A Meet link is created automatically.' : settings?.staticMeetLink ? 'Uses your Meet link from Settings.' : 'Connect Google Calendar in Settings to create Meet links.'}
                  </>
                }
              />
              <Toggle checked={form.sendConfirmation} onChange={v => setForm({ ...form, sendConfirmation: v })} label="Text them a confirmation now" />
              <Button
                kind="primary"
                disabled={busy || !form.phone || !form.date}
                onClick={() =>
                  run(async () => {
                    await api.createAppointment({ ...form, durationMinutes: form.durationMinutes || undefined });
                    setForm(EMPTY);
                    setMode('');
                    await load();
                  }, 'Appointment added. Reminders will go out automatically.')
                }
              >
                <Save className="w-3.5 h-3.5" /> Save appointment
              </Button>
            </div>
          </div>
        )}

        {mode === 'import' && (
          <div className="mt-5">
            <ImportWizard
              key={wizardKey}
              allowed={['name', 'first_name', 'last_name', 'phone', 'email', 'service', 'date', 'time', 'video', 'duration', 'notes']}
              required={['phone', 'date']}
              busy={busy}
              importLabel="Import {n} appointments"
              onImport={rows =>
                run(
                  async () => {
                    const r = await api.importAppointments(rows, sendConfirmation);
                    setWizardKey(k => k + 1);
                    if (r.added) setMode('');
                    await load();
                    return r;
                  },
                  (r: any) => `Imported ${r.added} appointments.${r.failed ? ` ${r.failed} rows failed: ${r.errors.slice(0, 3).join('; ')}` : ''}`,
                )
              }
            >
              <p className="text-[11px] text-slate-500">Dates and times are read in {tz}. Columns needed: phone and date (time can be its own column).</p>
              <Toggle checked={sendConfirmation} onChange={setSendConfirmation} label="Text everyone a booking confirmation now" />
            </ImportWizard>
          </div>
        )}
      </Card>

      <Card
        title={`Appointments (${shown.length})`}
        actions={<Toggle checked={showPast} onChange={setShowPast} label="Show past" />}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-slate-500 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="text-left p-2">When ({tz.split('/')[1]?.replace('_', ' ')})</th>
                <th className="text-left p-2">Who</th>
                <th className="text-left p-2">Service</th>
                <th className="text-left p-2">Status</th>
                <th className="text-left p-2">Last activity</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {shown.map(a => (
                <tr key={a.id} className="border-t border-slate-800 align-top">
                  <td className="p-2 text-slate-200 whitespace-nowrap">
                    {editing?.id === a.id ? (
                      <div className="flex gap-1">
                        <Input type="datetime-local" value={editing.date} onChange={e => setEditing({ ...editing, date: e.target.value })} className="!py-1 !text-xs !w-48" />
                        <Button
                          small
                          kind="primary"
                          disabled={busy}
                          onClick={() =>
                            run(async () => {
                              await api.saveAppointment(a.id, { date: editing.date, sendConfirmation: true });
                              setEditing(null);
                              await load();
                            }, 'Moved, and a text with the new time was sent.')
                          }
                        >
                          Save
                        </Button>
                      </div>
                    ) : (
                      <button className="hover:text-cyan-300" title="Click to change the time" onClick={() => setEditing({ id: a.id, date: toLocalInput(a.startsAt, tz) })}>
                        {fmtWhen(a.startsAt, tz)}
                      </button>
                    )}
                  </td>
                  <td className="p-2">
                    <div className="text-slate-200 font-semibold">{a.name}</div>
                    <div className="text-slate-500 font-mono">{fmtPhone(a.phone)}</div>
                  </td>
                  <td className="p-2 text-slate-300">
                    {a.service}
                    {a.video && (
                      <div className="flex items-center gap-1 text-cyan-400 mt-0.5">
                        <Video className="w-3 h-3" />
                        {a.meetLink ? (
                          <a href={a.meetLink} target="_blank" rel="noreferrer" className="underline">
                            Meet link
                          </a>
                        ) : (
                          'Video (no link yet)'
                        )}
                      </div>
                    )}
                  </td>
                  <td className="p-2">
                    <Badge value={a.status} />
                  </td>
                  <td className="p-2 text-slate-500 max-w-[220px]" title={a.history.map(h => `${fmtWhen(h.at)}: ${h.text}`).join('\n')}>
                    {a.history[a.history.length - 1]?.text}
                  </td>
                  <td className="p-2 text-right whitespace-nowrap">
                    <Button small disabled={busy || a.status === 'cancelled'} onClick={() => run(() => api.remindNow(a.id), (r: any) => r.message).then(load)}>
                      <Bell className="w-3 h-3" /> Remind now
                    </Button>{' '}
                    <Button
                      small
                      disabled={busy || a.status === 'cancelled'}
                      onClick={() => window.confirm(`Cancel ${a.name}'s appointment?`) && run(() => api.cancelAppointment(a.id), 'Cancelled.').then(load)}
                    >
                      <X className="w-3 h-3" />
                    </Button>{' '}
                    <Button small disabled={busy} onClick={() => window.confirm('Delete this appointment from the list?') && run(() => api.deleteAppointment(a.id)).then(load)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!shown.length && <p className="text-sm text-slate-500 p-2">No upcoming appointments. Add one, import a list, or let the AI book them on calls.</p>}
        </div>
      </Card>
    </div>
  );
};
