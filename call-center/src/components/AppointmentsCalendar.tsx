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
  Calendar,
  Clock,
  MapPin,
  Plus,
  CheckCircle2,
  AlertCircle,
  Bell,
  X,
  Phone,
  User,
} from 'lucide-react';
import { formatAppointmentDateTime } from '../lib/agentEngine';
import { INITIAL_CLIENTS } from '../data/seedData';

interface AppointmentsCalendarProps {
  clients: Client[];
  leads: Lead[];
  appointments: Appointment[];
  reminders: Reminder[];
  selectedClientId: string | 'all';
}

export const AppointmentsCalendar: React.FC<AppointmentsCalendarProps> = ({
  clients,
  leads,
  appointments,
  reminders,
  selectedClientId,
}) => {
  const safeClients = (clients && clients.length > 0) ? clients : INITIAL_CLIENTS;
  const [showAddModal, setShowAddModal] = useState(false);
  const [newClientId, setNewClientId] = useState(() => safeClients[0]?.id || INITIAL_CLIENTS[0].id);
  const [newLeadName, setNewLeadName] = useState('');
  const [newLeadPhone, setNewLeadPhone] = useState('+1 (305) 555-');
  const [newServiceId, setNewServiceId] = useState(() => safeClients[0]?.services[0]?.id || INITIAL_CLIENTS[0].services[0].id);
  const [newDateStr, setNewDateStr] = useState('2026-07-07');
  const [newTimeStr, setNewTimeStr] = useState('18:00');

  const filteredAppointments = selectedClientId === 'all'
    ? appointments
    : appointments.filter(a => a.clientId === selectedClientId);

  const selectedClient = safeClients.find(c => c.id === (selectedClientId === 'all' ? newClientId : selectedClientId)) || safeClients[0];

  const handleCreateAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    const client = safeClients.find(c => c.id === newClientId) || safeClients[0] || INITIAL_CLIENTS[0];
    const service = client.services.find(s => s.id === newServiceId) || client.services[0] || INITIAL_CLIENTS[0].services[0];

    // Find or create lead
    let lead = leads.find(l => l.phone === newLeadPhone);
    if (!lead) {
      lead = {
        id: `lead-${Date.now()}`,
        name: newLeadName || 'Direct Booking Lead',
        phone: newLeadPhone,
        assignedClientId: client.id,
        status: 'booked',
        tags: ['Manual Host Entry'],
        optedOut: false,
        notes: 'Created via Host Appointments Manager',
        source: 'manual',
        firstContactAt: new Date().toISOString(),
        lastContactAt: new Date().toISOString(),
      };
      DispatchStore.addLead(lead);
    }

    const startIso = new Date(`${newDateStr}T${newTimeStr}:00`).toISOString();
    const duration = service.durationMinutes || 60;
    const endIso = new Date(new Date(startIso).getTime() + duration * 60000).toISOString();

    const appt: Appointment = {
      id: `appt-${Date.now()}`,
      leadId: lead.id,
      clientId: client.id,
      serviceId: service.id,
      serviceName: service.name,
      startDateTime: startIso,
      endDateTime: endIso,
      durationMinutes: duration,
      location: client.location,
      status: 'confirmed',
      notes: `Booked by host operator. Lead: ${lead.name}`,
      confirmationSentAt: new Date().toISOString(),
      hostNotifiedAt: new Date().toISOString(),
      calendarEventId: `cal_${Date.now()}`,
    };

    DispatchStore.addAppointment(appt);

    // Schedule 24h & 2h reminders
    DispatchStore.addReminder({
      id: `rem-${Date.now()}-24h`,
      appointmentId: appt.id,
      leadId: lead.id,
      clientId: client.id,
      triggerTime: new Date(new Date(startIso).getTime() - 24 * 3600000).toISOString(),
      offsetType: '24h_before',
      target: 'lead',
      messageTemplate: `Reminder: Your appointment for ${service.name} at ${client.name} is on ${formatAppointmentDateTime(startIso)}. Reply C to confirm.`,
      status: 'scheduled',
    });

    audioVoice.playConfirmedFanfare();
    setShowAddModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-5 rounded-2xl">
        <div>
          <h2 className="text-xl font-black text-white uppercase font-display tracking-wider flex items-center gap-2">
            <Calendar className="w-5 h-5 text-cyan-400" />
            Appointments & Availability Manager
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Confirmed calendar slots with automated dual-side notifications and reminder sync.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase px-4 py-2.5 rounded-xl transition-all shadow-md shadow-cyan-500/20"
        >
          <Plus className="w-4 h-4" />
          <span>Manual Appointment Booking</span>
        </button>
      </div>

      {/* Appointment Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAppointments.length === 0 ? (
          <div className="col-span-full bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center text-slate-500 text-xs">
            No appointments booked for this client filter yet.
          </div>
        ) : (
          filteredAppointments.map((appt) => {
            const lead = leads.find(l => l.id === appt.leadId);
            const client = clients.find(c => c.id === appt.clientId);
            const apptReminders = reminders.filter(r => r.appointmentId === appt.id);

            return (
              <div
                key={appt.id}
                className="bg-slate-900/90 border border-slate-800 hover:border-cyan-800/60 rounded-2xl p-5 shadow-lg transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-emerald-950 text-emerald-300 border border-emerald-800/60 inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        {appt.status}
                      </span>
                      <h3 className="text-sm font-bold text-white mt-2">
                        {appt.serviceName}
                      </h3>
                      <div className="text-xs font-semibold text-cyan-400 mt-0.5">
                        {client?.name}
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold bg-slate-800 text-slate-300 px-2 py-1 rounded">
                      {appt.durationMinutes}m
                    </span>
                  </div>

                  {/* Date & Time */}
                  <div className="mt-4 p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1.5">
                    <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{formatAppointmentDateTime(appt.startDateTime)}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-500" />
                      <span className="truncate">{appt.location}</span>
                    </div>
                  </div>

                  {/* Lead Info */}
                  <div className="mt-3 text-xs text-slate-300 space-y-1">
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      <strong className="text-white">{lead?.name || 'Customer'}</strong>
                    </div>
                    <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400">
                      <Phone className="w-3.5 h-3.5 text-slate-500" />
                      <span>{lead?.phone}</span>
                    </div>
                  </div>
                </div>

                {/* Footer Reminders Status */}
                <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5 text-amber-400" />
                    <span>{apptReminders.length} Reminders Queued</span>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-mono">
                    Host Notified ✓
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Manual Booking Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-cyan-800/60 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-black text-white uppercase font-display mb-1 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-cyan-400" />
              Manual Appointment Booking
            </h3>
            <p className="text-xs text-slate-400 mb-5">
              Directly schedule a lead into the host calendar and schedule automated SMS alerts.
            </p>

            <form onSubmit={handleCreateAppointment} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Target Client / Business:</label>
                <select
                  value={newClientId}
                  onChange={(e) => {
                    setNewClientId(e.target.value);
                    const c = clients.find(cl => cl.id === e.target.value);
                    if (c && c.services[0]) setNewServiceId(c.services[0].id);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-cyan-500"
                >
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Lead Full Name:</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Julian Mercer"
                    value={newLeadName}
                    onChange={(e) => setNewLeadName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Lead Phone Number:</label>
                  <input
                    type="text"
                    required
                    placeholder="+1 (305) 555-4421"
                    value={newLeadPhone}
                    onChange={(e) => setNewLeadPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Select Service:</label>
                <select
                  value={newServiceId}
                  onChange={(e) => setNewServiceId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-cyan-500"
                >
                  {selectedClient?.services.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} (${s.price} - {s.durationMinutes} mins)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Date:</label>
                  <input
                    type="date"
                    required
                    value={newDateStr}
                    onChange={(e) => setNewDateStr(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Time:</label>
                  <input
                    type="time"
                    required
                    value={newTimeStr}
                    onChange={(e) => setNewTimeStr(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold"
                >
                  Confirm & Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
