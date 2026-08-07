/**
 * Default collapsed state for an exercise card while logging.
 * userOverride: value from collapsed[logId] when user toggled; undefined = no override.
 */
export function defaultExerciseCollapsed(opts: {
  readonly: boolean;
  logId: string;
  currentExId: string | null;
  completed: boolean;
  userOverride: boolean | undefined;
}): boolean {
  if (opts.userOverride !== undefined) return opts.userOverride;
  if (opts.readonly) return false;
  // Live logging: only current exercise open by default
  if (opts.currentExId && opts.logId === opts.currentExId) return false;
  return true;
}

/** True if any member of a group is the current exercise */
export function groupContainsCurrent(
  memberIds: string[],
  currentExId: string | null
): boolean {
  if (!currentExId) return false;
  return memberIds.includes(currentExId);
}
