import assert from 'node:assert/strict';
import test from 'node:test';

process.env.VITE_SUPABASE_URL ||= 'https://deployment-config-test.supabase.co';
process.env.VITE_SUPABASE_ANON_KEY ||= 'deployment-config-test-key';
process.env.PUBLIC_SITE_URL ||= 'https://arveel.replit.app';

const { resolvePublicSiteUrl } = await import('../scripts/prerender-seo.mjs');

test('uses the Vercel URL for canonical pages and sitemap when no custom origin is set', () => {
  assert.equal(
    resolvePublicSiteUrl({ VERCEL_URL: 'nura-shop.vercel.app' }),
    'https://nura-shop.vercel.app',
  );
});

test('lets an explicitly configured public origin override the hosting default', () => {
  assert.equal(
    resolvePublicSiteUrl({
      PUBLIC_SITE_URL: 'https://shop.example.com',
      VERCEL_URL: 'nura-shop.vercel.app',
    }),
    'https://shop.example.com',
  );
});

test('supports the Vercel host-provided canonical URL', () => {
  assert.equal(
    resolvePublicSiteUrl({ VERCEL_URL: 'nura-shop.vercel.app' }),
    'https://nura-shop.vercel.app',
  );
});

test('rejects a malformed hosting origin instead of emitting invalid canonicals', () => {
  assert.throws(
    () => resolvePublicSiteUrl({ URL: 'not-a-url' }),
    /valid absolute http\(s\) URL/,
  );
});

test('requires an explicit or host-provided origin instead of silently using another platform domain', () => {
  assert.throws(
    () => resolvePublicSiteUrl({}),
    /Set PUBLIC_SITE_URL or use a host-provided canonical URL/,
  );
});
