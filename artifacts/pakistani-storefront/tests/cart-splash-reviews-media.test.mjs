import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read=path=>readFile(new URL(path,import.meta.url),'utf8');
const has=(source,pattern,label)=>assert.ok(pattern.test(source),`Expected ${label}`);

test('cart add-ons are admin-controlled, re-priced by the server and survive order summaries',async()=>{
  const [admin,context,checkout,api,success]=await Promise.all([
    read('../src/admin/StorePagesManager.tsx'),
    read('../src/context/StoreContext.tsx'),
    read('../src/pages/CheckoutPage.tsx'),
    read('../../../api/store/[name].ts'),
    read('../src/pages/OrderSuccessPage.tsx'),
  ]);
  has(admin,/data-testid="cart-drawer-admin-settings"/,'cart settings in admin');
  has(admin,/data-testid=\{`input-cart-addon-price-/,'editable cart add-on prices');
  has(context,/fingerprint=JSON\.stringify\(\{items,cartAddonIds:activeAddonIds\}\)/,'add-on-aware checkout idempotency');
  has(api,/const configuredAddons = Array\.isArray\(cartSettings\.addons\)/,'server-side add-on settings');
  has(api,/addon\.enabled === true/,'enabled-only add-on validation');
  has(api,/const price = money\(configured\.price, -1\)/,'server-selected add-on price');
  has(api,/cartAddonsSubtotal/,'add-on subtotal');
  has(checkout,/selectedCartAddons/,'checkout add-on summary');
  has(success,/order\.cartAddons/,'order-success add-on summary');
});

test('free-gift messaging and countdown are opt-in; estimate language is explicit',async()=>{
  const [defaults,storefront]=await Promise.all([
    read('../src/context/AdminContext.tsx'),
    read('../src/components/Storefront.tsx'),
  ]);
  has(defaults,/freeGiftTarget:0/,'disabled gift threshold by default');
  has(defaults,/countdownEnabled:false/,'disabled countdown by default');
  has(defaults,/name:'Gift wrap',[^\n]*enabled:false/,'unverified paid add-ons remain disabled by default');
  has(storefront,/settings\.freeGiftTarget>0/,'gift bar visibility control');
  has(storefront,/settings\.countdownEnabled&&settings\.countdownEndsAt/,'configured countdown');
  has(storefront,/Estimated weekdays; courier timing can vary/,'estimated delivery disclaimer');
});

test('video reviews display only published, safely embeddable HTTPS media',async()=>{
  const [storefront,sections,manager]=await Promise.all([
    read('../src/components/Storefront.tsx'),
    read('../src/types/homeSections.ts'),
    read('../src/admin/HomepageSectionsManager.tsx'),
  ]);
  has(storefront,/data\.reviews\.filter\(review=>review\.published&&review\.videoUrl\.trim\(\)\)/,'published-only review filtering');
  has(storefront,/parsed\.protocol!=='https:'/,'HTTPS-only video URLs');
  has(storefront,/youtube-nocookie\.com\/embed/,'privacy-enhanced YouTube embeds');
  has(storefront,/player\.vimeo\.com\/video/,'Vimeo embeds');
  has(sections,/id:'videoReviews'/,'toggleable video-review section');
  has(manager,/videoReviews/,'video-review admin section mapping');
});

test('welcome splash starts enabled with a jewelry image, is session-dismissable and has admin media guidance',async()=>{
  const [admin,storefront,panel]=await Promise.all([
    read('../src/context/AdminContext.tsx'),
    read('../src/components/Storefront.tsx'),
    read('../src/admin/AdminPanel.tsx'),
  ]);
  has(admin,/export const defaultSplashScreenSettings:SplashScreenSettings=\{\s*enabled:true,\s*imageUrl:'\/images\/nura-editorial-hero-mobile\.jpg'/,'enabled-by-default jewelry splash settings');
  has(storefront,/if\(storefrontSettingsState!=='ready'\|\|!settings\.enabled\)return/,'splash waits for saved settings and opt-in');
  has(storefront,/sessionStorage\.getItem\('nura-welcome-dismissed'\)/,'session-scoped dismissal');
  has(panel,/toggle-splash-enabled/,'admin can enable or disable the splash');
  has(panel,/input-splash-title/,'admin can edit the splash title');
  has(panel,/input-splash-tagline/,'admin can edit the splash tagline');
  has(panel,/input-splash-button-text/,'admin can edit CTA text');
  has(panel,/input-splash-image-url/,'admin can edit the splash background image');
  has(panel,/input-splash-description/,'admin can edit the splash description');
  has(panel,/select-splash-destination/,'admin can select a splash destination');
  has(panel,/input-splash-destination/,'admin can edit a custom internal route');
  has(storefront,/settings\.description/,'splash description renders from saved settings');
  has(storefront,/to=\{settings\.destination\|\|'.*'\}/,'splash CTA follows the selected destination');
  has(panel,/call-to-action stays centered beneath the copy and opens the selected storefront destination/,'admin note describes configurable CTA placement');
  has(panel,/Welcome splash: 1080 × 1920 px/,'splash image upload dimensions');
});

test('media library documents upload sizes for imagery and explains vector-only marks',async()=>{
  const [media,...uploadSources]=await Promise.all([
    read('../src/admin/AdminExtensions.tsx'),
    read('../src/admin/AdminPanel.tsx'),
    read('../src/admin/HomepageSectionContentControls.tsx'),
    read('../src/admin/HomepageSectionsManager.tsx'),
    read('../src/admin/StorePagesManager.tsx'),
    read('../src/admin/FloatingWidgetsManager.tsx'),
    read('../src/admin/StorefrontSettingsEngines.tsx'),
    read('../src/admin/email/BroadcastManager.tsx'),
    read('../src/admin/email/EmailEngineEditor.tsx'),
  ]);
  for(const dimension of [
    '1200 × 400 px','512 × 512 px','1000 × 1000 px','1200 × 1200 px',
    '1920 × 800 px','800 × 1000 px','1600 × 500 px','1600 × 1000 px','1080 × 1920 px',
    '400 × 400 px','1280 × 720 px','1200 × 630 px',
  ])assert.ok(media.includes(dimension),`Missing media guidance: ${dimension}`);
  assert.match(media,/Email campaign header banner/,'email banner has a media-library guide');
  has(media,/Trust badge and milestone symbols[\s\S]*?No upload required/,'vector trust icon guidance');
  has(media,/Footer social symbols[\s\S]*?No upload required/,'vector footer icon guidance');
  const uploads=uploadSources.flatMap(source=>[...source.matchAll(/<ImageUpload\b[\s\S]*?\/>/g)].map(match=>match[0]));
  assert.ok(uploads.length>0,'admin media upload controls exist');
  for(const upload of uploads)assert.match(upload,/recommendation=/,'every admin upload control shows its recommended dimensions');
});
