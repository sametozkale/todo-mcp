# Yalp

Yalp is a minimalist AI-assisted todo app built with a Turborepo monorepo, Electron, and a Supabase backend. It also exposes an MCP server so AI coding tools can create and manage todos directly.

The web app (`apps/web`) uses **Next.js 15**, **Tailwind CSS v4**, and **[HeroUI v3](https://www.heroui.com/docs/react/getting-started/quick-start)** (`@heroui/react`, `@heroui/styles`).

- Local dev: `pnpm dev:web`
- Production build: `pnpm --filter web build`

**Web typography:** Headings use **Open Runde** (`next/font/local`, OFL — `app/fonts/open-runde/`); body, descriptions, and buttons use **Inter** (`next/font/google`). Configuration: [`apps/web/app/fonts.ts`](apps/web/app/fonts.ts), [`apps/web/app/globals.css`](apps/web/app/globals.css).

## Supabase setup (one-time)

1. Create a new project in the Supabase dashboard.
2. In the SQL editor, run the contents of `supabase/migrations/0001_init_yalp.sql` to create the schema and RLS policies.
3. In **Project Settings → API**, copy:
   - Project URL
   - `anon` public key
   - `service_role` secret key
4. Add these values to your environment files as described in `.env.example`.

## Public URL (`NEXT_PUBLIC_SITE_URL`)

Production canonical domain is **`https://yalp.work`**. Set `NEXT_PUBLIC_SITE_URL` to that value in Vercel Production once DNS and SSL are live. Local dev usually sets `NEXT_PUBLIC_SITE_URL=http://localhost:3001` so metadata and redirects match the dev server.

After changing domains, update: **Vercel** project domains and env, **Supabase** Auth redirect URLs and Site URL, **Stripe** webhook endpoint URL, **MCP / Cursor** configs that embed the API base URL, and any **marketing or llms.txt** mirrors outside this repo.

## Rebranding checklist (Flowdo → Yalp)

If you previously used Flowdo naming or env vars: use only **`YALP_*`** env vars (see `.env.example`). **API keys** must use the `yalp_` prefix — revoke old keys in the app and create new ones if needed. **Electron** `appId` is now `com.yalp.app`; existing installs may need a fresh build. **Supabase migration** filename changed to `0001_init_yalp.sql` — already-applied databases should not re-run SQL; new environments use the new file.

