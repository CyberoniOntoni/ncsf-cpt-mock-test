"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestPortalOtpAction } from "@/app/actions/portal/auth";
import { Button, Input, Label } from "@/components/ui";

export function PortalLoginForm({
  redirectTo,
}: {
  redirectTo?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [studios, setStudios] = useState<
    Array<{ organizationId: string; organizationName: string; firstName: string }>
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
      if (!("organizationId" in res)) {
        setError("Could not send a code");
        return;
      }
      const q = new URLSearchParams({
        email,
        org: res.organizationId,
      });
      if (redirectTo) q.set("redirectTo", redirectTo);
      router.push(`/portal/login/verify?${q.toString()}`);
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
        <Label htmlFor="portal-email">Email</Label>
        <Input
          id="portal-email"
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
            Same email can belong to more than one trainer later — pick who you
            are training with today.
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
