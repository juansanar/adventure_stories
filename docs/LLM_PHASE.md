# Optional phase: hosted LLM

The shipped app generates stories **entirely in the browser** from JSON templates. If you add AI later, keep these constraints:

## Architecture

- **Never** put API keys in the client bundle. Use a **serverless endpoint** (Vercel, Netlify, Cloudflare Workers) that holds the secret and forwards a minimal request to the provider.
- Send **structured JSON** only: cast names, setting, mode, max length. Avoid logging raw prompts with child names in production analytics.

## Cost control

- Cap **`max_tokens`** (for example 400–700 for a short story).
- Enforce a **daily or per-IP quota** on the serverless function.
- Optionally require a small **signed token** (issued by the same backend) so casual scraping cannot burn your budget.

## Safety

- **System prompt** should encode toddler-safe rules: soft conflict, cozy resolution, no strangers/scary abandonment themes.
- Add a lightweight **output filter** (blocklist or small classifier) before returning text to the client.
- **Privacy copy** on the page: data may pass through a third-party model; minimize retention per provider settings.

## Migration path from templates

- Keep template mode as the **default** or **fallback** when the API fails or quota is exceeded.
- Consider “**polish**” mode: templates first, optional one-pass rewrite for variety (still capped tokens).
