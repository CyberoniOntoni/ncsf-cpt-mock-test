/**
 * Minimal role checks for server actions.
 * Roles: owner | admin | trainer | front_desk (and any future labels).
 */

function norm(role: string): string {
  return (role || "").trim().toLowerCase();
}

/** owner | admin | trainer — billing, invoices, pack adjust/cancel */
export function assertCanManageMoney(role: string): void {
  const r = norm(role);
  if (r !== "owner" && r !== "admin" && r !== "trainer") {
    throw new Error(
      "You do not have permission to manage billing or packages"
    );
  }
}

/** owner | admin | trainer — hard-delete records (e.g. sessions) */
export function assertCanDestroyRecords(role: string): void {
  const r = norm(role);
  if (r !== "owner" && r !== "admin" && r !== "trainer") {
    throw new Error("You do not have permission to permanently delete records");
  }
}

/** owner | admin — team membership / invites (non-admin) */
export function assertCanManageTeam(role: string): void {
  const r = norm(role);
  if (r !== "owner" && r !== "admin") {
    throw new Error("You do not have permission to manage the team");
  }
}

/** owner only — invite another admin */
export function assertCanInviteAdmin(role: string): void {
  const r = norm(role);
  if (r !== "owner") {
    throw new Error("Only the organization owner can invite admins");
  }
}
