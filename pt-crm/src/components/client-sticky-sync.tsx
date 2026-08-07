"use client";

import { useEffect } from "react";
import {
  getStoredActiveClient,
  setStoredActiveClient,
} from "@/lib/active-client";

/** Sets the global sticky client when viewing a profile — only when different. */
export function ClientStickySync({
  clientId,
  name,
}: {
  clientId: string;
  name: string;
}) {
  useEffect(() => {
    const nextName = name.trim();
    const current = getStoredActiveClient();
    if (current?.id === clientId) {
      // Same client: update display name only if it changed / was missing
      if (nextName && current.name !== nextName) {
        setStoredActiveClient(clientId, nextName);
      }
      return;
    }
    setStoredActiveClient(clientId, nextName || name);
  }, [clientId, name]);
  return null;
}
