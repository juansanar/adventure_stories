import type {
  FillContext,
  GeneratedOutput,
  OutputMode,
  StoryLibrary,
  StorySpine,
} from "../types/schema";
import { fillTemplate } from "./fill";
import { hashString } from "./hash";

function pickIndex(
  spines: StorySpine[],
  seedKey: string,
  avoidId: string | undefined,
): number {
  if (spines.length === 0) return 0;
  if (spines.length === 1) return 0;
  const h = hashString(seedKey);
  let idx = Math.abs(h) % spines.length;
  if (avoidId) {
    const avoidIdx = spines.findIndex((s) => s.id === avoidId);
    if (avoidIdx >= 0 && idx === avoidIdx) {
      idx = (idx + 1) % spines.length;
    }
  }
  return idx;
}

function fillContextKey(ctx: FillContext): string {
  return [ctx.friend1, ctx.friend2, ctx.family, ctx.plush, ctx.setting].join(
    "\0",
  );
}

export function generateFromLibrary(
  lib: StoryLibrary,
  ctx: FillContext,
  mode: OutputMode,
  pickSalt: string,
  lastSpineId: string | undefined,
): GeneratedOutput {
  const seedKey = [fillContextKey(ctx), mode, pickSalt].join("\0");
  const idx = pickIndex(lib.spines, seedKey, lastSpineId);
  const spine = lib.spines[idx];
  if (!spine) {
    return {
      spineId: "empty",
      title: "No stories yet",
      body: "Add story spines to the library.",
      improvTitle: "",
      improvBeats: [],
      improvBranches: [],
    };
  }

  const title = fillTemplate(spine.titleTemplate, ctx);
  const body = spine.paragraphs.map((p) => fillTemplate(p, ctx)).join("\n\n");
  const improvTitle = fillTemplate(spine.improv.titleTemplate, ctx);
  const improvBeats = spine.improv.beats.map((b) => fillTemplate(b, ctx));
  const improvBranches = (spine.improv.branches ?? []).map((b) =>
    fillTemplate(b, ctx),
  );

  return {
    spineId: spine.id,
    title,
    body,
    improvTitle,
    improvBeats,
    improvBranches,
  };
}

export function formatOutputForCopy(
  out: GeneratedOutput,
  mode: OutputMode,
): string {
  if (mode === "improv") {
    const lines = [
      out.improvTitle,
      "",
      ...out.improvBeats.map((b) => `• ${b}`),
    ];
    if (out.improvBranches.length > 0) {
      lines.push("", "More ideas:", ...out.improvBranches.map((b) => `• ${b}`));
    }
    return lines.join("\n");
  }
  return `${out.title}\n\n${out.body}`;
}
