import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAdminStore, type StorePageCopySettings } from '../context/AdminContext';
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
