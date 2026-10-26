import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const [footer, sectionManager, storefront, collections, productBrowse, theme, globalCss, adminCss] = await Promise.all([
  read('../src/components/StoreFooter.tsx'),
  read('../src/admin/HomepageSectionsManager.tsx'),
  read('../src/components/Storefront.tsx'),
  read('../src/pages/CollectionsPage.tsx'),
  read('../src/components/ProductBrowse.tsx'),
  read('../src/context/AdminContext.tsx'),
  read('../src/index.css'),
  read('../src/admin/admin.css'),
]);

test('footer meta is rendered separately after dynamic footer content blocks', () => {
  assert.match(footer, /contentBlocks=visibleBlocks\.filter\(block=>block\.id!=='subfooter'\)/);
  assert.match(footer, /className="nura-footer-meta" data-testid="footer-meta-stable"/);
  assert.match(footer, /data-testid="footer-copyright-note"/);
  assert.match(footer, /data-testid="footer-price-note"/);
  assert.match(footer, /data-testid="footer-payment-note"/);
  assert.match(globalCss, /\.nura-footer-subfooter \{ display:grid; grid-template-columns:repeat\(3/);
  assert.match(globalCss, /@media\s*\(max-width:700px\)[\s\S]*?\.nura-footer-subfooter \{ grid-template-columns:minmax\(0,1fr\)/);
});

test('footer in homepage sections is visibility-and-position only', () => {
  assert.match(sectionManager, /item\.id!=='footer'&&<button/);
  assert.match(sectionManager, /item\.id!=='footer'&&<span aria-hidden="true" className="ad-help" title="Drag to reorder"/);
  assert.match(sectionManager, /draggable=\{item\.id!=='footer'\}/);
  assert.doesNotMatch(sectionManager, /selected\.id==='footer'&&/);
});

test('empty category and product states display dimensioned, layout-aware image grids', () => {
  assert.match(storefront, /grid-empty-home-categories/);
  assert.match(storefront, /shape=\{circle\?'circle':'portrait'\}/);
  assert.match(collections, /grid-empty-collections/);
  assert.match(productBrowse, /grid-empty-products/);
  assert.match(productBrowse, /Recommended: 1000 × 1000 px/);
});

test('default and migrated theme values use the Plum and Cream master palette', () => {
  assert.match(theme, /primary:'#4A2837',accent:'#4A2837',background:'#FDFBF7'/);
  assert.match(theme, /normalizeThemeColor\(saved\.content\?\.theme\?\.primary,[^,]+,\['#334155','#6b2447'\]\)/);
  assert.match(globalCss, /--nura-primary: #4A2837/);
  assert.match(globalCss, /--nura-background: #FDFBF7/);
  assert.match(adminCss, /input\[type="range"\]::-webkit-slider-thumb[\s\S]*?background:var\(--ad-burgundy\)/);
});
