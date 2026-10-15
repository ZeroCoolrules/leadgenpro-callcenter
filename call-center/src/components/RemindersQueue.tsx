import React, { useState } from 'react';
import {
  Client,
  Lead,
  Appointment,
  Reminder,
} from '../types/dispatch';
import { DispatchStore } from '../lib/storage';
import { audioVoice } from '../lib/audioVoice';
import {
  Bell,
  Clock,
  Send,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCw,
  Smartphone,
  Calendar,
} from 'lucide-react';
import { formatAppointmentDateTime } from '../lib/agentEngine';

interface RemindersQueueProps {
  clients: Client[];
  leads: Lead[];
  appointments: Appointment[];
  reminders: Reminder[];
  selectedClientId: string | 'all';
}

export const RemindersQueue: React.FC<RemindersQueueProps> = ({
  clients,
  leads,
  appointments,
  reminders,
  selectedClientId,
}) => {
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const filteredReminders = selectedClientId === 'all'
    ? reminders
    : reminders.filter(r => r.clientId === selectedClientId);

  const handleTriggerNow = (reminder: Reminder) => {
    DispatchStore.triggerReminder(reminder.id);
    audioVoice.playSmsSent();
    setSuccessToast(`Dispatched test SMS alert for reminder #${reminder.id.slice(-6)} to lead & host!`);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-5 rounded-2xl">
        <div>
          <h2 className="text-xl font-black text-white uppercase font-display tracking-wider flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-400" />
            Automated Appointment Reminders & Cron Queue
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Pre-appointment SMS dispatch queue (24 hours and 2 hours prior). Both customer and host receive timely alerts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-amber-300 bg-amber-950/60 border border-amber-800/60 px-3 py-1.5 rounded-xl font-bold">
            ⚡ Scheduled Queue: {filteredReminders.filter(r => r.status === 'scheduled').length}
          </span>
        </div>
      </div>

      {successToast && (
        <div className="p-3.5 bg-emerald-950/90 border border-emerald-700 text-emerald-200 text-xs font-semibold rounded-xl flex items-center justify-between shadow-lg">
          <span>✓ {successToast}</span>
          <button onClick={() => setSuccessToast(null)} className="text-emerald-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Reminders Table / Grid */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="p-4">Target Recipient</th>
                <th className="p-4">Business / Client</th>
                <th className="p-4">Scheduled Trigger</th>
                <th className="p-4">Offset Type</th>
                <th className="p-4">Message Template Preview</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Instant Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredReminders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No reminders queued for this client.
                  </td>
                </tr>
              ) : (
                filteredReminders.map((rem) => {
                  const lead = leads.find(l => l.id === rem.leadId);
                  const client = clients.find(c => c.id === rem.clientId);
                  const isSent = rem.status === 'sent';

                  return (
                    <tr key={rem.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-white">{lead?.name || 'Lead'}</div>
                        <div className="text-[11px] font-mono text-slate-400">{lead?.phone}</div>
                      </td>

                      <td className="p-4">
                        <div className="font-semibold text-slate-200">{client?.name}</div>
                        <div className="text-[10px] text-cyan-400">{client?.trackingPhoneNumber}</div>
                      </td>

                      <td className="p-4 font-mono text-xs text-slate-300">
                        {new Date(rem.triggerTime).toLocaleDateString([], { month: 'short', day: 'numeric' })} at{' '}
                        {new Date(rem.triggerTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>

                      <td className="p-4">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 uppercase">
                          {rem.offsetType.replace('_', ' ')}
                        </span>
                      </td>

                      <td className="p-4 max-w-xs truncate" title={rem.messageTemplate}>
                        <span className="text-slate-400 font-mono text-[11px]">
                          "{rem.messageTemplate}"
                        </span>
                      </td>

                      <td className="p-4">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider inline-flex items-center gap-1 ${
                          isSent
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : 'bg-amber-950 text-amber-300 border border-amber-800'
                        }`}>
                          {isSent ? 'Sent ✓' : 'Scheduled'}
                        </span>
                      </td>

                      <td className="p-4 text-right">
                        {isSent ? (
                          <span className="text-[11px] text-slate-500 font-mono">
                            Delivered
                          </span>
                        ) : (
                          <button
                            onClick={() => handleTriggerNow(rem)}
                            className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] px-3 py-1.5 rounded-lg transition-all"
                            title="Simulate the background cron job firing right now"
                          >
                            <Play className="w-3 h-3 fill-current" />
                            <span>Fire Now</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
