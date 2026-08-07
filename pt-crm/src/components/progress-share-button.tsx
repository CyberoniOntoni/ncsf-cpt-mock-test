"use client";

import { useState, useTransition } from "react";
import type { ClientProgressData } from "@/app/actions/progress";
import { buildClientProgressShareText } from "@/lib/progress-share";
import { Button } from "./ui";
import { Copy } from "lucide-react";

/** Desk: copy client progress as plain text for WhatsApp / notes. */
export function ProgressShareButton({ data }: { data: ClientProgressData }) {
  const [flash, setFlash] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function copy() {
    startTransition(async () => {
      const text = buildClientProgressShareText(data);
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
          setFlash("Progress copied");
        } else {
          setFlash("Copy unavailable");
        }
      } catch {
        setFlash("Copy failed");
      }
      window.setTimeout(() => setFlash(null), 2200);
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      {flash && (
        <span role="status" className="text-[11px] font-medium text-emerald-400">
          {flash}
        </span>
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        loading={pending}
        onClick={copy}
        className="min-h-9 text-zinc-400"
        aria-label="Copy progress snapshot for sharing"
      >
        <Copy className="h-3.5 w-3.5" aria-hidden />
        Copy
      </Button>
    </span>
  );
}
