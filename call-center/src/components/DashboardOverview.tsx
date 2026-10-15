import React from 'react';
import {
  Client,
  Lead,
  Conversation,
  Appointment,
  Reminder,
  Handoff,
  AgentAction,
} from '../types/dispatch';
import {
  Users,
  MessageSquare,
  CalendarCheck,
  BellRing,
  AlertOctagon,
  ArrowRight,
  Sparkles,
  Bot,
  UserCheck,
  CheckCircle2,
  PhoneForwarded,
  Smartphone,
} from 'lucide-react';
import { formatAppointmentDateTime } from '../lib/agentEngine';

interface DashboardOverviewProps {
  clients: Client[];
  selectedClientId: string | 'all';
  leads: Lead[];
  conversations: Conversation[];
  appointments: Appointment[];
  reminders: Reminder[];
  handoffs: Handoff[];
  agentActions: AgentAction[];
  onOpenPhoneSimulator: () => void;
  onNavigateTab: (tab: any) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  clients,
  selectedClientId,
  leads,
  conversations,
  appointments,
  reminders,
  handoffs,
  agentActions,
  onOpenPhoneSimulator,
  onNavigateTab,
}) => {
  // Filter by client if selected
  const filteredLeads = selectedClientId === 'all'
    ? leads
    : leads.filter(l => l.assignedClientId === selectedClientId);

  const filteredAppointments = selectedClientId === 'all'
    ? appointments
    : appointments.filter(a => a.clientId === selectedClientId);

  const filteredReminders = selectedClientId === 'all'
    ? reminders
    : reminders.filter(r => r.clientId === selectedClientId);

  const filteredHandoffs = selectedClientId === 'all'
    ? handoffs
    : handoffs.filter(h => h.clientId === selectedClientId);

  const activeConversations = selectedClientId === 'all'
    ? conversations.filter(c => c.status === 'ai_active' || c.status === 'human_takeover')
    : conversations.filter(c => c.clientId === selectedClientId && (c.status === 'ai_active' || c.status === 'human_takeover'));

  const openHandoffs = filteredHandoffs.filter(h => h.status === 'open');

  // Calculate booking conversion rate
  const totalLeadsCount = filteredLeads.length || 1;
  const bookedCount = filteredLeads.filter(l => l.status === 'booked').length;
  const conversionRate = Math.round((bookedCount / totalLeadsCount) * 100);

  // Revenue booked calculation
  const totalRevenueBooked = filteredAppointments.reduce((sum, appt) => {
    const client = clients.find(c => c.id === appt.clientId);
    const service = client?.services.find(s => s.id === appt.serviceId || s.name === appt.serviceName);
    return sum + (service?.price || 150);
  }, 0);

  return (
    <div className="space-y-6">
      {/* Hero Mission Control Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-cyan-950/70 border border-cyan-800/40 p-6 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-cyan-950/80 border border-cyan-700/60 text-cyan-300 text-xs font-semibold uppercase tracking-wider mb-3">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Autonomous Dispatch Engine Active
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight font-display">
              REAL-TIME HOST DISPATCH DASHBOARD
            </h2>
            <p className="text-slate-300 text-sm max-w-2xl mt-1">
              Every incoming SMS text and voice call reaches the dedicated tracking line, triggers the AI agent, checks availability, locks the appointment, and alerts both client & host with zero lag.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onOpenPhoneSimulator}
              className="flex items-center gap-2 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500 text-white font-bold text-xs uppercase px-4 py-3 rounded-xl shadow-lg shadow-rose-500/25 transition-all transform hover:scale-[1.02] border border-rose-400/30"
            >
              <Smartphone className="w-4 h-4" />
              <span>Simulate Lead Inbound SMS / Call</span>
            </button>
            <button
              onClick={() => onNavigateTab('inbox')}
              className="flex items-center gap-2 bg-slate-800/80 hover:bg-slate-700/80 text-cyan-300 border border-cyan-900/60 font-semibold text-xs px-4 py-3 rounded-xl transition-all"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Open Live Inbox</span>
            </button>
          </div>
        </div>

        {/* The Intake Pipeline Architecture Diagram */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">1. Intake</div>
            <div className="text-xs font-bold text-cyan-300 mt-1 flex items-center justify-center gap-1">
              <PhoneForwarded className="w-3.5 h-3.5 text-cyan-400" />
              Twilio / Telnyx
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Tracking Number</div>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">2. Webhook</div>
            <div className="text-xs font-bold text-indigo-300 mt-1 flex items-center justify-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              /api/webhooks/*
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">&lt;30ms HTTP intake</div>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">3. AI Agent</div>
            <div className="text-xs font-bold text-emerald-300 mt-1 flex items-center justify-center gap-1">
              <Bot className="w-3.5 h-3.5 text-emerald-400" />
              Local LLM (Ollama)
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Availability & Rules</div>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">4. Booking</div>
            <div className="text-xs font-bold text-cyan-300 mt-1 flex items-center justify-center gap-1">
              <CalendarCheck className="w-3.5 h-3.5 text-cyan-400" />
              Confirmed Slot
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Dual Notifications</div>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 col-span-2 md:col-span-1">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">5. Safety Guard</div>
            <div className="text-xs font-bold text-rose-300 mt-1 flex items-center justify-center gap-1">
              <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
              Human Handoff
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">TCPA & Anger filter</div>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Leads */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm hover:border-cyan-800/60 transition-all">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Leads</span>
            <Users className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-white font-display mt-2">
            {filteredLeads.length}
          </div>
          <div className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1 mt-1">
            <span>{conversionRate}% booked to date</span>
          </div>
        </div>

        {/* Card 2: Active Conversations */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm hover:border-cyan-800/60 transition-all">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Convos</span>
            <MessageSquare className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-white font-display mt-2">
            {activeConversations.length}
          </div>
          <div className="text-[11px] text-slate-400 font-medium mt-1">
            Autonomous AI triage
          </div>
        </div>

        {/* Card 3: Appointments */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm hover:border-cyan-800/60 transition-all">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Confirmed Appts</span>
            <CalendarCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400 font-display mt-2">
            {filteredAppointments.length}
          </div>
          <div className="text-[11px] text-slate-400 font-medium mt-1">
            ${totalRevenueBooked.toLocaleString()} pipeline value
          </div>
        </div>

        {/* Card 4: Reminders */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm hover:border-cyan-800/60 transition-all">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Reminders Queue</span>
            <BellRing className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-300 font-display mt-2">
            {filteredReminders.filter(r => r.status === 'scheduled').length}
          </div>
          <div className="text-[11px] text-slate-400 font-medium mt-1">
            24h & 2h pre-arrival SMS
          </div>
        </div>

        {/* Card 5: Escalations */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm hover:border-rose-900/60 transition-all">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Handoff Alerts</span>
            <AlertOctagon className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-400 font-display mt-2">
            {openHandoffs.length}
          </div>
          <div className="text-[11px] text-rose-300 font-medium mt-1">
            {openHandoffs.length > 0 ? 'Requires human reply' : 'All clear'}
          </div>
        </div>
      </div>

      {/* Main Grid: Live Intake Activity Stream vs Upcoming Bookings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Live Telemetry Event Stream */}
        <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
              <h3 className="text-base font-black text-white uppercase font-display tracking-wider">
                Live AI Dispatch Intake Stream
              </h3>
            </div>
            <span className="text-xs text-slate-400">
              Last {agentActions.length} recorded operations
            </span>
          </div>

          <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
            {agentActions.slice(0, 10).map((act) => {
              const client = clients.find(c => c.id === act.clientId);
              return (
                <div
                  key={act.id}
                  className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 hover:border-cyan-800/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                        act.actionType === 'appointment_booked'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : act.actionType === 'escalate_human'
                          ? 'bg-rose-950 text-rose-300 border border-rose-800'
                          : act.actionType === 'availability_check'
                          ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                          : 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                      }`}>
                        {act.actionType.replace('_', ' ')}
                      </span>
                      {client && (
                        <span className="text-xs font-semibold text-slate-300">
                          {client.name}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-mono text-slate-500 whitespace-nowrap">
                      {new Date(act.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  {act.rawInput && (
                    <div className="mt-2 text-xs text-slate-400 bg-slate-900/90 rounded px-2.5 py-1 font-mono border border-slate-800/60">
                      <span className="text-slate-500">Inbound:</span> "{act.rawInput}"
                    </div>
                  )}

                  <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                    {act.agentReasoning || JSON.stringify(act.details)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Confirmed Appointments & Provider Notice */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-black text-white uppercase font-display tracking-wider flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Confirmed Bookings
              </h3>
              <button
                onClick={() => onNavigateTab('appointments')}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1"
              >
                View all <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-3">
              {filteredAppointments.slice(0, 4).map(appt => {
                const lead = leads.find(l => l.id === appt.leadId);
                const client = clients.find(c => c.id === appt.clientId);
                return (
                  <div
                    key={appt.id}
                    className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">
                        {lead?.name || 'Customer'}
                      </span>
                      <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
                        {appt.durationMinutes} mins
                      </span>
                    </div>

                    <div className="text-xs font-semibold text-slate-300 mt-1">
                      {appt.serviceName}
                    </div>

                    <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 font-mono">
                      📅 {formatAppointmentDateTime(appt.startDateTime)}
                    </div>

                    <div className="mt-2 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500">
                      <span>{client?.name}</span>
                      <span className="text-emerald-400 font-medium">Provider Notified ✓</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Canonical Confirmation Flow callout */}
          <div className="mt-5 p-3 rounded-xl bg-cyan-950/40 border border-cyan-800/40 text-xs text-cyan-200">
            <div className="font-bold text-cyan-300 uppercase tracking-wide text-[10px] mb-1">
              Automated Provider Dispatch Notice:
            </div>
            <p className="font-mono text-[11px] text-slate-300 leading-snug">
              "New appointment confirmed: Tuesday, July 7, 6:00 PM, 60 minutes, lead ending in 4421."
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
