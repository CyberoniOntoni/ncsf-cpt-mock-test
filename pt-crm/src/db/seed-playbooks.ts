import { eq } from "drizzle-orm";
import { getDb } from "./index";
import { assessmentTemplates, playbookChunks, playbooks } from "./schema";
import { id } from "@/lib/utils";
import { ASSESSMENT_TEMPLATES } from "./assessment-templates-data";
import { CORE_PLAYBOOKS } from "./core-playbooks-data";
import { NCSF_PLAYBOOKS, type PlaybookDef } from "./ncsf-playbooks-data";

/** Full coach knowledge catalog: core screens/process + NCSF-informed briefs. */
const PLAYBOOKS: PlaybookDef[] = [...CORE_PLAYBOOKS, ...NCSF_PLAYBOOKS];

let playbookSeedPromise: Promise<void> | null = null;

export async function seedPlaybooksIfNeeded() {
  if (!playbookSeedPromise) {
    playbookSeedPromise = runPlaybookSeed().catch((err) => {
      playbookSeedPromise = null;
      throw err;
    });
  }
  await playbookSeedPromise;
}

async function runPlaybookSeed() {
  const db = await getDb();

  // All assessment templates — upsert by slug (polished copy ships to existing DBs)
  for (const t of ASSESSMENT_TEMPLATES) {
    const [existing] = await db
      .select()
      .from(assessmentTemplates)
      .where(eq(assessmentTemplates.slug, t.slug))
      .limit(1);

    const values = {
      name: t.name,
      description: t.description,
      purpose: t.purpose || null,
      instructions: t.instructions,
      category: t.category,
      laterality: t.laterality,
      scoringType: t.scoringType,
      fields: t.fields,
      playbookTags: t.playbookTags,
      sortOrder: t.sortOrder,
      active: true,
    };

    if (existing) {
      await db
        .update(assessmentTemplates)
        .set(values)
        .where(eq(assessmentTemplates.id, existing.id));
    } else {
      await db.insert(assessmentTemplates).values({
        id: id("at"),
        slug: t.slug,
        ...values,
      });
    }
  }

  for (const pb of PLAYBOOKS) {
    const [existing] = await db
      .select()
      .from(playbooks)
      .where(eq(playbooks.slug, pb.slug))
      .limit(1);

    if (existing) {
      // Refresh content so updates ship to existing installs
      await db
        .update(playbooks)
        .set({
          title: pb.title,
          category: pb.category,
          triggerPhrases: pb.triggerPhrases,
          tags: pb.tags,
          summary: pb.summary,
          followUpQuestions: pb.followUpQuestions,
          solutionSteps: pb.solutionSteps,
          interventions: pb.interventions,
          redFlags: pb.redFlags,
          contraindications: pb.contraindications || null,
          sourceNotes: playbookSourceNotes(pb.slug),
          body: pb.body,
          active: true,
        })
        .where(eq(playbooks.id, existing.id));

      // Refresh chunks: delete old + insert one combined chunk
      await db.delete(playbookChunks).where(eq(playbookChunks.playbookId, existing.id));
      await db.insert(playbookChunks).values({
        id: id("chk"),
        playbookId: existing.id,
        content: chunkText(pb),
        embedding: null,
      });
      continue;
    }

    const pbId = id("pb");
    await db.insert(playbooks).values({
      id: pbId,
      organizationId: null,
      slug: pb.slug,
      title: pb.title,
      category: pb.category,
      triggerPhrases: pb.triggerPhrases,
      tags: pb.tags,
      summary: pb.summary,
      followUpQuestions: pb.followUpQuestions,
      solutionSteps: pb.solutionSteps,
      interventions: pb.interventions,
      redFlags: pb.redFlags,
      contraindications: pb.contraindications || null,
      sourceNotes: playbookSourceNotes(pb.slug),
      body: pb.body,
      active: true,
    });
    await db.insert(playbookChunks).values({
      id: id("chk"),
      playbookId: pbId,
      content: chunkText(pb),
      embedding: null,
    });
  }
}

function playbookSourceNotes(slug: string) {
  if (slug.startsWith("ncsf-")) {
    return "NCSF-informed coaching playbook — synthesized concepts for coach support only; not curriculum reprint, certification material, or medical advice.";
  }
  return "Curated FloorScribe playbook — coaching support, not medical diagnosis.";
}

function chunkText(pb: PlaybookDef) {
  return [
    pb.title,
    pb.triggerPhrases,
    pb.tags,
    pb.summary,
    pb.body,
    ...pb.followUpQuestions,
    ...pb.solutionSteps,
    ...pb.interventions,
    ...pb.redFlags,
    pb.contraindications ?? "",
  ].join(" ");
}
