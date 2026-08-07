"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QuickAddClient } from "./quick-add-client";
import { Button } from "./ui";

export function ClientsPageActions() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col items-end gap-2">
      {!open ? (
        <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
          Quick add
        </Button>
      ) : (
        <div className="w-full min-w-[280px] sm:min-w-[360px]">
          <QuickAddClient
            defaultOpen
            onCreated={(c) => {
              setOpen(false);
              router.push(`/clients/${c.clientId}`);
              router.refresh();
            }}
          />
        </div>
      )}
    </div>
  );
}
