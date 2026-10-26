# SEO Strategy

## In scope
- Nura public Pakistan-focused wellness, home, and jewelry storefront: home, shop, collections/category, product detail, about, contact, reviews, and policy pages.
- Source-detectable WCAG 2.2 A/AA barriers in public browsing and purchase flows.
- Production rendering, static SEO generation, sitemap, social previews, and AI retrieval visibility.

## Out of scope
- Authenticated administration and customer dashboards, test fixtures, and internal mockup canvas.
- Live audits, deployment changes, and application fixes.

## Target audience and topics
- Shoppers in Pakistan seeking wellness, home comforts, jewelry, and store product collections; branding and catalog are administrator-configurable.

## Crawler assumptions
- Production uses a Vite/React static build with Supabase-backed SEO prerendering and Vercel serverless API routes. Check generated route coverage rather than treating all routes as client-only.
- Search visibility and social/AI retrieval are desired. Google can render JavaScript; social and AI retrieval bots generally require initial HTML.
- Vercel is the supported deployment target; external crawler behavior must still be checked on the published site.

## Dismissed categories
- None.
