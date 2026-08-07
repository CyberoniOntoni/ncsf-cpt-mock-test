/**
 * Detect program/mesocycle/scheme dumps that should not dominate floor cues or seed.
 */
export function isProgramMetaDump(text: string | null | undefined): boolean {
  const t = (text || "").trim();
  if (!t) return false;
  if (t.length > 140) return true;
  return /mesocycle:|deload week|reverse pyramid:|tempo sets:|drop sets:/i.test(
    t
  );
}

/**
 * Prefer short program notes; else bank cue; never seed meta dumps.
 */
export function seedSessionNotes(opts: {
  programNotes: string | null | undefined;
  bankCue: string | null | undefined;
}): string | null {
  const notes = opts.programNotes?.trim() || "";
  if (notes && !isProgramMetaDump(notes)) return notes;
  const bank = opts.bankCue?.trim() || "";
  if (bank) return bank;
  return null;
}
