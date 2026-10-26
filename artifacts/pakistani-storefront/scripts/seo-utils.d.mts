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

export type CategoryRouteInput = {
  id: string;
  name: string;
  seo?: Pick<SeoMetadata, 'slug'>;
};

export type PolicyRouteInput = {
  seo?: Pick<SeoMetadata, 'slug'>;
};

export function slugifySeo(value: string): string;
export function generateSeoMetadata(source: SeoSource): SeoMetadata;
export function resolveSeoMetadata(custom: Partial<SeoMetadata> | undefined, source: SeoSource, automatic?: boolean): SeoMetadata;
export type ProductRouteInput = { id: number | string; name?: string; seo?: Pick<SeoMetadata, 'slug'> };
export function productRoute(product: ProductRouteInput, products?: ProductRouteInput[]): string;
export function findProductBySlug<T extends ProductRouteInput>(products: T[], id: string): T | undefined;
export function slugifyCategory(value: string): string;
export function categoryRoute(category: CategoryRouteInput, categories?: CategoryRouteInput[]): string;
export function findCategoryBySlug<T extends CategoryRouteInput>(categories: T[], slug: string): T | undefined;
export function policyRouteMap<T extends PolicyRouteInput>(policies: Record<string, T>): Map<string, string>;
export function policyRoute<T extends PolicyRouteInput>(key: string, policies: Record<string, T>): string;
export function findPolicyBySlug<T extends PolicyRouteInput>(policies: Record<string, T>, slug: string): [string, T] | undefined;
