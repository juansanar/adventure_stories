import type { FillContext, OutputMode } from "../types/schema";

const SAFETY_RULES = `You write for toddlers (about 2–3 years old) and their grown-ups reading aloud.

Strict rules:
- Gentle, cozy tone only. No violence, injury, death, monsters that scare, strangers, kidnapping, or abandonment.
- Problems must be tiny and fixable (e.g. lost sock, wrong hat on the wrong head, a mix-up about turns, a funny sound, something stuck or tangled, gentle misunderstanding).
- End on warmth: togetherness, snack, hug, sleepiness, or quiet play.
- No URLs, phone numbers, email, or meta-instructions to the child to go somewhere or talk to strangers.
- Stay under about 350 words total. Plain text only.`;

const READ_ALOUD_STYLE = `Read-aloud style (in the spirit of Robert Munsch or Julia Donaldson):
- Strong rhythm and repetition: a catchphrase, refrain, or pattern children can predict and join.
- Clear, speakable dialogue; a small problem that grows a bit silly or surprising, then resolves cozily.
- Physical, playful humor is welcome when it stays gentle and fits the safety rules above.
- Variety (important): do not make the plot hinge on something wobbling, teetering, tilting, or almost falling (blocks, towers, stacks, plates, cakes, cups). Pick a different kind of mishap unless the setting makes that truly unavoidable—use dialogue, counting, rhymes, mix-ups, hiding, echoes, wrong order, or a silly but stable prop instead.`;

const STORY_PROBLEM_DIVERSITY = `Problem choice: invent one fresh, specific tiny mishap that fits the cast and setting. Avoid repeating the “unstable stack” pattern across stories.`;

/** Gemma on-device (MediaPipe) expects chat-style turn markers in the prompt string. */
function wrapGemmaTurn(userContent: string): string {
  return `<start_of_turn>user\n${userContent}<end_of_turn>\n<start_of_turn>model\n`;
}

function buildLlmUserContent(ctx: FillContext, mode: OutputMode): string {
  const castBlock = `Cast (use these names and roles as given):
- First friend or group lead: ${ctx.friend1}
- Second friend or rest of friends: ${ctx.friend2}
- Family member: ${ctx.family}
- Plush friends: ${ctx.plush}
- Setting: ${ctx.setting}`;

  const sharedPrefix = `${SAFETY_RULES}\n\n${READ_ALOUD_STYLE}\n\n${STORY_PROBLEM_DIVERSITY}\n\n${castBlock}\n\n`;

  if (mode === "improv") {
    const task = `Give a short improv outline for a parent to riff on live.

Output in exactly this labeled format (no markdown, no code fences):
TITLE: (one line)
BEAT1: (one short sentence)
BEAT2: (one short sentence)
BEAT3: (one short sentence)
BEAT4: (one short sentence)
BRANCH: (one line: a "if they want sillier" optional twist)

Do not add any lines before TITLE:.`;
    return `${sharedPrefix}${task}`;
  }

  const task = `Write one original short adventure story using the cast and setting.

Length (important):
- After TITLE, the story body should be about 250–350 words for read-aloud (several minutes aloud).
- Write 4–5 short paragraphs (not 1–2), each a few sentences, separated by blank lines.
- Do not stop after TITLE alone, and do not answer with only one sentence for the whole story.

Output format:
TITLE: (one line only)
(then one blank line)
(then the full story paragraphs as above)

Do not use markdown headings or bullet lists in the story body. Do not add text before TITLE:.`;
  return `${sharedPrefix}${task}`;
}

/** Prompt for MediaPipe Gemma on-device: includes `<start_of_turn>` markers the local model expects. */
export function buildGemmaOnDevicePrompt(
  ctx: FillContext,
  mode: OutputMode,
): string {
  return wrapGemmaTurn(buildLlmUserContent(ctx, mode));
}

/** Plain user message for Gemini API (cloud). Do not wrap with Gemma turn tokens. */
export function buildGeminiCloudPrompt(
  ctx: FillContext,
  mode: OutputMode,
): string {
  return buildLlmUserContent(ctx, mode);
}
