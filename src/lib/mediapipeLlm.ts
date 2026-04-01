import { MEDIAPIPE_WASM_CDN } from "../config/mediapipe";
import type { LlmInference } from "@mediapipe/tasks-genai";

let cached: LlmInference | null = null;
let cachedResolvedUrl: string | null = null;

export function resolveModelUrl(path: string): string {
  const p = path.trim();
  if (/^https?:\/\//i.test(p)) return p;
  if (p.startsWith("/")) {
    return `${window.location.origin}${p}`;
  }
  return new URL(p, document.baseURI).href;
}

export function releaseLlmInference(): void {
  try {
    cached?.close();
  } catch {
    /* ignore */
  }
  cached = null;
  cachedResolvedUrl = null;
}

export async function getLlmInference(modelPath: string): Promise<LlmInference> {
  const resolved = resolveModelUrl(modelPath);
  if (cached && cachedResolvedUrl === resolved) {
    return cached;
  }
  if (cached) {
    releaseLlmInference();
  }

  const { FilesetResolver, LlmInference: LlmInferenceCtor } = await import(
    "@mediapipe/tasks-genai"
  );

  const device = await LlmInferenceCtor.createWebGpuDevice();
  const wasm = await FilesetResolver.forGenAiTasks(MEDIAPIPE_WASM_CDN);

  const llm = await LlmInferenceCtor.createFromOptions(wasm, {
    baseOptions: {
      modelAssetPath: resolved,
      delegate: "GPU",
      gpuOptions: { device },
    },
    maxTokens: 512,
    topK: 40,
    temperature: 0.75,
    randomSeed: Math.floor(Math.random() * 2 ** 31),
  });

  cached = llm;
  cachedResolvedUrl = resolved;
  return llm;
}

export async function generateWithLlm(
  llm: LlmInference,
  prompt: string,
  onPartial?: (chunk: string, done: boolean) => void,
): Promise<string> {
  /** Do not call setOptions() with only sampler fields — MediaPipe can drop
   *  baseOptions.modelAssetPath and throw "No model asset provided." */
  let accumulated = "";
  /** Pending text not yet sent to UI (batched to limit React work). */
  let pending = "";
  let throttleId: ReturnType<typeof setTimeout> | null = null;
  let sawFirstToken = false;

  const STREAM_THROTTLE_MS = 24;

  const flushPending = () => {
    throttleId = null;
    if (pending.length === 0 || !onPartial) return;
    const out = pending;
    pending = "";
    onPartial(out, false);
  };

  const scheduleThrottle = () => {
    if (throttleId !== null) return;
    throttleId = window.setTimeout(flushPending, STREAM_THROTTLE_MS);
  };

  const listener =
    onPartial !== undefined
      ? (partial: string, done: boolean) => {
          const chunk =
            typeof partial === "string"
              ? partial
              : partial == null
                ? ""
                : String(partial);
          accumulated += chunk;
          if (done) {
            if (throttleId !== null) {
              window.clearTimeout(throttleId);
              throttleId = null;
            }
            pending += chunk;
            flushPending();
            onPartial("", true);
            return;
          }
          pending += chunk;
          if (chunk.length === 0) return;
          // First visible bytes: no wait for rAF / timer so the UI does not feel stuck.
          if (!sawFirstToken) {
            sawFirstToken = true;
            flushPending();
            return;
          }
          scheduleThrottle();
        }
      : undefined;
  const returned = listener
    ? await llm.generateResponse(prompt, listener)
    : await llm.generateResponse(prompt);
  const r = returned?.trim() ?? "";
  const a = accumulated.trim();
  return r || a;
}
