"use client";

import { useEffect } from "react";

const KEY = "floorscribe.portal.program";

export function cachePortalProgram(payload: unknown) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), payload }));
  } catch {
    // ignore quota
  }
}

export function readCachedPortalProgram<T>(): T | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw).payload as T;
  } catch {
    return null;
  }
}

export function PortalProgramCache({ data }: { data: unknown }) {
  useEffect(() => {
    cachePortalProgram(data);
  }, [data]);
  return null;
}
