import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { CircleHelp, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAdminStore } from '../context/AdminContext';
import { useStore } from '../context/StoreContext';
import { categoryRoute } from '../utils/categoryRoutes';
import { floatingWidgetIcons } from '../utils/floatingWidgetIcons';
import { isCouponEligible } from '../utils/coupons';
import { useBodyScrollLock } from '../hooks/use-body-scroll-lock';

function isPopupWidget(widget:{kind:string;offerAction?:string}){
  return (widget.kind==='offer'&&widget.offerAction==='popup')||['faq','coupon','flash-sale'].includes(widget.kind);
}
function safeContactTarget(channel:string,target:string,fallbackPhone:string){
  const value=target.trim();
  if(/^https?:\/\//i.test(value))return value;
  if(channel==='phone'){
    const phone=(value||fallbackPhone).replace(/[^\d+]/g,'');
    return phone?`tel:${phone}`:'';
  }
  if(channel==='whatsapp'){
    const phone=value.replace(/\D/g,'');
    return phone?`https://wa.me/${phone}`:'https://wa.me/';
  }
  const normalized=value.replace(/^@/,'');
  if(channel==='instagram')return normalized?`https://instagram.com/${normalized}`:'https://instagram.com/';
  if(channel==='facebook')return normalized?`https://facebook.com/${normalized}`:'https://facebook.com/';
  if(channel==='x')return normalized?`https://x.com/${normalized}`:'https://x.com/';
  return value;
}
function safeFaqTarget(target:string){
  const value=target.trim();
  return (value.startsWith('/')&&!value.startsWith('//'))||/^https?:\/\//i.test(value)?value:'/shop';
}
function countdownLabel(expiresAt:string,now:number){
  const expiry=Date.parse(expiresAt);
  if(!Number.isFinite(expiry)||expiry<=now)return '';
  const seconds=Math.floor((expiry-now)/1000);
  const days=Math.floor(seconds/86400),hours=Math.floor(seconds%86400/3600),minutes=Math.floor(seconds%3600/60);
  return days>0?`${days}d ${hours}h`:hours>0?`${hours}h ${minutes}m`:`${minutes}m`;
}
function routeAllowed(pathname:string,routes:string[]){
  if(routes.length===0)return true;
  return routes.some(route=>route==='/'?pathname==='/':pathname===route||pathname.startsWith(`${route.replace(/\/$/,'')}/`));
}
function focusStorefrontFallback(){
  let observer:MutationObserver|null=null;
  const focusTarget=()=>{
    const target=document.querySelector<HTMLElement>(
      '[data-storefront-focus-fallback], main:not([data-route-loading-fallback]), [role="main"]:not([data-route-loading-fallback])',
    );
    if(!target)return false;
    if(!target.hasAttribute('tabindex'))target.setAttribute('tabindex','-1');
    target.focus();
    observer?.disconnect();
    observer=null;
    return true;
  };
  if(!focusTarget()){
    observer=new MutationObserver(focusTarget);
    observer.observe(document.body,{childList:true,subtree:true});
  }
  return ()=>observer?.disconnect();
}

export default function FloatingWidgets(){
  const {data,storefrontSettingsState}=useAdminStore();
  const {categories}=useStore();
  const location=useLocation();
  const [offerOpen,setOfferOpen]=useState('');
  const [couponCopyMessage,setCouponCopyMessage]=useState('');
  const [now,setNow]=useState(Date.now());
  const [mobileStackSteps,setMobileStackSteps]=useState<Record<string,number>>({});
  const [compactLandscape,setCompactLandscape]=useState(false);
  const popupTriggerRef=useRef<HTMLButtonElement|null>(null);
  const popupTriggerPathRef=useRef(location.pathname);
  const popupNavigationPendingRef=useRef(false);
  const popupDialogRef=useRef<HTMLElement|null>(null);
  const activeCoupon=data.coupons.find(coupon=>isCouponEligible(coupon,now));
  const suppressedRoute=/^\/(admin|cart|checkout|account|track-order|order-success)(\/|$)/.test(location.pathname);
  const visible=useMemo(()=>suppressedRoute?[]:data.content.floatingWidgets.widgets.filter(widget=>widget.visible&&widget.id!=='offer-badge'&&widget.label.trim().toLocaleLowerCase()!=='a little offer'&&routeAllowed(location.pathname,widget.visibleOnRoutes)),[data.content.floatingWidgets.widgets,location.pathname,suppressedRoute]);
  const floatingDock=data.content.navigation.mobileBottomBar.dock.orientation==='floating-left'
    ||data.content.navigation.mobileBottomBar.dock.orientation==='floating-right';
  const hasLargeSingleStack=visible.length>4&&new Set(visible.map(widget=>widget.position)).size===1;
  useEffect(()=>{
    if(typeof window==='undefined')return;
    const updateStackSteps=()=>{
      const rootStyle=getComputedStyle(document.documentElement);
      const navReserved=floatingDock&&hasLargeSingleStack
        ?80
        :Number.parseFloat(rootStyle.getPropertyValue('--nura-mobile-nav-reserved'))||0;
      const safeAreaBottom=Number.parseFloat(rootStyle.getPropertyValue('--nura-safe-area-bottom'))||0;
      const isCompactLandscape=window.innerWidth<=767&&window.innerHeight<=400&&window.innerWidth>window.innerHeight;
      setCompactLandscape(previous=>previous===isCompactLandscape?previous:isCompactLandscape);
      const groups=new Map<string,{count:number;maxOffset:number}>();
      visible.forEach(widget=>{
        const group=groups.get(widget.position)||{count:0,maxOffset:0};
        group.count+=1;
        group.maxOffset=Math.max(group.maxOffset,widget.mobileOffsetY);
        groups.set(widget.position,group);
      });
      const available=window.innerHeight-safeAreaBottom-Math.max(80,navReserved)-8-64;
      const nextSteps:Record<string,number>={};
      groups.forEach((group,position)=>{
        const columns=isCompactLandscape&&groups.size===1&&group.count>4?2:1;
        const rows=Math.ceil(group.count/columns);
        nextSteps[position]=group.count>1
          ?Math.min(80,Math.max(48,(available-group.maxOffset)/(rows-1)))
          :80;
      });
      setMobileStackSteps(previous=>{
        const positions=Object.keys(nextSteps);
        if(positions.length===Object.keys(previous).length&&positions.every(position=>previous[position]===nextSteps[position]))return previous;
        return nextSteps;
      });
    };
    updateStackSteps();
    window.addEventListener('resize',updateStackSteps);
    window.visualViewport?.addEventListener('resize',updateStackSteps);
    const observer=new MutationObserver(updateStackSteps);
    observer.observe(document.documentElement,{attributes:true,attributeFilter:['style']});
    return()=>{
      window.removeEventListener('resize',updateStackSteps);
      window.visualViewport?.removeEventListener('resize',updateStackSteps);
      observer.disconnect();
    };
  },[visible,floatingDock,hasLargeSingleStack]);
  const offer=visible.find(widget=>widget.id===offerOpen&&isPopupWidget(widget));
  const faqItems=data.content.homeFaq.filter(item=>item.question.trim()||item.answer.trim());
  useEffect(()=>{
    const hasCountdown=data.content.floatingWidgets.widgets.some(widget=>widget.countdownEnabled&&widget.expiresAt);
    if(!hasCountdown&&offer?.kind!=='coupon')return;
    const timer=window.setInterval(()=>setNow(Date.now()),offer?.kind==='coupon'?15000:60000);
    return()=>window.clearInterval(timer);
  },[data.content.floatingWidgets.widgets,offer?.kind]);
  const positions=new Map<string,number>();
  const groupCounts=new Map<string,number>();
  visible.forEach(widget=>groupCounts.set(widget.position,(groupCounts.get(widget.position)||0)+1));
  const hasMultiplePositions=groupCounts.size>1;
  const compactLandscapeMultiplePositions=compactLandscape&&hasMultiplePositions;
  const positioned=visible.map(widget=>{
    const stackIndex=positions.get(widget.position)||0;
    positions.set(widget.position,stackIndex+1);
    const columns=compactLandscape&&groupCounts.size===1&&groupCounts.get(widget.position)!>4?2:1;
    const rows=Math.ceil(groupCounts.get(widget.position)!/columns);
    let column=columns===2&&stackIndex>=rows?1:0;
    let row=columns===2&&column===1?stackIndex-rows:stackIndex;
    if(compactLandscapeMultiplePositions){
      const savedSide=widget.position.endsWith('-left')?'left':widget.position.endsWith('-right')?'right':'center';
      column=savedSide==='center'?0
        :data.content.navigation.mobileBottomBar.dock.orientation==='floating-right'
          ?savedSide==='right'?1:0
          :savedSide==='left'?1:0;
      row=stackIndex;
    }
    return {widget,stackIndex,column,row};
  });
  function targetFor(widget:typeof visible[number]){
    if(widget.kind==='contact')return safeContactTarget(widget.channel||'whatsapp',widget.target,data.content.contact.phone);
    if(widget.kind==='track-order')return widget.target||'/track-order';
    if(widget.kind==='offer'&&widget.offerAction==='category'){
      const category=categories.find(item=>item.id===widget.categoryId);
      return category?categoryRoute(category,categories):'/collections';
    }
    if(widget.kind==='review')return widget.target||'/reviews';
    if(widget.kind==='faq')return widget.target||'/shop';
    return widget.target||'/shop';
  }
  const popupTarget=offer?.kind==='faq'?safeFaqTarget(offer.target):'';
  function closePopupForNavigation(){
    const sourcePath=popupTriggerPathRef.current;
    popupNavigationPendingRef.current=true;
    setOfferOpen('');
    window.setTimeout(()=>{
      if(!popupNavigationPendingRef.current||window.location.pathname!==sourcePath)return;
      popupNavigationPendingRef.current=false;
      const trigger=popupTriggerRef.current;
      if(trigger?.isConnected)trigger.focus();
      popupTriggerRef.current=null;
    },0);
  }
  function styleFor(widget:typeof visible[number],stackIndex:number):CSSProperties{
    const vertical=widget.position.startsWith('middle-');
    const center=widget.position==='bottom-center';
    const style:CSSProperties={
      position:'fixed',zIndex:9998,
      left:widget.position==='bottom-left'||widget.position==='middle-left'?`var(--nura-widget-x,16px)`:center?'50%':'auto',
      right:widget.position==='bottom-right'||widget.position==='middle-right'?`var(--nura-widget-x,16px)`:'auto',
      top:vertical?'50%':'auto',
      bottom:vertical?'auto':'var(--nura-widget-bottom)',
      transform:vertical?'translateY(calc(-50% + var(--nura-widget-offset-y, 0px)))':center?'translateX(-50%)':undefined,
      '--nura-widget-mobile-x':`${widget.mobileOffsetX}px`,
      '--nura-widget-mobile-y':`${widget.mobileOffsetY+stackIndex*(mobileStackSteps[widget.position]??80)}px`,
      '--nura-widget-nav-reserved':floatingDock&&groupCounts.size===1&&groupCounts.get(widget.position)!>4?'80px':undefined,
      '--nura-widget-desktop-x':`${widget.desktopOffsetX}px`,
      '--nura-widget-desktop-y':`${widget.desktopOffsetY+stackIndex*62}px`,
      backgroundColor:/^(?:#4a2837|#6b2447)$/i.test(widget.color)?'var(--nura-primary-fill,var(--nura-primary,#4A2837))':widget.color,
      color:/^(?:#fdfbf7|#fffaf4)$/i.test(widget.textColor||'#FDFBF7')?'var(--nura-primary-contrast,#FDFBF7)':widget.textColor||'#FDFBF7',
      border:'1px solid var(--nura-gold,#C6A15B)',
    } as CSSProperties;
    return style;
  }
  useBodyScrollLock(Boolean(offer));
  useEffect(()=>{
    if(!offer){
      const trigger=popupTriggerRef.current;
      let cancelPendingFocus=()=>{};
      if(trigger?.isConnected&&popupNavigationPendingRef.current&&popupTriggerPathRef.current===location.pathname)return;
      if(trigger){
        if(trigger.isConnected)trigger.focus();
        else cancelPendingFocus=focusStorefrontFallback();
        popupTriggerRef.current=null;
        popupNavigationPendingRef.current=false;
        setOfferOpen('');
      }
      return cancelPendingFocus;
    }
    const dialog=popupDialogRef.current;
    const initialFocus=dialog?.querySelector<HTMLElement>('[data-popup-initial-focus]');
    (initialFocus||dialog)?.focus();
    const handleDialogKeyDown=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){
        event.preventDefault();
        setOfferOpen('');
        return;
      }
      if(event.key!=='Tab'||!dialog)return;
      const focusable=Array.from(dialog.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
      )).filter(element=>element.getClientRects().length>0);
      if(focusable.length===0){
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first=focusable[0],last=focusable[focusable.length-1];
      if(event.shiftKey&&(document.activeElement===first||!dialog.contains(document.activeElement))){
        event.preventDefault();
        last.focus();
      }else if(!event.shiftKey&&(document.activeElement===last||!dialog.contains(document.activeElement))){
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown',handleDialogKeyDown);
    return()=>window.removeEventListener('keydown',handleDialogKeyDown);
  },[offer?.id,location.pathname]);
  if(storefrontSettingsState!=='ready')return null;
  return <>
    {typeof document!=='undefined'&&createPortal(positioned.map(({widget,stackIndex,column,row})=>{
      const Icon:LucideIcon=floatingWidgetIcons[widget.icon]||CircleHelp;
      const target=targetFor(widget);
      const timer=widget.countdownEnabled&&widget.expiresAt?countdownLabel(widget.expiresAt,now):'';
      const label=widget.kind==='offer'&&timer?`${widget.label} · ${timer}`:widget.label;
      const className=`nura-floating-widget ${widget.animation==='pulse'?'nura-offer-pulse':''} ${widget.animation==='bounce'?'nura-widget-bounce':''} ${widget.animation==='glow'?'nura-widget-glow':''}`;
      const style=styleFor(widget,compactLandscape&&groupCounts.size===1&&groupCounts.get(widget.position)!>4?row:stackIndex);
      const shape=widget.shape||'pill';
        const contents=<><span className="nura-floating-widget-icon" aria-hidden="true">{widget.customImageUrl?<img src={widget.customImageUrl} alt="" loading="lazy" decoding="async"/>:<Icon size={18}/>}</span><span className="nura-floating-widget-label">{label}</span></>;
        const stackAttributes={
          'data-mobile-stack-column':column,
          'data-mobile-stack-row':row,
          'data-mobile-stack-needs-room':groupCounts.get(widget.position)!>4||compactLandscapeMultiplePositions,
          'data-mobile-multi-position':hasMultiplePositions,
          'data-mobile-saved-position':widget.position,
        };
        if(isPopupWidget(widget))return <button key={widget.id} type="button" onClick={event=>{popupTriggerRef.current=event.currentTarget;popupTriggerPathRef.current=location.pathname;popupNavigationPendingRef.current=false;setNow(Date.now());setCouponCopyMessage('');setOfferOpen(widget.id);}} aria-label={label} className={`${className} inline-flex min-h-12 items-center gap-2 px-4 text-xs font-semibold text-white shadow-lg transition-transform hover:-translate-y-0.5`} style={style} data-icon={widget.icon} data-shape={shape} data-mobile-dock-orientation={data.content.navigation.mobileBottomBar.dock.orientation} {...stackAttributes} data-testid={widget.id==='offer-badge'?'floating-offer-badge':`floating-widget-${widget.id}`}>{contents}</button>;
        return target.startsWith('/')?<Link key={widget.id} to={target} aria-label={label} className={`${className} inline-flex min-h-12 items-center gap-2 px-4 text-xs font-semibold text-white shadow-lg transition-transform hover:-translate-y-0.5`} style={style} data-icon={widget.icon} data-shape={shape} data-mobile-dock-orientation={data.content.navigation.mobileBottomBar.dock.orientation} {...stackAttributes} data-testid={widget.id==='contact-whatsapp'?'floating-contact-widget':widget.id==='offer-badge'?'floating-offer-badge':`floating-widget-${widget.id}`}>{contents}</Link>
          :<a key={widget.id} href={target} aria-label={label} target={/^https?:\/\//i.test(target)?'_blank':undefined} rel="noreferrer" className={`${className} inline-flex min-h-12 items-center gap-2 px-4 text-xs font-semibold text-white shadow-lg transition-transform hover:-translate-y-0.5`} style={style} data-icon={widget.icon} data-shape={shape} data-mobile-dock-orientation={data.content.navigation.mobileBottomBar.dock.orientation} {...stackAttributes} data-testid={widget.id==='contact-whatsapp'?'floating-contact-widget':`floating-widget-${widget.id}`}>{contents}</a>;
    }),document.body)}
    {offer&&typeof document!=='undefined'&&createPortal(<div className="fixed inset-0 z-[10000] flex h-[100dvh] max-h-[100dvh] items-start justify-center overflow-y-auto overscroll-contain bg-[#21191b]/45 p-2 sm:items-center sm:p-4" role="presentation" onClick={event=>{if(event.target===event.currentTarget)setOfferOpen('');}}>
      <section ref={popupDialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="floating-offer-title" className="relative my-auto max-h-[calc(100dvh-1rem)] w-full max-w-sm overflow-y-auto overscroll-contain rounded-2xl bg-[#fdfbf7] p-5 shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:p-6">
        <button type="button" data-popup-initial-focus onClick={()=>setOfferOpen('')} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full text-[#665b55] hover:bg-[#f0ebe4]" aria-label="Close popup"><X size={18}/></button>
        <span className="eyebrow">{offer.kind==='faq'?'Helpful answers':offer.kind==='coupon'?'A little saving':offer.kind==='flash-sale'?'Limited-time offer':'A little something for you'}</span><h2 id="floating-offer-title" className="serif mt-2 text-2xl text-[#6b2447]">{offer.label}</h2>
        {offer.kind==='faq'&&<div className="mt-4 space-y-3">{faqItems.length?faqItems.map(item=><article key={item.id} className="break-words border-b border-[#e8dfd4] pb-3 [overflow-wrap:anywhere]"><h3 className="text-sm font-semibold">{item.question}</h3><p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-[#756b62]">{item.answer}</p></article>):<p className="text-sm leading-6 text-[#756b62]">There are no answers available right now.</p>}</div>}
        {offer.kind==='coupon'&&<div className="mt-4 rounded-xl border border-dashed border-[#cdb5bf] bg-[#f5eef1] p-4 text-center">{activeCoupon?<><p className="text-xs text-[#756b62]">Use this code at checkout</p><strong className="mt-1 block break-all text-xl tracking-widest text-[#6b2447]">{activeCoupon.code}</strong><button type="button" className="ad-btn primary mt-3" onClick={async()=>{const coupon=data.coupons.find(item=>item.id===activeCoupon.id&&isCouponEligible(item,Date.now()));if(!coupon){setNow(Date.now());setCouponCopyMessage('That code has expired or is no longer active.');return;}try{if(!navigator.clipboard?.writeText)throw new Error('Clipboard unavailable');await navigator.clipboard.writeText(coupon.code);setCouponCopyMessage(`${coupon.code} copied to clipboard.`);}catch{setCouponCopyMessage('Could not copy the code. Please select and copy it manually.');}}}>Copy code</button>{couponCopyMessage&&<p className="mt-2 text-xs text-[#6b2447]" role="status" aria-live="polite">{couponCopyMessage}</p>}</>:<p className="text-xs leading-5 text-[#756b62]">There are no active discount codes right now. Please check back soon.</p>}</div>}
        {offer.kind==='flash-sale'&&<p className="mt-3 text-sm leading-6 text-[#756b62]">Explore the current edit while these special offers are available.</p>}
        {offer.kind==='offer'&&offer.countdownEnabled&&offer.expiresAt&&<p className="mt-3 text-xs text-[#81766c]">Offer ends in {countdownLabel(offer.expiresAt,now)||'a little while'}.</p>}
        {offer.kind==='faq'?<div className="mt-5 flex flex-wrap gap-3">{popupTarget.startsWith('/')?<Link to={popupTarget} onClick={closePopupForNavigation} className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#6b2447] px-5 text-xs font-semibold text-white">Continue to destination</Link>:<a href={popupTarget} target="_blank" rel="noopener noreferrer" onClick={()=>setOfferOpen('')} className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#6b2447] px-5 text-xs font-semibold text-white">Continue to destination</a>}<button type="button" onClick={()=>setOfferOpen('')} className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#cdb5bf] px-5 text-xs font-semibold text-[#6b2447]">Close</button></div>:<div className="mt-5 flex flex-wrap gap-3"><Link to={targetFor({...offer,offerAction:offer.kind==='offer'?'sale-page':offer.offerAction})} onClick={closePopupForNavigation} className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#6b2447] px-5 text-xs font-semibold text-white">{offer.kind==='coupon'?'Shop and use code':'Explore the offer'}</Link><button type="button" onClick={()=>setOfferOpen('')} className="inline-flex min-h-11 items-center justify-center px-3 text-xs font-semibold text-[#6b2447]">Close</button></div>}
      </section>
    </div>,document.body)}
  </>;
}
