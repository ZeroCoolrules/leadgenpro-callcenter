import {
  Client,
  PhoneNumber,
  Lead,
  Conversation,
  Message,
  Call,
  Appointment,
  AvailabilitySlot,
  Reminder,
  Handoff,
  ComplianceLog,
  AgentAction,
} from '../types/dispatch';
import {
  INITIAL_CLIENTS,
  INITIAL_PHONE_NUMBERS,
  INITIAL_LEADS,
  INITIAL_CONVERSATIONS,
  INITIAL_MESSAGES,
  INITIAL_CALLS,
  INITIAL_APPOINTMENTS,
  INITIAL_AVAILABILITY,
  INITIAL_REMINDERS,
  INITIAL_HANDOFFS,
  INITIAL_COMPLIANCE_LOGS,
  INITIAL_AGENT_ACTIONS,
} from '../data/seedData';

const STORAGE_KEYS = {
  CLIENTS: 'dispatch_clients_v3',
  PHONE_NUMBERS: 'dispatch_phone_numbers_v3',
  LEADS: 'dispatch_leads_v3',
  CONVERSATIONS: 'dispatch_conversations_v3',
  MESSAGES: 'dispatch_messages_v3',
  CALLS: 'dispatch_calls_v3',
  APPOINTMENTS: 'dispatch_appointments_v3',
  AVAILABILITY: 'dispatch_availability_v3',
  REMINDERS: 'dispatch_reminders_v3',
  HANDOFFS: 'dispatch_handoffs_v3',
  COMPLIANCE: 'dispatch_compliance_v3',
  ACTIONS: 'dispatch_actions_v3',
};

function load<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function save<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('dispatch_state_change', { detail: { key } }));
  } catch {
    // ignore
  }
}

export class DispatchStore {
  // Getters
  public static getClients(): Client[] {
    return load<Client[]>(STORAGE_KEYS.CLIENTS, INITIAL_CLIENTS);
  }

  public static getPhoneNumbers(): PhoneNumber[] {
    return load<PhoneNumber[]>(STORAGE_KEYS.PHONE_NUMBERS, INITIAL_PHONE_NUMBERS);
  }

  public static getLeads(): Lead[] {
    return load<Lead[]>(STORAGE_KEYS.LEADS, INITIAL_LEADS);
  }

  public static getConversations(): Conversation[] {
    return load<Conversation[]>(STORAGE_KEYS.CONVERSATIONS, INITIAL_CONVERSATIONS);
  }

  public static getMessages(): Message[] {
    return load<Message[]>(STORAGE_KEYS.MESSAGES, INITIAL_MESSAGES);
  }

  public static getCalls(): Call[] {
    return load<Call[]>(STORAGE_KEYS.CALLS, INITIAL_CALLS);
  }

  public static getAppointments(): Appointment[] {
    return load<Appointment[]>(STORAGE_KEYS.APPOINTMENTS, INITIAL_APPOINTMENTS);
  }

  public static getAvailability(): AvailabilitySlot[] {
    return load<AvailabilitySlot[]>(STORAGE_KEYS.AVAILABILITY, INITIAL_AVAILABILITY);
  }

  public static getReminders(): Reminder[] {
    return load<Reminder[]>(STORAGE_KEYS.REMINDERS, INITIAL_REMINDERS);
  }

  public static getHandoffs(): Handoff[] {
    return load<Handoff[]>(STORAGE_KEYS.HANDOFFS, INITIAL_HANDOFFS);
  }

  public static getComplianceLogs(): ComplianceLog[] {
    return load<ComplianceLog[]>(STORAGE_KEYS.COMPLIANCE, INITIAL_COMPLIANCE_LOGS);
  }

  public static getAgentActions(): AgentAction[] {
    return load<AgentAction[]>(STORAGE_KEYS.ACTIONS, INITIAL_AGENT_ACTIONS);
  }

  // Mutations
  public static addMessage(msg: Message): void {
    const messages = this.getMessages();
    messages.push(msg);
    save(STORAGE_KEYS.MESSAGES, messages);

    // Update conversation last snippet & timestamp
    const convs = this.getConversations();
    const conv = convs.find(c => c.id === msg.conversationId);
    if (conv) {
      conv.lastMessageSnippet = msg.content;
      conv.lastActivityAt = msg.timestamp;
      if (msg.direction === 'inbound') {
        conv.unreadCount = (conv.unreadCount || 0) + 1;
      }
      save(STORAGE_KEYS.CONVERSATIONS, convs);
    }
  }

  public static addLead(lead: Lead): void {
    const leads = this.getLeads();
    leads.push(lead);
    save(STORAGE_KEYS.LEADS, leads);
  }

  public static updateLead(leadId: string, updates: Partial<Lead>): void {
    const leads = this.getLeads();
    const idx = leads.findIndex(l => l.id === leadId);
    if (idx !== -1) {
      leads[idx] = { ...leads[idx], ...updates };
      save(STORAGE_KEYS.LEADS, leads);
    }
  }

  public static addConversation(conv: Conversation): void {
    const convs = this.getConversations();
    convs.push(conv);
    save(STORAGE_KEYS.CONVERSATIONS, convs);
  }

  public static updateConversation(convId: string, updates: Partial<Conversation>): void {
    const convs = this.getConversations();
    const idx = convs.findIndex(c => c.id === convId);
    if (idx !== -1) {
      convs[idx] = { ...convs[idx], ...updates };
      save(STORAGE_KEYS.CONVERSATIONS, convs);
    }
  }

  public static addAppointment(appt: Appointment): void {
    const appts = this.getAppointments();
    appts.push(appt);
    save(STORAGE_KEYS.APPOINTMENTS, appts);

    // Update lead status to 'booked'
    this.updateLead(appt.leadId, { status: 'booked', lastContactAt: new Date().toISOString() });
  }

  public static updateAppointment(apptId: string, updates: Partial<Appointment>): void {
    const appts = this.getAppointments();
    const idx = appts.findIndex(a => a.id === apptId);
    if (idx !== -1) {
      appts[idx] = { ...appts[idx], ...updates };
      save(STORAGE_KEYS.APPOINTMENTS, appts);
    }
  }

  public static addCall(call: Call): void {
    const calls = this.getCalls();
    calls.unshift(call);
    save(STORAGE_KEYS.CALLS, calls);
  }

  public static addReminder(reminder: Reminder): void {
    const rems = this.getReminders();
    rems.push(reminder);
    save(STORAGE_KEYS.REMINDERS, rems);
  }

  public static triggerReminder(reminderId: string): void {
    const rems = this.getReminders();
    const target = rems.find(r => r.id === reminderId);
    if (target) {
      target.status = 'sent';
      target.sentAt = new Date().toISOString();
      save(STORAGE_KEYS.REMINDERS, rems);

      // Also append an outbound message if conversation exists
      const convs = this.getConversations();
      const conv = convs.find(c => c.leadId === target.leadId && c.clientId === target.clientId);
      if (conv) {
        this.addMessage({
          id: `msg-${Date.now()}-rem`,
          conversationId: conv.id,
          leadId: target.leadId,
          clientId: target.clientId,
          direction: 'outbound',
          sender: 'ai_agent',
          content: target.messageTemplate,
          timestamp: new Date().toISOString(),
          status: 'delivered',
          complianceStatus: 'compliant',
        });
      }
    }
  }

  public static addHandoff(handoff: Handoff): void {
    const handoffs = this.getHandoffs();
    handoffs.unshift(handoff);
    save(STORAGE_KEYS.HANDOFFS, handoffs);
  }

  public static resolveHandoff(handoffId: string, notes?: string): void {
    const handoffs = this.getHandoffs();
    const target = handoffs.find(h => h.id === handoffId);
    if (target) {
      target.status = 'resolved';
      target.resolvedAt = new Date().toISOString();
      if (notes) target.notes = `${target.notes} | Resolution: ${notes}`;
      save(STORAGE_KEYS.HANDOFFS, handoffs);

      // Re-enable conversation to ai_active or resolved
      this.updateConversation(target.conversationId, { status: 'ai_active' });
    }
  }

  public static addAgentActions(actions: AgentAction[]): void {
    const existing = this.getAgentActions();
    existing.unshift(...actions);
    save(STORAGE_KEYS.ACTIONS, existing.slice(0, 100)); // retain last 100
  }

  public static addComplianceLog(log: ComplianceLog): void {
    const logs = this.getComplianceLogs();
    logs.unshift(log);
    save(STORAGE_KEYS.COMPLIANCE, logs);
  }

  public static resetToDefaults(): void {
    if (typeof window === 'undefined') return;
    Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
    window.dispatchEvent(new CustomEvent('dispatch_state_change', { detail: { reset: true } }));
  }
}
