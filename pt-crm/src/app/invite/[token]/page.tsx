import type { Metadata } from "next";
import Link from "next/link";
import {
  acceptInviteRegisterAction,
  logoutAction,
} from "@/app/actions/auth";
import { AuthShell } from "@/components/auth-shell";
import { AuthSubmitButton } from "@/components/auth-submit-button";
import { InviteAcceptExisting } from "@/components/invite-accept-existing";
import { Alert, Button, Card, Input, Label } from "@/components/ui";
import { getInviteByToken, getSessionOrNull, normalizeEmail } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Team invite",
  description: "Accept a FloorScribe studio invite.",
};

function roleLabel(role: string) {
  if (role === "admin") return "Admin";
  if (role === "front_desk") return "Front desk";
  return "Trainer";
}

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
  const invite = await getInviteByToken(token);
  const session = await getSessionOrNull();

  if (!invite || !invite.organization) {
    return (
      <AuthShell
        title="Invite not found"
        subtitle="This link is invalid or no longer works."
      >
        <Card className="space-y-4 border-zinc-800/80 p-5 text-center">
          <p className="text-sm text-zinc-400">
            Ask the studio owner to create a new invite from Settings → Team.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
            <Link href="/login" className="text-emerald-400 hover:underline">
              Sign in
            </Link>
            <span className="text-zinc-700">·</span>
            <Link href="/register" className="text-zinc-500 hover:text-zinc-300">
              Create account
            </Link>
          </div>
        </Card>
      </AuthShell>
    );
  }

  if (invite.status !== "pending") {
    const reason =
      invite.status === "accepted"
        ? "This invite was already accepted."
        : invite.status === "expired"
          ? "This invite has expired (links last 14 days)."
          : "This invite was revoked.";

    return (
      <AuthShell title="Invite unavailable" subtitle={reason}>
        <Card className="space-y-4 border-zinc-800/80 p-5 text-center">
          <p className="text-sm text-zinc-400">
            {invite.status === "accepted"
              ? "Sign in with the account you created for this studio."
              : "Ask the owner to send a fresh invite from Settings → Team."}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
            <Link href="/login" className="text-emerald-400 hover:underline">
              Sign in
            </Link>
            <span className="text-zinc-700">·</span>
            <Link href="/register" className="text-zinc-500 hover:text-zinc-300">
              Create account
            </Link>
          </div>
        </Card>
      </AuthShell>
    );
  }

  const orgName = invite.organization.name;
  const role = roleLabel(invite.role);
  const loginNext = `/login?next=${encodeURIComponent(`/invite/${token}`)}`;

  if (session) {
    const emailMatch =
      normalizeEmail(session.email) === normalizeEmail(invite.email);

    return (
      <AuthShell
        title={`Join ${orgName}`}
        subtitle={`Invited as ${role} · ${invite.email}`}
      >
        <Card className="space-y-4 border-zinc-800/80 p-5 shadow-xl shadow-black/40">
          {error && <Alert tone="error">{error}</Alert>}

          {emailMatch ? (
            <>
              <p className="text-sm leading-relaxed text-zinc-400">
                Signed in as{" "}
                <span className="font-medium text-zinc-200">{session.email}</span>
                . Accept to join{" "}
                <span className="text-zinc-200">{orgName}</span> as {role}.
              </p>
              <InviteAcceptExisting token={token} orgName={orgName} />
            </>
          ) : (
            <>
              <Alert tone="warning">
                This invite is for{" "}
                <span className="font-medium">{invite.email}</span>, but you’re
                signed in as {session.email}.
              </Alert>
              <p className="text-sm text-zinc-400">
                Sign out, then sign in (or register) with the invited email.
              </p>
              <form action={logoutAction}>
                <input type="hidden" name="next" value={`/invite/${token}`} />
                <Button type="submit" className="min-h-11 w-full">
                  Sign out and continue
                </Button>
              </form>
            </>
          )}

          <p className="border-t border-zinc-800 pt-4 text-center text-xs text-zinc-600">
            Wrong invite?{" "}
            <Link href="/" className="text-zinc-500 hover:text-zinc-300">
              Back to app
            </Link>
          </p>
        </Card>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={`Join ${orgName}`}
      subtitle={`Create your account as ${role}`}
    >
      <Card className="border-zinc-800/80 p-5 shadow-xl shadow-black/40">
        <form action={acceptInviteRegisterAction} className="space-y-3.5">
          <input type="hidden" name="token" value={token} />
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              value={invite.email}
              readOnly
              disabled
              className="mt-0.5 min-h-11 opacity-80"
            />
            <p className="mt-1 text-[11px] text-zinc-600">
              Locked to the invite — ask the owner if this is wrong.
            </p>
          </div>
          <div>
            <Label htmlFor="name">Your name</Label>
            <Input
              id="name"
              name="name"
              required
              minLength={2}
              autoComplete="name"
              placeholder="Alex Chen"
              className="mt-0.5 min-h-11"
              autoFocus
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="Min 8 characters"
                className="mt-0.5 min-h-11"
              />
            </div>
            <div>
              <Label htmlFor="confirmPassword">Confirm</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="mt-0.5 min-h-11"
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                className="mt-0.5 min-h-11"
              />
            </div>
            <div>
              <Label htmlFor="title">Credentials (optional)</Label>
              <Input
                id="title"
                name="title"
                placeholder="NCSF-CPT"
                className="mt-0.5 min-h-11"
              />
            </div>
          </div>
          {error && <Alert tone="error">{error}</Alert>}
          <AuthSubmitButton>Join {orgName}</AuthSubmitButton>
        </form>
        <p className="mt-5 border-t border-zinc-800 pt-4 text-center text-xs text-zinc-600">
          Already have an account?{" "}
          <Link href={loginNext} className="text-emerald-400 hover:underline">
            Sign in first
          </Link>
        </p>
      </Card>
    </AuthShell>
  );
}
