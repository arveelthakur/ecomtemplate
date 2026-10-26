import type { Product, QuantityDiscountSettings } from '../utils/store';
import { formatPKR, getQuantityDiscountQuote } from '../utils/store';

export default function BuyMoreSaveMore({product,quantity,settings}:{product:Product;quantity:number;settings:QuantityDiscountSettings}){
  const quote=getQuantityDiscountQuote(product,quantity,settings);
  if(!quote.tiers.length)return null;
  const nextTier=quote.tiers.find(tier=>tier.minQuantity>quantity);
  return <aside className="border border-[#dfe5da] bg-[#f4f6f1] p-4 sm:p-5" data-testid={`widget-quantity-discounts-${product.id}`}>
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-sm font-semibold text-[#352b2b]">Buy more, save more</h2>
      <span className="text-[10px] font-medium text-[#718068]">Volume savings</span>
    </div>
    <ul className="mt-3 space-y-2">
      {quote.tiers.map((tier,index)=>{
        const active=quote.activeTier?.id===tier.id;
        const quantityLabel=tier.maxQuantity===undefined?`${tier.minQuantity}+ items`:`${tier.minQuantity}–${tier.maxQuantity} items`;
        const savingsLabel=tier.discountType==='percent'?`${tier.discountValue}% off`:`${formatPKR(tier.discountValue)} off each item`;
        return <li key={tier.id} className={`flex items-center justify-between gap-3 border px-3 py-2 text-xs ${active?'border-[#74816c] bg-white font-semibold text-[#4b6046]':'border-transparent text-[#74695f]'}`} data-testid={`row-quantity-tier-${product.id}-${index}`}>
          <span>{quantityLabel}</span><span className="text-right">{savingsLabel}</span>
        </li>;
      })}
    </ul>
    {quote.activeTier
      ?<p className="mt-3 text-[11px] font-medium text-[#60705d]" role="status" data-testid="text-volume-savings">This quantity saves {formatPKR(quote.discountAmount)}.</p>
      :nextTier
        ?<p className="mt-3 text-[11px] text-[#74695f]" data-testid="text-volume-savings">Add {nextTier.minQuantity-quantity} more to unlock {nextTier.discountType==='percent'?`${nextTier.discountValue}% off`:`${formatPKR(nextTier.discountValue)} off each item`}.</p>
        :null}
  </aside>;
}
