import { and, eq, isNull, or } from "drizzle-orm";
import { getDb } from "@/db";
import { playbookChunks, playbooks } from "@/db/schema";

function tokenize(q: string) {
  return q
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);
}

/** Multi-word phrases that should strongly boost a match */
const PHRASE_BOOSTS: Array<{ phrase: string; boost: number }> = [
  { phrase: "back scratch", boost: 4 },
  { phrase: "overhead squat", boost: 3 },
  { phrase: "heels rise", boost: 3 },
  { phrase: "knee valgus", boost: 3 },
  { phrase: "ankle dorsiflexion", boost: 3 },
  { phrase: "hip hinge", boost: 3 },
  { phrase: "reverse pyramid", boost: 4 },
  { phrase: "drop set", boost: 3 },
  { phrase: "drop sets", boost: 3 },
  { phrase: "rest pause", boost: 3 },
  { phrase: "myo rep", boost: 3 },
  { phrase: "cluster set", boost: 3 },
  { phrase: "contrast set", boost: 4 },
  { phrase: "contrast training", boost: 3 },
  { phrase: "super set", boost: 2 },
  { phrase: "superset", boost: 3 },
  { phrase: "complex set", boost: 3 },
  { phrase: "set scheme", boost: 4 },
  { phrase: "log session", boost: 3 },
  { phrase: "re-test", boost: 3 },
  { phrase: "retest", boost: 3 },
  { phrase: "red flag", boost: 3 },
  { phrase: "night pain", boost: 3 },
  { phrase: "progressive overload", boost: 3 },
  { phrase: "deload", boost: 2 },
  { phrase: "deload week", boost: 3 },
  { phrase: "warm up", boost: 2 },
  { phrase: "warmup", boost: 2 },
  { phrase: "traffic light", boost: 3 },
  { phrase: "tennis elbow", boost: 3 },
  { phrase: "forward head", boost: 2 },
  { phrase: "pelvic tilt", boost: 2 },
  { phrase: "client brief", boost: 3 },
  { phrase: "session prep", boost: 3 },
  { phrase: "substitute exercise", boost: 3 },
  { phrase: "form cue", boost: 2 },
  { phrase: "mobility work", boost: 2 },
  { phrase: "shoulder pain", boost: 3 },
  { phrase: "low back pain", boost: 3 },
  { phrase: "knee pain", boost: 3 },
  { phrase: "double progression", boost: 3 },
  { phrase: "push pull", boost: 2 },
  { phrase: "anterior pelvic", boost: 3 },
  { phrase: "lateral hip", boost: 3 },
  // NCSF / coach-education — phrases must also appear in playbook text (triggers/body)
  { phrase: "needs analysis", boost: 4 },
  { phrase: "kinetic chain", boost: 3 },
  { phrase: "form closure", boost: 4 },
  { phrase: "force closure", boost: 4 },
  { phrase: "local stabilizers", boost: 3 },
  { phrase: "preparation phase", boost: 3 },
  { phrase: "progressive preparation", boost: 3 },
  { phrase: "functional warm-up", boost: 3 },
  { phrase: "functional warmup", boost: 3 },
  { phrase: "cool down", boost: 2 },
  { phrase: "cooldown", boost: 2 },
  { phrase: "resting heart rate", boost: 3 },
  { phrase: "blood pressure", boost: 3 },
  { phrase: "bmi caveat", boost: 4 },
  { phrase: "waist circumference", boost: 3 },
  { phrase: "upper cross", boost: 3 },
  { phrase: "upper crossed", boost: 3 },
  { phrase: "lower cross", boost: 3 },
  { phrase: "lower crossed", boost: 3 },
  { phrase: "special populations", boost: 3 },
  { phrase: "fitt", boost: 3 },
  { phrase: "wall angel", boost: 3 },
  { phrase: "plank hold", boost: 2 },
  { phrase: "glute bridge", boost: 2 },
  { phrase: "older adult training", boost: 4 },
  { phrase: "senior training", boost: 3 },
  { phrase: "youth training", boost: 4 },
  { phrase: "adolescent training", boost: 3 },
  { phrase: "pregnancy exercise", boost: 4 },
  { phrase: "prenatal exercise", boost: 4 },
  { phrase: "hypertension exercise", boost: 4 },
  { phrase: "high blood pressure training", boost: 3 },
  { phrase: "post-exercise hypotension", boost: 3 },
  { phrase: "diabetes exercise", boost: 4 },
  { phrase: "hypoglycemia", boost: 3 },
  { phrase: "weight management", boost: 3 },
  { phrase: "fat loss coaching", boost: 4 },
  { phrase: "energy balance", boost: 3 },
  { phrase: "moral licensing", boost: 3 },
  { phrase: "medical clearance", boost: 3 },
  { phrase: "fall risk", boost: 3 },
];

function scoreText(query: string, queryTokens: string[], text: string) {
  const hay = text.toLowerCase();
  let score = 0;

  for (const t of queryTokens) {
    if (hay.includes(t)) score += 1;
  }

  // Title-ish density: early match bonus via repeated short words is weak;
  // phrase boosts carry most of the weight.
  const qLower = query.toLowerCase();
  for (const { phrase, boost } of PHRASE_BOOSTS) {
    if (qLower.includes(phrase) && hay.includes(phrase)) {
      score += boost;
    } else if (
      !qLower.includes(phrase) &&
      phrase.split(" ").every((w) => queryTokens.includes(w) || qLower.includes(w))
    ) {
      if (hay.includes(phrase)) score += Math.max(1, boost - 1);
    }
  }

  // Apley / scratch alias
  if (
    (queryTokens.includes("scratch") || queryTokens.includes("apley")) &&
    (hay.includes("apley") || hay.includes("back scratch"))
  ) {
    score += 2;
  }

  return score;
}

export type RetrievedPlaybook = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  followUpQuestions: string[];
  solutionSteps: string[];
  interventions: string[];
  redFlags: string[];
  body: string;
  score: number;
};

export async function searchPlaybooks(
  organizationId: string,
  query: string,
  limit = 4
): Promise<RetrievedPlaybook[]> {
  const db = await getDb();
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  const rows = await db
    .select()
    .from(playbooks)
    .where(
      and(
        eq(playbooks.active, true),
        or(
          isNull(playbooks.organizationId),
          eq(playbooks.organizationId, organizationId)
        )
      )
    );

  const byId = new Map<
    string,
    { playbook: (typeof rows)[0]; score: number }
  >();

  for (const p of rows) {
    const blob = [
      p.title,
      p.title, // title weight
      p.summary ?? "",
      p.triggerPhrases,
      p.triggerPhrases,
      p.tags,
      p.body,
      ...(p.followUpQuestions ?? []),
      ...(p.solutionSteps ?? []),
      ...(p.interventions ?? []),
    ].join(" ");
    const score = scoreText(query, tokens, blob);
    if (score > 0) {
      byId.set(p.id, { playbook: p, score });
    }
  }

  // Merge chunk scores (org-scoped via playbook map)
  const playbookIds = new Set(rows.map((r) => r.id));
  if (playbookIds.size && byId.size < limit * 2) {
    try {
      const chunks = await db.select().from(playbookChunks);
      for (const c of chunks) {
        if (!playbookIds.has(c.playbookId)) continue;
        const s = scoreText(query, tokens, c.content);
        if (s <= 0) continue;
        const cur = byId.get(c.playbookId);
        if (cur) {
          cur.score += s * 0.5;
        } else {
          const pb = rows.find((r) => r.id === c.playbookId);
          if (pb) byId.set(pb.id, { playbook: pb, score: s * 0.5 });
        }
      }
    } catch {
      // chunks optional
    }
  }

  return Array.from(byId.values())
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ playbook: p, score }) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      summary: p.summary,
      followUpQuestions: p.followUpQuestions ?? [],
      solutionSteps: p.solutionSteps ?? [],
      interventions: p.interventions ?? [],
      redFlags: p.redFlags ?? [],
      body: p.body,
      score,
    }));
}
