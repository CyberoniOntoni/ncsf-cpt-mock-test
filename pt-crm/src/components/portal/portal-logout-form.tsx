"use client";

import { logoutPortalAction } from "@/app/actions/portal/auth";
import { clearPortalProgramCache } from "@/components/portal/program-cache";
import { Button } from "@/components/ui";

export function PortalLogoutForm() {
  return (
    <form
      action={async () => {
        clearPortalProgramCache();
        await logoutPortalAction();
      }}
    >
      <Button type="submit" variant="ghost" className="w-full">
        Sign out
      </Button>
    </form>
  );
}
