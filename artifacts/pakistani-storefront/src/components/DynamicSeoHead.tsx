import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAdminStore } from '../context/AdminContext';
import { useStore } from '../context/StoreContext';
import { categoryRoute, findCategoryBySlug } from '../utils/categoryRoutes';
import { findPolicyBySlug, findProductBySlug, generateSeoMetadata, policyRoute, productRoute, resolveSeoMetadata, type SeoMetadata } from '../utils/seo';
import { isProductCustomerVisible } from '../utils/store';
import { configuredStoreName } from '../utils/branding';

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function setMeta(selector: string, attribute: 'name' | 'property', key: string, value: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(selector);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attribute, key);
    document.head.appendChild(tag);
  }
  tag.content = value;
}

function setCanonical(path: string) {
  let tag = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!tag) {
    tag = document.createElement('link');
    tag.rel = 'canonical';
    document.head.appendChild(tag);
  }
  tag.href = new URL(path, window.location.origin).toString();
}

function absoluteImageUrl(value: string) {
  if (!value) return '';
  try {
    return new URL(value, window.location.origin).toString();
  } catch {
    return '';
  }
}

export default function DynamicSeoHead() {
  const { pathname } = useLocation();
  const { products, categories } = useStore();
  const { data } = useAdminStore();

  useEffect(() => {
    const pathParts = pathname.split('/').filter(Boolean);
    let seo: SeoMetadata;
    let canonicalPath = pathname || '/';
    let type = 'website';
    let shouldIndex = true;
    const configuredName = configuredStoreName(data.settings.general.storeName);
    const brand = configuredName || 'Online shop';
    const storeReference = configuredName || 'our store';
    const seoSettings=data.settings.seo;
    const heroImage = cleanText(data.content.heroSlides[0]?.desktopImageUrl);

    if (pathParts[0] === 'product' && pathParts[1]) {
      const product = findProductBySlug(products.filter(isProductCustomerVisible),pathParts[1]);
      if (product) {
        const title = cleanText(product.name);
        const source = { title, description: cleanText(product.description) || `${title} from ${storeReference}, thoughtfully selected and delivered across Pakistan.`, imageUrl: product.image, category: cleanText(product.category), brand: cleanText(product.brand), siteName: brand };
        seo = resolveSeoMetadata(product.seo, source,seoSettings.autoGenerate);
        canonicalPath = productRoute(product,products);
        type = 'product';
      } else {
        seo = generateSeoMetadata({ title: 'Browse products', description: `Explore products from ${storeReference}.`, imageUrl: heroImage, siteName: brand });
        shouldIndex = false;
      }
    } else if ((pathParts[0] === 'category' || pathParts[0] === 'collections') && pathParts[1]) {
      const category = findCategoryBySlug(categories, pathParts[1]);
      if (category) {
        const title = cleanText(category.name);
        const source = { title, description: cleanText(category.sub) || `Explore ${title} products from ${storeReference}, thoughtfully selected and delivered across Pakistan.`, imageUrl: category.image, category: title, siteName: brand };
        seo = resolveSeoMetadata(category.seo, source,seoSettings.autoGenerate);
        canonicalPath = categoryRoute(category,categories);
      } else {
        seo = generateSeoMetadata({ title: 'Shop categories', description: `Browse product categories from ${storeReference}.`, imageUrl: heroImage, siteName: brand });
      }
    } else if (pathParts[0] === 'policies' || pathParts[0] === 'policy') {
      const policyEntry = findPolicyBySlug(data.policies,pathParts[1]);
      if (policyEntry) {
        const [key, policy] = policyEntry;
        const labels = { terms: 'Terms of use', privacy: 'Privacy policy', shipping: 'Shipping policy', return: 'Return policy' };
        const title = cleanText(policy.title) || labels[key as keyof typeof labels] || 'Store policy';
        const description = [policy.intro, ...policy.clauses.map(clause => clause.body)].map(cleanText).filter(Boolean).join(' ');
        const source = { title, description: description || `${labels[key as keyof typeof labels] || 'Store policy'} details for shopping with ${storeReference}.`, imageUrl: policy.seo?.ogImageUrl || heroImage, siteName: brand };
        seo = resolveSeoMetadata(policy.seo, source,seoSettings.autoGenerate);
        canonicalPath = policyRoute(key,data.policies);
      } else {
        seo = generateSeoMetadata({ title: 'Store policies', description: `Shopping information for ${storeReference}.`, imageUrl: heroImage, siteName: brand });
      }
    } else if (pathname === '/about') {
      const title = cleanText(data.content.story.title) || 'A softer everyday, rooted in home.';
      const description = [data.content.story.paragraphOne, data.content.story.paragraphTwo].map(cleanText).filter(Boolean).join(' ') || `Learn about ${storeReference} and the thoughtful finds chosen for everyday life.`;
      const source = { title, description, imageUrl: cleanText(data.content.story.imageUrl) || heroImage, siteName: brand };
      seo = resolveSeoMetadata({ ...seoSettings.pages.about, ...data.content.story.seo },source,seoSettings.autoGenerate);
    } else if (pathname === '/reviews') {
      const reviewCopy = data.reviews.filter(review => review.published).map(review => cleanText(review.text)).filter(Boolean).join(' ');
      const source = { title: 'What Our Customers Say', description: reviewCopy || `Read customer reviews and feedback about ${storeReference}.`, imageUrl: heroImage, siteName: brand };
      seo = resolveSeoMetadata(seoSettings.pages.reviews,source,seoSettings.autoGenerate);
    } else if (pathname === '/shop' || pathname === '/collections') {
      const source = pathname === '/shop'
        ? { title: `Shop all products${configuredName?` | ${configuredName}`:''}`, description: `Browse products${configuredName?` from ${configuredName}`:''} with current availability and delivery details at checkout.`, imageUrl: heroImage, siteName: brand }
        : { title: `Shop by category${configuredName?` | ${configuredName}`:''}`, description: `Explore collections${configuredName?` from ${configuredName}`:''} and browse products by category.`, imageUrl: heroImage, siteName: brand };
      seo = resolveSeoMetadata(pathname==='/shop'?seoSettings.pages.shop:seoSettings.pages.collections,source,seoSettings.autoGenerate);
    } else if (pathname === '/') {
      const slide = data.content.heroSlides[0];
      const source = { title: cleanText(slide?.title).replace(/\n/g, ' ') || (configuredName?`${configuredName} — thoughtful finds`:'Shop thoughtful finds'), description: cleanText(slide?.copy) || `Browse products and find helpful delivery information${configuredName?` at ${configuredName}`:''}.`, imageUrl: heroImage, siteName: brand };
      seo = resolveSeoMetadata(seoSettings.pages.home,source,seoSettings.autoGenerate);
    } else {
      seo = generateSeoMetadata({ title: 'Browse products', description: `Discover products from ${storeReference}.`, imageUrl: heroImage, siteName: brand });
    }

    const title = seo.metaTitle || (configuredName?`${configuredName} — Thoughtful finds`:'Shop thoughtful finds');
    const description = seo.metaDescription || '';
    const image = absoluteImageUrl(seo.ogImageUrl || heroImage);
    const canonical = new URL(canonicalPath, window.location.origin).toString();
    document.title = title;
    setMeta('meta[name="description"]', 'name', 'description', description);
    setMeta('meta[name="keywords"]', 'name', 'keywords', seo.keywords || '');
    setMeta('meta[name="robots"]', 'name', 'robots', shouldIndex ? 'index, follow' : 'noindex, follow');
    setMeta('meta[property="og:title"]', 'property', 'og:title', seo.ogTitle || title);
    setMeta('meta[property="og:description"]', 'property', 'og:description', seo.ogDescription || description);
    setMeta('meta[property="og:image"]', 'property', 'og:image', image);
    setMeta('meta[property="og:image:alt"]', 'property', 'og:image:alt', seo.imageAlt || title);
    setMeta('meta[property="og:url"]', 'property', 'og:url', canonical);
    setMeta('meta[property="og:type"]', 'property', 'og:type', type);
    setMeta('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image');
    setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', seo.ogTitle || title);
    setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', seo.ogDescription || description);
    setMeta('meta[name="twitter:image"]', 'name', 'twitter:image', image);
    setCanonical(canonicalPath);
  }, [pathname, data, products, categories]);

  return null;
}
