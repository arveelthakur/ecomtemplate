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
    const home=snapshot.routes.get('/');
    assert.match(home.html,/<title>Nura\.pk \| Luxury Artificial Jewelry Online in Pakistan<\/title>/);
    assert.match(home.html,/name="robots" content="index, follow"/);
    assert.match(home.html,/property="og:image" content="https:\/\/store\.example\/images\/nura-editorial-hero\.jpg"/);
    assert.match(home.html,/name="keywords" content="luxury artificial jewelry Pakistan/);
    assert.doesNotMatch(snapshot.robotsText,/noindex|nofollow/i);
    assert.match(snapshot.routes.get('/shop').html,/PKR/);

    globalThis.fetch = async () => new Response('{"message":"row level security denied"}', { status: 403 });
    const forbiddenSnapshot = await generateSeoSnapshot({ sourceShellHtml: shell });
    assert.ok(forbiddenSnapshot.routes.has('/'));
    assert.ok(forbiddenSnapshot.routes.has('/reviews'));
    assert.match(forbiddenSnapshot.routes.get('/reviews').html, /Read customer reviews and feedback/);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('SEO shell renders the configured store name, subtitle, and palette', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async input => {
    const url = String(input);
    if (url.includes('/store_config?')) return new Response(JSON.stringify([{
      id: 'global',
      settings: { general: { storeName: 'Nura Botanicals', storeSubtitle: 'Thoughtfully chosen for everyday living.' } },
      content: { theme: { primary: '#123456', background: '#ABCDEF' } },
    }]), { status: 200, headers: { 'content-type': 'application/json' } });
    return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const snapshot = await generateSeoSnapshot({ sourceShellHtml: shell });
    const html = snapshot.routes.get('/').html;
    assert.match(html, /Nura Botanicals/);
    assert.match(html, /Thoughtfully chosen for everyday living\./);
    assert.match(html, /color:#123456/);
    assert.match(html, /background:#ABCDEF/);
    assert.doesNotMatch(html, />nura\.<\/a>/);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
