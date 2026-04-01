# On-device model (MediaPipe LLM)

Place a **Web-converted** Gemma model file here so the optional on-device AI story mode can load it.

## Recommended file

Per [Google AI Edge — LLM Inference for Web](https://ai.google.dev/edge/mediapipe/solutions/genai/llm_inference/web_js), use a build whose name includes **`Web`**. This repo defaults to the smaller **E2B** Web file; **E4B** is also fine if you set `VITE_MEDIAPIPE_MODEL_URL`.

**E2B (default in app config):** repo [`google/gemma-3n-E2B-it-litert-lm`](https://huggingface.co/google/gemma-3n-E2B-it-litert-lm), file `gemma-3n-E2B-it-int4-Web.litertlm`.

**E4B (larger):** repo [`google/gemma-3n-E4B-it-litert-lm`](https://huggingface.co/google/gemma-3n-E4B-it-litert-lm), file `gemma-3n-E4B-it-int4-Web.litertlm`.

Default expected filename in `public/models/`:

`gemma-3n-E2B-it-int4-Web.litertlm`

## Custom path or URL

Set `VITE_MEDIAPIPE_MODEL_URL` in `.env` to an absolute `https://…` URL or a path served by your site (see [README](../../README.md)).

## Size and licensing

Models are large (hundreds of MB or more). Follow Gemma and Google Generative AI terms for your use case. `*.litertlm` files are gitignored so they are not committed by mistake.
