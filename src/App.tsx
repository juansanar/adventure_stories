import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import catalogJson from "./data/catalog.json";
import storyLibraryJson from "./data/stories.json";
import { getConfiguredModelPath } from "./config/mediapipe";
import {
  buildFillContext,
  formatPlushPhrase,
  parseNamesList,
} from "./lib/fill";
import { formatOutputForCopy, generateFromLibrary } from "./lib/generate";
import {
  normalizeLlmText,
  parseAiImprov,
  parseAiStory,
} from "./lib/aiOutputParse";
import {
  buildGemmaOnDevicePrompt,
  buildGeminiCloudMessages,
} from "./lib/llmPrompt";
import {
  generateWithLlm,
  getLlmInference,
  releaseLlmInference,
} from "./lib/mediapipeLlm";
import { screenAiOutput } from "./lib/outputFilter";
import { readUrlState, writeUrlState } from "./lib/urlState";
import { getWebGpuSupport, probeWebGpuAdapter } from "./lib/webgpu";
import type {
  ContentCatalog,
  GeneratedOutput,
  OutputMode,
  StoryLibrary,
} from "./types/schema";
import "./App.css";

const storyLibrary = storyLibraryJson as StoryLibrary;
const catalog = catalogJson as ContentCatalog;

type StorySource = "template" | "onDevice" | "gemini";
type LlmLoadStatus = "idle" | "loading" | "ready" | "error";

function newPickSalt(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random()}`;
}

/** Let the browser paint before long-running WASM work blocks the main thread. */
function yieldToPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
  });
}

/** Extra macrotask so spinner / progress card actually appear before WASM blocks the thread. */
function yieldToUi(): Promise<void> {
  return yieldToPaint().then(
    () =>
      new Promise((resolve) => {
        window.setTimeout(resolve, 64);
      }),
  );
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
  storySource: StorySource;
} {
  const q = readUrlState();
  const friendsFromLegacy = [q.f1, q.f2].filter((x) => x?.trim()).join(", ");
  const friends = q.friends !== undefined ? q.friends : friendsFromLegacy;
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

  const storySource: StorySource =
    q.source === "ai"
      ? "onDevice"
      : q.source === "gemini"
        ? "gemini"
        : "template";

  return {
    friends,
    family: q.family ?? "",
    plushIds,
    plushExtra,
    settingPresetId,
    isSettingCustom,
    settingCustomText,
    mode,
    storySource,
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
  const [storySource, setStorySource] = useState<StorySource>(init.storySource);
  const [lastSpineId, setLastSpineId] = useState<string | undefined>(undefined);
  const [output, setOutput] = useState<GeneratedOutput | null>(null);
  const [copyHint, setCopyHint] = useState<string | null>(null);

  const [llmStatus, setLlmStatus] = useState<LlmLoadStatus>("idle");
  const [llmError, setLlmError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiStreamText, setAiStreamText] = useState("");
  const [aiElapsedSec, setAiElapsedSec] = useState(0);
  const generatingStatusRef = useRef<HTMLDivElement>(null);
  const storyOutputRef = useRef<HTMLElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const aiStreamPreRef = useRef<HTMLPreElement>(null);
  /** Prevents overlapping runs before React re-renders disabled button state. */
  const aiGenerationLockRef = useRef(false);

  const modelPathDisplay = useMemo(() => getConfiguredModelPath(), []);

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

  const webGpuHint = useMemo(() => getWebGpuSupport(), []);

  useEffect(() => {
    setOutput(null);
    setLastSpineId(undefined);
    setCopyHint(null);
    setFeedback(null);
  }, [storySource]);

  useEffect(() => {
    if (storySource !== "onDevice") {
      aiGenerationLockRef.current = false;
      releaseLlmInference();
      setLlmStatus("idle");
      setLlmError(null);
      setAiStreamText("");
      setAiBusy(false);
    }
  }, [storySource]);

  useEffect(() => {
    if (!aiBusy) {
      setAiElapsedSec(0);
      return;
    }
    setAiElapsedSec(0);
    const t0 = Date.now();
    const id = window.setInterval(() => {
      setAiElapsedSec(Math.floor((Date.now() - t0) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [aiBusy]);

  useEffect(() => {
    const el = aiStreamPreRef.current;
    if (!el || !aiStreamText) return;
    el.scrollTop = el.scrollHeight;
  }, [aiStreamText]);

  const aiModelLoading =
    storySource === "onDevice" && llmStatus === "loading";
  const showStoryProgress = aiModelLoading || aiBusy;

  useEffect(() => {
    if (!showStoryProgress) return;
    const id = requestAnimationFrame(() => {
      const el = generatingStatusRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const visible =
        r.top < window.innerHeight && r.bottom > 0 && r.left < window.innerWidth && r.right > 0;
      if (visible) return;
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    return () => cancelAnimationFrame(id);
  }, [showStoryProgress]);

  useEffect(() => {
    if (!feedback) return;
    const id = requestAnimationFrame(() => {
      feedbackRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    });
    return () => cancelAnimationFrame(id);
  }, [feedback]);

  useEffect(() => {
    if (!output) return;
    const isAi =
      output.spineId === "ai-story" || output.spineId === "ai-improv";
    /** Immediate scroll yanks the viewport past the success banner (above the buttons). */
    const delayMs = isAi ? 200 : 950;
    const id = window.setTimeout(() => {
      storyOutputRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, delayMs);
    return () => window.clearTimeout(id);
  }, [output]);

  const syncUrl = useCallback(() => {
    writeUrlState({
      friends: friends.trim(),
      family: family.trim(),
      plush: plushIds.join(","),
      plushExtra: plushExtra.trim(),
      place: isSettingCustom ? "custom" : settingPresetId.trim(),
      setting: isSettingCustom ? settingCustomText.trim() : "",
      mode,
      source:
        storySource === "onDevice"
          ? "ai"
          : storySource === "gemini"
            ? "gemini"
            : "",
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
    storySource,
  ]);

  const runGenerateTemplate = useCallback(
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

  const handleLoadLlm = useCallback(async () => {
    setLlmError(null);
    setFeedback(null);
    setLlmStatus("loading");
    await yieldToUi();
    const probe = await probeWebGpuAdapter();
    if (!probe.supported) {
      setLlmStatus("error");
      setLlmError(probe.detail);
      return;
    }
    try {
      await getLlmInference(getConfiguredModelPath());
      setLlmStatus("ready");
      setFeedback("Model loaded. You can now create a story.");
    } catch (e) {
      setLlmStatus("error");
      const msg = e instanceof Error ? e.message : String(e);
      setLlmError(
        `${msg} If the file is missing, add a Web-format .litertlm model under public/models/ (see public/models/README.md) or set VITE_MEDIAPIPE_MODEL_URL.`,
      );
    }
  }, []);

  const runGenerateAi = useCallback(async () => {
    if (aiGenerationLockRef.current) {
      setFeedback("Already writing a story — wait for it to finish.");
      return;
    }
    if (llmStatus === "loading") {
      setFeedback("The AI model is still loading. Please wait a bit.");
      return;
    }
    if (llmStatus !== "ready") {
      setFeedback(
        "Load the AI model first (use the button in the panel above), then click Create story again.",
      );
      return;
    }
    aiGenerationLockRef.current = true;
    setAiBusy(true);
    setLlmError(null);
    setFeedback(null);
    setAiStreamText("");
    setCopyHint(null);
    await yieldToUi();
    await yieldToUi();
    try {
      const llm = await getLlmInference(getConfiguredModelPath());
      const prompt = buildGemmaOnDevicePrompt(fillCtx, mode);
      await yieldToUi();
      const fullText = await generateWithLlm(llm, prompt, (partial) => {
        if (partial) {
          setAiStreamText((prev) => prev + partial);
        }
      });
      setAiStreamText("");
      const text = normalizeLlmText(fullText);
      const screened = screenAiOutput(text);
      if (!screened.ok) {
        setLlmError(screened.reason);
        setFeedback(screened.reason);
        return;
      }
      try {
        if (mode === "improv") {
          const parsed = parseAiImprov(text);
          setOutput({
            spineId: "ai-improv",
            title: parsed.title,
            body: "",
            improvTitle: parsed.title,
            improvBeats: parsed.beats,
            improvBranches: parsed.branches,
          });
        } else {
          const parsed = parseAiStory(text);
          setOutput({
            spineId: "ai-story",
            title: parsed.title,
            body: parsed.body,
            improvTitle: "",
            improvBeats: [],
            improvBranches: [],
          });
        }
        setLastSpineId(undefined);
        syncUrl();
      } catch (parseErr) {
        const pe =
          parseErr instanceof Error ? parseErr.message : String(parseErr);
        const parseMsg = `The model returned text we could not turn into a story. ${pe}`;
        setLlmError(parseMsg);
        setFeedback(parseMsg);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setLlmError(msg);
      setFeedback(msg);
    } finally {
      aiGenerationLockRef.current = false;
      setAiBusy(false);
    }
  }, [fillCtx, llmStatus, mode, syncUrl]);

  const runGenerateGemini = useCallback(async () => {
    if (aiGenerationLockRef.current) {
      setFeedback("Already writing a story — wait for it to finish.");
      return;
    }

    aiGenerationLockRef.current = true;
    setAiBusy(true);
    setLlmError(null);
    setFeedback(null);
    setAiStreamText("");
    setCopyHint(null);
    await yieldToUi();
    await yieldToUi();

    try {
      const { systemInstruction, userMessage } = buildGeminiCloudMessages(
        fillCtx,
        mode,
      );
      const resp = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemInstruction, userMessage }),
      });

      if (!resp.ok) {
        const msg = await resp.text().catch(() => "");
        throw new Error(`Gemini request failed (${resp.status}): ${msg}`);
      }

      const data = (await resp.json().catch(() => ({}))) as
        | { text?: string }
        | undefined;
      const fullText = data?.text ?? "";

      const text = normalizeLlmText(fullText);
      const screened = screenAiOutput(text);
      if (!screened.ok) {
        setLlmError(screened.reason);
        setFeedback(screened.reason);
        return;
      }

      try {
        if (mode === "improv") {
          const parsed = parseAiImprov(text);
          setOutput({
            spineId: "ai-improv",
            title: parsed.title,
            body: "",
            improvTitle: parsed.title,
            improvBeats: parsed.beats,
            improvBranches: parsed.branches,
          });
        } else {
          const parsed = parseAiStory(text);
          setOutput({
            spineId: "ai-story",
            title: parsed.title,
            body: parsed.body,
            improvTitle: "",
            improvBeats: [],
            improvBranches: [],
          });
        }
        setLastSpineId(undefined);
        syncUrl();
      } catch (parseErr) {
        const pe =
          parseErr instanceof Error ? parseErr.message : String(parseErr);
        const parseMsg = `The model returned text we could not turn into a story. ${pe}`;
        setLlmError(parseMsg);
        setFeedback(parseMsg);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setLlmError(msg);
      setFeedback(msg);
    } finally {
      aiGenerationLockRef.current = false;
      setAiBusy(false);
    }
  }, [fillCtx, mode, syncUrl]);

  const handleCreateStory = useCallback(() => {
    if (storySource === "template") {
      flushSync(() => {
        runGenerateTemplate(false);
      });
      setFeedback("Story ready — scroll down to read it.");
      return;
    }
    if (storySource === "onDevice") {
      void runGenerateAi();
      return;
    }
    void runGenerateGemini();
  }, [runGenerateAi, runGenerateGemini, runGenerateTemplate, storySource]);

  const handleAnotherVersion = useCallback(() => {
    if (!output) return;
    if (storySource === "template") {
      flushSync(() => {
        runGenerateTemplate(true);
      });
      setFeedback("New version ready — scroll down to read it.");
    } else {
      if (storySource === "onDevice") {
        void runGenerateAi();
        return;
      }
      void runGenerateGemini();
    }
  }, [
    output,
    runGenerateAi,
    runGenerateGemini,
    runGenerateTemplate,
    storySource,
  ]);

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

  const createDisabled = aiBusy;
  const createTitle = aiBusy
    ? "Still generating — look for the progress card below."
    : undefined;

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

          <div className="sourceBlock">
            <span className="label">Story source</span>
            <div className="modeRow">
              <label className="radio">
                <input
                  type="radio"
                  name="source"
                  checked={storySource === "template"}
                  onChange={() => setStorySource("template")}
                />
                Template library (offline-friendly)
              </label>
              <label className="radio">
                <input
                  type="radio"
                  name="source"
                  checked={storySource === "onDevice"}
                  onChange={() => setStorySource("onDevice")}
                />
                On-device AI (WebGPU + local model)
              </label>
              <label className="radio">
                <input
                  type="radio"
                  name="source"
                  checked={storySource === "gemini"}
                  onChange={() => setStorySource("gemini")}
                />
                Gemini (cloud)
              </label>
            </div>
          </div>

          {storySource === "onDevice" && (
            <div className="aiPanel">
              <p className="aiPanelText">
                <strong>WebGPU:</strong> {webGpuHint.detail}
              </p>
              <p className="aiPanelText aiPanelMono">
                Model path: {modelPathDisplay}
              </p>
              <p className="aiPanelText">
                First generation on this device can take{" "}
                <strong>several minutes</strong> (large local model + WebGPU). The
                page may look idle until tokens start streaming.
              </p>
              {(llmStatus === "idle" || llmStatus === "error") && (
                <button
                  type="button"
                  className="btn btnSecondary"
                  onClick={() => void handleLoadLlm()}
                >
                  {llmStatus === "error" ? "Try loading the model again" : "Load AI model"}
                </button>
              )}
              {llmStatus === "loading" && (
                <p className="aiStatus aiStatusRow" role="status">
                  <span className="spinner aiPanelSpinner" aria-hidden />
                  Loading model and GPU runtime (first time can take a while)…
                </p>
              )}
              {llmStatus === "ready" && (
                <p className="aiStatus aiStatusOk" role="status">
                  Model ready. Inference runs on this device only.
                </p>
              )}
              {llmError ? (
                <p className="aiStatus aiStatusErr" role="alert">
                  {llmError}
                </p>
              ) : null}
              {aiBusy && (
                <div className="aiStreaming" aria-live="polite">
                  <p className="aiStreamingLabel">
                    Generating…
                    {aiElapsedSec > 0 ? ` (${aiElapsedSec}s)` : ""}
                  </p>
                  {!aiStreamText ? (
                    <p className="aiPanelText aiStreamingHint">
                      Still working — prefill is often slow before any text
                      appears.
                    </p>
                  ) : null}
                  {aiStreamText ? (
                    <pre
                      ref={aiStreamPreRef}
                      className="aiStreamingPre"
                    >
                      {aiStreamText}
                    </pre>
                  ) : null}
                </div>
              )}
            </div>
          )}

          <div className="actions">
            <button
              type="button"
              className={`btn btnPrimary${aiBusy ? " btnWithSpinner" : ""}`}
              onClick={handleCreateStory}
              disabled={createDisabled}
              aria-busy={aiBusy}
              title={createTitle}
            >
              {aiBusy ? (
                <>
                  <span className="spinner btnSpinner" aria-hidden />
                  {mode === "improv" ? "Writing kit…" : "Creating story…"}
                </>
              ) : (
                "Create story"
              )}
            </button>
            <button
              type="button"
              className={`btn btnSecondary${aiBusy ? " btnWithSpinner" : ""}`}
              onClick={handleAnotherVersion}
              disabled={!output || createDisabled}
              aria-busy={aiBusy}
            >
              {aiBusy ? (
                <>
                  <span className="spinner btnSpinner" aria-hidden />
                  Working…
                </>
              ) : (
                "Another version"
              )}
            </button>
          </div>

          {feedback ? (
            <div
              ref={feedbackRef}
              className="statusBanner"
              role="status"
              aria-live="assertive"
            >
              {feedback}
            </div>
          ) : null}

          {storySource === "onDevice" && !aiBusy && !feedback && (
            <>
              {llmStatus === "idle" && (
                <p className="actionsHint actionsHintSteps">
                  <strong>On-device mode:</strong> tap{" "}
                  <strong>Load AI model</strong> in the panel above and wait
                  until it says &quot;Model ready&quot;, then tap Create story.
                </p>
              )}
              {llmStatus === "loading" && (
                <p className="actionsHint">
                  Loading the model… you can use Create story when it finishes.
                </p>
              )}
              {llmStatus === "error" && (
                <p className="actionsHint">
                  Fix the red message in the AI panel, then tap Load AI model
                  again.
                </p>
              )}
            </>
          )}
        </section>

        {showStoryProgress && (
          <section
            ref={generatingStatusRef}
            id="story-generating-status"
            className="card generatingCard"
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label={
              aiModelLoading ? "Loading AI model" : "Generating story"
            }
          >
            <div className="generatingCardInner">
              <span className="spinner generatingSpinner" aria-hidden />
              <div className="generatingCardBody">
                {aiModelLoading ? (
                  <>
                    <p className="generatingCardTitle">Loading AI model</p>
                    <p className="generatingCardMeta">
                      Preparing WebGPU and your local model — first time can
                      take a minute or more.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="generatingCardTitle">
                      {mode === "improv"
                        ? "Writing your improv kit"
                        : "Writing your story"}
                    </p>
                    <p className="generatingCardMeta">
                      {aiElapsedSec > 0 ? (
                        <>
                          <strong>{aiElapsedSec}s</strong>
                          {" · "}
                        </>
                      ) : null}
                      On-device generation can take several minutes. Keep this
                      tab open until it finishes.
                    </p>
                  </>
                )}
              </div>
            </div>
          </section>
        )}

        {output && (
          <section
            ref={storyOutputRef}
            className={`card output printArea${aiBusy ? " outputPending" : ""}`}
            aria-live="polite"
            id="story-output"
          >
            {mode === "story" ? (
              <>
                <h2 className="storyTitle">
                  {String(output.title ?? "Story")}
                </h2>
                <div className="storyBody">
                  {String(output.body ?? "")
                    .split("\n\n")
                    .map((para, i) => (
                      <p key={i}>{para}</p>
                    ))}
                </div>
              </>
            ) : (
              <>
                <h2 className="storyTitle">
                  {String(output.improvTitle ?? "Improv kit")}
                </h2>
                <ul className="beats">
                  {(Array.isArray(output.improvBeats)
                    ? output.improvBeats
                    : []
                  ).map((b, i) => (
                    <li key={i}>{String(b)}</li>
                  ))}
                </ul>
                {Array.isArray(output.improvBranches) &&
                  output.improvBranches.length > 0 && (
                    <>
                      <h3 className="subhead">More ideas</h3>
                      <ul className="beats beatsMuted">
                        {output.improvBranches.map((b, i) => (
                          <li key={i}>{String(b)}</li>
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
        {storySource === "onDevice" ? (
          <p>
            Template mode sends nothing to a server. On-device AI runs entirely
            in your browser with WebGPU; prompts and generated text are not sent
            to this app&apos;s server. Shared links encode cast and setting in the
            URL hash (not plain text); anyone with the link can still decode it.
            Story text is not in the link unless you paste it elsewhere.
          </p>
        ) : storySource === "gemini" ? (
          <p>
            Shared links store cast and setting in an encoded URL hash. When
            you generate with Gemini (cloud), your prompt and generated story
            are sent to your backend and then to Google&apos;s Gemini API. Your
            story text is not stored in the link.
          </p>
        ) : (
          <p>
            Shared links store cast and setting in an encoded URL hash, not as
            readable query parameters. This site does not send your story to a
            server.
          </p>
        )}
      </footer>
    </div>
  );
}
