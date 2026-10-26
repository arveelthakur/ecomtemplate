# Supabase + Vercel e-commerce template

Reusable storefront template with an empty catalog, neutral branding, Supabase Auth/Postgres/Storage, and Vercel serverless endpoints.

## Deploy

1. Create a Supabase project and apply the repository migrations with `supabase db push`. The migrations create the tables, RLS policies, auth profile trigger, document-compatibility layer, public `store-assets` bucket, atomic order and inventory operations, and duplicate-safe automation claims.
2. In Vercel, set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_INITIAL_ADMIN_EMAIL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_INITIAL_ADMIN_EMAIL`, and `PUBLIC_SITE_URL`. The two initial-admin email values must match. `SUPABASE_SERVICE_ROLE_KEY` is server-only and must never use a `VITE_` prefix.
3. To enable email, optionally configure `RESEND_API_KEY`, `SENDGRID_API_KEY`, or the SMTP-only `SMTP_PASSWORD` secret (complete the non-secret SMTP host, port, and username in Admin). For WhatsApp Cloud API, configure `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, and `WHATSAPP_VERIFY_TOKEN`, then register `https://<your-domain>/api/store/whatsappWebhook` as the Meta webhook. For Twilio voice, configure `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN`; for a custom voice gateway, configure `VOICE_GATEWAY_API_KEY` or `VOICE_API_TOKEN` / `VOICE_API_PASSWORD` according to its selected auth mode. All these credentials are server-only.
4. Import the repository into Vercel and deploy with the checked-in `vercel.json` settings.
5. Sign in using the configured initial-admin email. The first authenticated session bootstraps its allowlist entry through the server API. Add products, categories, store settings, and branding from the admin UI.

The template starts with an empty catalog and requires no manual seed data or RLS workaround. Set a strong `CRON_SECRET` in Vercel to authorize the scheduled functions; Vercel sends it as a bearer token. Jobs default to once daily at 03:00, 04:00, and 05:00 UTC so the schedules also deploy on Hobby. On a plan that supports frequent cron jobs, change the two abandoned-checkout schedules to `*/15 * * * *` and the review-request schedule to `0 */6 * * *`. See [Vercel's scheduling limits](https://vercel.com/docs/cron-jobs/usage-and-pricing). Keep Fluid compute enabled for the configured five-minute maximum function duration.

Voice and WhatsApp workflows are opt-in: outbound customer messages require the applicable consent and store settings, while promotional campaigns target only customers who opted in. Configure provider templates and server-side secrets before enabling those toggles in the admin panel.

## Start a store from this template

This repository is configured as a GitHub template. Use **Use this template** to create a separate repository for each store; each new repository inherits the code, migrations, tested Plum/Cream defaults, theme-aware controls, image placeholders, and Supabase draft-sync fixes. It does **not** copy the source store's Supabase database, Vercel project, environment variables, or credentials.

For every new store, create its own Supabase project and Vercel project, apply the checked-in migrations, and configure the required variables in both **Preview** and **Production**. Set the two initial-admin email variables to the same address and set `PUBLIC_SITE_URL` for each deployment environment. The `.env.example` file documents the variable names without containing real credentials. Review the sample storefront copy and policy text, then configure the store name, logo, catalog, images, and provider integrations before launch.

## Local checks

- `pnpm run test:unit` covers storefront utilities and server-side provider helpers.
- `pnpm run test:security` checks Firebase removal, secret exposure boundaries, and Vercel routing.
- `pnpm run test:seo-prerender` covers empty and forbidden Supabase prerender responses.
- `pnpm run test:db` runs database tests against the local Supabase stack.
- `pnpm run typecheck` checks the storefront TypeScript project.
- `pnpm run build` builds the static storefront and SEO routes.

Keep service-role and email provider credentials in the deployment's secret manager. Only the Supabase project URL and anon key belong in browser variables.
