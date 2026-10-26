// Store plain text, not HTML. React also escapes text when rendering it.
export function sanitizeText(value: string, limit = 2000): string {
  return String(value).normalize('NFKC')
    .replace(/<(script|style|iframe|object)[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<[^>]*>/g, '').replace(/[<>]/g, '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .slice(0, limit);
}
export function sanitizeUrl(value: string): string {
  if (!value) return '';
  if (/^\/(?!\/)/.test(value)) return value;
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; }
  catch { return ''; }
}
export function cleanData<T>(value: T, key = ''): T {
  if (typeof value === 'string') {
    const embeddedImage=/^(?:image|images)$/i.test(key);
    if(embeddedImage&&value.length<=800*1024&&/^data:image\/(?:jpeg|png|webp|gif);base64,[a-z0-9+/]+={0,2}$/i.test(value))return value as T;
    const text = sanitizeText(value, 12000);
    // Preserve incomplete, harmless URL input while typing, but reject executable schemes.
    const urlField = /(url|images?|social|facebook|instagram|tiktok)$/i.test(key);
    const compact=text.replace(/\s/g,'');
    return (urlField && (/^[a-z][a-z0-9+.-]*:/i.test(compact) && !/^https?:/i.test(compact) || /^\/\//.test(compact)) ? '' : text) as T;
  }
  if (Array.isArray(value)) return value.map(item => cleanData(item, key)) as T;
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined).map(([k, v]) => [k, cleanData(v, k)])) as T;
  return value;
}
