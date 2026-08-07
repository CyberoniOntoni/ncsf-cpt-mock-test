/**
 * FloorScribe information architecture — 4 primary areas.
 * Secondary routes hang under an area (not top-level peers).
 */

export type NavLeaf = {
  href: string;
  label: string;
  /** Path prefixes that count as active for this leaf (defaults to href) */
  match?: string[];
};

export type NavArea = {
  id: "today" | "people" | "plans" | "studio";
  href: string;
  label: string;
  /** Prefixes that light this area as active */
  match: string[];
  children?: NavLeaf[];
};

export const NAV_AREAS: NavArea[] = [
  {
    id: "today",
    href: "/",
    label: "Today",
    match: ["/"],
  },
  {
    id: "people",
    href: "/clients",
    label: "People",
    match: ["/clients", "/calendar"],
    children: [
      { href: "/clients", label: "Clients" },
      { href: "/calendar", label: "Calendar" },
    ],
  },
  {
    id: "plans",
    href: "/programs",
    label: "Plans",
    match: ["/programs", "/sessions"],
    children: [
      { href: "/programs", label: "Programs" },
      { href: "/sessions", label: "Sessions" },
    ],
  },
  {
    id: "studio",
    href: "/studio",
    label: "Studio",
    match: ["/studio", "/library", "/knowledge", "/history", "/settings"],
    children: [
      {
        href: "/library",
        label: "Library",
        match: ["/library"],
      },
      { href: "/knowledge", label: "Knowledge" },
      { href: "/history", label: "Coach history" },
      { href: "/settings", label: "Settings" },
    ],
  },
];

/** Mobile bottom bar = the four areas only */
export const MOBILE_PRIMARY = NAV_AREAS.map((a) => ({
  href: a.href,
  label: a.label,
  id: a.id,
}));

function pathMatches(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (pathname === href) return true;
  return pathname.startsWith(`${href}/`);
}

export function isLeafActive(pathname: string, leaf: NavLeaf): boolean {
  const prefixes = leaf.match ?? [leaf.href];
  return prefixes.some((p) => pathMatches(pathname, p));
}

export function isAreaActive(pathname: string, area: NavArea): boolean {
  return area.match.some((p) => pathMatches(pathname, p));
}

export function areaForPath(pathname: string): NavArea | null {
  // Prefer non-Today matches first so / never steals everything
  for (const area of NAV_AREAS) {
    if (area.id === "today") continue;
    if (isAreaActive(pathname, area)) return area;
  }
  if (pathname === "/") return NAV_AREAS[0]!;
  return null;
}
