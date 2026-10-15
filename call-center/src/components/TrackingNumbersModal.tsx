import React, { useState } from 'react';
import {
  Client,
  PhoneNumber,
  ComplianceLog,
  Lead,
} from '../types/dispatch';
import {
  ShieldCheck,
  Phone,
  Copy,
  Check,
  ExternalLink,
  Lock,
  AlertTriangle,
  Radio,
  FileText,
  Server,
  Plus,
} from 'lucide-react';
import { TCPA_DISCLAIMER } from '../lib/compliance';

interface TrackingNumbersProps {
  clients: Client[];
  phoneNumbers: PhoneNumber[];
  complianceLogs: ComplianceLog[];
  leads: Lead[];
}

export const TrackingNumbersModal: React.FC<TrackingNumbersProps> = ({
  clients,
  phoneNumbers,
  complianceLogs,
  leads,
}) => {
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const currentHost = typeof window !== 'undefined' ? window.location.origin : 'https://api.yourdomain.com';
  const smsWebhookUrl = `${currentHost}/api/webhooks/twilio/sms`;
  const voiceWebhookUrl = `${currentHost}/api/webhooks/twilio/voice`;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUrl(label);
    setTimeout(() => setCopiedUrl(null), 2500);
  };

  const optedOutLeads = leads.filter(l => l.optedOut);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-5 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-white uppercase font-display tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-cyan-400" />
              Tracking Numbers & TCPA Compliance Center
            </h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 uppercase">
              A2P 10DLC Certified
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Dedicated phone numbers per client or forwarded calls, with full Twilio webhook integration and automated carrier opt-out controls.
          </p>
        </div>
      </div>

      {/* Webhook Endpoints Card */}
      <div className="bg-slate-900/90 border border-cyan-900/50 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Twilio / Telnyx Webhook Configuration
          </h3>
        </div>
        <p className="text-xs text-slate-300">
          Point your Twilio phone number's "A Call Comes In" and "A Message Comes In" webhooks to these endpoints:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* SMS Webhook */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300">
              <span>Inbound SMS Webhook (HTTP POST)</span>
              <span className="text-[10px] text-cyan-400 font-mono">TwiML &lt;Response&gt;</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={smsWebhookUrl}
                className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 font-mono text-[11px] text-cyan-200 focus:outline-none select-all"
              />
              <button
                onClick={() => copyToClipboard(smsWebhookUrl, 'sms')}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 p-2 rounded-lg text-xs"
                title="Copy SMS webhook URL"
              >
                {copiedUrl === 'sms' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Voice Webhook */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300">
              <span>Inbound Voice Webhook (HTTP POST)</span>
              <span className="text-[10px] text-indigo-400 font-mono">TwiML &lt;Gather&gt;</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={voiceWebhookUrl}
                className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 font-mono text-[11px] text-indigo-200 focus:outline-none select-all"
              />
              <button
                onClick={() => copyToClipboard(voiceWebhookUrl, 'voice')}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 p-2 rounded-lg text-xs"
                title="Copy Voice webhook URL"
              >
                {copiedUrl === 'voice' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* cURL Sample */}
        <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-400 space-y-1">
          <div className="text-slate-500 font-bold uppercase text-[10px]">Test with cURL from Terminal:</div>
          <div className="overflow-x-auto text-cyan-300 select-all py-1">
            curl -X POST "{smsWebhookUrl}" -d "From=+13057894421" -d "To=+13055550199" -d "Body=Hi I need to schedule an appointment next Tuesday at 6pm"
          </div>
        </div>
      </div>

      {/* Virtual Numbers Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Phone className="w-4 h-4 text-cyan-400" />
          Configured Tracking Lines ({phoneNumbers.length})
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="p-3">Phone Number</th>
                <th className="p-3">Assigned Business</th>
                <th className="p-3">Provider</th>
                <th className="p-3">Routing Mode</th>
                <th className="p-3">Capabilities</th>
                <th className="p-3">Total Inbound</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {phoneNumbers.map((pn) => {
                const client = clients.find(c => c.id === pn.assignedClientId);
                return (
                  <tr key={pn.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3 font-bold text-white">
                      {pn.number}
                    </td>
                    <td className="p-3 font-sans font-semibold text-cyan-300">
                      {client?.name || 'Unassigned'}
                    </td>
                    <td className="p-3 text-slate-400">
                      {pn.provider}
                    </td>
                    <td className="p-3 text-slate-400 font-sans">
                      {client?.forwardedFromNumber ? (
                        <span>Forwarded from {client.forwardedFromNumber}</span>
                      ) : (
                        <span>Direct Dedicated Line</span>
                      )}
                    </td>
                    <td className="p-3">
                      <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded uppercase">
                        {pn.capabilities.join(' & ')}
                      </span>
                    </td>
                    <td className="p-3 text-slate-400">
                      {pn.totalSms} SMS / {pn.totalCalls} Calls
                    </td>
                    <td className="p-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 uppercase">
                        {pn.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* TCPA Opt-out & Compliance Registry */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Lock className="w-4 h-4 text-rose-400" />
              TCPA STOP Opt-Out Registry
            </h3>
            <span className="text-xs font-mono text-rose-300 bg-rose-950 px-2 py-0.5 rounded border border-rose-800">
              {optedOutLeads.length} Opted Out
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Leads that texted STOP, CANCEL, or UNSUBSCRIBE. Outbound messaging is automatically barred by TCPA policy.
          </p>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {optedOutLeads.length === 0 ? (
              <div className="p-4 text-center text-slate-500 text-xs">
                No opted-out numbers.
              </div>
            ) : (
              optedOutLeads.map(l => (
                <div key={l.id} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-white">{l.name}</span>
                    <span className="font-mono text-slate-400 ml-2">{l.phone}</span>
                  </div>
                  <span className="text-[10px] font-mono text-rose-400 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800/60">
                    STOP Enforced
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Carrier Disclaimers & Rules */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-3 text-xs">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4 text-cyan-400" />
            Carrier Mandatory Disclaimers
          </h3>
          <p className="text-slate-400">
            Every booking confirmation and automated reminder includes the mandatory carrier notice:
          </p>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 font-mono text-[11px] leading-relaxed">
            "{TCPA_DISCLAIMER}"
          </div>

          <div className="space-y-1.5 pt-2 text-slate-400 text-[11px]">
            <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
              ✓ Automated STOP handling enabled (Zero delay)
            </div>
            <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
              ✓ Automated START / RESUBSCRIBE handling enabled
            </div>
            <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
              ✓ Sensitive fraud & predatory language filtering active
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
