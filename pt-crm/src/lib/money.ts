/** Money helpers (shared client/server — not server actions). */

/** Parse "120" or "120.50" → cents. */
export function parseMoneyToCents(raw: string): number {
  const s = raw.trim().replace(/,/g, "");
  if (!s) throw new Error("Amount is required");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) {
    throw new Error("Use a valid amount (e.g. 120 or 120.50)");
  }
  const [whole, frac = ""] = s.split(".");
  const cents = Number(whole) * 100 + Number((frac + "00").slice(0, 2));
  if (!Number.isFinite(cents) || cents < 0) throw new Error("Invalid amount");
  if (cents === 0) throw new Error("Amount must be greater than zero");
  if (cents > 99_999_999) throw new Error("Amount too large");
  return cents;
}

/**
 * Format minor units. `compact` drops trailing .00 for chips / summary strips.
 * e.g. compact: "SGD 600" · full: "SGD 600.00"
 */
export function formatMoney(
  cents: number,
  currency = "SGD",
  opts?: { compact?: boolean }
): string {
  const major = Math.max(0, cents) / 100;
  if (opts?.compact && Number.isInteger(major)) {
    return `${currency} ${major}`;
  }
  return `${currency} ${major.toFixed(2)}`;
}

/** Soft filter for amount fields — digits + one decimal, max 2 dp. */
export function sanitizeMoneyInput(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const dot = cleaned.indexOf(".");
  if (dot === -1) return cleaned.slice(0, 8);
  const whole = cleaned.slice(0, dot).slice(0, 8);
  const frac = cleaned
    .slice(dot + 1)
    .replace(/\./g, "")
    .slice(0, 2);
  return `${whole}.${frac}`;
}
