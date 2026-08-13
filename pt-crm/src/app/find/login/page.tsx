"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { loginSeekerAction } from "@/app/actions/marketplace-seeker";

export default function FindLoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <main className="mx-auto max-w-md space-y-4 px-4 py-10 text-zinc-100">
      <p className="text-xs uppercase tracking-wide text-zinc-500">
        Client account
      </p>
      <h1 className="text-2xl font-semibold">Log in</h1>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setPending(true);
          setError(null);
          const fd = new FormData(e.currentTarget);
          const result = await loginSeekerAction({
            email: String(fd.get("email") || ""),
            password: String(fd.get("password") || ""),
          });
          setPending(false);
          if (!result.ok) setError(result.error);
          else router.push("/find/account");
        }}
      >
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
          placeholder="Password"
          className="min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3"
        />
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 w-full rounded-lg bg-emerald-800 font-semibold text-stone-50 disabled:opacity-60"
        >
          {pending ? "Signing in…" : "Log in"}
        </button>
        {error ? <p className="text-sm text-amber-400">{error}</p> : null}
      </form>
      <p className="text-sm text-zinc-500">
        New here?{" "}
        <Link href="/find/register" className="text-emerald-400">
          Create an account
        </Link>
      </p>
    </main>
  );
}
