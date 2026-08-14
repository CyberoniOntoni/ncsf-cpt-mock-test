/**
 * Outbound email adapter.
 * Default / MOCK_EMAIL=true: log only (dev + smoke).
 * Production: Mailtrap Sending API when MAILTRAP_API_TOKEN is set.
 */

export type OutboundEmail = {
  to: string;
  subject: string;
  text: string;
  category?: string;
};

export type SendEmailResult = { delivered: boolean };

const recent: OutboundEmail[] = [];

const MAILTRAP_SEND_URL = "https://send.api.mailtrap.io/api/send";

export function mailtrapToken(): string {
  return (process.env.MAILTRAP_API_TOKEN || "").trim();
}

export function isMockEmail(): boolean {
  if (process.env.MOCK_EMAIL === "false") return false;
  if (process.env.MOCK_EMAIL === "true") return true;
  return process.env.NODE_ENV !== "production" || !mailtrapToken();
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

async function sendViaMailtrap(msg: OutboundEmail): Promise<SendEmailResult> {
  const token = mailtrapToken();
  const fromEmail = (
    process.env.MAILTRAP_FROM_EMAIL || "hello@floorscribe.com"
  ).trim();
  const fromName = (process.env.MAILTRAP_FROM_NAME || "FloorScribe").trim();
  if (!token || !fromEmail) {
    console.info(`[email:no-transport] missing Mailtrap token or from; to=${msg.to}`);
    return { delivered: false };
  }

  const url = (process.env.MAILTRAP_SEND_URL || MAILTRAP_SEND_URL).trim();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: { email: fromEmail, name: fromName },
      to: [{ email: msg.to }],
      subject: msg.subject,
      text: msg.text,
      category: msg.category || "FloorScribe",
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.warn(
      `[email:mailtrap] ${res.status} to=${msg.to} ${body.slice(0, 240)}`
    );
    return { delivered: false };
  }
  return { delivered: true };
}

export async function sendEmail(msg: OutboundEmail): Promise<SendEmailResult> {
  recent.push(msg);
  if (recent.length > 50) recent.shift();

  if (isMockEmail()) {
    if (process.env.NODE_ENV === "production") {
      console.info(`[email:no-transport] production mock is not delivery; to=${msg.to}`);
      return { delivered: false };
    }
    console.info(`[email:mock] to=${msg.to} subject=${msg.subject}\n${msg.text}`);
    return { delivered: true };
  }

  try {
    return await sendViaMailtrap(msg);
  } catch (err) {
    console.warn("[email:mailtrap] request failed", err);
    return { delivered: false };
  }
}
