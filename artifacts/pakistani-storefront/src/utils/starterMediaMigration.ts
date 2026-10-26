type HeroSlideLike = {
  id?: unknown;
  eyebrow?: unknown;
  title?: unknown;
  copy?: unknown;
  cta?: unknown;
  desktopImageUrl?: unknown;
  mobileImageUrl?: unknown;
};

type SplashLike = {
  enabled?: unknown;
  imageUrl?: unknown;
  title?: unknown;
  tagline?: unknown;
  buttonText?: unknown;
};

type StarterMediaDefaults = {
  heroSlides: HeroSlideLike[];
  splashScreen: Required<SplashLike>;
};

export type StarterMediaContent = {
  editorialMediaVersion?: unknown;
  heroSlides?: unknown;
  splashScreen?: unknown;
  [key: string]: unknown;
};

function isSeedHeroSlide(value: unknown, seed: HeroSlideLike) {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as HeroSlideLike;
  return ['id', 'eyebrow', 'title', 'copy', 'cta', 'desktopImageUrl', 'mobileImageUrl']
    .every(key => candidate[key as keyof HeroSlideLike] === seed[key as keyof HeroSlideLike]);
}

function isLegacySeedSplash(value: unknown, defaults: Required<SplashLike>) {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as SplashLike;
  return candidate.enabled === false
    && candidate.imageUrl === defaults.imageUrl
    && candidate.title === defaults.title
    && candidate.tagline === defaults.tagline
    && candidate.buttonText === defaults.buttonText;
}

/**
 * One-time upgrade for the previous Nura seed: show its welcome screen and
 * provide three editorial hero slides. Customized saved media is left alone.
 */
export function migrateStarterMedia(content: StarterMediaContent, defaults: StarterMediaDefaults) {
  if (content.editorialMediaVersion === 1) {
    const missingSplash = content.splashScreen == null;
    const missingSlides = content.heroSlides == null;
    if (!missingSplash && !missingSlides) return { content, changed: false };
    return {
      content: {
        ...content,
        ...(missingSplash ? { splashScreen: { ...defaults.splashScreen } } : {}),
        ...(missingSlides ? { heroSlides: defaults.heroSlides.map(slide => ({ ...slide })) } : {}),
      },
      changed: true,
    };
  }

  const legacySplash = content.splashScreen == null || isLegacySeedSplash(content.splashScreen, {
    ...defaults.splashScreen,
    enabled: false,
  });
  const savedSlides = Array.isArray(content.heroSlides) ? content.heroSlides : [];
  const legacyHero = savedSlides.length === 0
    || savedSlides.length === 1 && isSeedHeroSlide(savedSlides[0], defaults.heroSlides[0] ?? {});

  const migrated: StarterMediaContent = {
    ...content,
    editorialMediaVersion: 1,
    ...(legacySplash ? { splashScreen: { ...defaults.splashScreen, enabled: true } } : {}),
    ...(legacyHero ? { heroSlides: defaults.heroSlides.map(slide => ({ ...slide })) } : {}),
  };
  return {
    content: migrated,
    changed: legacySplash || legacyHero,
  };
}
