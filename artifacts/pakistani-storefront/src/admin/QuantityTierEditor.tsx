import { Plus, Trash2 } from 'lucide-react';
import type { QuantityDiscountTier } from '../utils/store';

type Props={
  tiers:QuantityDiscountTier[];
  onChange:(tiers:QuantityDiscountTier[])=>void;
  testIdPrefix:string;
};

function nextTier(tiers:QuantityDiscountTier[]):QuantityDiscountTier{
  if(!tiers.length)return {id:`tier-${Date.now().toString(36)}`,minQuantity:2,maxQuantity:4,discountType:'percent',discountValue:5};
  const lastEnd=Math.max(...tiers.map(tier=>tier.maxQuantity??tier.minQuantity));
  return {id:`tier-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`,minQuantity:lastEnd+1,discountType:'percent',discountValue:5};
}

export default function QuantityTierEditor({tiers,onChange,testIdPrefix}:Props){
  const update=(id:string,patch:Partial<QuantityDiscountTier>)=>onChange(tiers.map(tier=>tier.id===id?{...tier,...patch}:tier));
  return <div className="ad-form-stack">
    {tiers.map((tier,index)=><div key={tier.id} className="ad-notice" data-testid={`${testIdPrefix}-tier-${tier.id}`}>
      <div className="ad-form-row">
        <label className="ad-field"><span className="ad-label">Minimum quantity</span><input className="ad-input" type="number" min="1" step="1" value={tier.minQuantity} onChange={event=>update(tier.id,{minQuantity:Number(event.target.value)})} data-testid={`${testIdPrefix}-tier-min-${index}`}/></label>
        <label className="ad-field"><span className="ad-label">Maximum quantity</span><input className="ad-input" type="number" min={tier.minQuantity} step="1" value={tier.maxQuantity??''} placeholder="No maximum" onChange={event=>{
          const value=event.target.value;
          onChange(tiers.map(item=>{
            if(item.id!==tier.id)return item;
            if(!value){const {maxQuantity:_maxQuantity,...withoutMaximum}=item;return withoutMaximum;}
            return {...item,maxQuantity:Number(value)};
          }));
        }} data-testid={`${testIdPrefix}-tier-max-${index}`}/></label>
      </div>
      <div className="ad-form-row">
        <label className="ad-field"><span className="ad-label">Discount type</span><select className="ad-select" value={tier.discountType} onChange={event=>update(tier.id,{discountType:event.target.value as QuantityDiscountTier['discountType']})} data-testid={`${testIdPrefix}-tier-type-${index}`}><option value="percent">Percent off</option><option value="fixed">PKR off per item</option></select></label>
        <label className="ad-field"><span className="ad-label">{tier.discountType==='percent'?'Percent off':'PKR off each item'}</span><input className="ad-input" type="number" min="0.01" max={tier.discountType==='percent'?100:undefined} step="0.01" value={tier.discountValue} onChange={event=>update(tier.id,{discountValue:Number(event.target.value)})} data-testid={`${testIdPrefix}-tier-value-${index}`}/></label>
      </div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12}}>
        <span className="ad-help">Tier {index+1} · {tier.maxQuantity===undefined?`${tier.minQuantity}+ items`:`${tier.minQuantity}–${tier.maxQuantity} items`}</span>
        <button type="button" className="ad-btn small danger" onClick={()=>onChange(tiers.filter(item=>item.id!==tier.id))} data-testid={`${testIdPrefix}-tier-remove-${index}`}><Trash2/> Remove tier</button>
      </div>
    </div>)}
    <button type="button" className="ad-btn small" onClick={()=>onChange([...tiers,nextTier(tiers)])} data-testid={`${testIdPrefix}-tier-add`}><Plus/> Add tier</button>
  </div>;
}
