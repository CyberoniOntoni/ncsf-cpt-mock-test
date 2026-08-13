"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { registerSeekerAction } from "@/app/actions/marketplace-seeker";
import { SITE_COPY } from "@/lib/site/copy";

export default function FindRegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <main className="mx-auto max-w-md space-y-4">
      <p className="text-xs uppercase tracking-wide text-zinc-500">
        {SITE_COPY.findCta.label}
      </p>
      <h1 className="text-2xl font-semibold">Create your profile</h1>
      <p className="text-sm text-zinc-400">
        Save your gym, measurements, and see trainers where you train.
      </p>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setPending(true);
          setError(null);
          const fd = new FormData(e.currentTarget);
          const result = await registerSeekerAction({
            firstName: String(fd.get("firstName") || ""),
            lastName: String(fd.get("lastName") || ""),
            email: String(fd.get("email") || ""),
            password: String(fd.get("password") || ""),
          });
          setPending(false);
          if (!result.ok) setError(result.error);
          else router.push("/find/account");
        }}
      >
        <label className="block text-sm text-zinc-500">
          First name
          <input
            name="firstName"
            required
            autoComplete="given-name"
            className="mt-1 min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-zinc-100"
          />
        </label>
        <label className="block text-sm text-zinc-500">
          Last name
          <input
            name="lastName"
            autoComplete="family-name"
            className="mt-1 min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-zinc-100"
          />
        </label>
        <label className="block text-sm text-zinc-500">
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="mt-1 min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-zinc-100"
          />
        </label>
        <label className="block text-sm text-zinc-500">
          Password (8+ characters)
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="mt-1 min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-zinc-100"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 w-full rounded-lg bg-emerald-800 font-semibold text-stone-50 disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create account"}
        </button>
        {error ? <p className="text-sm text-amber-400">{error}</p> : null}
      </form>
      <p className="text-sm text-zinc-500">
        Already have an account?{" "}
        <Link href="/find/login" className="text-emerald-400">
          Log in
        </Link>
      </p>
      <p className="text-xs text-zinc-500">
        Trainer? <Link href="/login">Staff login</Link>
        {" · "}
        Assigned client? <Link href="/portal/login">Client portal</Link>
      </p>
    </main>
  );
}
