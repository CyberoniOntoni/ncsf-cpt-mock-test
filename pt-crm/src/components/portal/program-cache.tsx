"use client";

import { useEffect } from "react";

const KEY_PREFIX = "floorscribe.portal.program";
const CACHE_VERSION = 2;

function storageKey(ownerKey?: string | null) {
  const owner = (ownerKey || "").trim().toLowerCase();
  return owner ? `${KEY_PREFIX}.${owner}` : KEY_PREFIX;
}

function isShapedProgram(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;
  const days = (payload as { days?: unknown }).days;
  if (!Array.isArray(days) || !days[0] || typeof days[0] !== "object") {
    return false;
  }
  return Array.isArray((days[0] as { blocks?: unknown }).blocks);
}

export function cachePortalProgram(payload: unknown, ownerKey?: string) {
  try {
    localStorage.setItem(
      storageKey(ownerKey),
      JSON.stringify({ v: CACHE_VERSION, at: Date.now(), payload })
    );
  } catch {
    // ignore quota
  }
}

export function readCachedPortalProgram<T>(ownerKey?: string): T | null {
  try {
    const raw = localStorage.getItem(storageKey(ownerKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { v?: unknown; payload?: unknown };
    if (parsed?.v !== CACHE_VERSION) return null;
    if (!isShapedProgram(parsed.payload)) return null;
    return parsed.payload as T;
  } catch {
    return null;
  }
}

/** Client-only: server logout cannot touch localStorage. */
export function clearPortalProgramCache() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(KEY_PREFIX)) keys.push(k);
    }
    for (const k of keys) localStorage.removeItem(k);
  } catch {
    // ignore
  }
}

export function PortalProgramCache({
  data,
  ownerKey,
}: {
  data: unknown;
  ownerKey?: string;
}) {
  useEffect(() => {
    cachePortalProgram(data, ownerKey);
  }, [data, ownerKey]);
  return null;
}
