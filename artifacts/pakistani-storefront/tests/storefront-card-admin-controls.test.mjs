import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('mobile admin navigation and the unified save action stay accessible', async () => {
  const [admin, css] = await Promise.all([read('../src/admin/AdminPanel.tsx'), read('../src/admin/admin.css')]);
  assert.ok(admin.includes('data-testid="admin-mobile-quicknav"'));
  assert.ok(admin.includes('data-testid="admin-save-dock"'));
  assert.ok(admin.includes('data-testid="button-save-dock-admin-changes"'));
  assert.ok(css.includes('.ad-topbar { position:sticky'));
  assert.ok(css.includes('.ad-mobile-quick-nav { position: sticky'));
  assert.ok(css.includes('.ad-save-dock { position:fixed'));
  assert.ok(css.includes('width:54px; height:54px'));
  assert.ok(css.includes('calc(96px + env(safe-area-inset-bottom))'));
  assert.ok(css.includes('pointer-events:none'));
  assert.ok(admin.includes('data-dirty={dirty||saveRetryAvailable||localDraftRestored}'));
  assert.ok(admin.includes('aria-label={saving?'));
  assert.ok(!css.includes('left:0; display:flex; align-items:center; justify-content:space-between'));
  assert.ok(css.includes('[data-testid^="notice-"]'));
});

test('saved widget, marquee, countdown, wishlist, and badge colors reach storefront styles', async () => {
  const [widgets, marquee, timer, card, context, controls] = await Promise.all([
    read('../src/components/FloatingWidgets.tsx'),
    read('../src/components/MarqueeBars.tsx'),
    read('../src/components/CountdownTimer.tsx'),
    read('../src/components/ProductCard.tsx'),
    read('../src/context/AdminContext.tsx'),
    read('../src/admin/StorefrontSettingsEngines.tsx'),
  ]);
  assert.ok(widgets.includes('widget.color'));
  assert.ok(widgets.includes('widget.textColor'));
  assert.ok(marquee.includes('bar.backgroundColor'));
  assert.ok(marquee.includes('bar.textColor'));
  assert.ok(timer.includes('timer.backgroundColor'));
  assert.ok(timer.includes('timer.borderColor'));
  assert.ok(card.includes('badgeSettings.wishlistColor'));
  assert.ok(card.includes('badgeAppearance(badgeSettings.backgroundColor,badgeSettings.textColor'));
  assert.ok(context.includes('wishlistBackgroundColor'));
  assert.ok(controls.includes('Discount background'));
});

test('each product card keeps rating stars and a cart or options action', async () => {
  const card = await read('../src/components/ProductCard.tsx');
  assert.ok(card.includes('const ratingSummary'));
  assert.ok(card.includes('text-product-rating-card-'));
  assert.ok(card.includes('button-add-to-cart-card-'));
  assert.ok(card.includes('See options'));
});

test('category heading remains compact and on one line', async () => {
  const [storefront, themeBridge] = await Promise.all([read('../src/components/Storefront.tsx'), read('../src/components/ThemeBridge.tsx')]);
  assert.ok(storefront.includes('nura-category-section-heading'));
  assert.ok(themeBridge.includes('nura-category-section-heading{font-size:clamp(21px,3vw,32px)!important;line-height:1.15!important;white-space:nowrap'));
});
test('floating save button clears mobile bottom controls and the logo dot sits on the text baseline', async () => {
  const [adminCss, themeBridge] = await Promise.all([read('../src/admin/admin.css'), read('../src/components/ThemeBridge.tsx')]);
  assert.ok(adminCss.includes('bottom:calc(76px + env(safe-area-inset-bottom))'));
  assert.ok(adminCss.includes('calc(96px + env(safe-area-inset-bottom))'));
  assert.ok(themeBridge.includes('vertical-align:baseline;translate:0 0'));
  assert.ok(!themeBridge.includes('translate:0 -.06em'));
});
