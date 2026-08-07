"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BookOpen,
  ClipboardList,
  Dumbbell,
  History,
  Home,
  LogOut,
  Menu,
  Settings,
  Timer,
  Users,
  X,
} from "lucide-react";
import { setStoredActiveClient } from "@/lib/active-client";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/app/actions/auth";
import { StickyClientChip } from "./sticky-client-chip";

const nav = [
  { href: "/", label: "Home", icon: Home },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/programs", label: "Programs", icon: ClipboardList },
  { href: "/sessions", label: "Sessions", icon: Timer },
  { href: "/library", label: "Library", icon: Dumbbell },
  { href: "/history", label: "History", icon: History },
  { href: "/knowledge", label: "Knowledge", icon: BookOpen },
  { href: "/settings", label: "Settings", icon: Settings },
];

/** Bottom bar — design system floor order: Home · Clients · Sessions · Programs */
const mobilePrimary = [
  { href: "/", label: "Home", icon: Home },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/sessions", label: "Sessions", icon: Timer },
  { href: "/programs", label: "Programs", icon: ClipboardList },
];

/** True when this nav item should appear active for the current path. */
function isNavActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  if (pathname === href) return true;
  if (!pathname.startsWith(`${href}/`)) return false;
  // Prefer the longest matching top-level segment so nested routes
  // (e.g. /clients/[id]/assessments, /library/equipment, /sessions/[id]) highlight correctly.
  return true;
}

function NavLinks({
  pathname,
  onNavigate,
  compact,
}: {
  pathname: string;
  onNavigate?: () => void;
  compact?: boolean;
}) {
  return (
    <>
      {nav.map((item) => {
        const active = isNavActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50",
              active
                ? "bg-emerald-600/15 font-medium text-emerald-300"
                : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100",
              compact && "justify-center px-2"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            <span className={cn(compact && "sr-only")}>{item.label}</span>
          </Link>
        );
      })}
    </>
  );
}

export function AppShell({
  children,
  userName,
  orgName,
}: {
  children: React.ReactNode;
  userName: string;
  orgName: string;
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Escape closes drawer
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  // Lock body scroll when drawer open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  return (
    <div className="flex min-h-dvh bg-zinc-950 text-zinc-100">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950/95 backdrop-blur md:flex">
        <div className="border-b border-zinc-800 px-4 py-4">
          <div className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
            PT CRM
          </div>
          <div className="mt-1 truncate text-sm font-medium text-zinc-100">
            {orgName}
          </div>
          <div className="truncate text-xs text-zinc-500">{userName}</div>
        </div>
        <div className="border-b border-zinc-800 px-2 py-2">
          <StickyClientChip />
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2" aria-label="Main">
          <NavLinks pathname={pathname} />
        </nav>
        <form
          action={logoutAction}
          onSubmit={() => setStoredActiveClient(null)}
          className="border-t border-zinc-800 p-2"
        >
          <button
            type="submit"
            className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Sign out
          </button>
        </form>
      </aside>

      {/* Mobile drawer backdrop */}
      {drawerOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[min(18rem,85vw)] flex-col border-r border-zinc-800 bg-zinc-950 shadow-xl transition-transform duration-200 md:hidden",
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        )}
        aria-hidden={!drawerOpen}
      >
        <div className="flex items-start justify-between border-b border-zinc-800 px-4 py-4">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
              PT CRM
            </div>
            <div className="mt-1 truncate text-sm font-medium">{orgName}</div>
            <div className="truncate text-xs text-zinc-500">{userName}</div>
          </div>
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="border-b border-zinc-800 px-2 py-2">
          <StickyClientChip />
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2" aria-label="Main">
          <NavLinks pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
        </nav>
        <form
          action={logoutAction}
          onSubmit={() => setStoredActiveClient(null)}
          className="border-t border-zinc-800 p-2"
        >
          <button
            type="submit"
            className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Sign out
          </button>
        </form>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header
          data-shell-mobile-header
          className="sticky top-0 z-30 flex items-center gap-2 border-b border-zinc-800 bg-zinc-950/90 px-3 py-2 backdrop-blur md:hidden"
        >
          <button
            type="button"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-zinc-300 hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            aria-expanded={drawerOpen}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-zinc-100">
              PT CRM
            </div>
            <div className="truncate text-[11px] text-zinc-500">{orgName}</div>
          </div>
          <StickyClientChip compact className="max-w-[42%]" />
        </header>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
          {children}
        </main>

        {/* Mobile bottom nav — ≥44px touch targets */}
        <nav
          className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-800 bg-zinc-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
          aria-label="Primary"
        >
          <div className="grid grid-cols-5 gap-0.5 px-1 py-1">
            {mobilePrimary.map((item) => {
              const active = isNavActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-inset",
                    active
                      ? "bg-emerald-600/10 text-emerald-300"
                      : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-5 w-5",
                      active && "text-emerald-400"
                    )}
                    aria-hidden
                  />
                  {item.label}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-medium text-zinc-500 hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-inset"
              aria-label="Open more navigation"
            >
              <Menu className="h-5 w-5" aria-hidden />
              More
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
}
