export type ResponsiveStoreImageSources = {
  desktop: string;
  mobile: string;
  fallbacks: string[];
};

/**
 * Resolve a public Supabase Storage object key as well as an already-published URL.
 * Root-relative paths remain app assets; plain keys such as "banners/hero.webp"
 * are resolved against the configured public store-assets bucket.
 */
export function normalizeStoreImageSource(
  value: unknown,
  supabaseUrl = '',
  bucket = 'store-assets',
): string {
  if (typeof value !== 'string') return '';
  const source = value.trim();
  if (!source) return '';
  if (/^(?:https?:\/\/|data:image\/|blob:)/i.test(source)) return source;
  if (/^[a-z][a-z\d+.-]*:/i.test(source)) return '';
  if (source.startsWith('//')) return `https:${source}`;
  if (source.startsWith('/') || source.startsWith('./') || source.startsWith('../')) return source;

  const base = supabaseUrl.trim().replace(/\/+$/, '');
  if (!base || !/^[a-z0-9_-]{1,100}$/i.test(bucket)) return source;
  const objectKey = source.replace(/^\/+/, '').split('/').filter(Boolean).map(encodeURIComponent).join('/');
  if (!objectKey) return '';
  return `${base}/storage/v1/object/public/${bucket}/${objectKey}`;
}

export function resolveResponsiveStoreImageSources(
  desktopSource: unknown,
  mobileSource: unknown,
  fallbackSources: readonly unknown[] = [],
  failedSources: readonly string[] = [],
  supabaseUrl = '',
  bucket = 'store-assets',
): ResponsiveStoreImageSources {
  const normalize = (source: unknown) => normalizeStoreImageSource(source, supabaseUrl, bucket);
  const desktop = normalize(desktopSource);
  const mobile = normalize(mobileSource);
  const fallbacks = fallbackSources.map(normalize).filter(Boolean);
  const candidates = [...new Set([desktop, mobile, ...fallbacks].filter(Boolean))];
  const failed = new Set(failedSources);
  const available = candidates.filter(candidate => !failed.has(candidate));
  const preferredDesktop = [desktop, mobile, ...fallbacks.map(normalize)].find(candidate => candidate && !failed.has(candidate)) ?? '';
  const preferredMobile = [mobile, desktop, ...fallbacks.map(normalize)].find(candidate => candidate && !failed.has(candidate)) ?? '';
  return {
    desktop: preferredDesktop || available[0] || '',
    mobile: preferredMobile || available[0] || '',
    fallbacks: candidates,
  };
}
