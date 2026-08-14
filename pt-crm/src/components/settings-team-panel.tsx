"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Link2, UserPlus } from "lucide-react";
import {
  createInviteAction,
  revokeInviteAction,
} from "@/app/actions/auth";
import { Alert, Badge, Button, Input, Label, Select } from "@/components/ui";

type Member = {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  title: string | null;
  role: string;
};

type Invite = {
  id: string;
  email: string;
  role: string;
  token: string;
  expiresAt: Date | string;
};

function roleLabel(role: string) {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  if (role === "front_desk") return "Front desk";
  if (role === "trainer") return "Trainer";
  return role;
}

function invitePath(origin: string, token: string) {
  return `${origin.replace(/\/$/, "")}/invite/${token}`;
}

export function SettingsTeamPanel({
  members,
  invites,
  canManage,
  canInviteAdmin = false,
  appOrigin,
  currentUserId,
}: {
  members: Member[];
  invites: Invite[];
  canManage: boolean;
  /** Only owners may invite role=admin */
  canInviteAdmin?: boolean;
  appOrigin: string;
  currentUserId?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("trainer");
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(
    null
  );
  const [lastLink, setLastLink] = useState<string | null>(null);
  const [origin, setOrigin] = useState(appOrigin);

  // If admin option is hidden and role was admin, fall back to trainer
  useEffect(() => {
    if (!canInviteAdmin && role === "admin") {
      setRole("trainer");
    }
  }, [canInviteAdmin, role]);

  // Prefer live browser origin so invite links work even if APP_URL is stale
  useEffect(() => {
    if (typeof window !== "undefined" && window.location?.origin) {
      setOrigin(window.location.origin);
    }
  }, []);

  const inviteUrl = useMemo(() => {
    if (!lastLink) return null;
    return invitePath(origin, lastLink);
  }, [origin, lastLink]);

  function memberRow(m: Member) {
    const isYou = currentUserId && m.userId === currentUserId;
    return (
      <li
        key={m.membershipId}
        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 px-3 py-2.5 text-sm"
      >
        <div className="min-w-0">
          <p className="font-medium text-zinc-200">
            {m.name}
            {isYou ? (
              <span className="ml-1.5 text-xs font-normal text-zinc-500">
                (you)
              </span>
            ) : null}
            {m.title ? (
              <span className="font-normal text-zinc-500"> · {m.title}</span>
            ) : null}
          </p>
          <p className="truncate text-xs text-zinc-500">{m.email}</p>
        </div>
        <Badge
          tone={
            m.role === "owner" || m.role === "admin" ? "green" : "default"
          }
        >
          {roleLabel(m.role)}
        </Badge>
      </li>
    );
  }

  if (!canManage) {
    return (
      <div className="space-y-3">
        {members.length === 0 ? (
          <p className="text-sm text-zinc-500">No team members yet.</p>
        ) : (
          <ul className="space-y-2">{members.map(memberRow)}</ul>
        )}
        <p className="text-xs text-zinc-600">
          Only owners and admins can invite trainers.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {msg && (
        <Alert tone={msg.tone === "ok" ? "success" : "error"}>{msg.text}</Alert>
      )}

      <div>
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-medium text-zinc-200">Members</h3>
          <span className="text-[11px] text-zinc-600">
            {members.length}{" "}
            {members.length === 1 ? "person" : "people"}
          </span>
        </div>
        <ul className="mt-2 space-y-2">{members.map(memberRow)}</ul>
      </div>

      <form
        className="space-y-3 border-t border-zinc-800 pt-5"
        onSubmit={(e) => {
          e.preventDefault();
          setMsg(null);
          setLastLink(null);
          start(async () => {
            const res = await createInviteAction({ email, role });
            if ("error" in res && res.error) {
              setMsg({ tone: "err", text: res.error });
              return;
            }
            if ("token" in res && res.token) {
              const url = invitePath(origin, res.token);
              setLastLink(res.token);
              const invitedEmail =
                "email" in res && typeof res.email === "string"
                  ? res.email
                  : email;
              setEmail("");
              const emailed = "emailed" in res && res.emailed === true;
              try {
                await navigator.clipboard.writeText(url);
                setMsg({
                  tone: "ok",
                  text: emailed
                    ? `Invite sent to ${invitedEmail}`
                    : `Invite for ${invitedEmail} created — link copied.`,
                });
              } catch {
                setMsg({
                  tone: "ok",
                  text: emailed
                    ? `Invite sent to ${invitedEmail}`
                    : `Invite for ${invitedEmail} created. Copy the link below.`,
                });
              }
              router.refresh();
            }
          });
        }}
      >
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-emerald-500/80" aria-hidden />
          <h3 className="text-sm font-medium text-zinc-200">Invite someone</h3>
        </div>
        <p className="text-[11px] leading-relaxed text-zinc-600">
          Sends an email invite and creates a shareable link. Expires in 14
          days. You can always copy the link if mail is unavailable.
        </p>
        <div className="grid gap-3 sm:grid-cols-[1fr_8.5rem_auto]">
          <div>
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={pending}
              placeholder="pt@example.com"
              autoComplete="email"
              className="mt-0.5 min-h-11"
            />
          </div>
          <div>
            <Label htmlFor="invite-role">Role</Label>
            <Select
              id="invite-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={pending}
              className="mt-0.5 min-h-11"
            >
              <option value="trainer">Trainer</option>
              {canInviteAdmin ? (
                <option value="admin">Admin</option>
              ) : null}
              <option value="front_desk">Front desk</option>
            </Select>
          </div>
          <div className="flex items-end">
            <Button
              type="submit"
              size="sm"
              loading={pending}
              className="min-h-11 w-full sm:w-auto"
            >
              Create invite
            </Button>
          </div>
        </div>
        {inviteUrl && (
          <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 p-3">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400/90">
              <Link2 className="h-3 w-3" aria-hidden />
              Invite link
            </p>
            <p className="mt-1 break-all font-mono text-xs text-zinc-300">
              {inviteUrl}
            </p>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="mt-2 min-h-11 gap-1.5"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(inviteUrl);
                  setMsg({ tone: "ok", text: "Link copied" });
                } catch {
                  setMsg({
                    tone: "err",
                    text: "Could not copy — select the link manually",
                  });
                }
              }}
            >
              <Copy className="h-3.5 w-3.5" aria-hidden />
              Copy again
            </Button>
          </div>
        )}
      </form>

      {invites.length > 0 && (
        <div className="border-t border-zinc-800 pt-5">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-medium text-zinc-200">
              Pending invites
            </h3>
            <span className="text-[11px] text-zinc-600">{invites.length}</span>
          </div>
          <ul className="mt-2 space-y-2">
            {invites.map((inv) => {
              const link = invitePath(origin, inv.token);
              const expires = new Date(inv.expiresAt);
              const daysLeft = Math.max(
                0,
                Math.ceil(
                  (expires.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
                )
              );
              return (
                <li
                  key={inv.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 px-3 py-2.5 text-sm"
                >
                  <div className="min-w-0">
                    <p className="text-zinc-200">{inv.email}</p>
                    <p className="text-[11px] text-zinc-600">
                      {roleLabel(inv.role)} ·{" "}
                      {daysLeft === 0
                        ? "expires today"
                        : daysLeft === 1
                          ? "1 day left"
                          : `${daysLeft} days left`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="min-h-11 gap-1"
                      disabled={pending}
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(link);
                          setMsg({ tone: "ok", text: "Link copied" });
                        } catch {
                          setMsg({ tone: "err", text: "Copy failed" });
                        }
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" aria-hidden />
                      Copy
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="min-h-11 text-zinc-500 hover:text-red-300"
                      disabled={pending}
                      onClick={() => {
                        start(async () => {
                          const res = await revokeInviteAction(inv.id);
                          if ("error" in res && res.error) {
                            setMsg({ tone: "err", text: res.error });
                            return;
                          }
                          if (lastLink === inv.token) setLastLink(null);
                          setMsg({
                            tone: "ok",
                            text: `Invite for ${inv.email} revoked`,
                          });
                          router.refresh();
                        });
                      }}
                    >
                      Revoke
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
