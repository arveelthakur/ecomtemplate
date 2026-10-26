import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { normalizeCategoryPresentation, savedSectionVisibility, synchronizeSectionCopy } from '../src/utils/storefrontLayout.ts';
import { checkoutDeliveryError, normalizePakistanMobile } from '../src/utils/pakistan.ts';
import { products } from '../src/utils/store.ts';
import { matchFailedStoreImageSource } from '../src/utils/storeImages.ts';

const defaults={categoryLayout:'circle',categoryDisplayMode:'horizontal'};

test('responsive image failures identify the real mobile source and retain accessible image props',async()=>{
  const candidates=['/images/desktop.jpg','/images/mobile.jpg'];
  assert.equal(matchFailedStoreImageSource(candidates,'https://nura.pk/images/mobile.jpg','https://nura.pk/'),'/images/mobile.jpg');
  assert.equal(matchFailedStoreImageSource(candidates,'https://nura.pk/images/desktop.jpg','https://nura.pk/'),'/images/desktop.jpg');
  const source=await readFile(new URL('../src/components/StoreImage.tsx',import.meta.url),'utf8');
  assert.match(source,/<img[\s\S]*?aria-label=\{ariaLabel\}[\s\S]*?data-testid=\{testId\}/);
});

test('starter catalog matches complimentary-delivery messaging without overwriting live rows',()=>{
  assert.ok(products.length>0);
  assert.ok(products.every(product=>product.freeDeliveryEligible===true));
  assert.ok(products.every(product=>!/\b(sample|template|confirm materials)\b/i.test(product.additionalInfo)));
});

test('Nura footer defaults are customer-facing jewelry copy rather than editor instructions',async()=>{
  const source=await readFile(new URL('../src/context/AdminContext.tsx',import.meta.url),'utf8');
  const defaults=source.slice(source.indexOf('const defaultFooterContent:'),source.indexOf('function normalizeFooter'));
  assert.match(defaults,/A considered edit of gold-tone, kundan-inspired and faux-pearl jewelry/);
  assert.doesNotMatch(defaults,/Replace this example|Example hours:/);
});

test('saved admin layouts and hidden states win over Nura starter defaults',()=>{
  assert.deepEqual(normalizeCategoryPresentation({categoryLayout:'box',categoryDisplayMode:'grid',starterTemplateVersion:0},defaults),{categoryLayout:'box',categoryDisplayMode:'grid'});
  assert.deepEqual(normalizeCategoryPresentation({},defaults),defaults);
  for(const mode of ['single-row','marquee','horizontal']){
    assert.equal(normalizeCategoryPresentation({categoryDisplayMode:mode},defaults).categoryDisplayMode,'horizontal');
  }
  assert.equal(savedSectionVisibility(false,true),false);
  assert.equal(savedSectionVisibility(true,false),true);
  assert.equal(savedSectionVisibility(undefined,false),false);
});

test('editing source copy clears only a stale override, without changing visibility or image-only edits',()=>{
  const section={id:'offerBanner',headingOverride:'Older heading',subheadingOverride:'Older copy',visible:false};
  const previous={homeSections:[section],offerBanner:{title:'Before',copy:'Before copy',imageUrl:'old.jpg'}};
  const edited={...previous,offerBanner:{title:'New title',copy:'Before copy',imageUrl:'old.jpg'}};
  assert.deepEqual(synchronizeSectionCopy(previous,edited),[{...section,headingOverride:''}]);
  const imageEdit={...previous,offerBanner:{...previous.offerBanner,imageUrl:'new.jpg'}};
  assert.deepEqual(synchronizeSectionCopy(previous,imageEdit),previous.homeSections);
  const intentionalOverride={...edited,homeSections:[{...section,headingOverride:'Intentional override'}]};
  assert.equal(synchronizeSectionCopy(previous,intentionalOverride)[0].headingOverride,'Intentional override');
});

test('Pakistan checkout validates mobile, supported cities, addresses and optional postal codes',()=>{
  const valid={fullName:'Sample Customer',phone:'0300 1234567',address:'10 Sample Street',city:'Lahore',postalCode:'54000'};
  assert.equal(checkoutDeliveryError(valid),null);
  assert.equal(checkoutDeliveryError({...valid,postalCode:''}),null);
  assert.equal(normalizePakistanMobile('0300 1234567'),'+923001234567');
  assert.equal(normalizePakistanMobile('+92 300 1234567'),'+923001234567');
  assert.equal(normalizePakistanMobile('0092 300 1234567'),'+923001234567');
  for(const patch of [{fullName:' '},{phone:'123'},{address:' '},{city:'unsupported'},{postalCode:'bad'}]){
    assert.equal(typeof checkoutDeliveryError({...valid,...patch}),'string');
  }
});

test('Urdu font is self-hosted with its license and isolated from global Latin typography',async()=>{
  const read=p=>readFile(new URL(p,import.meta.url),'utf8');
  const [css,bridge,license]=await Promise.all([read('../src/index.css'),read('../src/components/ThemeBridge.tsx'),read('../public/fonts/OFL-NotoNastaliqUrdu.txt')]);
  assert.match(css,/@font-face[\s\S]*?font-family:'Nura Nastaliq'/);
  assert.match(css,/noto-nastaliq-urdu-arabic\.woff2/);
  assert.match(bridge,/font-family:'Nura Nastaliq','Noto Nastaliq Urdu',serif!important/);
  assert.match(license,/SIL OPEN FONT LICENSE/i);
  const bytes=await readFile(new URL('../public/fonts/noto-nastaliq-urdu-arabic.woff2',import.meta.url));
  assert.equal(bytes.subarray(0,4).toString(),'wOF2');
});

test('mobile story and paired promos use full-width columns, safe text and covered images',async()=>{
  const css=await readFile(new URL('../src/index.css',import.meta.url),'utf8');
  const storefront=await readFile(new URL('../src/components/Storefront.tsx',import.meta.url),'utf8');
  const optional=await readFile(new URL('../src/components/homepage/OptionalHomeSections.tsx',import.meta.url),'utf8');
  const checkout=await readFile(new URL('../src/pages/CheckoutPage.tsx',import.meta.url),'utf8');
  assert.match(css,/\.nura-story \{ grid-template-columns:minmax\(0,1fr\)/);
  assert.match(css,/@media \(max-width:768px\)[\s\S]*?\.nura-story-image \{ aspect-ratio:4\/3/);
  assert.match(css,/grid-home-occasion-promos.*grid-template-columns:minmax\(0,1fr\)/);
  assert.match(storefront,/presentation="split"/);
  assert.match(optional,/data-presentation="split"/);
  assert.match(optional,/object-cover object-center.*data-testid="img-home-media"/);
  assert.match(checkout,/input-checkout-province/);
});

test('announcement and footer visibility apply to customer pages as well as the homepage',async()=>{
  const layout=await readFile(new URL('../src/components/CommerceLayout.tsx',import.meta.url),'utf8');
  const manager=await readFile(new URL('../src/admin/HomepageSectionsManager.tsx',import.meta.url),'utf8');
  assert.match(layout,/visible\('announcement'\)&&<AnnouncementBar/);
  assert.match(layout,/visible\('footer'\)&&<StoreFooter/);
  assert.match(manager,/toggle-homepage-section-announcement/);
});
