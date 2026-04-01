import type { FillContext } from "../types/schema";

const PLACEHOLDER = {
  friend1: "a friend",
  friend2: "another friend",
  family: "someone from home",
  plush: "a soft friend",
  setting: "a cozy place",
} as const;

/** Split comma-separated names, or if no commas, split on whitespace. */
export function parseNamesList(raw: string): string[] {
  const t = raw.trim();
  if (!t) return [];
  if (t.includes(",")) {
    return t.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return t.split(/\s+/).filter(Boolean);
}

function joinNames(names: string[]): string {
  const cleaned = names.map((s) => s.trim()).filter(Boolean);
  if (cleaned.length === 0) return "";
  if (cleaned.length === 1) return cleaned[0];
  if (cleaned.length === 2) return `${cleaned[0]} and ${cleaned[1]}`;
  return `${cleaned.slice(0, -1).join(", ")}, and ${cleaned[cleaned.length - 1]}`;
}

export function assignFriendSlots(names: string[]): {
  friend1: string;
  friend2: string;
} {
  if (names.length === 0) {
    return { friend1: PLACEHOLDER.friend1, friend2: PLACEHOLDER.friend2 };
  }
  if (names.length === 1) {
    return { friend1: names[0], friend2: PLACEHOLDER.friend2 };
  }
  if (names.length === 2) {
    return { friend1: names[0], friend2: names[1] };
  }
  return {
    friend1: names[0],
    friend2: joinNames(names.slice(1)),
  };
}

/** Turn a custom plush name into story phrasing (e.g. "dragon" → "the dragon"). */
export function formatPlushPhrase(name: string): string {
  const t = name.trim();
  if (!t) return "";
  if (/^(the|a)\s/i.test(t)) return t;
  return `the ${t}`;
}

export function joinPlush(phrases: string[]): string {
  const list = Array.isArray(phrases) ? phrases : [];
  const cleaned = list.map((s) => s.trim()).filter(Boolean);
  if (cleaned.length === 0) return PLACEHOLDER.plush;
  if (cleaned.length === 1) return cleaned[0];
  if (cleaned.length === 2) return `${cleaned[0]} and ${cleaned[1]}`;
  return `${cleaned.slice(0, -1).join(", ")}, and ${cleaned[cleaned.length - 1]}`;
}

export function buildFillContext(
  friendsRaw: string,
  family: string,
  plushPhrases: string[],
  settingPhrase: string,
): FillContext {
  const names = parseNamesList(friendsRaw);
  const { friend1, friend2 } = assignFriendSlots(names);
  return {
    friend1,
    friend2,
    family: family.trim() || PLACEHOLDER.family,
    plush: joinPlush(plushPhrases),
    setting: settingPhrase.trim() || PLACEHOLDER.setting,
  };
}

export function fillTemplate(text: string, ctx: FillContext): string {
  return text
    .replaceAll("{{friend1}}", ctx.friend1)
    .replaceAll("{{friend2}}", ctx.friend2)
    .replaceAll("{{family}}", ctx.family)
    .replaceAll("{{plush}}", ctx.plush)
    .replaceAll("{{setting}}", ctx.setting);
}
