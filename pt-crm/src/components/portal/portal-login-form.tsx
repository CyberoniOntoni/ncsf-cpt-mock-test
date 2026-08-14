"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  loginPortalPasswordAction,
  requestPortalOtpAction,
} from "@/app/actions/portal/auth";
import { Button, Input, Label } from "@/components/ui";
import { cn } from "@/lib/utils";

export function PortalLoginForm({
  redirectTo,
}: {
  redirectTo?: string;
}) {
  const [mode, setMode] = useState<"password" | "code">("password");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 rounded-xl border border-zinc-800 p-1">
        <button
          type="button"
          className={cn(
            "min-h-10 rounded-lg text-sm font-medium",
            mode === "password"
              ? "bg-emerald-800 text-stone-50"
              : "text-zinc-400 hover:text-zinc-200"
          )}
          onClick={() => setMode("password")}
        >
          Password
        </button>
        <button
          type="button"
          className={cn(
            "min-h-10 rounded-lg text-sm font-medium",
            mode === "code"
              ? "bg-emerald-800 text-stone-50"
              : "text-zinc-400 hover:text-zinc-200"
          )}
          onClick={() => setMode("code")}
        >
          One-time code
        </button>
      </div>
      {mode === "password" ? (
        <PasswordForm redirectTo={redirectTo} />
      ) : (
        <OtpRequestForm redirectTo={redirectTo} />
      )}
    </div>
  );
}

function PasswordForm({ redirectTo }: { redirectTo?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        start(async () => {
          const res = await loginPortalPasswordAction({
            email: String(fd.get("email") || ""),
            password: String(fd.get("password") || ""),
          });
          if (!res.ok) {
            setError(res.error);
            return;
          }
          if (!res.profileComplete) {
            router.push("/portal/profile?setup=1");
            return;
          }
          router.push(redirectTo || "/portal/dashboard");
        });
      }}
    >
      <div>
        <Label htmlFor="portal-email">Email</Label>
        <Input
          id="portal-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@email.com"
        />
      </div>
      <div>
        <Label htmlFor="portal-password">Password</Label>
        <Input
          id="portal-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      {error && (
        <p className="text-sm text-red-300" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" loading={pending}>
        Sign in
      </Button>
    </form>
  );
}

function OtpRequestForm({ redirectTo }: { redirectTo?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [studios, setStudios] = useState<
    Array<{ organizationId: string; organizationName: string }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    setError(null);
    start(async () => {
      const res = await requestPortalOtpAction({
        email,
        organizationId: organizationId || null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if ("needsOrg" in res && res.needsOrg) {
        setStudios(res.studios);
        return;
      }
      if ("sent" in res && res.sent) {
        // organizationId is never returned (anti-enumeration). Multi-studio
        // clients already picked one; single-studio verify resolves org from OTP.
        const q = new URLSearchParams({ email });
        if (organizationId) q.set("org", organizationId);
        if (redirectTo) q.set("redirectTo", redirectTo);
        router.push(`/portal/login/verify?${q.toString()}`);
        return;
      }
      setError("Could not send a code");
    });
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div>
        <Label htmlFor="portal-otp-email">Email</Label>
        <Input
          id="portal-otp-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
        />
      </div>
      {studios.length > 0 && (
        <div>
          <Label htmlFor="portal-org">Studio</Label>
          <select
            id="portal-org"
            className="mt-1 min-h-11 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm"
            value={organizationId}
            onChange={(e) => setOrganizationId(e.target.value)}
            required
          >
            <option value="">Choose your studio</option>
            {studios.map((s) => (
              <option key={s.organizationId} value={s.organizationId}>
                {s.organizationName}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-zinc-500">
            Same email can belong to more than one trainer — pick who you are
            training with today.
          </p>
        </div>
      )}
      {error && (
        <p className="text-sm text-red-300" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" loading={pending}>
        Send code
      </Button>
    </form>
  );
}
