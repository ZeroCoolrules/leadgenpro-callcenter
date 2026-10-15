export interface ComplianceCheckResult {
  isBlocked: boolean;
  isOptOut: boolean;
  isOptIn: boolean;
  reason?: string;
  autoReply?: string;
}

const OPT_OUT_KEYWORDS = new Set([
  'STOP',
  'STOPALL',
  'UNSUBSCRIBE',
  'CANCEL',
  'END',
  'QUIT',
]);

const OPT_IN_KEYWORDS = new Set([
  'START',
  'UNSTOP',
  'RESUBSCRIBE',
  'YES',
]);

const BLOCKED_WORDS = [
  'wire transfer gift card',
  'send bitcoin now',
  'ssn verification',
  'western union moneygram',
  'casino hack',
  'free ropux',
  'guaranteed 1000% return',
  'illegal narcotics',
];

export function checkMessageCompliance(text: string): ComplianceCheckResult {
  const normalized = text.trim().toUpperCase();

  // Check 1: Direct single keyword or starting word for Opt-Out
  if (OPT_OUT_KEYWORDS.has(normalized)) {
    return {
      isBlocked: true,
      isOptOut: true,
      isOptIn: false,
      reason: `TCPA Opt-Out keyword recognized: ${normalized}`,
      autoReply: 'You have successfully been unsubscribed. You will not receive any more automated messages from this number. Reply START at any time to resubscribe.',
    };
  }

  // Check 2: Opt-In keywords
  if (OPT_IN_KEYWORDS.has(normalized)) {
    return {
      isBlocked: false,
      isOptOut: false,
      isOptIn: true,
      reason: `TCPA Resubscription keyword recognized: ${normalized}`,
      autoReply: 'Welcome back! You have resubscribed to appointment updates and dispatch messaging. Reply STOP at any time to opt out.',
    };
  }

  // Check 3: Prohibited anti-spam & fraud phrases
  const lowerText = text.toLowerCase();
  for (const blocked of BLOCKED_WORDS) {
    if (lowerText.includes(blocked)) {
      return {
        isBlocked: true,
        isOptOut: false,
        isOptIn: false,
        reason: `Prohibited anti-spam/fraud filter triggered: contains "${blocked}"`,
        autoReply: 'Your message could not be processed due to carrier compliance security filters.',
      };
    }
  }

  // Check 4: Rate limit / abnormal length
  if (text.length > 1600) {
    return {
      isBlocked: true,
      isOptOut: false,
      isOptIn: false,
      reason: 'Message exceeds maximum allowable segment length (1600 characters)',
      autoReply: 'Message was too long to process. Please send a shorter message.',
    };
  }

  return {
    isBlocked: false,
    isOptOut: false,
    isOptIn: false,
  };
}

export const TCPA_DISCLAIMER = 'Msg & data rates may apply. Reply STOP to cancel, HELP for assistance.';
