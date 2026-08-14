"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { registerPortalAction } from "@/app/actions/portal/auth";
import { PublicSiteFooter } from "@/components/public-site-footer";
import { PublicSiteHeader } from "@/components/public-site-header";
import { SITE_COPY } from "@/lib/site/copy";

export default function PortalRegisterPage() {
  return (
    <Suspense>
      <PortalRegisterForm />
    </Suspense>
  );
}

function PortalRegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <div className="mkt-root min-h-dvh bg-[#12100e] text-stone-100">
      <PublicSiteHeader
        variant="portal"
        scrolled
        trailing={
          <Link
            href="/portal/login"
            className="inline-flex min-h-11 items-center rounded-lg px-2.5 text-sm text-stone-500 hover:text-stone-300"
          >
            Sign in
          </Link>
        }
      />
      <main className="mx-auto max-w-md space-y-4 px-4 py-10">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">
          {SITE_COPY.portalCta.label}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Create your account
        </h1>
        <p className="text-sm text-stone-400">
          One account for your plan and for finding a trainer. Tell us where you
          train after you sign up — then you can search.
        </p>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setPending(true);
            setError(null);
            const fd = new FormData(e.currentTarget);
            const result = await registerPortalAction({
              firstName: String(fd.get("firstName") || ""),
              lastName: String(fd.get("lastName") || ""),
              email: String(fd.get("email") || ""),
              password: String(fd.get("password") || ""),
            });
            setPending(false);
            if (!result.ok) setError(result.error);
            else router.push("/portal/profile?setup=1");
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
          <Link
            href={next ? `/portal/login?redirectTo=${encodeURIComponent(next)}` : "/portal/login"}
            className="text-emerald-400"
          >
            Sign in
          </Link>
        </p>
        <p className="text-xs text-zinc-500">
          Trainer? <Link href="/login">Staff login</Link>
        </p>
      </main>
      <PublicSiteFooter variant="portal" />
    </div>
  );
}
