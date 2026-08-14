/**
 * Outbound email adapter.
 * Default / MOCK_EMAIL=true: log only (dev + smoke).
 * No SES SDK: without mock there is no working transport → delivered false.
 */

export type OutboundEmail = {
  to: string;
  subject: string;
  text: string;
};

export type SendEmailResult = { delivered: boolean };

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

export async function sendEmail(msg: OutboundEmail): Promise<SendEmailResult> {
  recent.push(msg);
  if (recent.length > 50) recent.shift();

  if (isMockEmail()) {
    // Never log message body (may contain OTP) in production.
    if (process.env.NODE_ENV === "production") {
      console.info(`[email:mock] to=${msg.to} subject=${msg.subject} (body omitted)`);
    } else {
      console.info(`[email:mock] to=${msg.to} subject=${msg.subject}\n${msg.text}`);
    }
    return { delivered: true };
  }

  const from = process.env.AWS_SES_FROM || "";
  if (!from) {
    console.info(`[email:no-transport] missing AWS_SES_FROM; to=${msg.to}`);
    return { delivered: false };
  }

  // SES package is intentionally not a dependency; treat as undelivered.
  console.warn(
    "[email] SES package is not installed. Set MOCK_EMAIL=true or add @aws-sdk/client-ses."
  );
  console.info(`[email:no-transport] to=${msg.to} subject=${msg.subject}`);
  return { delivered: false };
}
