# Adventure stories

A small web app that fills **gentle, short adventure stories** (or **improv kits**) from a cast you choose: friends, family, plush animals, and an optional setting.

- **Template library** (default): generation runs **only in your browser** from JSON templates—no API keys, no model download.
- **On-device AI** (optional): uses [MediaPipe LLM Inference for Web](https://ai.google.dev/edge/mediapipe/solutions/genai/llm_inference/web_js) with **WebGPU** and a **local `.litertlm` model** you host; inference stays in the browser.
- **Gemini (cloud)** (optional): generation calls a backend API that uses your Gemini Developer API key (the key is never in the browser).

## Quick start

**Run all `npm` commands from the repository root**—the directory that contains this project’s `package.json` (e.g. `adventure_stories`), not your home folder. If npm looks for `/Users/you/package.json` or says **ENOENT** / **Could not read package.json**, your shell is in the wrong directory; `cd` into the clone first.

```bash
cd /path/to/adventure_stories   # example: cd ~/GitHub/adventure_stories
npm install
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:5173`).

That is enough for **Template library** mode. For **Gemini (cloud)** you also need the API server and its dependencies—see [Local testing](#local-testing).

## Local testing

How you run the app depends on which **story source** you select in the UI.

### Template library (default)

1. `npm install`
2. `npm run dev`
3. Open the URL Vite prints (e.g. `http://localhost:5173/`).
4. Leave the source on **Template library** and use **Create story**.

No API key and no `server/` install required.

### Gemini (cloud)

The browser only talks to **Vite**; Vite **proxies** `/api/*` to the Express app in [`server/`](server/). You need **both** processes running, with a valid **`GEMINI_API_KEY`** on the server process.

**One-time:** install dependencies for the API (in addition to root `npm install`):

```bash
npm --prefix server install
```

**Run (pick one):**

| Approach | Command |
|----------|---------|
| **Single command** (recommended) | `GEMINI_API_KEY="YOUR_KEY" npm run dev:with-api` |
| **Two terminals** | Terminal 1: `npm run dev` — Terminal 2: `GEMINI_API_KEY="YOUR_KEY" npm run server` |

Then:

1. Open the **Vite** URL (usually `http://localhost:5173/`), **not** port 8080—the API is not set up for arbitrary browser origins without the proxy.
2. Choose **Gemini (cloud)** in the app, then **Create story**.

**Ports**

- Default API port is **8080**. Vite reads **`API_PORT`** when building the proxy target (see [`vite.config.ts`](vite.config.ts)); the server uses **`PORT`** (e.g. on Cloud Run) or **`API_PORT`** or **8080** (see [`server/index.mjs`](server/index.mjs)).
- If **8080 is already in use** (`EADDRINUSE`), stop the old server or move **both** sides to the same alternate port, e.g. `API_PORT=8081 GEMINI_API_KEY="YOUR_KEY" npm run dev:with-api`.
- On macOS you can free 8080 with: `lsof -ti :8080 | xargs kill` (only if you know it is safe to stop that process).
- If **5173** is busy, Vite picks **5174**, **5175**, etc.—always use the URL printed in the terminal.

**When “Create story” fails**

| Symptom | Likely cause |
|---------|----------------|
| **`ENOENT` / Could not read `package.json`** (path under your **home** directory, not the repo) | You ran `npm` outside the project. `cd` to the folder that contains **`adventure_stories/package.json`**, then run the command again. |
| **Failed to fetch** | API not running, or **API_PORT** mismatch between Vite and server. |
| **500** / “Missing **GEMINI_API_KEY**” | Server started without the key; put `GEMINI_API_KEY=...` on the same line as `npm run dev:with-api` or `npm run server`. |
| Empty or odd model output | Try another **`GEMINI_MODEL`** (see below). |

If you run **`npm run preview`** after **`npm run build`**, you still need the API server running locally; the preview server uses the same **`API_PORT`**-aware `/api` proxy as `npm run dev`.

### On-device AI

1. `npm install` and `npm run dev` as in Quick start.
2. Follow [On-device AI setup](#on-device-ai-setup) for the model file.
3. In the app choose **On-device AI**, load the model, then **Create story**.

## On-device AI setup

1. Use a **Web**-converted Gemma model (see [Google’s Web LLM guide](https://ai.google.dev/edge/mediapipe/solutions/genai/llm_inference/web_js) and Hugging Face).
2. Place the file in [`public/models/`](public/models/README.md) as `gemma-3n-E2B-it-int4-Web.litertlm` (default), **or** set in `.env`:

   `VITE_MEDIAPIPE_MODEL_URL=https://your-cdn.example.com/path/model.litertlm`

3. In the app, choose **On-device AI**, click **Load AI model**, then **Create story**. Requires a **WebGPU-capable** browser.

Large models are **gitignored**; see [`public/models/README.md`](public/models/README.md).

## Gemini (cloud) setup

This mode sends **system** and **user** messages built in the app ([`src/lib/llmPrompt.ts`](src/lib/llmPrompt.ts)) to the backend endpoint `POST /api/generate`, which calls the Gemini Developer API with `config.systemInstruction` plus the user turn. The API key is stored server-side (for example, in Cloud Run Secret Manager).

**`POST /api/generate` body (JSON):**

| Field | Required | Purpose |
|-------|----------|---------|
| `userMessage` | Yes (unless using legacy `prompt`) | User turn: cast, setting, and task (story or improv format). |
| `systemInstruction` | No | Safety, style, grounding, and output rules. Omitted when empty. |
| `prompt` | Legacy | If `userMessage` is empty, the server uses `prompt` as the only content and does not set a system instruction. |

**Local Gemini:** step-by-step flow, ports, and troubleshooting are in [Local testing → Gemini (cloud)](#gemini-cloud).

On Cloud Run, optional env **`GEMINI_MAX_OUTPUT_TOKENS`** (default **2048**) caps model output. The server sets **`thinkingBudget: 0`** so reasoning tokens are not used. Default model is **`gemini-2.5-flash-lite`** (override with **`GEMINI_MODEL`**).

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
| `ARTIFACT_REGISTRY_REPO` | `gh-adventure-stories` | **Repository id only** (one name, no `/`). Not the full `…-docker.pkg.dev/...` path — the workflow builds that for you. |
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

Template mode: names stay in the browser unless you use **Copy link** (encoded hash). On-device AI: the model runs locally. **Gemini (cloud)** sends the generated system and user text to your server and then to Google’s API; see the in-app footer when that mode is selected.
