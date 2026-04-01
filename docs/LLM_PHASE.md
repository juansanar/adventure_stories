# LLM options for Adventure Stories

The app supports two ways to add model-generated text: **on-device** (implemented in the UI as “On-device AI”) and **hosted API** (not wired in this repo; pattern below).

## On-device (MediaPipe LLM Inference for Web)

Uses [`@mediapipe/tasks-genai`](https://ai.google.dev/edge/mediapipe/solutions/genai/llm_inference/web_js) in the browser with **WebGPU**. WASM is loaded from jsDelivr (pinned to the same npm version as in `package.json`). The **model weights** (`.litertlm`) are fetched from your static host or from `VITE_MEDIAPIPE_MODEL_URL`.

**Costs:** No per-token cloud bill for inference. You pay for **hosting bandwidth** when users download the model (often hundreds of MB or more). Users pay in **device memory, GPU time, and battery**.

**Privacy (network):** Prompts and completions stay on the device for the model step—nothing is sent to *your* app server for generation. Third parties involved:

- **jsDelivr** serves MediaPipe WASM (no story content).
- **Your CDN/origin** serves the model file (no story content in the file itself).

**Privacy (still your responsibility):**

- Do **not** add analytics that logs prompts, outputs, or names.
- **Share links** still put cast data in query strings (unchanged from template mode).
- A compromised browser or extension is outside this app’s threat model; on-device is not “encrypted,” it is **not transmitted to your backend**.

**Safety:** The UI applies a small **output filter** before display. Models can still misbehave; keep **template mode** as the reliable default and supervise read-aloud.

**Code map:** `src/lib/mediapipeLlm.ts`, `src/lib/llmPrompt.ts`, `src/lib/outputFilter.ts`, `src/config/mediapipe.ts`, `public/models/README.md`.

## Hosted API (optional future path)

If you later call **Gemini / OpenAI / etc.** from a **serverless function**:

- **Never** ship API keys in the client bundle.
- Cap `max_tokens`, add quotas, and avoid logging child names in production analytics.
- Add clear privacy copy: data transits the provider under their terms.

This path has recurring **usage cost** and stronger **data-processing** obligations than on-device inference.

## Analytics guidance (both paths)

- Prefer **aggregate** events only (e.g. “generate_clicked”, “model_load_failed”).
- Never attach `prompt`, `completion`, `friends`, or URL query payloads to analytics payloads.
