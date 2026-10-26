/** Returns only a name explicitly configured for this storefront. */
export function configuredStoreName(value: unknown): string {
  if (typeof value !== 'string') return '';
  const name = value.trim();
  if (!name || /^your store$/i.test(name)) return '';
  return name;
}
