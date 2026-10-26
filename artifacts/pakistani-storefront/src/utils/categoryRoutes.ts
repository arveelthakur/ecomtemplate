import type { StoreCategory } from './store';
import {
  categoryRoute as makeCategoryRoute,
  findCategoryBySlug as findCategory,
  slugifyCategory as makeCategorySlug,
} from '../../scripts/seo-utils.mjs';

export const slugifyCategory = makeCategorySlug;

export function categoryRoute(category:Pick<StoreCategory,'id'|'name'|'seo'>,categories?:Pick<StoreCategory,'id'|'name'|'seo'>[]){
  return makeCategoryRoute(category,categories);
}

export function findCategoryBySlug(categories:StoreCategory[],slug:string){
  return findCategory(categories,slug);
}
