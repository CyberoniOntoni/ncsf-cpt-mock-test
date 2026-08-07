import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { organizations } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { aiEnabled } from "@/lib/ai/client";
import { AreaEyebrow } from "@/components/area-eyebrow";
import { PageShell } from "@/components/page-shell";
import { Card, Badge, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

function authSecretStatus() {
  const s = process.env.AUTH_SECRET || "";
  if (!s) return { ok: false, label: "Missing" };
  if (
    s === "change-me-in-production" ||
    s === "dev-only-change-me-floorscribe-secret-key" ||
    s === "dev-only-change-me-pt-crm-secret-key" ||
    s.length < 24
  ) {
    return { ok: false, label: "Weak / default — change for production" };
  }
  return { ok: true, label: "Configured" };
}

export default async function SettingsPage() {
  const session = await requireSession();
  const db = await getDb();
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, session.organizationId))
    .limit(1);

  const auth = authSecretStatus();
  const nodeEnv = process.env.NODE_ENV || "development";
  const appUrl = process.env.APP_URL || "(not set)";

  return (
    <PageShell className="space-y-4">
      <PageHeader
        title="Settings"
        eyebrow={<AreaEyebrow areaId="studio" current="Settings" />}
        description="Organization, deploy, and AI for FloorScribe"
      />
      <Card>
        <h2 className="font-medium">Product</h2>
        <p className="mt-2 text-sm text-zinc-300">
          <span className="font-semibold text-emerald-400">FloorScribe</span>
          <span className="text-zinc-500"> — floor OS for personal trainers</span>
        </p>
        <p className="mt-2 text-xs text-zinc-600">
          Demo login stays <span className="text-zinc-400">pt@demo.local</span> /{" "}
          <span className="text-zinc-400">trainer123</span>
        </p>
      </Card>
      <Card>
        <h2 className="font-medium">Organization</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div>
            <dt className="text-zinc-500">Name</dt>
            <dd>{org?.name}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Units</dt>
            <dd>{org?.unitSystem}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Timezone</dt>
            <dd>{org?.timezone}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Your role</dt>
            <dd>
              <Badge>{session.role}</Badge>
            </dd>
          </div>
        </dl>
      </Card>

      <Card>
        <h2 className="font-medium">Deployment</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <dt className="text-zinc-500 w-32">Environment</dt>
            <dd>
              <Badge tone={nodeEnv === "production" ? "green" : "amber"}>
                {nodeEnv}
              </Badge>
            </dd>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <dt className="text-zinc-500 w-32">APP_URL</dt>
            <dd className="text-zinc-300 break-all">{appUrl}</dd>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <dt className="text-zinc-500 w-32">AUTH_SECRET</dt>
            <dd>
              <Badge tone={auth.ok ? "green" : "amber"}>{auth.label}</Badge>
            </dd>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <dt className="text-zinc-500 w-32">Health</dt>
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
