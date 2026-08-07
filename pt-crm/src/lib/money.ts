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
  if (cents > 99_999_999) throw new Error("Amount too large");
  return cents;
}

export function formatMoney(cents: number, currency = "SGD"): string {
  const major = (Math.max(0, cents) / 100).toFixed(2);
  return `${currency} ${major}`;
}
