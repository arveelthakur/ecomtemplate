type CouponExpiry = {
  active: boolean;
  expiresAt?: string | null;
};

export function isCouponEligible(coupon: CouponExpiry, now: number): boolean {
  if (coupon.active !== true) return false;
  const expiry = coupon.expiresAt?.trim();
  if (!expiry) return true;

  if (/^\d{4}-\d{2}-\d{2}$/.test(expiry)) {
    const parsed = new Date(`${expiry}T00:00:00.000Z`);
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== expiry) return false;
    return expiry >= new Date(now).toISOString().slice(0, 10);
  }

  const expiryTime = Date.parse(expiry);
  return Number.isFinite(expiryTime) && expiryTime > now;
}
