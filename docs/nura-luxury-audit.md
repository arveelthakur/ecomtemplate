# Nura luxury storefront verification

## Configuration and content

- Homepage visibility never deletes content. Explicit saved `false` values and category box/grid choices take precedence over starter defaults, including stores created before the Nura content refresh.
- Announcement and footer visibility also apply to commerce pages. The homepage manager includes the fixed-position announcement toggle.
- Native hero, story, occasion, gift, newsletter and milestone text edits clear only the corresponding stale heading/subheading override. Image-only edits preserve overrides; an override explicitly changed in the same edit wins.
- Hidden sections retain their populated content, media and configuration. This change does not write, overwrite, or delete Supabase catalog rows.
- Products, categories, inventory and reviews are sourced from Supabase. The production app has no bundled sample catalog or automatic catalog seed; only test fixtures contain sample records.
- The default review collection is empty. No invented customer purchases, reviews or community statistics are presented as verified facts.
- Catalog utilities contain no hardcoded product/category fallback. Empty storefront states display an explicit empty message rather than sample product or category tiles.
- Global SEO metadata, comma-separated keywords, social preview alt text and image can be managed in Admin → Settings → SEO & metadata. Product/category titles and descriptions are generated from their saved records, with custom overrides supported.
- The default homepage title/description match the Nura jewelry brief. Public routes use `index, follow`; only a missing product URL is marked `noindex, follow` to avoid indexing a broken detail page.

## Responsive presentation

- Shared header/footer wordmark typography; small baseline-aligned circle/square accent; consistent preloader dot.
- A separate editable global gold-detail color keeps borders/editorial accents gold even when the general accent palette is plum.
- Licensed, self-hosted Noto Nastaliq Urdu, with isolated RTL line height. This is an authentic Nastaliq alternative, not a claim to ship the proprietary Jameel font.
- Full-width mobile story image; occasion/gift banners stack at 768px and below.
- Paired promo cards use editorial backgrounds and contrast-preserving overlays; overlay text is excluded from ordinary body-text theme recoloring.
- Mobile headings are bounded; newsletter inputs can shrink without overflowing.
- Responsive image failures match absolute browser URLs back to their configured relative sources, so a failed mobile asset can fall back to the working desktop asset. Real images retain their accessibility labels and test identifiers.

## Checkout

- City selection derives a visible, read-only province; the submitted province is derived again from the selected city.
- Pakistan mobile numbers normalize to international format. Required delivery fields and optional five-digit postal codes are validated before submission.
- COD is selected when it is the available method and no bank-transfer accounts are configured, rather than leaving checkout disabled on an unavailable default.
- Cart gift/delivery targets, delivery-day estimates, countdown, upsell product IDs and order add-ons are edited from Store pages → Cart. Countdown and gift-progress messaging are opt-in; a zero gift target hides the gift progress so the storefront does not imply a promotion that has not been configured.
- Add-on IDs are checked against the current enabled Supabase settings and their names/prices are rebuilt server-side at order placement. A browser cannot set the add-on amount. The add-on selection is included in checkout idempotency and in order summaries/confirmation messages.
- Delivery-day wording is explicitly an estimate; it is not courier tracking or a fulfillment promise. Shipping-protection is disabled by default and should only be enabled if the store has a real fulfillment/coverage arrangement.
- Account/wallet availability, stock checks, server-side pricing and order submission retain the existing backend contracts.

## Reviews, splash screen and media sizing

- Customer and video-review sections are independently visible from Homepage sections. Only published review records render, and the video shelf does not create fabricated customer material.
- Video embeds are limited to HTTPS YouTube/Vimeo hosts; HTTPS video files can use the native player. Unknown/unsafe URLs are not embedded and are offered only as an external link.
- The welcome splash screen is managed under Store settings → Welcome splash screen and starts enabled in the Nura starter settings. Dismissal is scoped to the current browser tab/session.
- Media Library lists dimensions for logos, product/gallery/variant images, swatches, category tiles, desktop/mobile hero and promo artwork, category banners, story imagery, splash screens, avatars/video thumbnails, social tiles, share cards and widgets. Trust, milestone and social marks use vector icons and need no uploaded image.
- An empty catalog is never seeded automatically. Add real product and category records in Admin; doing so writes only the records you explicitly save.

## Automated checks

`Storefront checks` runs unit, security, SEO, complete TypeScript/build and real local-Supabase pgTAP tests.

The separate browser job uses the actual storefront, wishlist/cart providers and checkout components with isolated test-only records and no backend credentials. It checks 320/390/768/1440px layouts, matching wordmarks, loaded Urdu font, section hide/show retention, category grid/marquee binding, cart quantity/pricing and delivery validation. Screenshots/results are uploaded as `nura-mobile-browser-evidence`.

The fixture is a development-server test entry, not a production Vite entry or authentication bypass.

## Live checks that still require configured provider/account access

Fixture tests do **not** prove authenticated production Supabase saves/realtime replication, guest-auth configuration, actual stock fulfillment, order placement, bank settlement, payment gateways, newsletter delivery, SMTP or WhatsApp delivery. Those must be validated against configured accounts without creating unintended real orders/messages.

No production Supabase rows, policies, secrets or payment-provider configuration are changed by this audit.
