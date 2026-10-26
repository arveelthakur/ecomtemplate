# Nura luxury storefront verification

## Configuration and content

- Homepage visibility never deletes content. Explicit saved `false` values and category box/grid choices take precedence over starter defaults, including stores created before the Nura content refresh.
- Announcement and footer visibility also apply to commerce pages. The homepage manager includes the fixed-position announcement toggle.
- Native hero, story, occasion, gift, newsletter and milestone text edits clear only the corresponding stale heading/subheading override. Image-only edits preserve overrides; an override explicitly changed in the same edit wins.
- Hidden sections retain their populated content, media and configuration. Existing Supabase catalog rows are not overwritten by this PR; starter products are used for the template initializer/isolated tests.
- Starter products are eligible for the configured complimentary-delivery threshold. Confirm delivery eligibility against real inventory before publishing it.
- Starter review examples remain unpublished. No invented customer purchases, reviews or community statistics are presented as verified facts.

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
- Account/wallet availability, stock checks, server-side pricing and order submission retain the existing backend contracts.

## Automated checks

`Storefront checks` runs unit, security, SEO, complete TypeScript/build and real local-Supabase pgTAP tests.

The separate browser job uses the actual storefront, wishlist/cart providers and checkout components with isolated starter data and no backend credentials. It checks 320/390/768/1440px layouts, matching wordmarks, loaded Urdu font, section hide/show retention, category grid/marquee binding, cart quantity/pricing and delivery validation. Screenshots/results are uploaded as `nura-mobile-browser-evidence`.

The fixture is a development-server test entry, not a production Vite entry or authentication bypass.

## Live checks that still require configured provider/account access

Fixture tests do **not** prove authenticated production Supabase saves/realtime replication, guest-auth configuration, actual stock fulfillment, order placement, bank settlement, payment gateways, newsletter delivery, SMTP or WhatsApp delivery. Those must be validated against configured accounts without creating unintended real orders/messages.

No production Supabase rows, policies, secrets or payment-provider configuration are changed by this audit.
