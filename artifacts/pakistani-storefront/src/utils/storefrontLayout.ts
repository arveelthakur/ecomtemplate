export type CategoryDisplayMode = 'grid' | 'horizontal';

/** Accept old single-row/marquee values while keeping one canonical storefront layout. */
export function normalizeCategoryDisplayMode(value: unknown): CategoryDisplayMode {
  return value === 'horizontal' || value === 'single-row' || value === 'marquee' ? 'horizontal' : 'grid';
}

/** Starter defaults only fill missing values; they must never overwrite saved choices. */
export function normalizeCategoryPresentation(saved: Record<string, unknown>, defaults: {
  categoryLayout: 'circle' | 'box';
  categoryDisplayMode: CategoryDisplayMode;
}) {
  return {
    categoryLayout: saved.categoryLayout === 'circle' || saved.categoryLayout === 'box'
      ? saved.categoryLayout : defaults.categoryLayout,
    categoryDisplayMode: saved.categoryDisplayMode === undefined
      ? defaults.categoryDisplayMode : normalizeCategoryDisplayMode(saved.categoryDisplayMode),
  };
}

export function savedSectionVisibility(value: unknown, defaultVisible: boolean): boolean {
  return typeof value === 'boolean' ? value : defaultVisible;
}

type SectionCopy = {id: string; headingOverride: string; subheadingOverride: string};
/** Editing the source text must not leave a stale generic section override masking it. */
export function synchronizeSectionCopy<T extends SectionCopy>(
  previous: {homeSections: T[]} & Record<string, unknown>,
  next: {homeSections: T[]} & Record<string, unknown>,
): T[] {
  const bindings = [
    ['offerBanner', 'offerBanner', 'title', 'copy'],
    ['mediaBanner', 'homeMediaBanner', 'title', 'copy'],
    ['story', 'story', 'title', 'eyebrow'],
    ['newsletter', 'newsletter', 'title', 'copy'],
    ['statistics', 'milestoneSettings', 'title', 'subheading'],
  ];
  const changed = new Map<string, [boolean, boolean]>();
  for (const [id, key, heading, subtitle] of bindings) {
    const before = previous[key] as Record<string, unknown> | undefined;
    const after = next[key] as Record<string, unknown> | undefined;
    changed.set(id, [before?.[heading] !== after?.[heading], before?.[subtitle] !== after?.[subtitle]]);
  }
  const heroCopy = (value: unknown, key: string) => JSON.stringify(
    Array.isArray(value) ? value.map(slide => slide?.[key]) : [],
  );
  changed.set('hero', [
    heroCopy(previous.heroSlides, 'title') !== heroCopy(next.heroSlides, 'title'),
    heroCopy(previous.heroSlides, 'eyebrow') !== heroCopy(next.heroSlides, 'eyebrow'),
  ]);
  return next.homeSections.map(section => {
    const before = previous.homeSections.find(item => item.id === section.id);
    const [headingChanged, subtitleChanged] = changed.get(section.id) ?? [false, false];
    return {
      ...section,
      headingOverride: headingChanged && before?.headingOverride === section.headingOverride ? '' : section.headingOverride,
      subheadingOverride: subtitleChanged && before?.subheadingOverride === section.subheadingOverride ? '' : section.subheadingOverride,
    };
  });
}
