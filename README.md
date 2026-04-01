# Adventure stories

A small web app that fills **gentle, short adventure stories** (or **improv kits**) from a cast you choose: friends, family, plush animals, and an optional setting.

- **Template library** (default): generation runs **only in your browser** from JSON templates—no API keys, no model download.
- **On-device AI** (optional): uses [MediaPipe LLM Inference for Web](https://ai.google.dev/edge/mediapipe/solutions/genai/llm_inference/web_js) with **WebGPU** and a **local `.litertlm` model** you host; inference stays in the browser.

## Quick start

```bash
npm install
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:5173`).

## On-device AI setup

1. Use a **Web**-converted Gemma model (see [Google’s Web LLM guide](https://ai.google.dev/edge/mediapipe/solutions/genai/llm_inference/web_js) and Hugging Face).
2. Place the file in [`public/models/`](public/models/README.md) as `gemma-3n-E2B-it-int4-Web.litertlm` (default), **or** set in `.env`:

   `VITE_MEDIAPIPE_MODEL_URL=https://your-cdn.example.com/path/model.litertlm`

3. In the app, choose **On-device AI**, click **Load AI model**, then **Create story**. Requires a **WebGPU-capable** browser.

Large models are **gitignored**; see [`public/models/README.md`](public/models/README.md).

## Build

```bash
npm run build
```

Output is written to `dist/`. The Vite config uses `base: "./"` so assets resolve on static hosts and subpaths.

## Lint

```bash
npm run lint
```

## Content

- Story templates and improv beats: [`src/data/stories.json`](src/data/stories.json)
- Plush and setting quick picks: [`src/data/catalog.json`](src/data/catalog.json)
- TypeScript types and placeholders: [`src/types/schema.ts`](src/types/schema.ts)
- JSON Schema (for editors/validation): [`src/data/stories.schema.json`](src/data/stories.schema.json)

Placeholders in templates: `{{friend1}}`, `{{friend2}}`, `{{family}}`, `{{plush}}`, `{{setting}}`.

**Share links** (after **Copy link**): `friends`, `family`, `plush`, `plushExtra`, `place`, `setting`, `mode`, and `source=ai` when on-device mode is selected. Legacy `f1` / `f2` are still read if `friends` is absent.

## Deploy (GitHub Pages)

1. Push this repo to GitHub.
2. In **Settings → Pages**, set **Source** to **GitHub Actions**.
3. Ensure the default branch is `main` or `master` (matching [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml)).
4. After the workflow runs, the site URL appears in the workflow summary.

If the site loads blank, confirm **Pages** uses the artifact from Actions and that `base` in `vite.config.ts` matches how the site is hosted (this project uses relative `./`).

If you use on-device AI in production, **host the model** where bandwidth allows (CDN recommended). The GitHub Pages artifact can include `public/models/*.litertlm` only if you deliberately add the file (it is large).

## LLM documentation

[`docs/LLM_PHASE.md`](docs/LLM_PHASE.md) covers on-device vs hosted API, costs, privacy, and analytics.

## Privacy

Template mode: names stay in the browser unless you use **Copy link** (query string). On-device AI: the model runs locally; do not add analytics that log prompts or stories. See the in-app footer when AI mode is selected.
