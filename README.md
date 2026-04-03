# Adventure stories

A small web app that fills **gentle, short adventure stories** (or **improv kits**) from a cast you choose: friends, family, plush animals, and an optional setting.

- **Template library** (default): generation runs **only in your browser** from JSON templates—no API keys, no model download.
- **On-device AI** (optional): uses [MediaPipe LLM Inference for Web](https://ai.google.dev/edge/mediapipe/solutions/genai/llm_inference/web_js) with **WebGPU** and a **local `.litertlm` model** you host; inference stays in the browser.
- **Gemini (cloud)** (optional): generation calls a backend API that uses your Gemini Developer API key (the key is never in the browser).

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

## Gemini (cloud) setup

This mode sends your generated **prompt** to the backend endpoint `POST /api/generate`, which calls the Gemini Developer API. The API key is stored server-side (for example, in Cloud Run Secret Manager).

### Local dev

Run both processes:

```bash
npm run dev
GEMINI_API_KEY="YOUR_KEY" GEMINI_MODEL="gemini-2.5-flash" npm run server
```

The Vite dev server proxies `/api` to `http://localhost:8080`.

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

**Share links** (after **Copy link**): `friends`, `family`, `plush`, `plushExtra`, `place`, `setting`, `mode`, and `source=ai` (on-device) or `source=gemini` (cloud Gemini) in the encoded URL hash. Legacy `f1` / `f2` are still read if `friends` is absent.

## Deploy (Cloud Run — recommended for Gemini)

The container serves the static app from `dist/` and `POST /api/generate` on the same origin (see [`Dockerfile`](Dockerfile)).

### One-time (Google Cloud)

1. Enable **Artifact Registry** and **Cloud Run** (and **Secret Manager**) for your project.
2. Create an Artifact Registry **Docker** repository (note its **repository id**).
3. Create a Secret Manager secret named **`gemini-api-key`** whose value is your Gemini Developer API key.
4. Grant the **Cloud Run default runtime service account** (or the service account your revision uses) **`roles/secretmanager.secretAccessor`** on that secret.
5. Create a **CI deployer** service account for GitHub Actions with at least:
   - `roles/run.admin`
   - `roles/artifactregistry.writer`
   - `roles/iam.serviceAccountUser` on the Cloud Run runtime service account (so deploy can set the revision identity)
6. Create a JSON key for that CI service account and add it as GitHub secret **`GCP_SA_KEY`**.

### GitHub Actions variables

In **Settings → Secrets and variables → Actions → Variables**, set:

| Variable | Example | Purpose |
|----------|---------|---------|
| `GCP_PROJECT_ID` | `my-project-123` | GCP project |
| `GCP_REGION` | `us-central1` | Cloud Run + Artifact Registry host |
| `ARTIFACT_REGISTRY_REPO` | `docker-repo` | Artifact Registry **repository id** |
| `CLOUD_RUN_SERVICE` | `adventure-stories` | Cloud Run service name |

Push to `main` (or run **Deploy to Cloud Run** manually). If variables/secret are missing, the workflow is **skipped** so forks do not fail CI.

## Deploy (GitHub Pages — optional static only)

GitHub Pages cannot run the Gemini API server; use it only for **template mode** (or host the SPA elsewhere and point a separate API URL — not configured in this repo).

1. Run the **Deploy to GitHub Pages** workflow manually (`.github/workflows/deploy-pages.yml`).
2. In **Settings → Pages**, set **Source** to **GitHub Actions** if prompted.

If the site loads blank, confirm **Pages** uses the artifact from Actions and that `base` in `vite.config.ts` matches how the site is hosted (this project uses relative `./`).

If you use on-device AI in production, **host the model** where bandwidth allows (CDN recommended). The GitHub Pages artifact can include `public/models/*.litertlm` only if you deliberately add the file (it is large).

## LLM documentation

[`docs/LLM_PHASE.md`](docs/LLM_PHASE.md) covers on-device vs hosted API, costs, privacy, and analytics.

## Privacy

Template mode: names stay in the browser unless you use **Copy link** (encoded hash). On-device AI: the model runs locally. **Gemini (cloud)** sends the prompt to your server and then to Google’s API; see the in-app footer when that mode is selected.
