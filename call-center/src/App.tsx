import React, { useState, useEffect } from 'react';
import {
  Client,
  PhoneNumber,
  Lead,
  Conversation,
  Message,
  Call,
  Appointment,
  Reminder,
  Handoff,
  ComplianceLog,
  AgentAction,
} from './types/dispatch';
import { DispatchStore } from './lib/storage';
import { audioVoice } from './lib/audioVoice';
import { Navigation, NavTab } from './components/Navigation';
import { DashboardOverview } from './components/DashboardOverview';
import { InboxConversations } from './components/InboxConversations';
import { AppointmentsCalendar } from './components/AppointmentsCalendar';
import { VoiceCallsCenter } from './components/VoiceCallsCenter';
import { RemindersQueue } from './components/RemindersQueue';
import { HandoffEscalations } from './components/HandoffEscalations';
import { TrackingNumbersModal } from './components/TrackingNumbersModal';
import { PhoneSimulatorModal } from './components/PhoneSimulatorModal';
import { LiveProductionDeployModal } from './components/LiveProductionDeployModal';
import { OutboundDialer } from './components/outbound/OutboundDialer';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>(() =>
    new URLSearchParams(window.location.search).has('google') ? 'dialer' : 'overview',
  );
  const [selectedClientId, setSelectedClientId] = useState<string | 'all'>('all');
  const [showPhoneSimulator, setShowPhoneSimulator] = useState(false);
  const [showProductionModal, setShowProductionModal] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Store data states initialized synchronously from DispatchStore
  const [clients, setClients] = useState<Client[]>(() => DispatchStore.getClients());
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>(() => DispatchStore.getPhoneNumbers());
  const [leads, setLeads] = useState<Lead[]>(() => DispatchStore.getLeads());
  const [conversations, setConversations] = useState<Conversation[]>(() => DispatchStore.getConversations());
  const [messages, setMessages] = useState<Message[]>(() => DispatchStore.getMessages());
  const [calls, setCalls] = useState<Call[]>(() => DispatchStore.getCalls());
  const [appointments, setAppointments] = useState<Appointment[]>(() => DispatchStore.getAppointments());
  const [reminders, setReminders] = useState<Reminder[]>(() => DispatchStore.getReminders());
  const [handoffs, setHandoffs] = useState<Handoff[]>(() => DispatchStore.getHandoffs());
  const [complianceLogs, setComplianceLogs] = useState<ComplianceLog[]>(() => DispatchStore.getComplianceLogs());
  const [agentActions, setAgentActions] = useState<AgentAction[]>(() => DispatchStore.getAgentActions());

  // Refresh all state from DispatchStore
  const refreshState = () => {
    setClients(DispatchStore.getClients());
    setPhoneNumbers(DispatchStore.getPhoneNumbers());
    setLeads(DispatchStore.getLeads());
    setConversations(DispatchStore.getConversations());
    setMessages(DispatchStore.getMessages());
    setCalls(DispatchStore.getCalls());
    setAppointments(DispatchStore.getAppointments());
    setReminders(DispatchStore.getReminders());
    setHandoffs(DispatchStore.getHandoffs());
    setComplianceLogs(DispatchStore.getComplianceLogs());
    setAgentActions(DispatchStore.getAgentActions());
  };

  useEffect(() => {
    refreshState();

    const handleStateChange = () => {
      refreshState();
    };

    window.addEventListener('dispatch_state_change', handleStateChange);
    return () => {
      window.removeEventListener('dispatch_state_change', handleStateChange);
    };
  }, []);

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    audioVoice.setMuted(next);
  };

  const handleResetData = () => {
    DispatchStore.resetToDefaults();
    refreshState();
  };

  // Counts
  const totalUnread = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
  const openHandoffsCount = handoffs.filter(h => h.status === 'open').length;

  return (
    <div className="min-h-screen bg-[#070A11] text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* Top Navigation */}
      <Navigation
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        clients={clients}
        selectedClientId={selectedClientId}
        onClientChange={setSelectedClientId}
        onOpenPhoneSimulator={() => setShowPhoneSimulator(true)}
        onOpenProductionModal={() => setShowProductionModal(true)}
        onResetData={handleResetData}
        unreadCount={totalUnread}
        openHandoffsCount={openHandoffsCount}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
      />

      {/* Main Content View Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {currentTab === 'overview' && (
          <DashboardOverview
            clients={clients}
            selectedClientId={selectedClientId}
            leads={leads}
            conversations={conversations}
            appointments={appointments}
            reminders={reminders}
            handoffs={handoffs}
            agentActions={agentActions}
            onOpenPhoneSimulator={() => setShowPhoneSimulator(true)}
            onNavigateTab={setCurrentTab}
          />
        )}

        {currentTab === 'dialer' && <OutboundDialer />}

        {currentTab === 'inbox' && (
          <InboxConversations
            clients={clients}
            leads={leads}
            conversations={conversations}
            messages={messages}
            appointments={appointments}
            selectedClientId={selectedClientId}
          />
        )}

        {currentTab === 'appointments' && (
          <AppointmentsCalendar
            clients={clients}
            leads={leads}
            appointments={appointments}
            reminders={reminders}
            selectedClientId={selectedClientId}
          />
        )}

        {currentTab === 'calls' && (
          <VoiceCallsCenter
            clients={clients}
            leads={leads}
            calls={calls}
            selectedClientId={selectedClientId}
            onOpenPhoneSimulator={() => setShowPhoneSimulator(true)}
          />
        )}

        {currentTab === 'reminders' && (
          <RemindersQueue
            clients={clients}
            leads={leads}
            appointments={appointments}
            reminders={reminders}
            selectedClientId={selectedClientId}
          />
        )}

        {currentTab === 'handoffs' && (
          <HandoffEscalations
            clients={clients}
            leads={leads}
            handoffs={handoffs}
            conversations={conversations}
            selectedClientId={selectedClientId}
            onOpenConversation={(convId) => {
              setCurrentTab('inbox');
            }}
          />
        )}

        {currentTab === 'numbers' && (
          <TrackingNumbersModal
            clients={clients}
            phoneNumbers={phoneNumbers}
            complianceLogs={complianceLogs}
            leads={leads}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 px-4 sm:px-8 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="font-bold text-slate-400">Agentic Dispatch Host System</span>
            <span>• Port 3000 Active</span>
          </div>
          <div>
            Twilio Webhooks & Live Phone Simulator • Powered by a free local LLM (Ollama) & Procedural Audio
          </div>
        </div>
      </footer>

      {/* Interactive Phone Simulator Modal (Handset Testing Drawer) */}
      {showPhoneSimulator && (
        <PhoneSimulatorModal
          isOpen={showPhoneSimulator}
          onClose={() => setShowPhoneSimulator(false)}
          clients={clients}
          leads={leads}
          conversations={conversations}
          messages={messages}
          appointments={appointments}
        />
      )}

      {/* Real-World Live Production Rollout Modal */}
      {showProductionModal && (
        <LiveProductionDeployModal
          isOpen={showProductionModal}
          onClose={() => setShowProductionModal(false)}
          clients={clients}
        />
      )}
    </div>
  );
}
