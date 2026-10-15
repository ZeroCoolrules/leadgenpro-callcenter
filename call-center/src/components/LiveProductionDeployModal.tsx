import React, { useState } from 'react';
import {
  Rocket,
  CheckCircle2,
  Copy,
  ExternalLink,
  ShieldCheck,
  Zap,
  Globe,
  Radio,
  Sparkles,
  Server,
  DollarSign,
  Heart,
  Calendar,
  MessageSquare,
  Users,
  Lock,
} from 'lucide-react';
import { Client } from '../types/dispatch';

interface LiveProductionDeployModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
}

export const LiveProductionDeployModal: React.FC<LiveProductionDeployModalProps> = ({
  isOpen,
  onClose,
  clients,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'stack' | 'services' | 'client_onboarding' | 'twilio_setup'>('stack');

  if (!isOpen) return null;

  const dreamClient = clients.find(c => c.id === 'client-dream-wellness') || clients[0];
  const publicAppUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const vercelBookingUrl = 'https://dream-therapy-massage.vercel.app/';

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-[#090D18] border border-cyan-500/40 rounded-3xl shadow-2xl shadow-cyan-950/50 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-slate-900 via-[#0B1224] to-slate-900 border-b border-cyan-900/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-600 p-0.5 shadow-lg shadow-cyan-500/25 flex items-center justify-center">
              <div className="w-full h-full bg-[#090D18] rounded-[14px] flex items-center justify-center text-cyan-400">
                <Rocket className="w-6 h-6 animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white uppercase tracking-wider font-display">
                  Live Production & Real-World Launch Guide
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold uppercase tracking-wider">
                  Zero Simulator Needed
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Connecting Dream Wellness Therapy (<a href={vercelBookingUrl} target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">{vercelBookingUrl}</a>) to real carrier phone numbers, live SMS, and real phone calls at zero or near-zero cost.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800/60 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-slate-800 bg-slate-950/60 flex gap-2">
          <button
            onClick={() => setActiveTab('stack')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'stack'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            1. Free & Lowest Cost Services
          </button>
          <button
            onClick={() => setActiveTab('twilio_setup')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'twilio_setup'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className="w-4 h-4" />
            2. Real Twilio Webhook Setup
          </button>
          <button
            onClick={() => setActiveTab('client_onboarding')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'client_onboarding'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Heart className="w-4 h-4 text-rose-400" />
            3. Dream Wellness Therapy Live Config
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm text-slate-300">
          {activeTab === 'stack' && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-cyan-950/30 border border-cyan-800/60 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-white">How This App Operates in 100% Live Mode</h4>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    This system is already a <strong>full-stack Express + Node backend server</strong> running on Port 3000. It exposes active real-world HTTP endpoints (<code className="text-cyan-300 font-mono">/api/webhooks/twilio/sms</code>, <code className="text-cyan-300 font-mono">/api/webhooks/twilio/voice</code>, and <code className="text-cyan-300 font-mono">/api/agent/chat</code>).
                    The simulator is merely an in-browser handset preview for testing—<strong>real phones from any carrier (AT&amp;T, Verizon, T-Mobile) send real SMS directly to the server</strong> once you connect a phone number!
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Twilio */}
                <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-base">Twilio</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      ~$1.15/mo + Free Trial
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    <strong>Free $15 credit</strong> on signup. Gives you a real local phone number (+1 305/786/etc.) for $1.15/month and inbound SMS for $0.0079/msg.
                  </p>
                  <ul className="text-xs text-slate-400 space-y-1">
                    <li>• Free tier: $15 promotional credit</li>
                    <li>• Dedicated SMS + Voice line</li>
                    <li>• Direct Webhook integration</li>
                  </ul>
                  <a
                    href="https://www.twilio.com/try-twilio"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-bold"
                  >
                    Get Free Twilio Account <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                {/* Local AI */}
                <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-base">Local AI (Ollama)</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      100% Free Tier
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Runs an open model like <strong>llama3.2</strong> on your own computer. No API key, no cloud account, no usage bill, no rate limits.
                  </p>
                  <ul className="text-xs text-slate-400 space-y-1">
                    <li>• $0: runs on your own hardware</li>
                    <li>• Auto-appointment slot detection</li>
                    <li>• Natural patient intake conversations</li>
                  </ul>
                  <a
                    href="https://ollama.com/download"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-bold"
                  >
                    Download Ollama <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                {/* Hosting */}
                <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-base">Self-Hosted + Tunnel</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Free Hobby Tier
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Run <code className="text-cyan-300">npm start</code> on your own computer and expose it with a free <code className="text-cyan-300">cloudflared</code> tunnel. No Google Cloud, no hosting bill.
                  </p>
                  <ul className="text-xs text-slate-400 space-y-1">
                    <li>• Free HTTPS URL for Twilio webhooks</li>
                    <li>• AI model stays on your machine</li>
                    <li>• Real-time SMS &amp; voice replies</li>
                  </ul>
                  <a
                    href="https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-bold"
                  >
                    Free Cloudflare Tunnel <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* Total Cost Summary */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-emerald-900/40 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold">
                    $
                  </div>
                  <div>
                    <strong className="text-white text-sm block">Total Estimated Monthly Cost for Production</strong>
                    <span className="text-xs text-slate-400">Everything except the carrier phone line is completely free.</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xl font-black text-emerald-400 font-mono">$1.15 / month</span>
                  <div className="text-[10px] text-slate-400">(Covered by Twilio's initial $15 free credit)</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'twilio_setup' && (
            <div className="space-y-6">
              <div className="space-y-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-cyan-400" />
                  Step-by-Step: Pointing Your Real Twilio Number to this App
                </h3>
                <p className="text-xs text-slate-400">
                  Follow these 3 quick steps in the Twilio Console to have real client SMS messages directly handled by the AI agent and booked into the calendar:
                </p>
              </div>

              <div className="space-y-4">
                {/* Step 1 */}
                <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-white font-bold text-xs">
                    <span className="h-5 w-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-mono text-[11px]">1</span>
                    Buy or Select a Real Phone Number
                  </div>
                  <p className="text-xs text-slate-400 pl-7">
                    Go to <strong>Twilio Console &gt; Phone Numbers &gt; Manage &gt; Active Numbers</strong>. Click <em>Buy a number</em>, search your area code (e.g. 305 for Miami / Florida or your local code), and purchase it using your free credit.
                  </p>
                </div>

                {/* Step 2 */}
                <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-white font-bold text-xs">
                    <span className="h-5 w-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-mono text-[11px]">2</span>
                    Set Inbound SMS Webhook URL
                  </div>
                  <p className="text-xs text-slate-400 pl-7">
                    Click on the number you purchased, scroll down to <strong>Messaging</strong>, and under <em>"A message comes in"</em>, select <strong>Webhook (HTTP POST)</strong> and paste this live endpoint:
                  </p>
                  <div className="pl-7 flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={`${publicAppUrl}/api/webhooks/twilio/sms`}
                      className="flex-1 bg-slate-950 border border-cyan-900/60 rounded-xl px-3 py-2 text-xs font-mono text-cyan-300 select-all"
                    />
                    <button
                      onClick={() => handleCopy(`${publicAppUrl}/api/webhooks/twilio/sms`, 'sms-webhook')}
                      className="px-3 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-xs font-bold flex items-center gap-1.5 transition-colors"
                    >
                      {copiedKey === 'sms-webhook' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      {copiedKey === 'sms-webhook' ? 'Copied' : 'Copy URL'}
                    </button>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-white font-bold text-xs">
                    <span className="h-5 w-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-mono text-[11px]">3</span>
                    Set Inbound Voice Webhook URL (For Real Voice Calls)
                  </div>
                  <p className="text-xs text-slate-400 pl-7">
                    Under the <strong>Voice &amp; Fax</strong> section, under <em>"A call comes in"</em>, select <strong>Webhook (HTTP POST)</strong> and paste:
                  </p>
                  <div className="pl-7 flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={`${publicAppUrl}/api/webhooks/twilio/voice`}
                      className="flex-1 bg-slate-950 border border-indigo-900/60 rounded-xl px-3 py-2 text-xs font-mono text-indigo-300 select-all"
                    />
                    <button
                      onClick={() => handleCopy(`${publicAppUrl}/api/webhooks/twilio/voice`, 'voice-webhook')}
                      className="px-3 py-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 text-xs font-bold flex items-center gap-1.5 transition-colors"
                    >
                      {copiedKey === 'voice-webhook' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      {copiedKey === 'voice-webhook' ? 'Copied' : 'Copy URL'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'client_onboarding' && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-950/40 via-purple-950/30 to-slate-900 border border-rose-800/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Heart className="w-5 h-5 text-rose-400" />
                    <h3 className="text-base font-black text-white">
                      Dream Wellness Therapy — Production Client Config
                    </h3>
                  </div>
                  <a
                    href={vercelBookingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-bold text-rose-300 hover:text-white bg-rose-900/50 px-2.5 py-1 rounded-lg border border-rose-700/50"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Visit dream-therapy-massage.vercel.app
                  </a>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Dream Wellness Therapy is configured as the <strong>primary client</strong> in this dispatch system. Any client who sends an SMS or calls will be greeted with the licensed massage treatment menu, pricing, duration, and deposit requirements.
                </p>
              </div>

              {/* Service Catalog in Dispatcher */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Active Massage Services Configured for Dispatch:
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {dreamClient?.services?.map((svc) => (
                    <div key={svc.id} className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <strong className="text-white text-xs">{svc.name}</strong>
                        <span className="font-mono font-bold text-emerald-400 text-xs">${svc.price}</span>
                      </div>
                      <p className="text-[11px] text-slate-400">{svc.description}</p>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-1 border-t border-slate-800/60">
                        <span>{svc.durationMinutes} mins</span>
                        <span>Deposit: ${svc.depositRequired}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Web Booking Link Embed snippet */}
              <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
                <div className="text-xs font-bold text-white flex items-center justify-between">
                  <span>Embed Dispatch Widget on dream-therapy-massage.vercel.app:</span>
                  <span className="text-[10px] text-slate-400 font-mono">HTML / React Snippet</span>
                </div>
                <p className="text-xs text-slate-400">
                  Add this button or link to your Vercel website so clients can click to text or call the automated booking line directly from their mobile phones:
                </p>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-xs text-cyan-300 overflow-x-auto select-all">
                  {`<a href="sms:+13055550720?&body=Hi%20Dream%20Wellness,%20I'd%20like%20to%20book%20a%20massage" class="btn-book">
  Book Massage via AI Dispatch (Instant SMS)
</a>`}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Ready for real carrier traffic</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-colors shadow-lg shadow-cyan-500/20"
          >
            Got It & Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};
