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

/** Parse model output that starts with TITLE: ... */
export function parseAiStory(raw: string): { title: string; body: string } {
  const cleaned = normalizeLlmText(raw);
  const titleMatch = cleaned.match(/^TITLE:\s*(.+)$/im);
  if (titleMatch) {
    const title = titleMatch[1].trim();
    const idx = cleaned.indexOf(titleMatch[0]);
    const after = cleaned.slice(idx + titleMatch[0].length).trim();
    return { title, body: after || title };
  }
  const lines = cleaned.split("\n").map((l) => l.trim());
  const nonEmpty = lines.filter(Boolean);
  if (nonEmpty.length <= 1) {
    return { title: "Story", body: cleaned };
  }
  return {
    title: nonEmpty[0],
    body: nonEmpty.slice(1).join("\n\n"),
  };
}

export function parseAiImprov(raw: string): {
  title: string;
  beats: string[];
  branches: string[];
} {
  const norm = normalizeLlmText(raw);
  const titleMatch = norm.match(/^TITLE:\s*(.+)$/im);
  const title = titleMatch ? titleMatch[1].trim() : "Improv kit";
  const beats: string[] = [];
  for (let i = 1; i <= 8; i++) {
    const re = new RegExp(`^BEAT${i}:\\s*(.+)$`, "im");
    const m = norm.match(re);
    if (m) beats.push(m[1].trim());
  }
  const branchM = norm.match(/^BRANCH:\s*(.+)$/im);
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
