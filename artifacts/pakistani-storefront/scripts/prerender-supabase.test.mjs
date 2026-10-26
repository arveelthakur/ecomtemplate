import assert from 'node:assert/strict';
import test from 'node:test';

process.env.PUBLIC_SITE_URL ||= 'https://store.example';
process.env.VITE_SUPABASE_URL ||= 'https://project.supabase.co';
process.env.VITE_SUPABASE_ANON_KEY ||= 'prerender-test-key';

const { generateSeoSnapshot } = await import('./prerender-seo.mjs');
const shell = '<!doctype html><html><head><title>Store</title></head><body class=""><script id="nura-preloader-config" type="application/json">{}</script><div id="root"></div></body></html>';

test('SEO prerender handles empty and forbidden Supabase datasets without blocking static routes', async () => {
  const previousFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response('[]', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
    const snapshot = await generateSeoSnapshot({ sourceShellHtml: shell });
    assert.ok(snapshot.routes.has('/'));
    assert.ok(snapshot.routes.has('/shop'));
    assert.ok(snapshot.routes.has('/reviews'));
    assert.match(snapshot.sitemapXml, /https:\/\/store\.example/);

    globalThis.fetch = async () => new Response('{"message":"row level security denied"}', { status: 403 });
    const forbiddenSnapshot = await generateSeoSnapshot({ sourceShellHtml: shell });
    assert.ok(forbiddenSnapshot.routes.has('/'));
    assert.ok(forbiddenSnapshot.routes.has('/reviews'));
    assert.match(forbiddenSnapshot.routes.get('/reviews').html, /Read customer reviews and feedback/);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
