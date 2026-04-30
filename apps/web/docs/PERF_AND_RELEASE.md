# Web performance, CI, and rollback

## Baseline metrics (PostHog / analytics)

Track weekly (same segment: device + region when possible):

- **Auth**: `user_logged_in` success vs errors; login funnel drop-off.
- **Todos**: `todo_created`, `todo_completed`, `todo_deleted` volumes and any client-side error toasts.
- **Latency**: server action / API p75 and p95 (add custom timing properties if needed).

## Local and CI verification

From repo root:

```bash
pnpm --filter web lint
pnpm --filter web typecheck
pnpm --filter web test
pnpm --filter web build
```

Optional browser smoke (Playwright) — **not** run in GitHub Actions (avoids Next + `@playwright/test` peer install issues). With the dev server on **3001**:

```bash
pnpm dlx playwright@1.49.0 install chromium
pnpm dlx playwright@1.49.0 test --config apps/web/playwright.config.ts
```

Optional signed-in smoke: set `E2E_USER_EMAIL` and `E2E_USER_PASSWORD` (test account only).

## Rollback switches (environment)

| Variable | Effect |
|----------|--------|
| `DISABLE_BULK_REORDER_RPC=true` | Use legacy per-row reorder/duplicate server actions instead of bulk SQL RPCs. |
| `DISABLE_LAYOUT_COUNTS_FALLBACK_RPC=true` | Skip `get_todo_counts_layout_fallback` and use the legacy multi-query layout fallback. |

Apply in Vercel/host env, redeploy or restart. Re-run smoke tests after toggling.

## Database

Apply new migrations (includes bulk RPCs + indexes):

```bash
supabase db push   # or your project’s migration workflow
```

## Regression triggers (revert PR or flip env flags)

- Login / signup success rate drops.
- Todo create / update / reorder error rate increases.
- p95 latency or Core Web Vitals guardrails regress vs baseline.
