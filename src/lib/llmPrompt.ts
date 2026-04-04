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
- Stories should have substantial variety and creativity. They should resemble the style of common and popular children stories from known authors (e.g. Robert Munsch, Julia Donaldson, Dr. Seuss, etc.).`;

const VARIETY_GROUNDING_AND_SHAPE = `Variety and plot shape:
- Invent one fresh, specific tiny mishap that fits the cast and setting. Do not reuse the same physical gag every time.
- Avoid stale “unstable structure” centerpieces unless the user’s stated setting clearly includes them: e.g. wobbly or teetering arches, bridges, towers, or stacks of objects. Prefer mix-ups about turns, funny sounds, small lost items, gentle misunderstandings, or something lightly stuck or tangled.
- Ground the story in the named characters and the stated setting. Do not introduce major new locations or props that contradict that setting.
- One clear gentle cause leads to a small escalation, then a cozy fix. Do not drop in unrelated magic objects or random twists unless they follow naturally from what already happened.`;

function buildGeminiSystemInstruction(mode: OutputMode): string {
  const formatRule =
    mode === "improv"
      ? `The user message asks for a labeled improv outline. Follow the user’s output format exactly (plain text, no markdown or code fences).`
      : `The user message asks for a read-aloud story. The very first line of your reply must be only \`TITLE: <short title>\` (literal word TITLE, colon, space, then a real title — never story prose on that line). Line 2 must be blank. Then the story paragraphs. Do not use markdown headings or bullet lists in the story body.`;

  return [
    SAFETY_RULES,
    READ_ALOUD_STYLE,
    VARIETY_GROUNDING_AND_SHAPE,
    formatRule,
  ].join("\n\n");
}

function buildGeminiUserMessage(ctx: FillContext, mode: OutputMode): string {
  const castBlock = `Cast (use these names and roles as given):
- First friend or group lead: ${ctx.friend1}
- Second friend or rest of friends: ${ctx.friend2}
- Family member: ${ctx.family}
- Plush friends: ${ctx.plush}
- Setting: ${ctx.setting}`;

  if (mode === "improv") {
    return `${castBlock}

Give a short improv outline for a parent to riff on live.

Output in exactly this labeled format (no markdown, no code fences). Line 1 must be a real title after TITLE:, not parentheses or instructions:
TITLE: <short title for this kit>
BEAT1: (one short sentence)
BEAT2: (one short sentence)
BEAT3: (one short sentence)
BEAT4: (one short sentence)
BRANCH: (one line: a "if they want sillier" optional twist)

Do not add any lines before TITLE:.`;
  }

  return `${castBlock}

Write one original short adventure story using the cast and setting.

Length (important):
- After TITLE, the story body should be about 250–350 words for read-aloud (several minutes aloud).
- Write 4–5 short paragraphs (not 1–2), each a few sentences, separated by blank lines.
- Do not stop after TITLE alone, and do not answer with only one sentence for the whole story.

Output format (required — do not copy the example title; invent your own):
Line 1: TITLE: <your short title here>   (example shape only: TITLE: The Pancake That Hiccuped)
Line 2: (blank)
Line 3 onward: story paragraphs as above

The first line must be the TITLE line only — do not start with "Once upon" or any story sentence before TITLE:. Do not use markdown headings or bullet lists in the story body.`;
}

export type GeminiCloudMessages = {
  systemInstruction: string;
  userMessage: string;
};

/** System + user messages for the Gemini API (cloud). */
export function buildGeminiCloudMessages(
  ctx: FillContext,
  mode: OutputMode,
): GeminiCloudMessages {
  return {
    systemInstruction: buildGeminiSystemInstruction(mode),
    userMessage: buildGeminiUserMessage(ctx, mode),
  };
}

/** Gemma on-device (MediaPipe) expects chat-style turn markers in the prompt string. */
function wrapGemmaTurn(userContent: string): string {
  return `<start_of_turn>user\n${userContent}<end_of_turn>\n<start_of_turn>model\n`;
}

/** Single user turn for Gemma: system rules + user task in one block (no API system role). */
export function buildGemmaOnDevicePrompt(
  ctx: FillContext,
  mode: OutputMode,
): string {
  const { systemInstruction, userMessage } = buildGeminiCloudMessages(
    ctx,
    mode,
  );
  const combined = `${systemInstruction}\n\n---\n\n${userMessage}`;
  return wrapGemmaTurn(combined);
}
