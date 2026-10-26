const collapseWhitespace = (value) => String(value || '').replace(/\s+/g, ' ').trim();

export function slugifySeo(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .trim()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
    .replace(/-+$/g, '');
}

function fitDescription(value, title, siteName) {
  const base = collapseWhitespace(value) || `Discover ${title} at ${siteName}, thoughtfully selected for everyday use.`;
  const filler = ` Shop ${title} online at ${siteName}, with delivery across Pakistan.`;
  let result = base;
  while (result.length < 150) result += filler;
  if (result.length > 160) {
    const trimmed = result.slice(0, 160).trimEnd();
    return trimmed.length >= 150 ? trimmed : result.slice(0, 150);
  }
  return result;
}

export function generateSeoMetadata(source) {
  const title = collapseWhitespace(source.title) || 'Thoughtful finds';
  const siteName = collapseWhitespace(source.siteName || 'Online shop');
  const description = collapseWhitespace(source.description || '');
  const metaTitle = collapseWhitespace(`${title} | ${siteName}`).slice(0, 60).trim();
  const metaDescription = fitDescription(
    [`Discover ${title}${source.category ? ` in ${source.category}` : ''} at ${siteName}.`, description, 'Shop online with delivery across Pakistan.']
      .filter(Boolean)
      .join(' '),
    title,
    siteName,
  );
  const keywordList = [
    title,
    source.category,
    source.brand,
    `buy ${title} online`,
    'Pakistan',
    siteName,
  ].map((value) => collapseWhitespace(value || '')).filter(Boolean);
  return {
    metaTitle,
    metaDescription,
    keywords: [...new Set(keywordList)].join(', '),
    imageAlt: collapseWhitespace(`${title}${source.category ? `, ${source.category}` : ''} from ${siteName}`),
    slug: slugifySeo(title),
    ogTitle: metaTitle,
    ogDescription: metaDescription,
    ogImageUrl: source.imageUrl || '',
  };
}

export function resolveSeoMetadata(custom, source, automatic = true) {
  const generated = generateSeoMetadata(source);
  const title = collapseWhitespace(source.title) || 'Thoughtful finds';
  const siteName = collapseWhitespace(source.siteName || 'Online shop');
  const fallback = automatic ? generated : {
    ...generated,
    metaTitle: `${title} | ${siteName}`.slice(0, 60),
    metaDescription: `Information about ${title} from ${siteName}.`,
    keywords: '',
    imageAlt: title,
    ogTitle: `${title} | ${siteName}`.slice(0, 60),
    ogDescription: `Information about ${title} from ${siteName}.`,
  };
  const result = {};
  for (const field of ['metaTitle', 'metaDescription', 'keywords', 'imageAlt', 'ogTitle', 'ogDescription', 'ogImageUrl']) {
    const value = typeof custom?.[field] === 'string' ? collapseWhitespace(custom[field]) : '';
    result[field] = value || fallback[field];
  }
  const customSlug = typeof custom?.slug === 'string' ? collapseWhitespace(custom.slug) : '';
  result.ogTitle = (typeof custom?.ogTitle === 'string' ? collapseWhitespace(custom.ogTitle) : '') || result.metaTitle;
  result.ogDescription = (typeof custom?.ogDescription === 'string' ? collapseWhitespace(custom.ogDescription) : '') || result.metaDescription;
  result.slug = slugifySeo(customSlug || generated.slug);
  return result;
}

function stableCatalogOrder(items) {
  return [...items].sort((left, right) => {
    const leftId = String(left.id);
    const rightId = String(right.id);
    return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
  });
}

const categoryRouteCache = new WeakMap();

function cachedCatalogRouteMap(items, cache, prefix, getSlug, selectItems = value => value) {
  const selectedItems = selectItems(items);
  const signature = JSON.stringify(stableCatalogOrder(selectedItems).map(item => [
    String(item.id),
    getSlug(item),
  ]));
  let cached = cache.get(items);
  if (!cached || cached.signature !== signature) {
    cached = {
      signature,
      routes: catalogRouteMap(selectedItems, prefix, getSlug),
    };
    cache.set(items, cached);
  }
  return cached.routes;
}

function catalogRouteMap(items, prefix, getSlug) {
  const ordered = stableCatalogOrder(items);
  const groups = new Map();
  for (const item of ordered) {
    const slug = getSlug(item) || String(item.id);
    const group = groups.get(slug) || [];
    group.push(item);
    groups.set(slug, group);
  }

  const routes = new Map();
  const occupiedSlugs = new Set(groups.keys());
  for (const [slug, group] of groups) {
    if (group.length === 1) {
      routes.set(String(group[0].id), `/${prefix}/${encodeURIComponent(slug)}`);
    }
  }
  for (const [slug, group] of groups) {
    if (group.length < 2) continue;
    const [winner, ...conflicts] = group;
    routes.set(String(winner.id), `/${prefix}/${encodeURIComponent(slug)}`);
    for (const item of conflicts) {
      const idSlug = slugifySeo(String(item.id)) || 'item';
      let candidate = `${slug}-${idSlug}`;
      let suffix = 2;
      while (occupiedSlugs.has(candidate)) candidate = `${slug}-${idSlug}-${suffix++}`;
      routes.set(String(item.id), `/${prefix}/${encodeURIComponent(candidate)}`);
      occupiedSlugs.add(candidate);
    }
  }
  return routes;
}

export function productRoute(product, products) {
  const id = String(product.id ?? '').trim();
  if (!id) throw new Error('Product routes require a stable product ID.');
  const currentProduct = Array.isArray(products)
    ? products.find(item => String(item.id) === id)
    : product;
  if (!currentProduct) {
    throw new Error(`Product ${id} is not present in the current catalog.`);
  }
  const slug = slugifySeo(currentProduct.seo?.slug || currentProduct.name) || 'item';
  // The ID owns the route; the trailing slug is descriptive only. Keep the
  // legacy one-segment ID route as an alias rather than assigning slugs by
  // whichever products happen to be active in the current catalog.
  return `/product/${encodeURIComponent(id)}/${encodeURIComponent(slug)}`;
}

export function findProductBySlug(products, id) {
  // Router params are already decoded. Slugs are never used as identity: an
  // old slug-only URL may be ambiguous after catalog changes.
  return products.find(product => String(product.id) === String(id ?? ''));
}

export function slugifyCategory(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function categoryRoute(category, categories) {
  if (Array.isArray(categories)) {
    const routes = cachedCatalogRouteMap(categories, categoryRouteCache, 'category', item => (
      (item.seo?.slug ? slugifySeo(item.seo.slug) : '')
      || slugifyCategory(item.name)
      || slugifyCategory(item.id)
      || String(item.id)
    ));
    const route = routes.get(String(category.id));
    if (route) return route;
  }
  const slug = (category.seo?.slug ? slugifySeo(category.seo.slug) : '')
    || slugifyCategory(category.name)
    || slugifyCategory(category.id)
    || String(category.id);
  return `/category/${encodeURIComponent(slug)}`;
}

export function findCategoryBySlug(categories, slug) {
  const normalizedSlug = slugifyCategory(slug);
  const ordered = stableCatalogOrder(categories);
  return ordered.find(category => categoryRoute(category, categories).split('/').at(-1) === normalizedSlug)
    || ordered.find(category => category.id === slug || slugifyCategory(category.id) === normalizedSlug);
}

const policyKeyOrder = ['terms', 'privacy', 'shipping', 'return'];

function stablePolicyEntries(policies) {
  return Object.entries(policies || {}).sort(([left], [right]) => {
    const leftRank = policyKeyOrder.indexOf(left);
    const rightRank = policyKeyOrder.indexOf(right);
    if (leftRank !== -1 || rightRank !== -1) {
      return (leftRank === -1 ? Number.MAX_SAFE_INTEGER : leftRank)
        - (rightRank === -1 ? Number.MAX_SAFE_INTEGER : rightRank);
    }
    return left.localeCompare(right);
  });
}

function defaultPolicySlug(key) {
  return key === 'return' ? 'returns' : slugifySeo(key) || 'policy';
}

export function policyRouteMap(policies) {
  const entries = stablePolicyEntries(policies);
  const reservedDefaults = new Set(policyKeyOrder.map(defaultPolicySlug));
  const occupied = new Set();
  const routes = new Map();

  for (const [key, policy] of entries) {
    const fallbackSlug = defaultPolicySlug(key);
    const customSlug = slugifySeo(policy?.seo?.slug);
    const baseSlug = customSlug || fallbackSlug;
    const keySlug = slugifySeo(key) || 'policy';
    let candidate = baseSlug;

    if (customSlug && reservedDefaults.has(candidate) && candidate !== fallbackSlug) {
      candidate = `${baseSlug}-${keySlug}`;
    } else if (occupied.has(candidate)) {
      candidate = `${baseSlug}-${keySlug}`;
    }

    let suffix = 2;
    while (
      occupied.has(candidate)
      || (reservedDefaults.has(candidate) && candidate !== fallbackSlug)
    ) {
      candidate = `${baseSlug}-${keySlug}-${suffix++}`;
    }

    occupied.add(candidate);
    routes.set(key, `/policies/${encodeURIComponent(candidate)}`);
  }
  return routes;
}

export function policyRoute(key, policies) {
  return policyRouteMap(policies).get(String(key)) || `/policies/${encodeURIComponent(defaultPolicySlug(String(key)))}`;
}

export function findPolicyBySlug(policies, slug) {
  const normalizedSlug = slugifySeo(slug);
  const entries = stablePolicyEntries(policies);
  const routes = policyRouteMap(policies);

  return entries.find(([key]) => routes.get(key)?.split('/').at(-1) === normalizedSlug)
    || entries.find(([key]) => (
      key === normalizedSlug
      || (key === 'return' && normalizedSlug === 'returns')
    ));
}
