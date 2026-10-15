export type ClientIndustry = 'auto_detailing' | 'dental' | 'home_services' | 'medspa' | 'consulting' | 'legal' | 'massage_therapy' | 'wellness';

export interface ServiceItem {
  id: string;
  name: string;
  durationMinutes: number;
  price: number;
  depositRequired: number;
  description: string;
  rules?: string[];
}

export interface BusinessHours {
  timezone: string;
  startHour: number; // e.g. 8 for 8:00 AM
  endHour: number;   // e.g. 18 for 6:00 PM
  workDays: number[]; // [1,2,3,4,5] for Mon-Fri
}

export interface Client {
  id: string;
  name: string;
  slug: string;
  industry: ClientIndustry;
  trackingPhoneNumber: string;
  forwardedFromNumber?: string;
  businessHours: BusinessHours;
  services: ServiceItem[];
  location: string;
  locationType: 'in_person' | 'on_site' | 'virtual';
  rules: string[];
  cancellationPolicy: string;
  hostContactPhone: string;
  hostName: string;
  notificationWebhookUrl?: string;
  active: boolean;
  createdAt: string;
}

export interface PhoneNumber {
  id: string;
  number: string;
  friendlyName: string;
  provider: 'Twilio' | 'Telnyx' | 'Vonage';
  assignedClientId: string;
  status: 'active' | 'forwarding' | 'pending';
  capabilities: ('sms' | 'voice')[];
  totalCalls: number;
  totalSms: number;
}

export type LeadStatus = 'new' | 'qualifying' | 'booked' | 'escalated' | 'opted_out';

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email?: string;
  assignedClientId: string;
  status: LeadStatus;
  tags: string[];
  optedOut: boolean;
  optOutDate?: string;
  notes: string;
  source: 'inbound_sms' | 'inbound_voice' | 'web_form' | 'manual';
  firstContactAt: string;
  lastContactAt: string;
}

export type ChannelType = 'sms' | 'voice';
export type ConversationStatus = 'ai_active' | 'human_takeover' | 'resolved' | 'closed';
export type SentimentType = 'positive' | 'neutral' | 'frustrated' | 'urgent';

export interface Conversation {
  id: string;
  leadId: string;
  clientId: string;
  channel: ChannelType;
  status: ConversationStatus;
  unreadCount: number;
  lastMessageSnippet: string;
  lastActivityAt: string;
  sentiment: SentimentType;
}

export interface Message {
  id: string;
  conversationId: string;
  leadId: string;
  clientId: string;
  direction: 'inbound' | 'outbound';
  sender: 'lead' | 'ai_agent' | 'human_host' | 'system';
  content: string;
  timestamp: string;
  status: 'delivered' | 'failed' | 'flagged';
  complianceStatus: 'compliant' | 'opt_out_processed' | 'blocked_keyword';
  twilioMessageSid?: string;
}

export interface CallTranscriptTurn {
  speaker: 'agent' | 'caller' | 'human';
  text: string;
  time: string;
}

export interface Call {
  id: string;
  clientId: string;
  leadId: string;
  direction: 'inbound' | 'outbound';
  fromNumber: string;
  toNumber: string;
  durationSeconds: number;
  status: 'completed' | 'in_progress' | 'transferred' | 'missed';
  startedAt: string;
  endedAt?: string;
  recordingUrl?: string;
  transcript: CallTranscriptTurn[];
  summary?: string;
  actionItems?: string[];
  escalatedToHuman: boolean;
}

export interface Appointment {
  id: string;
  leadId: string;
  clientId: string;
  serviceId: string;
  serviceName: string;
  startDateTime: string; // ISO string
  endDateTime: string;   // ISO string
  durationMinutes: number;
  location: string;
  status: 'confirmed' | 'pending_confirmation' | 'completed' | 'cancelled' | 'no_show';
  notes: string;
  confirmationSentAt?: string;
  hostNotifiedAt?: string;
  calendarEventId?: string;
}

export interface AvailabilitySlot {
  id: string;
  clientId: string;
  dayOfWeek: number; // 0-6
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  isAvailable: boolean;
  maxBookingsPerSlot: number;
}

export type ActionType = 
  | 'greet' 
  | 'service_quote' 
  | 'availability_check' 
  | 'appointment_booked' 
  | 'confirmation_sent' 
  | 'reminder_sent' 
  | 'escalate_human' 
  | 'opt_out_handled' 
  | 'blocked_content_intercepted';

export interface AgentAction {
  id: string;
  conversationId?: string;
  leadId?: string;
  clientId: string;
  actionType: ActionType;
  details: Record<string, any>;
  timestamp: string;
  rawInput?: string;
  agentReasoning?: string;
}

export interface Reminder {
  id: string;
  appointmentId: string;
  leadId: string;
  clientId: string;
  triggerTime: string; // ISO string
  offsetType: '24h_before' | '2h_before' | '15m_before';
  target: 'lead' | 'host' | 'both';
  messageTemplate: string;
  status: 'scheduled' | 'sent' | 'cancelled';
  sentAt?: string;
}

export interface Handoff {
  id: string;
  conversationId: string;
  leadId: string;
  clientId: string;
  reason: 'frustrated_customer' | 'payment_dispute' | 'custom_quote_needed' | 'complex_scheduling' | 'user_requested_human' | 'safety_flag';
  urgency: 'low' | 'medium' | 'high' | 'critical';
  triggerMessage: string;
  assignedTo?: string;
  status: 'open' | 'in_progress' | 'resolved';
  notes: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface ComplianceLog {
  id: string;
  phone: string;
  clientId: string;
  eventType: 'opt_out' | 'opt_in' | 'blocked_word' | 'rate_limit';
  details: string;
  timestamp: string;
}
