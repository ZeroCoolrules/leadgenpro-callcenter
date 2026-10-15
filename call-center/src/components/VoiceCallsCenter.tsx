import React, { useState } from 'react';
import {
  Client,
  Lead,
  Call,
} from '../types/dispatch';
import { audioVoice } from '../lib/audioVoice';
import {
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  Play,
  Square,
  Sparkles,
  Bot,
  User,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Smartphone,
} from 'lucide-react';

interface VoiceCallsCenterProps {
  clients: Client[];
  leads: Lead[];
  calls: Call[];
  selectedClientId: string | 'all';
  onOpenPhoneSimulator: () => void;
}

export const VoiceCallsCenter: React.FC<VoiceCallsCenterProps> = ({
  clients,
  leads,
  calls,
  selectedClientId,
  onOpenPhoneSimulator,
}) => {
  const [selectedCallId, setSelectedCallId] = useState<string>(calls[0]?.id || '');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const filteredCalls = selectedClientId === 'all'
    ? calls
    : calls.filter(c => c.clientId === selectedClientId);

  const activeCall = calls.find(c => c.id === selectedCallId) || filteredCalls[0];
  const activeClient = activeCall ? clients.find(c => c.id === activeCall.clientId) : undefined;
  const activeLead = activeCall ? leads.find(l => l.id === activeCall.leadId) : undefined;

  // Play audio speech of transcript turns
  const handlePlayTranscriptAudio = () => {
    if (!activeCall) return;
    if (isPlayingAudio) {
      audioVoice.stopSpeaking();
      setIsPlayingAudio(false);
      return;
    }

    setIsPlayingAudio(true);
    let currentTurnIndex = 0;

    const playNextTurn = () => {
      if (currentTurnIndex >= activeCall.transcript.length) {
        setIsPlayingAudio(false);
        return;
      }

      const turn = activeCall.transcript[currentTurnIndex];
      currentTurnIndex++;
      audioVoice.speak(turn.text, () => {
        setTimeout(playNextTurn, 600);
      });
    };

    playNextTurn();
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-5 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-white uppercase font-display tracking-wider flex items-center gap-2">
              <PhoneCall className="w-5 h-5 text-indigo-400" />
              Twilio Programmable Voice & AI Receptionist
            </h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 uppercase">
              Webhooks & TwiML
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time inbound call transcription, automated intent qualification, audio speech, and host escalation.
          </p>
        </div>

        <button
          onClick={onOpenPhoneSimulator}
          className="flex items-center gap-2 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-400 text-white font-bold text-xs uppercase px-4 py-2.5 rounded-xl shadow-lg shadow-rose-500/20 transition-all"
        >
          <Smartphone className="w-4 h-4" />
          <span>Place Interactive Voice Call</span>
        </button>
      </div>

      {/* Main Grid: Calls List vs Transcript Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Call Logs List */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
          <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
            Recent Voice Inquiries ({filteredCalls.length})
          </div>

          <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
            {filteredCalls.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No voice calls recorded yet.
              </div>
            ) : (
              filteredCalls.map((call) => {
                const lead = leads.find(l => l.id === call.leadId);
                const client = clients.find(c => c.id === call.clientId);
                const isSelected = activeCall?.id === call.id;

                return (
                  <button
                    key={call.id}
                    onClick={() => {
                      setSelectedCallId(call.id);
                      audioVoice.stopSpeaking();
                      setIsPlayingAudio(false);
                    }}
                    className={`w-full text-left p-3.5 rounded-xl transition-all border ${
                      isSelected
                        ? 'bg-indigo-950/40 border-indigo-500/60 shadow-md'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {call.direction === 'inbound' ? (
                          <PhoneIncoming className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <PhoneOutgoing className="w-4 h-4 text-indigo-400" />
                        )}
                        <span className="text-xs font-bold text-white">
                          {lead?.name || 'Inbound Caller'}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded">
                        {call.durationSeconds}s
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 font-mono mt-1">
                      {call.fromNumber} → <span className="text-cyan-400">{client?.name.split(' ')[0]}</span>
                    </div>

                    {call.summary && (
                      <p className="text-xs text-slate-300 mt-2 line-clamp-2 leading-relaxed">
                        {call.summary}
                      </p>
                    )}

                    <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                      <span className="text-slate-500 font-mono">
                        {new Date(call.startedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                      {call.escalatedToHuman ? (
                        <span className="text-rose-400 font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Transferred
                        </span>
                      ) : (
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> AI Resolved
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Active Call Transcript & AI Summary */}
        {activeCall && activeClient ? (
          <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between space-y-5">
            <div>
              {/* Header Info */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">
                      Call from {activeLead?.name || 'Inbound Caller'} ({activeCall.fromNumber})
                    </span>
                    <span className="text-xs font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/60">
                      {activeCall.durationSeconds}s duration
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Routed to Virtual Line: <strong className="text-slate-200">{activeClient.trackingPhoneNumber}</strong> ({activeClient.name})
                  </div>
                </div>

                {/* Audio Playback Simulator */}
                <button
                  onClick={handlePlayTranscriptAudio}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    isPlayingAudio
                      ? 'bg-rose-500 hover:bg-rose-400 text-white animate-pulse'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25'
                  }`}
                  title="Simulate listening to this recorded voice conversation"
                >
                  {isPlayingAudio ? (
                    <>
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>Stop Voice Playback</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Listen to Audio Transcript</span>
                    </>
                  )}
                </button>
              </div>

              {/* AI Summary Box */}
              {activeCall.summary && (
                <div className="mt-4 p-4 rounded-xl bg-indigo-950/30 border border-indigo-800/40 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-indigo-300 uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    AI Autonomous Call Briefing
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed">
                    {activeCall.summary}
                  </p>
                  {activeCall.actionItems && activeCall.actionItems.length > 0 && (
                    <div className="pt-2 border-t border-indigo-900/50 flex flex-wrap gap-2 text-[11px]">
                      <span className="text-indigo-400 font-semibold">Action Items:</span>
                      {activeCall.actionItems.map((ai, i) => (
                        <span key={i} className="bg-slate-900/80 text-slate-300 px-2 py-0.5 rounded border border-indigo-800/40">
                          • {ai}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Full Transcript Feed */}
              <div className="mt-5 space-y-3">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Full Verbatim Transcript:
                </div>

                <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                  {activeCall.transcript.map((t, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border text-xs leading-relaxed ${
                        t.speaker === 'agent'
                          ? 'bg-slate-950/80 border-cyan-900/40 text-cyan-100 ml-4'
                          : 'bg-slate-900 border-slate-800 text-slate-200 mr-4'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                        <span className="font-bold flex items-center gap-1">
                          {t.speaker === 'agent' ? (
                            <>
                              <Bot className="w-3 h-3 text-cyan-400" />
                              <span className="text-cyan-300">AI Voice Receptionist</span>
                            </>
                          ) : (
                            <>
                              <User className="w-3 h-3 text-slate-400" />
                              <span>{activeLead?.name || 'Caller'}</span>
                            </>
                          )}
                        </span>
                        <span className="font-mono text-slate-500">{t.time}</span>
                      </div>
                      <p>{t.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Notice */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-emerald-400" />
                Twilio Voice Webhook status: 200 OK
              </span>
              <span className="text-slate-500 font-mono">
                Audio Encrypted & TCPA Compliant
              </span>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center text-slate-500 text-xs">
            Select a call to review audio and transcription logs.
          </div>
        )}
      </div>
    </div>
  );
};
