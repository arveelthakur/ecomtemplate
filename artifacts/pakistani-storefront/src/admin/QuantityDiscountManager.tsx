import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { useAdminStore } from '../context/AdminContext';
import { validateQuantityDiscountTiers, type QuantityDiscountTier } from '../utils/store';
import QuantityTierEditor from './QuantityTierEditor';

export default function QuantityDiscountManager(){
  const {data,setData,flush}=useAdminStore();
  const settings=data.content.quantityDiscounts;
  const [tiers,setTiers]=useState<QuantityDiscountTier[]>(settings.tiers);
  const [dirty,setDirty]=useState(false);
  const [message,setMessage]=useState('');

  useEffect(()=>{
    if(!dirty)setTiers(settings.tiers);
  },[settings.tiers,dirty]);

  const setEnabled=(enabled:boolean)=>{
    setData(previous=>({...previous,content:{...previous.content,quantityDiscounts:{...previous.content.quantityDiscounts,enabled}}}));
    setMessage('');
  };
  const saveTiers=async()=>{
    const validation=validateQuantityDiscountTiers(tiers);
    if(validation){setMessage(validation);return;}
    setData(previous=>({...previous,content:{...previous.content,quantityDiscounts:{...previous.content.quantityDiscounts,tiers}}}));
    setDirty(false);
    try{const result=await flush('content.quantityDiscounts');setMessage(result==='local'?'Saved on this device; cloud sync is pending.':'Changes saved successfully.');}
    catch(failure){setMessage(failure instanceof Error?`Save failed: ${failure.message}`:'Unable to save the quantity tiers.');}
  };

  return <section className="ad-card">
    <header className="ad-card-head"><div><h2 className="ad-card-title">Buy more, save more</h2><p className="ad-card-note">Set quantity-based savings for the storefront and checkout.</p></div></header>
    <div className="ad-card-body ad-form-stack">
      <label className="ad-checkline"><input type="checkbox" checked={settings.enabled} onChange={event=>setEnabled(event.target.checked)} data-testid="toggle-quantity-discounts"/> Show quantity tier discounts on the storefront</label>
      <div className="ad-notice">Store-wide tiers apply to each product’s combined quantity, including different options of the same product. A product-specific rule replaces the store-wide tiers for that product. Fixed savings are applied per item.</div>
      <QuantityTierEditor tiers={tiers} onChange={next=>{setTiers(next);setDirty(true);setMessage('');}} testIdPrefix="global-quantity"/>
      {message&&<p role="status" className={message.startsWith('Save failed')?'ad-error':'ad-help'} data-testid="status-quantity-discounts">{message}</p>}
      <div><button className="ad-btn primary" type="button" onClick={()=>void saveTiers()} data-testid="button-save-global-quantity-tiers"><Save/> Save store-wide tiers</button></div>
    </div>
  </section>;
}
