// Call scripts: the starter scripts shipped with the app, and the code that
// turns a script into instructions for the conversational AI.
//
// Placeholders you can use anywhere in a script:
//   {name} {first_name} {business} {agent} {service} {appointment_time} {address}
// plus any spreadsheet column, e.g. {vehicle} if your upload has a "vehicle" column.
import type { AppSettings, Appointment, CallScript, Contact } from '../src/types/outbound';

type Starter = Omit<CallScript, 'updatedAt'>;

export const DEFAULT_SCRIPTS: Starter[] = [
  {
    id: 'scr_appointment_setter',
    name: 'Appointment setter (warm leads)',
    purpose: 'outbound',
    agentName: 'Ava',
    opening:
      "Hi, is this {first_name}? This is {agent}, an automated assistant calling for {business}. You recently asked us about our services, so I'm calling to help you get a time on the calendar. Do you have a minute?",
    goal: 'Book a consultation or service appointment. If they are not ready, find out when to follow up.',
    talkingPoints:
      '- We are a local, licensed team with great reviews.\n- First visit includes a free estimate / consultation.\n- Appointments usually take about 30 minutes.\n- We can do in person or a video call on Google Meet.',
    questions:
      '1. What made you reach out to us?\n2. Is this for you or someone else?\n3. What days usually work best for you, mornings or afternoons?\n4. Would you prefer to come in, or meet by video call?',
    objections: [
      { objection: "I'm busy right now", response: 'No problem at all. Is there a better time today or tomorrow for a quick call back?' },
      { objection: 'How much does it cost?', response: 'The first consultation is free, and we give you an exact price before any work starts.' },
      { objection: 'I need to think about it', response: 'Totally fair. Would it help to pencil in a time? You can always move or cancel it by text.' },
      { objection: 'Is this a robot?', response: "Yes, I'm an automated assistant for {business}. I can book you in, or have a team member call you back if you prefer." },
    ],
    closing:
      "Perfect, you're all set. You'll get a text confirming the time, and a reminder before the appointment. Thanks {first_name}, have a great day!",
    voicemail:
      "Hi {first_name}, this is {agent} with {business}, following up on your request. Give us a call back at this number, or just reply to our text to pick a time. Thanks!",
    rules:
      "- Always say you are an automated assistant if asked.\n- Never pressure the person. If they say no twice, thank them and end the call.\n- If they ask not to be called again, apologize, confirm they will be removed, and end the call.\n- Never make up prices, discounts, or guarantees that are not in this script.\n- If they ask for a person, offer to connect them.",
  },
  {
    id: 'scr_reminder',
    name: 'Appointment reminder & reschedule',
    purpose: 'reminder',
    agentName: 'Ava',
    opening:
      'Hi {first_name}, this is {agent} from {business}, calling to remind you about your {service} appointment on {appointment_time}.',
    goal:
      'Confirm the appointment. If they cannot make it, find a new day and time that works and reschedule it.',
    talkingPoints:
      "- Remind them of the address, or that the link to the video call was texted to them.\n- Please arrive 5 minutes early.\n- If they need to cancel, we just ask for as much notice as possible.",
    questions: '1. Does that time still work for you?\n2. If not, what day and time would work better?',
    objections: [
      { objection: "I don't remember booking this", response: "No worries. It's a {service} appointment with {business}. Would you like to keep it, move it, or cancel it?" },
      { objection: 'I want to cancel', response: "I can cancel that for you. Would you like to pick a new time instead, so you don't lose your spot?" },
    ],
    closing: "Great, you're all set. We'll see you then, {first_name}!",
    voicemail:
      'Hi {first_name}, this is {agent} from {business} reminding you of your {service} appointment on {appointment_time}. To reschedule, just reply R to our text message. See you soon!',
    rules:
      "- Keep it short and friendly.\n- Only offer times inside business hours.\n- If they ask for a person, offer to connect them.\n- Never discuss medical, legal or billing details beyond what is listed here.",
  },
  {
    id: 'scr_reactivation',
    name: 'Past customer follow-up',
    purpose: 'outbound',
    agentName: 'Ava',
    opening:
      "Hi {first_name}, this is {agent}, an automated assistant for {business}. It's been a while since your last visit and we wanted to check in. Is now an okay time for a quick minute?",
    goal: 'Get past customers back on the calendar for their next visit.',
    talkingPoints:
      '- Thank them for being a customer.\n- Mention it may be time for their next service.\n- We have openings this week and next.',
    questions: '1. How did everything go last time?\n2. Would you like to book your next visit?\n3. What day and time works best?',
    objections: [
      { objection: 'I went somewhere else', response: "Thanks for letting me know. If you ever want to come back, we'd love to see you. Have a great day!" },
      { objection: 'Not right now', response: 'No problem. Would you like me to check back in a month or so?' },
    ],
    closing: "Wonderful, you're booked. You'll get a text confirmation shortly. Thanks {first_name}!",
    voicemail:
      "Hi {first_name}, it's {agent} from {business}. We'd love to see you again. Call or text us back at this number to grab a time. Thanks!",
    rules:
      "- Always say you are an automated assistant if asked.\n- If they ask not to be called again, apologize, confirm they will be removed, and end the call.\n- Never make up offers.",
  },
  {
    id: 'scr_inbound',
    name: 'Inbound receptionist',
    purpose: 'inbound',
    agentName: 'Ava',
    opening: 'Thank you for calling {business}, this is {agent}. How can I help you today?',
    goal: 'Answer questions and book an appointment for the caller.',
    talkingPoints: '- Business hours and address.\n- We offer in-person or Google Meet video appointments.',
    questions: '1. What can we help you with?\n2. What day and time works for you?\n3. Can I get your name?',
    objections: [],
    closing: "You're all set. You'll get a text confirmation shortly. Thanks for calling {business}!",
    voicemail: '',
    rules: "- If the caller is upset or asks for a person, offer to connect them.\n- Never make up prices or services.",
  },
];

export function firstName(name?: string): string {
  return (name || '').trim().split(/\s+/)[0] || 'there';
}

export function formatWhen(iso: string, timezone: string): string {
  return new Date(iso).toLocaleString('en-US', {
    timeZone: timezone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export interface ScriptContext {
  settings: AppSettings;
  contact?: Pick<Contact, 'name' | 'phone' | 'extra' | 'notes'>;
  appointment?: Appointment;
}

export function fillPlaceholders(text: string, script: CallScript, ctx: ScriptContext): string {
  const name = ctx.contact?.name || ctx.appointment?.name || '';
  const vars: Record<string, string> = {
    name: name || 'there',
    first_name: firstName(name),
    business: ctx.settings.businessName,
    agent: script.agentName || 'the assistant',
    address: ctx.settings.businessAddress || 'our office',
    service: ctx.appointment?.service || 'upcoming',
    appointment_time: ctx.appointment ? formatWhen(ctx.appointment.startsAt, ctx.settings.businessHours.timezone) : '',
  };
  for (const [k, v] of Object.entries(ctx.contact?.extra || {})) {
    vars[k.toLowerCase().replace(/\s+/g, '_')] = v;
  }
  return text.replace(/\{([a-z0-9_]+)\}/gi, (m, key) => vars[key.toLowerCase()] ?? m);
}

function hourLabel(h: number): string {
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:00 ${suffix}`;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export interface PromptOptions extends ScriptContext {
  channel: 'voice' | 'sms';
  mode: 'script' | 'reschedule';
  takenSlots?: string[]; // human-readable busy times, so the AI avoids them
}

// Builds the system prompt the AI follows on a call or text thread.
export function buildScriptPrompt(script: CallScript, opts: PromptOptions): string {
  const f = (t: string) => fillPlaceholders(t, script, opts);
  const s = opts.settings;
  const bh = s.businessHours;
  const tz = bh.timezone;
  const now = new Date().toLocaleString('en-US', {
    timeZone: tz, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
  const objections = script.objections
    .filter(o => o.objection.trim())
    .map(o => `- If they say "${f(o.objection)}": ${f(o.response)}`)
    .join('\n');
  const extra = Object.entries(opts.contact?.extra || {})
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');
  const appt = opts.appointment;

  const lines: (string | null)[] = [
    `You are ${script.agentName || 'an assistant'}, an AI assistant for "${s.businessName}". You are on a ${opts.channel === 'voice' ? 'live phone call' : 'text message conversation'}.`,
    `Right now it is ${now} (${tz}).`,
    '',
    `GOAL: ${f(script.goal)}`,
    '',
    'BUSINESS',
    `- Address: ${s.businessAddress || 'ask the team'}`,
    `- Bookable hours: ${hourLabel(bh.startHour)} to ${hourLabel(bh.endHour)}, ${bh.days.map(d => DAY_NAMES[d]).join(', ')} (${tz})`,
    `- Appointments last about ${appt?.durationMinutes || s.defaultAppointmentMinutes} minutes.`,
    '',
    'PERSON YOU ARE TALKING TO',
    `- Name: ${opts.contact?.name || appt?.name || 'unknown'}`,
    opts.contact?.notes ? `- Notes: ${opts.contact.notes}` : null,
    extra || null,
    appt ? `- Current appointment: ${appt.service} on ${formatWhen(appt.startsAt, tz)}${appt.video ? ' (video call on Google Meet)' : ''}` : null,
    '',
    'KEY POINTS YOU CAN MENTION',
    f(script.talkingPoints),
    '',
    'QUESTIONS TO ASK (one at a time)',
    f(script.questions),
    '',
    objections ? `HANDLING OBJECTIONS\n${objections}\n` : null,
    `WHEN DONE, CLOSE WITH SOMETHING LIKE: "${f(script.closing)}"`,
    '',
    'RULES',
    f(script.rules),
    '- Speak naturally. Keep each reply to 1-2 short sentences and ask only one question at a time.',
    opts.channel === 'voice' ? '- This is spoken aloud: no lists, emojis, links or special characters.' : null,
    opts.takenSlots?.length ? `- These times are already taken, do not offer them: ${opts.takenSlots.join('; ')}` : null,
    '',
    'ACTIONS: add these tags on a new line at the very end of your reply when they apply (the person never sees or hears them):',
    `- [[BOOKED: YYYY-MM-DDTHH:MM]] when the person agrees to a specific day and time (local ${tz} time, 24h clock). ${
      opts.mode === 'reschedule' ? 'This moves their existing appointment.' : ''
    }`,
    '- [[VIDEO]] together with BOOKED if they want a video call instead of in person.',
    '- [[TRANSFER]] when the person asks for a real person or is upset.',
    '- [[OPTOUT]] when they ask not to be contacted again.',
    opts.channel === 'voice' ? '- [[END]] when the conversation is finished and you have said goodbye.' : null,
  ];
  return lines.filter(l => l !== null).join('\n').replace(/\n{3,}/g, '\n\n');
}

export function businessHourLabel(h: number) {
  return hourLabel(h);
}
