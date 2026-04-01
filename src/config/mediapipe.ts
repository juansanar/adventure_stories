/** Pin WASM to the same major line as the installed npm package. */
export const MEDIAPIPE_TASKS_GENAI_VERSION = "0.10.26";

export const MEDIAPIPE_WASM_CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai@${MEDIAPIPE_TASKS_GENAI_VERSION}/wasm`;

/**
 * Default: Gemma-3n E2B int4 Web (smaller than E4B; good for MediaPipe Web + WebGPU).
 * Place the downloaded `.litertlm` in `public/models/` (see public/models/README.md).
 * Override with VITE_MEDIAPIPE_MODEL_URL (e.g. for E4B or a CDN URL).
 */
export const DEFAULT_MODEL_FILENAME = "gemma-3n-E2B-it-int4-Web.litertlm";

export function getConfiguredModelPath(): string {
  const fromEnv = import.meta.env.VITE_MEDIAPIPE_MODEL_URL as string | undefined;
  if (fromEnv?.trim()) return fromEnv.trim();
  const base = import.meta.env.BASE_URL;
  const normalized = base.endsWith("/") ? base : `${base}/`;
  return `${normalized}models/${DEFAULT_MODEL_FILENAME}`;
}
