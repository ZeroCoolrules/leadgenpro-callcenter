// "Outbound Dialer" tab: campaigns, live calls, reminders, scripts, settings.
import React, { useEffect, useState } from 'react';
import { PhoneOutgoing, Radio, Bell, FileText, Settings, CheckCircle2, Circle, ChevronDown, ChevronRight } from 'lucide-react';
import type { AppSettings, CallScript, SetupStatus } from '../../types/outbound';
import { api } from './api';
import { Card, Notice } from './ui';
import { CampaignsPanel } from './CampaignsPanel';
import { LiveCallsPanel } from './LiveCallsPanel';
import { RemindersPanel } from './RemindersPanel';
import { ScriptsPanel } from './ScriptsPanel';
import { SettingsPanel } from './SettingsPanel';

type Section = 'live' | 'campaigns' | 'reminders' | 'scripts' | 'settings';

const SECTIONS: [Section, string, React.ElementType][] = [
  ['live', 'Live Calls', Radio],
  ['campaigns', 'Campaigns & Lists', PhoneOutgoing],
  ['reminders', 'Appointment Reminders', Bell],
  ['scripts', 'Scripts', FileText],
  ['settings', 'Settings', Settings],
];

export const OutboundDialer: React.FC = () => {
  const googleJustConnected = new URLSearchParams(window.location.search).get('google') === 'connected';
  const [section, setSection] = useState<Section>(googleJustConnected ? 'settings' : 'campaigns');
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [scripts, setScripts] = useState<CallScript[]>([]);
  const [error, setError] = useState('');
  const [showSetup, setShowSetup] = useState(false);

  const loadStatus = () => api.status().then(setStatus).catch(err => setError(err.message));
  const loadScripts = () => api.scripts().then(setScripts).catch(() => {});
  const loadAll = async () => {
    await loadStatus();
    try {
      setSettings(await api.settings());
      await loadScripts();
      setError('');
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    loadAll();
    if (googleJustConnected) window.history.replaceState(null, '', window.location.pathname);
  }, []);

  const checklist: [boolean, React.ReactNode][] = status
    ? [
        [status.adminPasswordSet, <>Dashboard password set (<code>ADMIN_PASSWORD</code>)</>],
        [status.twilioConfigured, <>Twilio connected (<code>TWILIO_ACCOUNT_SID</code>, <code>TWILIO_AUTH_TOKEN</code>, <code>TWILIO_FROM_NUMBER</code>)</>],
        [!!status.publicUrl, <>Public web address known{status.publicUrl ? `: ${status.publicUrl}` : ' (set PUBLIC_BASE_URL)'}</>],
        [status.persistentStorage, <>Data saved on a disk that survives restarts{status.persistentStorage ? '' : ' (add a Render disk, see README)'}</>],
        [status.llmConfigured, <>AI model key set (<code>LLM_API_KEY</code>)</>],
        [status.agentPhoneSet, <>Your phone number added (Settings) for takeovers</>],
        [status.signatureCheck, <>Twilio webhook signatures checked (automatic once the Auth Token is set)</>],
        [status.googleConnected, <>Google Calendar connected for Meet links (optional)</>],
      ]
    : [];
  const done = checklist.filter(c => c[0]).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-5 rounded-2xl">
        <div>
          <h2 className="text-xl font-black text-white uppercase font-display tracking-wider flex items-center gap-2">
            <PhoneOutgoing className="w-5 h-5 text-cyan-400" />
            Outbound Auto Dialer
          </h2>
          <p className="text-xs text-slate-400 mt-1">Upload a list, let the AI call with your script, take over any call, and send appointment reminders.</p>
        </div>
        {status && (
          <button onClick={() => setShowSetup(!showSetup)} className="flex items-center gap-1.5 text-xs font-bold text-slate-300 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2">
            {showSetup ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            Setup {done}/{checklist.length}
          </button>
        )}
      </div>

      {status?.dialerLocked && (
        <Notice kind="error">
          <strong>The dialer is locked until you set a password.</strong> In Render, open your service → Environment → add <code>ADMIN_PASSWORD</code> with a
          password of your choice → Save. After it restarts, your browser will ask for it (username <code>admin</code>). This stops strangers from
          making calls on your Twilio account.
        </Notice>
      )}
      {status && !status.persistentStorage && (
        <Notice kind="warn">
          Your lists, scripts and appointments are saved in a temporary folder that Render wipes on every deploy or restart. Add a Render disk (README
          step 3) before loading real contacts.
        </Notice>
      )}
      {error && !status?.dialerLocked && <Notice kind="error">{error}</Notice>}
      {googleJustConnected && <Notice kind="success">Google Calendar connected. Video appointments now get their own Google Meet link.</Notice>}

      {showSetup && (
        <Card title="Setup checklist">
          <div className="space-y-2">
            {checklist.map(([ok, label], i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                {ok ? <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5" /> : <Circle className="w-4 h-4 text-slate-600 mt-0.5" />}
                <span className={ok ? 'text-slate-300' : 'text-slate-400'}>{label}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-3">The README in the GitHub repo has step-by-step instructions for each item.</p>
        </Card>
      )}

      {!status?.dialerLocked && settings && (
        <>
          <div className="flex gap-1 overflow-x-auto">
            {SECTIONS.map(([key, label, Icon]) => (
              <button
                key={key}
                onClick={() => setSection(key)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-bold whitespace-nowrap ${
                  section === key ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>

          {section === 'live' && <LiveCallsPanel agentPhoneSet={!!settings.agentPhone} />}
          {section === 'campaigns' && <CampaignsPanel scripts={scripts} defaults={settings.defaultDialer} refreshKey={0} leadgenproConfigured={!!status?.leadgenproConfigured} />}
          {section === 'reminders' && <RemindersPanel settings={settings} googleConnected={!!status?.googleConnected} />}
          {section === 'scripts' && <ScriptsPanel scripts={scripts} reload={loadScripts} />}
          {section === 'settings' && <SettingsPanel settings={settings} scripts={scripts} status={status} onSaved={setSettings} refreshStatus={loadStatus} />}
        </>
      )}
    </div>
  );
};
