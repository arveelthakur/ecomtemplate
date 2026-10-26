import assert from 'node:assert/strict';
import test from 'node:test';
import { isCouponEligible } from '../src/utils/coupons.ts';

const now = Date.parse('2026-06-28T12:00:00.000Z');

test('date-only coupon expiry remains valid through its listed UTC calendar day', () => {
  assert.equal(isCouponEligible({ active: true, expiresAt: '2026-06-28' }, now), true);
  assert.equal(isCouponEligible({ active: true, expiresAt: '2026-06-27' }, now), false);
  assert.equal(isCouponEligible({ active: true, expiresAt: '2026-06-29' }, now), true);
});

test('inactive, expired, and malformed coupon dates are never eligible', () => {
  assert.equal(isCouponEligible({ active: false, expiresAt: '2099-12-31' }, now), false);
  assert.equal(isCouponEligible({ active: true, expiresAt: '2026-06-28T11:59:59.000Z' }, now), false);
  assert.equal(isCouponEligible({ active: true, expiresAt: '2026-02-30' }, now), false);
  assert.equal(isCouponEligible({ active: true, expiresAt: 'not-a-date' }, now), false);
});

test('coupon without an expiry remains eligible only while active', () => {
  assert.equal(isCouponEligible({ active: true }, now), true);
  assert.equal(isCouponEligible({ active: false }, now), false);
});
