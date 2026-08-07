/**
 * Sticky workspace client — survives nav to Programs / Sessions / etc.
 * Cleared only when the PT clears the client (or on logout).
 * Design system Phase 2: global chip in AppShell + home workspace.
 */

const STORAGE_KEY = "floorscribe:activeClientId";
const STORAGE_NAME_KEY = "floorscribe:activeClientName";
const LEGACY_STORAGE_KEY = "ptcrm:activeClientId";
const LEGACY_STORAGE_NAME_KEY = "ptcrm:activeClientName";
/** Same-tab listeners (storage event only fires across tabs). */
export const ACTIVE_CLIENT_EVENT = "floorscribe:active-client";

export type StoredActiveClient = {
  id: string;
  name: string | null;
};

function emitActiveClientChange() {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new Event(ACTIVE_CLIENT_EVENT));
  } catch {
    // ignore
  }
}

function readStorage(primary: string, legacy: string): string | null {
  try {
    const v = window.localStorage.getItem(primary);
    if (v && v.trim()) return v.trim();
    const old = window.localStorage.getItem(legacy);
    if (old && old.trim()) {
      // One-time migrate from pre-rebrand keys
      try {
        window.localStorage.setItem(primary, old.trim());
        window.localStorage.removeItem(legacy);
      } catch {
        // ignore
      }
      return old.trim();
    }
    return null;
  } catch {
    return null;
  }
}

export function getStoredActiveClientId(): string | null {
  if (typeof window === "undefined") return null;
  return readStorage(STORAGE_KEY, LEGACY_STORAGE_KEY);
}

export function getStoredActiveClientName(): string | null {
  if (typeof window === "undefined") return null;
  return readStorage(STORAGE_NAME_KEY, LEGACY_STORAGE_NAME_KEY);
}

export function getStoredActiveClient(): StoredActiveClient | null {
  const id = getStoredActiveClientId();
  if (!id) return null;
  return { id, name: getStoredActiveClientName() };
}

export function setStoredActiveClientId(clientId: string | null): void {
  setStoredActiveClient(clientId, null);
}

/** Set sticky client id + display name for shell chip. */
export function setStoredActiveClient(
  clientId: string | null,
  name?: string | null
): void {
  if (typeof window === "undefined") return;
  try {
    if (clientId) {
      window.localStorage.setItem(STORAGE_KEY, clientId.trim());
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      if (name != null && String(name).trim()) {
        window.localStorage.setItem(STORAGE_NAME_KEY, String(name).trim());
        window.localStorage.removeItem(LEGACY_STORAGE_NAME_KEY);
      }
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(STORAGE_NAME_KEY);
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      window.localStorage.removeItem(LEGACY_STORAGE_NAME_KEY);
    }
    emitActiveClientChange();
  } catch {
    // private mode / quota — ignore
  }
}

/** Subscribe to sticky client changes (same tab + cross-tab). */
export function subscribeActiveClient(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (
      e.key === STORAGE_KEY ||
      e.key === STORAGE_NAME_KEY ||
      e.key === LEGACY_STORAGE_KEY ||
      e.key === LEGACY_STORAGE_NAME_KEY ||
      e.key === null
    ) {
      onChange();
    }
  };
  const onCustom = () => onChange();
  window.addEventListener("storage", onStorage);
  window.addEventListener(ACTIVE_CLIENT_EVENT, onCustom);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(ACTIVE_CLIENT_EVENT, onCustom);
  };
}

/** Keep browser URL in sync on home so refresh and shared links work. */
export function syncActiveClientUrl(clientId: string | null): void {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    if (url.pathname !== "/") return;
    if (clientId) {
      if (url.searchParams.get("client") === clientId) return;
      url.searchParams.set("client", clientId);
    } else {
      if (!url.searchParams.has("client")) return;
      url.searchParams.delete("client");
    }
    const qs = url.searchParams.toString();
    window.history.replaceState(
      {},
      "",
      qs ? `${url.pathname}?${qs}` : url.pathname
    );
  } catch {
    // ignore
  }
}
