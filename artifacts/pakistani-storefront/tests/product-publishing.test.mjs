import test from 'node:test';
import assert from 'node:assert/strict';
import { isProductCustomerVisible } from '../src/utils/store.ts';

test('legacy products without a publishing status remain visible', () => {
  assert.equal(isProductCustomerVisible({ id: 1, name: 'Legacy', category: 'Skin', price: 10, image: '', shade: '', stock: 1, freeDeliveryEligible: false }), true);
});

test('only active products are visible to customers', () => {
  const base = { id: 1, name: 'Product', category: 'Skin', price: 10, image: '', shade: '', stock: 1, freeDeliveryEligible: false };
  assert.equal(isProductCustomerVisible({ ...base, status: 'active' }), true);
  assert.equal(isProductCustomerVisible({ ...base, status: 'draft' }), false);
  assert.equal(isProductCustomerVisible({ ...base, status: 'archived' }), false);
});
