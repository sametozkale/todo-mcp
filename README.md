# FlowDo

FlowDo is a minimalist AI-assisted todo app built with a Turborepo monorepo, Electron, and a Supabase backend. It also exposes an MCP server so AI coding tools can create and manage todos directly.

The web app (`apps/web`) uses **Next.js 15**, **Tailwind CSS v4**, and **[HeroUI v3](https://www.heroui.com/docs/react/getting-started/quick-start)** (`@heroui/react`, `@heroui/styles`).

- Local dev: `pnpm dev:web`
- Production build: `pnpm --filter web build`

**Web typography:** Headings use **Open Runde** (`next/font/local`, OFL — `app/fonts/open-runde/`); body, descriptions, and buttons use **Inter** (`next/font/google`). Configuration: [`apps/web/app/fonts.ts`](apps/web/app/fonts.ts), [`apps/web/app/globals.css`](apps/web/app/globals.css).

## Supabase setup (one-time)

1. Create a new project in the Supabase dashboard.
2. In the SQL editor, run the contents of `supabase/migrations/0001_init_flowdo.sql` to create the schema and RLS policies.
3. In **Project Settings → API**, copy:
   - Project URL
   - `anon` public key
   - `service_role` secret key
4. Add these values to your environment files as described in `.env.example`.

