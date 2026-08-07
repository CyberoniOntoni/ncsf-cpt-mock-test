import { eq, or, isNull, asc } from "drizzle-orm";
import { getDb } from "@/db";
import { playbooks } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import {
  KnowledgeBrowser,
  type KnowledgePlaybook,
} from "@/components/knowledge-browser";
import { PageShell } from "@/components/page-shell";

export const dynamic = "force-dynamic";

export default async function KnowledgePage() {
  const session = await requireSession();
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
    <PageShell>
      <KnowledgeBrowser playbooks={playbookList} />
    </PageShell>
  );
}
