import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check, ChevronDown, ChevronRight, Star, Truck } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { useAdminStore } from '../context/AdminContext';
import { formatPKR, isProductCustomerVisible } from '../utils/store';
import { ActionButton, CommerceLayout } from '../components/CommerceLayout';
import ProductGallery from '../components/ProductGallery';
import BuyMoreSaveMore from '../components/BuyMoreSaveMore';
import ProductCard from '../components/ProductCard';
import { categoryRoute } from '../utils/categoryRoutes';
import { findProductBySlug } from '../utils/seo';
import CountdownTimer from '../components/CountdownTimer';
import StoreImage from '../components/StoreImage';

export default function ProductDetailPage() {
  const { id } = useParams();
  const { add, products, categories } = useStore();
  const {data}=useAdminStore();
  const product = findProductBySlug(products.filter(isProductCustomerVisible),id||'');
  const [quantity, setQuantity] = useState(1);
  const [variant, setVariant] = useState('Standard');
  const [selectedOptions,setSelectedOptions]=useState<Record<string,string>>({});
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [added, setAdded] = useState(false);
  useEffect(() => {
    setQuantity(1);
    setVariant(product?.variants?.[0] ?? 'Standard');
    setSelectedOptions(Object.fromEntries((product?.variationTypes??[]).map(type=>[type.id,type.values[0]??''])));
    setGalleryIndex(0);
    setAdded(false);
  }, [product?.id,product?.stock]);
  if (!product) return <CommerceLayout eyebrow="The collection" title="We couldn’t find that item." intro="It may have moved on. Browse the collection to find something that fits what you’re looking for."><Link className="mt-5 inline-flex text-sm font-semibold text-[#6B2447]" to="/shop" data-testid="link-back-to-shop">Back to the shop</Link></CommerceLayout>;
  const relatedSettings=data.content.relatedProductsSettings;
  const relatedProducts=products
    .filter(item=>isProductCustomerVisible(item)&&item.id!==product.id)
    .sort((a,b)=>relatedSettings.prioritizeSameCategory?Number(b.category===product.category)-Number(a.category===product.category):0)
    .slice(0,Math.min(8,Math.max(2,relatedSettings.productLimit)));
  const variationTypes=product.variationTypes??[];
  const selectedVariant=product.variantMatrix?.find(item=>variationTypes.every(type=>item.options[type.id]===selectedOptions[type.id]));
  const activePrice=selectedVariant?.price??product.price;
  const activeOldPrice=selectedVariant?.oldPrice??product.oldPrice;
  const activeStock=selectedVariant?.stock??(variationTypes.length?0:product.stock);
  const outOfStock=product.inStock===false||activeStock<1;
  const limitedStock=!outOfStock&&activeStock<=5;
  const stockStatus=variationTypes.length>0&&!selectedVariant?'Unavailable combination':outOfStock?'Out of stock':limitedStock?'Limited stock':'In stock';
  const stockTone=outOfStock?'text-[#9b3e4c]':limitedStock?'text-[#95601f]':'text-[#60705d]';
  const stockDot=outOfStock?'bg-[#b86669]':limitedStock?'bg-[#d38b32]':'bg-[#839578]';
  const saving = activeOldPrice ? activeOldPrice - activePrice : 0;
  const savingsPercent = activeOldPrice ? Math.round((1 - activePrice / activeOldPrice) * 100) : 0;
  const hasVariants = Boolean(product.variants?.length||variationTypes.length);
  const variants = product.variants ?? [];
  const gallery = selectedVariant?.image?[selectedVariant.image,...(product.images??[]).filter(image=>image!==selectedVariant.image)]:product.images?.length ? product.images : [product.image];
  const rating = product.rating ?? 4.8;
  const reviewCount = product.reviewCount ?? 0;
  const features = product.features ?? ['Thoughtfully selected for everyday use', 'Packed with care in Pakistan', 'A considered addition to your routine'];
  const defaultShippingInfo=`We deliver across Pakistan. Standard delivery is ${formatPKR(data.settings.general.deliveryFee)}; complimentary on eligible orders over ${formatPKR(data.content.announcement.freeDeliveryThreshold)}.`;
  const oldDefaultShippingInfo='Ships to major cities and towns across Pakistan. Delivery is free on orders above Rs 3,000.';
  const shippingInfo=!product.shippingInfo||product.shippingInfo===oldDefaultShippingInfo?defaultShippingInfo:product.shippingInfo;
  return <CommerceLayout>
    <CountdownTimer placement="product"/>
    <div className="mb-7 flex items-center gap-2 text-[11px] text-[#8b8075]"><Link to="/shop" className="hover:text-[#6B2447]" data-testid="link-product-home">Shop</Link><ChevronRight size={13}/><Link to={categoryRoute(categories.find(category=>category.name===product.category)??{id:product.category,name:product.category},categories)} className="hover:text-[#6B2447]" data-testid="link-product-category">{product.category}</Link><ChevronRight size={13}/><span className="text-[#473a3b]">{product.name}</span></div>
      <div className="grid min-w-0 grid-cols-1 gap-x-0 gap-y-0 md:grid-cols-2 md:gap-x-14" data-testid="product-detail-layout">
        <div className="order-5 min-w-0 md:order-none">
           <ProductGallery key={product.id} images={gallery} productName={product.seo?.imageAlt||product.name} shade={product.shade} badge={product.badge} mode={data.content.productGalleryStyle} mobileImage={selectedVariant?.image?undefined:product.mobileImage} index={selectedVariant?.image?0:galleryIndex} onIndexChange={setGalleryIndex} />
       </div>
       <div className="contents md:block md:pt-4">
         <p className="order-1 text-[10px] font-bold uppercase tracking-[.2em] text-[#74816c] md:order-none" data-testid="text-product-category">{product.category}</p>
         <h1 className="order-2 mt-3 text-[32px] font-semibold leading-tight tracking-[-.045em] text-[#3c3032] sm:text-[40px] md:order-none" data-testid="text-product-name">{product.name}</h1>
          <div className="order-3 mt-4 flex items-center gap-2 text-xs md:order-none"><span className="flex text-[#aa8855]" aria-label={`Rated ${rating.toFixed(1)} out of 5`}><Star size={14} fill="currentColor"/><Star size={14} fill="currentColor"/><Star size={14} fill="currentColor"/><Star size={14} fill="currentColor"/><Star size={14} fill="currentColor"/></span><span className="font-semibold" data-testid="text-product-rating">{rating.toFixed(1)}</span><span className="text-[#8b8075]">· {reviewCount} thoughtful reviews</span></div>
            <div className="order-4 mt-5 flex flex-wrap items-baseline gap-3 md:order-none"><span className="text-[24px] font-semibold text-[#6B2447]" data-testid="text-product-price">{product.fromPrice&&!variationTypes.length ? 'From ' : ''}{formatPKR(activePrice)}</span>{activeOldPrice && <><span className="text-sm text-[#9a9086] line-through" data-testid="text-product-old-price">{formatPKR(activeOldPrice)}</span><span className="bg-[#e8ece1] px-2.5 py-1 text-[10px] font-semibold text-[#596752]" data-testid="text-product-savings">Save {formatPKR(saving)} · {savingsPercent}% off</span></>}</div>
          <p className="order-6 mt-5 max-w-lg text-sm leading-7 text-[#756b62] md:order-none">{product.description}</p>
           <div className={`order-7 mt-6 flex items-center gap-2 text-[11px] font-medium md:order-none ${stockTone}`} data-testid="text-stock-status" role="status" aria-live="polite"><span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${stockDot}`}/>{stockStatus}</div>
          <div className={`order-8 mt-7 grid gap-5 md:order-none ${hasVariants?'sm:grid-cols-2':''}`}>
             {variationTypes.map(type=><fieldset className="text-[11px] font-semibold text-[#62564e]" key={type.id}><legend>{type.name}</legend><div className="mt-2 flex flex-wrap gap-2">{type.values.map(value=><button type="button" key={value} onClick={()=>{const nextOptions={...selectedOptions,[type.id]:value};const nextVariant=product.variantMatrix?.find(item=>variationTypes.every(option=>item.options[option.id]===nextOptions[option.id]));setSelectedOptions(nextOptions);setQuantity(current=>Math.max(1,Math.min(current,nextVariant?.stock??0)));}} aria-pressed={selectedOptions[type.id]===value} className={`rounded-full border px-3 py-2 text-xs ${selectedOptions[type.id]===value?'border-[#6B2447] bg-[#f6edf1] text-[#6B2447]':'border-[#dfd6ca]'}`} data-testid={`button-option-${type.id}-${value}`}>{value}</button>)}</div></fieldset>)}
            {!variationTypes.length&&hasVariants&&<label className="text-[11px] font-semibold text-[#62564e]">Choose an option<select value={variant} onChange={e => setVariant(e.target.value)} className="mt-2 h-11 w-full border border-[#dfd6ca] bg-transparent px-3 text-xs outline-none focus:border-[#6B2447]" data-testid="select-product-variant">{variants.map(option => <option value={option} key={option}>{option}</option>)}</select></label>}
            <div><span className="text-[11px] font-semibold text-[#62564e]">Quantity</span><div className="mt-2 flex h-11 items-center border border-[#dfd6ca]"><button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="h-full w-11 text-lg text-[#6B2447]" aria-label="Decrease quantity" data-testid="button-product-quantity-decrease">−</button><span className="flex-1 text-center text-xs tabular-nums" data-testid="text-product-quantity">{quantity}</span><button onClick={() => setQuantity(q => Math.min(activeStock, q + 1))} disabled={quantity>=activeStock} className="h-full w-11 text-lg text-[#6B2447] disabled:opacity-40" aria-label="Increase quantity" data-testid="button-product-quantity-increase">+</button></div></div>
        </div>
            <div className="order-9 mt-6 flex flex-col gap-3 sm:flex-row md:order-none" data-testid="product-purchase-actions"><ActionButton testId="button-add-to-bag" disabled={outOfStock||(!selectedVariant&&variationTypes.length>0)} onClick={() => { if(add(product, quantity,selectedVariant?.label??variant,selectedVariant?.id))setAdded(true); }}><span>{outOfStock ? 'Out of stock' : `Add to cart · ${formatPKR(activePrice * quantity)}`}</span></ActionButton><Link to="/cart" className="inline-flex min-h-11 items-center justify-center border border-[#d8cec2] px-5 text-xs font-semibold text-[#5f514c]" data-testid="link-view-bag">View cart</Link></div>
              <div className="order-10 mt-5 md:order-none"><BuyMoreSaveMore product={selectedVariant?{...product,price:activePrice}:product} quantity={quantity} settings={data.content.quantityDiscounts}/></div>
           {added && <p className="order-11 mt-3 text-xs font-medium text-[#60705d] md:order-none" role="status" data-testid="status-product-added"><Check size={14} className="mr-1 inline"/>Added to your cart.</p>}
              {features.length>0&&<ul className="order-12 mt-6 grid grid-cols-1 gap-3 text-xs leading-5 text-[#71675e] sm:grid-cols-2 md:order-none" data-testid="list-product-benefits">{features.map((feature,index)=><li className="flex gap-2" key={`${feature}-${index}`} data-testid={`text-product-feature-${index}`}><Check size={14} className="mt-0.5 shrink-0 text-[#74816c]"/>{feature}</li>)}</ul>}
              {data.content.pdpSections.trustBadges&&<ul className="order-12 mt-7 grid grid-cols-1 gap-3 border-y border-[#e9e2d8] py-4 text-[10px] leading-4 text-[#71675e] sm:grid-cols-2 md:order-none"><li className="flex gap-2"><Truck size={14} className="shrink-0 text-[#74816c]"/>Nationwide delivery</li>{product.cashOnDeliveryEnabled&&data.settings.general.cashOnDelivery&&<li><Check size={14} className="mr-2 inline"/>Cash on delivery available</li>}</ul>}
              {(data.content.pdpSections.accordions||product.additionalInfo?.trim())&&<div className="order-13 mt-5 divide-y divide-[#e9e2d8] border-y border-[#e9e2d8] md:order-none">{[...(data.content.pdpSections.accordions?[['Description',product.description??'A gentle, considered essential for a softer everyday.'],['Usage',product.usage??'Follow the product packaging for product-specific directions.'],['Shipping Info',shippingInfo]] as [string,string][]:[]),...(product.additionalInfo?.trim()?[['Additional information',product.additionalInfo] as [string,string]]:[])].map(([name,copy])=><details key={name} className="group py-4"><summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold">{name}<ChevronDown size={16} strokeWidth={1.7} aria-hidden="true" className="product-accordion-chevron shrink-0 text-[#6B2447]"/></summary><div className="pt-3 text-xs leading-6 text-[#766d64]" data-testid={`text-product-${name.toLowerCase().replace(' ', '-')}`}>{copy.split('\n').map((line,index)=><p key={`${name}-${index}`}>{line}</p>)}</div></details>)}</div>}
          <p className="order-14 mt-4 text-[10px] text-[#9a8f83] md:order-none">Product imagery is illustrative; small variations may occur.</p>
      </div>
    </div>
    {data.content.pdpSections.videoReviews&&<section className="mt-12 border-t pt-8"><h2 className="text-xl font-semibold">Video Reviews</h2><div className="mt-5 grid gap-4 sm:grid-cols-3">{data.reviews.filter(review=>review.published&&review.videoUrl).map(review=><a key={review.id} href={review.videoUrl} target="_blank" rel="noreferrer" className="border p-4"><StoreImage src={review.thumbnailUrl||product.image} fallbackSources={product.images} alt="" loading="lazy" decoding="async" className={`h-36 w-full bg-[#eee5dc] object-center ${review.thumbnailUrl?'object-cover':'object-contain'}`}/><p className="mt-3 text-xs font-semibold">Watch {review.customer}'s review</p></a>)}</div></section>}
    {data.content.pdpSections.relatedProducts&&relatedProducts.length>0&&<section className="mt-12 min-w-0 border-t pt-8" data-testid="related-products-section"><h2 className="text-xl font-semibold">{relatedSettings.title}</h2>{relatedSettings.subtitle&&<p className="mt-2 text-xs text-[#81776e]">{relatedSettings.subtitle}</p>}<div className="mt-5 grid min-w-0 grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 lg:grid-cols-4" data-testid="related-products-grid">{relatedProducts.map(item=><ProductCard key={item.id} product={item}/>)}</div></section>}
  </CommerceLayout>;
}