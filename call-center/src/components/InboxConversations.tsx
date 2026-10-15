import React, { useState } from 'react';
import {
  Client,
  Lead,
  Conversation,
  Message,
  Appointment,
} from '../types/dispatch';
import { DispatchStore } from '../lib/storage';
import { audioVoice } from '../lib/audioVoice';
import {
  Send,
  Bot,
  User,
  ShieldAlert,
  UserCheck,
  CheckCircle2,
  Calendar,
  Phone,
  Search,
  Sparkles,
  Lock,
} from 'lucide-react';
import { formatAppointmentDateTime } from '../lib/agentEngine';

interface InboxConversationsProps {
  clients: Client[];
  leads: Lead[];
  conversations: Conversation[];
  messages: Message[];
  appointments: Appointment[];
  selectedClientId: string | 'all';
}

export const InboxConversations: React.FC<InboxConversationsProps> = ({
  clients,
  leads,
  conversations,
  messages,
  appointments,
  selectedClientId,
}) => {
  const [activeConvId, setActiveConvId] = useState<string>(conversations[0]?.id || '');
  const [replyInput, setReplyInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ai_active' | 'human_takeover'>('all');

  // Filter conversations
  const filteredConvs = conversations.filter(c => {
    if (selectedClientId !== 'all' && c.clientId !== selectedClientId) return false;
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const lead = leads.find(l => l.id === c.leadId);
      const query = searchQuery.toLowerCase();
      const matchesLead = lead && (lead.name.toLowerCase().includes(query) || lead.phone.includes(query));
      const matchesSnippet = c.lastMessageSnippet.toLowerCase().includes(query);
      return matchesLead || matchesSnippet;
    }
    return true;
  });

  const activeConversation = conversations.find(c => c.id === activeConvId) || filteredConvs[0];
  const activeLead = activeConversation ? leads.find(l => l.id === activeConversation.leadId) : undefined;
  const activeClient = activeConversation ? clients.find(c => c.id === activeConversation.clientId) : undefined;
  const activeMessages = activeConversation
    ? messages.filter(m => m.conversationId === activeConversation.id)
    : [];

  const leadAppointments = activeLead
    ? appointments.filter(a => a.leadId === activeLead.id)
    : [];

  // Toggle Human Takeover
  const handleToggleTakeover = () => {
    if (!activeConversation) return;
    const newStatus = activeConversation.status === 'ai_active' ? 'human_takeover' : 'ai_active';
    DispatchStore.updateConversation(activeConversation.id, { status: newStatus });
    audioVoice.playSmsSent();
  };

  // Send manual host operator message
  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyInput.trim() || !activeConversation || !activeLead || !activeClient) return;

    const newMsg: Message = {
      id: `msg-${Date.now()}-human`,
      conversationId: activeConversation.id,
      leadId: activeLead.id,
      clientId: activeClient.id,
      direction: 'outbound',
      sender: 'human_host',
      content: replyInput.trim(),
      timestamp: new Date().toISOString(),
      status: 'delivered',
      complianceStatus: 'compliant',
    };

    DispatchStore.addMessage(newMsg);
    audioVoice.playSmsSent();
    setReplyInput('');
  };

  return (
    <div className="h-[calc(100vh-180px)] min-h-[580px] bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col md:flex-row">
      {/* Left Pane: Conversation List */}
      <div className="w-full md:w-80 lg:w-96 border-r border-slate-800 flex flex-col bg-slate-950/60">
        {/* Search & Filter Header */}
        <div className="p-3.5 border-b border-slate-800 space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search leads, phone, texts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex gap-1 text-[11px]">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded font-semibold ${
                statusFilter === 'all'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:bg-slate-900'
              }`}
            >
              All ({conversations.length})
            </button>
            <button
              onClick={() => setStatusFilter('ai_active')}
              className={`px-2.5 py-1 rounded font-semibold ${
                statusFilter === 'ai_active'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:bg-slate-900'
              }`}
            >
              🤖 AI Active
            </button>
            <button
              onClick={() => setStatusFilter('human_takeover')}
              className={`px-2.5 py-1 rounded font-semibold ${
                statusFilter === 'human_takeover'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'text-slate-400 hover:bg-slate-900'
              }`}
            >
              👤 Human Takeover
            </button>
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
          {filteredConvs.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No conversations found.
            </div>
          ) : (
            filteredConvs.map((conv) => {
              const lead = leads.find(l => l.id === conv.leadId);
              const client = clients.find(c => c.id === conv.clientId);
              const isSelected = activeConversation?.id === conv.id;

              return (
                <button
                  key={conv.id}
                  onClick={() => {
                    setActiveConvId(conv.id);
                    if (conv.unreadCount > 0) {
                      DispatchStore.updateConversation(conv.id, { unreadCount: 0 });
                    }
                  }}
                  className={`w-full text-left p-3.5 transition-colors flex items-start gap-3 ${
                    isSelected
                      ? 'bg-cyan-950/40 border-l-4 border-cyan-400'
                      : 'hover:bg-slate-900/60'
                  }`}
                >
                  <div className="h-10 w-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0 text-slate-300 font-bold text-xs">
                    {lead?.name.charAt(0) || 'L'}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white truncate">
                        {lead?.name || 'Unknown Lead'}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(conv.lastActivityAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 truncate mt-0.5">
                      {lead?.phone} • <span className="text-cyan-400">{client?.name.split(' ')[0]}</span>
                    </div>

                    <p className="text-xs text-slate-300 truncate mt-1">
                      {conv.lastMessageSnippet}
                    </p>

                    <div className="flex items-center gap-1.5 mt-2">
                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                        conv.status === 'ai_active'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                          : 'bg-rose-950 text-rose-300 border border-rose-800/60'
                      }`}>
                        {conv.status === 'ai_active' ? '🤖 AI Handled' : '👤 Operator Lead'}
                      </span>

                      {conv.sentiment === 'frustrated' && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-800/60">
                          Frustrated
                        </span>
                      )}

                      {lead?.optedOut && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-red-950 text-red-300 border border-red-800/60">
                          STOP / Opted Out
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Center & Right: Active Thread + Context Sidebar */}
      {activeConversation && activeLead && activeClient ? (
        <div className="flex-1 flex flex-col lg:flex-row min-w-0 bg-slate-900/60">
          {/* Messages Column */}
          <div className="flex-1 flex flex-col min-w-0 border-r border-slate-800/80">
            {/* Thread Header */}
            <div className="p-3.5 border-b border-slate-800 flex items-center justify-between gap-3 bg-slate-950/40">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-300 font-bold text-xs">
                  {activeLead.name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">
                      {activeLead.name}
                    </span>
                    <span className="text-[11px] font-mono text-cyan-400">
                      {activeLead.phone}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Via Tracking Number: <strong className="text-slate-300">{activeClient.trackingPhoneNumber}</strong> ({activeClient.name})
                  </div>
                </div>
              </div>

              {/* Take Over AI Toggle */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleToggleTakeover}
                  className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${
                    activeConversation.status === 'ai_active'
                      ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300 hover:bg-emerald-900/60'
                      : 'bg-rose-950/60 border-rose-700/60 text-rose-300 hover:bg-rose-900/60'
                  }`}
                  title="Switch between automated AI responses and manual human operator control"
                >
                  {activeConversation.status === 'ai_active' ? (
                    <>
                      <Bot className="w-3.5 h-3.5 text-emerald-400" />
                      <span>AI Active (Click to Pause)</span>
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-3.5 h-3.5 text-rose-400" />
                      <span>Human Takeover (Click for AI)</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Message Bubble Feed */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3">
              {activeMessages.map((msg) => {
                const isLead = msg.direction === 'inbound';
                const isAi = msg.sender === 'ai_agent';
                const isSystem = msg.sender === 'system';

                if (isSystem) {
                  return (
                    <div key={msg.id} className="text-center my-2">
                      <span className="inline-block text-[11px] font-mono text-amber-300 bg-amber-950/60 border border-amber-800/60 px-3 py-1 rounded-full">
                        {msg.content}
                      </span>
                    </div>
                  );
                }

                return (
                  <div
                    key={msg.id}
                    className={`flex ${isLead ? 'justify-start' : 'justify-end'}`}
                  >
                    <div className={`max-w-[80%] rounded-2xl p-3 text-xs leading-relaxed ${
                      isLead
                        ? 'bg-slate-800/90 text-slate-100 rounded-tl-sm border border-slate-700/60'
                        : isAi
                        ? 'bg-gradient-to-br from-cyan-950 via-slate-900 to-indigo-950 text-cyan-100 rounded-tr-sm border border-cyan-800/50 shadow-md'
                        : 'bg-indigo-600 text-white rounded-tr-sm shadow-md'
                    }`}>
                      <div className="flex items-center justify-between gap-3 text-[10px] text-slate-400 mb-1 border-b border-white/10 pb-1">
                        <span className="font-bold flex items-center gap-1">
                          {isLead ? (
                            <>
                              <User className="w-3 h-3 text-slate-400" />
                              {activeLead.name}
                            </>
                          ) : isAi ? (
                            <>
                              <Bot className="w-3 h-3 text-cyan-400" />
                              <span className="text-cyan-300">AI Intake Agent</span>
                            </>
                          ) : (
                            <>
                              <UserCheck className="w-3 h-3 text-white" />
                              <span>Host Operator ({activeClient.hostName})</span>
                            </>
                          )}
                        </span>
                        <span className="font-mono text-slate-500">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <p className="whitespace-pre-wrap">{msg.content}</p>

                      {msg.complianceStatus === 'opt_out_processed' && (
                        <div className="mt-1 text-[10px] text-red-400 font-mono">
                          • TCPA Opt-out confirmed
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Manual Composer */}
            <form onSubmit={handleSendReply} className="p-3 border-t border-slate-800 bg-slate-950/60 flex gap-2">
              <input
                type="text"
                placeholder={
                  activeLead.optedOut
                    ? 'Lead has opted out (STOP). Outbound SMS blocked by TCPA.'
                    : activeConversation.status === 'ai_active'
                    ? 'AI is handling this lead. Type here to reply manually as Host...'
                    : 'Type SMS reply to lead as human operator...'
                }
                disabled={activeLead.optedOut}
                value={replyInput}
                onChange={(e) => setReplyInput(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={activeLead.optedOut || !replyInput.trim()}
                className="bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send SMS</span>
              </button>
            </form>
          </div>

          {/* Right Lead Context Sidebar */}
          <div className="w-full lg:w-72 bg-slate-950/80 p-4 space-y-4 border-t lg:border-t-0 lg:border-l border-slate-800 overflow-y-auto">
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Lead Intelligence
              </div>
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2 text-xs">
                <div>
                  <span className="text-slate-400">Status: </span>
                  <span className={`font-bold capitalize ${
                    activeLead.status === 'booked' ? 'text-emerald-400' : 'text-cyan-400'
                  }`}>
                    {activeLead.status}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Phone: </span>
                  <span className="font-mono text-white">{activeLead.phone}</span>
                </div>
                {activeLead.email && (
                  <div>
                    <span className="text-slate-400">Email: </span>
                    <span className="text-slate-200">{activeLead.email}</span>
                  </div>
                )}
                <div>
                  <span className="text-slate-400">Source: </span>
                  <span className="font-mono text-slate-300">{activeLead.source}</span>
                </div>
                <div className="pt-2 border-t border-slate-800">
                  <div className="text-slate-400 text-[10px] uppercase font-bold mb-1">Tags</div>
                  <div className="flex flex-wrap gap-1">
                    {activeLead.tags.map(t => (
                      <span key={t} className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Confirmed Appointments for this Lead */}
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Appointments
              </div>
              {leadAppointments.length === 0 ? (
                <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 text-xs text-slate-500 text-center">
                  No appointment booked yet. Lead currently qualifying.
                </div>
              ) : (
                <div className="space-y-2">
                  {leadAppointments.map(a => (
                    <div key={a.id} className="bg-emerald-950/30 border border-emerald-800/50 rounded-xl p-3 text-xs">
                      <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {a.serviceName}
                      </div>
                      <div className="text-[11px] text-slate-300 mt-1 font-mono">
                        {formatAppointmentDateTime(a.startDateTime)}
                      </div>
                      <div className="text-[10px] text-emerald-400 mt-1 font-semibold">
                        Status: Confirmed ({a.durationMinutes} mins)
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Client Service Menu Reference */}
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Service Catalog & Pricing
              </div>
              <div className="space-y-1.5">
                {activeClient.services.map(s => (
                  <div key={s.id} className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs flex justify-between items-center">
                    <div>
                      <div className="font-semibold text-slate-200">{s.name}</div>
                      <div className="text-[10px] text-slate-500">{s.durationMinutes} mins</div>
                    </div>
                    <span className="font-mono font-bold text-cyan-400">${s.price}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center p-8 text-slate-500 text-xs">
          Select a conversation from the left to view the thread.
        </div>
      )}
    </div>
  );
};
