"use client";

import { useFormStatus } from "react-dom";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { setStoredActiveClient } from "@/lib/active-client";
import { cn } from "@/lib/utils";

function SignOutSubmit({ className }: { className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 disabled:opacity-50",
        className
      )}
    >
      <LogOut className="h-4 w-4" aria-hidden />
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}

export function SignOutButton({ className }: { className?: string }) {
  return (
    <form
      action={logoutAction}
      onSubmit={() => setStoredActiveClient(null)}
      className="border-t border-zinc-800 p-2"
    >
      <SignOutSubmit className={className} />
    </form>
  );
}
