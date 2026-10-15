// Campaigns: upload a contact list, pick a script, set pacing, start/pause.
import React, { useEffect, useState } from 'react';
import { Pause, Play, Plus, RotateCcw, Trash2, PhoneOutgoing, Save } from 'lucide-react';
import type { CallScript, Contact, DialerSettings } from '../../types/outbound';
import { api, fmtPhone, fmtWhen, type CampaignWithStats } from './api';
import { Badge, Button, Card, Field, Input, Notice, Select, Toggle, useAction } from './ui';
import { ImportWizard } from './ImportWizard';
import { DialerSettingsForm } from './DialerSettingsForm';

const CONSENT_TEXT =
  'I confirm everyone on this list agreed to be called by my business (for example, they filled out a form, are a customer, or asked us to call). Calls use an AI voice, which the law treats like a recorded voice.';

export const CampaignsPanel: React.FC<{ scripts: CallScript[]; defaults?: DialerSettings; refreshKey: number; leadgenproConfigured?: boolean }> = ({ scripts, defaults, refreshKey, leadgenproConfigured }) => {
  const [campaigns, setCampaigns] = useState<CampaignWithStats[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [msg, setMsg] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const { busy, run } = useAction(setMsg);
  const [newName, setNewName] = useState('');

  const load = async () => {
    try {
      const list = await api.campaigns();
      setCampaigns(list);
      if (!selectedId && list.length) setSelectedId(list[0].id);
    } catch (err: any) {
      setMsg({ kind: 'error', text: err.message });
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [refreshKey]);

  const selected = campaigns.find(c => c.id === selectedId);

  return (
    <div className="grid lg:grid-cols-[280px_1fr] gap-5">
      <div className="space-y-3">
        <Card title="Campaigns">
          <div className="space-y-2">
            {campaigns.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`w-full text-left p-3 rounded-xl border transition-colors ${
                  c.id === selectedId ? 'border-cyan-500 bg-cyan-950/40' : 'border-slate-800 bg-slate-950/50 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-sm text-slate-100 truncate">{c.name}</span>
                  <Badge value={c.status} />
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {c.stats.total} contacts • {c.stats.remaining} left • {c.stats.booked} booked
                </div>
              </button>
            ))}
            {!campaigns.length && <p className="text-xs text-slate-500">No campaigns yet. Create one below.</p>}
          </div>
          <div className="mt-4 space-y-2">
            <Input placeholder="New campaign name" value={newName} onChange={e => setNewName(e.target.value)} />
            <Button
              kind="primary"
              className="w-full"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const c = await api.createCampaign({ name: newName || 'New campaign', settings: defaults });
                  setNewName('');
                  setSelectedId(c.id);
                  await load();
                }, 'Campaign created. Now upload your contact list.')
              }
            >
              <Plus className="w-3.5 h-3.5" /> Create campaign
            </Button>
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        {msg && <Notice kind={msg.kind} onClose={() => setMsg(null)}>{msg.text}</Notice>}
        {selected ? (
          <CampaignDetail key={selected.id} campaign={selected} scripts={scripts} reload={load} setMsg={setMsg} onDeleted={() => setSelectedId('')} leadgenproConfigured={leadgenproConfigured} />
        ) : (
          <Card>
            <p className="text-sm text-slate-400">Create a campaign to load a list of numbers and start dialing.</p>
          </Card>
        )}
      </div>
    </div>
  );
};

const CampaignDetail: React.FC<{
  campaign: CampaignWithStats;
  scripts: CallScript[];
  reload: () => Promise<void>;
  setMsg: (m: { kind: 'error' | 'success'; text: string } | null) => void;
  onDeleted: () => void;
  leadgenproConfigured?: boolean;
}> = ({ campaign: c, scripts, reload, setMsg, onDeleted, leadgenproConfigured }) => {
  const { busy, run } = useAction(setMsg);
  const [tab, setTab] = useState<'contacts' | 'upload' | 'settings'>(c.stats.total ? 'contacts' : 'upload');
  const [draft, setDraft] = useState({ name: c.name, mode: c.mode, scriptId: c.scriptId, settings: c.settings });
  const [consent, setConsent] = useState(c.consentConfirmed);
  const [wizardKey, setWizardKey] = useState(0);
  const running = c.status === 'running';
  const s = c.stats;

  return (
    <>
      <Card
        title={
          <span className="flex items-center gap-2">
            {c.name} <Badge value={c.status} />
          </span>
        }
        actions={
          <>
            {running ? (
              <Button kind="secondary" disabled={busy} onClick={() => run(async () => { await api.pauseCampaign(c.id); await reload(); }, 'Paused. Calls in progress will finish.')}>
                <Pause className="w-3.5 h-3.5" /> Pause
              </Button>
            ) : (
              <Button kind="success" disabled={busy || !s.total} onClick={() => run(async () => { await api.startCampaign(c.id); await reload(); }, 'Dialing started. Watch it under Live Calls.')}>
                <Play className="w-3.5 h-3.5" /> {c.status === 'paused' ? 'Resume dialing' : 'Start dialing'}
              </Button>
            )}
            <Button
              small
              disabled={busy}
              title="Put no-answer, busy and voicemail contacts back in line for another round"
              onClick={() => run(() => api.recycleCampaign(c.id), (r: any) => `${r.recycled} contacts put back in line.`).then(reload)}
            >
              <RotateCcw className="w-3.5 h-3.5" /> Redial unreached
            </Button>
            {leadgenproConfigured && (
              <Button
                small
                disabled={busy}
                title="Pull new leads from leadgenpro into this campaign"
                onClick={() =>
                  run(() => api.syncLeadgenpro(c.id), (r: any) => `${r.added} new lead${r.added === 1 ? '' : 's'} added (${r.skipped} already here).`).then(reload)
                }
              >
                <PhoneOutgoing className="w-3.5 h-3.5" /> Sync from leadgenpro
              </Button>
            )}
            <Button
              small
              kind="danger"
              disabled={busy || running}
              onClick={() => {
                if (window.confirm(`Delete "${c.name}" and its ${s.total} contacts?`)) run(async () => { await api.deleteCampaign(c.id); onDeleted(); await reload(); }, 'Campaign deleted.');
              }}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </>
        }
      >
        {c.lastError && <Notice kind="error">{c.lastError}</Notice>}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-2">
          {[
            ['Contacts', s.total],
            ['Left to call', s.remaining],
            ['On a call', s.activeCalls],
            ['Booked', s.booked],
            ['Talked', s.answered],
            ['Voicemail / no answer', s.voicemail + s.noAnswer],
          ].map(([label, n]) => (
            <div key={label as string} className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
              <div className="text-xl font-black text-white">{n}</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex gap-1">
        {(
          [
            ['contacts', `Contacts (${s.total})`],
            ['upload', 'Upload list'],
            ['settings', 'Script & dialer settings'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold ${tab === k ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-slate-200'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'upload' && (
        <Card title="Upload contacts">
          <ImportWizard
            key={wizardKey}
            allowed={['name', 'first_name', 'last_name', 'phone', 'email', 'timezone', 'notes', 'extra']}
            required={['phone']}
            busy={busy}
            importLabel="Add {n} contacts to this campaign"
            onImport={rows => {
              if (!consent) {
                setMsg({ kind: 'error', text: 'Please tick the permission box first.' });
                return;
              }
              run(
                async () => {
                  const r = await api.importContacts(c.id, rows, true);
                  setWizardKey(k => k + 1);
                  await reload();
                  setTab('contacts');
                  return r;
                },
                (r: any) =>
                  `Added ${r.added} contacts.` +
                  (r.duplicates ? ` ${r.duplicates} duplicates skipped.` : '') +
                  (r.dnc ? ` ${r.dnc} are on your Do Not Call list and won't be called.` : '') +
                  (r.invalid ? ` ${r.invalid} rows had no valid phone number (e.g. ${r.invalidSamples.slice(0, 3).join('; ')}).` : ''),
              );
            }}
          >
            <Toggle checked={consent} onChange={setConsent} label={CONSENT_TEXT} />
          </ImportWizard>
          <p className="text-[11px] text-slate-500 mt-4">
            Tip: add a "Time zone" column (like America/Chicago) for contacts outside your area. Any other columns (like "service" or
            "vehicle") are passed to the AI, and you can use them in scripts as {'{service}'}.
          </p>
        </Card>
      )}

      {tab === 'contacts' && <ContactsTable campaign={c} setMsg={setMsg} reload={reload} />}

      {tab === 'settings' && (
        <Card
          title="Script & dialer settings"
          actions={
            <Button
              kind="primary"
              disabled={busy}
              onClick={() => run(async () => { await api.saveCampaign(c.id, { ...draft, consentConfirmed: consent }); await reload(); }, 'Saved.')}
            >
              <Save className="w-3.5 h-3.5" /> Save
            </Button>
          }
        >
          <div className="grid sm:grid-cols-3 gap-4 mb-6">
            <Field label="Campaign name">
              <Input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />
            </Field>
            <Field label="Who talks when someone answers">
              <Select value={draft.mode} onChange={e => setDraft({ ...draft, mode: e.target.value as any })}>
                <option value="ai">The AI, using a script (you can take over)</option>
                <option value="agent">Ring my phone and connect me</option>
              </Select>
            </Field>
            <Field label="Script">
              <Select value={draft.scriptId} onChange={e => setDraft({ ...draft, scriptId: e.target.value })}>
                {scripts.map(sc => (
                  <option key={sc.id} value={sc.id}>
                    {sc.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <DialerSettingsForm value={draft.settings} onChange={settings => setDraft({ ...draft, settings })} />
          <div className="mt-5">
            <Toggle checked={consent} onChange={setConsent} label={CONSENT_TEXT} />
          </div>
        </Card>
      )}
    </>
  );
};

const STATUS_FILTERS = ['', 'pending', 'booked', 'answered', 'voicemail', 'no_answer', 'busy', 'failed', 'dnc'];

const ContactsTable: React.FC<{
  campaign: CampaignWithStats;
  setMsg: (m: { kind: 'error' | 'success'; text: string } | null) => void;
  reload: () => Promise<void>;
}> = ({ campaign, setMsg, reload }) => {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [data, setData] = useState<{ total: number; contacts: Contact[] }>({ total: 0, contacts: [] });
  const { busy, run } = useAction(setMsg);

  const load = () => api.contacts(campaign.id, q, status).then(setData).catch(err => setMsg({ kind: 'error', text: err.message }));
  useEffect(() => {
    load();
  }, [q, status, campaign.stats.total, campaign.stats.remaining, campaign.stats.activeCalls]);

  return (
    <Card
      title={`Contacts (${data.total})`}
      actions={
        <>
          <Input placeholder="Search name or number" value={q} onChange={e => setQ(e.target.value)} className="!w-48 !py-1.5" />
          <Select value={status} onChange={e => setStatus(e.target.value)} className="!w-36 !py-1.5">
            {STATUS_FILTERS.map(sv => (
              <option key={sv} value={sv}>
                {sv ? sv.replace('_', ' ') : 'All statuses'}
              </option>
            ))}
          </Select>
        </>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-slate-500 uppercase text-[10px] tracking-wider">
            <tr>
              <th className="text-left p-2">Name</th>
              <th className="text-left p-2">Phone</th>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">Tries</th>
              <th className="text-left p-2">Last result</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {data.contacts.map(ct => (
              <tr key={ct.id} className="border-t border-slate-800">
                <td className="p-2 text-slate-200">{ct.name || '—'}</td>
                <td className="p-2 font-mono text-slate-300">{fmtPhone(ct.phone)}</td>
                <td className="p-2">
                  <Badge value={ct.status} />
                </td>
                <td className="p-2 text-slate-400">{ct.attempts}</td>
                <td className="p-2 text-slate-400">
                  {ct.lastOutcome || ''} {ct.nextAttemptAt && ct.status !== 'booked' ? <span className="text-slate-600">• retry {fmtWhen(ct.nextAttemptAt)}</span> : ''}
                </td>
                <td className="p-2 text-right whitespace-nowrap">
                  <Button
                    small
                    disabled={busy || ct.status === 'dnc'}
                    title="Rings your phone, then connects you to this person"
                    onClick={() => run(() => api.manualCall(ct.phone, ct.name, ct.id), 'Calling your phone now. Answer it to be connected.')}
                  >
                    <PhoneOutgoing className="w-3 h-3" /> Call
                  </Button>{' '}
                  <Button small disabled={busy} onClick={() => run(async () => { await api.deleteContact(ct.id); await load(); await reload(); })}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.total > data.contacts.length && <p className="text-[11px] text-slate-500 mt-2">Showing the first {data.contacts.length}. Use search to find others.</p>}
        {!data.total && <p className="text-xs text-slate-500 p-2">No contacts here yet.</p>}
      </div>
    </Card>
  );
};
