import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, Store } from 'lucide-react';
import { useAdminStore } from '../context/AdminContext';
import StoreImage from './StoreImage';
import MobileNavDrawer from './MobileNavDrawer';
import HeaderActionIcons from './HeaderActionIcons';
import { configuredStoreName } from '../utils/branding';

export default function StorefrontHeader() {
  const {data}=useAdminStore();
  const [open,setOpen]=useState(false);
  const close=useCallback(()=>setOpen(false),[]);
  const storeName=configuredStoreName(data.settings.general.storeName);
  const storeSubtitle=data.settings.general.storeSubtitle.trim();
  const logoUrl=data.settings.general.storeLogoUrl.trim();
  const alignment=data.settings.headerLogoAlignment;
  useEffect(()=>{
    const icon=document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
    const target=icon??document.head.appendChild(Object.assign(document.createElement('link'),{rel:'icon'}));
    target.href=data.settings.general.faviconUrl||'/favicon.svg';
    if(data.settings.general.faviconUrl)target.removeAttribute('type');
    else target.type='image/svg+xml';
  },[data.settings.general.faviconUrl]);
  const links=data.content.navigation.desktopLinks.filter(item=>item.visible&&item.label.trim()&&item.label.trim().toLowerCase()!=='new link').sort((a,b)=>a.order-b.order);
  return <>
    <header className="sticky top-0 z-30 border-b border-[#e9e2d8] bg-[#FDFBF7]/95 backdrop-blur">
      <div className="page-wrap grid min-h-[68px] grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-1 py-2 sm:min-h-[76px] sm:gap-2 xl:min-h-[76px] xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] xl:gap-5 xl:py-3">
        <button type="button" className="col-start-1 row-start-1 grid h-10 w-9 shrink-0 place-items-center rounded-full hover:bg-[#f2ede5] xl:hidden" aria-label="Open navigation" aria-controls="mobile-nav-drawer" aria-expanded={open} onClick={()=>setOpen(true)}><Menu size={20}/></button>
        <Link to="/" aria-label={storeName||'Home'} data-testid="link-nura-home" className={`col-start-2 row-start-1 flex min-w-0 flex-col leading-none text-[var(--nura-primary,#6B2447)] ${alignment==='left'?'items-start text-left xl:col-start-1 xl:justify-self-start':alignment==='right'?'items-end text-right xl:col-start-3 xl:justify-self-end':'items-center text-center xl:col-start-2 xl:justify-self-center'}`}>
          <span className="nura-wordmark-row inline-flex w-max min-w-0 max-w-full flex-nowrap items-baseline gap-[2px]">
            {logoUrl?<StoreImage src={logoUrl} alt={storeName?`${storeName} logo`:'Store logo'} className="block h-10 max-w-[180px] shrink-0 object-contain" data-testid="img-store-logo"/>:storeName?<span className={`nura-wordmark-name serif block min-w-0 max-w-full text-[30px] font-extrabold tracking-[-.05em]${storeName.length>8?' nura-wordmark-name-long':''}`} data-testid="wordmark-name">{storeName}</span>:<Store aria-hidden="true" size={20} className="shrink-0"/>}
            {(logoUrl||storeName)&&<span className="nura-logo-dot inline-block text-[30px] leading-none" data-testid="brand-logo-dot" aria-hidden="true"/>}
          </span>
          {storeSubtitle&&<span className="mt-1 block min-w-0 max-w-full truncate text-[9px] tracking-[.08em]" data-testid="text-store-subtitle" data-theme-role="tagline">{storeSubtitle}</span>}
        </Link>
        <nav className={`hidden min-w-0 items-center gap-3 text-[10px] font-medium text-[#564d46] xl:row-start-1 xl:flex xl:gap-3 2xl:gap-5 xl:text-[12px] ${alignment==='left'?'xl:col-start-2 xl:justify-self-center':alignment==='right'?'xl:col-start-1 xl:justify-self-start':'xl:col-start-1 xl:justify-self-end'}`} aria-label="Main navigation" data-testid="storefront-desktop-navigation">
          {links.map(item=>{
            const id=item.id==='categories'?'link-nav-collections':`link-nav-${item.id}`;
            return /^https?:\/\//i.test(item.href)?<a key={item.id} href={item.href} target="_blank" rel="noreferrer" className="nura-header-link" data-testid={id}>{item.label}</a>:/^(mailto:|tel:)/i.test(item.href)?<a key={item.id} href={item.href} className="nura-header-link" data-testid={id}>{item.label}</a>:<Link key={item.id} to={item.href} className="nura-header-link" data-testid={id}>{item.label}</Link>;
          })}
        </nav>
        <div className={`col-start-3 row-start-1 min-w-0 max-w-[44vw] justify-self-end xl:row-start-1 xl:max-w-[min(42vw,520px)] ${alignment==='right'?'xl:col-start-2 xl:justify-self-center':'xl:col-start-3 xl:justify-self-end'}`}><HeaderActionIcons/></div>
      </div>
    </header>
    <MobileNavDrawer open={open} onClose={close}/>
  </>;
}
