import React from 'react';
import { Client } from '../types/dispatch';
import {
  Radio,
  PhoneCall,
  Calendar,
  MessageSquare,
  Clock,
  AlertTriangle,
  ShieldCheck,
  Smartphone,
  Volume2,
  VolumeX,
  RotateCcw,
  Rocket,
  Sparkles,
  PhoneOutgoing,
} from 'lucide-react';
import { audioVoice } from '../lib/audioVoice';

export type NavTab = 
  | 'overview' 
  | 'dialer'
  | 'inbox' 
  | 'appointments' 
  | 'calls' 
  | 'reminders' 
  | 'handoffs' 
  | 'numbers';

interface NavigationProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  clients: Client[];
  selectedClientId: string | 'all';
  onClientChange: (clientId: string | 'all') => void;
  onOpenPhoneSimulator: () => void;
  onOpenProductionModal: () => void;
  onResetData: () => void;
  unreadCount: number;
  openHandoffsCount: number;
  isMuted: boolean;
  onToggleMute: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentTab,
  onTabChange,
  clients,
  selectedClientId,
  onClientChange,
  onOpenPhoneSimulator,
  onOpenProductionModal,
  onResetData,
  unreadCount,
  openHandoffsCount,
  isMuted,
  onToggleMute,
}) => {
  const selectedClient = clients.find(c => c.id === selectedClientId);

  return (
    <header className="sticky top-0 z-40 bg-[#090D18]/95 backdrop-blur-md border-b border-cyan-900/40 text-slate-100">
      {/* Top Banner Row */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand & Status */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500 via-indigo-600 to-rose-500 p-0.5 shadow-lg shadow-cyan-500/20 flex items-center justify-center">
            <div className="w-full h-full bg-[#090D18] rounded-[10px] flex items-center justify-center">
              <Radio className="w-5 h-5 text-cyan-400 animate-pulse" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black tracking-wider text-white uppercase font-display">
                AGENTIC DISPATCH
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 uppercase tracking-widest">
                HOST SYSTEM
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Autonomous Intake • SMS & Voice • Live Booking • TCPA Guard
            </p>
          </div>
        </div>

        {/* Client Switcher Dropdown */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400 font-semibold hidden md:inline">Client Scope:</label>
          <div className="relative">
            <select
              value={selectedClientId}
              onChange={(e) => onClientChange(e.target.value)}
              className="bg-slate-900/90 border border-cyan-900/60 text-cyan-200 text-xs font-semibold rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-cyan-400 cursor-pointer shadow-inner pr-8"
            >
              <option value="all">⚡ All Clients & Virtual Numbers</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>
                  🏢 {c.name} ({c.trackingPhoneNumber})
                </option>
              ))}
            </select>
          </div>

          {selectedClient && (
            <span className="hidden xl:inline-flex items-center text-[11px] text-slate-400 bg-slate-900/60 px-2.5 py-1 rounded border border-slate-800">
              Assigned Host: <strong className="text-slate-200 ml-1">{selectedClient.hostName}</strong>
            </span>
          )}
        </div>

        {/* Global Controls & Simulator Launcher */}
        <div className="flex items-center gap-2">
          {/* Live Production / Go Live Mode Launcher */}
          <button
            onClick={() => {
              audioVoice.playConfirmedFanfare();
              onOpenProductionModal();
            }}
            className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs uppercase tracking-wide px-3.5 py-2 rounded-lg shadow-lg shadow-emerald-500/20 transition-all transform hover:scale-[1.02] active:scale-95 border border-emerald-400/50"
            title="Real-World Live Production Mode (No Simulator, Free Twilio & Local AI Setup)"
          >
            <Rocket className="w-4 h-4 text-emerald-200" />
            <span className="hidden md:inline">Go Live (Production)</span>
            <span className="md:hidden">Live</span>
          </button>

          {/* Virtual Phone Simulator button (Hero Action) */}
          <button
            onClick={() => {
              audioVoice.playSmsIncoming();
              onOpenPhoneSimulator();
            }}
            className="flex items-center gap-2 bg-gradient-to-r from-rose-500 via-pink-600 to-rose-600 hover:from-rose-400 hover:to-rose-500 text-white font-bold text-xs uppercase tracking-wide px-3.5 py-2 rounded-lg shadow-lg shadow-rose-500/25 transition-all transform hover:scale-[1.02] active:scale-95 border border-rose-400/40"
            title="Launch live lead handset simulator (SMS text and Voice call testing)"
          >
            <Smartphone className="w-4 h-4" />
            <span className="hidden sm:inline">Lead Phone Simulator</span>
            <span className="sm:hidden">Test Phone</span>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
            </span>
          </button>

          {/* Sound Mute */}
          <button
            onClick={onToggleMute}
            className={`p-2 rounded-lg border text-xs transition-colors ${
              isMuted
                ? 'bg-slate-900/80 border-slate-800 text-slate-500 hover:text-slate-300'
                : 'bg-cyan-950/40 border-cyan-800/60 text-cyan-300 hover:bg-cyan-900/50'
            }`}
            title={isMuted ? 'Unmute procedural sound and voice' : 'Mute sound effects'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Reset Demo Data */}
          <button
            onClick={() => {
              if (window.confirm('Reset all demo conversations, appointments, and leads to baseline seed data?')) {
                onResetData();
              }
            }}
            className="p-2 rounded-lg border border-slate-800 bg-slate-900/60 text-slate-400 hover:text-rose-400 hover:border-rose-900/50 transition-colors"
            title="Reset system database to fresh seed state"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-1 overflow-x-auto py-1 scrollbar-none border-t border-slate-800/50">
        <button
          onClick={() => onTabChange('overview')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-bold transition-all whitespace-nowrap ${
            currentTab === 'overview'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          Command Center
        </button>

        <button
          onClick={() => onTabChange('dialer')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-bold transition-all whitespace-nowrap ${
            currentTab === 'dialer'
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <PhoneOutgoing className="w-3.5 h-3.5 text-emerald-400" />
          Outbound Dialer
        </button>

        <button
          onClick={() => onTabChange('inbox')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-bold transition-all whitespace-nowrap relative ${
            currentTab === 'inbox'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Live SMS & Texts
          {unreadCount > 0 && (
            <span className="bg-rose-500 text-white font-mono text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-1">
              {unreadCount}
            </span>
          )}
        </button>

        <button
          onClick={() => onTabChange('appointments')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-bold transition-all whitespace-nowrap ${
            currentTab === 'appointments'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          Appointments & Calendar
        </button>

        <button
          onClick={() => onTabChange('calls')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-bold transition-all whitespace-nowrap ${
            currentTab === 'calls'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <PhoneCall className="w-3.5 h-3.5" />
          Voice Calls & Transcripts
        </button>

        <button
          onClick={() => onTabChange('reminders')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-bold transition-all whitespace-nowrap ${
            currentTab === 'reminders'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          Reminders Queue
        </button>

        <button
          onClick={() => onTabChange('handoffs')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-bold transition-all whitespace-nowrap ${
            currentTab === 'handoffs'
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
          Human Handoff Desk
          {openHandoffsCount > 0 && (
            <span className="bg-rose-500/80 text-white font-mono text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-1 animate-pulse">
              {openHandoffsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => onTabChange('numbers')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-bold transition-all whitespace-nowrap ${
            currentTab === 'numbers'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          Numbers & TCPA Compliance
        </button>
      </div>
    </header>
  );
};
