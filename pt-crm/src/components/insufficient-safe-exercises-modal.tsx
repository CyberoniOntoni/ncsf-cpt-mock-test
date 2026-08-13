"use client";

import { Button } from "./ui";

export function parseInsufficientSafeMessage(message: string): {
  pattern: string;
  secondary: string[];
} | null {
  if (!message.startsWith("INSUFFICIENT_SAFE_EXERCISES:")) return null;
  const rest = message.slice("INSUFFICIENT_SAFE_EXERCISES:".length);
  const [pattern, extras] = rest.split(":");
  return {
    pattern: pattern || "a movement pattern",
    secondary: extras ? extras.split(",").filter(Boolean) : [],
  };
}

export function InsufficientSafeExercisesModal({
  open,
  pattern,
  secondary,
  onClose,
}: {
  open: boolean;
  pattern: string;
  secondary: string[];
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="insufficient-safe-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-amber-900/50 bg-zinc-950 p-4 shadow-xl">
        <h2
          id="insufficient-safe-title"
          className="text-sm font-semibold text-amber-100"
        >
          Not enough safe exercises
        </h2>
        <p className="mt-2 text-sm leading-snug text-zinc-400">
          The generator could not fill{" "}
          <span className="font-medium text-zinc-200">
            {pattern.replace(/_/g, " ")}
          </span>{" "}
          without violating this client’s safety gates
          {secondary.length
            ? ` (also tried ${secondary.map((p) => p.replace(/_/g, " ")).join(", ")})`
            : ""}
          .
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-zinc-500">
          <li>Unlock more equipment in Library, or add client home gear.</li>
          <li>Review injuries / contraindications if they are over-broad.</li>
          <li>Or start from scratch and pick exercises yourself.</li>
        </ul>
        <div className="mt-4 flex justify-end">
          <Button type="button" size="sm" onClick={onClose}>
            Got it
          </Button>
        </div>
      </div>
    </div>
  );
}
