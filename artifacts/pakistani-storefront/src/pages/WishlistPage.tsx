import { Link } from 'react-router-dom';
import { Heart, Trash2 } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { getVisibleWishlistProducts, useWishlist } from '../context/WishlistContext';
import { CommerceLayout } from '../components/CommerceLayout';
import ProductCard from '../components/ProductCard';
import { useAdminStore } from '../context/AdminContext';

export default function WishlistPage(){
  const {products}=useStore();
  const {data}=useAdminStore();
  const pageCopy=data.content.storePages.wishlist;
  const modules=data.content.storePageLayouts.wishlist;
  const moduleOrder=(id:string)=>modules.findIndex(module=>module.id===id);
  const {productIds,clear,syncError}=useWishlist();
  const savedProducts=getVisibleWishlistProducts(productIds,products);
  return <CommerceLayout eyebrow="Keep close" title={pageCopy.title} intro={pageCopy.intro}>
    {syncError&&<p role="status" className="mb-5 border border-[#e7d8cc] bg-[#f8f1e9] p-3 text-xs leading-5 text-[#77645c]" data-testid="text-wishlist-sync-status">{syncError}</p>}
    {savedProducts.length===0?<div className="mt-6 border border-[#e9e2d8] bg-white/60 p-7 text-center sm:p-10" data-testid="wishlist-empty-state">
      <Heart size={25} className="mx-auto text-[#6B2447]" aria-hidden="true"/>
       <h2 className="serif mt-4 text-2xl">{pageCopy.emptyTitle}</h2>
       <p className="mt-2 text-sm text-[#81766c]">{pageCopy.emptyBody}</p>
       <Link to="/shop" className="mt-5 inline-flex min-h-11 items-center bg-[#6B2447] px-5 text-xs font-semibold text-white" data-testid="link-wishlist-shop">{pageCopy.shopLabel}</Link>
    </div>:<div className="mt-6 flex flex-col">
      {modules.find(module=>module.id==='wishlistActions')?.visible!==false&&<div style={{order:moduleOrder('wishlistActions')}} className="mb-5 flex items-center justify-between gap-3"><p className="text-xs text-[#81766c]" data-testid="text-wishlist-count">{savedProducts.length} saved {savedProducts.length===1?'item':'items'}</p><button type="button" onClick={clear} className="inline-flex min-h-10 items-center gap-2 text-xs font-semibold text-[#6B2447]" data-testid="button-clear-wishlist"><Trash2 size={14}/> Clear wishlist</button></div>}
      {modules.find(module=>module.id==='savedItems')?.visible!==false&&<div style={{order:moduleOrder('savedItems')}} className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 lg:grid-cols-4">{savedProducts.map(product=><ProductCard key={product.id} product={product}/>)}</div>}
    </div>}
  </CommerceLayout>;
}
