import type { ChatTurn } from './llm';

const BOOKING_TAG = /\[\[\s*BOOKED\s*:\s*([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2})\s*\]\]/i;

function hourLabel(h: number): string {
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:00 ${suffix}`;
}

export function buildSystemPrompt(client: any, lead: any): string {
  const services =
    client?.services?.map((s: any) => `- ${s.name} ($${s.price}, ${s.durationMinutes} mins)`).join('\n') ||
    '- General consultation';
  const rules = client?.rules?.join('\n') || '24h cancellation notice';
  const start = client?.businessHours?.startHour ?? 8;
  const end = client?.businessHours?.endHour ?? 18;
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return `You are the AI receptionist for "${client?.name || 'our business'}". You reply by text message.
Today is ${today}.

Business information:
- Location: ${client?.location || 'our office'}
- Business hours: ${hourLabel(start)} to ${hourLabel(end)}
- Services:
${services}
- Rules and cancellation policy:
${rules}

Customer: ${lead?.name || 'Customer'} (${lead?.phone || 'unknown phone'})

How to respond:
1. Greet warmly and confirm which service they want.
2. Ask for a day and time if they have not given one.
3. Only book inside business hours. If a requested time is outside hours, offer the nearest open time.
4. When you confirm a booking, write exactly:
"Confirmed for [Weekday, Month Day, Year] at [Time] for [Duration] minutes. You'll receive a reminder before the appointment."
and then on a new line add the machine tag [[BOOKED: YYYY-MM-DDTHH:MM]] with the local date and 24h time.
5. If the customer is angry, asks for a human, or mentions a lawyer, legal action or chargeback, say:
"I understand completely. I am looping in ${client?.hostName || 'our team'} right away to assist you directly."
6. Keep replies short (1-3 sentences), friendly and professional. Never invent prices or services not listed.`;
}

export function buildMessages(
  client: any,
  lead: any,
  history: { role: string; text: string }[] | undefined,
  message: string,
): ChatTurn[] {
  const turns: ChatTurn[] = [{ role: 'system', content: buildSystemPrompt(client, lead) }];
  for (const h of history || []) {
    if (!h?.text) continue;
    turns.push({ role: h.role === 'model' || h.role === 'assistant' ? 'assistant' : 'user', content: String(h.text) });
  }
  turns.push({ role: 'user', content: message });
  return turns;
}

// Strips the machine booking tag from the model reply and returns structured data.
export function parseAgentReply(raw: string): {
  reply: string;
  isBookingConfirmed: boolean;
  bookingDetails?: { dateIso: string };
} {
  const match = raw.match(BOOKING_TAG);
  const reply = raw.replace(BOOKING_TAG, '').trim();
  const isBookingConfirmed = !!match || reply.toLowerCase().includes('confirmed for');
  let bookingDetails: { dateIso: string } | undefined;
  if (match) {
    const d = new Date(match[1]);
    if (!isNaN(d.getTime())) bookingDetails = { dateIso: d.toISOString() };
  }
  return { reply, isBookingConfirmed, bookingDetails };
}

export function isEscalation(reply: string): boolean {
  return reply.toLowerCase().includes('looping in');
}
