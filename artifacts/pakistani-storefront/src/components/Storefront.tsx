import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode, type TouchEvent as ReactTouchEvent } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Award, Check, ChevronLeft, ChevronRight, Heart, Leaf, Lock, Minus, Package, Play, Plus, Shield, ShieldCheck, ShoppingBag, Sparkles, Star, Truck, Users, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { calculatePromotionSummary, formatPKR, isProductCustomerVisible, type Product, type StoreCategory } from '../utils/store';
import { categoryRoute } from '../utils/categoryRoutes';
import { useStore } from '../context/StoreContext';
import { useAdminStore, type AdminReview, type HeroSlide } from '../context/AdminContext';
import { useBodyScrollLock } from '../hooks/use-body-scroll-lock';
import { useCarouselTrack } from '../hooks/use-carousel-track';
import { httpsCallable, functions } from '../lib/supabase/functions';
import { protectForm } from '../hooks/use-recaptcha';
import { cleanData } from '../utils/sanitize';
import MobileBottomNav from './MobileBottomNav';
import StorefrontHeader from './StorefrontHeader';
import ProductBrowse from './ProductBrowse';
import ProductCard from './ProductCard';
import StoreImage from './StoreImage';
import StoreImagePlaceholderGrid from './StoreImagePlaceholderGrid';
import AnnouncementBar from './AnnouncementBar';
import MarqueeBars from './MarqueeBars';
import CountdownTimer from './CountdownTimer';
import StoreFooter from './StoreFooter';
import TrustBadgeSection from './TrustBadgeSection';
import { FAQSection, FeatureGridSection, InstagramFeedSection, OfferBannerSection, CustomMediaBannerSection } from './homepage/OptionalHomeSections';
import type { HomeSectionAppearance, HomeSectionId, HomeSectionSetting } from '../types/homeSections';

function containsUrdu(value:string){
  return /[\u0600-\u06ff\u0750-\u077f]/u.test(value);
}

const sampleHeroSlide:HeroSlide={
  id:'sample-store-hero',
  eyebrow:'A thoughtful edit',
  title:'Considered essentials for everyday living',
  copy:'Explore useful, well-made pieces chosen to bring a little more care to daily routines. Replace this example with your own collection introduction.',
  cta:'Explore the collection',
  desktopImageUrl:'',
  mobileImageUrl:'',
  horizontalAlignment:'left',
  overlayPosition:'bottom-left',
  mobileHorizontalAlignment:'left',
  mobileOverlayPosition:'bottom-left',
};

function Hero({headingOverride,subheadingOverride}:{headingOverride?:string;subheadingOverride?:string}={}){
  const {data,storefrontSettingsState}=useAdminStore();
  const slides=data.content.heroSlides.length?data.content.heroSlides:[sampleHeroSlide];
  const settings=data.content.heroSettings;
  const buttonSettings=data.content.heroButtonSettings;
  const secondary=buttonSettings;
  const heroHeightStyle={
    '--nura-hero-mobile-height':`${settings.mobileHeightPx}px`,
    '--nura-hero-desktop-height':`${settings.desktopHeightPx}px`,
  } as CSSProperties;
  const [index,setIndex]=useState(0);
  const [slideDirection,setSlideDirection]=useState<1|-1>(1);
  const [isInteracting,setIsInteracting]=useState(false);
  const touchStart=useRef<{x:number;y:number}|null>(null);
  const mouseStart=useRef<{x:number;y:number}|null>(null);
  const slide=slides.length?slides[index%slides.length]:undefined;
  const primary=buttonSettings;
  const editorialCtaClass='nura-hero-cta-editorial group inline-flex min-h-10 items-center gap-2 border-b border-[#4a1832]/70 pb-1 text-[12px] font-semibold text-[#4a1832] transition-colors hover:border-[#4a1832] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#4a1832]';
  const primaryCtaStyle={
    '--nura-hero-button-background':primary.transparentBackground&&primary.style!=='solid'?'transparent':primary.backgroundColor,
    '--nura-hero-button-text':primary.textColor,
    '--nura-hero-button-border':primary.borderColor,
  } as CSSProperties;
  const secondaryCtaStyle={
    '--nura-hero-button-background':secondary.secondaryTransparentBackground&&secondary.secondaryStyle!=='solid'?'transparent':secondary.secondaryBackgroundColor,
    '--nura-hero-button-text':secondary.secondaryTextColor,
    '--nura-hero-button-border':secondary.secondaryBorderColor,
  } as CSSProperties;
  const eyebrowText=subheadingOverride||slide?.eyebrow||'A thoughtful edit';
  const headingText=headingOverride||slide?.title||'Considered essentials for everyday living';
  const isUrduEyebrow=containsUrdu(eyebrowText);
  const isUrduHeading=containsUrdu(headingText);
  const isUrduCopy=containsUrdu(slide?.copy||'');
  const isUrduCta=containsUrdu(primary.label);
  const transitionStyle={'--nura-slide-offset':slideDirection>0?'24px':'-24px'} as CSSProperties;
  useEffect(()=>{
    if(storefrontSettingsState!=='ready'||slides.length<2||isInteracting||!settings.autoPlayEnabled)return;
    const timer=window.setTimeout(()=>{
      setSlideDirection(1);
      setIndex(current=>(current+1)%slides.length);
    },settings.autoPlayDurationMs);
    return()=>window.clearTimeout(timer);
  },[storefrontSettingsState,slides.length,index,isInteracting,settings.autoPlayEnabled,settings.autoPlayDurationMs]);
  if(!slide)return null;
  const step=(d:number)=>{setSlideDirection(d>0?1:-1);setIndex(i=>(i+d+slides.length)%slides.length);};
  const handleTouchStart=(event:ReactTouchEvent<HTMLDivElement>)=>{
    const touch=event.touches[0];
    if(!touch)return;
    touchStart.current={x:touch.clientX,y:touch.clientY};
    setIsInteracting(true);
  };
  const handleTouchEnd=(event:ReactTouchEvent<HTMLDivElement>)=>{
    const start=touchStart.current;
    const touch=event.changedTouches[0];
    touchStart.current=null;
    if(start&&touch){
      const deltaX=touch.clientX-start.x;
      const deltaY=touch.clientY-start.y;
      if(Math.abs(deltaX)>50&&Math.abs(deltaX)>Math.abs(deltaY)*1.2)step(deltaX<0?1:-1);
    }
    setIsInteracting(false);
  };
  const handleTouchCancel=()=>{
    touchStart.current=null;
    setIsInteracting(false);
  };
  const handlePointerDown=(event:React.PointerEvent<HTMLDivElement>)=>{
    if(event.pointerType!=='mouse'||(event.target as HTMLElement).closest('a,button'))return;
    mouseStart.current={x:event.clientX,y:event.clientY};
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handlePointerUp=(event:React.PointerEvent<HTMLDivElement>)=>{
    const start=mouseStart.current;
    mouseStart.current=null;
    if(!start)return;
    const dx=event.clientX-start.x,dy=event.clientY-start.y;
    if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)*1.2)step(dx<0?1:-1);
  };
  return <section className="w-full" data-home-hero data-hero-settings-state={storefrontSettingsState}>
    <div
      className="relative min-h-[var(--nura-hero-mobile-height)] w-full min-w-0 overflow-hidden bg-[#e8e0d5] md:min-h-[var(--nura-hero-desktop-height)]"
      style={{...heroHeightStyle,touchAction:'pan-y'}}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={()=>{mouseStart.current=null;}}
    >
     <StoreImage key={`hero-media-${index}`} src={slide.desktopImageUrl} mobileSrc={slide.mobileImageUrl} fallbackSources={[slide.mobileImageUrl,slide.desktopImageUrl]} alt={slide.title?`${slide.title} — store banner`:'Store banner'} placeholderTitle="Hero image placeholder" placeholderHint="Add desktop and mobile artwork in Admin → Content → Hero Slides." placeholderDimensions="Desktop: 1920 × 800 px · Mobile: 800 × 1000 px" fetchPriority="high" decoding="async" pictureClassName="nura-hero-transition absolute inset-0 block" pictureStyle={transitionStyle} className="block h-full w-full object-contain object-center" data-testid="img-home-hero"/>
   <div className="absolute inset-0 bg-gradient-to-r from-[#2c241f]/65 via-[#2c241f]/30 to-transparent md:from-[#30231d]/62 md:via-[#30231d]/25"/>
      <div className="nura-hero-content-position relative z-10 flex min-h-[var(--nura-hero-mobile-height)] w-full px-5 sm:px-12 md:min-h-[var(--nura-hero-desktop-height)] md:px-[8%]" data-position-mobile={slide.mobileOverlayPosition||'bottom-left'} data-position-desktop={slide.overlayPosition||'bottom-left'} data-align-mobile={slide.mobileHorizontalAlignment||'left'} data-align-desktop={slide.horizontalAlignment||'left'}>
      <CountdownTimer placement="hero"/>
       <div className="nura-hero-copy nura-hero-transition w-full min-w-0 max-w-[520px] text-white" key={`hero-copy-${index}`} style={transitionStyle}>
      <div dir={isUrduEyebrow?'rtl':undefined} lang={isUrduEyebrow?'ur':undefined} className={`mb-5 text-[10px] font-semibold text-[#e4d9c9] sm:text-[11px] ${isUrduEyebrow?'nura-urdu-text':'uppercase tracking-[.22em]'}`}>{eyebrowText}</div>
       <h1 dir={isUrduHeading?'rtl':undefined} lang={isUrduHeading?'ur':undefined} className={`nura-heading-display text-[clamp(36px,13.5vw,54px)] font-semibold whitespace-pre-line leading-[.98] sm:text-[72px] md:text-[76px] ${isUrduHeading?'nura-urdu-text':'serif'}`}>{headingText}</h1>
       <p dir={isUrduCopy?'rtl':undefined} lang={isUrduCopy?'ur':undefined} className={`mt-5 max-w-[380px] text-[14px] text-white/85 sm:text-[15px] ${isUrduCopy?'nura-urdu-text':'leading-6'}`}>{slide.copy||'Replace this sample with a short introduction to your products and the people behind your store.'}</p>
    </div>
   </div>
     {settings.showCtas&&(primary.visible||secondary.secondaryEnabled)&&<div className="nura-hero-primary-cta-position absolute bottom-[72px] right-5 z-20 flex flex-wrap items-center justify-end gap-x-5 gap-y-2 sm:right-12 md:right-[8%]" data-testid="hero-primary-cta-position">
       {primary.visible&&(primary.href.startsWith('/')?<Link style={primaryCtaStyle} dir={isUrduCta?'rtl':undefined} lang={isUrduCta?'ur':undefined} to={primary.href} data-style={primary.style} data-testid="hero-primary-cta" className={`${editorialCtaClass} ${isUrduCta?'nura-urdu-text':''}`}>{primary.label}<ArrowRight size={14} className="transition-transform duration-300 group-hover:translate-x-1"/></Link>
         :<a style={primaryCtaStyle} dir={isUrduCta?'rtl':undefined} lang={isUrduCta?'ur':undefined} href={primary.href} data-style={primary.style} data-testid="hero-primary-cta" className={`${editorialCtaClass} ${isUrduCta?'nura-urdu-text':''}`}>{primary.label}<ArrowRight size={14} className="transition-transform duration-300 group-hover:translate-x-1"/></a>)}
       {secondary.secondaryEnabled&&(secondary.secondaryHref.startsWith('/')?<Link style={secondaryCtaStyle} to={secondary.secondaryHref} data-style={secondary.secondaryStyle} data-testid="hero-secondary-cta" className={editorialCtaClass}>{secondary.secondaryLabel}<ArrowRight size={14} className="transition-transform duration-300 group-hover:translate-x-1"/></Link>
         :<a style={secondaryCtaStyle} href={secondary.secondaryHref} data-style={secondary.secondaryStyle} data-testid="hero-secondary-cta" className={editorialCtaClass}>{secondary.secondaryLabel}<ArrowRight size={14} className="transition-transform duration-300 group-hover:translate-x-1"/></a>)}
    </div>}
      {slides.length>1&&(settings.showArrows||settings.showDots)&&<div role="group" aria-label="Hero slide navigation" className="pointer-events-none absolute inset-0 z-20">
      {settings.showArrows&&<button type="button" aria-label="Previous slide" onClick={()=>step(-1)} className={`pointer-events-auto absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-white/45 text-white shadow-lg backdrop-blur-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:left-6 sm:h-11 sm:w-11 ${settings.arrowsStyle==='outer'?'bg-[#fdfbf7]/85 text-[#6b2447] hover:bg-white':settings.arrowsStyle==='minimal'?'border-transparent bg-transparent shadow-none hover:bg-white/10':'bg-black/20 hover:bg-white/25'}`} data-testid="button-hero-previous"><ChevronLeft size={19}/></button>}
      {settings.showDots&&<div className="pointer-events-auto absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/20 px-3 py-2 backdrop-blur-sm" role="group" aria-label="Choose hero slide">
        {slides.map((item,slideIndex)=><button key={item.id} type="button" aria-label={`Show slide ${slideIndex+1}`} aria-current={slideIndex===index?'true':undefined} onClick={()=>{setSlideDirection(slideIndex>=index?1:-1);setIndex(slideIndex);}} className={`h-2 rounded-full transition-all ${slideIndex===index?'w-6 bg-white':'w-2 bg-white/60 hover:bg-white'}`} data-testid={`button-hero-slide-${slideIndex+1}`}/>)}
      </div>}
      {settings.showArrows&&<button type="button" aria-label="Next slide" onClick={()=>step(1)} className={`pointer-events-auto absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-white/45 text-white shadow-lg backdrop-blur-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:right-6 sm:h-11 sm:w-11 ${settings.arrowsStyle==='outer'?'bg-[#fdfbf7]/85 text-[#6b2447] hover:bg-white':settings.arrowsStyle==='minimal'?'border-transparent bg-transparent shadow-none hover:bg-white/10':'bg-black/20 hover:bg-white/25'}`} data-testid="button-hero-next"><ChevronRight size={19}/></button>}
    </div>}
  </div>
  </section>;
}
function PromiseStrip({headingOverride,subheadingOverride}:{headingOverride?:string;subheadingOverride?:string}={}){
 return <TrustBadgeSection headingOverride={headingOverride} subheadingOverride={subheadingOverride}/>;
}

function Categories({heading,subheading}:{heading?:string;subheading?:string}){
 const {products,categories}=useStore();
   const {data,categoriesReady}=useAdminStore();
  const marqueeGroupRef=useRef<HTMLDivElement|null>(null);
  const circle=data.content.categoryLayout==='circle';
  const horizontal=data.content.categoryDisplayMode==='horizontal';
  const motionStyle=data.content.categoryMotionStyle??'auto';
  const motionSpeed=data.content.categoryMotionSpeed??'medium';
   const categoryCarousel=useCarouselTrack({enabled:horizontal,autoScroll:motionStyle==='auto'&&categories.length>1});
  const {trackRef:categoryTrackRef,scrollBy:_scrollCategory,...categoryTrackHandlers}=categoryCarousel;
  useEffect(()=>{
     const group=marqueeGroupRef.current;
     const track=categoryTrackRef.current?.querySelector<HTMLElement>('.nura-category-marquee-track');
     if(!horizontal||motionStyle!=='auto'||!group||!track||categories.length<2)return;
    const updateDuration=()=>{
       const width=group.offsetWidth;
      const pixelsPerSecond=motionSpeed==='slow'?18:motionSpeed==='fast'?68:38;
       if(width>0)track.style.setProperty('--nura-carousel-duration',`${Math.max(8,width/pixelsPerSecond)}s`);
    };
    updateDuration();
    const observer=new ResizeObserver(updateDuration);
    observer.observe(group);
    return()=>observer.disconnect();
   },[horizontal,motionStyle,motionSpeed,categories.length,categoryTrackRef]);
 const renderCategory=(category:StoreCategory,duplicate=false)=><Link key={`${category.id}${duplicate?'-duplicate':''}`} to={categoryRoute(category,categories)} className={`group text-left ${horizontal?'nura-category-row-item snap-start':''}`} data-testid={duplicate?undefined:`link-category-${category.id}`} aria-hidden={duplicate||undefined} tabIndex={duplicate?-1:undefined}>
    <div className={`relative mb-4 overflow-hidden ${circle?'aspect-square rounded-full':'h-[175px] rounded-xl sm:h-[250px]'}`} style={{backgroundColor:category.color}}>
        <StoreImage src={category.image} mobileSrc={category.mobileImage} fallbackSources={category.images} alt={duplicate?'':category.seo?.imageAlt||category.name} placeholderShape={circle?'circle':'portrait'} placeholderTitle="Category image" placeholderHint="Upload a category image in Admin → Catalog → Categories." placeholderDimensions={circle?'Recommended: 1000 × 1000 px':'Recommended: 1200 × 1500 px'} loading="lazy" decoding="async" pictureClassName="absolute inset-0 block" className="h-full w-full object-cover object-center mix-blend-multiply opacity-80"/>
       {data.content.showCategoryProductCount&&<span className="absolute top-3 left-3 bg-[#FDFBF7]/85 rounded-full px-3 py-1.5 text-[9px] sm:text-[10px] tracking-wide" data-testid={`badge-category-product-count-${category.id}`}>{products.filter(product=>isProductCustomerVisible(product)&&product.category===category.name).length} products</span>}
     </div><h3 className="nura-heading-small text-center font-semibold text-[13px] sm:text-[15px]">{category.name}</h3><p className="mt-1 text-center text-[11px] text-[#80756b] sm:text-xs">{category.sub||'Explore thoughtfully selected products in this collection.'}</p>
  </Link>;
  return <section className="page-wrap py-16 sm:py-20" data-home-collections>
    <div className="mb-7 flex items-end justify-between gap-4 sm:mb-9"><div className="min-w-0"><span className="eyebrow">{subheading||'Explore by category'}</span><h2 className="nura-heading-section serif mt-2 text-[32px] sm:text-[42px]">{heading||'Find your next favorite'}</h2></div><Link to="/collections" aria-label="View all categories" data-testid="link-view-all-categories" className="mb-1 flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-[#6B2447] transition-colors hover:text-[#4f1b35] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#6B2447]">View all <ArrowRight size={14} aria-hidden="true"/></Link></div>
         {horizontal&&motionStyle==='auto'&&categories.length>1
          ?<div {...categoryTrackHandlers} ref={categoryTrackRef} className="nura-category-marquee" data-motion="auto" data-speed={motionSpeed} aria-label="Product categories, continuously scrolling">
            <div className="nura-category-marquee-track nura-carousel-animation-track" data-carousel-animation-track>
             <div ref={marqueeGroupRef} className="nura-category-marquee-group" data-carousel-loop-unit>{categories.map(category=>renderCategory(category))}</div>
              <div className="nura-carousel-clone nura-category-marquee-group" aria-hidden="true" inert>{categories.map(category=>renderCategory(category,true))}</div>
           </div>
         </div>
          :categories.length?<div {...categoryTrackHandlers} ref={categoryTrackRef} className={horizontal?'nura-category-row':'nura-category-grid grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5'} data-layout={horizontal?'horizontal':'grid'} data-motion={horizontal?motionStyle:undefined} aria-label={horizontal?'Product categories, horizontally scrollable':'Product categories'}>{categories.map(category=>renderCategory(category))}</div>:categoriesReady?<div className="nura-empty-catalog-state" data-testid="empty-home-categories"><p className="mb-5 text-center text-sm leading-6 text-[#766d64]">Add categories in the admin panel to help shoppers browse your collection.</p><StoreImagePlaceholderGrid itemType="category" shape={circle?'circle':'portrait'} dimensions={circle?'Recommended: 1000 × 1000 px':'Recommended: 1200 × 1500 px'} count={4} testId="grid-empty-home-categories"/></div>:<div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-hidden="true"><div className="aspect-[4/5] animate-pulse rounded-xl bg-[#FDFBF7]/70"/><div className="aspect-[4/5] animate-pulse rounded-xl bg-[#FDFBF7]/70"/><div className="hidden aspect-[4/5] animate-pulse rounded-xl bg-[#FDFBF7]/70 sm:block"/><div className="hidden aspect-[4/5] animate-pulse rounded-xl bg-[#FDFBF7]/70 sm:block"/></div>}
 </section>
}

function HomepageMilestones(){
  const {data}=useAdminStore();
  const layout=data.content.milestoneSettings.layout;
  const layoutStyle:CSSProperties=layout==='single-row'
    ?{gridTemplateColumns:'repeat(3,minmax(0,1fr))'}
    :layout==='single-column'
      ?{gridTemplateColumns:'minmax(0,1fr)'}
      :layout==='double-row'
        ?{gridTemplateColumns:'repeat(2,minmax(0,1fr))'}
        :{gridTemplateRows:'repeat(2,minmax(0,1fr))',gridAutoFlow:'column',gridAutoColumns:'minmax(0,1fr)'};
  const milestones=data.content.milestoneStats.filter(item=>item.enabled).sort((a,b)=>a.order-b.order).map(item=>({...item,Icon:Package}));
  if(!milestones.length)return null;
  return <section className="page-wrap py-14 sm:py-20" data-testid="home-store-statistics">
    <div className="mx-auto max-w-5xl px-4 sm:px-0">
      <header className="mb-8 text-center sm:mb-10">
        <h2 className="nura-heading-section serif text-[30px] sm:text-[40px]" data-testid="text-home-milestones-heading">A little proof, in numbers</h2>
        <p className="mt-3 text-base text-[#81766c] sm:text-lg" data-testid="text-home-milestones-subheading">A community growing with care</p>
      </header>
      <div className="grid gap-3 sm:gap-4" style={layoutStyle} data-layout={layout} data-testid="grid-home-milestones">
        {milestones.map(({id,value,suffix,label,Icon})=><article key={id} className="flex min-h-32 flex-col items-center justify-center rounded-2xl border border-[#e8e3dd] bg-[#fdfbf7] px-3 py-4 text-center shadow-[0_8px_24px_rgba(47,35,29,.04)] sm:px-4" data-testid={`home-milestone-${id}`}>
          <Icon className="mb-2 text-[#6b2447]" size={26} strokeWidth={1.65} aria-hidden="true" data-testid={`icon-home-milestone-${id}`}/>
          <p data-testid="text-home-milestone-value" className="serif text-[42px] leading-none tracking-[-.04em] text-[#6b2447] sm:text-[48px]">{value}{suffix}</p>
          <p data-testid="text-home-milestone-label" className="mt-2 max-w-full text-[9px] font-semibold uppercase tracking-[.08em] text-[#71665e] sm:text-[10px]">{label}</p>
        </article>)}
      </div>
    </div>
  </section>;
}

function Shop({selectedCategories,onCategoriesChange,onClear,heading,subheading}:{selectedCategories:string[];onCategoriesChange:(categories:string[])=>void;onClear:()=>void;heading?:string;subheading?:string}){
 const {products,categories}=useStore();
 const title=selectedCategories.length===1?selectedCategories[0]:selectedCategories.length>1?'Selected categories':heading||'Top Collection';
  return <section className="bg-[#f5f1e9] py-16 sm:py-20" data-home-shop><div className="page-wrap">
   <div className="flex items-end justify-between mb-8"><div><span className="eyebrow">{subheading||'A few much-loved things'}</span><h2 className="nura-heading-section serif text-[34px] sm:text-[44px] mt-2">{title}</h2></div>{selectedCategories.length?<button onClick={onClear} className="text-xs text-[#6B2447] font-semibold flex items-center gap-2">Show all <ArrowRight size={14}/></button>:<Link to="/shop" className="text-xs text-[#6B2447] font-semibold flex items-center gap-2">View all <ArrowRight size={14}/></Link>}</div>
    <ProductBrowse products={products} categories={categories} selectedCategories={selectedCategories} onSelectedCategoriesChange={onCategoriesChange} onClearExternalCategory={onClear}/>
  </div></section>
}

function ProductShelf({products,title,subheading,carousel=false,carouselKey='bestsellerCarousel'}:{products:Product[];title:string;subheading:string;carousel?:boolean;carouselKey?:'bestsellerCarousel'|'newArrivalsCarousel'}){
 const {data}=useAdminStore();
  const isBestseller=carousel||title.toLowerCase().includes('bestseller');
  const settings=data.content[carouselKey];
  const horizontal=settings.layout==='horizontal';
  const autoScroll=settings.autoScroll&&horizontal&&products.length>1;
  const carouselTrack=useCarouselTrack({enabled:isBestseller&&horizontal,autoScroll});
  const {trackRef,scrollBy,...trackHandlers}=carouselTrack;
 return <section className="py-14 sm:py-18" data-testid={`section-product-shelf-${title.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`}><div className="page-wrap">
   <div className="mb-7 flex items-end justify-between gap-4"><div><span className="eyebrow">{subheading}</span><h2 className="nura-heading-section serif mt-2 text-[32px] sm:text-[42px]">{title}</h2></div><div className="flex items-center gap-3">{isBestseller&&settings.showArrows&&horizontal&&<><button type="button" onClick={()=>carouselTrack.scrollBy(-Math.max(260,trackRef.current?.clientWidth||260)*.8)} className="grid h-10 w-10 place-items-center rounded-full border" aria-label="Previous best sellers"><ChevronLeft size={17}/></button><button type="button" onClick={()=>carouselTrack.scrollBy(Math.max(260,trackRef.current?.clientWidth||260)*.8)} className="grid h-10 w-10 place-items-center rounded-full border" aria-label="Next best sellers"><ChevronRight size={17}/></button></> }<Link to="/shop" className="inline-flex items-center gap-2 text-xs font-semibold text-[#6B2447]" data-testid="link-product-shelf-shop">View all <ArrowRight size={14}/></Link></div></div>
     {products.length===0?<div className="nura-empty-catalog-state" data-testid="text-product-shelf-empty"><p className="mb-5 text-sm text-[#81766c]">Add products to populate this section with your collection.</p><StoreImagePlaceholderGrid itemType="product" shape="portrait" dimensions="Recommended: 1000 × 1000 px" count={4} testId="grid-empty-product-shelf"/></div>:isBestseller&&horizontal?<div {...trackHandlers} ref={trackRef} className="overflow-x-auto overscroll-x-contain pb-2" data-testid="grid-product-shelf" data-auto-scroll={autoScroll?'on':'off'}><div data-carousel-animation-track className={`flex w-max ${autoScroll?'nura-carousel-animation-track':''}`} style={{'--nura-carousel-duration':`${settings.speedSeconds}s`} as CSSProperties}><div className="flex gap-4 pr-4" data-carousel-loop-unit>{products.map(product=><div key={product.id} className="w-[min(76vw,270px)] shrink-0 sm:w-[calc(33.333%-11px)] lg:w-[calc(25%-12px)]"><ProductCard product={product}/></div>)}</div>{autoScroll&&<div className="nura-carousel-clone flex gap-4 pr-4" aria-hidden="true" inert>{products.map(product=><div key={`clone-${product.id}`} className="w-[min(76vw,270px)] shrink-0 sm:w-[calc(33.333%-11px)] lg:w-[calc(25%-12px)]"><ProductCard product={product}/></div>)}</div>}</div></div>:<div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 lg:grid-cols-4" data-testid="grid-product-shelf">{products.map(product=><ProductCard key={product.id} product={product}/>)}</div>}
 </div></section>;
}

export function Story({standalone=false,headingOverride,subheadingOverride}:{standalone?:boolean;headingOverride?:string;subheadingOverride?:string}={}){
  const {data}=useAdminStore();
  const story=data.content.story;
  const isUnconfigured=(value:string)=>!value.trim()||/^(about our store|add a short introduction|use the admin panel to customize)/i.test(value.trim());
  const storyTitle=isUnconfigured(story.title)?'A thoughtful shop for everyday life':story.title;
  const storyParagraphOne=isUnconfigured(story.paragraphOne)?'We bring together considered essentials that make daily routines feel a little more intentional. Each piece is chosen for useful details, enduring quality, and the way it fits into real life.':story.paragraphOne;
  const storyParagraphTwo=isUnconfigured(story.paragraphTwo)?'This is sample copy. Replace it with your own story, product values, and the people behind your store before launch.':story.paragraphTwo;
  return <section className={`${standalone?'':'page-wrap py-16 sm:py-24'} grid gap-9 md:grid-cols-2 md:items-center md:gap-16`} data-testid={standalone?'page-about-content':'home-story-section'}>
   <div className="relative h-[330px] overflow-hidden bg-[#e8e0d5] sm:h-[450px]"><StoreImage src={story.imageUrl} alt={story.imageCaption||'Store story image'} placeholderTitle="Our story image" placeholderHint="Add a photo in Admin → Content → Our Story." placeholderDimensions="Recommended: 1000 × 1000 px" loading="lazy" decoding="async" pictureClassName="absolute inset-0 block" className="h-full w-full object-cover object-center"/>{story.imageCaption&&<div className="absolute bottom-4 left-4 bg-[#FDFBF7]/90 px-4 py-3 text-[10px] uppercase tracking-[.14em]">{story.imageCaption}</div>}</div>
    <div className={standalone?'md:pl-2':'rounded-2xl bg-[#f5f1e9] p-6 sm:p-9 md:pl-9'}><span className="eyebrow">{subheadingOverride||story.eyebrow||'Our story'}</span>{standalone?<h1 className="serif text-[39px] leading-[1.05] mt-3 sm:text-[54px]">{storyTitle}</h1>:<h2 className="serif text-[39px] leading-[1.05] mt-3 sm:text-[54px]">{headingOverride||storyTitle}</h2>}<p className="mt-5 max-w-[450px] text-[14px] leading-7 text-[#71675e]">{storyParagraphOne}</p><p className="mt-3 max-w-[450px] text-[14px] leading-7 text-[#71675e]">{storyParagraphTwo}</p>{story.urduTitle&&<div className="nura-urdu-text nura-urdu-card mt-5 rounded-xl border-t border-[#e8e0d5] bg-[#faf7f0] text-right" dir="rtl" lang="ur" data-testid="story-urdu-copy"><h3 className="nura-urdu-text text-xl font-semibold text-[#6B2447]">{story.urduTitle}</h3><p className="nura-urdu-text mt-2 text-sm text-[#71675e]">{story.urduCopy}</p></div>}{!standalone&&<Link to="/about" className="mt-7 flex items-center gap-3 border-b border-[#6B2447] pb-1.5 text-xs font-semibold text-[#6B2447]" data-testid="link-home-about">{story.buttonText||'Learn more'} <ArrowRight size={14}/></Link>}</div>
  </section>
}

function ReviewCard({review,standalone=false}:{review:AdminReview;standalone?:boolean}){
  return <article className={`min-h-[228px] flex flex-col bg-[#FDFBF7] p-6 sm:p-7 ${standalone?'min-w-0':'w-[min(82vw,380px)] shrink-0 md:w-[calc(33.333%-11px)]'}`} data-testid={`card-review-${review.id}`}>
    <div className="flex gap-1 text-[#9a7955] text-[12px]" aria-label={`${review.rating} out of 5 stars`}>{'★'.repeat(Math.max(1,Math.min(5,review.rating)))}</div><p className="text-[14px] leading-6 mt-4 flex-1">“{review.text}”</p>
     <div className="flex items-center justify-between mt-5 pt-4 border-t border-[#eee8df]"><div className="flex items-center gap-3">{review.avatarUrl?<StoreImage src={review.avatarUrl} alt={`${review.customer} avatar`} loading="lazy" decoding="async" className="h-9 w-9 rounded-full object-cover object-center" data-testid={`img-review-avatar-${review.id}`}/>:<span className="w-9 h-9 rounded-full bg-[#eadbe2] text-[#6B2447] grid place-items-center text-[10px] font-semibold">{review.customer.split(' ').map(part=>part[0]).slice(0,2).join('')}</span>}<div><p className="text-[11px] font-semibold">{review.customer}</p><p className="text-[10px] text-[#898076]">{review.city}, Pakistan</p></div></div>{review.videoUrl&&<a href={review.videoUrl} target="_blank" rel="noreferrer" aria-label={`Watch ${review.customer} video review`} className="relative w-12 h-12 overflow-hidden rounded-full bg-[#e5ddd1] grid place-items-center text-white"><StoreImage src={review.thumbnailUrl} alt="" loading="lazy" decoding="async" pictureClassName="absolute inset-0 block" className="h-full w-full object-cover object-center opacity-60"/><Play size={14} fill="currentColor" className="relative"/></a>}</div>
  </article>;
}

export function Reviews({standalone=false,headingOverride,subheadingOverride}:{standalone?:boolean;headingOverride?:string;subheadingOverride?:string}={}){
  const {data}=useAdminStore();
  const motion=data.content.reviewCarousel;
  const items=data.reviews.filter(review=>review.published);
  const autoScroll=!standalone&&motion.autoScroll&&motion.layout==='horizontal'&&items.length>1;
  const carouselTrack=useCarouselTrack({enabled:!standalone&&motion.layout==='horizontal',autoScroll});
  const {trackRef,scrollBy,...trackHandlers}=carouselTrack;
  const scrollReviews=(direction:-1|1)=>scrollBy(direction*Math.max(260,(trackRef.current?.clientWidth||260)*.86));
  useEffect(()=>{
    const section=trackRef.current?.closest('section');
     section?.querySelectorAll<HTMLButtonElement>('[data-testid="button-reviews-previous"],[data-testid="button-reviews-next"]').forEach(button=>{button.hidden=!motion.showArrows||motion.layout==='grid';});
  },[motion.showArrows,motion.layout,standalone,items.length]);
  return <section className={standalone?'rounded-md bg-[#e9ede4] p-5 sm:p-9':'bg-[#e9ede4] py-16 sm:py-20'} data-testid={standalone?'page-reviews-content':'home-reviews-section'}><div className={standalone?'':'page-wrap'}><div className="mb-9 text-center sm:mb-11"><span className="eyebrow">Notes from your homes</span>{standalone?<h1 className="serif mt-2 text-[36px] sm:text-[46px]">What Our Customers Say</h1>:<h2 className="serif mt-2 text-[36px] sm:text-[46px]">{headingOverride||'What Our Customers Say'}</h2>}<p className="mt-3 text-xs text-[#73766a]">{subheadingOverride||'A little love from across Pakistan.'}</p>{!standalone&&items.length>1&&<div className="mt-5 flex justify-center gap-2"><button type="button" onClick={()=>scrollReviews(-1)} className="grid h-10 w-10 place-items-center rounded-full border border-[#c9cdbf] text-[#55664f] transition-colors hover:bg-white/60" aria-label="Previous customer reviews" data-testid="button-reviews-previous"><ChevronLeft size={17}/></button><button type="button" onClick={()=>scrollReviews(1)} className="grid h-10 w-10 place-items-center rounded-full border border-[#c9cdbf] text-[#55664f] transition-colors hover:bg-white/60" aria-label="Next customer reviews" data-testid="button-reviews-next"><ChevronRight size={17}/></button></div>}</div>
   {items.length===0?<p className="mx-auto max-w-xl text-center text-sm text-[#73766a]">Customer notes will appear here soon.</p>:standalone||motion.layout==='grid'?<div className="grid grid-cols-1 gap-4 md:grid-cols-3" data-testid={standalone?'grid-reviews':'carousel-reviews'}>{items.map(r=><ReviewCard key={r.id} review={r} standalone/>)}</div>:<div {...trackHandlers} ref={trackRef} className="overflow-x-auto overscroll-x-contain pb-2" data-testid="carousel-reviews" data-auto-scroll={autoScroll?'on':'off'}><div data-carousel-animation-track className={`flex w-max ${autoScroll?'nura-carousel-animation-track':''}`} style={{'--nura-carousel-duration':`${motion.speedSeconds}s`} as CSSProperties}><div className="flex gap-4 pr-4" data-carousel-loop-unit>{items.map(r=><ReviewCard key={r.id} review={r}/>)}</div>{autoScroll&&<div className="nura-carousel-clone flex gap-4 pr-4" aria-hidden="true" inert>{items.map(r=><ReviewCard key={`clone-${r.id}`} review={r}/>)}</div>}</div></div>}
   {!standalone&&<div className="mt-8 text-center"><Link to="/reviews" className="inline-flex min-h-11 items-center gap-2 border border-[#70806a] px-5 text-xs font-semibold text-[#55664f] hover:bg-white/60" data-testid="link-home-reviews">Read all customer reviews <ArrowRight size={14}/></Link></div>}</div></section>
}

function Newsletter({headingOverride,subheadingOverride}:{headingOverride?:string;subheadingOverride?:string}){
 const {data}=useAdminStore();
 const settings=data.content.newsletter;
 const eyebrow=settings.eyebrow||'Occasional notes';
 const title=settings.title||'Stay in touch';
 const copy=settings.copy||'Hear about new arrivals, useful updates, and considered offers. Replace this example with your own newsletter invitation.';
 const emailPlaceholder=settings.emailPlaceholder||'Your email address';
 const buttonText=settings.buttonText||'Subscribe';
 const [email,setEmail]=useState(''),[status,setStatus]=useState<'idle'|'success'|'error'>('idle');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{if(!functions)throw new Error('Supabase backend is not configured.');await protectForm();await httpsCallable(functions,'subscribeNewsletter')({email:email.trim()});setStatus('success');setEmail('');}catch(failure){setStatus('error');setError(failure instanceof Error?failure.message:'Subscription failed.');}finally{setBusy(false);}}
 const guaranteeIcons=[ShieldCheck,Check,Award];
 return <section className="bg-[#f4eee8] py-16 sm:py-20" data-testid="section-newsletter">
    <div className="page-wrap mx-auto max-w-2xl text-center"><span className="eyebrow">{eyebrow}</span><h2 className="serif mt-2 text-[42px] sm:text-[52px]" data-testid="text-newsletter-title">{headingOverride||title}</h2><p className="mt-3 text-sm text-[#766d64]">{subheadingOverride||copy}</p>
    <form onSubmit={submit} className="mx-auto mt-7 flex max-w-[460px] border-b border-[#aa9b8c]">
       <label className="sr-only" htmlFor="newsletter-email">Email address</label><input id="newsletter-email" type="email" required value={email} onChange={event=>{setEmail(event.target.value);setStatus('idle')}} placeholder={emailPlaceholder} className="flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-[#a59a8e]" data-testid="input-newsletter-email"/><button disabled={busy} className="flex items-center gap-2 px-3 text-xs font-semibold text-[#6B2447]" data-testid="button-newsletter-submit">{busy?'Saving…':buttonText} <ArrowRight size={15}/></button>
    </form>
    {status==='success'?<p className="mt-4 flex items-center justify-center gap-2 text-xs text-[#52654f]" role="status"><Check size={14}/> You are subscribed.</p>:status==='error'?<p role="alert" className="mt-4 text-xs text-[#9b3e4c]">{error}</p>:<p className="mt-4 text-[10px] text-[#988d82]">Receive occasional store updates. Unsubscribe at any time.</p>}
   </div>
   <div className="mt-12 bg-[#302b29] text-white" data-testid="newsletter-guarantee-strip"><div className="page-wrap grid grid-cols-1 gap-3 py-4 sm:grid-cols-3 sm:gap-5">{settings.guarantees.map((label,index)=>{const Icon=guaranteeIcons[index%guaranteeIcons.length];return <div key={`${label}-${index}`} className="flex items-center justify-center gap-2 text-[10px] font-medium tracking-wide sm:text-xs" data-testid={`newsletter-guarantee-${index}`}><Icon size={14} className="text-[#d5c7a3]" aria-hidden="true"/><span>{label}</span></div>})}</div></div>
 </section>;
}

export function ContactForm({heading,subheading}:{heading?:string;subheading?:string}={}){
 const [form,setForm]=useState({name:'',email:'',phone:'',message:''});
 const [sent,setSent]=useState(false);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  async function submit(event:FormEvent){event.preventDefault();setBusy(true);setSent(false);setError('');try{if(!functions)throw new Error('Supabase backend is not configured.');await protectForm();await httpsCallable(functions,'sendContactMessage')(cleanData(form));setForm({name:'',email:'',phone:'',message:''});setSent(true);}catch(failure){setError(failure instanceof Error?failure.message:'Message could not be sent.');}finally{setBusy(false);}}
  return <section className="bg-[var(--nura-background,#FDFBF7)] py-14"><div className="page-wrap grid gap-8 md:grid-cols-[.8fr_1.2fr] md:items-center">
    <div><span className="eyebrow">Contact</span><h2 className="serif mt-2 text-3xl sm:text-4xl">{heading||'Get in touch'}</h2><p className="mt-3 max-w-sm text-xs leading-6 text-[#766d64]">{subheading||'Contact our team for help with products or orders.'}</p></div>
     <form onSubmit={submit} className="nura-contact-form grid gap-3 sm:grid-cols-2">
       {(['name','email','phone'] as const).map(key=><label key={key} className="text-[10px] font-semibold">{key==='name'?'Your name':key==='email'?'Email address':'Phone (optional)'}<input required={key!=='phone'} type={key==='email'?'email':key==='phone'?'tel':'text'} maxLength={key==='name'?120:key==='email'?254:25} value={form[key]} onChange={event=>setForm({...form,[key]:event.target.value})} className="mt-1.5 h-11 w-full bg-[var(--nura-background,#FDFBF7)] px-3 text-xs font-normal" data-testid={`input-contact-${key}`}/></label>)}
       <label className="text-[10px] font-semibold sm:col-span-2">Message<textarea required maxLength={3000} rows={3} value={form.message} onChange={event=>setForm({...form,message:event.target.value})} className="mt-1.5 w-full bg-[var(--nura-background,#FDFBF7)] p-3 text-xs font-normal" data-testid="input-contact-message"/></label>
       <div className="flex flex-wrap items-center gap-4 sm:col-span-2"><button disabled={busy} className="nura-contact-submit min-h-11 px-6 text-xs font-semibold" data-testid="button-contact-submit">{busy?'Sending…':'Send message'}</button>{sent&&<span className="text-xs text-[#60705d]" role="status" data-testid="status-contact-sent">Your note has been received.</span>}{error&&<p role="alert" className="text-xs text-red-800">{error}</p>}</div>
    </form>
  </div></section>;
}

function CartDrawer({open,onClose}:{open:boolean;onClose:()=>void}){
 const {cart,cartSyncError,remove,quantity,subtotal}=useStore();
 useBodyScrollLock(open);
  const {data}=useAdminStore();
  const threshold=data.content.announcement.freeDeliveryThreshold;
  const promotions=calculatePromotionSummary(cart,data.deals,data.content.quantityDiscounts);
 useEffect(()=>{if(!open)return;const closeOnEscape=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose();};window.addEventListener('keydown',closeOnEscape);return()=>window.removeEventListener('keydown',closeOnEscape);},[open,onClose]);
 if(!open||typeof document==='undefined')return null;
 return createPortal(<div className="fixed inset-0 z-[10000] h-[100dvh] max-h-[100dvh]"><button aria-label="Close cart" onClick={onClose} className="absolute inset-0 bg-[#21191b]/45"/><aside className="absolute right-0 top-0 h-[100dvh] max-h-[100dvh] w-full max-w-[440px] bg-[#FDFBF7] flex flex-col shadow-2xl reveal">
  <div className="h-[76px] px-6 border-b border-[#e9e2d8] flex items-center justify-between"><div><span className="eyebrow">Your little collection</span><h2 className="serif text-xl mt-1">Your cart <span className="text-sm font-sans text-[#877b70]">({cart.reduce((n,i)=>n+i.quantity,0)})</span></h2></div><button aria-label="Close cart" onClick={onClose} className="p-2"><X size={20}/></button></div>
   {cartSyncError&&<p role="status" className="mx-6 mt-3 border border-[#e7d8cc] bg-[#f8f1e9] p-3 text-[11px] leading-5 text-[#77645c]">{cartSyncError}</p>}
    <div className="flex-1 overflow-auto px-6">{cart.length===0?<div className="h-full flex flex-col items-center justify-center text-center"><span className="w-16 h-16 rounded-full bg-[#e8ece1] grid place-items-center text-[#63725c]"><ShoppingBag size={23}/></span><h3 className="serif text-2xl mt-5">Room for something lovely.</h3><p className="text-xs text-[#81776e] mt-2">Your cart is waiting for a little something.</p><Link to="/shop" onClick={onClose} className="mt-6 bg-[#6B2447] text-white px-5 py-3 text-xs">Explore the edit</Link></div>:cart.map(item=><div key={item.key} className="flex gap-4 py-5 border-b border-[#e9e2d8]"><StoreImage src={item.product.image} mobileSrc={item.product.mobileImage} fallbackSources={item.product.images} alt={item.product.name} loading="lazy" decoding="async" className="w-[82px] h-[96px] object-contain object-center bg-[#eee5dc] mix-blend-multiply"/><div className="flex-1"><p className="eyebrow !text-[9px]">{item.product.category}</p><h3 className="text-sm font-medium mt-1">{item.product.name}</h3>{(item.product.variants?.length??0)>0&&<p className="text-[10px] text-[#83796f] mt-1">{item.variant}</p>}<p className="text-sm font-semibold mt-2">{formatPKR(item.product.price)}</p><div className="flex items-center justify-between mt-3"><div className="flex items-center border border-[#e4ddd4]"><button aria-label="Decrease quantity" onClick={()=>quantity(item.key,item.quantity-1)} className="p-1.5"><Minus size={12}/></button><span className="text-xs w-7 text-center">{item.quantity}</span><button aria-label="Increase quantity" onClick={()=>quantity(item.key,item.quantity+1)} className="p-1.5"><Plus size={12}/></button></div><button onClick={()=>remove(item.key)} className="text-[10px] text-[#8e777d] underline underline-offset-2">Remove</button></div></div></div>)}</div>
      {cart.length>0&&<div className="border-t border-[#e9e2d8] p-6"><div className="flex justify-between text-sm"><span>Subtotal</span><b>{formatPKR(subtotal)}</b></div>{promotions.quantityTierDiscount>0&&<div className="mt-2 flex justify-between text-[11px] text-[#60705d]" data-testid="drawer-quantity-tier-discount"><span>Buy more, save more</span><b>− {formatPKR(promotions.quantityTierDiscount)}</b></div>}{promotions.buyXGetYDiscount>0&&<div className="mt-2 flex justify-between text-[11px] text-[#60705d]"><span>Offers</span><b>− {formatPKR(promotions.buyXGetYDiscount)}</b></div>}<div className="mt-3 flex justify-between border-t border-[#e9e2d8] pt-3 text-sm"><span>Discounted subtotal</span><b>{formatPKR(promotions.discountedSubtotal)}</b></div><p className="text-[10px] text-[#81776e] mt-2">Delivery calculated at checkout. Complimentary delivery above {formatPKR(threshold)}.</p><Link to="/cart" onClick={onClose} className="mt-5 w-full bg-[#6B2447] text-white py-3.5 text-xs font-semibold flex items-center justify-center">Review cart</Link></div>}
  </aside></div>,document.body)
}

export function GlobalCartDrawer(){
  const {cartDrawerOpen,closeCartDrawer}=useStore();
  return <CartDrawer open={cartDrawerOpen} onClose={closeCartDrawer}/>;
}

export default function Storefront(){
  const {data,syncError}=useAdminStore();
  const {products}=useStore();
  const [selectedCategories,setSelectedCategories]=useState<string[]>([]);
  const clearCategory=()=>setSelectedCategories([]);
  const published=products.filter(isProductCustomerVisible);
  const orderedByPopularity=[...published].sort((a,b)=>(b.reviewCount??0)-(a.reviewCount??0)||(b.rating??0)-(a.rating??0)).slice(0,4);
  const orderedByDate=[...published].sort((a,b)=>(Date.parse(b.createdAt||'')||0)-(Date.parse(a.createdAt||'')||0)||b.id-a.id).slice(0,4);
  const setting=(id:HomeSectionId)=>data.content.homeSections.find(item=>item.id===id);
  const configuredSections=data.content.homeSections;
  const statisticsSetting=setting('statistics');
  const hasFeaturesSlot=configuredSections.some(item=>item.id==='features');
  const displaySections:HomeSectionSetting[]=[];
  for(const section of configuredSections){
    if(section.id==='announcement')continue;
    if(section.id==='features'){
      if(section.visible&&statisticsSetting?.visible)displaySections.push(statisticsSetting);
      continue;
    }
    if(section.id==='statistics'){
      if(!hasFeaturesSlot&&section.visible)displaySections.push(section);
      continue;
    }
    if(section.visible)displaySections.push(section);
  }
  const sections:Record<HomeSectionId,ReactNode>={
     announcement:<AnnouncementBar/>,
     hero:<Hero headingOverride={setting('hero')?.headingOverride} subheadingOverride={setting('hero')?.subheadingOverride}/>,
     promises:<PromiseStrip headingOverride={setting('promises')?.headingOverride} subheadingOverride={setting('promises')?.subheadingOverride}/>,
    categories:<Categories heading={setting('categories')?.headingOverride} subheading={setting('categories')?.subheadingOverride}/>,
    statistics:<HomepageMilestones/>,
    products:<Shop selectedCategories={selectedCategories} onCategoriesChange={setSelectedCategories} onClear={clearCategory} heading={setting('products')?.headingOverride} subheading={setting('products')?.subheadingOverride}/>,
    bestsellers:<ProductShelf carousel products={orderedByPopularity} title={setting('bestsellers')?.headingOverride||'Most Adored'} subheading={setting('bestsellers')?.subheadingOverride||'The pieces our clients return to'}/>,
     newArrivals:<ProductShelf products={orderedByDate} title={setting('newArrivals')?.headingOverride||'New arrivals'} subheading={setting('newArrivals')?.subheadingOverride||'Recently added products'} carousel carouselKey="newArrivalsCarousel"/>,
    offerBanner:<OfferBannerSection content={data.content.offerBanner} appearance={setting('offerBanner')?.appearance} headingOverride={setting('offerBanner')?.headingOverride} subheadingOverride={setting('offerBanner')?.subheadingOverride}/>,
     story:<Story headingOverride={setting('story')?.headingOverride} subheadingOverride={setting('story')?.subheadingOverride}/>,
    testimonials:<Reviews headingOverride={setting('testimonials')?.headingOverride} subheadingOverride={setting('testimonials')?.subheadingOverride}/>,
    instagram:<InstagramFeedSection items={data.content.instagramPosts} appearance={setting('instagram')?.appearance} heading={setting('instagram')?.headingOverride} subheading={setting('instagram')?.subheadingOverride}/>,
    mediaBanner:<CustomMediaBannerSection content={data.content.homeMediaBanner} appearance={setting('mediaBanner')?.appearance} headingOverride={setting('mediaBanner')?.headingOverride} subheadingOverride={setting('mediaBanner')?.subheadingOverride}/>,
    features:<FeatureGridSection items={data.content.featureCards} appearance={setting('features')?.appearance} heading={setting('features')?.headingOverride} subheading={setting('features')?.subheadingOverride} eyebrow={data.content.featureSectionSettings.eyebrow} tagline={data.content.featureSectionSettings.tagline} settings={data.content.featureSectionSettings}/>,
     faq:<FAQSection items={data.content.homeFaq.filter(item=>item.question.trim()||item.answer.trim())} appearance={setting('faq')?.appearance} heading={setting('faq')?.headingOverride} subheading={setting('faq')?.subheadingOverride}/>,
    newsletter:<Newsletter headingOverride={setting('newsletter')?.headingOverride} subheadingOverride={setting('newsletter')?.subheadingOverride}/>,
    contact:<ContactForm heading={setting('contact')?.headingOverride} subheading={setting('contact')?.subheadingOverride}/>,
    footer:<StoreFooter/>,
  };
  const themeBackground=data.content.theme.background||'#FDFBF7';
  const themePrimary=data.content.theme.primary||'#4A2837';
  const softThemeSurface=`color-mix(in srgb, ${themeBackground} 92%, ${themePrimary})`;
  const sectionBackgrounds:Record<HomeSectionId,string>={
     announcement:themePrimary,hero:themeBackground,promises:data.content.theme.trustBadgeBackground,categories:themeBackground,statistics:softThemeSurface,products:softThemeSurface,bestsellers:themeBackground,newArrivals:themeBackground,
    offerBanner:data.content.offerBanner.backgroundColor,story:themeBackground,testimonials:softThemeSurface,instagram:themeBackground,mediaBanner:themeBackground,features:softThemeSurface,faq:themeBackground,newsletter:softThemeSurface,contact:softThemeSurface,footer:themePrimary,
  };
  const sectionStyle=(section:HomeSectionSetting)=>({
    '--nura-home-section-background':section.appearance.backgroundColor||sectionBackgrounds[section.id],
    '--nura-home-section-border-color':section.appearance.borderColor,
    '--nura-home-section-border-width':`${section.appearance.borderWidthPx}px`,
    '--nura-home-section-border-opacity':`${section.appearance.borderOpacity}`,
    '--nura-home-section-radius':`${section.appearance.borderRadiusPx}px`,
    '--home-heading-size':section.appearance.headingFontSizePx?`${section.appearance.headingFontSizePx}px`:undefined,
    '--home-body-size':section.appearance.bodyFontSizePx?`${section.appearance.bodyFontSizePx}px`:undefined,
    textAlign:section.appearance.alignment==='default'?undefined:section.appearance.alignment,
  } as CSSProperties);
  return <div className="nura-storefront min-h-[100dvh]">{data.content.homeSections.find(section=>section.id==='announcement')?.visible&&<AnnouncementBar/>}<MarqueeBars placement="top"/><StorefrontHeader/><MarqueeBars placement="below-header"/>{syncError&&<p className="page-wrap py-4 text-xs text-red-800" role="alert">{syncError}</p>}<main>{displaySections.map(section=><div key={section.id}><div className="nura-home-section-frame" data-home-section={section.id} data-home-animations={data.content.homeAnimations?'on':'off'} data-home-alignment={section.appearance.alignment==='default'?undefined:section.appearance.alignment} data-custom-heading-size={section.appearance.headingFontSizePx>0?'true':undefined} data-custom-body-size={section.appearance.bodyFontSizePx>0?'true':undefined} data-testid={`home-section-${section.id}`} style={sectionStyle(section)}>{sections[section.id]}</div><MarqueeBars placement="custom" sectionId={section.id}/></div>)}</main><MarqueeBars placement="footer"/><MarqueeBars placement="floating"/><MobileBottomNav/></div>;
}