import { useCallback, useMemo, useState } from "react";
import catalogJson from "./data/catalog.json";
import storyLibraryJson from "./data/stories.json";
import {
  buildFillContext,
  formatPlushPhrase,
  parseNamesList,
} from "./lib/fill";
import { formatOutputForCopy, generateFromLibrary } from "./lib/generate";
import type {
  ContentCatalog,
  GeneratedOutput,
  OutputMode,
  StoryLibrary,
} from "./types/schema";
import "./App.css";

const storyLibrary = storyLibraryJson as StoryLibrary;
const catalog = catalogJson as ContentCatalog;

function readParams(): Record<string, string> {
  const p = new URLSearchParams(window.location.search);
  const o: Record<string, string> = {};
  p.forEach((v, k) => {
    o[k] = v;
  });
  return o;
}

function writeParams(next: Record<string, string>) {
  const p = new URLSearchParams();
  Object.entries(next).forEach(([k, v]) => {
    if (v) p.set(k, v);
  });
  const q = p.toString();
  const url = q ? `${window.location.pathname}?${q}` : window.location.pathname;
  window.history.replaceState(null, "", url);
}

function newPickSalt(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random()}`;
}

function matchSettingPresetId(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const byId = catalog.settingPresets.find((p) => p.id === t);
  if (byId) return byId.id;
  const legacy = catalog.settingPresets.find(
    (p) => p.phrase === t || p.label === t,
  );
  return legacy?.id ?? null;
}

function initialFromUrl(): {
  friends: string;
  family: string;
  plushIds: string[];
  plushExtra: string;
  settingPresetId: string;
  isSettingCustom: boolean;
  settingCustomText: string;
  mode: OutputMode;
} {
  const q = readParams();
  const friendsFromLegacy = [q.f1, q.f2].filter((x) => x?.trim()).join(", ");
  const friends =
    q.friends !== undefined ? q.friends : friendsFromLegacy;
  const plushIds = q.plush ? q.plush.split(",").filter(Boolean) : [];
  const plushExtra = q.plushExtra ?? "";

  let settingPresetId = "";
  let isSettingCustom = false;
  let settingCustomText = "";

  const place = q.place ?? "";
  if (place && catalog.settingPresets.some((s) => s.id === place)) {
    settingPresetId = place;
  } else if (place === "custom") {
    isSettingCustom = true;
    settingCustomText = q.setting ?? "";
  } else if (q.setting?.trim()) {
    const matched = matchSettingPresetId(q.setting);
    if (matched) {
      settingPresetId = matched;
    } else {
      isSettingCustom = true;
      settingCustomText = q.setting;
    }
  }

  const mode: OutputMode =
    q.mode === "improv" || q.mode === "story" ? q.mode : "story";

  return {
    friends,
    family: q.family ?? "",
    plushIds,
    plushExtra,
    settingPresetId,
    isSettingCustom,
    settingCustomText,
    mode,
  };
}

export default function App() {
  const init = useMemo(() => initialFromUrl(), []);
  const [friends, setFriends] = useState(init.friends);
  const [family, setFamily] = useState(init.family);
  const [plushIds, setPlushIds] = useState<string[]>(init.plushIds);
  const [plushExtra, setPlushExtra] = useState(init.plushExtra);
  const [settingPresetId, setSettingPresetId] = useState(init.settingPresetId);
  const [isSettingCustom, setIsSettingCustom] = useState(init.isSettingCustom);
  const [settingCustomText, setSettingCustomText] = useState(
    init.settingCustomText,
  );
  const [mode, setMode] = useState<OutputMode>(init.mode);
  const [lastSpineId, setLastSpineId] = useState<string | undefined>(undefined);
  const [output, setOutput] = useState<GeneratedOutput | null>(null);
  const [copyHint, setCopyHint] = useState<string | null>(null);

  const plushPhrases = useMemo(() => {
    const presetParts = plushIds
      .map((id) => catalog.plushPresets.find((p) => p.id === id)?.phrase)
      .filter((x): x is string => Boolean(x));
    const extraParts = parseNamesList(plushExtra)
      .map(formatPlushPhrase)
      .filter(Boolean);
    return [...presetParts, ...extraParts];
  }, [plushIds, plushExtra]);

  const settingPhrase = useMemo(() => {
    if (isSettingCustom) return settingCustomText;
    const p = catalog.settingPresets.find((s) => s.id === settingPresetId);
    return p?.phrase ?? "";
  }, [isSettingCustom, settingCustomText, settingPresetId]);

  const fillCtx = useMemo(
    () => buildFillContext(friends, family, plushPhrases, settingPhrase),
    [friends, family, plushPhrases, settingPhrase],
  );

  const syncUrl = useCallback(() => {
    writeParams({
      friends: friends.trim(),
      family: family.trim(),
      plush: plushIds.join(","),
      plushExtra: plushExtra.trim(),
      place: isSettingCustom
        ? "custom"
        : settingPresetId.trim(),
      setting: isSettingCustom ? settingCustomText.trim() : "",
      mode,
    });
  }, [
    friends,
    family,
    plushIds,
    plushExtra,
    isSettingCustom,
    settingPresetId,
    settingCustomText,
    mode,
  ]);

  const runGenerate = useCallback(
    (anotherVersion: boolean) => {
      const pickSalt = newPickSalt();
      const out = generateFromLibrary(
        storyLibrary,
        fillCtx,
        mode,
        pickSalt,
        anotherVersion ? lastSpineId : undefined,
      );
      setOutput(out);
      setLastSpineId(out.spineId);
      syncUrl();
    },
    [fillCtx, mode, lastSpineId, syncUrl],
  );

  const handleCopy = async () => {
    if (!output) return;
    const text = formatOutputForCopy(output, mode);
    try {
      await navigator.clipboard.writeText(text);
      setCopyHint("Copied");
      setTimeout(() => setCopyHint(null), 2000);
    } catch {
      setCopyHint("Select and copy");
    }
  };

  const handleCopyLink = async () => {
    syncUrl();
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyHint("Link copied");
      setTimeout(() => setCopyHint(null), 2000);
    } catch {
      setCopyHint("Copy address bar");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const togglePlush = (id: string) => {
    setPlushIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  return (
    <div className="app">
      <header className="header">
        <h1 className="title">Adventure stories</h1>
        <p className="lede">
          Short, gentle stories for little listeners. Pick a cast, add a place,
          then create a story or an improv kit to riff on.
        </p>
      </header>

      <main className="main">
        <section className="card" aria-labelledby="cast-heading">
          <h2 id="cast-heading" className="cardTitle">
            Who is in the story?
          </h2>
          <div className="fieldGrid">
            <label className="field fieldWide">
              <span className="label">Friends</span>
              <input
                className="input"
                value={friends}
                onChange={(e) => setFriends(e.target.value)}
                placeholder="Names separated by commas or spaces (e.g. Sam, Alex or Sam Alex)"
                autoComplete="off"
              />
            </label>
            <label className="field fieldWide">
              <span className="label">Family</span>
              <input
                className="input"
                value={family}
                onChange={(e) => setFamily(e.target.value)}
                placeholder="Mom, abuela, …"
                autoComplete="off"
              />
            </label>
          </div>

          <div className="plushBlock">
            <span className="label">Plush friends</span>
            <div className="chips" role="group" aria-label="Plush friends">
              {catalog.plushPresets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`chip ${plushIds.includes(p.id) ? "chipOn" : ""}`}
                  onClick={() => togglePlush(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <label className="field fieldWide plushExtraField">
              <span className="label">Other plush</span>
              <input
                className="input"
                value={plushExtra}
                onChange={(e) => setPlushExtra(e.target.value)}
                placeholder="Extra names, commas or spaces (e.g. dragon, pink whale)"
                autoComplete="off"
              />
            </label>
          </div>
        </section>

        <section className="card" aria-labelledby="place-heading">
          <h2 id="place-heading" className="cardTitle">
            Where does it happen?
          </h2>
          <div className="settingRow">
            <label className="field grow">
              <span className="label">Setting</span>
              {!isSettingCustom ? (
                <select
                  className="input"
                  value={settingPresetId}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "__custom__") {
                      setIsSettingCustom(true);
                      setSettingPresetId("");
                      setSettingCustomText("");
                    } else {
                      setSettingPresetId(v);
                    }
                  }}
                >
                  <option value="">Pick a place…</option>
                  {catalog.settingPresets.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                  <option value="__custom__">Custom…</option>
                </select>
              ) : (
                <input
                  className="input"
                  value={settingCustomText}
                  onChange={(e) => setSettingCustomText(e.target.value)}
                  placeholder="Describe the place"
                  autoComplete="off"
                />
              )}
            </label>
            {isSettingCustom && (
              <button
                type="button"
                className="btn btnGhost"
                onClick={() => {
                  setIsSettingCustom(false);
                  setSettingCustomText("");
                  setSettingPresetId("");
                }}
              >
                Use list
              </button>
            )}
          </div>
        </section>

        <section className="card" aria-labelledby="mode-heading">
          <h2 id="mode-heading" className="cardTitle">
            Output
          </h2>
          <div className="modeRow">
            <label className="radio">
              <input
                type="radio"
                name="mode"
                checked={mode === "story"}
                onChange={() => setMode("story")}
              />
              Full short story
            </label>
            <label className="radio">
              <input
                type="radio"
                name="mode"
                checked={mode === "improv"}
                onChange={() => setMode("improv")}
              />
              Improv kit (beats + ideas)
            </label>
          </div>

          <div className="actions">
            <button
              type="button"
              className="btn btnPrimary"
              onClick={() => runGenerate(false)}
            >
              Create story
            </button>
            <button
              type="button"
              className="btn btnSecondary"
              onClick={() => output && runGenerate(true)}
              disabled={!output}
            >
              Another version
            </button>
          </div>
        </section>

        {output && (
          <section
            className="card output printArea"
            aria-live="polite"
            id="story-output"
          >
            {mode === "story" ? (
              <>
                <h2 className="storyTitle">{output.title}</h2>
                <div className="storyBody">
                  {output.body.split("\n\n").map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>
              </>
            ) : (
              <>
                <h2 className="storyTitle">{output.improvTitle}</h2>
                <ul className="beats">
                  {output.improvBeats.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
                {output.improvBranches.length > 0 && (
                  <>
                    <h3 className="subhead">More ideas</h3>
                    <ul className="beats beatsMuted">
                      {output.improvBranches.map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}

            <div className="outputActions noPrint">
              {copyHint && <p className="hint">{copyHint}</p>}
              <button type="button" className="btn btnGhost" onClick={handleCopy}>
                Copy text
              </button>
              <button type="button" className="btn btnGhost" onClick={handleCopyLink}>
                Copy link
              </button>
              <button type="button" className="btn btnGhost" onClick={handlePrint}>
                Print
              </button>
            </div>
          </section>
        )}
      </main>

      <footer className="footer noPrint">
        <p>
          Names you type stay in this browser unless you share the link. This
          site does not send your story to a server.
        </p>
      </footer>
    </div>
  );
}
