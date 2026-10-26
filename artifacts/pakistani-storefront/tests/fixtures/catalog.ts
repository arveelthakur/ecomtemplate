import type { Product, StoreCategory } from '../../src/utils/store';

/**
 * Explicit records for the isolated browser harness only.
 * These are never imported by production storefront or admin code.
 */
export const browserFixtureCategories: StoreCategory[] = [
  {
    id: 'fixture-earrings',
    name: 'Earrings & Jhumkas',
    image: '/images/nura-jhumka-earrings.jpg',
    sub: 'Test collection',
    color: '#efe5d8',
  },
];

export const browserFixtureProducts: Product[] = [
  {
    id: 990010,
    name: 'Browser Audit Kundan Earrings',
    category: 'Earrings & Jhumkas',
    brand: 'Nura test fixture',
    status: 'active',
    price: 3500,
    oldPrice: 4200,
    image: '/images/nura-jhumka-earrings.jpg',
    shade: '#efe5d8',
    features: ['Test-only listing'],
    description: 'A test-only product record for storefront browser checks.',
    stock: 12,
    inStock: true,
    freeDeliveryEligible: true,
    cashOnDeliveryEnabled: true,
  },
];
