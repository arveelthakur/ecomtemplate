import assert from 'node:assert/strict';
import test from 'node:test';
import { migrateStarterMedia } from '../src/utils/starterMediaMigration.ts';

const defaults = {
  splashScreen: {
    enabled: true,
    imageUrl: '/images/nura-editorial-hero-mobile.jpg',
    title: 'nura.',
    tagline: 'wear your glow.',
    buttonText: 'Get started',
  },
  heroSlides: [
    { id: 'hero-one', eyebrow: 'The edit', title: 'First', copy: 'First copy', cta: 'Shop', desktopImageUrl: '/one.jpg', mobileImageUrl: '/one-mobile.jpg' },
    { id: 'hero-two', eyebrow: 'Occasion', title: 'Second', copy: 'Second copy', cta: 'Explore', desktopImageUrl: '/two.jpg', mobileImageUrl: '/two.jpg' },
    { id: 'hero-three', eyebrow: 'Everyday', title: 'Third', copy: 'Third copy', cta: 'Discover', desktopImageUrl: '/three.jpg', mobileImageUrl: '/three.jpg' },
  ],
};

test('upgrades the untouched legacy Nura seed to an enabled splash and three image slides', () => {
  const oldSlide = {
    id: 'hero-one',
    eyebrow: 'The edit',
    title: 'First',
    copy: 'First copy',
    cta: 'Shop',
    desktopImageUrl: '/one.jpg',
    mobileImageUrl: '/one-mobile.jpg',
  };
  const result = migrateStarterMedia({
    splashScreen: { ...defaults.splashScreen, enabled: false },
    heroSlides: [oldSlide],
  }, defaults);

  assert.equal(result.changed, true);
  assert.equal(result.content.splashScreen.enabled, true);
  assert.equal(result.content.heroSlides.length, 3);
  assert.equal(result.content.editorialMediaVersion, 1);
});

test('preserves customized splash and hero content during the one-time migration', () => {
  const customized = {
    editorialMediaVersion: 0,
    splashScreen: { ...defaults.splashScreen, enabled: false, title: 'My shop' },
    heroSlides: [{ ...defaults.heroSlides[0], title: 'My campaign' }],
  };
  const result = migrateStarterMedia(customized, defaults);

  assert.equal(result.content.splashScreen.title, 'My shop');
  assert.equal(result.content.splashScreen.enabled, false);
  assert.equal(result.content.heroSlides[0].title, 'My campaign');
  assert.equal(result.content.heroSlides.length, 1);
  assert.equal(result.content.editorialMediaVersion, 1);
});

test('does not repeat a completed media migration', () => {
  const content = { editorialMediaVersion: 1, splashScreen: { ...defaults.splashScreen, enabled: false }, heroSlides: [] };
  const result = migrateStarterMedia(content, defaults);
  assert.equal(result.changed, false);
  assert.equal(result.content, content);
});

test('repairs missing splash data in a completed migration without replacing customized slides', () => {
  const customizedSlides = [{ ...defaults.heroSlides[0], title: 'Saved campaign' }];
  const content = { editorialMediaVersion: 1, heroSlides: customizedSlides };
  const result = migrateStarterMedia(content, defaults);

  assert.equal(result.changed, true);
  assert.deepEqual(result.content.splashScreen, defaults.splashScreen);
  assert.deepEqual(result.content.heroSlides, customizedSlides);
  assert.equal(result.content.editorialMediaVersion, 1);
});

test('repairs missing hero slides in a completed migration without changing a disabled splash', () => {
  const disabledSplash = { ...defaults.splashScreen, enabled: false, title: 'My store' };
  const result = migrateStarterMedia({
    editorialMediaVersion: 1,
    splashScreen: disabledSplash,
  }, defaults);

  assert.equal(result.changed, true);
  assert.deepEqual(result.content.splashScreen, disabledSplash);
  assert.deepEqual(result.content.heroSlides, defaults.heroSlides);
});
