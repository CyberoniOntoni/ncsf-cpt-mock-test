"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Dumbbell, LineChart, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/portal/dashboard", label: "Home", icon: CalendarDays },
  { href: "/portal/program", label: "Program", icon: Dumbbell },
  { href: "/portal/progress", label: "Progress", icon: LineChart },
  { href: "/portal/profile", label: "Profile", icon: UserRound },
];

export function PortalShell({
  studioName,
  children,
}: {
  studioName: string;
  children: React.ReactNode;
}) {
  const path = usePathname();
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <header className="sticky top-0 z-10 border-b border-zinc-800/80 bg-zinc-950/95 px-4 py-3 backdrop-blur">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          FloorScribe
        </p>
        <p className="truncate text-sm font-medium text-zinc-200">{studioName}</p>
      </header>
      <main className="flex-1 px-4 pb-24 pt-4">{children}</main>
      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-800 bg-zinc-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
        aria-label="Client portal"
      >
        <ul className="mx-auto flex max-w-lg">
          {TABS.map((tab) => {
            const active = path === tab.href || path.startsWith(tab.href + "/");
            const Icon = tab.icon;
            return (
              <li key={tab.href} className="flex-1">
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
                    active ? "text-emerald-400" : "text-zinc-500"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
