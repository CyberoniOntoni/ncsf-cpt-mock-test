"use client";

import { useState, useTransition } from "react";
import {
  requestPortalOtpAction,
  verifyPortalOtpAction,
} from "@/app/actions/portal/auth";
import { Button, Input, Label } from "@/components/ui";

export function PortalVerifyForm({
  email,
  organizationId,
  redirectTo,
}: {
  email: string;
  organizationId: string;
  redirectTo?: string;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    setError(null);
    start(async () => {
      const res = await verifyPortalOtpAction({
        email,
        organizationId,
        code,
        redirectTo,
      });
      if (res && !res.ok) setError(res.error);
    });
  }

  function resend() {
    setError(null);
    start(async () => {
      const res = await requestPortalOtpAction({ email, organizationId });
      if (!res.ok) setError(res.error);
      else setMsg("New code sent.");
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
        <Label htmlFor="otp">6-digit code</Label>
        <Input
          id="otp"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="000000"
          className="tracking-[0.4em]"
        />
        <p className="mt-1 text-[11px] text-zinc-500">Sent to {email}</p>
      </div>
      {error && (
        <p className="text-sm text-red-300" role="alert">
          {error}
        </p>
      )}
      {msg && <p className="text-sm text-emerald-300">{msg}</p>}
      <Button type="submit" className="w-full" loading={pending} disabled={code.length !== 6}>
        Continue
      </Button>
      <button
        type="button"
        className="w-full min-h-11 text-sm text-zinc-400 hover:text-zinc-200"
        onClick={resend}
        disabled={pending}
      >
        Resend code
      </button>
    </form>
  );
}
