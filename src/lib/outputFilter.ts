/**
 * Lightweight guard before showing on-device model output to toddlers.
 * If triggered, prefer falling back to template stories.
 */
/** Narrow phrases to avoid false positives (e.g. “butter knife”, “bloodhound”). */
const BLOCK_PATTERNS: RegExp[] = [
  /\bkill(ing|ed|s)?\b/i,
  /\b(murder|suicide)\b/i,
  /\b(gun|rifle|pistol|shoot(ing)?)\b/i,
  /\bknife\s+(fight|attack|stab)\b/i,
  /\b(stranger danger|get in (the )?van)\b/i,
  /\b(kidnap|abduct)\w*\b/i,
  /\b(died|death|corpse)\b/i,
  /\b(horror|terrified|nightmare)\b/i,
  /https?:\/\//i,
];

export function screenAiOutput(text: unknown): { ok: true } | { ok: false; reason: string } {
  const t =
    typeof text === "string"
      ? text.trim()
      : text == null
        ? ""
        : String(text).trim();
  if (t.length === 0) {
    return { ok: false, reason: "The model returned empty text." };
  }
  for (const p of BLOCK_PATTERNS) {
    if (p.test(t)) {
      return {
        ok: false,
        reason:
          "Generated text matched a safety filter. Try template mode or generate again.",
      };
    }
  }
  return { ok: true };
}
