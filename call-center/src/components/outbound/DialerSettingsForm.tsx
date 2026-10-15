// Pacing, wait-after-call, retries and calling hours for a campaign.
import React from 'react';
import type { DialerSettings } from '../../types/outbound';
import { DAY_LABELS, hourLabel, TIMEZONES } from './api';
import { Field, Input, Select, Toggle } from './ui';

export const DialerSettingsForm: React.FC<{ value: DialerSettings; onChange: (v: DialerSettings) => void }> = ({ value: v, onChange }) => {
  const set = <K extends keyof DialerSettings>(k: K, val: DialerSettings[K]) => onChange({ ...v, [k]: val });
  const num = (k: keyof DialerSettings) => (e: React.ChangeEvent<HTMLInputElement>) => set(k, Number(e.target.value) as any);

  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Field label="Wait after a call ends" hint="Seconds before the next number is dialed. Gives you time to take notes.">
          <Input type="number" min={0} max={3600} value={v.delayAfterCallSeconds} onChange={num('delayAfterCallSeconds')} />
        </Field>
        <Field label="Calls at the same time" hint="1 is safest. More lines = faster, but needs more Twilio capacity.">
          <Input type="number" min={1} max={10} value={v.maxConcurrentCalls} onChange={num('maxConcurrentCalls')} />
        </Field>
        <Field label="Ring for (seconds)" hint="How long to let it ring before giving up.">
          <Input type="number" min={10} max={60} value={v.ringTimeoutSeconds} onChange={num('ringTimeoutSeconds')} />
        </Field>
        <Field label="Tries per contact" hint="Total attempts if nobody answers.">
          <Input type="number" min={1} max={10} value={v.maxAttempts} onChange={num('maxAttempts')} />
        </Field>
        <Field label="Retry after (minutes)" hint="Wait before trying a no-answer or busy number again.">
          <Input type="number" min={1} max={10080} value={v.retryDelayMinutes} onChange={num('retryDelayMinutes')} />
        </Field>
        <Field label="Time zone (if a contact has none)">
          <Select value={v.timezone} onChange={e => set('timezone', e.target.value)}>
            {[...new Set([v.timezone, ...TIMEZONES])].map(tz => (
              <option key={tz}>{tz}</option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Call between" hint="In each contact's local time. The law allows 8 AM to 9 PM only.">
          <div className="flex items-center gap-2">
            <Select value={v.callingHoursStart} onChange={e => set('callingHoursStart', Number(e.target.value))}>
              {Array.from({ length: 13 }, (_, i) => i + 8).map(h => (
                <option key={h} value={h}>
                  {hourLabel(h)}
                </option>
              ))}
            </Select>
            <span className="text-slate-500 text-xs">and</span>
            <Select value={v.callingHoursEnd} onChange={e => set('callingHoursEnd', Number(e.target.value))}>
              {Array.from({ length: 13 }, (_, i) => i + 9).map(h => (
                <option key={h} value={h}>
                  {hourLabel(h)}
                </option>
              ))}
            </Select>
          </div>
        </Field>
        <Field label="Days">
          <div className="flex flex-wrap gap-1.5">
            {DAY_LABELS.map((d, i) => {
              const on = v.callingDays.includes(i);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => set('callingDays', on ? v.callingDays.filter(x => x !== i) : [...v.callingDays, i].sort())}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border ${
                    on ? 'bg-cyan-600/30 border-cyan-500 text-cyan-200' : 'bg-slate-950 border-slate-700 text-slate-500'
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </Field>
      </div>

      <div className="space-y-2">
        <Toggle
          checked={v.unknownTimezoneMode === 'strict'}
          onChange={b => set('unknownTimezoneMode', b ? 'strict' : 'campaign')}
          label={
            <>
              <strong>Play it safe with unknown time zones.</strong> If a contact has no time zone, only call when it's inside your hours in every US
              mainland time zone (Eastern through Pacific).
            </>
          }
        />
        <Toggle
          checked={v.machineDetection}
          onChange={b => set('machineDetection', b)}
          label={
            <>
              <strong>Detect answering machines.</strong> Waits for the beep so voicemails can be left. Costs Twilio about $0.0075 extra per call.
            </>
          }
        />
        <Toggle
          checked={v.leaveVoicemail}
          onChange={b => set('leaveVoicemail', b)}
          label={<><strong>Leave a voicemail</strong> using the script's voicemail message.</>}
        />
      </div>
    </div>
  );
};
