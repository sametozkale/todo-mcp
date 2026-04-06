# Auth SMTP Runbook (Production)

This project uses Supabase Auth for email/password and Google OAuth.

## Why this exists

When Supabase default inbuilt SMTP is used, `signup` can fail with:

- `over_email_send_rate_limit`
- `429: email rate limit exceeded`

These are provider limits, not app-code bugs.

## Required production settings

In Supabase Dashboard for project `bufhktuexgfrlrekfwuu`:

1. **Auth → URL Configuration**
   - Site URL: `https://yalp.work`
   - Redirect URLs:
     - `https://yalp.work/auth/callback`
     - `https://www.yalp.work/auth/callback`

2. **Auth → SMTP Settings**
   - Enable custom SMTP
   - Configure:
     - host
     - port
     - username
     - password
     - sender email
     - sender name
   - Disable click/link rewriting if your SMTP provider offers it (prevents auth link corruption).

3. **Auth → Rate Limits**
   - Tune email send throughput for expected signup volume.
   - Keep anti-abuse limits for OTP/verify/token endpoints at safe defaults unless required.

4. **Auth → Bot Protection**
   - Enable CAPTCHA for signup/signin flows to reduce abusive signup bursts.

## Host strategy

Allow both `yalp.work` and `www.yalp.work`, but redirect `www` to `yalp.work` at edge/platform level.

## Post-change verification

1. Trigger email signup with a non-team mailbox and ensure no 429 in auth logs.
2. Trigger Google signup/login and verify callback lands on `https://yalp.work/...`.
3. Confirm `/auth/callback` preserves internal `next` path after successful exchange.

## MCP verification query hints

- Auth logs should no longer show fresh `over_email_send_rate_limit` entries after SMTP setup.
- API logs should show healthy `/auth/v1/authorize`, `/auth/v1/callback`, `/auth/v1/token` flows.
