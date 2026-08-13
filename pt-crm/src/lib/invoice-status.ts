export type InvoiceStatus = "unpaid" | "paid" | "void" | "overdue";

export function getEffectiveInvoiceStatus(row: {
  status: string;
  dueAt?: Date | string | null;
  paidAt?: Date | string | null;
}): InvoiceStatus {
  const status = (row.status || "unpaid").toLowerCase();
  if (status === "paid" || status === "void") return status;
  if (status !== "unpaid") return "unpaid";
  if (!row.dueAt) return "unpaid";
  const due = new Date(row.dueAt).getTime();
  if (!Number.isFinite(due)) return "unpaid";
  return due < Date.now() ? "overdue" : "unpaid";
}
