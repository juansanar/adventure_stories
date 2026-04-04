/** Remove Gemma turn markup that sometimes leaks into the decoded string. */
export function normalizeLlmText(raw: unknown): string {
  const s =
    typeof raw === "string"
      ? raw
      : raw == null
        ? ""
        : String(raw);
  return s
    .replace(/<\/?start_of_turn[^>]*>/gi, "")
    .replace(/<\/?end_of_turn>/gi, "")
    .trim();
}

/** True when the model echoed prompt placeholders instead of a real title. */
function isPlaceholderAiTitle(s: string): boolean {
  const t = s.replace(/\*+/g, "").trim().toLowerCase();
  if (!t) return true;
  const placeholders = new Set([
    "(one line only)",
    "(one line)",
    "one line only",
    "<your title here>",
    "your title here",
    "short story name",
    "<short title>",
  ]);
  return placeholders.has(t);
}

/**
 * Match `TITLE: …` at the start of a line (case-insensitive on the word TITLE).
 * Uses the first such line in the text.
 */
function matchTitleLine(cleaned: string): RegExpMatchArray | null {
  return cleaned.match(/^title:\s*(.+)$/im);
}

/** Parse model output that should start with TITLE: … */
export function parseAiStory(raw: string): { title: string; body: string } {
  const cleaned = normalizeLlmText(raw);
  const titleMatch = matchTitleLine(cleaned);
  if (titleMatch && titleMatch.index !== undefined) {
    const idx = titleMatch.index;
    const matchedLine = titleMatch[0];
    const title = titleMatch[1].trim();
    const after = cleaned.slice(idx + matchedLine.length).trim();
    if (title && !isPlaceholderAiTitle(title)) {
      return { title, body: after || title };
    }
    const sansTitleLine = `${cleaned.slice(0, idx)}${cleaned.slice(idx + matchedLine.length)}`.trim();
    return { title: "Story", body: after || sansTitleLine };
  }
  return { title: "Story", body: cleaned };
}

export function parseAiImprov(raw: string): {
  title: string;
  beats: string[];
  branches: string[];
} {
  const norm = normalizeLlmText(raw);
  const titleMatch = matchTitleLine(norm);
  let title = "Improv kit";
  if (titleMatch && titleMatch.index !== undefined) {
    const candidate = titleMatch[1].trim();
    if (candidate && !isPlaceholderAiTitle(candidate)) {
      title = candidate;
    }
  }
  const beats: string[] = [];
  for (let i = 1; i <= 8; i++) {
    const re = new RegExp(`^beat${i}:\\s*(.+)$`, "im");
    const m = norm.match(re);
    if (m) beats.push(m[1].trim());
  }
  const branchM = norm.match(/^branch:\s*(.+)$/im);
  const branches = branchM ? [branchM[1].trim()] : [];
  if (beats.length === 0) {
    return {
      title,
      beats: [
        norm.trim() || "Use the cast and setting to invent gentle beats.",
      ],
      branches,
    };
  }
  return { title, beats, branches };
}
