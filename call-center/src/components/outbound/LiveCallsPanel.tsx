// Live calls: watch the AI's conversation as it happens, take over, hang up,
// or place a call yourself.
import React, { useEffect, useRef, useState } from 'react';
import { Headphones, PhoneOff, PhoneOutgoing, ChevronDown, ChevronRight } from 'lucide-react';
import type { CallRecord } from '../../types/outbound';
import { api, fmtPhone, fmtWhen } from './api';
import { Badge, Button, Card, Input, Notice, useAction } from './ui';

const KIND_LABEL: Record<string, string> = { campaign: 'Dialer', reminder: 'Reminder', manual: 'You called', inbound: 'Incoming' };

function elapsed(from?: string) {
  if (!from) return '';
  const s = Math.max(0, Math.floor((Date.now() - new Date(from).getTime()) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const Transcript: React.FC<{ call: CallRecord; live?: boolean }> = ({ call, live }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (live && ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [call.transcript.length, live]);
  return (
    <div ref={ref} className="max-h-64 overflow-y-auto space-y-1.5 bg-slate-950/70 rounded-xl p-3 border border-slate-800">
      {call.transcript.map((t, i) => (
        <div key={i} className="text-xs leading-relaxed">
          <span
            className={`font-bold mr-1.5 ${
              t.speaker === 'ai' ? 'text-cyan-400' : t.speaker === 'caller' ? 'text-amber-300' : t.speaker === 'human' ? 'text-rose-300' : 'text-slate-500'
            }`}
          >
            {t.speaker === 'ai' ? 'AI' : t.speaker === 'caller' ? call.name || 'Caller' : t.speaker === 'human' ? 'You' : '•'}
          </span>
          <span className={t.speaker === 'system' ? 'text-slate-500 italic' : 'text-slate-200'}>{t.text}</span>
        </div>
      ))}
      {!call.transcript.length && <div className="text-xs text-slate-500">{live ? 'Waiting for the call to connect…' : 'No transcript.'}</div>}
    </div>
  );
};

export const LiveCallsPanel: React.FC<{ agentPhoneSet: boolean }> = ({ agentPhoneSet }) => {
  const [data, setData] = useState<{ active: CallRecord[]; recent: CallRecord[] }>({ active: [], recent: [] });
  const [msg, setMsg] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const { busy, run } = useAction(setMsg);
  const [open, setOpen] = useState<string>('');
  const [dial, setDial] = useState({ phone: '', name: '' });
  const [, tick] = useState(0);

  useEffect(() => {
    const load = () => api.calls().then(setData).catch(() => {});
    load();
    const t = setInterval(() => {
      load();
      tick(x => x + 1);
    }, 2000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="space-y-5">
      {msg && <Notice kind={msg.kind} onClose={() => setMsg(null)}>{msg.text}</Notice>}
      {!agentPhoneSet && (
        <Notice kind="warn">Add your phone number under Settings so you can take over calls and place calls yourself.</Notice>
      )}

      <Card title={`Live now (${data.active.length})`}>
        {!data.active.length && <p className="text-sm text-slate-500">No calls right now. Start a campaign or wait for an incoming call.</p>}
        <div className="grid md:grid-cols-2 gap-4">
          {data.active.map(c => (
            <div key={c.id} className="border border-slate-700 rounded-2xl p-4 bg-slate-950/40 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-bold text-white">{c.name || fmtPhone(c.direction === 'inbound' ? c.from : c.to)}</div>
                  <div className="text-[11px] text-slate-500">
                    {fmtPhone(c.direction === 'inbound' ? c.from : c.to)} • {KIND_LABEL[c.kind]} • {elapsed(c.answeredAt || c.startedAt)}
                  </div>
                </div>
                <Badge value={c.state} label={c.state === 'ai' ? 'AI talking' : c.state === 'human' ? 'You' : c.state} />
              </div>
              <Transcript call={c} live />
              <div className="flex gap-2">
                <Button
                  kind="danger"
                  disabled={busy || c.takenOver || !agentPhoneSet || c.state === 'queued' || c.state === 'ringing'}
                  onClick={() => run(() => api.takeover(c.id), 'Your phone is ringing. Answer it to join the call. The caller hears hold music until you do.')}
                >
                  <Headphones className="w-3.5 h-3.5" /> {c.takenOver ? 'Taken over' : 'Take over'}
                </Button>
                <Button disabled={busy} onClick={() => window.confirm('Hang up this call?') && run(() => api.hangup(c.id))}>
                  <PhoneOff className="w-3.5 h-3.5" /> Hang up
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Call someone yourself">
        <p className="text-xs text-slate-400 mb-3">Twilio rings your phone first. When you answer, it dials the number below from your business line.</p>
        <div className="flex flex-wrap gap-2">
          <Input placeholder="Phone number" value={dial.phone} onChange={e => setDial({ ...dial, phone: e.target.value })} className="!w-48" />
          <Input placeholder="Name (optional)" value={dial.name} onChange={e => setDial({ ...dial, name: e.target.value })} className="!w-48" />
          <Button
            kind="primary"
            disabled={busy || !dial.phone || !agentPhoneSet}
            onClick={() => run(() => api.manualCall(dial.phone, dial.name), 'Calling your phone now. Answer it to be connected.')}
          >
            <PhoneOutgoing className="w-3.5 h-3.5" /> Call
          </Button>
        </div>
      </Card>

      <Card title="Recent calls">
        <div className="divide-y divide-slate-800">
          {data.recent.map(c => (
            <div key={c.id} className="py-2">
              <button className="w-full flex items-center gap-3 text-left text-xs" onClick={() => setOpen(open === c.id ? '' : c.id)}>
                {open === c.id ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
                <span className="w-36 text-slate-400">{fmtWhen(c.startedAt)}</span>
                <span className="flex-1 text-slate-200 font-semibold truncate">
                  {c.name || fmtPhone(c.direction === 'inbound' ? c.from : c.to)}
                </span>
                <span className="text-slate-500 w-20">{KIND_LABEL[c.kind]}</span>
                <span className="text-slate-400 w-28 truncate">{c.outcome || ''}</span>
                <Badge value={c.state} />
              </button>
              {open === c.id && (
                <div className="mt-2 ml-6">
                  <Transcript call={c} />
                </div>
              )}
            </div>
          ))}
          {!data.recent.length && <p className="text-sm text-slate-500">No calls yet.</p>}
        </div>
      </Card>
    </div>
  );
};
