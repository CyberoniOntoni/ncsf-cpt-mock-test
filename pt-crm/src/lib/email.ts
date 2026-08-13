/**
 * Outbound email adapter.
 * Default / MOCK_EMAIL=true: log only (dev + smoke).
 * Optional AWS SES when AWS_SES_FROM is set (lazy import so SES is not a hard dep).
 */

export type OutboundEmail = {
  to: string;
  subject: string;
  text: string;
};

const recent: OutboundEmail[] = [];

export function isMockEmail(): boolean {
  if (process.env.MOCK_EMAIL === "false") return false;
  if (process.env.MOCK_EMAIL === "true") return true;
  return process.env.NODE_ENV !== "production" || !process.env.AWS_SES_FROM;
}

export function getRecentEmails(): OutboundEmail[] {
  return [...recent];
}

export function peekLastEmailTo(to: string): OutboundEmail | undefined {
  const want = to.toLowerCase();
  for (let i = recent.length - 1; i >= 0; i--) {
    if (recent[i].to.toLowerCase() === want) return recent[i];
  }
  return undefined;
}

export async function sendEmail(msg: OutboundEmail): Promise<void> {
  recent.push(msg);
  if (recent.length > 50) recent.shift();

  if (isMockEmail()) {
    console.info(`[email:mock] to=${msg.to} subject=${msg.subject}\n${msg.text}`);
    return;
  }

  const from = process.env.AWS_SES_FROM || "";
  if (!from) {
    console.info(`[email:mock-fallback] missing AWS_SES_FROM; to=${msg.to}`);
    return;
  }

  console.warn(
    "[email] SES package is not installed. Set MOCK_EMAIL=true or add @aws-sdk/client-ses. Logged instead."
  );
  console.info(`[email:queued] to=${msg.to} subject=${msg.subject}`);
}
