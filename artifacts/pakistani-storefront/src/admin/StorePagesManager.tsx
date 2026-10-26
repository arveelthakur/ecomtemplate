import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAdminStore, type CartDrawerAddon, type StorePageCopySettings } from '../context/AdminContext';
import { isProductCustomerVisible } from '../utils/store';
import AdminSaveButton from './AdminSaveButton';

type PageId=keyof StorePageCopySettings;
const pageLabels:Record<PageId,string>={
  catalog:'Shop All / Catalog',
  cart:'Cart',
  checkout:'Checkout',
  account:'Customer account',
  wishlist:'Wishlist',
};
const moduleLabels:Record<PageId,Record<string,string>>={
  catalog:{filters:'Filter and sort controls',productGrid:'Product results'},
  cart:{items:'Cart items',summary:'Order summary'},
  checkout:{deliveryDetails:'Customer and delivery details',payment:'Payment choices'},
  account:{welcome:'Welcome panel',quickStats:'Account summary cards',orderHistory:'Order history'},
  wishlist:{savedItems:'Saved products',wishlistActions:'Saved count and clear button'},
};
const requiredModules=new Set(['catalog:productGrid','cart:items','cart:summary','checkout:deliveryDetails','checkout:payment','wishlist:savedItems']);
const fieldLabels:Record<string,string>={
  title:'Page title',
  intro:'Introductory text',
  emptyTitle:'Empty state heading',
  emptyBody:'Empty state text',
  checkoutLabel:'Continue-to-checkout button',
  submitLabel:'Place-order button',
  welcomeTitle:'Signed-in welcome heading ({firstName} is replaced)',
  welcomeIntro:'Signed-in welcome text',
  shopLabel:'Browse-shop button',
};
const multilineFields=new Set(['intro','emptyBody','welcomeIntro']);

export default function StorePagesManager(){
  const {data,setData}=useAdminStore();
  const [searchParams]=useSearchParams();
  const selectedPage=pageLabels[searchParams.get('section') as PageId]?searchParams.get('section') as PageId:'catalog';
  const [page,setPage]=useState<PageId>(selectedPage);
  useEffect(()=>setPage(selectedPage),[selectedPage]);
  const fields=data.content.storePages[page] as Record<string,string>;
  const modules=data.content.storePageLayouts[page];
  const update=(field:string,value:string)=>setData(previous=>({
    ...previous,
    content:{...previous.content,storePages:{
      ...previous.content.storePages,
      [page]:{...previous.content.storePages[page],[field]:value},
    }},
  }));
  const updateCartSettings=(patch:Partial<typeof data.content.cartDrawerSettings>)=>setData(previous=>({...previous,content:{...previous.content,cartDrawerSettings:{...previous.content.cartDrawerSettings,...patch}}}));
  const updateCartAddon=(index:number,patch:Partial<CartDrawerAddon>)=>updateCartSettings({addons:data.content.cartDrawerSettings.addons.map((addon,row)=>row===index?{...addon,...patch}:addon)});
  const updateDeliveryThreshold=(value:number)=>setData(previous=>({...previous,content:{...previous.content,announcement:{...previous.content.announcement,freeDeliveryThreshold:Math.max(0,value)}}}));
  const cartSettings=data.content.cartDrawerSettings;
  const countdownDate=cartSettings.countdownEndsAt?new Date(cartSettings.countdownEndsAt):null;
  const datetimeLocalValue=countdownDate&&Number.isFinite(countdownDate.getTime())?new Date(countdownDate.getTime()-countdownDate.getTimezoneOffset()*60_000).toISOString().slice(0,16):'';
  const updateModule=(index:number,patch:{visible?:boolean},moveBy=0)=>{
    setData(previous=>{
      const next=[...previous.content.storePageLayouts[page]];
      if(moveBy){
        const target=index+moveBy;
        if(target<0||target>=next.length)return previous;
        [next[index],next[target]]=[next[target],next[index]];
      }else next[index]={...next[index],...patch};
      return {...previous,content:{...previous.content,storePageLayouts:{...previous.content.storePageLayouts,[page]:next}}};
    });
  };
  return <section className="ad-card" data-testid="store-pages-manager">
    <header className="ad-card-head"><div><h2 className="ad-card-title">Store page content</h2><p className="ad-card-note">Edit page headings, supporting text, empty states, and primary actions. Commerce rules and account data are unchanged.</p></div></header>
    <div className="ad-card-body ad-form-stack">
      <h3 className="ad-card-title">{pageLabels[page]}</h3>
      <div className="ad-form-row">
        {Object.entries(fields).map(([field,value])=><label className="ad-field" key={field}>
          <span className="ad-label">{fieldLabels[field]??field}</span>
          {multilineFields.has(field)
            ?<textarea className="ad-textarea" maxLength={500} rows={3} value={value} onChange={event=>update(field,event.target.value)} data-testid={`input-store-page-${page}-${field}`}/>
            :<input className="ad-input" maxLength={140} value={value} onChange={event=>update(field,event.target.value)} data-testid={`input-store-page-${page}-${field}`}/>}
        </label>)}
      </div>
      {page==='cart'&&<section className="ad-card" data-testid="cart-drawer-admin-settings">
        <header className="ad-card-head"><div><h2 className="ad-card-title">Cart drawer &amp; merchandising</h2><p className="ad-card-note">Merchandising options are server-validated at order placement. Product prices are always rechecked by the backend.</p></div></header>
        <div className="ad-card-body ad-form-stack">
          <div className="ad-form-row">
            <label className="ad-field"><span className="ad-label">Free delivery threshold (PKR)</span><input className="ad-input" type="number" min="0" value={data.content.announcement.freeDeliveryThreshold} onChange={event=>updateDeliveryThreshold(Number(event.target.value)||0)} data-testid="input-cart-free-delivery-threshold"/><span className="ad-help">Shared with the storefront announcement and checkout delivery rules.</span></label>
            <label className="ad-field"><span className="ad-label">Complimentary gift target (PKR)</span><input className="ad-input" type="number" min="0" value={cartSettings.freeGiftTarget} onChange={event=>updateCartSettings({freeGiftTarget:Number(event.target.value)||0})} data-testid="input-cart-free-gift-target"/><span className="ad-help">Set 0 to hide the gift progress bar.</span></label>
          </div>
          <div className="ad-form-row"><label className="ad-field"><span className="ad-label">Estimated delivery · minimum business days</span><input className="ad-input" type="number" min="1" max="20" value={cartSettings.deliveryMinBusinessDays} onChange={event=>updateCartSettings({deliveryMinBusinessDays:Math.max(1,Number(event.target.value)||1)})} data-testid="input-cart-delivery-min-days"/></label><label className="ad-field"><span className="ad-label">Estimated delivery · maximum business days</span><input className="ad-input" type="number" min="1" max="30" value={cartSettings.deliveryMaxBusinessDays} onChange={event=>updateCartSettings({deliveryMaxBusinessDays:Math.max(cartSettings.deliveryMinBusinessDays,Number(event.target.value)||cartSettings.deliveryMinBusinessDays)})} data-testid="input-cart-delivery-max-days"/></label></div>
          <p className="ad-help">Delivery dates are estimates only; no courier tracking or delivery promise is connected to this widget.</p>
          <div className="ad-form-row"><label className="ad-checkline"><input type="checkbox" checked={cartSettings.countdownEnabled} onChange={event=>updateCartSettings({countdownEnabled:event.target.checked})} data-testid="toggle-cart-countdown"/> Show a promotional countdown</label><label className="ad-field"><span className="ad-label">Countdown label</span><input className="ad-input" maxLength={80} value={cartSettings.countdownLabel} onChange={event=>updateCartSettings({countdownLabel:event.target.value})} data-testid="input-cart-countdown-label"/></label></div>
          {cartSettings.countdownEnabled&&<label className="ad-field"><span className="ad-label">Countdown end date and time</span><input className="ad-input" type="datetime-local" value={datetimeLocalValue} onChange={event=>updateCartSettings({countdownEndsAt:event.target.value?new Date(event.target.value).toISOString():''})} data-testid="input-cart-countdown-end"/></label>}
          <div><h3 className="ad-card-title">You might also like</h3><p className="ad-help">Select up to 12 active products to recommend in the cart drawer.</p><div className="max-h-56 overflow-auto rounded-lg border border-[var(--ad-border)] p-3">
             {data.products.filter(product=>isProductCustomerVisible(product)&&product.inStock!==false&&product.stock>0).map(product=><label key={product.id} className="ad-checkline mb-2"><input type="checkbox" checked={cartSettings.upsellProductIds.includes(product.id)} disabled={!cartSettings.upsellProductIds.includes(product.id)&&cartSettings.upsellProductIds.length>=12} onChange={event=>updateCartSettings({upsellProductIds:event.target.checked?[...cartSettings.upsellProductIds,product.id]:cartSettings.upsellProductIds.filter(id=>id!==product.id)})} data-testid={`toggle-cart-upsell-product-${product.id}`}/>{product.name} <span className="ad-help">· Rs {product.price.toLocaleString('en-PK')}</span></label>)}
             {!data.products.some(product=>isProductCustomerVisible(product)&&product.inStock!==false&&product.stock>0)&&<p className="ad-help">Add active, in-stock catalog products before selecting cart recommendations.</p>}
          </div></div>
           <div className="ad-form-stack"><div className="flex items-start justify-between gap-3"><div><h3 className="ad-card-title">Optional order add-ons</h3><p className="ad-help">Starter Gift wrap and Shipping protection options are disabled until you confirm their prices and fulfillment. Amounts are rechecked by the server when an order is placed.</p></div><button type="button" className="ad-btn small" onClick={()=>updateCartSettings({addons:[...cartSettings.addons,{id:`addon-${Date.now().toString(36)}`,name:'',description:'',price:0,enabled:false}]})} data-testid="button-add-cart-addon">Add add-on</button></div>
            {cartSettings.addons.map((addon,index)=><article key={addon.id} className="ad-list-row flex-wrap" data-testid={`admin-cart-addon-${addon.id}`}>
              <div className="grid min-w-0 flex-1 gap-3 md:grid-cols-2"><label className="ad-field"><span className="ad-label">Name</span><input className="ad-input" maxLength={80} value={addon.name} onChange={event=>updateCartAddon(index,{name:event.target.value})} data-testid={`input-cart-addon-name-${addon.id}`}/></label><label className="ad-field"><span className="ad-label">Price (PKR)</span><input className="ad-input" type="number" min="0" max="100000" value={addon.price} onChange={event=>updateCartAddon(index,{price:Math.max(0,Number(event.target.value)||0)})} data-testid={`input-cart-addon-price-${addon.id}`}/></label><label className="ad-field md:col-span-2"><span className="ad-label">Description</span><textarea className="ad-textarea" rows={2} maxLength={240} value={addon.description} onChange={event=>updateCartAddon(index,{description:event.target.value})} data-testid={`input-cart-addon-description-${addon.id}`}/></label></div>
              <div className="flex items-center gap-3"><label className="ad-checkline"><input type="checkbox" checked={addon.enabled} onChange={event=>updateCartAddon(index,{enabled:event.target.checked})} data-testid={`toggle-cart-addon-${addon.id}`}/> Active</label><button type="button" className="ad-btn small danger" onClick={()=>updateCartSettings({addons:cartSettings.addons.filter((_,row)=>row!==index)})} aria-label={`Remove ${addon.name||'cart add-on'}`} data-testid={`button-remove-cart-addon-${addon.id}`}>Remove</button></div>
            </article>)}
            {cartSettings.addons.some(addon=>addon.id==='shipping-protection'&&addon.enabled)&&<p className="ad-notice">Only enable shipping protection if your store has an actual policy/provider to fulfill it. This setting does not provide insurance or courier coverage by itself.</p>}
          </div>
          <AdminSaveButton scope={['content.cartDrawerSettings','content.announcement']} testId="button-save-cart-drawer-settings"/>
        </div>
      </section>}
      {page==='catalog'&&<p className="ad-help">Filter visibility, icons, and toolbar layout remain in Catalog &amp; Inventory → Categories.</p>}
      <AdminSaveButton scope="content.storePages" testId={`button-save-store-page-${page}`}/>
      <div className="ad-form-stack" data-testid={`store-page-modules-${page}`}>
        <div><h3 className="ad-card-title">Page modules</h3><p className="ad-card-note">Toggle optional blocks and use the arrows to change their order.</p></div>
        {modules.map((module,index)=>{
          const required=requiredModules.has(`${page}:${module.id}`);
          return <div key={module.id} className="ad-list-row">
            <label className="ad-checkline"><input type="checkbox" checked={module.visible} disabled={required} onChange={event=>updateModule(index,{visible:event.target.checked})} data-testid={`toggle-store-page-module-${page}-${module.id}`}/>{moduleLabels[page]?.[module.id]??module.id}{required&&<span className="ad-help">Required for checkout</span>}</label>
            <div className="ad-toolbar">
              <button type="button" className="ad-btn small" aria-label={`Move ${moduleLabels[page]?.[module.id]??module.id} up`} disabled={index===0} onClick={()=>updateModule(index,{},-1)} data-testid={`button-store-page-module-up-${page}-${module.id}`}>↑</button>
              <button type="button" className="ad-btn small" aria-label={`Move ${moduleLabels[page]?.[module.id]??module.id} down`} disabled={index===modules.length-1} onClick={()=>updateModule(index,{},1)} data-testid={`button-store-page-module-down-${page}-${module.id}`}>↓</button>
            </div>
          </div>;
        })}
        <p className="ad-help">{page==='checkout'?'Customer details and payment stay enabled so buyers can complete an order. Their order can still be changed.':'Core shopping and checkout modules stay visible; optional modules can be hidden.'}</p>
        <AdminSaveButton scope="content.storePageLayouts" testId={`button-save-store-page-layout-${page}`}/>
      </div>
    </div>
  </section>;
}
