import { eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { organizations } from "@/db/schema";
import {
  getUserProfile,
  listPendingInvites,
  listTeamMembers,
} from "@/lib/auth";
import { isWeakAuthSecret } from "@/lib/session";
import { aiEnabled } from "@/lib/ai/client";
import { AreaEyebrow } from "@/components/area-eyebrow";
import { PageShell } from "@/components/page-shell";
import { SettingsOrgForm } from "@/components/settings-org-form";
import { SettingsProfileForm } from "@/components/settings-profile-form";
import { SettingsTeamPanel } from "@/components/settings-team-panel";
import { Alert, Badge, Card, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

function authSecretStatus() {
  const s = process.env.AUTH_SECRET || "";
  if (!s) return { ok: false, label: "Missing" };
  if (isWeakAuthSecret(s)) {
    return { ok: false, label: "Weak / default — change for production" };
  }
  return { ok: true, label: "Configured" };
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ paid?: string }>;
}) {
  const paid = (await searchParams).paid;
  if (paid === "1" || paid === "0") {
    redirect(`/card?paid=${paid}`);
  }
  const { session, user } = await getUserProfile();
  const db = await getDb();
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, session.organizationId))
    .limit(1);

  const auth = authSecretStatus();
  const nodeEnv = process.env.NODE_ENV || "development";
  const appUrl = process.env.APP_URL || "(not set)";
  const canEditOrg = session.role === "owner" || session.role === "admin";
  const canManageTeam = canEditOrg;
  const canInviteAdmin = session.role === "owner";
  const orgKind = org?.kind === "solo" ? "solo" : "studio";
  // Invite tokens only for managers — non-managers never load or receive tokens
  const members = await listTeamMembers();
  const pendingInvites = canManageTeam ? await listPendingInvites() : [];
  const invitesForClient = canManageTeam
    ? pendingInvites.map((inv) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        token: inv.token,
        expiresAt: inv.expiresAt,
      }))
    : [];
  // Pass APP_URL as-is so inviteAbsoluteUrl applies the same floorscribe.com fallback as mail
  const appOrigin = process.env.APP_URL;

  return (
    <PageShell className="space-y-4">
      <PageHeader
        title="Settings"
        eyebrow={<AreaEyebrow areaId="studio" current="Settings" />}
        description="Account, practice, team, deploy, and AI"
      />

      {!user?.emailVerifiedAt ? (
        <Alert tone="warning">
          Verify your email to publish your card and invite teammates.{" "}
          <Link href="/verify-email" className="font-medium underline">
            Verify email
          </Link>
        </Alert>
      ) : null}

      <Card>
        <h2 className="font-medium">Account</h2>
        <p className="mt-1 text-xs text-zinc-600">
          Signed in as{" "}
          <span className="text-zinc-400">{session.email}</span>
          {user?.title ? (
            <>
              {" "}
              · <span className="text-zinc-400">{user.title}</span>
            </>
          ) : null}
          {" · "}
          <Badge
            tone={
              session.role === "owner" || session.role === "admin"
                ? "green"
                : "default"
            }
          >
            {session.role === "owner"
              ? "Owner"
              : session.role === "admin"
                ? "Admin"
                : session.role === "front_desk"
                  ? "Front desk"
                  : session.role === "trainer"
                    ? "Trainer"
                    : session.role}
          </Badge>
        </p>
        <div className="mt-4">
          <SettingsProfileForm
            initial={{
              name: user?.name || session.name,
              email: user?.email || session.email,
              phone: user?.phone || "",
              title: user?.title || "",
            }}
          />
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-medium">
            {orgKind === "solo" ? "Practice" : "Studio"}
          </h2>
          <Badge tone={orgKind === "solo" ? "default" : "green"}>
            {orgKind === "solo" ? "Individual PT" : "Studio team"}
          </Badge>
        </div>
        <p className="mt-1 text-xs text-zinc-600">
          Organization shown in the sidebar and on reports.
        </p>
        <div className="mt-4">
          <SettingsOrgForm
            canEdit={canEditOrg}
            initial={{
              name: org?.name || session.organizationName,
              unitSystem: org?.unitSystem || "metric",
              timezone: org?.timezone || "UTC",
            }}
          />
        </div>
      </Card>

      <Card>
        <h2 className="font-medium">Team</h2>
        <p className="mt-1 text-xs text-zinc-600">
          {orgKind === "solo"
            ? "Invite trainers to grow into a studio. They join via a link you copy and send."
            : "Invite trainers and staff. They join via a link you copy and send (no email yet)."}
        </p>
        <div className="mt-4">
          <SettingsTeamPanel
            members={members}
            invites={invitesForClient}
            canManage={canManageTeam}
            canInviteAdmin={canInviteAdmin}
            appOrigin={appOrigin}
            currentUserId={session.userId}
          />
        </div>
      </Card>

      <Card>
        <h2 className="font-medium">Product</h2>
        <p className="mt-2 text-sm text-zinc-300">
          <span className="font-semibold text-emerald-400">FloorScribe</span>
          <span className="text-zinc-500">
            {" "}
            — floor OS for personal trainers
          </span>
        </p>
        {process.env.NODE_ENV !== "production" && (
          <p className="mt-2 text-xs text-zinc-600">
            Dev seed:{" "}
            <span className="text-zinc-400">pt@demo.local</span> /{" "}
            <span className="text-zinc-400">trainer123</span>
          </p>
        )}
      </Card>

      <Card>
        <h2 className="font-medium">Deployment</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <dt className="w-32 text-zinc-500">Environment</dt>
            <dd>
              <Badge tone={nodeEnv === "production" ? "green" : "amber"}>
                {nodeEnv}
              </Badge>
            </dd>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <dt className="w-32 text-zinc-500">APP_URL</dt>
            <dd className="break-all text-zinc-300">{appUrl}</dd>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <dt className="w-32 text-zinc-500">AUTH_SECRET</dt>
            <dd>
              <Badge tone={auth.ok ? "green" : "amber"}>{auth.label}</Badge>
            </dd>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <dt className="w-32 text-zinc-500">Health</dt>
            <dd className="text-zinc-400">
              <code className="text-xs">GET /api/health</code> (no login)
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-zinc-600">
          See <code className="text-zinc-400">DEPLOY.md</code> for Proxmox LXC +
          Docker, HTTPS (Caddy), and volume backups.
        </p>
      </Card>

      <Card>
        <h2 className="font-medium">AI provider</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Status:{" "}
          {aiEnabled() ? (
            <Badge tone="green">XAI_API_KEY configured (LLM mode)</Badge>
          ) : (
            <Badge tone="amber">
              Rule-based mode (set XAI_API_KEY for SpaceXAI / xAI)
            </Badge>
          )}
        </p>
        <p className="mt-2 text-xs text-zinc-600">
          Env: XAI_API_KEY, optional AI_BASE_URL (default https://api.x.ai/v1),
          AI_MODEL (default grok-4.5).
        </p>
      </Card>

      <Card>
        <h2 className="font-medium">Disclaimer</h2>
        <p className="mt-2 text-sm text-zinc-400">
          This product provides coaching support tools for personal trainers. It
          does not diagnose medical conditions. Always refer clients with
          red-flag symptoms to appropriate healthcare professionals.
        </p>
      </Card>
    </PageShell>
  );
}
