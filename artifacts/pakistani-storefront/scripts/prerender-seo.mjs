import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { categoryRoute, generateSeoMetadata, policyRoute, policyRouteMap, productRoute, resolveSeoMetadata } from './seo-utils.mjs';

const artifactRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = path.join(artifactRoot, 'dist', 'public');

// Prefer an explicit canonical origin, then standard hosting-provided build URLs.
export function resolvePublicSiteUrl(environment = process.env) {
  const hostingUrl = environment.VERCEL_URL
    ? `https://${environment.VERCEL_URL}`
    : environment.URL || environment.CF_PAGES_URL;
  const candidate = environment.PUBLIC_SITE_URL || hostingUrl;
  if (!candidate) {
    throw new Error('Set PUBLIC_SITE_URL or use a host-provided canonical URL for SEO prerendering.');
  }
  return normalizeSiteUrl(candidate);
}

const siteUrl = resolvePublicSiteUrl();
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

function normalizeSiteUrl(value) {
  if (!value) throw new Error('SEO prerendering needs a published site origin.');
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('PUBLIC_SITE_URL must be a valid absolute http(s) URL.');
  }
  if (!['http:', 'https:'].includes(url.protocol) || (url.pathname !== '/' && url.pathname !== '')) {
    throw new Error('PUBLIC_SITE_URL must contain only the site origin, without a path or query.');
  }
  return url.origin;
}

const supabaseRestRoot = supabaseUrl
  ? `${supabaseUrl.replace(/\/+$/, '')}/rest/v1`
  : '';
const routes = new Map();
const sitemap = new Map();
const embeddedProductImages = new Map();
let shellHtml = '';
let siteName = 'Online shop';
let siteSubtitle = '';
let sitePrimary = '#4A2837';
let siteBackground = '#FDFBF7';

function safeThemeColor(value, fallback) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function tableRowToProduct(row) {
  const extra = row?.extra && typeof row.extra === 'object' ? row.extra : {};
  return {
    ...extra,
    ...row,
    id: row.id,
    category: row.category_label || row.category_id || '',
    oldPrice: row.old_price,
    fromPrice: row.from_price,
    variantMatrix: row.variant_matrix,
    variationTypes: row.variation_types,
    additionalInfo: row.additional_info,
    shippingInfo: row.shipping_info,
    inStock: row.in_stock,
    freeDeliveryEligible: row.free_delivery_eligible,
    cashOnDeliveryEnabled: row.cash_on_delivery_enabled,
    quantityDiscounts: row.quantity_discounts,
  };
}

function tableRowToCategory(row) {
  const extra = row?.extra && typeof row.extra === 'object' ? row.extra : {};
  return { ...extra, ...row, id: row.id };
}

function tableRowToReview(row) {
  const extra = row?.extra && typeof row.extra === 'object' ? row.extra : {};
  return { ...extra, ...row, id: row.id, text: row.body };
}

async function readTable(tableName, search = '') {
  if (!supabaseRestRoot || !supabaseAnonKey) {
    console.warn(`[seo] Supabase is not configured; prerendering ${tableName} with empty data.`);
    return [];
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const url = new URL(`${supabaseRestRoot}/${tableName}`);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Supabase URL must use HTTP or HTTPS.');
    url.searchParams.set('select', '*');
    for (const parameter of search.split('&').filter(Boolean)) {
      const separator = parameter.indexOf('=');
      if (separator > 0) {
        url.searchParams.set(parameter.slice(0, separator), parameter.slice(separator + 1));
      }
    }
    const response = await fetch(url, {
      headers: {
        apikey: supabaseAnonKey,
        authorization: `Bearer ${supabaseAnonKey}`,
        accept: 'application/json',
      },
      signal: controller.signal,
    });
    if (response.status === 204) return [];
    if (!response.ok) {
      console.warn(`[seo] Supabase returned HTTP ${response.status} for ${tableName}; prerendering that dataset as empty.`);
      return [];
    }
    const payload = await response.json();
    return Array.isArray(payload) ? payload : [];
  } catch (error) {
    const reason = error instanceof Error && error.name === 'AbortError' ? 'request timed out' : 'request failed';
    console.warn(`[seo] Supabase ${tableName} ${reason}; prerendering that dataset as empty.`);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

async function readCollection(collectionId) {
  const rows = await readTable(collectionId, 'limit=1000');
  if (collectionId === 'products') return rows.map(tableRowToProduct);
  if (collectionId === 'categories') return rows.map(tableRowToCategory);
  return rows;
}

async function readGlobalContent() {
  const [row] = await readTable('store_config', 'id=eq.global&limit=1');
  if (!row || typeof row !== 'object') return {};
  return {
    content: row.content && typeof row.content === 'object' ? row.content : {},
    settings: row.settings && typeof row.settings === 'object' ? row.settings : {},
    policies: row.policies && typeof row.policies === 'object' ? row.policies : {},
  };
}

async function readPublishedReviews() {
  return (await readTable('reviews', 'published=eq.true&order=created_at.desc&limit=1000'))
    .map(tableRowToReview);
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function normalizePreloaderSettings(value) {
  const settings = value && typeof value === 'object' ? value : {};
  const minimumDisplayMs = Number(settings.minimumDisplayMs);
  const style = ['nura-pulse', 'store-logo', 'favicon', 'minimal-spinner'].includes(settings.style)
    ? settings.style
    : settings.style === 'plum-spinner'
      ? 'minimal-spinner'
      : 'nura-pulse';
  return {
    enabled: typeof settings.enabled === 'boolean' ? settings.enabled : true,
    style,
    loadingText: typeof settings.loadingText === 'string' ? settings.loadingText.trim().slice(0, 80) : 'Loading your store...',
    storeName: typeof settings.storeName === 'string' && !/^your store$/i.test(settings.storeName.trim()) ? settings.storeName.trim().slice(0, 120) : '',
    storeSubtitle: typeof settings.storeSubtitle === 'string' ? settings.storeSubtitle.trim().slice(0, 140) : '',
    minimumDisplayMs: Number.isFinite(minimumDisplayMs)
      ? Math.max(500, Math.min(1500, Math.round(minimumDisplayMs / 50) * 50))
      : 500,
    storeLogoUrl: safePreloaderAssetUrl(settings.storeLogoUrl),
    faviconUrl: safePreloaderAssetUrl(settings.faviconUrl),
  };
}

function safePreloaderAssetUrl(value) {
  if (typeof value !== 'string') return '';
  const candidate = value.trim().slice(0, 1500);
  if (candidate.startsWith('/') && !candidate.startsWith('//')) return candidate;
  try {
    const url = new URL(candidate);
    return url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

export function injectPreloaderSettings(html, rawSettings) {
  const settings = normalizePreloaderSettings(rawSettings);
  const style = settings.style === 'store-logo' && !settings.storeLogoUrl ? 'nura-pulse' : settings.style;
  const imageUrl = style === 'store-logo'
    ? settings.storeLogoUrl
    : style === 'favicon'
      ? settings.faviconUrl || '/favicon.svg'
      : '';
  settings.style = style;
  const safeJson = JSON.stringify(settings).replace(/[<>&\u2028\u2029]/g, character => ({
    '<': '\\u003c',
    '>': '\\u003e',
    '&': '\\u0026',
    '\u2028': '\\u2028',
    '\u2029': '\\u2029',
  })[character]);
  const configPattern = /<script id="nura-preloader-config" type="application\/json">[\s\S]*?<\/script>/i;
  if (!configPattern.test(html)) throw new Error('The storefront shell is missing its preloader settings slot.');
  let result = html.replace(configPattern, `<script id="nura-preloader-config" type="application/json">${safeJson}</script>`);
  result = result.replace(/<body class="([^"]*)"/i, (_, originalClasses) => {
    const classes = new Set(originalClasses.split(/\s+/).filter(Boolean));
    if (settings.enabled) classes.delete('nura-preloader-disabled');
    else classes.add('nura-preloader-disabled');
    return `<body class="${[...classes].join(' ')}"`;
  });
  result = result.replace(/(<div id="nura-preloader"[^>]*\bdata-style=")[^"]*(")/i, (_match, before, after) => `${before}${settings.style}${after}`);
  const brandingLabel = [settings.storeName, settings.storeSubtitle].filter(Boolean).join(' — ') || settings.loadingText || 'The store is loading';
  result = result.replace(/(<div id="nura-preloader"[^>]*\baria-label=")[^"]*(")/i, (_match, before, after) => `${before}${escapeHtml(brandingLabel)}${after}`);
  result = result.replace(/(<div class="nura-loader-logo">)[\s\S]*?(<\/div>)/i, (_match, before, after) => `${before}${escapeHtml(settings.storeName)}${after}`);
  result = result.replace(/(<div class="nura-loader-message">)[\s\S]*?(<\/div>)/i, (_match, before, after) => `${before}${escapeHtml(settings.storeSubtitle || settings.loadingText)}${after}`);
  result = result.replace(/<img class="nura-loader-image"[^>]*>/i, `<img class="nura-loader-image" alt="" decoding="async" fetchpriority="high"${imageUrl ? ` src="${escapeHtml(imageUrl)}"` : ''}>`);
  return result;
}

export async function renderAppShellWithCurrentPreloader(sourceShellHtml) {
  const globalContent = await readGlobalContent();
  const settings = globalContent.settings || {};
  const branding = settings.general || {};
  return injectPreloaderSettings(sourceShellHtml, {
    ...settings.preloader,
    storeLogoUrl: branding.storeLogoUrl,
    faviconUrl: branding.faviconUrl,
    storeName: branding.storeName,
    storeSubtitle: branding.storeSubtitle,
  });
}

function escapeXml(value = '') {
  return escapeHtml(value).replace(/&#39;/g, '&apos;');
}

function absoluteUrl(value, fallback = '/nura-hero.jpg') {
  const candidate = typeof value === 'string' && value.trim() ? value.trim() : fallback;
  try {
    const url = new URL(candidate, `${siteUrl}/`);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : new URL(fallback, `${siteUrl}/`).href;
  } catch {
    return new URL(fallback, `${siteUrl}/`).href;
  }
}

const embeddedImageTypes = new Map([
  ['image/avif', 'avif'],
  ['image/gif', 'gif'],
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

function parseEmbeddedImage(value) {
  if (typeof value !== 'string') return null;
  const match = value.match(/^data:(image\/(?:avif|gif|jpeg|png|webp));base64,([a-z\d+/]+={0,2})$/i);
  if (!match || match[2].length > 14_000_000) return null;
  const contentType = match[1].toLowerCase();
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > 10_000_000 || bytes.toString('base64').replace(/=+$/, '') !== match[2].replace(/=+$/, '')) return null;
  return { contentType, bytes };
}

function embeddedImagePath(productId, index, contentType, bytes) {
  const key = Buffer.from(String(productId)).toString('base64url');
  const version = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
  return `/seo-product-images/${key}/${index}-${version}.${embeddedImageTypes.get(contentType)}`;
}

function resolveProductImage(image, product, index) {
  if (typeof image !== 'string' || !image.trim()) return { pageUrl: '', crawlerUrl: '' };
  const parsed = parseEmbeddedImage(image);
  if (!parsed) {
    return image.startsWith('data:')
      ? { pageUrl: image, crawlerUrl: '' }
      : { pageUrl: absoluteUrl(image), crawlerUrl: absoluteUrl(image) };
  }
  const pathname = embeddedImagePath(product.id, index, parsed.contentType, parsed.bytes);
  embeddedProductImages.set(pathname, parsed);
  return { pageUrl: absoluteUrl(pathname), crawlerUrl: absoluteUrl(pathname) };
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function richText(value) {
  return Array.isArray(value) ? value.map(text).filter(Boolean).join(' ') : text(value);
}

function formattedPrice(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `Rs ${new Intl.NumberFormat('en-PK', { maximumFractionDigits: 0 }).format(number)}` : 'Price shown at checkout';
}

function safeProduct(product) {
  const id = Number(product.id ?? product.__documentId);
  if (!Number.isInteger(id) || id < 0 || !text(product.name)) {
    throw new Error('SEO prerender found a product without a valid numeric ID and name.');
  }
  return { ...product, id };
}

function safeCategory(category) {
  const id = text(category.id ?? category.__documentId);
  if (!id || !text(category.name)) throw new Error('SEO prerender found a category without an ID and name.');
  return { ...category, id };
}

function setMeta(html, attribute, name, value) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`<meta\\b(?=[^>]*\\b${attribute}\\s*=\\s*["']${escapedName}["'])[^>]*>`, 'i');
  const tag = `<meta ${attribute}="${escapeHtml(name)}" content="${escapeHtml(value)}">`;
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace('</head>', `  ${tag}\n  </head>`);
}

function setCanonical(html, url) {
  const pattern = /<link\b(?=[^>]*\brel\s*=\s*["']canonical["'])[^>]*>/i;
  const tag = `<link rel="canonical" href="${escapeHtml(url)}">`;
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace('</head>', `  ${tag}\n  </head>`);
}

function staticHeader() {
  const visibleName = siteName === 'Online shop' ? '' : siteName;
  const brand = visibleName
    ? `<span style="font-size:22px;font-weight:700">${escapeHtml(visibleName)}</span>`
    : `<span aria-hidden="true" style="display:inline-block;width:18px;height:18px;border:2px solid ${escapeHtml(sitePrimary)};border-radius:50%"></span>`;
  const subtitle = siteSubtitle ? `<small style="display:block;margin-top:3px;font-size:11px;letter-spacing:.04em;color:${escapeHtml(sitePrimary)}">${escapeHtml(siteSubtitle)}</small>` : '';
  const linkStyle = `color:${escapeHtml(sitePrimary)};text-decoration:none`;
  return `<header style="border-bottom:1px solid ${escapeHtml(sitePrimary)}33;background:${escapeHtml(siteBackground)};color:${escapeHtml(sitePrimary)};padding:20px max(24px,calc((100vw - 1120px)/2));display:flex;justify-content:space-between;gap:24px;align-items:center;font:500 14px Inter,Arial,sans-serif"><a href="/" aria-label="Store home" style="display:block;${linkStyle}">${brand}${subtitle}</a><nav aria-label="Main navigation" style="display:flex;gap:20px;flex-wrap:wrap"><a href="/shop" style="${linkStyle}">Shop</a><a href="/collections" style="${linkStyle}">Categories</a><a href="/about" style="${linkStyle}">Our story</a><a href="/reviews" style="${linkStyle}">Reviews</a></nav></header>`;
}

function staticFooter() {
  const linkStyle = `color:${escapeHtml(sitePrimary)};text-decoration:none`;
  return `<footer style="border-top:1px solid ${escapeHtml(sitePrimary)}33;background:${escapeHtml(siteBackground)};color:${escapeHtml(sitePrimary)};margin-top:56px;padding:28px 24px;text-align:center;font:13px Inter,Arial,sans-serif"><a href="/policies/shipping" style="${linkStyle}">Shipping policy</a> · <a href="/policies/returns" style="${linkStyle}">Returns</a> · <a href="/policies/privacy" style="${linkStyle}">Privacy</a> · <a href="/policies/terms" style="${linkStyle}">Terms</a></footer>`;
}

function renderPage({ eyebrow, title, description, image, imageAlt, body, breadcrumbs = [] }) {
  const crumbHtml = breadcrumbs.map((crumb, index) => `${index ? '<span aria-hidden="true"> › </span>' : ''}<a href="${escapeHtml(crumb.href)}">${escapeHtml(crumb.label)}</a>`).join('');
  const imageHtml = image
    ? `<img src="${escapeHtml(absoluteUrl(image))}" alt="${escapeHtml(imageAlt || title)}" width="1000" height="1000" loading="eager" decoding="async" style="max-width:min(100%,480px);height:auto;object-fit:contain">`
    : '';
  return `${staticHeader()}<main class="page-wrap" style="max-width:1120px;margin:0 auto;padding:40px 24px 72px;background:${escapeHtml(siteBackground)};font:16px/1.65 Inter,Arial,sans-serif;color:#403638">${breadcrumbs.length ? `<nav aria-label="Breadcrumb" style="font-size:13px;margin-bottom:24px">${crumbHtml}</nav>` : ''}<p style="font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#71806b">${escapeHtml(eyebrow || '')}</p><h1 style="font-size:clamp(32px,6vw,58px);line-height:1.08;letter-spacing:-.04em;margin:12px 0 16px">${escapeHtml(title)}</h1><p style="max-width:760px;color:#766d64">${escapeHtml(description)}</p>${imageHtml}${body}</main>${staticFooter()}`;
}

function renderProductList(products, routeForProduct, siteName) {
  if (!products.length) return '<p>There are no products in this collection yet.</p>';
  return `<ul style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:28px;list-style:none;padding:0;margin:36px 0">${products.map(product => {
    const route = routeForProduct(product);
    const image = absoluteUrl(product.image);
    return `<li><a href="${escapeHtml(route)}" style="color:inherit;text-decoration:none"><img src="${escapeHtml(image)}" alt="${escapeHtml(text(product.seo?.imageAlt) || `${text(product.name)} from ${siteName}`)}" width="600" height="600" loading="lazy" decoding="async" style="width:100%;aspect-ratio:1;object-fit:contain;background:#f0e8de"><h2 style="font-size:20px;line-height:1.3;margin:12px 0 4px">${escapeHtml(text(product.name))}</h2><p style="margin:0;font-weight:600">${escapeHtml(formattedPrice(product.price))}</p><p style="font-size:14px;color:#766d64">${escapeHtml(text(product.description))}</p></a></li>`;
  }).join('')}</ul>`;
}

function jsonLd(script) {
  return JSON.stringify(script).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

function addRoute(routePath, canonicalPath, page, seo, schema, includeInSitemap = false) {
  const normalizedPath = routePath === '/' ? '/' : `/${routePath.split('/').filter(Boolean).join('/')}`;
  const canonicalUrl = new URL(canonicalPath, `${siteUrl}/`).href;
  const html = buildRouteHtml({ page, seo, canonicalUrl, schema });
  const existing = routes.get(normalizedPath);
  if (existing && existing.canonicalUrl !== canonicalUrl) {
    throw new Error(`SEO prerender found multiple pages for ${normalizedPath}.`);
  }
  routes.set(normalizedPath, { html, canonicalUrl });
  if (includeInSitemap) sitemap.set(canonicalPath, { priority: page.priority ?? 0.7 });
}

function buildRouteHtml({ page, seo, canonicalUrl, schema }) {
  let html = shellHtml;
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(seo.metaTitle)}</title>`);
  for (const [name, value] of Object.entries({
    description: seo.metaDescription,
    keywords: seo.keywords,
    robots: 'index, follow',
    'twitter:card': 'summary_large_image',
    'twitter:title': seo.ogTitle,
    'twitter:description': seo.ogDescription,
    'twitter:image': seo.imageUrl,
  })) html = setMeta(html, 'name', name, value);
  for (const [name, value] of Object.entries({
    'og:title': seo.ogTitle,
    'og:description': seo.ogDescription,
    'og:image': seo.imageUrl,
    'og:url': canonicalUrl,
    'og:type': schema?.['@type'] === 'Product' ? 'product' : 'website',
    'og:site_name': siteName,
    'og:locale': 'en_PK',
  })) html = setMeta(html, 'property', name, value);
  html = setCanonical(html, canonicalUrl);
  html = html.replace(/<script\b(?=[^>]*\btype\s*=\s*["']application\/ld\+json["'])[\s\S]*?<\/script>/gi, '');
  html = html.replace('</head>', `  <script type="application/ld+json">${jsonLd(schema)}</script>\n  </head>`);
  const rootPattern = /<div id="root">\s*<\/div>/i;
  if (!rootPattern.test(html)) throw new Error('Vite output no longer contains the expected empty #root mount point.');
  return html.replace(rootPattern, `<div id="root">${renderPage(page)}</div>`);
}

export async function generateSeoSnapshot({ writeFiles = false, sourceShellHtml = '' } = {}) {
  routes.clear();
  sitemap.clear();
  embeddedProductImages.clear();
  siteName = 'Online shop';
  siteSubtitle = '';
  sitePrimary = '#4A2837';
  siteBackground = '#FDFBF7';
  shellHtml = sourceShellHtml || await readFile(path.join(outputRoot, '.app-shell.html'), 'utf8')
    .catch(() => readFile(path.join(outputRoot, 'index.html'), 'utf8'));
  const [rawProducts, rawCategories, globalContent, reviews] = await Promise.all([
    readCollection('products'),
    readCollection('categories'),
    readGlobalContent(),
    readPublishedReviews(),
  ]);
  shellHtml = injectPreloaderSettings(shellHtml, {
    ...globalContent.settings?.preloader,
    storeLogoUrl: globalContent.settings?.general?.storeLogoUrl,
    faviconUrl: globalContent.settings?.general?.faviconUrl,
    storeName: globalContent.settings?.general?.storeName,
    storeSubtitle: globalContent.settings?.general?.storeSubtitle,
  });
  if (writeFiles) await writeFile(path.join(outputRoot, '.app-shell.html'), shellHtml, 'utf8');
  const products = rawProducts.map(safeProduct).filter(product => (product.status || 'active') === 'active');
  const categories = rawCategories.map(safeCategory);
  const configuredName = text(globalContent.settings?.general?.storeName).trim();
  siteName = configuredName && !/^your store$/i.test(configuredName) ? configuredName : 'Online shop';
  siteSubtitle = text(globalContent.settings?.general?.storeSubtitle);
  const brand = `${siteName} Pakistan`;
  const content = globalContent.content || {};
  sitePrimary = safeThemeColor(content.theme?.primary, '#4A2837');
  siteBackground = safeThemeColor(content.theme?.background, '#FDFBF7');
  const story = content.story || {};
  const policyData = globalContent.policies || {};
  const seoSettings = globalContent.settings?.seo || {};
  const autoGenerateSeo = seoSettings.autoGenerate !== false;
  const heroImage = text(content.heroSlides?.[0]?.desktopImageUrl) || '/nura-hero.jpg';

  function getSeo(custom, source, staticPageKey = '') {
    const pageOverride = staticPageKey ? seoSettings.pages?.[staticPageKey] : undefined;
    const value = resolveSeoMetadata({ ...pageOverride, ...custom }, { ...source, siteName: source.siteName || brand }, autoGenerateSeo);
    value.imageUrl = absoluteUrl(value.ogImageUrl || source.imageUrl || heroImage);
    return value;
  }

  function productPage(product, canonicalRoute, routePath = canonicalRoute, includeInSitemap = routePath === canonicalRoute) {
    const productDescription = text(product.description) || `${text(product.name)} from ${siteName}, thoughtfully selected and delivered across Pakistan.`;
    const rawImages = [...new Set([product.image, ...(Array.isArray(product.images) ? product.images : [])].filter(image => typeof image === 'string' && image.trim()))];
    const resolvedImages = rawImages.map((image, index) => resolveProductImage(image, product, index));
    const imageUrls = resolvedImages.map(image => image.pageUrl).filter(Boolean);
    const crawlerImageUrls = resolvedImages.map(image => image.crawlerUrl).filter(Boolean);
    const seo = getSeo(product.seo, {
      title: text(product.name),
      description: productDescription,
      imageUrl: crawlerImageUrls[0] || heroImage,
      category: text(product.category),
      brand: text(product.brand) || siteName,
    });
    if (text(product.seo?.ogImageUrl).startsWith('data:')) {
      const customImage = resolveProductImage(text(product.seo.ogImageUrl), product, rawImages.length);
      seo.imageUrl = customImage.crawlerUrl || crawlerImageUrls[0] || absoluteUrl(heroImage);
    } else {
      seo.imageUrl = absoluteUrl(text(product.seo?.ogImageUrl) || crawlerImageUrls[0] || heroImage);
    }
    const category = categories.find(item => item.name === product.category);
    const availability = product.inStock === false || Number(product.stock) <= 0 ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock';
    const features = Array.isArray(product.features) ? product.features.map(text).filter(Boolean) : [];
    const details = [
      ...features.map(feature => `<li>${escapeHtml(feature)}</li>`),
      ...(text(product.usage) ? [`<li><strong>How to use:</strong> ${escapeHtml(text(product.usage))}</li>`] : []),
      ...(text(product.shippingInfo) ? [`<li><strong>Shipping:</strong> ${escapeHtml(text(product.shippingInfo))}</li>`] : []),
      `<li><strong>Availability:</strong> ${availability.endsWith('InStock') ? 'In stock' : 'Out of stock'}</li>`,
    ];
    const variantHtml = Array.isArray(product.variants) && product.variants.length
      ? `<section><h2>Options</h2><ul>${product.variants.map(variant => `<li>${escapeHtml(String(variant))}</li>`).join('')}</ul></section>`
      : '';
    const gallery = imageUrls.map((image, index) => `<img src="${escapeHtml(image)}" alt="${escapeHtml(text(product.seo?.imageAlt) || `${text(product.name)}${index ? `, view ${index + 1}` : ''}`)}" width="800" height="800" ${index ? 'loading="lazy"' : 'loading="eager"'} decoding="async" style="max-width:min(100%,420px);height:auto;object-fit:contain">`).join('');
    const body = `<article itemscope itemtype="https://schema.org/Product"><meta itemprop="name" content="${escapeHtml(text(product.name))}"><meta itemprop="description" content="${escapeHtml(productDescription)}"><meta itemprop="sku" content="${escapeHtml(String(product.id))}"><div itemprop="image">${gallery}</div><p itemprop="category">${escapeHtml(text(product.category))}</p><p><strong itemprop="offers" itemscope itemtype="https://schema.org/Offer"><meta itemprop="priceCurrency" content="PKR"><meta itemprop="price" content="${escapeHtml(String(Number(product.price) || 0))}"><meta itemprop="availability" content="${availability}">${escapeHtml(formattedPrice(product.price))}</strong>${product.oldPrice ? ` <del>${escapeHtml(formattedPrice(product.oldPrice))}</del>` : ''}</p><p>${escapeHtml(productDescription)}</p>${variantHtml}<section><h2>Product details</h2><ul>${details.join('')}</ul></section><a href="/shop">Continue shopping</a></article>`;
    const page = {
      eyebrow: category?.name || 'Shop the collection',
      title: text(product.name),
      description: productDescription,
      image: resolvedImages[0]?.pageUrl || heroImage,
      imageAlt: seo.imageAlt,
      body,
      breadcrumbs: [{ label: 'Home', href: '/' }, { label: 'Shop', href: '/shop' }, ...(category ? [{ label: category.name, href: categoryRoute(category, categories) }] : [])],
      priority: 0.8,
    };
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: text(product.name),
      description: productDescription,
      ...(crawlerImageUrls.length ? { image: crawlerImageUrls } : {}),
      sku: String(product.id),
      category: text(product.category),
      brand: { '@type': 'Brand', name: text(product.brand) || siteName },
      offers: {
        '@type': 'Offer',
        url: new URL(canonicalRoute, `${siteUrl}/`).href,
        priceCurrency: 'PKR',
        price: Number(product.price) || 0,
        availability,
        itemCondition: 'https://schema.org/NewCondition',
      },
      ...(Number(product.rating) > 0 && Number(product.reviewCount) > 0 ? {
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: Number(product.rating),
          reviewCount: Number(product.reviewCount),
        },
      } : {}),
    };
    addRoute(routePath, canonicalRoute, page, seo, schema, includeInSitemap);
  }

  const homeTitle = text(content.heroSlides?.[0]?.title).replace(/\n/g, ' ') || 'Thoughtful wellness and home, delivered across Pakistan';
  const homeDescription = text(content.heroSlides?.[0]?.copy) || `Thoughtful wellness and home comforts from ${siteName}, delivered with care across Pakistan.`;
  const homeSeo = getSeo(null, { title: homeTitle, description: homeDescription, imageUrl: heroImage }, 'home');
  const homeBody = `<section><h2>Shop by category</h2>${categories.map(category => `<p><a href="${escapeHtml(categoryRoute(category, categories))}">${escapeHtml(category.name)} — ${escapeHtml(text(category.sub))}</a></p>`).join('')}</section><section><h2>Featured products</h2>${renderProductList(products, product => productRoute(product, products), siteName)}</section><p><a href="/about">Our story</a> · <a href="/reviews">Customer reviews</a></p>`;
  addRoute('/', '/', { eyebrow: siteName, title: homeTitle, description: homeDescription, image: heroImage, imageAlt: `${siteName} thoughtfully selected products`, body: homeBody, priority: 1 }, homeSeo, {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteName,
    url: siteUrl,
    description: homeDescription,
    publisher: { '@type': 'Organization', name: siteName, url: siteUrl },
  }, true);

  const shopPath = '/shop';
  const shopTitle = `Shop all products | ${siteName}`;
  const shopSeo = getSeo(null, { title: shopTitle, description: `Browse all ${siteName} products, with thoughtful details, current availability, and delivery across Pakistan.`, imageUrl: heroImage }, 'shop');
  addRoute(shopPath, shopPath, { eyebrow: `${siteName} collection`, title: 'Shop all products', description: shopSeo.metaDescription, body: renderProductList(products, product => productRoute(product, products), siteName), priority: 0.9 }, shopSeo, {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: shopTitle,
    url: new URL(shopPath, `${siteUrl}/`).href,
    mainEntity: { '@type': 'ItemList', itemListElement: products.map((product, index) => ({ '@type': 'ListItem', position: index + 1, url: new URL(productRoute(product, products), `${siteUrl}/`).href, name: text(product.name) })) },
  }, true);

  const collectionPath = '/collections';
  const collectionTitle = `Shop by category | ${siteName}`;
  const collectionDescription = `Explore ${siteName} collections and browse products by category.`;
  const collectionSeo = getSeo(null, { title: collectionTitle, description: collectionDescription, imageUrl: heroImage }, 'collections');
  const collectionBody = categories.map(category => `<article><h2><a href="${escapeHtml(categoryRoute(category, categories))}">${escapeHtml(category.name)}</a></h2><p>${escapeHtml(text(category.sub))}</p><img src="${escapeHtml(absoluteUrl(category.image))}" alt="${escapeHtml(text(category.seo?.imageAlt) || category.name)}" width="800" height="600" loading="lazy" style="max-width:100%;height:auto"></article>`).join('');
  addRoute(collectionPath, collectionPath, { eyebrow: 'Explore', title: 'Shop by category', description: collectionDescription, body: collectionBody, priority: 0.8 }, collectionSeo, {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: collectionTitle,
    url: new URL(collectionPath, `${siteUrl}/`).href,
    mainEntity: { '@type': 'ItemList', itemListElement: categories.map((category, index) => ({ '@type': 'ListItem', position: index + 1, url: new URL(categoryRoute(category, categories), `${siteUrl}/`).href, name: category.name })) },
  }, true);

  for (const category of categories) {
    const canonicalPath = categoryRoute(category, categories);
    const categoryProducts = products.filter(product => product.category === category.name);
    const description = text(category.sub) || `Explore ${category.name} products from ${siteName}, thoughtfully selected and delivered across Pakistan.`;
    const seo = getSeo(category.seo, { title: category.name, description, imageUrl: category.image, category: category.name });
    const page = { eyebrow: 'Collection', title: category.name, description: seo.metaDescription, image: category.image, imageAlt: seo.imageAlt, body: renderProductList(categoryProducts, product => productRoute(product, products), siteName), breadcrumbs: [{ label: 'Home', href: '/' }, { label: 'Categories', href: '/collections' }], priority: 0.7 };
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: seo.metaTitle,
      description: seo.metaDescription,
      url: new URL(canonicalPath, `${siteUrl}/`).href,
      mainEntity: { '@type': 'ItemList', itemListElement: categoryProducts.map((product, index) => ({ '@type': 'ListItem', position: index + 1, url: new URL(productRoute(product, products), `${siteUrl}/`).href, name: text(product.name) })) },
    };
    addRoute(canonicalPath, canonicalPath, page, seo, schema, true);
    addRoute(`/collections/${canonicalPath.split('/').at(-1)}`, canonicalPath, page, seo, schema, false);
  }

  for (const product of products) {
    const canonicalPath = productRoute(product, products);
    productPage(product, canonicalPath);
    const idPath = `/product/${encodeURIComponent(String(product.id))}`;
    if (idPath !== canonicalPath) productPage(product, canonicalPath, idPath, false);
  }

  const aboutTitle = text(story.title) || 'A softer everyday, rooted in home.';
  const aboutDescription = [text(story.paragraphOne), text(story.paragraphTwo)].filter(Boolean).join(' ');
  const aboutSeo = getSeo(story.seo, { title: aboutTitle, description: aboutDescription || `Learn about ${siteName} and the thoughtful finds chosen for everyday life.`, imageUrl: story.imageUrl || heroImage }, 'about');
  addRoute('/about', '/about', { eyebrow: text(story.eyebrow) || 'Our story', title: aboutTitle, description: aboutSeo.metaDescription, image: story.imageUrl || heroImage, imageAlt: aboutSeo.imageAlt, body: `<p>${escapeHtml(text(story.paragraphOne))}</p><p>${escapeHtml(text(story.paragraphTwo))}</p>${text(story.urduTitle) ? `<h2 lang="ur" dir="rtl">${escapeHtml(text(story.urduTitle))}</h2>` : ''}${text(story.urduCopy) ? `<p lang="ur" dir="rtl">${escapeHtml(text(story.urduCopy))}</p>` : ''}`, priority: 0.6 }, aboutSeo, { '@context': 'https://schema.org', '@type': 'AboutPage', name: aboutTitle, description: aboutSeo.metaDescription, url: new URL('/about', `${siteUrl}/`).href, publisher: { '@type': 'Organization', name: siteName } }, true);

  const reviewCopy = reviews.map(review => text(review.text)).filter(Boolean).join(' ');
  const reviewsTitle = `Customer reviews | ${siteName}`;
  const reviewsDescription = reviewCopy || `Read customer reviews and feedback about ${siteName}.`;
  const reviewsSeo = getSeo(null, { title: 'What Our Customers Say', description: reviewsDescription, imageUrl: heroImage }, 'reviews');
  const reviewsBody = `<section aria-label="Customer reviews">${reviews.map(review => `<article style="border-top:1px solid #e9e2d8;padding:20px 0"><p aria-label="${Number(review.rating) || 5} out of 5 stars">${'★'.repeat(Math.max(1, Math.min(5, Math.round(Number(review.rating) || 5))))}</p><blockquote>${escapeHtml(text(review.text))}</blockquote><p><strong>${escapeHtml(text(review.customer) || 'Customer')}</strong>${text(review.city) ? ` · ${escapeHtml(text(review.city))}` : ''}</p></article>`).join('')}</section>`;
  addRoute('/reviews', '/reviews', { eyebrow: 'Kind words', title: 'What Our Customers Say', description: reviewsSeo.metaDescription, body: reviewsBody, priority: 0.5 }, reviewsSeo, {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: reviewsTitle,
    description: reviewsSeo.metaDescription,
    url: new URL('/reviews', `${siteUrl}/`).href,
    ...(reviews.length ? { mainEntity: { '@type': 'ItemList', itemListElement: reviews.map((review, index) => ({ '@type': 'Review', position: index + 1, author: { '@type': 'Person', name: text(review.customer) || 'Customer' }, reviewBody: text(review.text), reviewRating: { '@type': 'Rating', ratingValue: Number(review.rating) || 5, bestRating: 5 } })) } } : {}),
  }, true);

  const policyNames = { terms: 'Terms of use', privacy: 'Privacy policy', shipping: 'Shipping policy', return: 'Return policy' };
  const policyRoutes = policyRouteMap(policyData);
  for (const [key, label] of Object.entries(policyNames)) {
    const policy = policyData[key] || {};
    const title = text(policy.title) || label;
    const clauses = Array.isArray(policy.clauses) ? policy.clauses : [];
    const description = [text(policy.intro), ...clauses.map(clause => text(clause.body))].filter(Boolean).join(' ');
    const canonicalPath = policyRoute(key, policyData);
    const seo = getSeo(policy.seo, { title, description: description || `${label} details for shopping with ${siteName}.`, imageUrl: policy.seo?.ogImageUrl || heroImage });
    const page = { eyebrow: 'Helpful details', title, description: seo.metaDescription, body: clauses.map(clause => `<article style="border-top:1px solid #e9e2d8;padding:20px 0"><h2>${escapeHtml(text(clause.heading))}</h2><p>${escapeHtml(text(clause.body))}</p></article>`).join(''), breadcrumbs: [{ label: 'Home', href: '/' }], priority: 0.3 };
    const schema = { '@context': 'https://schema.org', '@type': 'WebPage', name: seo.metaTitle, description: seo.metaDescription, url: new URL(canonicalPath, `${siteUrl}/`).href };
    addRoute(canonicalPath, canonicalPath, page, seo, schema, true);
    const legacyPath = `/policies/${key === 'return' ? 'returns' : key}`;
    const legacyOwner = [...policyRoutes].find(([, route]) => route === legacyPath)?.[0];
    if (legacyPath !== canonicalPath && (!legacyOwner || legacyOwner === key)) addRoute(legacyPath, canonicalPath, page, seo, schema, false);
    if (key === 'return' && legacyPath !== canonicalPath) {
      const returnOwner = [...policyRoutes].find(([, route]) => route === '/policies/return')?.[0];
      if (!returnOwner || returnOwner === key) addRoute('/policies/return', canonicalPath, page, seo, schema, false);
    }
    addRoute(`/policy/${key === 'return' ? 'returns' : key}`, canonicalPath, page, seo, schema, false);
    if (key === 'return') addRoute('/policy/return', canonicalPath, page, seo, schema, false);
  }

  if (writeFiles) {
    for (const [routePath, snapshot] of routes) {
      const target = routePath === '/' ? path.join(outputRoot, 'index.html') : path.join(outputRoot, ...routePath.split('/').filter(Boolean), 'index.html');
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, snapshot.html, 'utf8');
    }
    for (const [imagePath, image] of embeddedProductImages) {
      const target = path.join(outputRoot, ...imagePath.split('/').filter(Boolean));
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, image.bytes);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...sitemap.entries()].map(([routePath, item]) => `  <url><loc>${escapeXml(new URL(routePath, `${siteUrl}/`).href)}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>${item.priority.toFixed(1)}</priority></url>`).join('\n')}\n</urlset>\n`;
  const robotsPath = path.join(outputRoot, 'robots.txt');
  const existingRobots = await readFile(robotsPath, 'utf8').catch(() => 'User-agent: *\nAllow: /\n');
  const robots = existingRobots.split(/\r?\n/).filter(line => !/^sitemap:/i.test(line)).filter(Boolean);
  robots.push(`Sitemap: ${siteUrl}/sitemap.xml`);
  const robotsText = `${robots.join('\n')}\n`;
  if (writeFiles) {
    await writeFile(path.join(outputRoot, 'sitemap.xml'), sitemapXml, 'utf8');
    await writeFile(robotsPath, robotsText, 'utf8');
  }
  return {
    routes: new Map(routes),
    embeddedImages: new Map(embeddedProductImages),
    appShellHtml: shellHtml,
    sitemapXml,
    robotsText,
    siteName,
    siteUrl,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const snapshot = await generateSeoSnapshot({ writeFiles: true });
  console.log(`SEO prerender generated ${snapshot.routes.size} route snapshots and a sitemap with ${sitemap.size} canonical URLs.`);
}
