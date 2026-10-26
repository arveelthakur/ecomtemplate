import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/utils/storeImages.ts', import.meta.url), 'utf8');
const javascript = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const images = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`);

test('plain Supabase Storage keys become encoded public URLs while URLs and app assets stay intact', () => {
  assert.equal(
    images.normalizeStoreImageSource('banners/summer campaign.webp', 'https://project.supabase.co', 'store-assets'),
    'https://project.supabase.co/storage/v1/object/public/store-assets/banners/summer%20campaign.webp',
  );
  assert.equal(images.normalizeStoreImageSource('/nura-hero.jpg', 'https://project.supabase.co'), '/nura-hero.jpg');
  assert.equal(images.normalizeStoreImageSource('https://cdn.example/image.webp', 'https://project.supabase.co'), 'https://cdn.example/image.webp');
  assert.equal(images.normalizeStoreImageSource('javascript:alert(1)', 'https://project.supabase.co'), '');
});

test('responsive images use the mobile upload when desktop is absent and fall back after a broken image', () => {
  const mobileOnly = images.resolveResponsiveStoreImageSources('', 'banners/mobile.webp', [], [], 'https://project.supabase.co');
  assert.equal(mobileOnly.desktop, 'https://project.supabase.co/storage/v1/object/public/store-assets/banners/mobile.webp');
  assert.equal(mobileOnly.mobile, mobileOnly.desktop);

  const sources = images.resolveResponsiveStoreImageSources(
    'banners/desktop.webp',
    'banners/mobile.webp',
    ['products/gallery.webp'],
    ['https://project.supabase.co/storage/v1/object/public/store-assets/banners/desktop.webp'],
    'https://project.supabase.co',
  );
  assert.equal(sources.desktop, 'https://project.supabase.co/storage/v1/object/public/store-assets/banners/mobile.webp');
  assert.equal(sources.mobile, 'https://project.supabase.co/storage/v1/object/public/store-assets/banners/mobile.webp');
  assert.equal(sources.fallbacks.length, 3);
});
