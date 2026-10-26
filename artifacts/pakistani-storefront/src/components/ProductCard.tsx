import { memo, useState, type CSSProperties } from 'react';
import { Award, ArrowRight, Check, Flame, Gift, Heart, Leaf, Plus, Sparkles, Star, Tag } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatPKR, type Product } from '../utils/store';
import { productRoute } from '../utils/seo';
import { useStore } from '../context/StoreContext';
import StoreImage from './StoreImage';
import { useWishlist } from '../context/WishlistContext';
import { useAdminStore } from '../context/AdminContext';
import type { ProductBadgePosition } from '../context/AdminContext';

function ProductTagIcon({ name }: { name: string }) {
  const props = { size: 10, strokeWidth: 2.2, 'aria-hidden': true as const };
  if (name === 'flame') return <Flame {...props} />;
  if (name === 'sparkles') return <Sparkles {...props} />;
  if (name === 'award') return <Award {...props} />;
  if (name === 'gift') return <Gift {...props} />;
  if (name === 'leaf') return <Leaf {...props} />;
  if (name === 'star') return <Star {...props} />;
  if (name === 'none') return null;
  return <Tag {...props} />;
}

function badgePlacement(position:ProductBadgePosition,index=0,avoidHeart=false):CSSProperties{
  const inset=8+index*25;
  const topOffset=inset+(avoidHeart?38:0);
  switch(position){
    case 'top-right':return {position:'absolute',top:topOffset,right:8};
    case 'bottom-left':return {position:'absolute',bottom:inset,left:8};
    case 'bottom-right':return {position:'absolute',bottom:inset,right:8};
    default:return {position:'absolute',top:inset,left:8};
  }
}
function badgeAppearance(background:string,text:string,settings:ReturnType<typeof useAdminStore>['data']['settings']['productCardBadges']):CSSProperties{
  return {
    backgroundColor:settings.glassmorphism?`color-mix(in srgb, ${background} ${settings.opacity}%, transparent)`:background,
    color:text,border:'1px solid var(--nura-gold,#C6A15B)',opacity:settings.glassmorphism?undefined:settings.opacity/100,
    fontSize:`${settings.fontSizePx}px`,fontWeight:settings.fontWeight==='bold'?700:settings.fontWeight==='medium'?500:400,
    letterSpacing:`${settings.letterSpacingPx}px`,padding:`${settings.paddingPx}px ${settings.paddingPx+3}px`,
    borderRadius:settings.style==='pill'?'999px':settings.style==='square'?`${Math.min(5,settings.borderRadiusPx)}px`:`${settings.borderRadiusPx}px`,
    backdropFilter:settings.glassmorphism?'blur(8px)':undefined,
    clipPath:settings.style==='ribbon'?'polygon(0 0,100% 0,100% 82%,50% 100%,0 82%)':undefined,
  };
}

function ProductCard({ product, view = 'grid' }: { product: Product; view?: 'grid' | 'list' }) {
  const { add, products } = useStore();
  const {isSaved,toggle}=useWishlist();
  const {data}=useAdminStore();
  const [added, setAdded] = useState(false);
  const badgeSettings=data.settings.productCardBadges;
  const saved=isSaved(product.id);
  const unavailable = product.inStock === false || product.stock < 1;
  const hasOptions = Boolean(product.variants?.length||product.variationTypes?.length);
  const route=productRoute(product,products);
  const discountPercent=product.oldPrice&&product.oldPrice>product.price?Math.round((1-product.price/product.oldPrice)*100):0;
  const legacyDiscountLabel=/^\d{1,3}%\s*(off)?$/i.test(product.badge||'');
  const tagLabel=(legacyDiscountLabel?'':product.badge?.trim())||badgeSettings.defaultTagText.trim();
  const tagItems=badgeSettings.tagVisible?[
    ...(tagLabel?[{id:'primary',label:tagLabel,icon:badgeSettings.tagIcon}]:[]),
    ...badgeSettings.customBadges.filter(badge=>badge.enabled).map(badge=>({id:badge.id,label:badge.label,icon:badge.icon})),
  ]:[];
  const showTag=tagItems.length>0;
  const tagStyle=(index:number)=>({
    ...badgePlacement(badgeSettings.tagPosition,index,badgeSettings.tagPosition==='top-right'&&badgeSettings.wishlistVisible),
    ...badgeAppearance(badgeSettings.backgroundColor,badgeSettings.textColor,badgeSettings),
  });
  const discountStyle={
    ...badgePlacement(badgeSettings.discountPosition,badgeSettings.discountPosition==='bottom-right'&&unavailable?1:0,badgeSettings.discountPosition==='top-right'&&badgeSettings.wishlistVisible),
    ...badgeAppearance(badgeSettings.discountBackgroundColor,badgeSettings.discountTextColor,badgeSettings),
  };
  const reviewCount=Number.isFinite(product.reviewCount)?Math.max(0,Math.floor(product.reviewCount??0)):0;
  const hasVerifiedRating=reviewCount>0&&typeof product.rating==='number'&&Number.isFinite(product.rating);
  const rating=hasVerifiedRating?Math.max(0,Math.min(5,product.rating!)):0;
  const roundedRating=Math.max(0,Math.min(5,Math.round(rating)));
  const stars=hasVerifiedRating?'★'.repeat(roundedRating)+'☆'.repeat(5-roundedRating):'☆☆☆☆☆';
  const action = hasOptions
    ? <Link to={route} className="inline-flex min-h-10 w-full items-center justify-center gap-2 bg-[#6B2447] px-3 text-[11px] font-semibold text-[#fffaf4] transition-colors hover:bg-[#54203a]" data-testid={`link-choose-options-${product.id}`}>See options <ArrowRight size={14} /></Link>
    : <button
      type="button"
      onClick={() => { if (add(product)) setAdded(true); }}
      disabled={unavailable}
      className={`inline-flex min-h-10 w-full items-center justify-center gap-2 px-3 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${added ? 'bg-[#e8ece1] text-[#596752]' : 'bg-[#6B2447] text-[#fffaf4] hover:bg-[#54203a]'}`}
      aria-live="polite"
      data-testid={`button-add-to-cart-card-${product.id}`}
    >
      {unavailable ? 'Out of stock' : added ? <><Check size={14} />Added to cart</> : <><Plus size={14} />Add to cart</>}
    </button>;
  const category = <p className="eyebrow !text-[9px]">{product.category}</p>;
   const title = <h3 className="nura-product-title-clamp nura-heading-product min-w-0 break-words text-[13px] font-medium leading-5 sm:text-[14px]">
      <Link to={route} className="break-words hover:text-[#6B2447]" data-testid={`link-product-title-${product.id}`}>{product.name}</Link>
  </h3>;
  const ratingSummary = <div className="mt-1.5 flex min-h-4 items-center gap-1.5 text-[10px] leading-4" data-testid={`text-product-rating-card-${product.id}`}>
    <span role="img" aria-label={hasVerifiedRating?`Rated ${rating.toFixed(1)} out of 5`:'No reviews yet'} className="tracking-[.04em] text-[#b58a2e]">{stars}</span>
    <span className="font-semibold text-[#564d46]">{hasVerifiedRating?rating.toFixed(1):'New'}</span>
    <span className="text-[#8b8075]">{hasVerifiedRating?`(${reviewCount})`:'No reviews'}</span>
  </div>;
  const price = <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
    <span className="text-[13px] font-semibold">{product.fromPrice ? 'From ' : ''}{formatPKR(product.price)}</span>
    {product.oldPrice && <span className="text-[11px] text-[#9a9086] line-through">{formatPKR(product.oldPrice)}</span>}
  </div>;

  if (view === 'list') {
    return <article className="group flex min-w-0 gap-3 py-4 sm:gap-5" data-testid={`card-product-${product.id}`}>
      <div className="relative h-28 w-24 shrink-0 overflow-hidden bg-[#eae2d8] sm:h-36 sm:w-32" style={{ backgroundColor: product.shade }}>
        <Link to={route} aria-label={`View ${product.name}`} className="block h-full w-full" data-testid={`link-product-image-${product.id}`}>
          <StoreImage src={product.image} mobileSrc={product.mobileImage} fallbackSources={product.images} alt={product.seo?.imageAlt||product.name} loading="lazy" decoding="async" className="nura-product-card-image h-full w-full object-contain object-center p-2 mix-blend-multiply sm:p-3 motion-reduce:transition-none" />
        </Link>
        {showTag&&tagItems.map((tag,index)=><span key={tag.id} className="pointer-events-none z-10 inline-flex max-w-[62%] items-center gap-1 truncate uppercase" style={tagStyle(index)} data-testid={`badge-product-tag-${product.id}`}><ProductTagIcon name={tag.icon}/>{tag.label}</span>)}
        {badgeSettings.wishlistVisible&&<button type="button" onClick={()=>toggle(product.id)} aria-label={saved?`Remove ${product.name} from wishlist`:`Save ${product.name} to wishlist`} aria-pressed={saved} style={{color:badgeSettings.wishlistColor,backgroundColor:badgeSettings.wishlistBackgroundColor}} className="absolute right-1.5 top-1.5 z-20 grid h-8 w-8 place-items-center rounded-full shadow-sm transition-transform hover:scale-105" data-testid={`button-wishlist-${product.id}`}><Heart size={15} fill={saved?'currentColor':'none'}/></button>}
        {badgeSettings.discountVisible&&discountPercent>0&&<span className="pointer-events-none z-10 uppercase" style={{...discountStyle,...(badgeSettings.tagPosition===badgeSettings.discountPosition?badgePlacement(badgeSettings.discountPosition,tagItems.length+(badgeSettings.discountPosition==='bottom-right'&&unavailable?1:0),badgeSettings.discountPosition==='top-right'&&badgeSettings.wishlistVisible):{})}} data-testid={`badge-product-discount-${product.id}`}>{discountPercent}% off</span>}
        {unavailable&&<span className="pointer-events-none absolute bottom-1.5 right-1.5 z-10 rounded-sm bg-[#FDFBF7]/95 px-2 py-1 text-[8px] font-bold uppercase tracking-[.08em] text-[#8b566e]">Out of stock</span>}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0">
          {category}
          <div className="mt-1.5">{title}</div>
          {ratingSummary}
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 sm:justify-end">
          {price}
          <div className="w-full sm:w-40">{action}</div>
        </div>
      </div>
    </article>;
  }

  return <article className="group flex h-full min-w-0 flex-col" data-testid={`card-product-${product.id}`}>
    <div className="relative aspect-[.82] overflow-hidden bg-[#eae2d8]" style={{ backgroundColor: product.shade }}>
      <Link to={route} aria-label={`View ${product.name}`} data-testid={`link-product-image-${product.id}`} className="block h-full w-full">
          <StoreImage src={product.image} mobileSrc={product.mobileImage} fallbackSources={product.images} alt={product.seo?.imageAlt||product.name} loading="lazy" decoding="async" className="nura-product-card-image h-full w-full object-contain object-center p-2 mix-blend-multiply sm:p-3 motion-reduce:transition-none" />
      </Link>
        {showTag&&tagItems.map((tag,index)=><span key={tag.id} className="pointer-events-none z-10 inline-flex max-w-[62%] items-center gap-1.5 truncate uppercase" style={tagStyle(index)} data-testid={`badge-product-tag-${product.id}`}><ProductTagIcon name={tag.icon}/>{tag.label}</span>)}
      {badgeSettings.wishlistVisible&&<button type="button" onClick={()=>toggle(product.id)} aria-label={saved?`Remove ${product.name} from wishlist`:`Save ${product.name} to wishlist`} aria-pressed={saved} style={{color:badgeSettings.wishlistColor,backgroundColor:badgeSettings.wishlistBackgroundColor}} className="absolute right-2 top-2 z-20 grid h-9 w-9 place-items-center rounded-full shadow-sm transition-transform hover:scale-105 sm:right-3 sm:top-3" data-testid={`button-wishlist-${product.id}`}><Heart size={16} fill={saved?'currentColor':'none'}/></button>}
        {badgeSettings.discountVisible&&discountPercent>0&&<span className="pointer-events-none z-10 uppercase" style={{...discountStyle,...(badgeSettings.tagPosition===badgeSettings.discountPosition?badgePlacement(badgeSettings.discountPosition,tagItems.length+(badgeSettings.discountPosition==='bottom-right'&&unavailable?1:0),badgeSettings.discountPosition==='top-right'&&badgeSettings.wishlistVisible):{})}} data-testid={`badge-product-discount-${product.id}`}>{discountPercent}% off</span>}
      {unavailable&&<span className="pointer-events-none absolute bottom-2 right-2 z-10 rounded-sm bg-[#FDFBF7]/95 px-2 py-1.5 text-[8px] font-bold uppercase tracking-[.08em] text-[#8b566e] sm:bottom-3 sm:right-3">Out of stock</span>}
    </div>
    <div className="mt-4 flex min-h-0 flex-1 flex-col">
      {category}
      <div className="mt-1.5">{title}</div>
      {ratingSummary}
      <div className="mt-2">{price}</div>
      <div className="mt-auto pt-3">{action}</div>
    </div>
  </article>;
}

export default memo(ProductCard);
