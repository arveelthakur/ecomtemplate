import { useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, CircleHelp, Grid2X2, Heart, Home, Search, ShoppingBag, Tag, UserRound } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAdminStore } from '../context/AdminContext';
import { useWishlist, getVisibleWishlistProducts } from '../context/WishlistContext';
import { useStore } from '../context/StoreContext';

const icons={home:Home,bag:ShoppingBag,grid:Grid2X2,heart:Heart,user:UserRound,search:Search,tag:Tag,custom:CircleHelp};

export default function MobileBottomNav(){
  const {pathname}=useLocation();
  const {data}=useAdminStore();
  const {products}=useStore();
  const {productIds}=useWishlist();
  const wishlistCount=getVisibleWishlistProducts(productIds,products).length;
  const settings=data.content.navigation.mobileBottomBar;
  const dock=settings.dock;
  const items=settings.items.filter(item=>item.visible).sort((a,b)=>a.order-b.order);
  const navVisible=settings.enabled&&items.length>0;
  const [collapsed,setCollapsed]=useState(dock.collapsible&&dock.collapsedByDefault);
  useEffect(()=>setCollapsed(dock.collapsible&&dock.collapsedByDefault),[dock.collapsible,dock.collapsedByDefault]);
  const floating=dock.orientation==='floating-left'||dock.orientation==='floating-right';
  const pill=dock.orientation==='pill';
  const vertical=floating;
  const radius=Math.max(0,Math.min(40,dock.radiusPx));
  const iconSize=Math.max(14,Math.min(28,dock.iconSizePx));
  const textSize=Math.max(8,Math.min(14,dock.textSizePx));
  const backgroundStyle=dock.glassmorphism
    ?{backgroundColor:'var(--nura-primary-fill,var(--nura-primary,#4A2837))',backdropFilter:'blur(14px)',WebkitBackdropFilter:'blur(14px)'}
    :{backgroundColor:'var(--nura-primary-fill,var(--nura-primary,#4A2837))'};
  useEffect(()=>{
    const reserve=navVisible
      ?floating?(collapsed?76:items.length*50+76)
        :pill?(collapsed?74:80)
        :80
      :0;
    document.documentElement.style.setProperty('--nura-mobile-nav-reserved',`${reserve}px`);
    document.documentElement.setAttribute('data-nura-mobile-dock-expanded',String(navVisible&&!collapsed));
    return()=>{
      document.documentElement.style.removeProperty('--nura-mobile-nav-reserved');
      document.documentElement.removeAttribute('data-nura-mobile-dock-expanded');
    };
  },[navVisible,floating,pill,collapsed,items.length]);
  if(!navVisible)return null;
  function isActive(path:string){
    if(path==='/')return pathname==='/';
    if(path==='/collections')return pathname==='/collections'||pathname.startsWith('/category/')||pathname.startsWith('/collections/');
    return pathname===path||pathname.startsWith(`${path}/`);
  }
  const navStyle:CSSProperties={
    position:'fixed',zIndex:9999,bottom:0,
    left:dock.orientation==='floating-left'?'12px':dock.orientation==='floating-right'?'auto':pill?'50%':'0',
    right:dock.orientation==='floating-right'?'12px':pill?'auto':'0',
    width:floating?(collapsed?'56px':'min(78px, 22vw)'):pill?'auto':'100%',
    maxWidth:pill?'calc(100vw - 24px)':undefined,
    transform:collapsed
      ?floating?(dock.orientation==='floating-left'?'translateX(calc(-100% + 44px))':'translateX(calc(100% - 44px))'):pill?`translateY(calc(100% - 56px - var(--nura-safe-area-bottom))) translateX(-50%)`:`translateY(calc(100% - 56px - var(--nura-safe-area-bottom)))`
      :pill?'translateX(-50%)':undefined,
    transition:'transform 280ms cubic-bezier(.2,.75,.25,1)',
    willChange:'transform',
    justifyContent:collapsed?'center':undefined,
    flexDirection:vertical?'column':'row',alignItems:'stretch',
    maxHeight:vertical?'calc(100dvh - var(--nura-safe-area-top) - var(--nura-safe-area-bottom))':undefined,overflowY:vertical?'auto':undefined,overscrollBehavior:vertical?'contain':undefined,
    border:dock.orientation==='horizontal'?'0':'1px solid color-mix(in srgb,var(--nura-gold,#C6A15B) 55%,transparent)',
    borderTop:dock.orientation==='horizontal'?'1px solid color-mix(in srgb,var(--nura-gold,#C6A15B) 55%,transparent)':undefined,
    borderRadius:dock.orientation==='horizontal'?`${radius}px ${radius}px 0 0`:pill?999:radius,
    padding:vertical
      ?'max(7px,var(--nura-safe-area-top)) 5px max(7px,var(--nura-safe-area-bottom))'
      :pill
        ?'6px max(8px,var(--nura-safe-area-right)) max(7px,var(--nura-safe-area-bottom)) max(8px,var(--nura-safe-area-left))'
        :'7px max(8px,var(--nura-safe-area-right)) max(7px,var(--nura-safe-area-bottom)) max(8px,var(--nura-safe-area-left))',
    paddingBottom:'max(7px, var(--nura-safe-area-bottom))',
    boxShadow:floating||pill?'0 8px 28px rgba(43,30,35,.16)':undefined,
    gap:vertical?2:pill?2:0,
    ...backgroundStyle,
  };
  const linkStyle:CSSProperties={
    display:'flex',minWidth:0,minHeight:48,flex:vertical?'none':'1 1 0',
    flexDirection:'column',alignItems:'center',justifyContent:'center',gap:3,
    padding:vertical?'5px 2px':pill?'0 10px':'0 3px',
    borderRadius:Math.min(radius,18),color:'var(--nura-primary-contrast,#FDFBF7)',
    fontSize:`calc(${textSize}px * var(--nura-text-scale,1))`,fontWeight:600,lineHeight:1.15,textAlign:'center',
    textDecoration:'none',whiteSpace:'nowrap',
  };
  if(typeof document==='undefined')return null;
  return createPortal(<nav className="nura-mobile-bottom-nav md:hidden" style={navStyle} aria-label="Quick navigation" data-orientation={dock.orientation} data-testid="mobile-bottom-navigation">
    {!collapsed&&items.map(item=>{
      const Icon=icons[item.icon as keyof typeof icons]||CircleHelp;
      const active=item.href.startsWith('/')&&isActive(item.href);
       const isWishlistLink=item.href.split(/[?#]/)[0]==='/wishlist';
       const content=<><span style={{position:'relative',display:'inline-flex'}}><Icon size={iconSize} strokeWidth={active?2:1.7} aria-hidden="true"/>{isWishlistLink&&wishlistCount>0&&<span aria-hidden="true" data-testid="text-mobile-wishlist-count" style={{position:'absolute',right:-9,top:-7,display:'grid',minWidth:16,height:16,placeItems:'center',borderRadius:999,background:'var(--nura-accent,#C6A15B)',padding:'0 4px',color:'var(--nura-primary,#4A2837)',fontSize:9,lineHeight:1,fontWeight:700}}>{wishlistCount}</span>}</span>{dock.showLabels&&<span>{item.label}</span>}</>;
      const style={...linkStyle,color:active?'var(--nura-accent,#C6A15B)':'var(--nura-primary-contrast,#FDFBF7)'};
       return item.href.startsWith('/')?<Link key={item.id} to={item.href} className="nura-mobile-bottom-link" style={style} aria-label={isWishlistLink&&wishlistCount>0?`${item.label}, ${wishlistCount} saved ${wishlistCount===1?'item':'items'}`:item.label} aria-current={active?'page':undefined} data-testid={`mobile-tab-${item.id}`}>{content}</Link>
        :<a key={item.id} href={item.href} target={/^https?:\/\//i.test(item.href)?'_blank':undefined} rel={/^https?:\/\//i.test(item.href)?'noreferrer':undefined} className="nura-mobile-bottom-link" style={style} aria-label={item.label} data-testid={`mobile-tab-${item.id}`}>{content}</a>;
    })}
    {dock.collapsible&&<button type="button" onClick={()=>setCollapsed(value=>!value)} aria-label={collapsed?'Expand quick navigation':'Collapse quick navigation'} aria-expanded={!collapsed} data-testid="mobile-nav-toggle" style={{display:'grid',placeItems:'center',minWidth:44,minHeight:44,alignSelf:'center',flex:'0 0 auto',border:0,borderRadius:999,background:'transparent',color:'var(--nura-primary-contrast,#FDFBF7)'}}>
      {floating
        ? dock.orientation==='floating-left'
          ? collapsed?<ChevronRight size={18} aria-hidden="true"/>:<ChevronLeft size={16} aria-hidden="true"/>
          : collapsed?<ChevronLeft size={18} aria-hidden="true"/>:<ChevronRight size={16} aria-hidden="true"/>
        : collapsed?<ChevronUp size={18} aria-hidden="true"/>:<ChevronDown size={16} aria-hidden="true"/>}
    </button>}
  </nav>,document.body);
}
