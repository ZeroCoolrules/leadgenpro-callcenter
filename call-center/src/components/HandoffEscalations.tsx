import React, { useState } from 'react';
import {
  Client,
  Lead,
  Handoff,
  Conversation,
} from '../types/dispatch';
import { DispatchStore } from '../lib/storage';
import { audioVoice } from '../lib/audioVoice';
import {
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  UserCheck,
  MessageSquare,
  Clock,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';

interface HandoffEscalationsProps {
  clients: Client[];
  leads: Lead[];
  handoffs: Handoff[];
  conversations: Conversation[];
  selectedClientId: string | 'all';
  onOpenConversation: (convId: string) => void;
}

export const HandoffEscalations: React.FC<HandoffEscalationsProps> = ({
  clients,
  leads,
  handoffs,
  conversations,
  selectedClientId,
  onOpenConversation,
}) => {
  const [resolutionNote, setResolutionNote] = useState('');
  const [selectedHandoffId, setSelectedHandoffId] = useState<string | null>(null);

  const filteredHandoffs = selectedClientId === 'all'
    ? handoffs
    : handoffs.filter(h => h.clientId === selectedClientId);

  const handleResolve = (handoffId: string) => {
    DispatchStore.resolveHandoff(handoffId, resolutionNote || 'Resolved by host operator');
    audioVoice.playSmsSent();
    setSelectedHandoffId(null);
    setResolutionNote('');
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 border border-rose-900/40 p-5 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-white uppercase font-display tracking-wider flex items-center gap-2">
              <AlertOctagon className="w-5 h-5 text-rose-500 animate-pulse" />
              Human Handoff & Escalation Desk
            </h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 uppercase">
              Operator Intervention
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            When a customer shows anger, confusion, complex emergency demands, or payment disputes, the AI automatically pauses and creates an urgent ticket.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-rose-300 bg-rose-950/60 border border-rose-800/60 px-3 py-1.5 rounded-xl font-bold">
            🚨 Open Tickets: {filteredHandoffs.filter(h => h.status === 'open').length}
          </span>
        </div>
      </div>

      {/* Tickets List */}
      <div className="space-y-4">
        {filteredHandoffs.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center text-slate-500 text-xs">
            No active escalations. The autonomous AI intake agent is running smoothly without human intervention needed.
          </div>
        ) : (
          filteredHandoffs.map((handoff) => {
            const lead = leads.find(l => l.id === handoff.leadId);
            const client = clients.find(c => c.id === handoff.clientId);
            const isOpen = handoff.status === 'open';

            return (
              <div
                key={handoff.id}
                className={`border rounded-2xl p-5 transition-all ${
                  isOpen
                    ? 'bg-rose-950/20 border-rose-900/60 shadow-lg shadow-rose-950/30'
                    : 'bg-slate-900/80 border-slate-800 opacity-75'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="space-y-2 max-w-3xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[10px] font-black px-2.5 py-0.5 rounded uppercase tracking-wider ${
                        handoff.urgency === 'critical'
                          ? 'bg-rose-600 text-white'
                          : 'bg-amber-600 text-slate-950'
                      }`}>
                        {handoff.urgency} Urgency
                      </span>

                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded bg-slate-800 text-slate-300 uppercase">
                        Reason: {handoff.reason.replace('_', ' ')}
                      </span>

                      <span className="text-xs font-bold text-slate-300">
                        {client?.name}
                      </span>
                    </div>

                    <div className="text-sm font-bold text-white flex items-center gap-2">
                      <span>Lead: {lead?.name || 'Customer'}</span>
                      <span className="text-slate-400 font-mono text-xs">({lead?.phone})</span>
                    </div>

                    {/* Triggering Customer Text */}
                    <div className="p-3 bg-slate-950/80 border border-rose-900/40 rounded-xl text-xs font-mono text-rose-200">
                      <span className="text-slate-500">Triggering Inbound Message: </span>
                      "{handoff.triggerMessage}"
                    </div>

                    <p className="text-xs text-slate-300">
                      {handoff.notes}
                    </p>
                  </div>

                  {/* Actions Column */}
                  <div className="flex flex-col gap-2 min-w-[200px] justify-center">
                    <button
                      onClick={() => onOpenConversation(handoff.conversationId)}
                      className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md shadow-indigo-600/20"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Take Over in Live Chat</span>
                    </button>

                    {isOpen ? (
                      <button
                        onClick={() => setSelectedHandoffId(handoff.id)}
                        className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Resolve & Resume AI</span>
                      </button>
                    ) : (
                      <span className="text-center text-xs text-emerald-400 font-semibold py-1">
                        Resolved ✓
                      </span>
                    )}
                  </div>
                </div>

                {/* Resolve Note Form */}
                {selectedHandoffId === handoff.id && (
                  <div className="mt-4 pt-4 border-t border-slate-800 flex gap-2">
                    <input
                      type="text"
                      placeholder="Add resolution note (e.g. Spoke on phone, scheduled custom technician)..."
                      value={resolutionNote}
                      onChange={(e) => setResolutionNote(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                    <button
                      onClick={() => handleResolve(handoff.id)}
                      className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs px-4 py-1.5 rounded-xl"
                    >
                      Confirm Resolution
                    </button>
                    <button
                      onClick={() => setSelectedHandoffId(null)}
                      className="bg-slate-800 text-slate-400 hover:text-white text-xs px-3 py-1.5 rounded-xl"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
