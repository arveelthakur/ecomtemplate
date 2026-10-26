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
const themeBridge = await read('../src/components/ThemeBridge.tsx');

test('footer meta is rendered separately after dynamic footer content blocks', () => {
  assert.match(footer, /contentBlocks=visibleBlocks\.filter\(block=>block\.id!=='subfooter'\)/);
  assert.match(footer, /className="nura-footer-meta" data-testid="footer-meta-stable"/);
  assert.match(footer, /data-testid="footer-copyright-note"/);
  assert.match(footer, /data-testid="footer-price-note"/);
  assert.match(footer, /data-testid="footer-payment-note"/);
  assert.doesNotMatch(footer, /hover:text-white/);
  assert.match(globalCss, /\.nura-footer-subfooter \{ display:grid; grid-template-columns:repeat\(3/);
  assert.match(globalCss, /@media\s*\(max-width:700px\)[\s\S]*?\.nura-footer-subfooter \{ grid-template-columns:minmax\(0,1fr\)/);
  assert.match(globalCss, /\.nura-footer-meta \{[^}]*overflow-anchor:none/);
  assert.match(globalCss, /min-height:72px/);
});

test('footer in homepage sections is visibility-and-position only', () => {
  assert.match(sectionManager, /item\.id!=='footer'&&<button/);
  assert.match(sectionManager, /item\.id!=='footer'&&<span aria-hidden="true" className="ad-help" title="Drag to reorder"/);
  assert.match(sectionManager, /draggable=\{item\.id!=='footer'\}/);
  assert.doesNotMatch(sectionManager, /selected\.id==='footer'&&/);
});

test('empty catalog states never render fabricated category or product tiles', () => {
  assert.doesNotMatch(storefront, /StoreImagePlaceholderGrid|grid-empty-home-categories|grid-empty-product-shelf/);
  assert.doesNotMatch(collections, /StoreImagePlaceholderGrid|grid-empty-collections/);
  assert.doesNotMatch(productBrowse, /StoreImagePlaceholderGrid|grid-empty-products/);
  assert.match(storefront, /categories\.map\(category=>renderCategory\(category\)\)/);
  assert.match(productBrowse, /filteredProducts\.map\(product => <ProductCard/);
});

test('default and migrated theme values use the Plum and Cream master palette', () => {
  assert.match(theme, /primary:'#4A2837',accent:'#4A2837',background:'#FDFBF7'/);
  assert.match(theme, /normalizeThemeColor\(saved\.content\?\.theme\?\.primary,[^,]+,\['#334155','#6b2447'\]\)/);
  assert.match(globalCss, /--nura-primary: #4A2837/);
  assert.match(globalCss, /--nura-background: #FDFBF7/);
  assert.match(adminCss, /input\[type="range"\]::-webkit-slider-thumb[\s\S]*?background:var\(--ad-burgundy\)/);
});

test('primary actions, homepage defaults, and selected admin controls follow the master theme', () => {
  assert.match(storefront, /nura-contact-submit min-h-11 px-6 text-xs font-semibold/);
  assert.doesNotMatch(storefront, /nura-contact-submit[^"]*text-white/);
  assert.match(globalCss, /\.nura-contact-submit \{[^}]*background-color:var\(--nura-primary[^}]*color:hsl\(var\(--primary-foreground\)\)/);
  assert.match(globalCss, /\.nura-contact-submit:hover:not\(:disabled\) \{[^}]*color-mix\(in srgb,var\(--nura-primary/);
  assert.match(globalCss, /\.nura-store-footer \{ background-color:var\(--nura-primary[^}]*color:hsl\(var\(--primary-foreground\)\)/);
  assert.match(themeBridge, /\['bg', '#6B2447', '--nura-primary'\]/);
  assert.match(adminCss, /\.ad-toggle:checked \{ background: var\(--ad-burgundy\); \}/);
  assert.match(themeBridge, /bg-\[#6B2447\]/);
});

test('global master control supports theme gradients, shared typeface, and fixed save feedback', async () => {
  const [adminPanel, saveButton] = await Promise.all([
    read('../src/admin/AdminPanel.tsx'),
    read('../src/admin/AdminSaveButton.tsx'),
  ]);
  assert.match(theme, /primaryGradientMode:'solid'\|'gradient'/);
  assert.match(theme, /globalFontFamily:'sans-serif'\|'serif'/);
  assert.match(themeBridge, /--nura-primary-fill/);
  assert.match(themeBridge, /--nura-global-font-family/);
  assert.match(themeBridge, /--nura-gold/);
  assert.match(adminPanel, /button-save-all-admin-changes/);
  assert.match(adminPanel, /flushAllRestoredSettings/);
  assert.match(saveButton, /return null;/);
  assert.match(adminCss, /position: fixed; z-index: 11000/);
  assert.match(adminCss, /position:sticky; top:0; z-index:50/);
});


test('wordmark dot and semantic colors are controlled by Global Master Control', async () => {
  const [layoutControls, headerBranding, preloaderIndex, app] = await Promise.all([
    read('../src/admin/LayoutControls.tsx'),
    read('../src/components/StorefrontHeader.tsx'),
    read('../index.html'),
    read('../src/App.tsx'),
  ]);
  assert.match(layoutControls, /function HexColorField/);
  assert.match(layoutControls, /normalizeHexColor/);
  assert.match(layoutControls, /master-semantic-color-controls/);
  assert.match(layoutControls, /toggle-master-logo-dot/);
  assert.match(headerBranding, /data-testid="brand-logo-dot"/);
  assert.match(headerBranding, /data-theme-role="tagline"/);
  assert.match(preloaderIndex, /nura-loader-logo::after/);
  assert.match(preloaderIndex, /logoDotVisible/);
  assert.match(app, /logoDotColor:data.content.theme.logoDotColor/);
  assert.match(app, /logoDotVisible:data.content.theme.logoDotVisible/);
  assert.match(themeBridge, /--nura-section-title-color/);
  assert.match(themeBridge, /--nura-description-color/);
  assert.match(themeBridge, /--nura-subtitle-color/);
});

test('footer social profiles are editable in Footer information and migrate legacy links', async () => {
  const [footerInfo, adminPanel] = await Promise.all([
    read('../src/admin/FooterInfoManager.tsx'),
    read('../src/admin/AdminPanel.tsx'),
  ]);
  assert.match(theme, /type FooterSocialProfile=/);
  assert.ok(theme.includes('normalizeFooterSocialProfiles(saved.socialProfiles,legacySocialUrls)'));
  assert.match(footerInfo, /footer-social-profiles/);
  assert.match(footerInfo, /select-footer-social-icon/);
  assert.match(footerInfo, /button-add-footer-social-profile/);
  assert.match(footer, /footer.socialProfiles/);
  assert.match(adminPanel, /Open Footer information/);
  assert.doesNotMatch(adminPanel, /function renameSocial/);
});


test('wordmark dot shape, menu branding, password visibility, and save toast are global and stable', async () => {
  const [layout, header, drawer, index, app, footer, adminPanel, adminCss, login, icons, styles, themeBridge] = await Promise.all([
    read('../src/admin/LayoutControls.tsx'),
    read('../src/components/StorefrontHeader.tsx'),
    read('../src/components/MobileNavDrawer.tsx'),
    read('../index.html'),
    read('../src/App.tsx'),
    read('../src/components/StoreFooter.tsx'),
    read('../src/admin/AdminPanel.tsx'),
    read('../src/admin/admin.css'),
    read('../src/pages/CustomerAccountPage.tsx'),
    read('../src/lib/lucide-icons.ts'),
    read('../src/index.css'),
    read('../src/components/ThemeBridge.tsx'),
  ]);
  assert.match(layout, /select-master-logo-dot-shape/);
  assert.match(layout, /range-global-icon-scale/);
  assert.match(layout, /range-global-text-scale/);
  assert.match(header, /className="nura-logo-dot[^>]*\/>/);
  assert.match(drawer, /mobile-menu-brand-dot/);
  assert.match(index, /border-radius:var\(--nura-logo-dot-radius,50%\)/);
  assert.match(app, /logoDotShape:data.content.theme.logoDotShape/);
  assert.match(footer, /text-\[30px\]/);
  assert.doesNotMatch(header, /nura-wordmark-name[^>]*truncate/);
  assert.doesNotMatch(footer, /nura-wordmark-name[^>]*truncate/);
  assert.match(styles, /\.nura-wordmark-name \{[^}]*overflow:visible/);
  assert.match(styles, /\.nura-wordmark-name-long \{[^}]*text-overflow:ellipsis/);
  assert.match(themeBridge, /letter-spacing:-\.05em/);
  assert.match(footer, /footer-store-subtitle/);
  assert.match(adminPanel, /createPortal\(<div className="ad-toast"/);
  assert.match(adminCss, /position: fixed; z-index: 11000; top:/);
  assert.match(login, /button-toggle-password-visibility/);
  assert.match(icons, /default as EyeOff/);
});

test('category display renders the normalized Supabase settings and ignores stale buffered snapshots after save', async () => {
  const [context, storefront, adminPanel, layout] = await Promise.all([
    read('../src/context/AdminContext.tsx'),
    read('../src/components/Storefront.tsx'),
    read('../src/admin/AdminPanel.tsx'),
    read('../src/utils/storefrontLayout.ts'),
  ]);
  assert.match(context, /normalizeCategoryPresentation\(saved\.content\?\?\{\},defaultAdminData\.content\)/);
  assert.doesNotMatch(context, /starterTemplateVersion!==1&&saved\.content\?\.categoryLayout/);
  assert.match(context, /visible:savedSectionVisibility\(row\.visible,definition\.defaultVisible\)/);
  assert.match(layout, /value === 'horizontal' \|\| value === 'single-row' \|\| value === 'marquee'/);
  assert.match(storefront, /data\.content\.categoryLayout==='circle'/);
  assert.match(storefront, /data\.content\.categoryDisplayMode==='horizontal'/);
  assert.match(storefront, /data-shape=\{circle\?'circle':'box'\}/);
  assert.match(storefront, /data-speed=\{horizontal\?motionSpeed:undefined\}/);
  assert.match(adminPanel, /select-home-category-layout/);
  assert.match(context, /committedRemoteKeys/);
  assert.match(context, /delete remote\.current\[key\]/);
  assert.doesNotMatch(adminPanel, /input-category-color/);
});


test('theme defaults coexist with saved promotional and product-card color controls', async () => {
  const [widgets, marquee, badges, countdown, productBrowse, mobileDock, themeBridge, context] = await Promise.all([
    read('../src/admin/FloatingWidgetsManager.tsx'),
    read('../src/admin/MarqueeBarsManager.tsx'),
    read('../src/admin/StorefrontSettingsEngines.tsx'),
    read('../src/components/CountdownTimer.tsx'),
    read('../src/components/ProductBrowse.tsx'),
    read('../src/components/MobileBottomNav.tsx'),
    read('../src/components/ThemeBridge.tsx'),
    read('../src/context/AdminContext.tsx'),
  ]);
  assert.ok(widgets.includes('Button background'));
  assert.ok(widgets.includes('Button text / icon'));
  assert.ok(marquee.includes('Banner background'));
  assert.ok(marquee.includes('Banner text'));
  assert.ok(badges.includes('Wishlist heart'));
  assert.ok(badges.includes('Discount background'));
  assert.ok(countdown.includes('timer.backgroundColor'));
  assert.ok(countdown.includes('timer.textColor'));
  assert.ok(productBrowse.includes('var(--nura-background'));
  assert.ok(mobileDock.includes('var(--nura-primary-fill'));
  assert.ok(themeBridge.includes('nura-theme-button'));
  assert.ok(context.includes('wishlistBackgroundColor'));
});


test('Nura starter content is complete, visible by default, and safe for customer-facing use', async () => {
  const [context, sections, storefront, productCard, adminPanel, readme] = await Promise.all([
    read('../src/context/AdminContext.tsx'),
    read('../src/types/homeSections.ts'),
    read('../src/components/Storefront.tsx'),
    read('../src/components/ProductCard.tsx'),
    read('../src/admin/AdminPanel.tsx'),
    read('../../../README.md'),
  ]);
  assert.match(context, /Complimentary delivery on orders over Rs 3,000 — across Pakistan/);
  assert.match(context, /Fine jewelry, lit from within\./);
  assert.match(context, /Crafted for Life’s Special Moments/);
  assert.match(context, /A Gift That Lasts Forever/);
  assert.match(context, /urduTitle:'ہماری کہانی'/);
  assert.match(context, /Get Exclusive Offers/);
  assert.match(context, /nura-social-jewelry-box\.jpg/);
  assert.doesNotMatch(context, /nura-sample-review/);
  assert.match(context, /function normalizeStarterPolicies/);
  assert.match(context, /products:\[\],\s*categories:\[\]/);
  assert.doesNotMatch(context, /starterCatalog|seedStarterCatalog/);
  assert.match(sections, /id:'instagram'.*defaultVisible:true/);
  assert.match(sections, /id:'offerBanner'.*defaultVisible:true/);
  assert.match(sections, /id:'mediaBanner'.*defaultVisible:true/);
  assert.match(storefront, /grid-home-occasion-promos/);
  assert.match(storefront, /section\.id==='mediaBanner'&&offerVisible/);
  assert.match(productCard, /No reviews/);
  assert.doesNotMatch(productCard, /4\.8/);
  assert.doesNotMatch(adminPanel, /button-seed-nura-starter-catalog|Add Nura starter catalog/);
  assert.match(readme, /Products, categories, inventory, and reviews are read from Supabase/);
});
