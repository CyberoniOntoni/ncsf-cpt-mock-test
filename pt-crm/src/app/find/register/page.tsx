"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { registerSeekerAction } from "@/app/actions/marketplace-seeker";

export default function FindRegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <main className="mx-auto max-w-md space-y-4 px-4 py-10 text-zinc-100">
      <p className="text-xs uppercase tracking-wide text-zinc-500">
        Client account
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
        <input
          name="firstName"
          required
          placeholder="First name"
          className="min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3"
        />
        <input
          name="lastName"
          placeholder="Last name"
          className="min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3"
        />
        <input
          name="email"
          type="email"
          required
          placeholder="Email"
          className="min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3"
        />
        <input
          name="password"
          type="password"
          required
          minLength={8}
          placeholder="Password (8+ characters)"
          className="min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3"
        />
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
    </main>
  );
}
