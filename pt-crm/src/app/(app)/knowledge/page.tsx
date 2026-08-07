import { eq, or, isNull, asc } from "drizzle-orm";
import { getDb } from "@/db";
import { playbooks } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { AreaEyebrow } from "@/components/area-eyebrow";
import {
  KnowledgeBrowser,
  type KnowledgePlaybook,
} from "@/components/knowledge-browser";
import { PageShell } from "@/components/page-shell";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function KnowledgePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; slug?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const db = await getDb();
  const rows = await db
    .select()
    .from(playbooks)
    .where(
      or(
        isNull(playbooks.organizationId),
        eq(playbooks.organizationId, session.organizationId)
      )
    )
    .orderBy(asc(playbooks.category), asc(playbooks.title));

  const playbookList: KnowledgePlaybook[] = rows.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    category: p.category,
    summary: p.summary,
    tags: p.tags,
    triggerPhrases: p.triggerPhrases,
    followUpQuestions: p.followUpQuestions ?? [],
    solutionSteps: p.solutionSteps ?? [],
    interventions: p.interventions ?? [],
    redFlags: p.redFlags ?? [],
    contraindications: p.contraindications,
    body: p.body,
    organizationId: p.organizationId,
  }));

  return (
    <PageShell className="space-y-4">
      <PageHeader
        title="Knowledge"
        eyebrow={<AreaEyebrow areaId="studio" current="Knowledge" />}
        description="Playbooks for coaching decisions — open from Studio or Coach sources."
      />
      <KnowledgeBrowser
        playbooks={playbookList}
        initialQuery={params.q || ""}
        initialSlug={params.slug || null}
      />
    </PageShell>
  );
}
