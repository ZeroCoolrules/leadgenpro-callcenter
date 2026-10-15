import React, { useState, useEffect, useRef } from 'react';
import {
  Client,
  Lead,
  Conversation,
  Message,
  Appointment,
  Call,
  CallTranscriptTurn,
} from '../types/dispatch';
import { DispatchStore } from '../lib/storage';
import { processInboundMessage, formatAppointmentDateTime } from '../lib/agentEngine';
import { audioVoice } from '../lib/audioVoice';
import { INITIAL_CLIENTS } from '../data/seedData';
import {
  X,
  Phone,
  MessageSquare,
  Send,
  Bot,
  User,
  Radio,
  Volume2,
  VolumeX,
  Sparkles,
  PhoneCall,
  PhoneOff,
  BellRing,
  Code,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';

interface PhoneSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  leads: Lead[];
  conversations: Conversation[];
  messages: Message[];
  appointments: Appointment[];
}

export const PhoneSimulatorModal: React.FC<PhoneSimulatorModalProps> = ({
  isOpen,
  onClose,
  clients,
  leads,
  conversations,
  messages,
  appointments,
}) => {
  const safeClients = (clients && clients.length > 0) ? clients : (INITIAL_CLIENTS && INITIAL_CLIENTS.length > 0 ? INITIAL_CLIENTS : []);
  const [activeTab, setActiveTab] = useState<'sms' | 'voice' | 'webhook'>('sms');
  const [selectedClientId, setSelectedClientId] = useState<string>(() => safeClients[0]?.id || 'client-dream-wellness');
  const [simLeadName, setSimLeadName] = useState('Julianna Vance');
  const [simLeadPhone, setSimLeadPhone] = useState('+1 (305) 789-4421');
  const [smsInput, setSmsInput] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [hostAlertNotification, setHostAlertNotification] = useState<string | null>(null);

  // Sync selectedClientId when clients array updates
  useEffect(() => {
    if (safeClients && safeClients.length > 0 && !safeClients.some(c => c && c.id === selectedClientId)) {
      setSelectedClientId(safeClients[0]?.id || '');
    }
  }, [safeClients, selectedClientId]);

  // Voice Call State
  const [callState, setCallState] = useState<'idle' | 'ringing' | 'connected' | 'ended'>('idle');
  const [callDuration, setCallDuration] = useState(0);
  const [voiceTranscript, setVoiceTranscript] = useState<CallTranscriptTurn[]>([]);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [lastWebhookPayload, setLastWebhookPayload] = useState<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const ringCancelRef = useRef<(() => void) | null>(null);

  const selectedClient = safeClients.find(c => c.id === selectedClientId) || safeClients[0] || INITIAL_CLIENTS[0];
  const clientId = selectedClient.id;

  // Find or create lead and conversation for this simulator session
  const simLead = leads.find(l => l.phone === simLeadPhone) || {
    id: `lead-sim-${simLeadPhone.replace(/\D/g, '')}`,
    name: simLeadName,
    phone: simLeadPhone,
    assignedClientId: clientId,
    status: 'qualifying',
    tags: ['Simulator Lead'],
    optedOut: false,
    notes: 'Simulated customer handset',
    source: 'inbound_sms',
    firstContactAt: new Date().toISOString(),
    lastContactAt: new Date().toISOString(),
  };

  const simConv = conversations.find(c => c.leadId === simLead.id && c.clientId === clientId) || {
    id: `conv-sim-${clientId}`,
    leadId: simLead.id,
    clientId: clientId,
    channel: 'sms',
    status: 'ai_active',
    unreadCount: 0,
    lastMessageSnippet: 'Simulator thread initiated',
    lastActivityAt: new Date().toISOString(),
    sentiment: 'neutral',
  };

  const simMessages = messages.filter(m => m.conversationId === simConv.id);

  // Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [simMessages, isAiTyping]);

  // Call timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (callState === 'connected') {
      interval = setInterval(() => {
        setCallDuration(d => d + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [callState]);

  if (!isOpen) return null;

  // Send an Inbound SMS as the simulated customer
  const handleSendSms = async (textToSend?: string) => {
    const text = (textToSend || smsInput).trim();
    if (!text) return;

    audioVoice.playSmsSent();
    setSmsInput('');

    // Ensure lead & conversation exist in store
    if (!leads.some(l => l.id === simLead.id)) {
      DispatchStore.addLead(simLead);
    }
    if (!conversations.some(c => c.id === simConv.id)) {
      DispatchStore.addConversation(simConv);
    }

    // Inbound Message Record
    const inMsg: Message = {
      id: `msg-${Date.now()}-in`,
      conversationId: simConv.id,
      leadId: simLead.id,
      clientId: selectedClient.id,
      direction: 'inbound',
      sender: 'lead',
      content: text,
      timestamp: new Date().toISOString(),
      status: 'delivered',
      complianceStatus: 'compliant',
      twilioMessageSid: `SM${Math.random().toString(36).substring(2, 12)}`,
    };

    DispatchStore.addMessage(inMsg);

    // Save Twilio Webhook payload snapshot
    setLastWebhookPayload({
      endpoint: '/api/webhooks/twilio/sms',
      timestamp: new Date().toISOString(),
      inbound: {
        From: simLeadPhone,
        To: selectedClient.trackingPhoneNumber,
        Body: text,
        MessageSid: inMsg.twilioMessageSid,
        AccountSid: 'AC_TWILIO_DISPATCH_MAIN',
      },
      status: 'processing_ai_agent',
    });

    // Simulate AI Agent processing with natural typing delay
    setIsAiTyping(true);

    setTimeout(async () => {
      const result = await processInboundMessage({
        leadMessage: text,
        lead: simLead,
        client: selectedClient,
        conversation: simConv,
        existingMessages: [...simMessages, inMsg],
        allAppointments: appointments,
      });

      setIsAiTyping(false);
      audioVoice.playSmsIncoming();

      // Record AI Outbound message
      const outMsg: Message = {
        id: `msg-${Date.now()}-out`,
        conversationId: simConv.id,
        leadId: simLead.id,
        clientId: selectedClient.id,
        direction: 'outbound',
        sender: 'ai_agent',
        content: result.replyText,
        timestamp: new Date().toISOString(),
        status: 'delivered',
        complianceStatus: 'compliant',
      };

      DispatchStore.addMessage(outMsg);

      // Record any agent actions, appointments, handoffs, reminders
      if (result.agentActions) {
        DispatchStore.addAgentActions(result.agentActions);
      }
      if (result.createdAppointment) {
        DispatchStore.addAppointment(result.createdAppointment);
        audioVoice.playConfirmedFanfare();
      }
      if (result.createdReminders) {
        result.createdReminders.forEach(r => DispatchStore.addReminder(r));
      }
      if (result.createdHandoff) {
        DispatchStore.addHandoff(result.createdHandoff);
      }
      if (result.updatedConversationStatus) {
        DispatchStore.updateConversation(simConv.id, { status: result.updatedConversationStatus });
      }

      // If host notification was triggered, show banner toast
      if (result.hostNotification) {
        setHostAlertNotification(result.hostNotification.messageText);
        setTimeout(() => setHostAlertNotification(null), 8000);
      }

      // Update Webhook snapshot with TwiML
      setLastWebhookPayload((prev: any) => ({
        ...prev,
        status: 'completed_200_ok',
        twimlResponse: `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n    <Message>${result.replyText}</Message>\n</Response>`,
      }));
    }, 900);
  };

  // Start Inbound Voice Call Flow
  const handleStartCall = () => {
    setCallState('ringing');
    setCallDuration(0);
    setVoiceTranscript([]);

    // Play ringing tone
    ringCancelRef.current = audioVoice.playPhoneRing(2400);

    setTimeout(() => {
      if (ringCancelRef.current) ringCancelRef.current();
      setCallState('connected');

      // AI Answers with Greeting
      const greeting = `Thank you for calling ${selectedClient.name}! I am your automated AI dispatch assistant. I can help book your service right now. What service are you looking for today?`;
      
      const newTurns: CallTranscriptTurn[] = [
        { speaker: 'agent', text: greeting, time: '0:01' }
      ];
      setVoiceTranscript(newTurns);

      setIsAgentSpeaking(true);
      audioVoice.speak(greeting, () => {
        setIsAgentSpeaking(false);
      });
    }, 2400);
  };

  // Handle Voice Customer Turn
  const handleVoiceSpeakTurn = (callerText: string) => {
    const timeFormatted = `0:${callDuration < 10 ? '0' : ''}${callDuration}`;
    const updatedTurns: CallTranscriptTurn[] = [
      ...voiceTranscript,
      { speaker: 'caller', text: callerText, time: timeFormatted }
    ];
    setVoiceTranscript(updatedTurns);

    setIsAgentSpeaking(true);

    // AI Response logic for Voice
    setTimeout(async () => {
      const result = await processInboundMessage({
        leadMessage: callerText,
        lead: simLead,
        client: selectedClient,
        conversation: simConv,
        existingMessages: [],
        allAppointments: appointments,
      });

      const replyText = result.replyText;
      const agentTime = `0:${callDuration + 2 < 10 ? '0' : ''}${callDuration + 2}`;

      setVoiceTranscript(t => [...t, { speaker: 'agent', text: replyText, time: agentTime }]);

      if (result.createdAppointment) {
        DispatchStore.addAppointment(result.createdAppointment);
        audioVoice.playConfirmedFanfare();
      }
      if (result.hostNotification) {
        setHostAlertNotification(result.hostNotification.messageText);
        setTimeout(() => setHostAlertNotification(null), 8000);
      }

      audioVoice.speak(replyText, () => {
        setIsAgentSpeaking(false);
      });
    }, 800);
  };

  // End Voice Call
  const handleEndCall = () => {
    if (ringCancelRef.current) ringCancelRef.current();
    audioVoice.stopSpeaking();
    setIsAgentSpeaking(false);

    // Save Call Record to Store
    if (voiceTranscript.length > 0) {
      const newCall: Call = {
        id: `call-${Date.now()}`,
        clientId: selectedClient.id,
        leadId: simLead.id,
        direction: 'inbound',
        fromNumber: simLeadPhone,
        toNumber: selectedClient.trackingPhoneNumber,
        durationSeconds: callDuration,
        status: 'completed',
        startedAt: new Date().toISOString(),
        transcript: voiceTranscript,
        summary: `Call simulated via virtual handset. Lead ${simLead.name} spoke with AI agent.`,
        actionItems: ['Follow-up SMS sent', 'Calendar checked'],
        escalatedToHuman: false,
      };
      DispatchStore.addCall(newCall);
    }

    setCallState('ended');
    setTimeout(() => setCallState('idle'), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-cyan-800/60 rounded-3xl w-full max-w-4xl p-4 sm:p-6 shadow-2xl relative flex flex-col max-h-[92vh]">
        {/* Modal Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-full bg-slate-800/60 hover:bg-slate-700 transition-colors z-20"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping" />
              <h2 className="text-lg font-black text-white uppercase font-display tracking-wider">
                Virtual Lead Handset Simulator
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Simulate real lead incoming SMS texts and Voice calls to test the autonomous booking agent.
            </p>
          </div>

          {/* Target Business Selector */}
          <div className="flex items-center gap-2 mr-10 sm:mr-0">
            <label className="text-xs text-slate-400 font-bold hidden sm:inline">Call/Text To:</label>
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="bg-slate-950 border border-cyan-800/80 rounded-xl px-3 py-1.5 text-xs text-cyan-300 font-bold focus:outline-none focus:border-cyan-400"
            >
              {safeClients.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.trackingPhoneNumber})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Host Alert Banner (Canonical Provider Notification) */}
        {hostAlertNotification && (
          <div className="my-3 p-3.5 bg-gradient-to-r from-emerald-950 via-slate-900 to-cyan-950 border-2 border-emerald-500 rounded-2xl flex items-center justify-between gap-3 shadow-xl animate-bounce">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0">
                <BellRing className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">
                  Provider Host SMS Notification Received ({selectedClient.hostContactPhone}):
                </div>
                <div className="text-xs font-mono font-bold text-white">
                  "{hostAlertNotification}"
                </div>
              </div>
            </div>
            <button
              onClick={() => setHostAlertNotification(null)}
              className="text-xs text-emerald-400 hover:text-white p-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* Simulator Body: Phone Device on Left, Quick Testing Controls on Right */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 pt-4 overflow-y-auto">
          {/* Left Column: Phone Device Frame (6 Cols) */}
          <div className="md:col-span-6 flex justify-center">
            <div className="w-full max-w-[340px] bg-slate-950 border-4 border-slate-700/80 rounded-[44px] shadow-2xl overflow-hidden flex flex-col relative h-[560px]">
              {/* Dynamic Island / Speaker Notch */}
              <div className="h-6 bg-slate-950 w-full flex items-center justify-between px-6 pt-2 text-[10px] text-slate-400 font-mono select-none">
                <span>9:41</span>
                <div className="h-3.5 w-20 bg-slate-800 rounded-full mx-auto" />
                <span className="flex items-center gap-1">5G 100%</span>
              </div>

              {/* In-Phone Header Bar */}
              <div className="bg-slate-900/90 border-b border-slate-800 p-3 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white truncate max-w-[180px]">
                    {selectedClient.name}
                  </div>
                  <div className="text-[10px] text-cyan-400 font-mono">
                    {selectedClient.trackingPhoneNumber}
                  </div>
                </div>

                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <button
                    onClick={() => setActiveTab('sms')}
                    className={`p-1.5 rounded-lg text-xs transition-colors ${
                      activeTab === 'sms' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                    title="SMS Messaging Mode"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setActiveTab('voice')}
                    className={`p-1.5 rounded-lg text-xs transition-colors ${
                      activeTab === 'voice' ? 'bg-indigo-500 text-white font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                    title="Voice Phone Call Mode"
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Mode 1: SMS Messenger Inside Phone */}
              {activeTab === 'sms' && (
                <div className="flex-1 flex flex-col justify-between overflow-hidden bg-[#0A0D14]">
                  {/* SMS Feed */}
                  <div className="flex-1 p-3 overflow-y-auto space-y-2.5">
                    <div className="text-center my-1">
                      <span className="text-[9px] text-slate-500 font-mono uppercase bg-slate-900/60 px-2 py-0.5 rounded">
                        SMS with {selectedClient.name}
                      </span>
                    </div>

                    {simMessages.map((m) => {
                      const isCustomer = m.direction === 'inbound';
                      return (
                        <div
                          key={m.id}
                          className={`flex ${isCustomer ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-[82%] p-2.5 rounded-2xl text-xs leading-relaxed ${
                            isCustomer
                              ? 'bg-blue-600 text-white rounded-br-none'
                              : 'bg-slate-800 text-slate-100 rounded-bl-none border border-slate-700/60'
                          }`}>
                            <p>{m.content}</p>
                            <span className="block text-[9px] text-right mt-1 opacity-60 font-mono">
                              {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {isAiTyping && (
                      <div className="flex justify-start">
                        <div className="bg-slate-800 text-cyan-300 p-2.5 rounded-2xl rounded-bl-none text-xs flex items-center gap-1.5 border border-slate-700">
                          <Bot className="w-3 h-3 text-cyan-400 animate-spin" />
                          <span className="text-[11px] animate-pulse">AI Agent is typing...</span>
                        </div>
                      </div>
                    )}

                    <div ref={messagesEndRef} />
                  </div>

                  {/* SMS Composer */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSendSms();
                    }}
                    className="p-2 border-t border-slate-800 bg-slate-950 flex gap-1.5"
                  >
                    <input
                      type="text"
                      placeholder="Type text as lead..."
                      value={smsInput}
                      onChange={(e) => setSmsInput(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-full px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                    <button
                      type="submit"
                      disabled={!smsInput.trim() || isAiTyping}
                      className="h-8 w-8 rounded-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white flex items-center justify-center transition-all flex-shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>
                </div>
              )}

              {/* Mode 2: Voice Call Inside Phone */}
              {activeTab === 'voice' && (
                <div className="flex-1 flex flex-col justify-between p-4 bg-gradient-to-b from-slate-900 to-slate-950 text-center">
                  <div className="mt-4">
                    <div className="h-16 w-16 mx-auto rounded-full bg-gradient-to-tr from-indigo-600 to-cyan-500 p-0.5 shadow-xl shadow-indigo-500/20 flex items-center justify-center">
                      <div className="w-full h-full bg-slate-950 rounded-full flex items-center justify-center">
                        <Phone className="w-7 h-7 text-cyan-400" />
                      </div>
                    </div>

                    <h3 className="text-sm font-bold text-white mt-3 truncate">
                      {selectedClient.name}
                    </h3>
                    <div className="text-xs font-mono text-cyan-400">
                      {selectedClient.trackingPhoneNumber}
                    </div>

                    {/* Status Pill */}
                    <div className="mt-2">
                      {callState === 'idle' && (
                        <span className="text-xs text-slate-400">Ready to place call</span>
                      )}
                      {callState === 'ringing' && (
                        <span className="text-xs text-amber-400 font-bold animate-pulse">
                          Ringing...
                        </span>
                      )}
                      {callState === 'connected' && (
                        <span className="text-xs text-emerald-400 font-mono font-bold">
                          Connected (0:{callDuration < 10 ? '0' : ''}{callDuration})
                        </span>
                      )}
                      {callState === 'ended' && (
                        <span className="text-xs text-rose-400 font-bold">Call Ended</span>
                      )}
                    </div>
                  </div>

                  {/* Audio Wave Visualizer & Speaking indicator */}
                  {callState === 'connected' && (
                    <div className="my-2 p-3 bg-slate-950/80 rounded-2xl border border-slate-800 text-left max-h-48 overflow-y-auto space-y-2">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 border-b border-slate-800 pb-1">
                        <span className="font-bold flex items-center gap-1">
                          <Radio className="w-3 h-3 text-cyan-400 animate-pulse" />
                          Live Voice Transcription
                        </span>
                        {isAgentSpeaking && (
                          <span className="text-cyan-400 font-bold animate-pulse">AI Speaking...</span>
                        )}
                      </div>

                      {voiceTranscript.map((t, idx) => (
                        <div key={idx} className="text-xs leading-snug">
                          <strong className={t.speaker === 'agent' ? 'text-cyan-300' : 'text-slate-300'}>
                            {t.speaker === 'agent' ? 'AI: ' : 'You: '}
                          </strong>
                          <span className="text-slate-200">{t.text}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Dial / Action Button */}
                  <div className="mb-4">
                    {callState === 'idle' && (
                      <button
                        onClick={handleStartCall}
                        className="h-14 w-14 mx-auto rounded-full bg-emerald-500 hover:bg-emerald-400 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 transition-transform hover:scale-105 active:scale-95"
                        title="Call the client tracking line"
                      >
                        <Phone className="w-6 h-6 fill-current" />
                      </button>
                    )}

                    {(callState === 'ringing' || callState === 'connected') && (
                      <button
                        onClick={handleEndCall}
                        className="h-14 w-14 mx-auto rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-600/30 transition-transform hover:scale-105 active:scale-95"
                        title="Hang up call"
                      >
                        <PhoneOff className="w-6 h-6 fill-current" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Pre-set Test Scripts & Developer Inspection (6 Cols) */}
          <div className="md:col-span-6 space-y-4 flex flex-col justify-between">
            {/* Lead Identity Controls */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Simulated Lead Credentials
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[10px] text-slate-400 font-bold block mb-1">Lead Name:</label>
                  <input
                    type="text"
                    value={simLeadName}
                    onChange={(e) => setSimLeadName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-white text-xs font-semibold focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-bold block mb-1">Lead Phone:</label>
                  <input
                    type="text"
                    value={simLeadPhone}
                    onChange={(e) => setSimLeadPhone(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            </div>

            {/* Quick Test Prompt Buttons */}
            {activeTab === 'sms' && (
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  Canonical Test Scripts (One-Click Fire)
                </div>

                <div className="space-y-2">
                  {/* Button 1: Prompt Flow Step 1 */}
                  <button
                    onClick={() => {
                      const text = selectedClient.id === 'client-dream-wellness'
                        ? 'Hi, I need to book a relaxing massage next week. What appointments do you have open?'
                        : `Hi, I need to book an appointment next week. What do you guys have open?`;
                      handleSendSms(text);
                    }}
                    className="w-full text-left p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-cyan-800/60 text-xs text-slate-200 transition-all flex items-start gap-2"
                  >
                    <span className="font-bold text-cyan-400 font-mono text-[11px]">1.</span>
                    <div>
                      <strong className="text-white block">Initial Inbound Inquiry</strong>
                      <span className="text-slate-400 text-[11px]">
                        {selectedClient.id === 'client-dream-wellness'
                          ? '"Hi, I need to book a relaxing massage next week. What appointments do you have open?"'
                          : '"Hi, I need to book an appointment next week. What do you guys have open?"'}
                      </span>
                    </div>
                  </button>

                  {/* Button 2: Prompt Flow Step 2 (Exact confirmation prompt) */}
                  <button
                    onClick={() => {
                      const text = selectedClient.id === 'client-dream-wellness'
                        ? 'Looking for the Swedish Relaxation Massage. Can we do Tuesday at 6:00 PM?'
                        : 'Looking for the Signature Full Detail. Can we do Tuesday at 6:00 PM?';
                      handleSendSms(text);
                    }}
                    className="w-full text-left p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-emerald-800/60 text-xs text-slate-200 transition-all flex items-start gap-2"
                  >
                    <span className="font-bold text-emerald-400 font-mono text-[11px]">2.</span>
                    <div>
                      <strong className="text-white block">Lock In Appointment (Canonical Flow)</strong>
                      <span className="text-slate-400 text-[11px]">
                        {selectedClient.id === 'client-dream-wellness'
                          ? '"Looking for the Swedish Relaxation Massage. Can we do Tuesday at 6:00 PM?"'
                          : '"Looking for the Signature Full Detail. Can we do Tuesday at 6:00 PM?"'}
                      </span>
                    </div>
                  </button>

                  {/* Button 3: Pricing inquiry */}
                  <button
                    onClick={() => {
                      const text = selectedClient.id === 'client-dream-wellness'
                        ? 'How much does your Deep Tissue or Hot Stone session cost and what is the policy?'
                        : 'How much does your Gold Ceramic Coating cost and what are the rules?';
                      handleSendSms(text);
                    }}
                    className="w-full text-left p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-indigo-800/60 text-xs text-slate-200 transition-all flex items-start gap-2"
                  >
                    <span className="font-bold text-indigo-400 font-mono text-[11px]">3.</span>
                    <div>
                      <strong className="text-white block">Quote Time, Price & Deposit</strong>
                      <span className="text-slate-400 text-[11px]">
                        {selectedClient.id === 'client-dream-wellness'
                          ? '"How much does your Deep Tissue or Hot Stone session cost and what is the policy?"'
                          : '"How much does your Gold Ceramic Coating cost and what are the rules?"'}
                      </span>
                    </div>
                  </button>

                  {/* Button 4: Anger / Escalation */}
                  <button
                    onClick={() => handleSendSms('Can someone just pick up the phone?! This is ridiculous, my living room is freezing.')}
                    className="w-full text-left p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-rose-800/60 text-xs text-slate-200 transition-all flex items-start gap-2"
                  >
                    <span className="font-bold text-rose-400 font-mono text-[11px]">4.</span>
                    <div>
                      <strong className="text-rose-300 block">Trigger Human Escalation Handoff</strong>
                      <span className="text-slate-400 text-[11px]">"Can someone just pick up the phone?! My living room is freezing."</span>
                    </div>
                  </button>

                  {/* Button 5: TCPA STOP */}
                  <button
                    onClick={() => handleSendSms('STOP')}
                    className="w-full text-left p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-red-800/60 text-xs text-slate-200 transition-all flex items-start gap-2"
                  >
                    <span className="font-bold text-red-400 font-mono text-[11px]">5.</span>
                    <div>
                      <strong className="text-red-300 block">Test TCPA STOP Opt-Out</strong>
                      <span className="text-slate-400 text-[11px]">"STOP" (Halts AI sequences instantly)</span>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Voice Mode Quick Dialogue Controls */}
            {activeTab === 'voice' && (
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <PhoneCall className="w-4 h-4 text-indigo-400" />
                  Voice Caller Dialogue Prompts
                </div>

                {callState !== 'connected' ? (
                  <div className="p-6 text-center text-slate-500 text-xs">
                    Press the green call button on the phone to start the live audio voice session.
                  </div>
                ) : (
                  <div className="space-y-2">
                    <button
                      onClick={() => handleVoiceSpeakTurn("Hi, I want to book an appointment next Tuesday at 6pm for full detail.")}
                      disabled={isAgentSpeaking}
                      className="w-full text-left p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-200 transition-all disabled:opacity-50"
                    >
                      "Hi, I want to book an appointment next Tuesday at 6pm for full detail."
                    </button>
                    <button
                      onClick={() => handleVoiceSpeakTurn("What are your business hours and location?")}
                      disabled={isAgentSpeaking}
                      className="w-full text-left p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-200 transition-all disabled:opacity-50"
                    >
                      "What are your business hours and location?"
                    </button>
                    <button
                      onClick={() => handleVoiceSpeakTurn("I need to speak to the manager Marco right away.")}
                      disabled={isAgentSpeaking}
                      className="w-full text-left p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-200 transition-all disabled:opacity-50"
                    >
                      "I need to speak to the manager Marco right away." (Triggers transfer)
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Raw Webhook Payload Debugger */}
            {lastWebhookPayload && (
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <span className="flex items-center gap-1">
                    <Code className="w-3.5 h-3.5 text-cyan-400" />
                    Last Twilio Webhook Dispatch
                  </span>
                  <span className="font-mono text-cyan-400">{lastWebhookPayload.status}</span>
                </div>
                <pre className="text-[10px] font-mono text-slate-300 bg-slate-900/90 p-2.5 rounded-lg overflow-x-auto max-h-24">
                  {JSON.stringify(lastWebhookPayload, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
