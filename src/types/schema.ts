/**
 * JSON schema for story content (see src/data/stories.json).
 * Placeholders in templates: {{friend1}}, {{friend2}}, {{family}}, {{plush}}, {{setting}}
 */

export type StoryTone = "gentle" | "silly";

/** One story spine: full narrative + optional improv kit sharing the same cast/setting fill. */
export interface StorySpine {
  id: string;
  /** For future filtering / themed packs */
  tags?: string[];
  tone?: StoryTone;
  titleTemplate: string;
  paragraphs: string[];
  improv: {
    titleTemplate: string;
    beats: string[];
    /** Optional “if they want more / sillier…” cues */
    branches?: string[];
  };
}

export interface StoryLibrary {
  version: number;
  spines: StorySpine[];
}

/** Quick-pick plush: short label in UI; phrase is how it appears in story text. */
export interface PlushPreset {
  id: string;
  label: string;
  phrase: string;
}

export interface SettingPreset {
  id: string;
  label: string;
  phrase: string;
}

export interface ContentCatalog {
  plushPresets: PlushPreset[];
  settingPresets: SettingPreset[];
}

export type OutputMode = "story" | "improv";

export interface CastInput {
  /** Comma- or space-separated friend names */
  friends: string;
  family: string;
  plushIds: string[];
  /** Extra plush names (comma- or space-separated), not from presets */
  plushExtra: string;
}

export interface FillContext {
  friend1: string;
  friend2: string;
  family: string;
  plush: string;
  setting: string;
}

export interface GeneratedOutput {
  spineId: string;
  title: string;
  body: string;
  improvTitle: string;
  improvBeats: string[];
  improvBranches: string[];
}
