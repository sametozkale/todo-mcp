# Yalp

Yalp is a minimalist AI-assisted todo app built with a Turborepo monorepo, Electron, and a Supabase backend. It also exposes an MCP server so AI coding tools can create and manage todos directly.

## macOS app is live

Yalp now ships as a native macOS desktop app in addition to the web app.

- Download from the app/website download entry points (DMG artifact built from `apps/desktop`).
- Desktop and web use the same account and stay in sync.
- The desktop shell opens the Yalp web experience in a dedicated native window.

**Claude Web × uzak MCP:** Yalp, Claude Web özel connector için OAuth 2.1 (PKCE) ve MCP metadata uçlarını sunar; rehber ve env için bkz. [`docs/claude-web-mcp-compliance.md`](docs/claude-web-mcp-compliance.md). Stdio istemcileri `yalp_` API anahtarını kullanmaya devam eder.

The web app (`apps/web`) uses **Next.js 15**, **Tailwind CSS v4**, and **[HeroUI v3](https://www.heroui.com/docs/react/getting-started/quick-start)** (`@heroui/react`, `@heroui/styles`).

- Local dev: `pnpm dev:web`
- Production build: `pnpm --filter web build`

## Desktop app (Electron)

- Dev (web + desktop): `pnpm dev:desktop`
- Build macOS DMG: `pnpm --filter desktop build:mac`
- App bundle identifier: `com.yalp.app`

Notes:
- macOS helper app metadata is post-processed during packaging to reduce duplicate app-name surfacing in Spotlight/App search.
- If old app builds are installed locally, remove stale copies before validating the final install UX.

**Web typography:** Headings use **Open Runde** (`next/font/local`, OFL — `app/fonts/open-runde/`); body, descriptions, and buttons use **Inter** (`next/font/google`). Configuration: [`apps/web/app/fonts.ts`](apps/web/app/fonts.ts), [`apps/web/app/globals.css`](apps/web/app/globals.css).

## Supabase setup (one-time)

1. Create a new project in the Supabase dashboard.
2. In the SQL editor, run migrations in `supabase/migrations/` in order (including `0012_oauth_mcp.sql` for Claude Web OAuth).
3. In **Project Settings → API**, copy:
   - Project URL
   - `anon` public key
   - `service_role` secret key
4. Copy the repo root [`.env.example`](.env.example) to `apps/web/.env.local`, then fill in secrets (Next.js reads env files from `apps/web/` only).

## Public URL (`NEXT_PUBLIC_SITE_URL`)

Production canonical domain is **`https://yalp.work`**. Set `NEXT_PUBLIC_SITE_URL` to that value in Vercel Production once DNS and SSL are live. Local dev usually sets `NEXT_PUBLIC_SITE_URL=http://localhost:3001` so metadata and redirects match the dev server.

After changing domains, update: **Vercel** project domains and env, **Supabase** Auth redirect URLs and Site URL, **Stripe** webhook endpoint URL, **MCP / Cursor** configs that embed the API base URL, and any **marketing or llms.txt** mirrors outside this repo.

## Rebranding checklist (Flowdo → Yalp)

If you previously used Flowdo naming or env vars: use only **`YALP_*`** env vars (see `.env.example`). **API keys** must use the `yalp_` prefix — revoke old keys in the app and create new ones if needed. **Electron** `appId` is now `com.yalp.app`; existing installs may need a fresh build. **Supabase migration** filename changed to `0001_init_yalp.sql` — already-applied databases should not re-run SQL; new environments use the new file.

