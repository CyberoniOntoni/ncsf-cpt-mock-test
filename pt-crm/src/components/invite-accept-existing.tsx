"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { acceptInviteExistingAction } from "@/app/actions/auth";
import { Alert, Button } from "@/components/ui";

export function InviteAcceptExisting({
  token,
  orgName,
}: {
  token: string;
  orgName?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {error && <Alert tone="error">{error}</Alert>}
      <Button
        type="button"
        className="min-h-11 w-full"
        loading={pending}
        onClick={() => {
          setError(null);
          start(async () => {
            const res = await acceptInviteExistingAction(token);
            if ("error" in res && res.error) {
              setError(res.error);
              return;
            }
            router.push("/");
            router.refresh();
          });
        }}
      >
        {orgName ? `Accept and join ${orgName}` : "Accept invite"}
      </Button>
    </div>
  );
}
