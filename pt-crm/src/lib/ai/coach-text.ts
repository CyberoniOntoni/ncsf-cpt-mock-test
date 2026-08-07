/**
 * Plain-language coach copy — no markdown (** _ ` #) for the chat UI.
 */

/** Strip common markdown emphasis so replies never show raw * or _ . */
export function stripMarkdown(text: string): string {
  if (!text) return "";
  let s = String(text);
  // Fenced code blocks → content only
  s = s.replace(/```[\w]*\n?([\s\S]*?)```/g, "$1");
  // Headings
  s = s.replace(/^#{1,6}\s+/gm, "");
  // Bold / italic (order matters — triple, double, then single)
  s = s.replace(/\*\*\*(.+?)\*\*\*/g, "$1");
  s = s.replace(/\*\*(.+?)\*\*/g, "$1");
  s = s.replace(/__(.+?)__/g, "$1");
  // Single *italic* (avoid lone asterisks in math if any)
  s = s.replace(/\*([^*\n]+)\*/g, "$1");
  // Single _italic_ — only when both sides are non-word-ish (skip snake_case mid-word)
  s = s.replace(/(^|[^A-Za-z0-9])_([^_\n]+)_(?![A-Za-z0-9])/g, "$1$2");
  // Inline code
  s = s.replace(/`([^`]+)`/g, "$1");
  // Links [label](url) → label
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  // Stray leftover emphasis markers
  s = s.replace(/\*\*/g, "");
  s = s.replace(/(^|\s)_+(\s|$)/g, "$1$2");
  // Collapse excess blank lines
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

/** Bullet line with a clean prefix. */
export function bullet(line: string, mark = "•"): string {
  const clean = stripMarkdown(line).replace(/^[-*•]\s+/, "").trim();
  return `${mark} ${clean}`;
}

export function numbered(lines: string[]): string[] {
  return lines.map((q, i) => `${i + 1}. ${stripMarkdown(q)}`);
}

/** Section title as plain text, not ### */
export function sectionTitle(title: string): string {
  return stripMarkdown(title).replace(/:$/, "");
}
