/**
 * Pure assessment → corrective exercise prescriptions.
 * No I/O; maps screen fails / injury free-text into ranked, tag-aware hints.
 */

export type CorrectivePrescription = {
  id: string;
  reason: string;
  preferTags: string[];
  patterns: string[];
  exerciseNameHints: string[];
  priority: number;
};

export type CorrectiveExercisePoolItem = {
  id: string;
  name: string;
  tags: string;
  movementPattern: string;
  available: boolean;
  cues?: string | null;
};

/** Typical “limited” knee-to-wall DF (cm). Below this → ankle DF corrective. */
const ANKLE_DF_LOW_CM = 8;

/** Back-scratch gap (cm): larger positive gap ≈ more restricted. */
const BACK_SCRATCH_GAP_LIMIT_CM = 2;

function lower(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim().toLowerCase();
}

function isFail(v: unknown): boolean {
  const s = lower(v);
  return s === "fail" || s === "poor" || s === "limited" || s === "yes" || s === "true";
}

function isPoorSelect(v: unknown): boolean {
  const s = lower(v);
  return s === "poor" || s === "limited" || s === "fail";
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function hasPainSignal(results: Record<string, unknown>, summary?: string | null): boolean {
  if (isFail(results.pain) || isFail(results.painful) || isFail(results.has_pain)) return true;
  const painScore = num(results.pain_score);
  if (painScore != null && painScore > 0) return true;
  if (summary && /\bpain\b|painful|tender|pinch/i.test(summary)) return true;
  // Any key containing "pain" with fail-like / truthy value
  for (const [k, v] of Object.entries(results)) {
    if (!/pain/i.test(k)) continue;
    if (isFail(v)) return true;
    const n = num(v);
    if (n != null && n > 0) return true;
    if (lower(v) === "yes") return true;
  }
  return false;
}

function prescription(
  partial: Omit<CorrectivePrescription, "preferTags" | "patterns" | "exerciseNameHints"> &
    Partial<Pick<CorrectivePrescription, "preferTags" | "patterns" | "exerciseNameHints">>
): CorrectivePrescription {
  return {
    preferTags: partial.preferTags ?? [],
    patterns: partial.patterns ?? ["mobility"],
    exerciseNameHints: partial.exerciseNameHints ?? [],
    id: partial.id,
    reason: partial.reason,
    priority: partial.priority,
  };
}

const SHOULDER_MOBILITY = (): CorrectivePrescription =>
  prescription({
    id: "shoulder-mobility",
    reason: "Shoulder mobility limit (back scratch / Apley or related)",
    preferTags: ["shoulder", "mobility", "scapula", "back-scratch", "apley", "tspine", "posture"],
    patterns: ["mobility", "horizontal_pull"],
    exerciseNameHints: [
      "wall slide",
      "sleeper",
      "open book",
      "thoracic",
      "face pull",
      "pull-apart",
      "prone y",
      "pec",
      "dislocate",
    ],
    priority: 80,
  });

const ANKLE_DF_MOBILITY = (): CorrectivePrescription =>
  prescription({
    id: "ankle-df-mobility",
    reason: "Limited ankle dorsiflexion (wall test or squat heels)",
    preferTags: ["ankle", "mobility", "squat", "heels", "calf"],
    patterns: ["mobility"],
    exerciseNameHints: ["ankle", "knee-to-wall", "dorsiflex", "calf", "soleus", "wall"],
    priority: 75,
  });

const HIP_ANKLE_TSPINE = (): CorrectivePrescription =>
  prescription({
    id: "ohs-global-mobility",
    reason: "Overhead squat limited/poor — prioritise hip, ankle, and T-spine capacity",
    preferTags: ["hip", "ankle", "tspine", "mobility", "squat", "ohs"],
    patterns: ["mobility"],
    exerciseNameHints: [
      "ankle",
      "world's greatest",
      "90/90",
      "thoracic",
      "open book",
      "hip flexor",
      "goblet",
      "cat-cow",
    ],
    priority: 70,
  });

const OHS_HEELS = (): CorrectivePrescription =>
  prescription({
    id: "ohs-heels-ankle",
    reason: "Heels rise in overhead squat — ankle DF / squat strategy",
    preferTags: ["ankle", "mobility", "squat", "heels"],
    patterns: ["mobility", "squat"],
    exerciseNameHints: ["ankle", "knee-to-wall", "calf", "goblet", "heel"],
    priority: 72,
  });

const OHS_ARMS = (): CorrectivePrescription =>
  prescription({
    id: "ohs-arms-tspine-shoulder",
    reason: "Arms fall forward in overhead squat — T-spine / shoulder flexion",
    preferTags: ["tspine", "shoulder", "mobility", "overhead", "lat"],
    patterns: ["mobility", "horizontal_pull"],
    exerciseNameHints: ["thoracic", "wall slide", "open book", "lat", "dislocate", "thread"],
    priority: 72,
  });

const OHS_VALGUS = (): CorrectivePrescription =>
  prescription({
    id: "ohs-knee-valgus-control",
    reason: "Knee valgus in overhead squat — hip/foot control",
    preferTags: ["glute", "hip", "knee", "valgus", "control", "single-leg"],
    patterns: ["mobility", "core", "squat"],
    exerciseNameHints: ["clam", "side plank", "step-down", "split squat", "band", "glute"],
    priority: 65,
  });

const GENTLE_MOBILITY = (): CorrectivePrescription =>
  prescription({
    id: "gentle-pain-mobility",
    reason: "Pain flagged on assessment — favour gentle, pain-free mobility",
    preferTags: ["mobility", "gentle", "pain-free", "warmup"],
    patterns: ["mobility"],
    exerciseNameHints: ["gentle", "cat-cow", "open book", "breathing", "mobility"],
    priority: 95,
  });

const POSTURE_UPPER = (): CorrectivePrescription =>
  prescription({
    id: "posture-upper-quarter",
    reason: "Forward head / rounded or elevated shoulders on posture screen",
    preferTags: ["posture", "neck", "shoulder", "scapula", "tspine"],
    patterns: ["mobility", "horizontal_pull"],
    exerciseNameHints: ["chin", "face pull", "pull-apart", "thoracic", "row", "pec"],
    priority: 55,
  });

const POSTURE_PELVIS = (): CorrectivePrescription =>
  prescription({
    id: "posture-pelvis-core",
    reason: "Pelvic tilt flagged on posture screen",
    preferTags: ["posture", "pelvis", "core", "hip", "apt"],
    patterns: ["mobility", "core"],
    exerciseNameHints: ["dead bug", "hip flexor", "glute bridge", "breathing", "plank"],
    priority: 50,
  });

/**
 * Map assessment template results into corrective prescriptions.
 * Known slugs: back-scratch, ankle-df-wall, overhead-squat, posture-static; others use heuristics + summary.
 */
export function correctivesFromAssessmentResults(opts: {
  templateSlug: string;
  results: Record<string, unknown>;
  summary?: string | null;
}): CorrectivePrescription[] {
  const slug = (opts.templateSlug || "").toLowerCase().trim();
  const results = opts.results || {};
  const summary = opts.summary ?? null;
  const out: CorrectivePrescription[] = [];

  const push = (p: CorrectivePrescription) => {
    out.push(p);
  };

  // Pain always elevates gentle mobility (any template)
  if (hasPainSignal(results, summary)) {
    push(GENTLE_MOBILITY());
  }

  // --- Back Scratch / Apley ---
  if (slug === "back-scratch" || slug.includes("apley") || slug.includes("back-scratch")) {
    const rightFail = isFail(results.right_pass);
    const leftFail = isFail(results.left_pass);
    const rightGap = num(results.right_over);
    const leftGap = num(results.left_over);
    const gapLimited =
      (rightGap != null && rightGap > BACK_SCRATCH_GAP_LIMIT_CM) ||
      (leftGap != null && leftGap > BACK_SCRATCH_GAP_LIMIT_CM);

    if (rightFail || leftFail || gapLimited || isPoorSelect(results.quality)) {
      const sideBits: string[] = [];
      if (rightFail || (rightGap != null && rightGap > BACK_SCRATCH_GAP_LIMIT_CM)) sideBits.push("right");
      if (leftFail || (leftGap != null && leftGap > BACK_SCRATCH_GAP_LIMIT_CM)) sideBits.push("left");
      const base = SHOULDER_MOBILITY();
      push({
        ...base,
        reason:
          sideBits.length === 1
            ? `Back scratch / Apley limited on ${sideBits[0]} — shoulder IR/ER + scapular mobility`
            : sideBits.length === 2
              ? "Back scratch / Apley limited bilaterally — shoulder IR/ER + scapular mobility"
              : base.reason,
        priority: rightFail && leftFail ? base.priority + 5 : base.priority,
      });
    }
  }

  // --- Ankle DF wall ---
  if (slug === "ankle-df-wall" || slug.includes("ankle")) {
    const rightCm = num(results.right_cm);
    const leftCm = num(results.left_cm);
    const lowDf =
      (rightCm != null && rightCm < ANKLE_DF_LOW_CM) ||
      (leftCm != null && leftCm < ANKLE_DF_LOW_CM);
    const heelFail = isFail(results.heel_lift);
    const passFail =
      isFail(results.right_pass) ||
      isFail(results.left_pass) ||
      isFail(results.pass) ||
      isFail(results.result);

    if (lowDf || heelFail || passFail) {
      const base = ANKLE_DF_MOBILITY();
      const detail: string[] = [];
      if (rightCm != null && rightCm < ANKLE_DF_LOW_CM) detail.push(`R ${rightCm} cm`);
      if (leftCm != null && leftCm < ANKLE_DF_LOW_CM) detail.push(`L ${leftCm} cm`);
      if (heelFail) detail.push("heel lifts early");
      push({
        ...base,
        reason:
          detail.length > 0
            ? `Limited ankle DF (${detail.join("; ")})`
            : base.reason,
        priority: lowDf && heelFail ? base.priority + 5 : base.priority,
      });
    }
  }

  // --- Overhead squat ---
  if (slug === "overhead-squat" || slug === "ohs" || slug.includes("overhead-squat")) {
    if (isPoorSelect(results.depth)) {
      push({
        ...HIP_ANKLE_TSPINE(),
        reason: `Overhead squat depth ${lower(results.depth)} — hip / ankle / T-spine mobility`,
        priority: lower(results.depth) === "poor" ? 78 : 70,
      });
    }
    if (isFail(results.heels)) {
      push(OHS_HEELS());
    }
    if (isFail(results.arms_fall)) {
      push(OHS_ARMS());
    }
    if (isFail(results.valgus)) {
      push(OHS_VALGUS());
    }
  }

  // --- Posture snapshot ---
  if (slug === "posture-static" || slug.includes("posture")) {
    const head = lower(results.head);
    const shoulders = lower(results.shoulders);
    if (head === "forward" || shoulders === "rounded" || shoulders.startsWith("elevated")) {
      push(POSTURE_UPPER());
    }
    const pelvis = lower(results.pelvis);
    if (pelvis === "anterior_tilt" || pelvis === "posterior_tilt") {
      push(POSTURE_PELVIS());
    }
  }

  // --- Summary / free-text fallbacks (any slug) ---
  const hay = [summary || "", ...Object.values(results).map((v) => String(v ?? ""))].join(" ").toLowerCase();
  if (
    out.length === 0 ||
    /shoulder|scratch|apley|ir\/er|overhead reach/i.test(hay)
  ) {
    if (
      !out.some((p) => p.id === "shoulder-mobility") &&
      /fail.*(shoulder|scratch|apley)|(shoulder|scratch|apley).*(fail|poor|limited)/i.test(hay)
    ) {
      push(SHOULDER_MOBILITY());
    }
  }

  return mergeCorrectives([out]);
}

/**
 * Derive correctives from free-text injury / history notes.
 */
export function correctivesFromClientHistory(injuries?: string | null): CorrectivePrescription[] {
  const text = (injuries || "").trim();
  if (!text) return [];

  const out: CorrectivePrescription[] = [];
  const t = text.toLowerCase();

  if (/shoulder|rotator|impinge|apley|scratch|labrum|ac joint|dislocat/i.test(t)) {
    out.push({
      ...SHOULDER_MOBILITY(),
      reason: "Client history mentions shoulder / Apley-related issues",
      priority: 70,
    });
  }

  if (/ankle|dorsiflex|achilles|sprain.*ankle|calf|plantar/i.test(t)) {
    out.push({
      ...ANKLE_DF_MOBILITY(),
      reason: "Client history mentions ankle / DF / calf issues",
      priority: 68,
    });
  }

  if (/knee|acl|mcl|meniscus|patell|valgus|it.?band/i.test(t)) {
    out.push(
      prescription({
        id: "knee-control-history",
        reason: "Client history mentions knee issues — control + friendly loading",
        preferTags: ["knee", "glute", "hip", "control", "single-leg"],
        patterns: ["mobility", "core", "squat"],
        exerciseNameHints: ["step-down", "split squat", "terminal knee", "glute", "clam", "isometric"],
        priority: 66,
      })
    );
  }

  if (/low.?back|lumbar|disc|sciatica|herniat|spine pain|back pain/i.test(t)) {
    out.push(
      prescription({
        id: "low-back-gentle",
        reason: "Client history mentions low back — gentle mobility + brace skill",
        preferTags: ["spine", "core", "mobility", "hinge", "gentle"],
        patterns: ["mobility", "core", "hinge"],
        exerciseNameHints: ["dead bug", "cat-cow", "bird dog", "hip hinge", "glute bridge", "breathing"],
        priority: 74,
      })
    );
  }

  if (/hip|groin|flexor|labral|impingement hip|si joint/i.test(t)) {
    out.push(
      prescription({
        id: "hip-mobility-history",
        reason: "Client history mentions hip issues",
        preferTags: ["hip", "mobility", "glute"],
        patterns: ["mobility"],
        exerciseNameHints: ["90/90", "hip flexor", "world's greatest", "glute", "open"],
        priority: 64,
      })
    );
  }

  if (/neck|cervical|whiplash|tech neck|forward head/i.test(t)) {
    out.push({
      ...POSTURE_UPPER(),
      id: "neck-posture-history",
      reason: "Client history mentions neck / upper posture issues",
      priority: 62,
    });
  }

  if (/\bpain\b|painful|chronic pain|flare/i.test(t) && !out.some((p) => p.id === "gentle-pain-mobility")) {
    out.push({
      ...GENTLE_MOBILITY(),
      reason: "Client history mentions pain — prefer gentle mobility first",
      priority: 85,
    });
  }

  if (/t.?spine|thoracic|mid.?back|kyphos/i.test(t)) {
    out.push(
      prescription({
        id: "tspine-mobility-history",
        reason: "Client history mentions thoracic / mid-back limits",
        preferTags: ["tspine", "mobility", "shoulder", "posture"],
        patterns: ["mobility"],
        exerciseNameHints: ["thoracic", "open book", "foam roller", "thread", "extension"],
        priority: 60,
      })
    );
  }

  return mergeCorrectives([out]);
}

/**
 * Merge multiple corrective lists: dedupe by id (highest priority wins), sort priority desc.
 */
export function mergeCorrectives(lists: CorrectivePrescription[][]): CorrectivePrescription[] {
  const byId = new Map<string, CorrectivePrescription>();
  for (const list of lists) {
    if (!list) continue;
    for (const item of list) {
      if (!item?.id) continue;
      const prev = byId.get(item.id);
      if (!prev || item.priority > prev.priority) {
        byId.set(item.id, item);
      }
    }
  }
  return Array.from(byId.values()).sort((a, b) => b.priority - a.priority);
}

function tokenizeTags(tags: string): string[] {
  return tags
    .toLowerCase()
    .split(/[,\s/;|]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1);
}

/**
 * Rank exercises from a pool for a single corrective. Available items preferred; best first.
 * Returns the same item shape as the pool (sorted / sliced).
 */
export function matchExercisesForCorrective(
  corrective: CorrectivePrescription,
  pool: CorrectiveExercisePoolItem[],
  limit?: number
): CorrectiveExercisePoolItem[] {
  if (!pool?.length) return [];

  const preferTags = (corrective.preferTags || []).map((t) => t.toLowerCase());
  const patterns = new Set((corrective.patterns || []).map((p) => p.toLowerCase()));
  const nameHints = (corrective.exerciseNameHints || []).map((h) => h.toLowerCase());

  const scored = pool.map((ex) => {
    let s = 0;
    const name = (ex.name || "").toLowerCase();
    const tags = tokenizeTags(ex.tags || "");
    const tagHay = tags.join(" ");
    const pattern = (ex.movementPattern || "").toLowerCase();
    const cues = (ex.cues || "").toLowerCase();
    const hay = `${name} ${tagHay} ${pattern} ${cues}`;

    // Pattern match
    if (patterns.has(pattern)) s += 4;
    else if (pattern === "mobility" && patterns.has("mobility")) s += 4;

    // Prefer-tag hits (name or tags)
    for (const t of preferTags) {
      if (!t) continue;
      if (tags.includes(t)) s += 3;
      else if (tagHay.includes(t) || name.includes(t)) s += 2;
    }

    // Name / cue hints
    for (const h of nameHints) {
      if (!h) continue;
      if (name.includes(h)) s += 3;
      else if (cues.includes(h) || tagHay.includes(h)) s += 1;
    }

    // Soft boost for mobility pattern when corrective is mobility-heavy
    if (preferTags.includes("mobility") && pattern === "mobility") s += 1;

    // Available preferred (stable secondary key via score, not hard filter)
    if (ex.available) s += 2;
    else s -= 1;

    return { ex, s };
  });

  scored.sort((a, b) => {
    if (b.s !== a.s) return b.s - a.s;
    // Tie-break: available first, then name
    if (a.ex.available !== b.ex.available) return a.ex.available ? -1 : 1;
    return a.ex.name.localeCompare(b.ex.name);
  });

  // Drop zero-relevance unless nothing scored — still return best-effort ordered pool
  const positive = scored.filter((x) => x.s > 0);
  const ordered = (positive.length ? positive : scored).map((x) => x.ex);

  if (limit != null && limit >= 0) return ordered.slice(0, limit);
  return ordered;
}
