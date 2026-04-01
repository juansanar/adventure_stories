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
    maxTokens: 640,
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
  let streamBuf = "";
  let streamRaf = 0;
  const flushStreamBuf = () => {
    streamRaf = 0;
    if (streamBuf.length === 0 || !onPartial) return;
    const out = streamBuf;
    streamBuf = "";
    onPartial(out, false);
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
            if (streamRaf) {
              cancelAnimationFrame(streamRaf);
              streamRaf = 0;
            }
            streamBuf += chunk;
            flushStreamBuf();
            onPartial("", true);
            return;
          }
          streamBuf += chunk;
          if (!streamRaf) {
            streamRaf = requestAnimationFrame(flushStreamBuf);
          }
        }
      : undefined;
  const returned = listener
    ? await llm.generateResponse(prompt, listener)
    : await llm.generateResponse(prompt);
  const r = returned?.trim() ?? "";
  const a = accumulated.trim();
  return r || a;
}
