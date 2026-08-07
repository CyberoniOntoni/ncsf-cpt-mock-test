"use client";

import { CHECK_IN_TEMPLATES } from "@/lib/crm-constants";
import { cn } from "@/lib/utils";

/**
 * One-tap stubs for between-session messages.
 * Fills the check-in note field — does not send SMS/WhatsApp.
 */
export function CheckInTemplates({
  onPick,
  disabled,
  className,
}: {
  onPick: (body: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn("flex flex-wrap gap-1.5", className)}
      role="group"
      aria-label="Message templates"
    >
      {CHECK_IN_TEMPLATES.map((t) => (
        <button
          key={t.id}
          type="button"
          disabled={disabled}
          title={t.body}
          onClick={() => onPick(t.body)}
          className={cn(
            "min-h-8 rounded-full border border-zinc-800 bg-zinc-950/50 px-2.5 py-1 text-[11px] font-medium text-zinc-400 transition",
            "hover:border-zinc-600 hover:text-zinc-200",
            "disabled:opacity-50"
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
