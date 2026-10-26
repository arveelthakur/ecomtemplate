import assert from 'node:assert/strict';
import test from 'node:test';

process.env.VITE_SUPABASE_URL ||= 'https://seo-test.supabase.co';
process.env.VITE_SUPABASE_ANON_KEY ||= 'seo-test-key';
process.env.PUBLIC_SITE_URL ||= 'https://store.example';

const { generateSeoSnapshot } = await import('../scripts/prerender-seo.mjs');
const { categoryRoute, productRoute } = await import('../scripts/seo-utils.mjs');

const shell = '<!doctype html><html><head><title>Store</title></head><body><script id="nura-preloader-config" type="application/json">{}</script><div id="root"></div></body></html>';

test('category and product routes use their current SEO slugs', () => {
  const category = { id: 'care', name: 'Skin & Body', seo: { slug: 'skin-body-care' } };
  const product = { id: 10, name: 'Daily Serum', seo: { slug: 'daily-serum' } };
  assert.equal(categoryRoute(category, [category]), '/category/skin-body-care');
  assert.equal(productRoute(product, [product]), '/product/10/daily-serum');
});

test('Supabase catalog rows prerender product metadata and embeddable social images', async () => {
  const originalFetch = globalThis.fetch;
  const embeddedPng = 'data:image/png;base64,aGVsbG8=';
  const rows = {
    products: [{
      id: 1,
      name: 'Embedded Item',
      status: 'active',
      category_label: 'Skin & Body',
      description: 'A product with an embedded photo.',
      image: embeddedPng,
      images: [embeddedPng],
      price: 1200,
      stock: 4,
      seo: {
        slug: 'embedded-item',
        metaTitle: 'Manual embedded title',
        metaDescription: 'Manual embedded description',
      },
    }],
    categories: [],
    store_config: [],
    reviews: [],
  };
  globalThis.fetch = async input => {
    const table = new URL(typeof input === 'string' || input instanceof URL ? input : input.url).pathname.split('/').at(-1);
    if (!(table in rows)) throw new Error(`Unexpected Supabase request: ${table}`);
    return new Response(JSON.stringify(rows[table]), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  try {
    const snapshot = await generateSeoSnapshot({ sourceShellHtml: shell });
    const page = snapshot.routes.get('/product/1/embedded-item')?.html;
    assert.ok(page, 'expected a prerendered product page');
    assert.match(page, /<title>Manual embedded title<\/title>/);
    assert.match(page, /<meta name="description" content="Manual embedded description"/);
    const imageUrl = page.match(/https:\/\/store\.example\/seo-product-images\/MQ\/0-[a-f\d]{16}\.png/)?.[0];
    assert.ok(imageUrl, 'expected a public path for the embedded product photo');
    assert.match(page, new RegExp(`property="og:image" content="${imageUrl.replaceAll('/', '\\/')}"`));
    assert.match(page, new RegExp(`"image":\\["${imageUrl.replaceAll('/', '\\/')}"\\]`));
    assert.equal(snapshot.embeddedImages.get(new URL(imageUrl).pathname)?.bytes.toString(), 'hello');
    assert.ok(snapshot.sitemapXml.includes('https://store.example/product/1/embedded-item'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
