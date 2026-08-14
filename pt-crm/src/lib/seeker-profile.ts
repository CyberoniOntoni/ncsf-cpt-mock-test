export type SeekerLocationPrefs = {
  preferredArea: string | null;
};

/** Search is allowed only after the seeker tells us where they train. */
export function isSeekerProfileComplete(
  seeker: SeekerLocationPrefs
): boolean {
  return Boolean(seeker.preferredArea?.trim());
}

/** Keep post-login next on the client portal (and legacy /find URLs). */
export function safeSeekerNext(raw: string | null | undefined): string {
  const value = (raw || "").trim();
  if (!value.startsWith("/") || value.startsWith("//")) return "/portal";
  if (value.startsWith("/portal/login") || value.startsWith("/portal/register")) {
    return "/portal";
  }
  if (value.startsWith("/portal")) return value;
  if (value === "/find" || value.startsWith("/find?")) {
    return `/portal/find${value.includes("?") ? value.slice(value.indexOf("?")) : ""}`;
  }
  if (value.startsWith("/find/login") || value.startsWith("/find/register")) {
    return "/portal";
  }
  if (value.startsWith("/find/account")) return "/portal/profile";
  if (value.startsWith("/find/")) {
    return `/portal/find/${value.slice("/find/".length)}`;
  }
  return "/portal";
}
