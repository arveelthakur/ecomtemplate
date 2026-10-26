import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const component = await readFile(new URL('../../artifacts/pakistani-storefront/src/components/ImageUpload.tsx', import.meta.url), 'utf8');
const stylesheet = await readFile(new URL('../../artifacts/pakistani-storefront/src/admin/admin.css', import.meta.url), 'utf8');
const storefrontImage = await readFile(new URL('../../artifacts/pakistani-storefront/src/components/StoreImage.tsx', import.meta.url), 'utf8');
const storefrontStyles = await readFile(new URL('../../artifacts/pakistani-storefront/src/index.css', import.meta.url), 'utf8');
const heroSection = await readFile(new URL('../../artifacts/pakistani-storefront/src/components/Storefront.tsx', import.meta.url), 'utf8');
const mediaSections = await readFile(new URL('../../artifacts/pakistani-storefront/src/components/homepage/OptionalHomeSections.tsx', import.meta.url), 'utf8');
const productCard = await readFile(new URL('../../artifacts/pakistani-storefront/src/components/ProductCard.tsx', import.meta.url), 'utf8');
const collectionsPage = await readFile(new URL('../../artifacts/pakistani-storefront/src/pages/CollectionsPage.tsx', import.meta.url), 'utf8');
const adminPanel = await readFile(new URL('../../artifacts/pakistani-storefront/src/admin/AdminPanel.tsx', import.meta.url), 'utf8');

test('admin image uploads show a grid placeholder, image icon, upload guidance, and pixel recommendations', () => {
  assert.match(component, /ImagePlus/);
  assert.match(component, /ad-image-upload-dropzone/);
  assert.match(component, /select an existing image from the media library below/i);
  assert.match(component, /1000 × 1000 px/);
  assert.match(component, /800 × 800 px/);
  assert.match(component, /256 × 256 px/);
  assert.match(component, /1920 × 800 px/);
  assert.match(stylesheet, /background-size: 16px 16px/);
});

test('customer-facing missing images stay visually quiet while admin image slots retain upload guidance', () => {
  assert.match(storefrontImage, /showPlaceholder = false/);
  assert.match(storefrontImage, /if \(!showPlaceholder\) return null/);
  assert.match(storefrontImage, /onError=/);
  assert.match(storefrontStyles, /\.store-image-placeholder\s*\{/);
  const customerComponents = [heroSection, mediaSections, productCard, collectionsPage].join('\n');
  assert.doesNotMatch(customerComponents, /placeholder(?:Title|Hint|Dimensions|Shape)=/);
  assert.match(adminPanel, /showPlaceholder/);
  assert.match(component, /Desktop 1920 × 800 px/);
  assert.match(component, /1000 × 1000 px/);
});
