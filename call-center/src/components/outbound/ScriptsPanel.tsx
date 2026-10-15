// Edit the scripts the conversational AI follows, and test them by chatting.
import React, { useEffect, useState } from 'react';
import { Copy, Plus, Save, Send, Trash2, RotateCcw } from 'lucide-react';
import type { CallScript } from '../../types/outbound';
import { api } from './api';
import { Button, Card, Field, Input, Notice, Select, TextArea, useAction } from './ui';

const PURPOSE_LABEL = { outbound: 'Outbound calls (dialer)', reminder: 'Appointment reminders', inbound: 'Incoming calls' };

export const ScriptsPanel: React.FC<{ scripts: CallScript[]; reload: () => Promise<void> }> = ({ scripts, reload }) => {
  const [selectedId, setSelectedId] = useState(scripts[0]?.id || '');
  const [draft, setDraft] = useState<CallScript | null>(null);
  const [msg, setMsg] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const { busy, run } = useAction(setMsg);

  const saved = scripts.find(s => s.id === selectedId);
  useEffect(() => {
    if (!saved && scripts.length) setSelectedId(scripts[0].id);
    setDraft(saved ? { ...saved, objections: saved.objections.map(o => ({ ...o })) } : null);
  }, [selectedId, scripts]);

  const dirty = !!draft && !!saved && JSON.stringify(draft) !== JSON.stringify(saved);
  const set = <K extends keyof CallScript>(k: K, v: CallScript[K]) => draft && setDraft({ ...draft, [k]: v });

  return (
    <div className="grid lg:grid-cols-[240px_1fr] gap-5">
      <Card title="Scripts">
        <div className="space-y-2">
          {scripts.map(s => (
            <button
              key={s.id}
              onClick={() => {
                if (dirty && !window.confirm('Discard unsaved changes?')) return;
                setSelectedId(s.id);
              }}
              className={`w-full text-left p-3 rounded-xl border ${s.id === selectedId ? 'border-cyan-500 bg-cyan-950/40' : 'border-slate-800 bg-slate-950/50 hover:border-slate-600'}`}
            >
              <div className="font-bold text-sm text-slate-100">{s.name}</div>
              <div className="text-[11px] text-slate-500">{PURPOSE_LABEL[s.purpose]}</div>
            </button>
          ))}
        </div>
        <Button
          kind="primary"
          className="w-full mt-4"
          disabled={busy}
          onClick={() =>
            run(async () => {
              const s = await api.createScript({ name: 'New script', purpose: 'outbound', agentName: 'Ava', opening: 'Hi {first_name}, this is {agent} with {business}.', objections: [] });
              await reload();
              setSelectedId(s.id);
            })
          }
        >
          <Plus className="w-3.5 h-3.5" /> New script
        </Button>
      </Card>

      {draft ? (
        <div className="space-y-5">
          {msg && <Notice kind={msg.kind} onClose={() => setMsg(null)}>{msg.text}</Notice>}
          <Card
            title={draft.name}
            actions={
              <>
                {dirty && <span className="text-[11px] text-amber-300">Unsaved changes</span>}
                <Button small disabled={!dirty} onClick={() => saved && setDraft({ ...saved })}>
                  <RotateCcw className="w-3 h-3" /> Undo
                </Button>
                <Button
                  small
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const { id, ...rest } = draft;
                      const s = await api.createScript({ ...rest, name: `${draft.name} (copy)` });
                      await reload();
                      setSelectedId(s.id);
                    }, 'Copied.')
                  }
                >
                  <Copy className="w-3 h-3" /> Duplicate
                </Button>
                <Button
                  small
                  kind="danger"
                  disabled={busy}
                  onClick={() => window.confirm(`Delete "${draft.name}"?`) && run(async () => { await api.deleteScript(draft.id); await reload(); }, 'Deleted.')}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
                <Button kind="primary" disabled={busy || !dirty} onClick={() => run(async () => { await api.saveScript(draft); await reload(); }, 'Script saved. New calls use it right away.')}>
                  <Save className="w-3.5 h-3.5" /> Save
                </Button>
              </>
            }
          >
            <Notice>
              Write it the way you'd talk. The AI follows this as a guide, not word for word. You can use{' '}
              <code className="text-cyan-300">{'{first_name} {name} {business} {agent} {service} {appointment_time} {address}'}</code> and any column from
              your uploaded list, like <code className="text-cyan-300">{'{vehicle}'}</code>.
            </Notice>
            <div className="grid sm:grid-cols-3 gap-4 mt-4">
              <Field label="Script name">
                <Input value={draft.name} onChange={e => set('name', e.target.value)} />
              </Field>
              <Field label="Used for">
                <Select value={draft.purpose} onChange={e => set('purpose', e.target.value as any)}>
                  {Object.entries(PURPOSE_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="AI's name">
                <Input value={draft.agentName} onChange={e => set('agentName', e.target.value)} />
              </Field>
            </div>
            <div className="grid md:grid-cols-2 gap-4 mt-4">
              <Field label="Opening line" hint="Said word for word when the person answers.">
                <TextArea rows={4} value={draft.opening} onChange={e => set('opening', e.target.value)} />
              </Field>
              <Field label="Goal of the call">
                <TextArea rows={4} value={draft.goal} onChange={e => set('goal', e.target.value)} />
              </Field>
              <Field label="Key points to mention">
                <TextArea rows={6} value={draft.talkingPoints} onChange={e => set('talkingPoints', e.target.value)} />
              </Field>
              <Field label="Questions to ask">
                <TextArea rows={6} value={draft.questions} onChange={e => set('questions', e.target.value)} />
              </Field>
              <Field label="Closing line">
                <TextArea rows={3} value={draft.closing} onChange={e => set('closing', e.target.value)} />
              </Field>
              <Field label="Voicemail message" hint="Left when an answering machine picks up. Leave blank to hang up instead.">
                <TextArea rows={3} value={draft.voicemail} onChange={e => set('voicemail', e.target.value)} />
              </Field>
              <Field label="Rules (dos and don'ts)" className="md:col-span-2">
                <TextArea rows={5} value={draft.rules} onChange={e => set('rules', e.target.value)} />
              </Field>
            </div>

            <div className="mt-5">
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">If they say… the AI answers…</div>
              <div className="space-y-2">
                {draft.objections.map((o, i) => (
                  <div key={i} className="grid md:grid-cols-[1fr_2fr_auto] gap-2">
                    <Input
                      placeholder="They say…"
                      value={o.objection}
                      onChange={e => set('objections', draft.objections.map((x, j) => (j === i ? { ...x, objection: e.target.value } : x)))}
                    />
                    <Input
                      placeholder="AI answers…"
                      value={o.response}
                      onChange={e => set('objections', draft.objections.map((x, j) => (j === i ? { ...x, response: e.target.value } : x)))}
                    />
                    <Button small onClick={() => set('objections', draft.objections.filter((_, j) => j !== i))}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button small className="mt-2" onClick={() => set('objections', [...draft.objections, { objection: '', response: '' }])}>
                <Plus className="w-3 h-3" /> Add objection
              </Button>
            </div>
          </Card>

          <TestChat script={draft} dirty={dirty} />
        </div>
      ) : (
        <Card>
          <p className="text-sm text-slate-400">Pick a script.</p>
        </Card>
      )}
    </div>
  );
};

const TestChat: React.FC<{ script: CallScript; dirty: boolean }> = ({ script, dirty }) => {
  const [history, setHistory] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [opening, setOpening] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<string[]>([]);
  const [error, setError] = useState('');

  const reset = async () => {
    setHistory([]);
    setNotes([]);
    setError('');
    try {
      setOpening((await api.testScript(script.id, [])).reply);
    } catch (err: any) {
      setError(err.message);
    }
  };
  useEffect(() => {
    reset();
  }, [script.id]);

  const send = async () => {
    if (!text.trim()) return;
    const next = [...history, { role: 'user' as const, content: text.trim() }];
    setHistory(next);
    setText('');
    setBusy(true);
    setError('');
    try {
      const r = await api.testScript(script.id, next);
      setHistory([...next, { role: 'assistant', content: r.reply }]);
      setNotes(r.actions || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Try it out" actions={<Button small onClick={reset}>Start over</Button>}>
      <p className="text-xs text-slate-400 mb-3">
        Type what a customer might say. This uses the real AI with the {dirty ? <strong className="text-amber-300">last saved</strong> : 'saved'} version of the script. Nobody gets called.
      </p>
      <div className="space-y-2 max-h-80 overflow-y-auto bg-slate-950/70 border border-slate-800 rounded-xl p-3">
        {opening && <Bubble who="ai" text={opening} />}
        {history.map((h, i) => (
          <Bubble key={i} who={h.role === 'assistant' ? 'ai' : 'me'} text={h.content} />
        ))}
        {busy && <div className="text-xs text-slate-500">AI is thinking…</div>}
      </div>
      {notes.map(n => (
        <div key={n} className="text-[11px] text-emerald-300 mt-2">
          ⚡ {n}
        </div>
      ))}
      {error && <div className="mt-2"><Notice kind="error">{error}</Notice></div>}
      <div className="flex gap-2 mt-3">
        <Input value={text} placeholder="Say something as the customer…" onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} />
        <Button kind="primary" disabled={busy} onClick={send}>
          <Send className="w-3.5 h-3.5" />
        </Button>
      </div>
    </Card>
  );
};

const Bubble: React.FC<{ who: 'ai' | 'me'; text: string }> = ({ who, text }) => (
  <div className={`flex ${who === 'me' ? 'justify-end' : ''}`}>
    <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${who === 'me' ? 'bg-cyan-700/40 text-cyan-50' : 'bg-slate-800 text-slate-100'}`}>{text}</div>
  </div>
);
