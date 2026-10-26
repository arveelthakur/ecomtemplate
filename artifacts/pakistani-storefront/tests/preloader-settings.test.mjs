import assert from 'node:assert/strict';
import test from 'node:test';

process.env.VITE_SUPABASE_URL ||= 'https://preloader-settings-test.supabase.co';
process.env.VITE_SUPABASE_ANON_KEY ||= 'preloader-settings-test-key';
process.env.PUBLIC_SITE_URL ||= 'https://arveel.replit.app';

const { injectPreloaderSettings, renderAppShellWithCurrentPreloader } = await import('../scripts/prerender-seo.mjs');

function shellFixture() {
  return '<!doctype html><html><head><script id="nura-preloader-config" type="application/json">{"enabled":true}</script></head><body class="nura-app-loading"><div id="nura-preloader" data-style="nura-pulse" role="status" aria-label="Loading Nura..."><img class="nura-loader-image" alt="" decoding="async" fetchpriority="high"><div class="nura-loader-message">Loading Nura...</div></div></body></html>';
}

test('server shell safely embeds configured preloader settings before first paint', () => {
  const loadingText = '<script>alert("not markup")</script>';
  const html = injectPreloaderSettings(shellFixture(), {
    enabled: false,
    style: 'store-logo',
    loadingText,
    minimumDisplayMs: 2400,
    storeLogoUrl: 'https://cdn.example.test/store-logo.png',
    faviconUrl: 'https://cdn.example.test/favicon.png',
  });
  const configJson = html.match(/<script id="nura-preloader-config" type="application\/json">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(configJson);
  assert.deepEqual(JSON.parse(configJson), {
    enabled: false,
    style: 'store-logo',
    loadingText,
    minimumDisplayMs: 1500,
    storeLogoUrl: 'https://cdn.example.test/store-logo.png',
    faviconUrl: 'https://cdn.example.test/favicon.png',
  });
  assert.match(html, /<body class="nura-app-loading nura-preloader-disabled">/);
  assert.match(html, /id="nura-preloader" data-style="store-logo"/);
  assert.match(html, /class="nura-loader-image" alt="" decoding="async" fetchpriority="high" src="https:\/\/cdn\.example\.test\/store-logo\.png"/);
  assert.match(html, /aria-label="&lt;script&gt;alert\(&quot;not markup&quot;\)&lt;\/script&gt;"/);
  assert.match(html, /<div class="nura-loader-message">&lt;script&gt;alert\(&quot;not markup&quot;\)&lt;\/script&gt;<\/div>/);
  assert.doesNotMatch(html, /<script>alert\("not markup"\)<\/script>/);
});

test('invalid saved values fall back to safe preloader defaults', () => {
  const html = injectPreloaderSettings(shellFixture(), {
    enabled: 'false',
    style: 'external-animation',
    loadingText: 42,
    minimumDisplayMs: 0,
  });
  const configJson = html.match(/<script id="nura-preloader-config" type="application\/json">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(configJson);
  assert.deepEqual(JSON.parse(configJson), {
    enabled: true,
    style: 'nura-pulse',
    loadingText: 'Loading the store...',
    minimumDisplayMs: 500,
    storeLogoUrl: '',
    faviconUrl: '',
  });
  assert.doesNotMatch(html, /nura-preloader-disabled/);
});

test('initial non-SEO app shell uses the current Supabase preloader settings', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async input => {
    assert.match(String(input), /\/store_config\?/);
    return new Response(JSON.stringify([{
      id: 'global',
      settings: {
        preloader: {
          enabled: true,
          style: 'favicon',
          loadingText: 'Opening your store...',
          minimumDisplayMs: 1050,
        },
        general: {
          storeLogoUrl: 'https://cdn.example.test/store-logo.png',
          faviconUrl: 'https://cdn.example.test/favicon.png',
        },
      },
    }]), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const html = await renderAppShellWithCurrentPreloader(shellFixture());
    assert.match(html, /id="nura-preloader" data-style="favicon"/);
    assert.match(html, /class="nura-loader-image" alt="" decoding="async" fetchpriority="high" src="https:\/\/cdn\.example\.test\/favicon\.png"/);
    assert.match(html, /<div class="nura-loader-message">Opening your store\.\.\.<\/div>/);
    const configJson = html.match(/<script id="nura-preloader-config" type="application\/json">([\s\S]*?)<\/script>/)?.[1];
    assert.ok(configJson);
    assert.deepEqual(JSON.parse(configJson), {
      enabled: true,
      style: 'favicon',
      loadingText: 'Opening your store...',
      minimumDisplayMs: 1050,
      storeLogoUrl: 'https://cdn.example.test/store-logo.png',
      faviconUrl: 'https://cdn.example.test/favicon.png',
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
