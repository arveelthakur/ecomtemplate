export type SeoMetadata = {
  metaTitle: string;
  metaDescription: string;
  keywords: string;
  imageAlt: string;
  slug: string;
  ogTitle: string;
  ogDescription: string;
  ogImageUrl: string;
};

export type SeoSource = {
  title: string;
  description?: string;
  imageUrl?: string;
  category?: string;
  brand?: string;
  siteName?: string;
};

export { findPolicyBySlug, findProductBySlug, generateSeoMetadata, policyRoute, productRoute, resolveSeoMetadata, slugifySeo } from '../../scripts/seo-utils.mjs';
