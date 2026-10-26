import { Award, CircleHelp, Grid2X2, Heart, PhoneCall, Search, ShoppingBag, ShoppingCart, Tag, UserRound, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAdminStore } from '../context/AdminContext';
import { useStore } from '../context/StoreContext';
import { getVisibleWishlistProducts, useWishlist } from '../context/WishlistContext';
import StoreSearchControl from './StoreSearchControl';

const actionIcons:Record<string,LucideIcon>={
  search:Search,user:UserRound,account:UserRound,wishlist:Heart,heart:Heart,cart:ShoppingCart,bag:ShoppingBag,
  grid:Grid2X2,tag:Tag,phone:PhoneCall,help:CircleHelp,sparkles:Award,award:Award,
};
function responsiveDisplay(desktop:boolean,mobile:boolean){
  return desktop&&mobile?'grid':desktop?'hidden xl:grid':mobile?'grid xl:hidden':'hidden';
}

export default function HeaderActionIcons(){
  const {data}=useAdminStore();
  const {count,openCartDrawer,products}=useStore();
  const {productIds}=useWishlist();
  const wishlistCount=getVisibleWishlistProducts(productIds,products).length;
  const visibility=data.settings.headerIconVisibility;
  const buttons=data.settings.headerCustomActions.filter(action=>action.desktop||action.mobile).sort((a,b)=>a.order-b.order);
  return <div className="flex max-w-full flex-wrap items-center justify-end gap-x-1 gap-y-1 lg:gap-x-2" aria-label="Store actions">
    {(visibility.search.desktop||visibility.search.mobile)&&<div className={responsiveDisplay(visibility.search.desktop,visibility.search.mobile)}><StoreSearchControl/></div>}
    {(visibility.account.desktop||visibility.account.mobile)&&<Link to="/account" aria-label="Account" title="Account" className={`${responsiveDisplay(visibility.account.desktop,visibility.account.mobile)} h-9 w-9 place-items-center rounded-full text-[#5d514c] transition-colors hover:bg-[#f2ede5] hover:text-[#6B2447]`} data-testid="link-account-icon"><UserRound size={18} strokeWidth={1.7}/></Link>}
    {(visibility.wishlist.desktop||visibility.wishlist.mobile)&&<Link to="/wishlist" aria-label={wishlistCount?`Wishlist, ${wishlistCount} saved ${wishlistCount===1?'item':'items'}`:'Wishlist'} title="Wishlist" className={`${responsiveDisplay(visibility.wishlist.desktop,visibility.wishlist.mobile)} relative h-9 w-9 place-items-center rounded-full text-[#5d514c] transition-colors hover:bg-[#f2ede5] hover:text-[#6B2447]`} data-testid="link-header-wishlist"><Heart size={18} strokeWidth={1.7}/>{wishlistCount>0&&<span aria-hidden="true" className="absolute right-0 top-0 grid h-4 min-w-4 place-items-center rounded-full bg-[#6B2447] px-1 text-[9px] text-white" data-testid="text-header-wishlist-count">{wishlistCount}</span>}</Link>}
    {buttons.map(action=>{
      const Icon=actionIcons[action.icon]||CircleHelp;
      const display=responsiveDisplay(action.desktop,action.mobile);
      const external=/^https?:\/\//i.test(action.href);
      return external||/^(mailto:|tel:)/i.test(action.href)
        ?<a key={action.id} href={action.href} aria-label={action.label} title={action.label} className={`${display} h-9 w-9 place-items-center rounded-full text-[#5d514c] transition-colors hover:bg-[#f2ede5] hover:text-[#6B2447]`} target={external?'_blank':undefined} rel={external?'noopener noreferrer':undefined} data-testid={`header-action-${action.id}`}><Icon size={18}/></a>
        :<Link key={action.id} to={action.href} aria-label={action.label} title={action.label} className={`${display} h-9 w-9 place-items-center rounded-full text-[#5d514c] transition-colors hover:bg-[#f2ede5] hover:text-[#6B2447]`} data-testid={`header-action-${action.id}`}><Icon size={18}/></Link>;
    })}
    {(visibility.cart.desktop||visibility.cart.mobile)&&<button type="button" aria-label={`Open cart, ${count} items`} title="Open cart" onClick={openCartDrawer} className={`${responsiveDisplay(visibility.cart.desktop,visibility.cart.mobile)} relative h-9 w-9 place-items-center rounded-full text-[#6B2447] transition-colors hover:bg-[#f1ece4]`} data-testid="button-open-cart">
      <ShoppingCart size={19} strokeWidth={1.7}/>{count>0&&<span className="absolute right-0 top-0 grid h-4 min-w-4 place-items-center rounded-full bg-[#6B2447] px-1 text-[9px] text-white" data-testid="text-cart-count">{count}</span>}
    </button>}
  </div>;
}
