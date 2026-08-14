"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  Dumbbell,
  Handshake,
  History,
  Home,
  LayoutGrid,
  Menu,
  IdCard,
  Settings,
  Timer,
  Users,
  X,
} from "lucide-react";
import {
  MOBILE_PRIMARY,
  NAV_AREAS,
  isAreaActive,
  isLeafActive,
  type NavArea,
} from "@/lib/nav";
import { cn } from "@/lib/utils";
import { BrandMark } from "./brand-mark";
import { SignOutButton } from "./sign-out-button";
import { StickyClientChip } from "./sticky-client-chip";

const AREA_ICONS = {
  today: Home,
  people: Users,
  plans: ClipboardList,
  studio: LayoutGrid,
} as const;

const LEAF_ICONS: Record<string, typeof Home> = {
  "/clients": Users,
  "/calendar": CalendarDays,
  "/intros": Handshake,
  "/card": IdCard,
  "/programs": ClipboardList,
  "/sessions": Timer,
  "/library": Dumbbell,
  "/knowledge": BookOpen,
  "/history": History,
  "/settings": Settings,
};

function AreaNav({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      {NAV_AREAS.map((area) => {
        const areaActive = isAreaActive(pathname, area);
        const children = area.children;
        const childActive =
          children?.some((leaf) => isLeafActive(pathname, leaf)) ?? false;
        // Parent wash only when this area is active and no child owns the route
        // (or area has no children). Avoid double emerald on People + Clients.
        const parentStrong = areaActive && !childActive;
        const parentSoft = areaActive && childActive;
        const Icon = AREA_ICONS[area.id];
        return (
          <div key={area.id} className="pb-1">
            <Link
              href={area.href}
              onClick={onNavigate}
              aria-current={parentStrong ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50",
                parentStrong &&
                  "bg-emerald-600/15 font-medium text-emerald-300",
                parentSoft && "font-medium text-emerald-400/90",
                !areaActive &&
                  "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span>{area.label}</span>
            </Link>
            {children && children.length > 0 && (
              <div
                className="mt-0.5 ml-3 space-y-0.5 border-l border-zinc-800/80 pl-2"
                role="group"
                aria-label={`${area.label} links`}
              >
                {children.map((leaf) => {
                  const leafActive = isLeafActive(pathname, leaf);
                  const LeafIcon = LEAF_ICONS[leaf.href];
                  return (
                    <Link
                      key={leaf.href}
                      href={leaf.href}
                      onClick={onNavigate}
                      aria-current={leafActive ? "page" : undefined}
                      className={cn(
                        "flex min-h-11 items-center gap-2 rounded-md px-2.5 py-2 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 sm:min-h-10",
                        leafActive
                          ? "bg-emerald-600/12 font-medium text-emerald-300"
                          : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200"
                      )}
                    >
                      {LeafIcon && (
                        <LeafIcon
                          className="h-3.5 w-3.5 shrink-0 opacity-80"
                          aria-hidden
                        />
                      )}
                      {leaf.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function mobileAreaActive(pathname: string, href: string): boolean {
  const area = NAV_AREAS.find((a) => a.href === href);
  if (!area) return false;
  return isAreaActive(pathname, area);
}

export function AppShell({
  children,
  userName,
  userTitle,
  orgName,
  emailVerified = true,
}: {
  children: React.ReactNode;
  userName: string;
  /** Optional credentials (e.g. NCSF-CPT) under the name */
  userTitle?: string | null;
  orgName: string;
  emailVerified?: boolean;
}) {
  const userLine = userTitle?.trim()
    ? `${userName} · ${userTitle.trim()}`
    : userName;
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

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

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  return (
    <div className="flex min-h-dvh bg-zinc-950 text-zinc-100">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950/95 backdrop-blur md:flex">
        <div className="border-b border-zinc-800 px-4 py-4">
          <BrandMark href="/" />
          <div className="mt-0.5 truncate text-sm font-medium text-zinc-100">
            {orgName}
          </div>
          <div className="truncate text-xs text-zinc-500" title={userLine}>
            {userLine}
          </div>
        </div>
        <div className="border-b border-zinc-800 px-2 py-2">
          <StickyClientChip />
        </div>
        <nav
          className="flex flex-1 flex-col overflow-y-auto p-2"
          aria-label="Main"
        >
          <AreaNav pathname={pathname} />
        </nav>
        <SignOutButton />
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

      {/* Mobile drawer — full area tree */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[min(18rem,85vw)] flex-col border-r border-zinc-800 bg-zinc-950 shadow-xl transition-transform duration-200 md:hidden",
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        )}
        id="mobile-nav-drawer"
        role="dialog"
        aria-modal={drawerOpen}
        aria-label="Navigation menu"
        aria-hidden={!drawerOpen}
        inert={!drawerOpen ? true : undefined}
      >
        <div className="flex items-start justify-between border-b border-zinc-800 px-4 py-4">
          <div className="min-w-0">
            <BrandMark href="/" onNavigate={() => setDrawerOpen(false)} />
            <div className="mt-0.5 truncate text-sm font-medium">{orgName}</div>
            <div className="truncate text-xs text-zinc-500" title={userLine}>
              {userLine}
            </div>
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
        <nav
          className="flex flex-1 flex-col overflow-y-auto p-2"
          aria-label="Main"
        >
          <AreaNav
            pathname={pathname}
            onNavigate={() => setDrawerOpen(false)}
          />
        </nav>
        <SignOutButton />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
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
            aria-controls="mobile-nav-drawer"
            aria-haspopup="dialog"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <BrandMark href="/" className="truncate" />
            <div className="truncate text-[11px] text-zinc-500">{orgName}</div>
          </div>
          <StickyClientChip compact className="max-w-[42%]" />
        </header>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
          {!emailVerified ? (
            <div
              role="status"
              className="border-b border-amber-900/50 bg-amber-950/30 px-4 py-2 text-sm text-amber-100"
            >
              Verify your email to publish your card and invite teammates.{" "}
              <Link href="/verify-email" className="font-medium underline">
                Verify email
              </Link>
            </div>
          ) : null}
          {children}
        </main>

        {/* Mobile: four areas only — no More */}
        <nav
          className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-800 bg-zinc-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
          aria-label="Primary"
        >
          <div className="grid grid-cols-4 gap-0.5 px-1 py-1">
            {MOBILE_PRIMARY.map((item) => {
              const active = mobileAreaActive(pathname, item.href);
              const area = NAV_AREAS.find((a) => a.id === item.id) as NavArea;
              const Icon = AREA_ICONS[area.id];
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
                    className={cn("h-5 w-5", active && "text-emerald-400")}
                    aria-hidden
                  />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
