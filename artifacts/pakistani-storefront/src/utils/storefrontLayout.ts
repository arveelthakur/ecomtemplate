export type CategoryDisplayMode = 'grid' | 'horizontal';

/** Accept old single-row/marquee values while keeping one canonical storefront layout. */
export function normalizeCategoryDisplayMode(value: unknown): CategoryDisplayMode {
  return value === 'horizontal' || value === 'single-row' || value === 'marquee' ? 'horizontal' : 'grid';
}
