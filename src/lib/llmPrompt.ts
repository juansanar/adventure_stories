import type { FillContext, OutputMode } from "../types/schema";

const SAFETY_RULES = `You write for toddlers (about 2–3 years old) and their grown-ups reading aloud.

Strict rules:
- Gentle, cozy tone only. No violence, injury, death, monsters that scare, strangers, kidnapping, or abandonment.
- Problems must be tiny and fixable (lost sock, wobbly tower, gentle misunderstanding).
- End on warmth: togetherness, snack, hug, sleepiness, or quiet play.
- No URLs, phone numbers, email, or meta-instructions to the child to go somewhere or talk to strangers.
- Stay under about 350 words total. Plain text only.`;

const READ_ALOUD_STYLE = `Read-aloud style (in the spirit of Robert Munsch or Julia Donaldson):
- Strong rhythm and repetition: a catchphrase, refrain, or pattern children can predict and join.
- Clear, speakable dialogue; a small problem that grows a bit silly or surprising, then resolves cozily.
- Physical, playful humor is welcome when it stays gentle and fits the safety rules above.`;

function wrapGemmaTurn(userContent: string): string {
  return `<start_of_turn>user\n${userContent}<end_of_turn>\n<start_of_turn>model\n`;
}

export function buildLlmPrompt(ctx: FillContext, mode: OutputMode): string {
  const castBlock = `Cast (use these names and roles as given):
- First friend or group lead: ${ctx.friend1}
- Second friend or rest of friends: ${ctx.friend2}
- Family member: ${ctx.family}
- Plush friends: ${ctx.plush}
- Setting: ${ctx.setting}`;

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
    return wrapGemmaTurn(
      `${SAFETY_RULES}\n\n${READ_ALOUD_STYLE}\n\n${castBlock}\n\n${task}`,
    );
  }

  const task = `Write one original short adventure story using the cast and setting.

Output format:
TITLE: (one line only)
(then one blank line)
(then 3–5 short paragraphs for read-aloud, separated by blank lines)

Do not use markdown headings or bullet lists in the story body. Do not add text before TITLE:.`;
  return wrapGemmaTurn(
    `${SAFETY_RULES}\n\n${READ_ALOUD_STYLE}\n\n${castBlock}\n\n${task}`,
  );
}
