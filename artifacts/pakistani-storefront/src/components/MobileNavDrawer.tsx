import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, ChevronDown, ChevronLeft, ChevronRight, Grid2X2, Heart, Package, RotateCcw, Search, ShoppingBag, Truck, UserRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAdminStore } from '../context/AdminContext';
import { useStore } from '../context/StoreContext';
import { categoryRoute } from '../utils/categoryRoutes';
import { useBodyScrollLock } from '../hooks/use-body-scroll-lock';
import { configuredStoreName } from '../utils/branding';
import StoreImage from './StoreImage';

const icons:Record<string,typeof ShoppingBag>={
  bag:ShoppingBag,grid:Grid2X2,heart:Heart,user:UserRound,truck:Truck,package:Package,
  'book-open':BookOpen,'rotate-ccw':RotateCcw,
};

export default function MobileNavDrawer({open,onClose}:{open:boolean;onClose:()=>void}){
  const panelRef=useRef<HTMLElement>(null);
  const [mounted,setMounted]=useState(open);
  const [search,setSearch]=useState('');
  const [categoriesOpen,setCategoriesOpen]=useState(false);
  useEffect(()=>{
    if(open){setMounted(true);return;}
    const timer=window.setTimeout(()=>setMounted(false),280);
    return()=>window.clearTimeout(timer);
  },[open]);
  const visible=mounted||open;
  useBodyScrollLock(visible);
  const {data}=useAdminStore();
  const storeName=configuredStoreName(data.settings.general.storeName);
  const storeLogoUrl=data.settings.general.storeLogoUrl.trim();
  const storeSubtitle=data.settings.general.storeSubtitle.trim();
  const {categories}=useStore();
  const settings=data.content.navigation.drawer;
  const navigate=useNavigate();
  const width=settings.widthMode==='custom'?`${Math.max(240,Math.min(320,settings.customWidthPx))}px`:settings.widthMode;
  const panelStyle:CSSProperties={
    width,maxWidth:'min(80vw, 320px)',
    background:settings.backgroundMode==='gradient'?'var(--nura-primary-fill,linear-gradient(135deg,#4A2837,#6B2447))':'var(--nura-background,#FDFBF7)',
    fontSize:Math.max(12,Math.min(24,settings.fontSizePx)),
    fontWeight:settings.fontWeight==='bold'?700:settings.fontWeight==='medium'?500:400,
    letterSpacing:`${Math.max(0,Math.min(3,settings.letterSpacingPx))}px`,
  };
  useEffect(()=>{
    if(!open||!mounted)return;
    const previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const focusable=()=>Array.from(panelRef.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])')??[]);
    focusable()[0]?.focus();
    const desktop=window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop=()=>{if(desktop.matches)onClose();};
    const onKeyDown=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){onClose();return;}
      if(event.key!=='Tab')return;
      const items=focusable();if(!items.length)return;
      if(event.shiftKey&&document.activeElement===items[0]){event.preventDefault();items.at(-1)?.focus();}
      else if(!event.shiftKey&&document.activeElement===items.at(-1)){event.preventDefault();items[0]?.focus();}
    };
    window.addEventListener('keydown',onKeyDown);desktop.addEventListener('change',closeOnDesktop);
    return()=>{window.removeEventListener('keydown',onKeyDown);desktop.removeEventListener('change',closeOnDesktop);if(previousFocus?.isConnected)previousFocus.focus();};
  },[open,mounted,onClose]);
  function submitSearch(event:FormEvent<HTMLFormElement>){
    event.preventDefault();const query=search.trim();if(!query)return;
    onClose();navigate(`/shop?q=${encodeURIComponent(query)}`);
  }
  if(!visible||typeof document==='undefined')return null;
  const items=[...settings.items].filter(item=>item.visible&&item.label.trim()&&item.href.trim()).sort((a,b)=>a.order-b.order);
  const legacyTestIds:Record<string,string>={shop:'mobile-link-shop',collections:'mobile-link-collections',about:'mobile-link-about',reviews:'mobile-link-reviews','track-order':'mobile-link-track-order',account:'mobile-link-account',shipping:'mobile-link-shipping',returns:'mobile-link-returns'};
  return createPortal(<div className={`nura-mobile-drawer-shell fixed inset-0 z-[10001] h-[100dvh] max-h-[100dvh] lg:hidden ${open?'is-open':''}`} data-testid="mobile-nav-drawer" aria-hidden={!open} inert={!open}>
    <button type="button" className="nura-mobile-drawer-scrim absolute inset-0 bg-black/40 backdrop-blur-md" aria-label="Close navigation menu" onClick={onClose}/>
    <aside id="mobile-nav-drawer" ref={panelRef} role="dialog" aria-modal={open?'true':undefined} aria-labelledby="mobile-nav-title" className="nura-mobile-drawer-panel absolute inset-y-0 left-0 flex h-[100dvh] max-h-[100dvh] flex-col overflow-y-auto px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] shadow-2xl" style={panelStyle}>
      <header className="flex items-center justify-between border-b border-[#e8e1d7] pb-4">
        <div className="min-w-0"><div className="nura-wordmark-row inline-flex max-w-full items-baseline gap-[2px] text-[var(--nura-primary,#4A2837)]">{storeLogoUrl?<StoreImage src={storeLogoUrl} alt={storeName?`${storeName} logo`:'Store logo'} className="block h-10 max-w-[180px] object-contain"/>:<p className="serif max-w-full truncate text-[25px] font-semibold leading-none tracking-[-.06em]">{storeName||'Online shop'}</p>}{(storeLogoUrl||storeName)&&<span className="nura-logo-dot text-[25px]" data-testid="mobile-menu-brand-dot" aria-hidden="true"/>}</div>{storeSubtitle&&<p className="mt-1 truncate text-[9px] tracking-[.08em]" data-theme-role="tagline">{storeSubtitle}</p>}<h2 id="mobile-nav-title" className="mt-1 text-[9px] font-medium uppercase tracking-[.2em] text-[#81766c]">Browse products</h2></div>
        <button type="button" onClick={onClose} aria-label="Close navigation menu" className="grid h-11 w-11 place-items-center rounded-full border border-[#e8e1d7] text-[#51443d] transition-colors hover:bg-white/80"><span className="sr-only">Close menu</span><ChevronLeft size={20}/></button>
      </header>
      {settings.showSearch&&<form onSubmit={submitSearch} role="search" className="mt-5">
        <label htmlFor="mobile-menu-search" className="sr-only">Search products</label>
        <div className="flex min-h-12 items-center gap-3 rounded-xl border border-[#e4dbd1] bg-white/70 px-3 focus-within:border-[#6b2447] focus-within:ring-2 focus-within:ring-[#6b2447]/15">
          <Search size={17} className="shrink-0 text-[#766d63]" aria-hidden="true"/>
          <input id="mobile-menu-search" type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search products" autoComplete="off" data-testid="input-mobile-menu-search" className="min-w-0 flex-1 bg-transparent py-3 text-sm text-[#392e2a] outline-none placeholder:text-[#93877b]"/>
          <button type="submit" aria-label="Search products" disabled={!search.trim()} data-testid="button-mobile-menu-search" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[#6b2447] hover:bg-[#f3e9ee] disabled:opacity-40"><ChevronRight size={18}/></button>
        </div>
      </form>}
      <nav className="mt-5 flex flex-col" aria-label="Mobile navigation" style={{gap:settings.rowSpacingPx}}>
        {items.map(item=>{
          const Icon=icons[item.icon]||ShoppingBag;
          const content=<><span className={`nura-drawer-link-icon ${settings.iconStyle==='circle'?'is-circle':''} ${settings.iconStyle==='none'?'is-hidden':''}`}><Icon size={17} strokeWidth={1.5}/></span><span>{item.label}</span></>;
          const className="nura-mobile-drawer-link";
          return /^https?:\/\//i.test(item.href)||/^(mailto:|tel:)/i.test(item.href)
            ?<a key={item.id} href={item.href} onClick={onClose} className={className} target={/^https?:\/\//i.test(item.href)?'_blank':undefined} rel={/^https?:\/\//i.test(item.href)?'noreferrer':undefined} data-testid={legacyTestIds[item.id]||`link-mobile-menu-${item.id}`}>{content}</a>
            :<Link key={item.id} to={item.href} onClick={onClose} className={className} data-testid={legacyTestIds[item.id]||`link-mobile-menu-${item.id}`}>{content}</Link>;
        })}
      </nav>
      {settings.showCategories&&<section className="mt-5 border-t border-[#e8e1d7] pt-3" aria-label="Shop by category" data-testid="drawer-categories-section">
        <button type="button" onClick={()=>setCategoriesOpen(value=>!value)} aria-expanded={categoriesOpen} aria-controls="mobile-drawer-categories" data-testid="button-mobile-drawer-categories" className="flex min-h-12 w-full items-center justify-between px-1 text-left text-[#4f443e]">
          <span className="flex items-center gap-3 font-semibold"><Grid2X2 size={17} strokeWidth={1.5}/>Shop by category</span>
          <ChevronDown size={18} className={`transition-transform duration-300 ${categoriesOpen?'rotate-180':''}`} aria-hidden="true"/>
        </button>
        {categoriesOpen&&<div id="mobile-drawer-categories" className="mt-1 flex max-h-[38vh] flex-col overflow-y-auto" data-testid="list-mobile-drawer-categories">
          {categories.length?categories.map(category=><Link key={category.id} to={categoryRoute(category,categories)} onClick={onClose} className="nura-mobile-drawer-link nura-mobile-drawer-category" data-testid={`link-mobile-category-${category.id}`}>{category.name}</Link>)
            :<p className="px-1 py-4 text-sm leading-6 text-[#766d63]" role="status">Categories are being prepared. Please check back shortly.</p>}
        </div>}
      </section>}
    </aside>
  </div>,document.body);
}
