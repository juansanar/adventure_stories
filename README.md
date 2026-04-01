# Adventure stories

A small web app that fills **gentle, short adventure stories** (or **improv kits**) from a cast you choose: friends, family, plush animals, and an optional setting. Generation runs **only in your browser** from bundled templates—no API keys and no server required.

## Quick start

```bash
npm install
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:5173`).

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

**Share links** (after **Copy link**): `friends`, `family`, `plush` (preset ids), `plushExtra`, `place` (setting preset id or `custom` with `setting=` for free text), `mode`. Legacy `f1` / `f2` are still read if `friends` is absent.

## Deploy (GitHub Pages)

1. Push this repo to GitHub.
2. In **Settings → Pages**, set **Source** to **GitHub Actions**.
3. Ensure the default branch is `main` or `master` (matching [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml)).
4. After the workflow runs, the site URL appears in the workflow summary.

If the site loads blank, confirm **Pages** uses the artifact from Actions and that `base` in `vite.config.ts` matches how the site is hosted (this project uses relative `./`).

## Optional AI

See [`docs/LLM_PHASE.md`](docs/LLM_PHASE.md) for a safe pattern if you add a hosted LLM later.

## Privacy

The footer states the intended behavior: names stay local unless you use **Copy link**, which puts them in the query string of a shareable URL.
