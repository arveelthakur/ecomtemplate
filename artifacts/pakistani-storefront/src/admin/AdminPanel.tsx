import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink, Route, Routes, useLocation, useNavigationType, useSearchParams } from 'react-router-dom';
import {
  Activity, Archive, ArrowDown, ArrowRight, ArrowUp, ArrowUpRight, BadgePercent, BarChart3, Check, ChevronDown,
  FileText, Gift, Grid2X2, Inbox, LayoutDashboard, Menu, MessageSquareText, Package,
  Mail, Navigation, Plus, Search, Settings, ShieldCheck, ShoppingCart, SlidersHorizontal, Star, Store, Users,
  Trash2, X, Eye, Pencil, ExternalLink, Save, CheckCircle2, UserCog, PhoneCall,
} from 'lucide-react';
import { catalogFilterIconOptions, defaultCatalogFilterSections, normalizeCatalogBrowsingSettings, useAdminStore, type AdminReview, type AdminSaveScope, type HeroSlide, type PromiseCard, type TrustBadgeDisplaySettings } from '../context/AdminContext';
import AdminSaveButton, { runAdminSaveCallbacks } from './AdminSaveButton';
import { useStore, type CustomerOrder, type OrderStatus } from '../context/StoreContext';
import { buildProductVariantMatrix, validateProductVariations, validateQuantityDiscountTiers, type Product, type ProductQuantityDiscountOverride, type ProductVariant, type ProductVariationType, type QuantityDiscountTier, type StoreCategory } from '../utils/store';
import './admin.css';
import { useAuth } from '../context/AuthContext';
import LayoutControls, { MasterThemeControls } from './LayoutControls';
import HomepageSectionsManager from './HomepageSectionsManager';
import StorePagesManager from './StorePagesManager';
import FooterInfoManager from './FooterInfoManager';
import QuantityDiscountManager from './QuantityDiscountManager';
import QuantityTierEditor from './QuantityTierEditor';
import FloatingWidgetsManager from './FloatingWidgetsManager';
import StoreImage from '../components/StoreImage';
import { HeaderAndCardsManager, ProductCardBadgeSettingsManager, ProfileFieldSettingsManager } from './StorefrontSettingsEngines';
import ProductBrowsingControls from './ProductBrowsingControls';
import CatalogFilterIcon from '../components/CatalogFilterIcon';
import ImageUpload from '../components/ImageUpload';
import { estimateSerializedProductSize, ImageCompressionUnavailableError, PRODUCT_DOCUMENT_SAFE_SIZE_BYTES, uploadStoreAsset, type ImageUploadProgress } from '../utils/images';
import { generateSeoMetadata, slugifySeo, type SeoMetadata, type SeoSource } from '../utils/seo';
import { httpsCallable, functions } from '../lib/supabase/functions';
import { db, getSupabaseStorage } from '../lib/supabase/index';
import { deleteDoc, doc } from '../lib/supabase/documents';
import { deleteObject, ref as storageRef, defaultBucket } from '../lib/supabase/storage';
import { protectForm } from '../hooks/use-recaptcha';
import EmailEnginePage from './email/EmailEnginePage';
import AdminModalPortal from './AdminModalPortal';
import { useEmailSettings } from './email/useEmailSettings';
import type { EmailProviderStatus } from './email/emailTypes';
import { configuredStoreName } from '../utils/branding';
import { AnalyticsPage, CustomersPage, MediaLibraryPage, NavigationManagerPage } from './AdminExtensions';
import MarqueeBarsManager from './MarqueeBarsManager';
import AdminUsersPage from './AdminUsersPage';
import VoiceIVRPage from './VoiceIVRPage';

const navItems=[
  {to:'orders',label:'Orders',icon:ShoppingCart},
  {to:'customers',label:'Customers',icon:Users},
  {to:'analytics',label:'Analytics & reports',icon:BarChart3},
  {to:'products',label:'Products',icon:Package},{to:'categories',label:'Categories',icon:Grid2X2},
  {to:'navigation',label:'Navigation & menus',icon:Navigation},{to:'media',label:'Media library',icon:Eye},
  {to:'content',label:'Homepage sections',icon:Store},
  {to:'content?section=announcement',label:'Announcement bar',icon:MessageSquareText},
  {to:'content?section=marquee',label:'Marquee bars',icon:Activity},
  {to:'content?section=layout',label:'Product page',icon:Package},
  {to:'content?section=hero',label:'Hero slider settings',icon:Store},
  {to:'content?section=story',label:'Our story settings',icon:FileText},
  {to:'content?section=contact',label:'Contact section settings',icon:Mail},
  {to:'content?section=footer',label:'Footer information',icon:FileText},
  {to:'store-pages?section=catalog',label:'Catalog page',icon:Store},
  {to:'store-pages?section=cart',label:'Cart page',icon:ShoppingCart},
  {to:'store-pages?section=checkout',label:'Checkout page',icon:ShoppingCart},
  {to:'store-pages?section=account',label:'Account page',icon:Users},
  {to:'store-pages?section=wishlist',label:'Wishlist page',icon:Star},
  {to:'pages',label:'Policies',icon:FileText},{to:'reviews',label:'Reviews',icon:Star},
  {to:'deals',label:'Coupons & promotions',icon:BadgePercent},
  {to:'settings?section=countdown',label:'Promotions & countdown',icon:Gift},
  {to:'settings?section=widgets',label:'Floating widgets',icon:Gift},
  {to:'settings?section=header',label:'Header & cards',icon:Store},
  {to:'settings?section=payments',label:'Bank transfer / wallet details',icon:ShoppingCart},
  {to:'settings?section=general',label:'Store settings',icon:Settings},
  {to:'settings?section=theme',label:'Global Master Control',icon:Settings},
  {to:'settings?section=preloader',label:'Preloader & loading',icon:Settings},
  {to:'settings?section=seo',label:'SEO & metadata',icon:Search},
  {to:'settings?section=browsing',label:'Product browsing',icon:SlidersHorizontal},
  {to:'email',label:'Broadcast email engine',icon:Mail},
  {to:'notifications',label:'WhatsApp API',icon:MessageSquareText},
  {to:'inbox',label:'Customer inbox',icon:Inbox},
  {to:'voice',label:'Voice & IVR engine',icon:PhoneCall},
  {to:'users',label:'Admin users & roles',icon:UserCog},{to:'security',label:'Security / reCAPTCHA v3',icon:ShieldCheck},
];
const mobileNavItems=[{to:'dashboard',label:'Overview',icon:LayoutDashboard},...navItems];
const pkr = (n: number) => `Rs ${Number(n || 0).toLocaleString('en-PK')}`;
const dateLabel = (v: string) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
};
const verificationDateTimeLabel = (value: CustomerOrder['paymentVerifiedAt']) => {
  if (!value) return '';
  const date = value instanceof Date ? value : typeof value === 'string' ? new Date(value) : value.toDate();
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleString('en-PK', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};
const idFor = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const trustBadgeIconOptions = [
  { value: 'shield', label: 'Shield' },
  { value: 'truck', label: 'Truck' },
  { value: 'phone', label: 'Phone' },
  { value: 'leaf', label: 'Leaf' },
  { value: 'sparkle', label: 'Sparkle' },
  { value: 'award', label: 'Award' },
  { value: 'check', label: 'Check circle' },
  { value: 'lock', label: 'Lock' },
  { value: 'rotate', label: 'Returns / refresh' },
  { value: 'pin', label: 'Location pin' },
] as const;

function Button({ children, className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`ad-btn ${className}`} {...props}>{children}</button>;
}
function Field({ label, children, help, error, className = '' }: { label: string; children: ReactNode; help?: string; error?: string; className?: string }) {
  return <div className={`ad-field ${className}`}><label className="ad-label">{label}</label>{children}{error && <div className="ad-error">{error}</div>}{help && !error && <div className="ad-help">{help}</div>}</div>;
}
function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`ad-input ${props.className || ''}`} />;
}
function Area(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`ad-textarea ${props.className || ''}`} />;
}
function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`ad-select ${props.className || ''}`} />;
}
function Modal({ title, description, children, onClose, footer, closeDisabled=false }: { title: string; description?: string; children: ReactNode; onClose: () => void; footer?: ReactNode; closeDisabled?: boolean }) {
  return <AdminModalPortal><div className="ad-modal-backdrop" role="presentation" onMouseDown={e => { if (!closeDisabled&&e.target === e.currentTarget) onClose(); }}>
    <section className="ad-modal" role="dialog" aria-modal="true" aria-label={title}>
      <header className="ad-modal-head"><div><h2 className="ad-card-title">{title}</h2>{description && <div className="ad-card-note">{description}</div>}</div><button className="ad-icon-btn" onClick={onClose} disabled={closeDisabled} aria-label="Close dialog" data-testid="button-close-dialog"><X /></button></header>
      <div className="ad-modal-body">{children}</div>{footer && <footer className="ad-modal-foot">{footer}</footer>}
    </section>
  </div></AdminModalPortal>;
}
function Card({ title, note, action, children, className = '' }: { title: string; note?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`ad-card ${className}`}><header className="ad-card-head"><div><h2 className="ad-card-title">{title}</h2>{note && <div className="ad-card-note">{note}</div>}</div>{action}</header>{children}</section>;
}
function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return <div className="ad-empty"><span className="ad-empty-mark"><Archive /></span><h3>{title}</h3><p>{body}</p>{action && <div style={{ marginTop: 14 }}>{action}</div>}</div>;
}
function Badge({ children, tone = '' }: { children: ReactNode; tone?: string }) {
  const toneClass = /delivered|published|active|read|shipped/i.test(String(children)) ? 'green' : /pending|new|processing/i.test(String(children)) ? 'amber' : /cancelled|hidden|inactive/i.test(String(children)) ? 'rose' : '';
  return <span className={`ad-status ${tone || toneClass}`}>{children}</span>;
}
function PageHead({ kicker, title, subtitle, action }: { kicker: string; title: string; subtitle: string; action?: ReactNode }) {
  return <div className="ad-page-head"><div><div className="ad-kicker">{kicker}</div><h1 className="ad-page-title">{title}</h1><p className="ad-page-subtitle">{subtitle}</p></div>{action}</div>;
}
function SeoSocialFields({ value, source, onChange, prefix, hideImageUrlInput = false }: { value?: SeoMetadata; source: SeoSource; onChange: (next: SeoMetadata) => void; prefix: string; hideImageUrlInput?: boolean }) {
  const fallback=generateSeoMetadata(source);
  const seo={...fallback,...value};
  const update=(key:keyof SeoMetadata,next:string)=>onChange({...seo,[key]:key==='slug'?slugifySeo(next):next});
  return <Card title="SEO & Social" note="Generated locally from the item copy. You can edit any field before saving." action={<Button className="small" type="button" onClick={()=>onChange(generateSeoMetadata(source))} data-testid={`button-generate-seo-${prefix}`}><Star/> Generate Meta Tags</Button>}>
    <div className="ad-card-body ad-form-stack">
      <div className="ad-form-row">
        <Field label="Meta title" help={`${seo.metaTitle.length}/60 characters · shown in search results.`}><Input value={seo.metaTitle} maxLength={60} onChange={event=>update('metaTitle',event.target.value)} data-testid={`input-seo-title-${prefix}`}/></Field>
        <Field label="Clean URL slug" help="Used for the public product, category, or policy route."><Input value={seo.slug} maxLength={120} onChange={event=>update('slug',event.target.value)} data-testid={`input-seo-slug-${prefix}`}/></Field>
      </div>
      <Field label="Meta description (150–160 characters)" help={`${seo.metaDescription.length} characters. Search snippets may be shortened by Google.`}><Area value={seo.metaDescription} maxLength={160} onChange={event=>update('metaDescription',event.target.value)} data-testid={`input-seo-description-${prefix}`}/></Field>
      <Field label="Search keywords" help="Comma-separated phrases related to this page."><Input value={seo.keywords} maxLength={500} onChange={event=>update('keywords',event.target.value)} data-testid={`input-seo-keywords-${prefix}`}/></Field>
      <Field label="Image alt text" help="A concise, descriptive alternative for the primary product or page image."><Input value={seo.imageAlt} maxLength={250} onChange={event=>update('imageAlt',event.target.value)} data-testid={`input-seo-alt-${prefix}`}/></Field>
      <div className="ad-form-row">
        <Field label="OpenGraph title"><Input value={seo.ogTitle} maxLength={100} onChange={event=>update('ogTitle',event.target.value)} data-testid={`input-seo-og-title-${prefix}`}/></Field>
        <Field label="OpenGraph description"><Input value={seo.ogDescription} maxLength={300} onChange={event=>update('ogDescription',event.target.value)} data-testid={`input-seo-og-description-${prefix}`}/></Field>
      </div>
      <Field label="Social preview image" help="Used by Facebook, Instagram link previews, WhatsApp, and Twitter. Recommended canvas: 1200 × 630 px.">
        {!hideImageUrlInput&&<Input value={seo.ogImageUrl} maxLength={1500} onChange={event=>update('ogImageUrl',event.target.value)} placeholder="https://… or /image.jpg" data-testid={`input-seo-og-image-${prefix}`}/>}
        <ImageUpload folder={prefix==='product'?'products':'banners'} actionLabel={seo.ogImageUrl?'Replace social preview image':'Upload social preview image'} onUploaded={url=>update('ogImageUrl',url)}/>
      </Field>
    </div>
  </Card>;
}
function Toast({ text, onClose }: { text: string; onClose: () => void }) {
  if(typeof document==='undefined')return null;
  return createPortal(<div className="ad-toast" role="status" aria-live="polite" data-testid="status-feedback"><span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><CheckCircle2 size={15} />{text}</span><button onClick={onClose} aria-label="Dismiss notification" className="ad-icon-btn" style={{ color: 'white', marginLeft: 12 }}><X /></button></div>,document.body);
}
function useFeedback() {
  const {flush}=useAdminStore();
  const [message, setMessage] = useState('');
  const notify = async (next: string, persist=true) => { try { if(persist)await flush(); setMessage(next); window.setTimeout(() => setMessage(current => current === next ? '' : current), 3200); } catch(failure) {setMessage(`Save failed: ${failure instanceof Error?failure.message:String(failure)}`);} };
  return { message, notify, clear: () => setMessage('') };
}

function AdminShell() {
  const { data,saving,dirty,restoredSettingsDirty,flushAllRestoredSettings,syncError,localDraftAvailable,localDraftRestored,saveRetryAvailable,restoreLocalDraft,discardLocalDraft,initialized,seedStore,flush } = useAdminStore();
  const {user,signOut}=useAuth();
  const storeName=configuredStoreName(data.settings.general.storeName);
  const storeLogo=data.settings.general.storeLogoUrl.trim();
  const {orderError}=useStore();
  const [setupError,setSetupError]=useState('');
  const localDraftNotice=syncError.startsWith('LOCAL_DRAFT:');
  const [saveToast,setSaveToast]=useState('');
  const saveAll=async()=>{
    setSaveToast('');
    try{
      const result=restoredSettingsDirty?await flushAllRestoredSettings():await flush();
      if(result==='remote')await runAdminSaveCallbacks();
      const message=result==='remote'?'Changes saved successfully':'Saved on this device; cloud sync is pending.';
      setSaveToast(message);
      window.setTimeout(()=>setSaveToast(current=>current===message?'':current),3200);
    }catch(failure){
      const message=`Save failed: ${failure instanceof Error?failure.message:String(failure)}`;
      setSaveToast(message);
      window.setTimeout(()=>setSaveToast(current=>current===message?'':current),5000);
    }
  };
  const [menuOpen, setMenuOpen] = useState(false);
  const [adminSearch,setAdminSearch]=useState('');
  const [confirmExit, setConfirmExit] = useState(false);
  const location = useLocation();
  const navigationType=useNavigationType();
  const scrollPositions=useRef(new Map<string,{x:number;y:number}>());
  const sidebarScrollRef=useRef<HTMLElement>(null);
  const mainScrollRef=useRef<HTMLDivElement>(null);
  const activeLocation=useRef({key:location.key,pathname:location.pathname});
  useEffect(()=>{
    const previousRestoration=window.history.scrollRestoration;
    const scrollContainer=mainScrollRef.current;
    window.history.scrollRestoration='manual';
    const rememberScroll=()=>{
      const container=mainScrollRef.current;
      if(container)scrollPositions.current.set(activeLocation.current.key,{x:container.scrollLeft,y:container.scrollTop});
    };
    scrollContainer?.addEventListener('scroll',rememberScroll,{passive:true});
    return()=>{
      scrollContainer?.removeEventListener('scroll',rememberScroll);
      window.history.scrollRestoration=previousRestoration;
    };
  },[]);
  useLayoutEffect(()=>{
    const previous=activeLocation.current;
    const scrollContainer=mainScrollRef.current;
    if(navigationType!=='POP'&&scrollContainer)scrollPositions.current.set(previous.key,{x:scrollContainer.scrollLeft,y:scrollContainer.scrollTop});
    activeLocation.current={key:location.key,pathname:location.pathname};
    if(navigationType==='POP'){
      const saved=scrollPositions.current.get(location.key);
      if(saved)requestAnimationFrame(()=>{
        const container=mainScrollRef.current;
        if(container){container.scrollLeft=saved.x;container.scrollTop=saved.y;}
      });
    }else if(previous.pathname!==location.pathname){
      requestAnimationFrame(()=>{
        const container=mainScrollRef.current;
        if(container){container.scrollLeft=0;container.scrollTop=0;}
      });
    }
  },[location.key,location.pathname,navigationType]);
  useLayoutEffect(()=>{
    const container=sidebarScrollRef.current;
    if(menuOpen&&container)container.scrollTop=0;
  },[menuOpen]);
  useLayoutEffect(()=>{
    const container=sidebarScrollRef.current;
    if(!container)return;
    const activeLink=container?.querySelector<HTMLElement>('.ad-nav-link.active');
    if(!activeLink)return;
    const containerRect=container.getBoundingClientRect();
    const linkRect=activeLink.getBoundingClientRect();
    if(linkRect.top<containerRect.top)container.scrollTop-=containerRect.top-linkRect.top;
    else if(linkRect.bottom>containerRect.bottom)container.scrollTop+=linkRect.bottom-containerRect.bottom;
  },[location.key,location.pathname,location.search]);
  const active = navItems.find(item => {
    const [targetPath,targetQuery]=item.to.split('?');
    const queryMatches=targetQuery?new URLSearchParams(targetQuery).toString()===new URLSearchParams(location.search).toString():true;
    return location.pathname.endsWith(`/${targetPath}`)&&queryMatches;
  });
  const title = active?.label || 'Dashboard';
  const searchNeedle=adminSearch.trim().toLocaleLowerCase();
  const visibleNavItems=searchNeedle?navItems.filter(item=>item.label.toLocaleLowerCase().includes(searchNeedle)):navItems;
  const pinnedNavItems=visibleNavItems.filter(item=>['orders','products','analytics'].includes(item.to.split('?')[0]));
  const scrollNavItems=visibleNavItems.filter(item=>!['orders','products','analytics'].includes(item.to.split('?')[0]));
  const showDashboard=!searchNeedle||'dashboard overview'.includes(searchNeedle);
  const matchingProducts=searchNeedle?data.products.filter(product=>product.name.toLocaleLowerCase().includes(searchNeedle)||String(product.id).includes(searchNeedle)).slice(0,5):[];
  return <div className="nura-admin ad-shell">
    {menuOpen && <button className="ad-sidebar-shade" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
      <aside ref={sidebarScrollRef} className={`ad-sidebar ${menuOpen ? 'open' : ''}`} data-testid="admin-sidebar-scroll">
      <div className="ad-brand">{storeLogo?<StoreImage src={storeLogo} alt={storeName?`${storeName} logo`:'Store logo'} className="block h-10 max-w-[180px] object-contain" placeholderTitle="Store logo" placeholderHint="Upload a logo in store settings." placeholderDimensions="Recommended: 1200 × 400 px"/>:<div className="ad-brand-mark">{storeName||'Store workspace'}</div>}<div className="ad-brand-caption">{storeName?'Store admin workspace':'Admin workspace · set up store branding'}</div></div>
       <div className="ad-demo-tag"><i /> Supabase workspace</div>
       <label className="ad-sidebar-search"><Search aria-hidden="true"/><input value={adminSearch} onChange={event=>setAdminSearch(event.target.value)} placeholder="Find pages or products" aria-label="Search admin pages and products" data-testid="input-admin-search"/></label>
      <nav className="ad-nav ad-nav-pinned" aria-label="Quick access">
        {showDashboard&&<NavLink to="/admin/dashboard" onClick={()=>{setMenuOpen(false);setAdminSearch('');}} className={({isActive})=>`ad-nav-link ${isActive?'active':''}`} data-testid="link-admin-dashboard"><LayoutDashboard/><span>Dashboard</span></NavLink>}
        {pinnedNavItems.map(({to,label,icon:Icon})=><NavLink key={to} to={`/admin/${to}`} onClick={()=>{setMenuOpen(false);setAdminSearch('');}} className={({isActive})=>`ad-nav-link ${isActive?'active':''}`} data-testid={`link-admin-${to}`}><Icon/><span>{label}</span></NavLink>)}
      </nav>
      <div className="ad-nav-scroll">
        <nav className="ad-nav" aria-label="Admin navigation">
           {matchingProducts.map(product=><Link key={product.id} to={`/admin/products?find=${encodeURIComponent(String(product.id))}`} onClick={()=>{setMenuOpen(false);setAdminSearch('');}} className="ad-nav-link" data-testid={`admin-search-product-${product.id}`}><Package/><span>{product.name}</span></Link>)}
           {scrollNavItems.map(({ to, label, icon: Icon }) => <NavLink key={to} to={`/admin/${to}`} onClick={() => {setMenuOpen(false);setAdminSearch('');}} className={({ isActive }) => {
              const [targetPath,targetQuery]=to.split('?');
              const queryMatches=targetQuery?new URLSearchParams(targetQuery).toString()===new URLSearchParams(location.search).toString():!location.search;
              const activeLink=(location.pathname.endsWith(`/${targetPath}`)&&queryMatches)||(!targetQuery&&isActive);
              return `ad-nav-link ${activeLink?'active':''}`;
            }} data-testid={`link-admin-${to.replace(/[^a-z0-9-]/gi,'-')}`}>
              <Icon /><span>{label}</span>{to === 'inbox' && data.inbox.some(message=>message.status==='new') && <span className="ad-status amber" style={{ marginLeft: 'auto', padding: '3px 6px' }}>{data.inbox.filter(message=>message.status==='new').length}</span>}
            </NavLink>)}
           {searchNeedle&&!matchingProducts.length&&!visibleNavItems.length&&!showDashboard&&<p className="ad-sidebar-empty">No matching pages or products.</p>}
        </nav>
      </div>
      <div className="ad-side-bottom">
         <div className="ad-user"><div className="ad-avatar">ST</div><div><div className="ad-user-name">{user?.displayName||'Store team'}</div><div className="ad-user-role">Administrator</div></div><button className="ad-icon-btn" style={{ marginLeft: 'auto' }} aria-label="Sign out" onClick={() => setConfirmExit(true)} data-testid="button-exit-admin"><ChevronDown /></button></div>
      </div>
    </aside>
    <div ref={mainScrollRef} className="ad-main" data-testid="admin-main-scroll">
      <header className="ad-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><button className="ad-mobile-menu" aria-label={menuOpen?'Close navigation':'Open navigation'} aria-expanded={menuOpen} aria-controls="admin-sidebar-scroll" onClick={() => setMenuOpen(open=>!open)} data-testid="button-mobile-menu">{menuOpen?<X size={18}/>:<Menu size={18} />}</button><span className="ad-breadcrumb">Workspace <span style={{ margin: '0 7px', color: '#c1b4a8' }}>/</span>{title}</span></div>
         <div className="ad-top-actions">
           <span className="ad-live-pill" data-testid="status-supabase-live"><i />{saving?'Saving…':localDraftRestored?'Local draft · not saved':dirty?'Unsaved changes':'Supabase live'}</span>
            <button type="button" className="ad-btn primary ad-save-all" disabled={!dirty||saving} onClick={()=>void saveAll()} data-testid="button-save-all-admin-changes"><Save size={14}/>{saving?'Saving…':'Save changes'}</button>
           <Link to="/" target="_blank" rel="noopener noreferrer" className="ad-btn ad-top-store-link" aria-label="Open Storefront in a new tab" title="Open Storefront" data-testid="link-open-storefront">
              <ExternalLink aria-hidden="true"/><span>Open Storefront</span>
           </Link>
         </div>
      </header>
      <nav className="ad-mobile-quick-nav" aria-label="Admin sections" data-testid="admin-mobile-quicknav">
        <div className="ad-mobile-quick-track">
          {mobileNavItems.map(({to,label,icon:Icon})=>{
            const [targetPath,targetQuery]=to.split('?');
            const selected=location.pathname.endsWith(`/${targetPath}`)
              &&(targetQuery
                ?new URLSearchParams(targetQuery).toString()===new URLSearchParams(location.search).toString()
                :!location.search);
            const href=to==='dashboard'?'/admin/dashboard':`/admin/${to}`;
            const testId=to==='dashboard'?'admin-mobile-overview':`admin-mobile-quick-${to.replace(/[^a-z0-9-]/gi,'-')}`;
            return <Link key={to} to={href} className={`ad-mobile-quick-link ${selected?'active':''}`}
              aria-current={selected?'page':undefined} data-testid={testId}>
              <Icon aria-hidden="true"/><span>{label}</span>
            </Link>;
          })}
        </div>
      </nav>
      <main className="ad-main-inner">
          {localDraftAvailable&&<div role="alert" className="ad-notice" data-testid="notice-local-draft-available" style={{marginBottom:20,display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
            <span><strong>Unsaved local settings draft found.</strong> Supabase settings are still active. Choose whether to restore these edits or discard them.</span>
            <div className="ad-actions-row"><Button className="primary" onClick={async()=>{setSetupError('');try{await restoreLocalDraft();}catch(failure){setSetupError(failure instanceof Error?failure.message:String(failure));}}} data-testid="button-restore-local-draft">Restore local draft</Button><Button onClick={()=>{setSetupError('');discardLocalDraft();}} data-testid="button-discard-local-draft">Discard draft</Button></div>
          </div>}
          {localDraftRestored&&<div role="status" className="ad-notice" data-testid="notice-local-draft-restored" style={{color:'#66543f',background:'#f7f1e6',borderColor:'#e8dac4',marginBottom:20,display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
            <span>{localDraftNotice?syncError.slice('LOCAL_DRAFT:'.length):'Local draft restored. These edits are not saved to Supabase yet.'}</span>
            <div className="ad-actions-row">
              <Button onClick={()=>{setSetupError('');discardLocalDraft();}} data-testid="button-discard-restored-draft">Discard restored edits</Button>
            </div>
          </div>}
          {saveRetryAvailable&&<div role="alert" className="ad-notice" data-testid="notice-memory-draft-retry" style={{color:'#984a53',marginBottom:20,display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
            <span>{syncError&&!localDraftNotice?syncError:'Your edits are still in this page. Use the sticky Save changes control to retry.'}</span>
          </div>}
          {((syncError&&!localDraftNotice&&!saveRetryAvailable)||orderError||setupError)&&<div role="alert" className="ad-notice" style={{color:'#984a53',marginBottom:20}}>{setupError||(syncError&&!localDraftNotice&&!saveRetryAvailable?syncError:'')||orderError}</div>}
        {!initialized&&<div className="ad-notice" style={{marginBottom:20}}>This Supabase store has not been initialized. <Button onClick={async()=>{try{await seedStore();}catch(failure){setSetupError(String(failure));}}}>Initialize empty store configuration</Button> This creates settings only; products and categories remain empty.</div>}
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="orders" element={<Orders />} />
          <Route path="customers" element={<CustomerAdminManager />} />
          <Route path="products" element={<Products />} />
          <Route path="categories" element={<Categories />} />
          <Route path="deals" element={<Deals />} />
          <Route path="reviews" element={<Reviews />} />
          <Route path="content" element={<Content />} />
          <Route path="store-pages" element={<StorePagesManager />} />
          <Route path="navigation" element={<NavigationManagerPage />} />
          <Route path="media" element={<MediaLibraryPage />} />
          <Route path="trust-badges" element={<TrustBadgesManager />} />
          <Route path="pages" element={<Pages />} />
          <Route path="inbox" element={<InboxPage />} />
          <Route path="email" element={<EmailEnginePage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="voice" element={<VoiceIVRPage />} />
          <Route path="security" element={<SecurityPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Dashboard />} />
        </Routes>
      </main>
    </div>
    <div className="ad-save-dock" role="region" aria-label="Save admin changes" data-testid="admin-save-dock" data-dirty={dirty||saveRetryAvailable||localDraftRestored} data-saving={saving}>
      <span className="ad-save-dock-status" role="status" aria-live="polite">{saving?'Saving changes…':localDraftRestored?'Local draft needs saving':saveRetryAvailable?'Retry saving changes':dirty?'You have unsaved changes':'All changes saved'}</span>
      <button type="button" className="ad-btn primary ad-save-dock-button" aria-label={saving?'Saving changes':localDraftRestored?'Save restored draft':saveRetryAvailable?'Retry saving changes':dirty?'Save changes':'All changes saved'} title={saving?'Saving changes':localDraftRestored?'Save restored draft':saveRetryAvailable?'Retry saving changes':dirty?'Save changes':'All changes saved'} disabled={saving||(!dirty&&!saveRetryAvailable&&!localDraftRestored)} onClick={()=>void saveAll()} data-testid="button-save-dock-admin-changes"><Save size={20}/></button>
    </div>
     {confirmExit && <Modal title="Sign out?" description="Your saved Supabase edits remain available." onClose={() => setConfirmExit(false)} footer={<><Button onClick={() => setConfirmExit(false)}>Stay here</Button><Button className="primary" onClick={async () => { try{await signOut();setConfirmExit(false);}catch(failure){setSetupError(String(failure));} }} data-testid="button-confirm-exit">Sign out</Button></>}>
       <div className="ad-notice">This ends your Supabase Auth session on this device.</div>
    </Modal>}
      {saveToast&&<Toast text={saveToast} onClose={()=>setSaveToast('')}/>}
  </div>;
}

function Dashboard() {
  const { products, orders, categories } = useStore();
  const { data } = useAdminStore();
  const activeOrders=orders.filter(order=>order.status!=='Cancelled');
  const gross = activeOrders.reduce((sum, o) => sum + Number(o.grandTotal || 0), 0);
  const pending = orders.filter(o => o.status === 'Pending' || o.status === 'Processing').length;
  const publishedReviews = data.reviews.filter(r => r.published).length;
  const lowStock=products.filter(product=>product.stock<=5);
  const months=Array.from({length:6},(_,index)=>new Date(new Date().getFullYear(),new Date().getMonth()-5+index,1));
  const monthNames=months.map(month=>month.toLocaleDateString('en-PK',{month:'short'}));
  const monthlyOrders=months.map(month=>activeOrders.filter(order=>{const placed=new Date(order.createdAt);return placed.getFullYear()===month.getFullYear()&&placed.getMonth()===month.getMonth();}).length);
  const maxMonthlyOrders=Math.max(1,...monthlyOrders);
  const monthBars=monthlyOrders.map(count=>count?Math.max(18,Math.round(count/maxMonthlyOrders*100)):10);
  return <>
    <PageHead kicker="Store administration" title="Store overview" subtitle="Manage your catalog, orders, and storefront settings." />
    <section className="ad-stats">
        <div className="ad-stat"><div className="ad-stat-label">Gross order value</div><div className="ad-stat-value">{pkr(gross)}</div><div className="ad-stat-foot"><ArrowUpRight size={11} style={{ verticalAlign: 'middle' }} /> Across {activeOrders.length} non-cancelled orders</div></div>
      <div className="ad-stat"><div className="ad-stat-label">Orders to review</div><div className="ad-stat-value">{pending.toString().padStart(2, '0')}</div><div className="ad-stat-foot">Pending or processing</div></div>
      <div className="ad-stat"><div className="ad-stat-label">Products in catalogue</div><div className="ad-stat-value">{products.length.toString().padStart(2, '0')}</div><div className="ad-stat-foot">{categories.length} active categories</div></div>
      <div className="ad-stat"><div className="ad-stat-label">Published customer notes</div><div className="ad-stat-value">{publishedReviews.toString().padStart(2, '0')}</div><div className="ad-stat-foot">From {data.reviews.length} review entries</div></div>
    </section>
    {lowStock.length>0&&<section className="ad-card" style={{borderColor:'#ce9861',background:'#fff5e6',marginBottom:24}} data-testid="section-low-stock-warning"><header className="ad-card-head"><h2 className="ad-card-title">Low Stock Warning <Badge tone="amber">{lowStock.length} products</Badge></h2><Link to="/admin/products" className="ad-btn">Review stock</Link></header><div className="ad-card-body">{lowStock.map(product=><p key={product.id} style={{fontSize:12,margin:'6px 0'}}><strong>{product.name}</strong> — {product.stock} units remaining</p>)}</div></section>}
    <div className="ad-grid two" style={{ alignItems: 'start' }}>
      <Card title="Order activity" note="Orders saved in Supabase" action={<span className="ad-status green"><Activity size={11} style={{ marginRight: 4 }} /> Current</span>}>
        <div className="ad-card-body"><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><strong style={{ fontFamily: 'Manrope', fontSize: 21 }}>{orders.length}</strong><span className="ad-card-note">all-time orders</span></div>
          <div className="ad-chart">{monthBars.map((height, i) => <div key={monthNames[i]} className="ad-chart-bar" style={{ height: `${height}%` }} title={`${monthNames[i]}: order activity`} />)}</div><div className="ad-chart-labels">{monthNames.map(m => <span key={m}>{m}</span>)}</div>
        </div>
      </Card>
      <Card title="Recent orders" note="The latest activity from your storefront" action={<Link to="/admin/orders" className="ad-btn ghost small" data-testid="link-dashboard-orders">All orders <ArrowRight size={12} /></Link>}>
        {orders.length ? <div className="ad-table-wrap"><table className="ad-table" style={{ minWidth: 0 }}><thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th></tr></thead><tbody>{[...orders].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 5).map(o => <tr key={o.id} data-testid={`row-recent-order-${o.id}`}><td><strong>{o.id}</strong><div className="ad-item-sub">{dateLabel(o.createdAt)}</div></td><td>{o.fullName}</td><td>{pkr(o.grandTotal)}</td><td><Badge>{o.status}</Badge></td></tr>)}</tbody></table></div> : <Empty title="No orders yet" body="When a customer checks out, their order will appear here." />}</Card>
      <Card title="Store health" note="Quick checks across the workspace">
        <div className="ad-card-body" style={{ display: 'grid', gap: 14 }}>
           {[
             [Package, 'Catalogue ready', `${products.filter(p => p.stock > 0).length} products with stock`, 'green'],
            [Gift, 'Offers in play', `${data.deals.filter(d => d.active).length + data.coupons.filter(c => c.active).length} active deals and coupons`, ''],
            [Inbox, 'Inbox to read', `${data.inbox.filter(m => m.status === 'new').length} new customer messages`, 'amber'],
          ].map(([Icon, title, caption, tone]: any) => <div key={title} style={{ display: 'flex', alignItems: 'center', gap: 11 }}><span className="ad-empty-mark" style={{ width: 32, height: 32, margin: 0 }}><Icon size={15} /></span><div style={{ flex: 1 }}><div className="ad-item-name">{title}</div><div className="ad-item-sub">{caption}</div></div><Badge tone={tone}>{tone === 'amber' ? 'Needs attention' : 'In good shape'}</Badge></div>)}
        </div>
      </Card>
      <Card title="A few useful places" note="Pick up where you left off">
        <div className="ad-card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
          {[
            ['products', 'Review stock levels', 'Products with low stock are easy to spot.', Package],
            ['content', 'Refresh the homepage', 'Update the seasonal story and hero.', Store],
            ['inbox', 'Reply to a customer', 'Read incoming storefront messages.', MessageSquareText],
            ['settings', 'Store preferences', 'Delivery fee, contact and socials.', SlidersHorizontal],
          ].map(([to, text, sub, Icon]: any) => <Link to={`/admin/${to}`} key={to} className="ad-card" style={{ padding: 13, textDecoration: 'none', display: 'flex', gap: 9, alignItems: 'flex-start' }} data-testid={`link-quick-${to}`}><Icon size={15} color="var(--nura-primary,#4A2837)" /><div><div className="ad-item-name">{text}</div><div className="ad-item-sub">{sub}</div></div></Link>)}
        </div>
      </Card>
    </div>
  </>;
}

function FulfillmentEditor({order,onSaved}:{order:CustomerOrder;onSaved:()=>void}){
  const {updateOrder}=useStore();
  const [draft,setDraft]=useState({status:order.status,courier:order.courier,trackingNumber:order.trackingNumber,trackingUrl:order.trackingUrl||''});
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  async function submit(event:FormEvent){event.preventDefault();setBusy(true);setError('');try{await updateOrder(order.id,draft);onSaved();}catch(failure){setError(failure instanceof Error?failure.message:String(failure));}finally{setBusy(false);}}
  return <form onSubmit={submit} className="ad-form-stack"><div className="ad-form-row">
    <Field label="Fulfilment status"><Select value={draft.status} onChange={event=>setDraft({...draft,status:event.target.value as OrderStatus})} data-testid="select-order-status-detail">{['Pending','Processing','Confirmed by Call','Shipped','Out for Delivery','Delivered','Cancelled'].map(status=><option key={status}>{status}</option>)}</Select></Field>
    <Field label="Courier"><Input value={draft.courier} maxLength={120} onChange={event=>setDraft({...draft,courier:event.target.value})} data-testid="input-order-courier"/></Field>
     <Field label="Tracking number"><Input value={draft.trackingNumber} maxLength={120} onChange={event=>setDraft({...draft,trackingNumber:event.target.value})} data-testid="input-order-tracking"/></Field>
    </div><Field label="Courier tracking URL" help="Optional HTTPS link shown to shoppers and included in the shipped email."><Input type="url" value={draft.trackingUrl} maxLength={1000} onChange={event=>setDraft({...draft,trackingUrl:event.target.value})} placeholder="https://courier.example/track/…" data-testid="input-order-tracking-url"/></Field>{order.status==='Cancelled'&&draft.status!=='Cancelled'&&<p className="ad-notice">Reopening this order reserves its current product and variant inventory. The update is rejected if stock is no longer available.</p>}{error&&<p role="alert" className="ad-error">{error}</p>}<Button type="submit" className="primary" disabled={busy} data-testid="button-save-fulfillment">{busy?'Saving…':'Save fulfillment'}</Button></form>;
}
function PaymentVerification({order,onSaved}:{order:CustomerOrder;onSaved:()=>void}){
  const {verifyOrderPayment}=useStore();
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  if(order.paymentMethod==='COD')return null;
  const verificationTime=verificationDateTimeLabel(order.paymentVerifiedAt);
  async function verify(){
    setBusy(true);setError('');
    try{await verifyOrderPayment(order.id);onSaved();}
    catch(failure){setError(failure instanceof Error?failure.message:String(failure));}
    finally{setBusy(false);}
  }
  return <div style={{marginTop:9}}>
    <div className="ad-item-sub">Payment verification <span style={{float:'right'}}><Badge tone={order.paymentVerified?'green':'amber'}>{order.paymentVerified?'Verified':'Unverified'}</Badge></span></div>
    {order.paymentVerified
      ? <div className="ad-help" data-testid="text-payment-verification-audit">
          Verified by {order.paymentVerifiedByLabel || order.paymentVerifiedBy || 'Administrator'}
          {verificationTime && <> · {verificationTime}</>}
        </div>
      : <><div className="ad-help">Confirm the funds arrived in your bank or wallet account; the customer reference alone is not proof of payment.</div>
        {!order.transactionReference&&<div className="ad-error" role="alert">No payment reference was recorded for this order.</div>}
        <Button type="button" className="small" disabled={busy||!order.transactionReference} onClick={()=>void verify()} data-testid="button-verify-order-payment">{busy?'Saving…':'Mark payment verified'}</Button>
        {error&&<p role="alert" className="ad-error">{error}</p>}
      </>}
  </div>;
}
function Orders() {
  const { orders } = useStore();
  const { message, notify, clear } = useFeedback();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('All statuses');
  const [selected, setSelected] = useState<string | null>(null);
  const [calling,setCalling]=useState<string|null>(null);
  const sendCall=async(orderId:string)=>{
    if(!functions){notify('Voice calls are unavailable because the Vercel server API is not configured.');return;}
    setCalling(orderId);
    try{const response=await httpsCallable(functions,'adminSendVoiceConfirmationCall')({orderId});const result=response.data as {status?:string;reason?:string};notify(result.status==='skipped'?`Voice call skipped: ${result.reason||'provider is not configured.'}`:'Confirmation call dispatched.');}
    catch(error){notify(error instanceof Error?error.message:'The call could not be dispatched. Check Voice & IVR settings.');}
    finally{setCalling(null);}
  };
  const order = orders.find(o => o.id === selected);
  const filtered = orders.filter(o => `${o.id} ${o.fullName} ${o.email} ${o.city}`.toLowerCase().includes(query.toLowerCase()) && (status === 'All statuses' || o.status === status));
  const statuses = ['Pending', 'Processing', 'Confirmed by Call', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled'];
  return <>
    <PageHead kicker="Fulfilment" title="Orders" subtitle="Review customer details, update fulfilment and keep tracking information current." />
    <div className="ad-stats" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }}>
      {statuses.filter(s=>s!=='Confirmed by Call').slice(0, 3).map(s => <div className="ad-stat" key={s}><div className="ad-stat-label">{s}</div><div className="ad-stat-value">{orders.filter(o => o.status === s).length.toString().padStart(2, '0')}</div><div className="ad-stat-foot">{s === 'Pending' ? 'Needs review' : s === 'Processing' ? 'Being prepared' : 'With courier'}</div></div>)}
    </div>
    <div className="ad-toolbar"><div className="ad-search"><Search /><Input placeholder="Search order, customer or city" value={query} onChange={e => setQuery(e.target.value)} data-testid="input-order-search" /></div><Select value={status} onChange={e => setStatus(e.target.value)} style={{ width: 160 }} data-testid="select-order-status"><option>All statuses</option>{statuses.map(s => <option key={s}>{s}</option>)}</Select><span style={{ marginLeft: 'auto', color: '#92877c', fontSize: 10 }}>{filtered.length} orders</span></div>
    <Card title="All orders" note="Click an order to inspect its customer and line items">
      {filtered.length ? <div className="ad-table-wrap"><table className="ad-table"><thead><tr><th>Order</th><th>Customer</th><th>Placed</th><th>Items</th><th>Total</th><th>Status</th><th>Voice call</th><th /></tr></thead><tbody>{filtered.map(o => <tr key={o.id} data-testid={`row-order-${o.id}`}><td><div className="ad-item-name">{o.id}</div><div className="ad-item-sub">{o.city}</div></td><td><div className="ad-item-name">{o.fullName}</div><div className="ad-item-sub">{o.email}</div></td><td>{dateLabel(o.createdAt)}</td><td>{o.items.reduce((n, l) => n + l.quantity, 0)} items</td><td><strong>{pkr(o.grandTotal)}</strong></td><td><Badge>{o.status}</Badge></td><td><Badge tone={o.voiceCall?.status==='confirmed'?'green':o.voiceCall?.status==='failed'||o.voiceCall?.status==='cancelled'?'rose':'amber'}>{o.voiceCall?.status==='confirmed'?'Confirmed via key 1':o.voiceCall?.status==='cancelled'?'Cancelled via key 2':o.voiceCall?.status==='failed'?'Call failed':o.voiceCall?.status==='dispatched'?'Call dispatched':'Not called'}</Badge></td><td><div className="ad-actions-row"><Button className="small" disabled={calling===o.id||o.paymentMethod!=='COD'||o.voiceCall?.status==='dispatched'} onClick={()=>void sendCall(o.id)} data-testid={`button-send-voice-call-${o.id}`}><PhoneCall/>{calling===o.id?'Calling…':'Send call'}</Button><Button className="small" onClick={() => setSelected(o.id)} data-testid={`button-view-order-${o.id}`}><Eye /> View</Button></div></td></tr>)}</tbody></table></div> : <Empty title={query ? 'No matching orders' : 'No orders to show'} body={query ? 'Try adjusting your search or status filter.' : 'Orders will appear here after a customer checks out.'} />}</Card>
    {order && <Modal title={`Order ${order.id}`} description={`Placed ${dateLabel(order.createdAt)} · ${order.city}, Pakistan`} onClose={() => setSelected(null)} footer={<><Button className="primary" disabled={calling===order.id||order.paymentMethod!=='COD'} onClick={()=>void sendCall(order.id)}><PhoneCall/>{calling===order.id?'Calling…':'Send Confirmation Call'}</Button><Button onClick={() => setSelected(null)}>Done</Button></>}>
      <div className="ad-notice">Voice call: {order.voiceCall?.status||'Not called'}{order.voiceCall?.callSid&&` · ${order.voiceCall.callSid}`}</div>
      {!!order.voiceCall?.events?.length&&<div className="ad-form-stack" style={{marginBottom:16}}>{order.voiceCall.events.slice(-6).map((event,index)=><div className="ad-item-sub" key={`${event.createdAt}-${index}`}>{dateLabel(event.createdAt)} — {event.message}</div>)}</div>}
      <div className="ad-grid two" style={{ marginBottom: 19 }}>
        <div><div className="ad-kicker">Customer</div><p className="ad-item-name" style={{ marginTop: 8 }}>{order.fullName}</p><p className="ad-item-sub">{order.email} · {order.phone}</p><p className="ad-item-sub">{order.address}{order.addressLine2?`, ${order.addressLine2}`:''}, {order.city}, {order.province}</p>{order.customerNote&&<p className="ad-item-sub">Customer note: {order.customerNote}</p>}</div>
        <div><div className="ad-kicker">Payment summary</div><div className="ad-item-sub" style={{ marginTop: 8 }}>Method <span style={{ float: 'right' }}>{order.paymentMethod==='BANK_TRANSFER'?'Bank transfer':order.paymentMethod==='EASYPAISA'?'Easypaisa':order.paymentMethod==='JAZZCASH'?'JazzCash':'Cash on delivery'}</span></div>{order.transactionReference&&<div className="ad-item-sub" style={{ marginTop: 5 }}>Customer reference <span style={{ float: 'right' }}>{order.transactionReference}</span></div>}<PaymentVerification order={order} onSaved={()=>{void notify('Payment verification recorded');}}/><div className="ad-item-sub" style={{ marginTop: 8 }}>Subtotal <span style={{ float: 'right' }}>{pkr(order.subtotal)}</span></div>{(order.quantityTierDiscount??0)>0&&<div className="ad-item-sub" style={{ marginTop: 5 }}>Quantity savings <span style={{ float: 'right', color: '#60705d' }}>− {pkr(order.quantityTierDiscount!)}</span></div>}<div className="ad-item-sub" style={{ marginTop: 5 }}>Delivery <span style={{ float: 'right' }}>{pkr(order.deliveryCharge)}</span></div><div className="ad-item-name" style={{ marginTop: 9 }}>Total <span style={{ float: 'right' }}>{pkr(order.grandTotal)}</span></div></div>
      </div>
      <div className="ad-kicker" style={{ marginBottom: 8 }}>Items in this order</div>
       <div style={{ borderTop: '1px solid var(--ad-border)', marginBottom: 18 }}>{order.items.map((line, i) => <div key={`${line.key}-${i}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #eee7df', fontSize: 10 }}><span>{line.product.name} {(line.variant!=='Standard'||(line.product.variants?.length??0)>0)&&<span style={{ color: '#958a7f' }}>· {line.variant}</span>} × {line.quantity}</span><strong>{pkr(line.product.price * line.quantity)}</strong></div>)}</div>
      <FulfillmentEditor key={order.id} order={order} onSaved={()=>{void notify('Fulfillment details saved');}}/>
    </Modal>}
    {message && <Toast text={message} onClose={clear} />}
  </>;
}

const PRODUCT_EDITOR_SESSION_KEY='nura-admin-product-editor-v1';
function Products() {
  const [searchParams,setSearchParams]=useSearchParams();
  const selectedView=searchParams.get('view')==='variants'?'variants':searchParams.get('view')==='stock'?'stock':'all';
  const { products, categories, updateProduct, deleteProduct } = useStore();
  const {data:adminData,flush,catalogReady}=useAdminStore();
  const { notify, message, clear } = useFeedback();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All categories');
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [errors, setErrors] = useState('');
  const [editorTab,setEditorTab]=useState<'details'|'variations'|'seo'>('details');
  const [pendingUploads,setPendingUploads]=useState<Array<{preview:string;file:File}>>([]);
  const pendingUploadsRef=useRef<Array<{preview:string;file:File}>>([]);
  const [compressionRetryPreview,setCompressionRetryPreview]=useState<string|null>(null);
  const [saving,setSaving]=useState(false);
  const [saveProgress,setSaveProgress]=useState('');
  const [isCreate, setIsCreate] = useState(false);
  const emptyProduct = (): Product => ({ id: Math.max(0, ...products.map(p => p.id)) + 1, name: '', category: categories[0]?.name || '', brand: '', price: 0, image: '', shade: '#eee6dd', stock: 0, freeDeliveryEligible: false, cashOnDeliveryEnabled: false, inStock: false, status:'active', features:[] });
  const [draft, setDraft] = useState<Product>(emptyProduct);
  const filtered = products.filter(p => `${p.name} ${p.category} ${p.brand || ''}`.toLowerCase().includes(query.toLowerCase()) && (category === 'All categories' || p.category === category) && (selectedView==='variants'?Boolean(p.variationTypes?.length):selectedView==='stock'?p.stock<=5:true));
  const restoreAttempted=useRef(false);
  useEffect(()=>{
    if(!catalogReady||restoreAttempted.current)return;
    try{
      const raw=sessionStorage.getItem(PRODUCT_EDITOR_SESSION_KEY);
      if(!raw){restoreAttempted.current=true;return;}
      const saved=JSON.parse(raw) as {isCreate?:unknown;productId?:unknown;editorTab?:unknown;draft?:unknown};
      if(!saved.draft||typeof saved.draft!=='object'||typeof (saved.draft as Product).name!=='string'){restoreAttempted.current=true;return;}
      const restored={...(saved.draft as Product),image:typeof (saved.draft as Product).image==='string'?(saved.draft as Product).image:'',images:Array.isArray((saved.draft as Product).images)?(saved.draft as Product).images!.filter((url):url is string=>typeof url==='string'):[],variantMatrix:Array.isArray((saved.draft as Product).variantMatrix)?(saved.draft as Product).variantMatrix!.filter(variant=>variant&&typeof variant==='object'):[]};
      const lostFilePreview=[restored.image,...(restored.images??[]),...(restored.variantMatrix??[]).map(variant=>typeof variant.image==='string'?variant.image:'')].some(url=>url.startsWith('blob:')||url.startsWith('data:'));
      restored.image=/^(blob:|data:)/i.test(restored.image)?'':restored.image;
      restored.images=(restored.images??[]).filter(url=>! /^(blob:|data:)/i.test(url));
      restored.variantMatrix=(restored.variantMatrix??[]).map(variant=>({...variant,image:variant.image&&/^(blob:|data:)/i.test(variant.image)?undefined:variant.image}));
      const create=saved.isCreate===true;
      const existing=products.find(product=>product.id===Number(saved.productId));
      if(!create&&!existing)return;
      restoreAttempted.current=true;
      setDraft(restored);
      setEditing(create?null:existing??null);
      setIsCreate(create);
      setEditorTab(saved.editorTab==='variations'||saved.editorTab==='seo'?saved.editorTab:'details');
      if(lostFilePreview)setErrors('The product draft was restored. Image files selected before leaving this tab cannot be recovered; select them again before saving.');
    }catch{
      restoreAttempted.current=true;
      try{sessionStorage.removeItem(PRODUCT_EDITOR_SESSION_KEY);}catch{}
    }
  },[catalogReady,products]);
  useEffect(()=>{
    if(!restoreAttempted.current)return;
    try{
      if(!editing&&!isCreate){sessionStorage.removeItem(PRODUCT_EDITOR_SESSION_KEY);return;}
      const persistable={...draft,
        image:/^(blob:|data:)/i.test(draft.image)?'':draft.image,
        images:(draft.images??[]).filter(url=>! /^(blob:|data:)/i.test(url)),
        variantMatrix:(draft.variantMatrix??[]).map(variant=>({...variant,image:variant.image&&/^(blob:|data:)/i.test(variant.image)?undefined:variant.image})),
      };
      sessionStorage.setItem(PRODUCT_EDITOR_SESSION_KEY,JSON.stringify({isCreate,productId:editing?.id??null,editorTab,draft:persistable}));
    }catch{/* An unavailable session store must not block product editing. */}
  },[draft,editing,isCreate,editorTab]);
  const commitPendingUploads=(next:Array<{preview:string;file:File}>)=>{pendingUploadsRef.current=next;setPendingUploads(next);};
  const clearPendingUploads=()=>{pendingUploadsRef.current.forEach(item=>URL.revokeObjectURL(item.preview));commitPendingUploads([]);};
  const startEdit = (p?: Product) => { clearPendingUploads();setCompressionRetryPreview(null);setDraft(p ? { ...p,status:p.status??'active',features:p.features??[],variationTypes:p.variationTypes??[],variantMatrix:p.variantMatrix??[] } : emptyProduct()); setEditing(p || null); setErrors(''); setEditorTab('details'); setIsCreate(!p); };
  useEffect(()=>{const id=searchParams.get('find');if(!id)return;const product=products.find(item=>String(item.id)===id);if(!product)return;startEdit(product);setSearchParams({}, {replace:true});},[searchParams,products,setSearchParams]);
  const [cleaningDemo,setCleaningDemo]=useState(false);
  const purgeDemoProducts=async()=>{
    const demoProducts=products.filter(product=>product.name.trim().startsWith('[DEMO]'));
    if(!demoProducts.length){await notify('No explicitly marked [DEMO] products were found. No catalogue data was changed.',false);return;}
     if(!window.confirm(`Permanently remove ${demoProducts.length} [DEMO] products and their unused product images from Supabase? Other catalogue entries and referenced images will be kept.`))return;
    setCleaningDemo(true);
    try{
      const storage=await getSupabaseStorage();
      const urls=[...new Set(demoProducts.flatMap(product=>[product.image,...(product.images??[]),...(product.variantMatrix??[]).map(variant=>variant.image??'')]).filter(Boolean))];
      demoProducts.forEach(product=>deleteProduct(product.id));
      const result=await flush('products');
       if(result!=='remote')throw new Error('Demo products are only saved locally. Sync them to Supabase before removing their image files.');
      const remainingProducts=products.filter(product=>!demoProducts.some(demo=>demo.id===product.id));
      const otherData=JSON.stringify({...adminData,products:remainingProducts});
       let removedImages=0,keptImages=0,failedImages=0;
      for(const url of urls){
           if(otherData.includes(url)||!storage){keptImages++;continue;}
          const assetRef=storageRef(storage,url);
          if(assetRef.bucket!==defaultBucket||!assetRef.fullPath.startsWith('store/')){keptImages++;continue;}
         try{
             await deleteObject(assetRef);
           if(db)await deleteDoc(doc(db,'mediaAssets',assetRef.name)).catch(error=>console.warn('[demo-cleanup] Storage asset was removed, but its media index could not be deleted.',error));
           removedImages++;
         }catch(error){
           failedImages++;
            console.error('[demo-cleanup] Could not remove an unused demo image from Supabase Storage.',error);
         }
      }
       await notify(`Removed ${demoProducts.length} explicitly marked demo products and ${removedImages} unused linked images${keptImages?`; kept ${keptImages} shared, external, or non-Storage images`:''}${failedImages?`; ${failedImages} image deletions failed and need review`:''}. Review Media Library for any unlinked sample banner/logo files.`,false);
    }catch(error){
      await notify(`Demo cleanup stopped: ${error instanceof Error?error.message:'Please retry.'}`,false);
    }finally{setCleaningDemo(false);}
  };
  const stageProductFile=(file:File,apply:(current:Product,preview:string)=>Product,replacePreview?:string)=>{
    if(!file||typeof file.arrayBuffer!=='function'||file.size===0){setErrors('The selected file is empty or unavailable. Choose the image again.');return;}
    const preview=URL.createObjectURL(file);
    const current=pendingUploadsRef.current;
    const replaced=current.filter(item=>item.preview!==replacePreview);
    if(replacePreview&&replaced.length!==current.length)URL.revokeObjectURL(replacePreview);
    if(replacePreview===compressionRetryPreview)setCompressionRetryPreview(null);
    commitPendingUploads([...replaced,{preview,file}]);
    setDraft(current=>apply(current,preview));
  };
  const replaceUploadedUrls=(product:Product,urls:Map<string,string>):Product=>({
    ...product,
    image:urls.get(product.image)??product.image,
    images:product.images?.map(url=>urls.get(url)??url),
    variantMatrix:product.variantMatrix?.map(variant=>({...variant,image:variant.image?urls.get(variant.image)??variant.image:undefined})),
  });
  async function submit(e?: { preventDefault: () => void }, uploadOriginalPreview?: string) {
    e?.preventDefault();
    if(saving)return;
    if (!draft.name.trim() || !categories.some(item=>item.name===draft.category) || !draft.image.trim() || !Number.isFinite(draft.price) || draft.price <= 0 || !Number.isInteger(draft.stock) || draft.stock < 0 || (draft.oldPrice!==undefined&&draft.oldPrice<=draft.price)) { setErrors('Add a name, valid category, an uploaded or selected primary image, a positive price, whole stock count and a compare-at price above the sale price.'); return; }
    if(draft.quantityDiscounts?.mode==='custom'){
      const tierError=validateQuantityDiscountTiers(draft.quantityDiscounts.tiers);
      if(tierError){setErrors(tierError);return;}
    }
    const variationError=validateProductVariations(draft.variationTypes??[],draft.variantMatrix??[]);
    if(variationError){setErrors(variationError);setEditorTab('variations');return;}
    const variantStock=(draft.variantMatrix??[]).reduce((sum,item)=>sum+item.stock,0);
    const lowestVariant=[...(draft.variantMatrix??[])].sort((left,right)=>left.price-right.price)[0];
    setSaving(true);setErrors('');
    try{
      let savedDraft=draft;
      const completed=new Map<string,string>();
      const uploads=[...pendingUploadsRef.current];
      for(let index=0;index<uploads.length;index++){
        const pending=uploads[index];
        if(!pending.file||typeof pending.file.arrayBuffer!=='function'||pending.file.size===0){
          setErrors('The selected image file is no longer available. Choose it again, then save.');
          return;
        }
         setSaveProgress(`Preparing image ${index+1} of ${uploads.length}`);
        try{
            const shouldCompress=adminData.settings.general.autoCompressUploads!==false&&pending.preview!==uploadOriginalPreview;
            const uploaded=await uploadStoreAsset(pending.file,'products',shouldCompress,{
              onProgress:(progress:ImageUploadProgress)=>setSaveProgress(`${progress.stage==='compressing'?'Optimizing':'Uploading'} image ${index+1} of ${uploads.length} · ${progress.percent}%`),
          });
            completed.set(pending.preview,uploaded.url);
        }catch(failure){
          savedDraft=replaceUploadedUrls(savedDraft,completed);
          setDraft(savedDraft);
          const remaining=uploads.slice(index);
          commitPendingUploads(remaining);
          uploads.slice(0,index).forEach(item=>URL.revokeObjectURL(item.preview));
          const canRetryOriginal=failure instanceof ImageCompressionUnavailableError||pending.preview===uploadOriginalPreview;
          setCompressionRetryPreview(canRetryOriginal?pending.preview:null);
          setErrors(`${failure instanceof Error?failure.message:'Image upload failed.'} Your selected image is still attached; ${canRetryOriginal?'use the original-file retry button to continue.':'click Save product to retry.'}`);
          return;
        }
      }
      setCompressionRetryPreview(null);
      savedDraft=replaceUploadedUrls(savedDraft,completed);
      setDraft(savedDraft);
      uploads.forEach(item=>URL.revokeObjectURL(item.preview));
      commitPendingUploads([]);
      const preparedProduct:Product={...savedDraft,...(savedDraft.variationTypes?.length&&lowestVariant?{price:lowestVariant.price,oldPrice:lowestVariant.oldPrice,fromPrice:true}:{}),stock:savedDraft.variationTypes?.length?variantStock:savedDraft.stock,name:savedDraft.name.trim(),brand:savedDraft.brand?.trim()||undefined,...(isCreate?{createdAt:new Date().toISOString()}:{}),inStock:(savedDraft.variationTypes?.length?variantStock:savedDraft.stock)>0};
       if(!preparedProduct.image)throw new Error('The primary image was not attached to the product. Select it again before saving.');
      const finalProductBytes=estimateSerializedProductSize(preparedProduct);
      if(finalProductBytes>PRODUCT_DOCUMENT_SAFE_SIZE_BYTES){
        throw new Error(`This product document is approximately ${formatSize(finalProductBytes)}, above the safe ${formatSize(PRODUCT_DOCUMENT_SAFE_SIZE_BYTES)} limit. Remove large embedded images or shorten product details, then save again.`);
      }
      updateProduct(preparedProduct);
      setSaveProgress('Saving product to Supabase…');
      const result=await flush('products');
      if(result!=='remote')throw new Error('The product is saved on this device but Supabase could not confirm it. Check your connection and retry Save product.');
       setEditing(null);setIsCreate(false);try{sessionStorage.removeItem(PRODUCT_EDITOR_SESSION_KEY);}catch{}notify(isCreate?'Product added to Supabase':'Product changes saved');
    }catch(failure){
      console.error('[product-save] Product could not be saved.',failure);
      setErrors(failure instanceof Error?failure.message:'Product save failed. Check your connection and retry.');
    }finally{setSaving(false);setSaveProgress('');}
  }
  const updateVariationTypes=(types:ProductVariationType[])=>setDraft(previous=>{const next=buildProductVariantMatrix(types,previous.variantMatrix??[]);return {...previous,variationTypes:types,variantMatrix:types.length&&!next.length?(previous.variantMatrix??[]):next};});
  const updateVariant=(id:string,patch:Partial<ProductVariant>)=>setDraft(previous=>({...previous,variantMatrix:(previous.variantMatrix??[]).map(variant=>variant.id===id?{...variant,...patch}:variant)}));
  const addVariationType=()=>updateVariationTypes([...(draft.variationTypes??[]),{id:`option-${Date.now()}`,name:'',values:[]}]);
  const setQuantityDiscountMode=(mode:'global'|'custom'|'disabled')=>setDraft(previous=>{
    if(mode==='global'){
      const {quantityDiscounts:_quantityDiscounts,...product}=previous;
      return product;
    }
    const tiers=previous.quantityDiscounts?.mode==='custom'?previous.quantityDiscounts.tiers:[];
    return {...previous,quantityDiscounts:{mode,tiers} as ProductQuantityDiscountOverride};
  });
  const setProductQuantityTiers=(tiers:QuantityDiscountTier[])=>setDraft(previous=>({...previous,quantityDiscounts:{mode:'custom',tiers}}));
  const productImages=[...new Set([draft.image,...(draft.images??[])].filter(Boolean))];
  const estimatedProductBytes=useMemo(
    ()=>estimateSerializedProductSize(draft,pendingUploads.map(item=>item.preview)),
    [draft,pendingUploads],
  );
  const remainingProductBytes=PRODUCT_DOCUMENT_SAFE_SIZE_BYTES-estimatedProductBytes;
  const formatSize=(bytes:number)=>(Math.max(0,bytes)/1024).toLocaleString(undefined,{maximumFractionDigits:1})+' KB';
   const addProductImage=(url:string)=>setDraft(previous=>{
    const images=[...new Set([...(previous.images??[]),url])];
    return {...previous,image:previous.image||url,images:previous.image?[...new Set([previous.image,...images])]:images};
  });
   const replaceProductImage=(oldUrl:string,newUrl:string)=>setDraft(previous=>{
    const images=[...new Set([...(previous.images??[]).map(url=>url===oldUrl?newUrl:url),previous.image===oldUrl?newUrl:previous.image].filter(Boolean))];
    return {...previous,image:previous.image===oldUrl?newUrl:previous.image,images};
  });
   const removeProductImage=(url:string)=>{const current=pendingUploadsRef.current;const removed=current.find(item=>item.preview===url);if(removed)URL.revokeObjectURL(removed.preview);commitPendingUploads(current.filter(item=>item.preview!==url));setDraft(previous=>{
    const remaining=[...new Set([previous.image,...(previous.images??[])].filter(image=>image&&image!==url))];
    const image=previous.image===url?(remaining[0]??''):previous.image;
    return {...previous,image,images:remaining};
   });};
  const removeVariantImage=(variantId:string,url?:string)=>{
    if(url){const current=pendingUploadsRef.current;const removed=current.find(item=>item.preview===url);if(removed)URL.revokeObjectURL(removed.preview);commitPendingUploads(current.filter(item=>item.preview!==url));}
    updateVariant(variantId,{image:undefined});
  };
  const closeProductEditor=()=>{if(saving)return;clearPendingUploads();setEditing(null);setIsCreate(false);try{sessionStorage.removeItem(PRODUCT_EDITOR_SESSION_KEY);}catch{}};
  return <>
    <PageHead kicker="Catalogue" title="Products" subtitle="Keep names, pricing, imagery and stock levels in good order." action={<div className="ad-actions-row">{products.some(product=>product.name.trim().startsWith('[DEMO]'))&&<Button onClick={()=>void purgeDemoProducts()} disabled={cleaningDemo} data-testid="button-purge-demo-products">{cleaningDemo?'Cleaning demo data…':'Remove demo products & images'}</Button>}<Button className="primary" onClick={() => startEdit()} data-testid="button-add-product"><Plus /> Add product</Button></div>} />
    <div className="ad-quick-jump" aria-label="Catalog views"><button type="button" className={selectedView==='all'?'active':''} onClick={()=>setSearchParams({})}>All products</button><button type="button" className={selectedView==='variants'?'active':''} onClick={()=>setSearchParams({view:'variants'})}>Variants manager</button><button type="button" className={selectedView==='stock'?'active':''} onClick={()=>setSearchParams({view:'stock'})}>Stock levels</button></div>
    <div className="ad-stats" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }}><div className="ad-stat"><div className="ad-stat-label">Total products</div><div className="ad-stat-value">{products.length}</div><div className="ad-stat-foot">Across your catalogue</div></div><div className="ad-stat"><div className="ad-stat-label">Low stock</div><div className="ad-stat-value">{products.filter(p => p.stock <= 5).length}</div><div className="ad-stat-foot">Five units or fewer</div></div><div className="ad-stat"><div className="ad-stat-label">Out of stock</div><div className="ad-stat-value">{products.filter(p => p.stock === 0).length}</div><div className="ad-stat-foot">Needs a stock update</div></div></div>
     <div className="ad-toolbar"><div className="ad-search"><Search /><Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search products" data-testid="input-product-search" /></div><Select value={category} onChange={e => setCategory(e.target.value)} style={{ width: 170 }} data-testid="select-product-category"><option>All categories</option>{categories.map(c => <option key={c.id}>{c.name}</option>)}</Select><span style={{ marginLeft: 'auto', fontSize: 10, color: '#958a7f' }}>{filtered.length} products</span></div>
    <Card title="Product catalogue" note="Stock, pricing and storefront visibility">
       {filtered.length ? <div className="ad-table-wrap"><table className="ad-table"><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th>Delivery</th><th /></tr></thead><tbody>{filtered.map(p => <tr key={p.id} data-testid={`row-product-${p.id}`}><td><div className="ad-product-row"><img className="ad-product-thumb" src={p.image} alt="" loading="lazy" decoding="async" style={{ objectFit: 'contain', objectPosition: 'center', background: p.shade }} /><div><div className="ad-item-name">{p.name}</div><div className="ad-item-sub">SKU #{p.id}</div></div></div></td><td>{p.category}</td><td><strong>{pkr(p.price)}</strong>{p.oldPrice && <div className="ad-item-sub" style={{ textDecoration: 'line-through' }}>{pkr(p.oldPrice)}</div>}</td><td><Badge tone={p.stock <= 5 ? 'amber' : 'green'}>{p.stock === 0 ? 'Out of stock' : `${p.stock} units`}</Badge></td><td><Badge tone={p.status==='active'?'green':p.status==='draft'?'amber':'gray'}>{p.status??'active'}</Badge></td><td>{p.freeDeliveryEligible ? <Badge tone="green">Eligible</Badge> : <span className="ad-item-sub">Standard</span>}</td><td style={{ whiteSpace: 'nowrap' }}><button className="ad-icon-btn" aria-label={`Edit ${p.name}`} onClick={() => startEdit(p)} data-testid={`button-edit-product-${p.id}`}><Pencil /></button><button className="ad-icon-btn" aria-label={`Delete ${p.name}`} onClick={() => setDeleting(p)} data-testid={`button-delete-product-${p.id}`}><Trash2 /></button></td></tr>)}</tbody></table></div> : <Empty title={query ? 'No products found' : 'Your catalogue is empty'} body="Try another search, or add a product to start building the catalogue." action={<Button className="primary" onClick={() => startEdit()}><Plus /> Add product</Button>} />}
    </Card>
     {(editing || isCreate) && <Modal title={isCreate ? 'Add product' : `Edit ${editing?.name}`} description="Product images are optimized and saved with the product in Supabase when you save." onClose={closeProductEditor} closeDisabled={saving} footer={<><Button onClick={closeProductEditor} disabled={saving}>Cancel</Button><Button className="primary" onClick={()=>void submit()} disabled={saving} data-testid="button-save-product">{saving?<><Save/> Saving…</>:<><Save/> Save product</>}</Button></>}>
        <div className="ad-tabs"><button type="button" className={`ad-tab ${editorTab==='details'?'active':''}`} onClick={()=>setEditorTab('details')} data-testid="tab-product-details">Product details</button><button type="button" className={`ad-tab ${editorTab==='variations'?'active':''}`} onClick={()=>setEditorTab('variations')} data-testid="tab-product-variations">Variations & Options</button><button type="button" className={`ad-tab ${editorTab==='seo'?'active':''}`} onClick={()=>setEditorTab('seo')} data-testid="tab-product-seo">SEO & Social</button></div>
       {editorTab==='details'&&<form onSubmit={submit} className="ad-form-stack">
         <section className="ad-product-image-manager" aria-label="Product images">
                <div className="ad-product-image-heading"><div><strong className="ad-label">Product images</strong><p className="ad-help ad-product-image-description">Choose files for a local preview. When you save, images upload to Supabase Storage and their HTTPS URLs are saved with the product in Supabase. Media Library images remain linked as-is. Recommended: 1000 × 1000 px (square 1:1).</p></div></div>
               <ImageUpload folder="products" actionLabel="Choose a product image (uploads on save)" deferUpload disabled={saving} onFileSelected={file=>stageProductFile(file,(current,preview)=>{const images=[...new Set([...(current.images??[]),preview])];return {...current,image:current.image||preview,images};})} onUploaded={addProductImage}/>
             {pendingUploads.length>0&&<p className="ad-help" role="status">{pendingUploads.length} image file{pendingUploads.length===1?'':'s'} ready to upload to Storage when you save the product.</p>}
            <div className={`ad-notice${remainingProductBytes<0?' ad-error':''}`} role={remainingProductBytes<0?'alert':'status'} aria-live="polite" data-testid="product-document-size-estimate">
              <strong>{remainingProductBytes<0?'Product document is over the safe size limit':'Estimated product document size'}</strong>
              <div className="ad-help" data-testid="product-document-size-remaining">
                {formatSize(estimatedProductBytes)} of {formatSize(PRODUCT_DOCUMENT_SAFE_SIZE_BYTES)} · {remainingProductBytes<0?`${formatSize(-remainingProductBytes)} over the safe limit`:`${formatSize(remainingProductBytes)} remaining for image data and product details`}
              </div>
              <div className="ad-help">Image files upload to Supabase Storage; this estimate counts their saved URLs and any existing embedded image data.</div>
              {remainingProductBytes<0&&<div className="ad-help">Remove large embedded images or shorten product details before saving. The final save-time size check remains authoritative.</div>}
            </div>
           {productImages.length>0&&<div className="ad-product-image-list">{productImages.map((url,index)=><article className="ad-product-image-item" key={`${url}-${index}`} data-testid={`product-image-item-${index}`}>
             <img src={url} alt={`Product image ${index+1}`} loading="lazy" />
                 <div className="ad-product-image-actions"><span className="ad-item-name">{url===draft.image?'Primary image':`Gallery image ${index}`}</span>{url!==draft.image&&<button className="ad-btn small" type="button" disabled={saving} onClick={()=>setDraft(previous=>{const images=[...new Set([url,previous.image,...(previous.images??[])].filter(Boolean))];return {...previous,image:url,images};})} data-testid={`button-set-primary-image-${index}`}>Set as primary</button>}<ImageUpload folder="products" actionLabel="Replace this image (saved on product save)" compact deferUpload disabled={saving} onFileSelected={file=>stageProductFile(file,(current,preview)=>{const images=[...new Set([...(current.images??[]).map(image=>image===url?preview:image),current.image===url?preview:current.image].filter(Boolean))];return {...current,image:current.image===url?preview:current.image,images};},url)} onUploaded={next=>replaceProductImage(url,next)}/><button className="ad-btn small danger" type="button" disabled={saving} onClick={()=>removeProductImage(url)} data-testid={`button-remove-product-image-${index}`}>Remove image</button></div>
           </article>)}</div>}
            <div className="ad-form-row"><Field label="Mobile product image URL" help="Optional portrait crop shown on small screens; leave blank to use the main product image."><Input type="url" value={draft.mobileImage||''} onChange={event=>setDraft(current=>({...current,mobileImage:event.target.value}))} data-testid="input-product-mobile-image"/><ImageUpload folder="products" onUploaded={url=>setDraft(current=>({...current,mobileImage:url}))}/></Field></div>
         </section>
        <div className="ad-form-row"><Field label="Product name"><Input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} data-testid="input-product-name" /></Field><Field label="Category"><Select value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })} data-testid="select-product-edit-category">{categories.map(c => <option key={c.id}>{c.name}</option>)}</Select></Field></div>
          <div className="ad-form-row"><Field label="Publishing status" help="Draft and archived products are hidden from customers."><Select value={draft.status??'active'} onChange={e=>setDraft({...draft,status:e.target.value as Product['status']})} data-testid="select-product-publishing-status"><option value="active">Active — visible to customers</option><option value="draft">Draft — admin only</option><option value="archived">Archived — hidden from catalogue</option></Select></Field><div className="ad-notice"><strong>Optional fields</strong><div className="ad-help">Fields marked “(optional)” can be left blank.</div></div></div>
          <Field label="Brand (optional)" help="Products with a brand assigned appear in the storefront brand filter."><Input value={draft.brand || ''} onChange={e => setDraft({ ...draft, brand: e.target.value })} data-testid="input-product-brand" /></Field>
          <Field label="Product card badge text (optional)" help="Examples: Bestseller, Hot, or New. A store-wide default can be set under Settings → Header & cards."><Input value={draft.badge||''} onChange={e=>setDraft(previous=>({...previous,badge:e.target.value}))} maxLength={40} placeholder="Bestseller" data-testid="input-product-badge-text"/></Field>
          <Field label="Product description (optional)"><Area rows={4} value={draft.description??''} onChange={e=>setDraft({...draft,description:e.target.value})} data-testid="textarea-product-description"/></Field>
          <div className="ad-form-row"><Field label="Usage instructions (optional)"><Area rows={3} value={draft.usage??''} onChange={e=>setDraft({...draft,usage:e.target.value})} data-testid="textarea-product-usage"/></Field><Field label="Shipping information (optional)"><Area rows={3} value={draft.shippingInfo??''} onChange={e=>setDraft({...draft,shippingInfo:e.target.value})} data-testid="textarea-product-shipping-info"/></Field></div>
          <Field label="Key benefits (optional)" help="Enter one benefit per line. These appear as tick points on the product page."><Area rows={4} value={(draft.features??[]).join('\n')} onChange={e=>setDraft({...draft,features:e.target.value.split('\n').map(value=>value.trim()).filter(Boolean)})} placeholder={'Hydrating daily formula\nSuitable for sensitive skin'} data-testid="textarea-product-benefits"/></Field>
          <Field label="Additional information (optional)" help="Add specifications such as skin type, material, size, or care instructions. Use one detail per line."><Area rows={4} value={draft.additionalInfo??''} onChange={e=>setDraft({...draft,additionalInfo:e.target.value})} placeholder={'Skin type: All skin types\nSize: 50 ml'} data-testid="textarea-product-additional-info"/></Field>
        <div className="ad-form-row"><Field label="Price (PKR)"><Input type="number" min="1" value={draft.price || ''} onChange={e => setDraft({ ...draft, price: Number(e.target.value) })} data-testid="input-product-price" /></Field><Field label="Compare-at price (optional)"><Input type="number" min="0" value={draft.oldPrice || ''} onChange={e => setDraft({ ...draft, oldPrice: e.target.value ? Number(e.target.value) : undefined })} data-testid="input-product-old-price" /></Field></div>
         <div className="ad-form-row"><Field label="Stock units"><Input type="number" min="0" step="1" value={draft.stock} onChange={e => setDraft({ ...draft, stock: Number(e.target.value), inStock: Number(e.target.value) > 0 })} data-testid="input-product-stock" /></Field><Field label="Shade / image backdrop (optional)"><Input value={draft.shade} onChange={e => setDraft({ ...draft, shade: e.target.value })} data-testid="input-product-shade" /></Field></div>
          <label className="ad-checkline"><input type="checkbox" checked={draft.freeDeliveryEligible} onChange={e => setDraft({ ...draft, freeDeliveryEligible: e.target.checked })} data-testid="checkbox-free-delivery" /> Eligible for free delivery</label>
         <label className="ad-checkline"><input type="checkbox" checked={draft.cashOnDeliveryEnabled===true} onChange={e => setDraft({ ...draft, cashOnDeliveryEnabled: e.target.checked })} data-testid="checkbox-product-cod" /> Allow cash on delivery for this product</label><div className="ad-help">Cash on delivery is offered only when every product in the cart is enabled here and the store-wide setting is on.</div>
         <Field label="Quantity discount rule" help="Choose whether this product follows the store-wide tiers, uses its own tiers, or has no volume discount.">
           <Select value={draft.quantityDiscounts?.mode??'global'} onChange={event=>setQuantityDiscountMode(event.target.value as 'global'|'custom'|'disabled')} data-testid="select-product-quantity-discount-mode"><option value="global">Use store-wide tiers</option><option value="custom">Set product-specific tiers</option><option value="disabled">Disable tiers for this product</option></Select>
         </Field>
         {draft.quantityDiscounts?.mode==='custom'&&<div className="ad-notice"><strong>Product-specific tiers</strong><div className="ad-help" style={{marginTop:6,marginBottom:12}}>These tiers replace the store-wide rules for this product. Fixed savings are applied per item.</div><QuantityTierEditor tiers={draft.quantityDiscounts.tiers} onChange={setProductQuantityTiers} testIdPrefix="product-quantity"/></div>}
       </form>}
        {editorTab==='variations'&&<div className="ad-form-stack" data-testid="product-variations-builder">
          <div className="ad-notice">Add option types such as Size, Weight, Color or Material. The combination matrix preserves values when options change. Products without options keep using their base price and stock.</div>
          {(draft.variationTypes??[]).map((type,index)=><div className="ad-card" key={type.id}><div className="ad-card-body ad-form-stack">
            <div className="ad-form-row"><Field label={`Option type ${index+1}`}><Input value={type.name} placeholder="e.g. Size" onChange={event=>updateVariationTypes((draft.variationTypes??[]).map(item=>item.id===type.id?{...item,name:event.target.value}:item))}/></Field><Field label="Values (comma separated)" help="Example: 100g, 225g, 500g"><Input value={type.valuesText??type.values.join(', ')} placeholder="Amber, Rose, Sage" onChange={event=>{const values=[...new Set(event.target.value.split(',').map(value=>value.trim()).filter(Boolean))];updateVariationTypes((draft.variationTypes??[]).map(item=>item.id===type.id?{...item,values,valuesText:event.target.value}:item));}}/></Field><button className="ad-btn small" type="button" onClick={()=>updateVariationTypes((draft.variationTypes??[]).filter(item=>item.id!==type.id))}>Remove</button></div>
          </div></div>)}
          <button className="ad-btn" type="button" onClick={addVariationType} data-testid="button-add-variation-type"><Plus size={14}/> Add variation type</button>
             {(draft.variantMatrix?.length??0)>0&&<div className="ad-table-wrap"><table className="ad-table"><thead><tr><th>Combination</th><th>Price PKR</th><th>Compare-at (optional)</th><th>Stock</th><th>SKU (optional)</th><th>Image override (optional)</th></tr></thead><tbody>{draft.variantMatrix?.map(variant=><tr key={variant.id} data-testid={`row-variant-${variant.id}`}><td><strong>{variant.label}</strong></td><td><Input type="number" min="1" value={variant.price||''} aria-label={`${variant.label} price`} onChange={event=>updateVariant(variant.id,{price:Number(event.target.value)})}/></td><td><Input type="number" min="0" value={variant.oldPrice??''} aria-label={`${variant.label} compare-at price (optional)`} onChange={event=>updateVariant(variant.id,{oldPrice:event.target.value?Number(event.target.value):undefined})}/></td><td><Input type="number" min="0" step="1" value={variant.stock} aria-label={`${variant.label} stock`} onChange={event=>updateVariant(variant.id,{stock:Number(event.target.value)})}/></td><td><Input value={variant.sku} aria-label={`${variant.label} SKU (optional)`} onChange={event=>updateVariant(variant.id,{sku:event.target.value})}/></td><td><div className="ad-variant-image-field">{variant.image&&<div className="ad-variant-image-preview"><img src={variant.image} alt={`${variant.label} image override`} loading="lazy"/><button type="button" className="ad-btn small danger" disabled={saving} onClick={()=>removeVariantImage(variant.id,variant.image)} aria-label={`Remove ${variant.label} image`}>Remove</button></div>}<ImageUpload folder="products" actionLabel={variant.image?'Choose replacement image (uploads on save)':'Choose variant image (uploads on save)'} compact deferUpload disabled={saving} onFileSelected={file=>stageProductFile(file,(current,preview)=>({...current,variantMatrix:(current.variantMatrix??[]).map(item=>item.id===variant.id?{...item,image:preview}:item)}),variant.image)} onUploaded={url=>updateVariant(variant.id,{image:url})}/></div></td></tr>)}</tbody></table></div>}
        </div>}
       {editorTab==='seo'&&<SeoSocialFields prefix="product" hideImageUrlInput value={draft.seo} source={{title:draft.name,description:draft.description,category:draft.category,brand:draft.brand,imageUrl:draft.image,siteName:adminData.settings.general.storeName}} onChange={seo=>setDraft(previous=>({...previous,seo}))}/>}
       {saving&&<div className="ad-notice" role="status" aria-live="polite">{saveProgress||'Saving product…'}</div>}
        {errors && <div className="ad-error" role="alert">{errors}{compressionRetryPreview&&<div><button type="button" className="ad-btn small" disabled={saving} onClick={()=>void submit(undefined,compressionRetryPreview)} data-testid="button-retry-product-image-original">Retry image upload with original file</button></div>}</div>}
    </Modal>}
    {deleting && <Modal title="Delete product?" description={deleting.name} onClose={() => setDeleting(null)} footer={<><Button onClick={() => setDeleting(null)}>Keep product</Button><Button className="danger" onClick={() => { deleteProduct(deleting.id); setDeleting(null); notify('Product removed from the local catalogue'); }} data-testid="button-confirm-delete-product"><Trash2 /> Delete product</Button></>}>
      <div className="ad-notice">This removes the product from Supabase. Existing order line items are not changed.</div>
    </Modal>}
    {message && <Toast text={message} onClose={clear} />}
  </>;
}

function Categories() {
  const { categories, products, saveCategory, deleteCategory } = useStore();
  const {data:adminData,setData}=useAdminStore();
  const categoryBrowsing=normalizeCatalogBrowsingSettings(adminData.settings?.catalogBrowsing);
  const categoryFilterIndex=categoryBrowsing.filterSections.findIndex(section=>section.kind==='categories');
  const categoryFilter=categoryFilterIndex>=0?categoryBrowsing.filterSections[categoryFilterIndex]:undefined;
  const updateCategoryBrowsing=(update:(current:typeof categoryBrowsing)=>typeof categoryBrowsing)=>setData(previous=>({...previous,settings:{...previous.settings,catalogBrowsing:update(normalizeCatalogBrowsingSettings(previous.settings?.catalogBrowsing))}}));
  const { message, notify, clear } = useFeedback();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<StoreCategory>({ id: '', name: '', image: '', sub: '', color: '#e9e3d9' });
  const [isCreate, setIsCreate] = useState(false);
  const [editorTab,setEditorTab]=useState<'details'|'seo'>('details');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState('');
  const begin = (category?: typeof categories[number]) => {
    setDraft(category ? { ...category } : { id: idFor(), name: '', image: '', sub: '', color: '#e9e3d9' });
    setEditingId(category?.id || null); setIsCreate(!category); setError(''); setEditorTab('details');
  };
  const save = (e?: { preventDefault: () => void }) => {
    e?.preventDefault();
    if (!draft.name.trim() || !(draft.image.trim()||draft.mobileImage?.trim())) { setError('A category name and at least one image are required.'); return; }
    if(categories.some(category=>category.id!==draft.id&&category.name.trim().toLowerCase()===draft.name.trim().toLowerCase())){setError('A category with that name already exists.');return;}
    saveCategory({ ...draft, name: draft.name.trim() }); setEditingId(null); setIsCreate(false); notify('Category saved');
  };
  return <>
    <PageHead kicker="Catalogue structure" title="Categories" subtitle="Make it easy for customers to find their next favourite." action={<Button className="primary" onClick={() => begin()} data-testid="button-add-category"><Plus /> Add category</Button>} />
    <Card title="Featured categories section" note="Control the category rail shown on the storefront homepage."><div className="ad-card-body ad-form-stack">
      <div className="ad-form-row"><label className="ad-field"><span className="ad-label">Category layout</span><select className="ad-select" value={adminData.content.categoryDisplayMode} onChange={event=>setData(previous=>({...previous,content:{...previous.content,categoryDisplayMode:event.target.value as 'grid'|'horizontal'}}))} data-testid="select-home-category-layout"><option value="grid">Grid</option><option value="horizontal">Horizontal row</option></select></label><label className="ad-field"><span className="ad-label">Category card shape</span><select className="ad-select" value={adminData.content.categoryLayout} onChange={event=>setData(previous=>({...previous,content:{...previous.content,categoryLayout:event.target.value as 'box'|'circle'}}))} data-testid="select-home-category-shape"><option value="box">Box / square</option><option value="circle">Circle</option></select></label></div>
      {adminData.content.categoryDisplayMode==='horizontal'&&<><label className="ad-field"><span className="ad-label">Horizontal row motion</span><select className="ad-select" value={adminData.content.categoryMotionStyle} onChange={event=>setData(previous=>({...previous,content:{...previous.content,categoryMotionStyle:event.target.value as 'auto'|'manual'}}))} data-testid="select-home-category-motion"><option value="auto">Auto-scrolling marquee</option><option value="manual">Manual swipe row</option></select></label><label className="ad-field"><span className="ad-label">Auto-scroll speed</span><select className="ad-select" value={adminData.content.categoryMotionSpeed} onChange={event=>setData(previous=>({...previous,content:{...previous.content,categoryMotionSpeed:event.target.value as 'slow'|'medium'|'fast'}}))} data-testid="select-home-category-speed"><option value="slow">Slow</option><option value="medium">Medium</option><option value="fast">Fast</option></select></label></>}
      <AdminSaveButton scope={['content.categoryDisplayMode','content.categoryLayout','content.categoryMotionStyle','content.categoryMotionSpeed']} testId="button-save-featured-categories"/>
    </div></Card>
    <Card title="Category card display" note="Choose whether storefront category cards show the number of visible products in each collection."><div className="ad-card-body ad-toolbar" style={{justifyContent:'space-between'}}><label className="ad-checkline"><input type="checkbox" checked={adminData.content.showCategoryProductCount} onChange={event=>setData(previous=>({...previous,content:{...previous.content,showCategoryProductCount:event.target.checked}}))} data-testid="toggle-category-product-count"/>Show product count badge on category cards</label><AdminSaveButton scope="content.showCategoryProductCount" testId="button-save-category-product-count"/></div></Card>
     <Card title="Category filter icons" note="Choose the icon shown beside each category in the collection filter."><div className="ad-card-body ad-form-stack">
       {categories.map(category=><label key={category.id} className="ad-browse-setting">
         <span className="flex min-w-0 items-center gap-2"><CatalogFilterIcon name={categoryBrowsing.categoryIcons[category.id]||'layers'} size={15} className="shrink-0 text-[#6b2447]"/><span className="ad-item-name truncate">{category.name}</span></span>
         <select className="ad-select" value={categoryBrowsing.categoryIcons[category.id]||'layers'} onChange={event=>setData(previous=>({...previous,settings:{...previous.settings,catalogBrowsing:{...normalizeCatalogBrowsingSettings(previous.settings?.catalogBrowsing),categoryIcons:{...normalizeCatalogBrowsingSettings(previous.settings?.catalogBrowsing).categoryIcons,[category.id]:event.target.value}}}}))} aria-label={`Icon for category ${category.name}`} data-testid={`select-category-filter-icon-${category.id}`} style={{width:145}}>
           {catalogFilterIconOptions.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}
         </select>
       </label>)}
       {categories.length===0&&<p className="ad-notice">Add categories to configure their filter icons.</p>}
     </div></Card>
     <Card title="Category filter" note="Manage whether shoppers can filter by category and where this filter appears in the collection filters."><div className="ad-card-body ad-form-stack">
       {!categoryFilter
         ?<Button type="button" onClick={()=>{const base=defaultCatalogFilterSections.find(section=>section.kind==='categories');if(base)updateCategoryBrowsing(current=>({...current,filterSections:[...current.filterSections,{...base}],filters:{...current.filters,categories:true}}));}} data-testid="button-add-category-filter">Add category filter</Button>
         :<>
           <div className="ad-toolbar"><label className="ad-checkline"><input type="checkbox" checked={categoryBrowsing.filters.categories} onChange={event=>updateCategoryBrowsing(current=>({...current,filters:{...current.filters,categories:event.target.checked}}))} data-testid="switch-product-filter-categories"/>Show category filter</label><span className="ad-item-sub">Position {categoryFilterIndex+1} of {categoryBrowsing.filterSections.length}</span><button type="button" className="ad-icon-btn" aria-label="Move category filter up" disabled={categoryFilterIndex===0} onClick={()=>updateCategoryBrowsing(current=>{const filterSections=[...current.filterSections];[filterSections[categoryFilterIndex-1],filterSections[categoryFilterIndex]]=[filterSections[categoryFilterIndex],filterSections[categoryFilterIndex-1]];return {...current,filterSections};})}><ArrowUp/></button><button type="button" className="ad-icon-btn" aria-label="Move category filter down" disabled={categoryFilterIndex===categoryBrowsing.filterSections.length-1} onClick={()=>updateCategoryBrowsing(current=>{const filterSections=[...current.filterSections];[filterSections[categoryFilterIndex],filterSections[categoryFilterIndex+1]]=[filterSections[categoryFilterIndex+1],filterSections[categoryFilterIndex]];return {...current,filterSections};})}><ArrowDown/></button><button type="button" className="ad-icon-btn" aria-label="Remove category filter" onClick={()=>updateCategoryBrowsing(current=>({...current,filterSections:current.filterSections.filter(section=>section.kind!=='categories'),filters:{...current.filters,categories:false}}))}><Trash2/></button></div>
           <div className="ad-form-row"><Field label="Filter heading"><Input value={categoryFilter.title} onChange={event=>updateCategoryBrowsing(current=>({...current,filterSections:current.filterSections.map(section=>section.kind==='categories'?{...section,title:event.target.value}:section)}))} data-testid="input-category-filter-heading"/></Field><Field label="Filter icon"><Select value={categoryFilter.icon} onChange={event=>updateCategoryBrowsing(current=>({...current,filterSections:current.filterSections.map(section=>section.kind==='categories'?{...section,icon:event.target.value}:section)}))} data-testid="select-category-filter-section-icon">{catalogFilterIconOptions.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</Select></Field></div>
         </>}
       <AdminSaveButton scope="settings.catalogBrowsing" testId="button-save-category-controls"/>
     </div></Card>
    <div className="ad-grid three">{categories.map(category => <article className="ad-card" key={category.id} data-testid={`card-category-${category.id}`}>
       <div style={{ height: 145, background: category.color || '#ece5dc', overflow: 'hidden', borderRadius: '9px 9px 0 0' }}><StoreImage src={category.image} mobileSrc={category.mobileImage} fallbackSources={category.images} alt={category.name} placeholderShape={adminData.content.categoryLayout==='circle'?'circle':'portrait'} placeholderTitle="Category image" placeholderHint="Upload or select an image for this category." placeholderDimensions={adminData.content.categoryLayout==='circle'?'Recommended: 1000 × 1000 px':'Recommended: 1200 × 1500 px'} loading="lazy" decoding="async" pictureClassName="block h-full w-full" className="h-full w-full object-cover object-center" /></div>
      <div style={{ padding: 15 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><div><div className="ad-item-name">{category.name}</div><div className="ad-item-sub">{category.sub || 'No supporting line'}</div></div><span className="ad-status">{products.filter(p => p.category === category.name).length} products</span></div>
        <div style={{ display: 'flex', gap: 7, marginTop: 15 }}><Button className="small" onClick={() => begin(category)} data-testid={`button-edit-category-${category.id}`}><Pencil /> Edit</Button><Button className="small danger" onClick={() => setDeleting(category.id)} data-testid={`button-delete-category-${category.id}`}><Trash2 /> Delete</Button></div>
      </div>
    </article>)}
    {!categories.length && <div className="ad-card"><Empty title="No categories yet" body="Create a clear collection to help customers navigate the shop." action={<Button className="primary" onClick={() => begin()}><Plus /> Add category</Button>} /></div>}</div>
     {(editingId || isCreate) && <Modal title={isCreate ? 'Create category' : 'Edit category'} onClose={() => { setEditingId(null); setIsCreate(false); }} footer={<><Button onClick={() => { setEditingId(null); setIsCreate(false); }}>Cancel</Button><Button className="primary" onClick={save} data-testid="button-save-category"><Save /> Save category</Button></>}>
       <div className="ad-tabs"><button type="button" className={`ad-tab ${editorTab==='details'?'active':''}`} onClick={()=>setEditorTab('details')} data-testid="tab-category-details">Category details</button><button type="button" className={`ad-tab ${editorTab==='seo'?'active':''}`} onClick={()=>setEditorTab('seo')} data-testid="tab-category-seo">SEO & Social</button></div>
        {editorTab==='details'&&<form onSubmit={save} className="ad-form-stack"><Field label="Name"><Input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} data-testid="input-category-name" /></Field><Field label="Supporting line"><Input value={draft.sub} onChange={e => setDraft({ ...draft, sub: e.target.value })} data-testid="input-category-subtitle" /></Field><Field label="Desktop image URL" help={`Use a public URL or upload an image to Supabase Storage. Recommended: ${adminData.content.categoryLayout==='circle'?'1000 × 1000 px for circle cards':'1200 × 1500 px for portrait cards'}.`}><Input type="url" value={draft.image} onChange={e => setDraft({ ...draft, image: e.target.value })} data-testid="input-category-image" /><ImageUpload folder="categories" onUploaded={url=>setDraft(previous=>({...previous,image:url}))}/></Field><Field label="Mobile image (optional)" help="If set, this image is selected on mobile screens."><Input type="url" value={draft.mobileImage||''} onChange={e => setDraft({ ...draft, mobileImage: e.target.value })} data-testid="input-category-mobile-image" /><ImageUpload folder="categories" onUploaded={url=>setDraft(previous=>({...previous,mobileImage:url}))}/></Field>{error && <div className="ad-error">{error}</div>}</form>}
       {editorTab==='seo'&&<SeoSocialFields prefix="category" value={draft.seo} source={{title:draft.name,description:draft.sub,imageUrl:draft.image,category:draft.name,siteName:adminData.settings.general.storeName}} onChange={seo=>setDraft(previous=>({...previous,seo}))}/>}
    </Modal>}
    {deleting && <Modal title="Delete category?" description={categories.find(c => c.id === deleting)?.name} onClose={() => setDeleting(null)} footer={<><Button onClick={() => setDeleting(null)}>Cancel</Button><Button className="danger" onClick={() => { const result = deleteCategory(deleting); setDeleting(null); notify(result ? 'Category deleted' : 'Category could not be deleted while products use it'); }} data-testid="button-confirm-delete-category"><Trash2 /> Delete category</Button></>}>
      <div className="ad-notice">The store will prevent removing a category still used by products. The outcome is shown after confirmation.</div>
    </Modal>}
    {message && <Toast text={message} onClose={clear} />}
  </>;
}

function Deals() {
  const { data, setData, flush } = useAdminStore();
  const { products } = useStore();
  const { message, notify, clear } = useFeedback();
  const [tab, setTab] = useState<'deals' | 'coupons' | 'quantity'>('deals');
  const [create, setCreate] = useState(false);
  const [kind, setKind] = useState<'deal' | 'coupon'>('deal');
  const [editId, setEditId] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ kind: string; id: string; label: string } | null>(null);
  const [error, setError] = useState('');
  const [deal, setDeal] = useState({ name: '', buyX: 2, getY: 1, productIds: [] as number[], active: true });
  const [coupon, setCoupon] = useState({ code: '', percentOff: 10, minimumSubtotal: 0, active: true, expiresAt: '' });
  function openNew(which: 'deal' | 'coupon') { setKind(which); setEditId(''); setError(''); setCreate(true); setDeal({ name: '', buyX: 2, getY: 1, productIds: [], active: true }); setCoupon({ code: '', percentOff: 10, minimumSubtotal: 0, active: true, expiresAt: '' }); }
  function editDeal(item: typeof data.deals[number]) { setDeal({ name: item.name, buyX: item.buyX, getY: item.getY, productIds: [...item.productIds], active: item.active }); setKind('deal'); setEditId(item.id); setCreate(true); }
  function editCoupon(item: typeof data.coupons[number]) { setCoupon({ code: item.code, percentOff: item.percentOff, minimumSubtotal: item.minimumSubtotal, active: item.active, expiresAt: item.expiresAt }); setKind('coupon'); setEditId(item.id); setCreate(true); }
  function save(e?: { preventDefault: () => void }) {
    e?.preventDefault();
    if (kind === 'deal') {
      if (!deal.name.trim() || !Number.isInteger(deal.buyX) || deal.buyX < 1 || !Number.isInteger(deal.getY) || deal.getY < 1 || !deal.productIds.length) { setError('Add a deal name, whole-number quantities and at least one product.'); return; }
      const next = { ...deal, name: deal.name.trim(), id: editId || idFor() };
      setData(prev => ({ ...prev, deals: editId ? prev.deals.map(d => d.id === editId ? next : d) : [...prev.deals, next] }));
    } else {
      const code=coupon.code.trim().toUpperCase();
      const duplicate=data.coupons.some(item=>item.id!==editId&&item.code.toUpperCase()===code);
      if (!/^[A-Z0-9_-]{3,20}$/i.test(code) || duplicate || !Number.isInteger(coupon.percentOff) || coupon.percentOff < 1 || coupon.percentOff > 100 || !Number.isFinite(coupon.minimumSubtotal) || coupon.minimumSubtotal < 0 || !coupon.expiresAt || coupon.expiresAt<new Date().toISOString().slice(0,10)) { setError(duplicate?'That coupon code already exists.':'Use a unique 3–20 character code, a 1–100% whole-number discount, a non-negative minimum and a current or future expiry date.'); return; }
      const next = { ...coupon, code, id: editId || idFor() };
      setData(prev => ({ ...prev, coupons: editId ? prev.coupons.map(c => c.id === editId ? next : c) : [...prev.coupons, next] }));
    }
    setCreate(false); notify(kind === 'deal' ? 'Buy X, get Y offer saved' : 'Coupon saved');
  }
  const remove = () => {
    if (!deleteTarget) return;
    setData(prev => deleteTarget.kind === 'deal' ? { ...prev, deals: prev.deals.filter(d => d.id !== deleteTarget.id) } : { ...prev, coupons: prev.coupons.filter(c => c.id !== deleteTarget.id) });
    notify('Offer deleted'); setDeleteTarget(null);
  };
  const toggleDeal = (id: string) => setData(prev => ({ ...prev, deals: prev.deals.map(d => d.id === id ? { ...d, active: !d.active } : d) }));
  const toggleCoupon = (id: string) => setData(prev => ({ ...prev, coupons: prev.coupons.map(c => c.id === id ? { ...c, active: !c.active } : c) }));
  return <>
     <PageHead kicker="Offers" title="Deals & coupons" subtitle="Shape a little welcome, seasonal offer or buy-more-save-more moment." action={tab==='quantity'?undefined:<Button className="primary" onClick={() => openNew(tab === 'deals' ? 'deal' : 'coupon')} data-testid="button-add-offer"><Plus /> Create {tab === 'deals' ? 'deal' : 'coupon'}</Button>} />
     <div className="ad-tabs"><button className={`ad-tab ${tab === 'deals' ? 'active' : ''}`} onClick={() => setTab('deals')} data-testid="tab-deals">Buy X, get Y <span className="ad-status" style={{ marginLeft: 5 }}>{data.deals.length}</span></button><button className={`ad-tab ${tab === 'coupons' ? 'active' : ''}`} onClick={() => setTab('coupons')} data-testid="tab-coupons">Coupon codes <span className="ad-status" style={{ marginLeft: 5 }}>{data.coupons.length}</span></button><button className={`ad-tab ${tab === 'quantity' ? 'active' : ''}`} onClick={() => setTab('quantity')} data-testid="tab-quantity-discounts">Buy more, save more</button></div>
     {tab==='quantity'?<QuantityDiscountManager/>:tab === 'deals' ? <Card title="Quantity offers" note="Select eligible products for each buy X, get Y offer">
      {data.deals.length ? <div className="ad-table-wrap"><table className="ad-table"><thead><tr><th>Offer</th><th>Mechanic</th><th>Products</th><th>State</th><th>Active</th><th /></tr></thead><tbody>{data.deals.map(d => <tr key={d.id} data-testid={`row-deal-${d.id}`}><td><div className="ad-item-name">{d.name}</div></td><td>Buy {d.buyX}, get {d.getY}</td><td>{d.productIds.length} products</td><td><Badge>{d.active ? 'Active' : 'Inactive'}</Badge></td><td><input aria-label={`Toggle ${d.name}`} className="ad-toggle" type="checkbox" checked={d.active} onChange={() => toggleDeal(d.id)} data-testid={`toggle-deal-${d.id}`} /></td><td><button className="ad-icon-btn" aria-label={`Edit ${d.name}`} onClick={() => editDeal(d)} data-testid={`button-edit-deal-${d.id}`}><Pencil /></button><button className="ad-icon-btn" aria-label={`Delete ${d.name}`} onClick={() => setDeleteTarget({ kind: 'deal', id: d.id, label: d.name })} data-testid={`button-delete-deal-${d.id}`}><Trash2 /></button></td></tr>)}</tbody></table></div> : <Empty title="No quantity offers" body="Create an offer to reward a larger basket with a thoughtful extra." action={<Button className="primary" onClick={() => openNew('deal')}><Plus /> Create a deal</Button>} />}
    </Card> : <Card title="Coupon codes" note="Percent discounts with optional order minimums and expiry dates">
      {data.coupons.length ? <div className="ad-table-wrap"><table className="ad-table"><thead><tr><th>Code</th><th>Discount</th><th>Minimum</th><th>Expires</th><th>State</th><th>Active</th><th /></tr></thead><tbody>{data.coupons.map(c => <tr key={c.id} data-testid={`row-coupon-${c.id}`}><td><strong style={{ letterSpacing: '.1em', color: 'var(--nura-primary,#4A2837)' }}>{c.code}</strong></td><td>{c.percentOff}% off</td><td>{pkr(c.minimumSubtotal)}</td><td>{dateLabel(c.expiresAt)}</td><td><Badge>{c.active ? 'Active' : 'Inactive'}</Badge></td><td><input aria-label={`Toggle coupon ${c.code}`} className="ad-toggle" type="checkbox" checked={c.active} onChange={() => toggleCoupon(c.id)} data-testid={`toggle-coupon-${c.id}`} /></td><td><button className="ad-icon-btn" aria-label={`Edit ${c.code}`} onClick={() => editCoupon(c)} data-testid={`button-edit-coupon-${c.id}`}><Pencil /></button><button className="ad-icon-btn" aria-label={`Delete ${c.code}`} onClick={() => setDeleteTarget({ kind: 'coupon', id: c.id, label: c.code })} data-testid={`button-delete-coupon-${c.id}`}><Trash2 /></button></td></tr>)}</tbody></table></div> : <Empty title="No coupons yet" body="Create a code for a launch, a returning customer or a seasonal edit." action={<Button className="primary" onClick={() => openNew('coupon')}><Plus /> Create coupon</Button>} />}
    </Card>}
    {create && <Modal title={`${editId ? 'Edit' : 'Create'} ${kind === 'deal' ? 'quantity offer' : 'coupon'}`} onClose={() => setCreate(false)} footer={<><Button onClick={() => setCreate(false)}>Cancel</Button><Button className="primary" onClick={save} data-testid="button-save-offer"><Save /> Save offer</Button></>}>
      <form onSubmit={save} className="ad-form-stack">
        {kind === 'deal' ? <><Field label="Offer name"><Input value={deal.name} onChange={e => setDeal({ ...deal, name: e.target.value })} placeholder="A little something extra" data-testid="input-deal-name" /></Field><div className="ad-form-row"><Field label="Buy X"><Input type="number" min="1" value={deal.buyX} onChange={e => setDeal({ ...deal, buyX: Number(e.target.value) })} data-testid="input-deal-buy" /></Field><Field label="Get Y"><Input type="number" min="1" value={deal.getY} onChange={e => setDeal({ ...deal, getY: Number(e.target.value) })} data-testid="input-deal-get" /></Field></div><Field label="Eligible products"><div style={{ maxHeight: 175, overflow: 'auto', padding: 10, border: '1px solid var(--ad-border)', borderRadius: 5, display: 'grid', gap: 9 }}>{products.map(p => <label className="ad-checkline" key={p.id}><input type="checkbox" checked={deal.productIds.includes(p.id)} onChange={e => setDeal({ ...deal, productIds: e.target.checked ? [...deal.productIds, p.id] : deal.productIds.filter(id => id !== p.id) })} data-testid={`checkbox-deal-product-${p.id}`} />{p.name} <span style={{ color: '#998e82' }}>· {pkr(p.price)}</span></label>)}</div></Field><label className="ad-checkline"><input type="checkbox" checked={deal.active} onChange={e => setDeal({ ...deal, active: e.target.checked })} data-testid="checkbox-deal-active" /> Offer is active</label></> :
          <><Field label="Coupon code" help="Letters, numbers, hyphens or underscores."><Input value={coupon.code} onChange={e => setCoupon({ ...coupon, code: e.target.value.toUpperCase() })} data-testid="input-coupon-code" /></Field><div className="ad-form-row"><Field label="Percent off"><Input type="number" min="1" max="100" value={coupon.percentOff} onChange={e => setCoupon({ ...coupon, percentOff: Number(e.target.value) })} data-testid="input-coupon-discount" /></Field><Field label="Minimum subtotal (PKR)"><Input type="number" min="0" value={coupon.minimumSubtotal} onChange={e => setCoupon({ ...coupon, minimumSubtotal: Number(e.target.value) })} data-testid="input-coupon-minimum" /></Field></div><Field label="Expiry date"><Input type="date" value={coupon.expiresAt} onChange={e => setCoupon({ ...coupon, expiresAt: e.target.value })} data-testid="input-coupon-expiry" /></Field><label className="ad-checkline"><input type="checkbox" checked={coupon.active} onChange={e => setCoupon({ ...coupon, active: e.target.checked })} data-testid="checkbox-coupon-active" /> Coupon is active</label></>}
        {error && <div className="ad-error" role="alert">{error}</div>}
      </form>
    </Modal>}
    {deleteTarget && <Modal title={`Delete ${deleteTarget.kind}?`} description={deleteTarget.label} onClose={() => setDeleteTarget(null)} footer={<><Button onClick={() => setDeleteTarget(null)}>Cancel</Button><Button className="danger" onClick={remove} data-testid="button-confirm-delete-offer"><Trash2 /> Delete</Button></>}><div className="ad-notice">This offer will be removed from Supabase.</div></Modal>}
    {message && <Toast text={message} onClose={clear} />}
  </>;
}

function ReviewEditorFields({review,onChange,prefix}:{review:AdminReview;onChange:(patch:Partial<AdminReview>)=>void;prefix:string}){
  return <div className="ad-form-stack">
    <div className="ad-form-row">
      <Field label="Customer name"><Input value={review.customer} onChange={event=>onChange({customer:event.target.value})} data-testid={`input-${prefix}-customer`}/></Field>
      <Field label="City"><Input value={review.city} onChange={event=>onChange({city:event.target.value})} data-testid={`input-${prefix}-city`}/></Field>
    </div>
    <div className="ad-form-row">
      <Field label="Rating (1–5)"><Input type="number" min="1" max="5" value={review.rating} onChange={event=>onChange({rating:Math.min(5,Math.max(1,Number(event.target.value)||1))})} data-testid={`input-${prefix}-rating`}/></Field>
      <Field label="Published"><label className="ad-checkline"><input type="checkbox" checked={review.published} onChange={event=>onChange({published:event.target.checked})} data-testid={`toggle-${prefix}-published`}/> Show this review</label></Field>
    </div>
    <Field label="Review text"><Area rows={4} value={review.text} onChange={event=>onChange({text:event.target.value})} data-testid={`input-${prefix}-text`}/></Field>
    <div className="ad-form-row">
      <Field label="Customer avatar URL"><Input type="url" value={review.avatarUrl||''} onChange={event=>onChange({avatarUrl:event.target.value})} data-testid={`input-${prefix}-avatar-url`}/></Field>
      <Field label="Upload avatar"><ImageUpload folder="banners" onUploaded={url=>onChange({avatarUrl:url})}/></Field>
    </div>
    <div className="ad-form-row">
      <Field label="Video review URL"><Input type="url" value={review.videoUrl} onChange={event=>onChange({videoUrl:event.target.value})} data-testid={`input-${prefix}-video-url`}/></Field>
      <Field label="Video thumbnail URL"><Input type="url" value={review.thumbnailUrl} onChange={event=>onChange({thumbnailUrl:event.target.value})} data-testid={`input-${prefix}-thumbnail-url`}/></Field>
    </div>
  </div>;
}

function Reviews() {
  const { data, setData } = useAdminStore();
  const { message, notify, clear } = useFeedback();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [newReview,setNewReview]=useState<AdminReview|null>(null);
  const rows = data.reviews.filter(r => `${r.customer} ${r.city} ${r.text}`.toLowerCase().includes(query.toLowerCase()));
  const selectedReview = data.reviews.find(r => r.id === selected);
  const editReview=(id:string,patch:Partial<AdminReview>)=>setData(prev=>({...prev,reviews:prev.reviews.map(review=>review.id===id?{...review,...patch}:review)}));
  const startReview=()=>{setNewReview({id:idFor(),customer:'',city:'',text:'',rating:5,published:false,videoUrl:'',thumbnailUrl:'',avatarUrl:'',createdAt:new Date().toISOString()});};
  const toggle = (id: string) => {
    const item = data.reviews.find(r => r.id === id);
    if (!item) return;
    setData(prev => ({ ...prev, reviews: prev.reviews.map(r => r.id === id ? { ...r, published: !r.published } : r) }));
    notify(item.published ? 'Review hidden from storefront' : 'Review published to storefront');
  };
  return <>
    <PageHead kicker="Customer voice" title="Reviews" subtitle="Choose which customer notes and video testimonials appear on the storefront." />
    <div className="ad-stats" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }}><div className="ad-stat"><div className="ad-stat-label">All reviews</div><div className="ad-stat-value">{data.reviews.length}</div><div className="ad-stat-foot">Customer notes</div></div><div className="ad-stat"><div className="ad-stat-label">Published</div><div className="ad-stat-value">{data.reviews.filter(r => r.published).length}</div><div className="ad-stat-foot">Visible on storefront</div></div><div className="ad-stat"><div className="ad-stat-label">Average rating</div><div className="ad-stat-value">{data.reviews.length ? (data.reviews.reduce((n, r) => n + r.rating, 0) / data.reviews.length).toFixed(1) : '—'}<span style={{ fontSize: 12, color: 'var(--nura-gold,#C6A15B)' }}> / 5</span></div><div className="ad-stat-foot">Across available reviews</div></div></div>
    <div className="ad-toolbar"><div className="ad-search"><Search /><Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Find a customer note" data-testid="input-review-search" /></div><span style={{ marginLeft: 'auto', color: '#92877c', fontSize: 10 }}>{rows.length} reviews</span><Button className="primary" onClick={startReview} data-testid="button-add-review"><Plus/> Add review</Button></div>
    <Card title="Customer notes" note="Publishing status affects storefront visibility">
      {rows.length ? <div className="ad-table-wrap"><table className="ad-table"><thead><tr><th>Customer</th><th>Review</th><th>Rating</th><th>Received</th><th>Visibility</th><th /></tr></thead><tbody>{rows.map(r => <tr key={r.id} data-testid={`row-review-${r.id}`}><td><div className="ad-item-name">{r.customer}</div><div className="ad-item-sub">{r.city}, Pakistan</div></td><td style={{ maxWidth: 360 }}><div style={{ lineHeight: 1.55 }}>{r.text.length > 100 ? `${r.text.slice(0, 100)}…` : r.text}</div>{r.videoUrl && <div className="ad-item-sub">Video attached</div>}</td><td><span className="ad-review-stars">{'★'.repeat(r.rating)}{'☆'.repeat(Math.max(0, 5 - r.rating))}</span></td><td>{dateLabel(r.createdAt)}</td><td><Badge>{r.published ? 'Published' : 'Hidden'}</Badge></td><td><Button className="small" onClick={() => setSelected(r.id)} data-testid={`button-view-review-${r.id}`}><Eye /> View</Button><button className="ad-icon-btn" aria-label={`${r.published ? 'Hide' : 'Publish'} review`} onClick={() => toggle(r.id)} data-testid={`button-toggle-review-${r.id}`}>{r.published ? <Eye /> : <Check />}</button><button className="ad-icon-btn" aria-label="Delete review" onClick={() => setDeleting(r.id)} data-testid={`button-delete-review-${r.id}`}><Trash2 /></button></td></tr>)}</tbody></table></div> : <Empty title="No reviews found" body={query ? 'Try another name, city or phrase.' : 'Customer notes will appear here when they are saved in Supabase.'} />}
    </Card>
    {selectedReview && <Modal title={`Edit review from ${selectedReview.customer}`} description={`${selectedReview.city}, Pakistan · ${dateLabel(selectedReview.createdAt)}`} onClose={() => setSelected(null)} footer={<><Button onClick={() => setSelected(null)} data-testid="button-close-review-editor">Save changes</Button><Button className="primary" onClick={() => toggle(selectedReview.id)} data-testid="button-toggle-review-detail">{selectedReview.published ? 'Hide from storefront' : 'Publish to storefront'}</Button></>}>
      <ReviewEditorFields review={selectedReview} onChange={patch=>editReview(selectedReview.id,patch)} prefix={`review-${selectedReview.id}`}/>
      {selectedReview.videoUrl&&<a href={selectedReview.videoUrl} target="_blank" rel="noreferrer" className="ad-btn" data-testid="link-review-video"><ExternalLink/> Open video review</a>}
    </Modal>}
    {newReview&&<Modal title="Add customer review" description="Create a customer note for the homepage review carousel." onClose={()=>setNewReview(null)} footer={<><Button onClick={()=>setNewReview(null)} data-testid="button-cancel-new-review">Cancel</Button><Button className="primary" disabled={!newReview.customer.trim()||!newReview.text.trim()} onClick={()=>{setData(previous=>({...previous,reviews:[newReview,...previous.reviews]}));setNewReview(null);notify('Review added to Supabase');}} data-testid="button-save-new-review"><Save/> Add review</Button></>}>
      <ReviewEditorFields review={newReview} onChange={patch=>setNewReview(previous=>previous?{...previous,...patch}:previous)} prefix="new-review"/>
    </Modal>}
    {deleting && <Modal title="Delete this review?" description="This permanently removes the review document." onClose={() => setDeleting(null)} footer={<><Button onClick={() => setDeleting(null)}>Cancel</Button><Button className="danger" onClick={() => { setData(prev => ({ ...prev, reviews: prev.reviews.filter(r => r.id !== deleting) })); setDeleting(null); notify('Review deleted'); }} data-testid="button-confirm-delete-review"><Trash2 /> Delete review</Button></>}><div className="ad-notice">The review and its visibility state will be removed from Supabase.</div></Modal>}
    {message && <Toast text={message} onClose={clear} />}
  </>;
}

function Content() {
  const location=useLocation();
  const [searchParams]=useSearchParams();
  const { data, setData, flush } = useAdminStore();
  const { message, notify, clear } = useFeedback();
  const contentSections=['announcement','marquee','hero','story','contact','sections','layout','footer'] as const;
  const visibleContentSections=['announcement','marquee','sections','layout','hero','story','contact','footer'] as const;
  const requestedContentSection=searchParams.get('section');
  const [section, setSection] = useState<(typeof contentSections)[number]>(visibleContentSections.includes(requestedContentSection as (typeof visibleContentSections)[number])?(requestedContentSection as (typeof visibleContentSections)[number]):'sections');
  useEffect(()=>{setSection(visibleContentSections.includes(requestedContentSection as (typeof visibleContentSections)[number])?requestedContentSection as (typeof visibleContentSections)[number]:'sections');},[requestedContentSection,location.pathname]);
  const [heroIndex, setHeroIndex] = useState(0);
  const updateHero = (id: string, key: string, value: string) => setData(prev => ({ ...prev, content: { ...prev.content, heroSlides: prev.content.heroSlides.map(slide => slide.id === id ? { ...slide, [key]: value } : slide) } }));
  const updateHeroSettings=(patch:Partial<typeof data.content.heroSettings>)=>setData(previous=>({...previous,content:{...previous.content,heroSettings:{...previous.content.heroSettings,...patch}}}));
  const updateHeroButtonSettings=(patch:Partial<typeof data.content.heroButtonSettings>)=>setData(previous=>({...previous,content:{...previous.content,heroButtonSettings:{...previous.content.heroButtonSettings,...patch}}}));
  const slide = data.content.heroSlides[heroIndex];
  const updateHeroPosition=(patch:Partial<Pick<HeroSlide,'horizontalAlignment'|'overlayPosition'|'mobileHorizontalAlignment'|'mobileOverlayPosition'>>)=>{
    if(!slide)return;
    setData(previous=>({...previous,content:{...previous.content,heroSlides:previous.content.heroSlides.map(item=>item.id===slide.id?{...item,...patch}:item)}}));
  };
  const contentSaveScopes:Partial<Record<typeof section,AdminSaveScope[]>>={
    announcement:['content.announcement'],
    hero:['content.heroSlides','content.heroSettings','content.heroButtonSettings'],
    story:['content.story'],
    contact:['content.contact'],
  };
  const saveMessage = async () => { const result=await flush(contentSaveScopes[section]??'content'); await notify(result==='local'?'Saved on this device; cloud sync is pending.':'Storefront content saved successfully',false); };
  return <>
     <PageHead kicker="Storefront" title="Storefront content" subtitle="Each section keeps its own draft until you explicitly save it."/>
     {section==='sections'&&<HomepageSectionsManager/>}
    {section==='layout'&&<><LayoutControls/><ProductCardBadgeSettingsManager/></>}
    {section==='footer'&&<><PageHead kicker="Storefront" title="Footer Info Manager" subtitle="Edit, hide, or reorder the blocks shown across storefront pages."/><FooterInfoManager/></>}
    {section==='hero'&&<Card title="Hero sizing" note="Banner images use centered contain behavior so the complete artwork stays visible on every screen."><div className="ad-card-body ad-grid two">
      <Field label="Desktop slider height (px)" help="Recommended image canvas: 1920 × 800 px."><Input type="number" min="320" max="900" value={data.content.heroSettings.desktopHeightPx} onChange={event=>setData(previous=>({...previous,content:{...previous.content,heroSettings:{...previous.content.heroSettings,desktopHeightPx:Math.min(900,Math.max(320,Number(event.target.value)||320))}}}))} data-testid="input-hero-desktop-height"/></Field>
      <Field label="Mobile slider height (px)" help="Recommended image canvas: 800 × 1000 px or 800 × 600 px compact."><Input type="number" min="300" max="900" value={data.content.heroSettings.mobileHeightPx} onChange={event=>setData(previous=>({...previous,content:{...previous.content,heroSettings:{...previous.content.heroSettings,mobileHeightPx:Math.min(900,Math.max(300,Number(event.target.value)||300))}}}))} data-testid="input-hero-mobile-height"/></Field>
    </div></Card>}
    {section==='hero'&&<Card title="Hero navigation" note="Control carousel navigation and automatic rotation independently from slide content."><div className="ad-card-body ad-form-stack">
      <div className="ad-form-row">
        <label className="ad-checkline"><input type="checkbox" checked={data.content.heroSettings.showArrows} onChange={event=>updateHeroSettings({showArrows:event.target.checked})} data-testid="toggle-hero-arrows"/> Show side navigation arrows</label>
        <label className="ad-checkline"><input type="checkbox" checked={data.content.heroSettings.showCtas} onChange={event=>updateHeroSettings({showCtas:event.target.checked})} data-testid="toggle-hero-ctas"/> Show hero call-to-action buttons</label>
        <label className="ad-checkline"><input type="checkbox" checked={data.content.heroSettings.showDots} onChange={event=>updateHeroSettings({showDots:event.target.checked})} data-testid="toggle-hero-dots"/> Show slide indicator dots</label>
      </div>
      <div className="ad-form-row">
        <Field label="Arrow style"><Select value={data.content.heroSettings.arrowsStyle} onChange={event=>updateHeroSettings({arrowsStyle:event.target.value as typeof data.content.heroSettings.arrowsStyle})} data-testid="select-hero-arrows-style"><option value="overlay">Overlay arrows</option><option value="outer">Outer arrows</option><option value="minimal">Minimal lines</option></Select></Field>
        <Field label="Auto-play duration (ms)"><Input type="number" min="2000" max="12000" step="500" value={data.content.heroSettings.autoPlayDurationMs} onChange={event=>updateHeroSettings({autoPlayDurationMs:Math.min(12000,Math.max(2000,Number(event.target.value)||4000))})} data-testid="input-hero-autoplay-duration"/></Field>
      </div>
      <label className="ad-checkline"><input type="checkbox" checked={data.content.heroSettings.autoPlayEnabled} onChange={event=>updateHeroSettings({autoPlayEnabled:event.target.checked})} data-testid="toggle-hero-autoplay"/> Automatically rotate slides</label>
    </div></Card>}
    {section==='hero'&&<Card title="Global hero buttons" note="Primary and optional secondary button settings apply consistently to every hero slide."><div className="ad-card-body ad-form-stack">
      <div className="ad-form-row"><Field label="Button label"><Input value={data.content.heroButtonSettings.label} onChange={event=>updateHeroButtonSettings({label:event.target.value})} maxLength={80} data-testid="input-hero-global-label"/></Field><Field label="Button destination"><Input value={data.content.heroButtonSettings.href} onChange={event=>updateHeroButtonSettings({href:event.target.value})} placeholder="/shop or https://example.com" data-testid="input-hero-global-href"/></Field></div>
      <div className="ad-form-row"><Field label="Button style"><Select value={data.content.heroButtonSettings.style} onChange={event=>updateHeroButtonSettings({style:event.target.value as typeof data.content.heroButtonSettings.style})} data-testid="select-hero-global-style"><option value="solid">Solid</option><option value="outline">Outlined</option><option value="minimal">Minimal</option></Select></Field><label className="ad-checkline"><input type="checkbox" checked={data.content.heroButtonSettings.visible} onChange={event=>updateHeroButtonSettings({visible:event.target.checked})} data-testid="toggle-hero-global-visible"/> Show on all hero slides</label></div>
<p className="ad-help">Hero button colors inherit from Global Master Control; use the style selector to choose solid, outlined, or minimal treatment.</p>
      <label className="ad-checkline"><input type="checkbox" checked={data.content.heroButtonSettings.transparentBackground} onChange={event=>updateHeroButtonSettings({transparentBackground:event.target.checked})} data-testid="toggle-hero-global-transparent"/> Keep outlined/minimal button backgrounds transparent</label>
      <hr className="ad-divider"/>
      <label className="ad-checkline"><input type="checkbox" checked={data.content.heroButtonSettings.secondaryEnabled} onChange={event=>updateHeroButtonSettings({secondaryEnabled:event.target.checked})} data-testid="toggle-hero-global-secondary"/> Show a secondary button on every slide</label>
      {data.content.heroButtonSettings.secondaryEnabled&&<>
        <div className="ad-form-row"><Field label="Secondary button label"><Input value={data.content.heroButtonSettings.secondaryLabel} onChange={event=>updateHeroButtonSettings({secondaryLabel:event.target.value})} maxLength={80} data-testid="input-hero-global-secondary-label"/></Field><Field label="Secondary button destination"><Input value={data.content.heroButtonSettings.secondaryHref} onChange={event=>updateHeroButtonSettings({secondaryHref:event.target.value})} placeholder="/about or https://example.com" data-testid="input-hero-global-secondary-href"/></Field></div>
<p className="ad-help">Secondary button colors inherit from Global Master Control.</p>
        <label className="ad-checkline"><input type="checkbox" checked={data.content.heroButtonSettings.secondaryTransparentBackground} onChange={event=>updateHeroButtonSettings({secondaryTransparentBackground:event.target.checked})} data-testid="toggle-hero-global-secondary-transparent"/> Keep outlined/minimal secondary background transparent</label>
      </>}
    </div></Card>}
     {section==='hero'&&slide&&<Card title="Upload hero images" note="Add desktop and mobile artwork for the selected slide."><div className="ad-card-body ad-grid two"><Field label="Desktop banner · 1920 × 800"><ImageUpload folder="banners" onUploaded={url=>updateHero(slide.id,'desktopImageUrl',url)}/></Field><Field label="Mobile banner · 800 × 1000"><ImageUpload folder="banners" onUploaded={url=>updateHero(slide.id,'mobileImageUrl',url)}/></Field></div></Card>}
    {section === 'announcement' && <Card title="Announcement bar" note="A short note at the top of the storefront"><div className="ad-card-body ad-form-stack">
      <label className="ad-checkline"><input type="checkbox" checked={data.content.announcement.visible} onChange={event=>setData(prev=>({ ...prev, content:{ ...prev.content, announcement:{ ...prev.content.announcement, visible:event.target.checked } } }))} data-testid="toggle-announcement-visible"/> Show announcement bar on storefront pages</label>
      <Field label="Announcement text"><Area value={data.content.announcement.text} onChange={e => setData(prev => ({ ...prev, content: { ...prev.content, announcement: { ...prev.content.announcement, text: e.target.value } } }))} maxLength={140} data-testid="input-announcement-text" /></Field>
      <Field label="Free delivery threshold (PKR)" help="The subtotal at which delivery is complimentary."><Input type="number" min="0" value={data.content.announcement.freeDeliveryThreshold} onChange={e => setData(prev => ({ ...prev, content: { ...prev.content, announcement: { ...prev.content.announcement, freeDeliveryThreshold: Number(e.target.value) } } }))} data-testid="input-delivery-threshold" /></Field>
      <Field label="Click destination">
        <Select value={data.content.announcement.linkType} onChange={event=>setData(prev=>({...prev,content:{...prev.content,announcement:{...prev.content.announcement,linkType:event.target.value as typeof prev.content.announcement.linkType}}}))} data-testid="select-announcement-link-type">
          <option value="none">No link</option><option value="shop">Shop all products</option><option value="category">Product category</option><option value="url">Custom URL</option>
        </Select>
      </Field>
      {data.content.announcement.linkType==='category'&&<Field label="Destination category">
        <Select value={data.content.announcement.linkCategoryId} onChange={event=>setData(prev=>({...prev,content:{...prev.content,announcement:{...prev.content.announcement,linkCategoryId:event.target.value}}}))} data-testid="select-announcement-category">
          <option value="">Choose a category</option>{data.categories.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}
        </Select>
      </Field>}
      {data.content.announcement.linkType==='url'&&<Field label="Custom URL" help="Only https:// links and storefront paths are opened.">
        <Input type="text" value={data.content.announcement.linkUrl} onChange={event=>setData(prev=>({...prev,content:{...prev.content,announcement:{...prev.content.announcement,linkUrl:event.target.value}}}))} maxLength={1000} placeholder="https://example.com/sale or /shop/sale" data-testid="input-announcement-link-url"/>
      </Field>}
      <div><Button className="primary" onClick={saveMessage} data-testid="button-save-announcement"><Save /> Save announcement</Button></div>
    </div></Card>}
    {section==='marquee'&&<MarqueeBarsManager/>}
    {section === 'hero' && <Card title="Hero slides" note="Set a desktop and mobile image for every storefront hero">
      {!data.content.heroSlides.length ? <Empty title="No hero slides" body="Add slides to give the storefront a clear, seasonal opening." action={<Button className="primary" onClick={() => setData(prev => ({ ...prev, content: { ...prev.content, heroSlides: [...prev.content.heroSlides, { id: idFor(), eyebrow: '', title: '', copy: '', cta: 'Shop the collection', desktopImageUrl: '', mobileImageUrl: '', primaryCta:{label:'Shop the collection',href:'/shop',visible:true,style:'outline'} }] } }))} data-testid="button-add-hero"><Plus /> Add slide</Button>} /> : <div className="ad-card-body">
        <div className="ad-toolbar"><Select value={heroIndex} onChange={e => setHeroIndex(Number(e.target.value))} style={{ width: 210 }} data-testid="select-hero-slide">{data.content.heroSlides.map((h, i) => <option key={h.id} value={i}>Slide {String(i + 1).padStart(2, '0')}{h.title ? ` · ${h.title.replace('\n', ' ')}` : ''}</option>)}</Select><Button className="small" onClick={() => setData(prev => ({ ...prev, content: { ...prev.content, heroSlides: [...prev.content.heroSlides, { id: idFor(), eyebrow: '', title: '', copy: '', cta: 'Shop the collection', desktopImageUrl: '', mobileImageUrl: '', primaryCta:{label:'Shop the collection',href:'/shop',visible:true,style:'outline'} }] } }))} data-testid="button-add-hero"><Plus /> Add slide</Button><Button className="small danger" disabled={!slide} onClick={() => { const next = data.content.heroSlides.filter((_, i) => i !== heroIndex); setData(prev => ({ ...prev, content: { ...prev.content, heroSlides: next } })); setHeroIndex(Math.max(0, heroIndex - 1)); notify('Hero slide removed'); }} data-testid="button-delete-hero"><Trash2 /> Remove</Button></div>
          {slide && <div className="ad-form-stack"><Field label="Eyebrow"><Input value={slide.eyebrow} onChange={e => updateHero(slide.id, 'eyebrow', e.target.value)} data-testid="input-hero-eyebrow" /></Field><Field label="Headline"><Area value={slide.title} onChange={e => updateHero(slide.id, 'title', e.target.value)} data-testid="input-hero-title" /></Field><Field label="Supporting copy"><Area value={slide.copy} onChange={e => updateHero(slide.id, 'copy', e.target.value)} data-testid="input-hero-copy" /></Field><div className="ad-form-row"><Field label="Desktop hero image" help="Recommended: 1920 × 800 px desktop. The storefront uses contain scaling to avoid cropping."><Input type="url" value={slide.desktopImageUrl} onChange={e => updateHero(slide.id, 'desktopImageUrl', e.target.value)} data-testid="input-hero-desktop-image" /><ImageUpload folder="banners" recommendation="Desktop hero: 1920 × 800 px · wide 12:5 composition" onUploaded={url=>updateHero(slide.id,'desktopImageUrl',url)}/></Field><Field label="Mobile hero image" help="Recommended: 800 × 1000 px portrait. The storefront uses contain scaling to avoid cropping."><Input type="url" value={slide.mobileImageUrl} onChange={e => updateHero(slide.id, 'mobileImageUrl', e.target.value)} data-testid="input-hero-mobile-image" /><ImageUpload folder="banners" recommendation="Mobile hero: 800 × 1000 px · portrait 4:5 composition" onUploaded={url=>updateHero(slide.id,'mobileImageUrl',url)}/></Field></div></div>}
      </div>}
    </Card>}
    {section==='hero'&&slide&&<Card title="Slide alignment" note="Button appearance and actions are managed globally above."><div className="ad-card-body ad-form-stack">
      <div className="ad-form-row">
        <Field label="Desktop text alignment"><Select value={slide.horizontalAlignment??'left'} onChange={event=>updateHeroPosition({horizontalAlignment:event.target.value as NonNullable<HeroSlide['horizontalAlignment']>})} data-testid="select-hero-desktop-alignment"><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></Select></Field>
        <Field label="Desktop overlay position"><Select value={slide.overlayPosition??'bottom-left'} onChange={event=>updateHeroPosition({overlayPosition:event.target.value as NonNullable<HeroSlide['overlayPosition']>})} data-testid="select-hero-desktop-position"><option value="top-left">Top left</option><option value="center">Center</option><option value="bottom-left">Bottom left</option><option value="bottom-center">Bottom center</option></Select></Field>
      </div>
      <div className="ad-form-row">
        <Field label="Mobile text alignment"><Select value={slide.mobileHorizontalAlignment??'left'} onChange={event=>updateHeroPosition({mobileHorizontalAlignment:event.target.value as NonNullable<HeroSlide['mobileHorizontalAlignment']>})} data-testid="select-hero-mobile-alignment"><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></Select></Field>
        <Field label="Mobile overlay position"><Select value={slide.mobileOverlayPosition??'bottom-left'} onChange={event=>updateHeroPosition({mobileOverlayPosition:event.target.value as NonNullable<HeroSlide['mobileOverlayPosition']>})} data-testid="select-hero-mobile-position"><option value="top-left">Top left</option><option value="center">Center</option><option value="bottom-left">Bottom left</option><option value="bottom-center">Bottom center</option></Select></Field>
      </div>
      <Button className="primary" onClick={saveMessage} data-testid="button-save-hero-actions"><Save/> Save hero settings</Button>
    </div></Card>}
     {section === 'story' && <Card title="Our story" note="Edit the image and copy shown in the storefront story section"><div className="ad-card-body ad-form-stack">
        <div className="ad-form-row"><Field label="Eyebrow"><Input value={data.content.story.eyebrow} onChange={e => setData(prev => ({ ...prev, content: { ...prev.content, story: { ...prev.content.story, eyebrow: e.target.value } } }))} data-testid="input-story-eyebrow" /></Field><Field label="Story image" help="Recommended: 1000 × 1000 px · square 1:1"><Input type="url" value={data.content.story.imageUrl} onChange={e => setData(prev => ({ ...prev, content: { ...prev.content, story: { ...prev.content.story, imageUrl: e.target.value } } }))} data-testid="input-story-image" /><ImageUpload folder="banners" recommendation="Story image: 1000 × 1000 px · square 1:1 composition" onUploaded={url=>setData(prev=>({...prev,content:{...prev.content,story:{...prev.content.story,imageUrl:url}}}))}/></Field></div>
       <Field label="Headline"><Area value={data.content.story.title} onChange={e => setData(prev => ({ ...prev, content: { ...prev.content, story: { ...prev.content.story, title: e.target.value } } }))} data-testid="input-story-title" /></Field>
       <Field label="First paragraph"><Area value={data.content.story.paragraphOne} onChange={e => setData(prev => ({ ...prev, content: { ...prev.content, story: { ...prev.content.story, paragraphOne: e.target.value } } }))} data-testid="input-story-paragraph-one" /></Field>
       <Field label="Second paragraph"><Area value={data.content.story.paragraphTwo} onChange={e => setData(prev => ({ ...prev, content: { ...prev.content, story: { ...prev.content.story, paragraphTwo: e.target.value } } }))} data-testid="input-story-paragraph-two" /></Field>
       <label className="ad-field"><span className="ad-label">Urdu heading</span><Input dir="rtl" lang="ur" value={data.content.story.urduTitle} onChange={e=>setData(prev=>({...prev,content:{...prev.content,story:{...prev.content.story,urduTitle:e.target.value}}}))} data-testid="input-story-urdu-title"/></label>
       <label className="ad-field"><span className="ad-label">Urdu story copy</span><Area dir="rtl" lang="ur" value={data.content.story.urduCopy} onChange={e=>setData(prev=>({...prev,content:{...prev.content,story:{...prev.content.story,urduCopy:e.target.value}}}))} data-testid="input-story-urdu-copy"/></label>
       <div className="ad-form-row"><Field label="Image caption"><Input value={data.content.story.imageCaption} onChange={e => setData(prev => ({ ...prev, content: { ...prev.content, story: { ...prev.content.story, imageCaption: e.target.value } } }))} data-testid="input-story-image-caption" /></Field><Field label="Button text"><Input value={data.content.story.buttonText} onChange={e => setData(prev => ({ ...prev, content: { ...prev.content, story: { ...prev.content.story, buttonText: e.target.value } } }))} data-testid="input-story-button" /></Field></div>
       <Button className="primary" onClick={saveMessage} data-testid="button-save-story"><Save /> Save story section</Button>
     </div></Card>}
    {section === 'contact' && <Card title="Contact details" note="Used across storefront contact touchpoints"><div className="ad-card-body ad-form-stack"><div className="ad-form-row"><Field label="Phone"><Input value={data.content.contact.phone} onChange={e => setData(prev => ({ ...prev, content: { ...prev.content, contact: { ...prev.content.contact, phone: e.target.value } } }))} data-testid="input-contact-phone" /></Field><Field label="Email"><Input type="email" value={data.content.contact.email} onChange={e => setData(prev => ({ ...prev, content: { ...prev.content, contact: { ...prev.content.contact, email: e.target.value } } }))} data-testid="input-contact-email" /></Field></div><Field label="Address"><Area value={data.content.contact.address} onChange={e => setData(prev => ({ ...prev, content: { ...prev.content, contact: { ...prev.content.contact, address: e.target.value } } }))} data-testid="input-contact-address" /></Field><div><Button className="primary" onClick={saveMessage} data-testid="button-save-contact"><Save /> Save contact details</Button></div></div></Card>}
    {message && <Toast text={message} onClose={clear} />}
  </>;
}

function TrustBadgesManager() {
  const { data, setData } = useAdminStore();
  const { message, notify, clear } = useFeedback();
  const display=data.content.trustBadgeDisplay;
  const [draft, setDraft] = useState<PromiseCard | null>(null);
  const [editing, setEditing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PromiseCard | null>(null);
  const [error, setError] = useState('');
  const badges = data.content.promiseCards;
  const updateDisplay=(patch:Partial<TrustBadgeDisplaySettings>)=>{
    setData(previous=>({...previous,content:{...previous.content,trustBadgeDisplay:{...previous.content.trustBadgeDisplay,...patch}}}));
  };
  const startCreate = () => {
    setEditing(false);
    setError('');
    setDraft({ id: idFor(), title: '', detail: '', icon: 'shield', active: true });
  };
  const startEdit = (badge: PromiseCard) => {
    setEditing(true);
    setError('');
    setDraft({ ...badge, active: badge.active !== false });
  };
  const saveDraft = () => {
    if (!draft) return;
    if (!draft.title.trim() || !draft.detail.trim()) {
      setError('Enter both a title and subtitle.');
      return;
    }
    const saved = { ...draft, title: draft.title.trim(), detail: draft.detail.trim(), active: draft.active !== false };
    setData(previous => ({
      ...previous,
      content: {
        ...previous.content,
        promiseCards: editing
          ? previous.content.promiseCards.map(badge => badge.id === saved.id ? saved : badge)
          : [...previous.content.promiseCards, saved],
      },
    }));
    setDraft(null);
  };
  const setBadgeActive = (id: string, active: boolean) => {
    setData(previous => ({
      ...previous,
      content: {
        ...previous.content,
        promiseCards: previous.content.promiseCards.map(badge => badge.id === id ? { ...badge, active } : badge),
      },
    }));
  };
  const removeBadge = () => {
    if (!deleteTarget) return;
    setData(previous => ({
      ...previous,
      content: {
        ...previous.content,
        promiseCards: previous.content.promiseCards.filter(badge => badge.id !== deleteTarget.id),
      },
    }));
    setDeleteTarget(null);
  };
  return <>
    <PageHead
      kicker="Storefront"
      title="Trust Badges Manager"
      subtitle="Badge edits remain local until explicitly saved."
      action={<div className="ad-toolbar"><AdminSaveButton scope={['content.promiseCards','content.trustBadgeDisplay']} testId="button-save-trust-badges"/><Button className="primary" onClick={startCreate} data-testid="button-add-trust-badge"><Plus /> Add badge</Button></div>}
    />
    <Card title="Homepage trust badges" note="Add as many as needed. Active badges appear on the storefront; hidden badges stay saved in Supabase.">
      {badges.length ? <div className="ad-table-wrap"><table className="ad-table" style={{ minWidth: 650 }}>
        <thead><tr><th>Title</th><th>Subtitle</th><th>Icon</th><th>Visibility</th><th>Actions</th></tr></thead>
        <tbody>{badges.map(badge => <tr key={badge.id} data-testid={`row-trust-badge-${badge.id}`}>
          <td><div className="ad-item-name">{badge.title}</div></td>
          <td>{badge.detail}</td>
          <td><span className="ad-item-sub">{trustBadgeIconOptions.find(option => option.value === badge.icon)?.label ?? badge.icon}</span></td>
          <td><label className="ad-checkline" style={{ gap: 8, whiteSpace: 'nowrap' }}>
            <input className="ad-toggle" type="checkbox" checked={badge.active !== false} onChange={event => setBadgeActive(badge.id, event.target.checked)} aria-label={`${badge.active === false ? 'Show' : 'Hide'} ${badge.title}`} data-testid={`toggle-trust-badge-${badge.id}`} />
            <Badge tone={badge.active === false ? 'rose' : 'green'}>{badge.active === false ? 'Hidden' : 'Active'}</Badge>
          </label></td>
          <td style={{ whiteSpace: 'nowrap' }}>
            <button className="ad-icon-btn" aria-label={`Edit ${badge.title}`} onClick={() => startEdit(badge)} data-testid={`button-edit-trust-badge-${badge.id}`}><Pencil /></button>
            <button className="ad-icon-btn" aria-label={`Delete ${badge.title}`} onClick={() => setDeleteTarget(badge)} data-testid={`button-delete-trust-badge-${badge.id}`}><Trash2 /></button>
          </td>
        </tr>)}</tbody>
      </table></div> : <Empty title="No trust badges yet" body="Add a badge to share delivery, payment, support or quality details with shoppers." action={<Button className="primary" onClick={startCreate}><Plus /> Add badge</Button>} />}
    </Card>
    <Card title="Layout and appearance settings" note="These settings save to Supabase and update the storefront immediately.">
      <div className="ad-card-body ad-form-stack">
        <div className="ad-form-row">
          <Field label="Desktop layout" help="Choose one line or a two-column grid for wider screens.">
            <Select value={display.desktopLayout} onChange={event=>updateDisplay({desktopLayout:event.target.value as TrustBadgeDisplaySettings['desktopLayout']})} data-testid="select-trust-badge-desktop-layout">
              <option value="single-row">1 Row / Single Line</option>
              <option value="grid-2x2">2 Grid Rows (2x2)</option>
            </Select>
          </Field>
          <Field label="Mobile layout" help="One line stays on one row; the scroll option lets shoppers swipe through badges.">
            <Select value={display.mobileLayout} onChange={event=>updateDisplay({mobileLayout:event.target.value as TrustBadgeDisplaySettings['mobileLayout']})} data-testid="select-trust-badge-mobile-layout">
              <option value="single-row">1 Row / Single Line</option>
              <option value="grid-2x2">2x2 Grid</option>
              <option value="scroll">Horizontal Scrollable Row</option>
              <option value="stack">Vertical Stack (1 Column)</option>
              <option value="grid-3x2">3x2 Grid (6 Badges)</option>
              <option value="compact-4">Compact 4 Badges Grid</option>
            </Select>
          </Field>
        </div>
        <p className="ad-help">Desktop and mobile layouts are independent. Choose “1 Row / Single Line” for both settings to keep badges in one row at every screen size.</p>
      </div>
    </Card>
    {draft && <Modal
      title={editing ? 'Edit trust badge' : 'Add trust badge'}
      description="Changes are saved to Supabase-backed storefront content."
      onClose={() => setDraft(null)}
      footer={<><Button onClick={() => setDraft(null)}>Cancel</Button><Button className="primary" onClick={saveDraft} data-testid="button-save-trust-badge"><Save /> Save badge</Button></>}
    >
      <div className="ad-form-stack">
        <Field label="Title"><Input autoFocus value={draft.title} maxLength={80} onChange={event => setDraft(previous => previous ? { ...previous, title: event.target.value } : previous)} data-testid="input-trust-badge-title" /></Field>
        <Field label="Subtitle"><Area value={draft.detail} maxLength={180} rows={3} onChange={event => setDraft(previous => previous ? { ...previous, detail: event.target.value } : previous)} data-testid="input-trust-badge-subtitle" /></Field>
        <Field label="Icon"><Select value={trustBadgeIconOptions.some(option => option.value === draft.icon) ? draft.icon : 'check'} onChange={event => setDraft(previous => previous ? { ...previous, icon: event.target.value } : previous)} data-testid="select-trust-badge-icon">
          {trustBadgeIconOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </Select></Field>
        <Field label="Visibility"><label className="ad-checkline">
          <input className="ad-toggle" type="checkbox" checked={draft.active !== false} onChange={event => setDraft(previous => previous ? { ...previous, active: event.target.checked } : previous)} data-testid="toggle-trust-badge-active" />
          <span>{draft.active === false ? 'Hidden from storefront' : 'Active — shown on storefront'}</span>
        </label></Field>
        {error && <div className="ad-error" role="alert">{error}</div>}
      </div>
    </Modal>}
    {deleteTarget && <Modal title="Delete this trust badge?" description={deleteTarget.title} onClose={() => setDeleteTarget(null)} footer={<><Button onClick={() => setDeleteTarget(null)}>Cancel</Button><Button className="danger" onClick={removeBadge} data-testid="button-confirm-delete-trust-badge"><Trash2 /> Delete badge</Button></>}>
      <div className="ad-notice">This badge will be permanently removed from Supabase and the storefront.</div>
    </Modal>}
    {message && <Toast text={message} onClose={clear} />}
  </>;
}

const policyLabels = { terms: 'Terms & conditions', privacy: 'Privacy policy', shipping: 'Shipping policy', return: 'Returns policy' } as const;
function Pages() {
  const { data, setData,flush } = useAdminStore();
  const { message, notify, clear } = useFeedback();
  const [searchParams,setSearchParams]=useSearchParams();
  const requestedPolicy=searchParams.get('policy');
  const initialPolicy=Object.hasOwn(policyLabels,requestedPolicy??'')?requestedPolicy as keyof typeof policyLabels:'terms';
  const [policy, setPolicy] = useState<keyof typeof policyLabels>(initialPolicy);
  const [pageEditorTab,setPageEditorTab]=useState<'content'|'seo'>(searchParams.get('view')==='seo'?'seo':'content');
  const [error, setError] = useState('');
  useEffect(()=>{
    if(Object.hasOwn(policyLabels,requestedPolicy??''))setPolicy(requestedPolicy as keyof typeof policyLabels);
    setPageEditorTab(searchParams.get('view')==='seo'?'seo':'content');
  },[requestedPolicy,searchParams]);
  const updatePageQuery=(nextPolicy:keyof typeof policyLabels,nextView:'content'|'seo')=>{
    const next=new URLSearchParams(searchParams);
    next.set('policy',nextPolicy);
    if(nextView==='seo')next.set('view','seo');else next.delete('view');
    setSearchParams(next);
  };
  const doc = data.policies[policy];
  const setPolicyData = (patch: Partial<typeof doc>) => setData(prev => ({ ...prev, policies: { ...prev.policies, [policy]: { ...prev.policies[policy], ...patch } } }));
  const updateClause = (id: string, patch: { heading?: string; body?: string }) => setPolicyData({ clauses: doc.clauses.map(c => c.id === id ? { ...c, ...patch } : c) });
  const save = async () => {
    if (!doc.title.trim() || !doc.intro.trim() || doc.clauses.some(c => !c.heading.trim() || !c.body.trim())) { setError('A title, introduction, heading and body are required for every clause.'); return; }
    setError('');
    try{const result=await flush('policies');await notify(result==='local'?'Saved on this device; cloud sync is pending.':`${policyLabels[policy]} saved`,false);}
    catch(failure){await notify(`Could not save ${policyLabels[policy].toLowerCase()}: ${failure instanceof Error?failure.message:'Please retry.'}`,false);}
  };
  return <>
    <PageHead kicker="Store information" title="Policies & pages" subtitle="Maintain the practical details that help customers shop with confidence." />
    <div className="ad-tabs" role="tablist" aria-label="Policy pages">{Object.entries(policyLabels).map(([key, label]) => <button key={key} role="tab" aria-selected={policy===key} className={`ad-tab ${policy === key ? 'active' : ''}`} onClick={() => {setError('');updatePageQuery(key as keyof typeof policyLabels,'content');}} data-testid={`tab-policy-${key}`}>{label}</button>)}</div>
    <div className="ad-tabs" role="tablist" aria-label="Policy editor">{(['content','seo'] as const).map(tab=><button key={tab} role="tab" aria-selected={pageEditorTab===tab} className={`ad-tab ${pageEditorTab===tab?'active':''}`} onClick={()=>updatePageQuery(policy,tab)} data-testid={tab==='seo'?'tab-page-seo':'tab-page-content'}>{tab==='seo'?'SEO & Social':'Page content'}</button>)}</div>
    {pageEditorTab==='content'&&<Card title={policyLabels[policy]} note="Edits are synced to the public storefront" action={<Badge tone="green">Storefront page</Badge>}>
      <div className="ad-card-body ad-form-stack">
        <Field label="Page title"><Input value={doc.title} onChange={e => setPolicyData({ title: e.target.value })} data-testid="input-policy-title" /></Field>
        <Field label="Introduction"><Area value={doc.intro} onChange={e => setPolicyData({ intro: e.target.value })} data-testid="input-policy-intro" /></Field>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 5 }}><div><div className="ad-card-title">Sections</div><div className="ad-card-note">Keep each clause clear and easy to scan.</div></div><Button className="small" onClick={() => setPolicyData({ clauses: [...doc.clauses, { id: idFor(), heading: '', body: '' }] })} data-testid="button-add-policy-clause"><Plus /> Add section</Button></div>
        {doc.clauses.map((clause, i) => <details key={clause.id} className="ad-card ad-policy-clause" open={i===0} data-testid={`card-policy-clause-${clause.id}`}><summary className="ad-card-head"><div><span className="ad-kicker">Section {String(i + 1).padStart(2, '0')}</span><strong className="ad-policy-clause-summary">{clause.heading||'Untitled section'}</strong></div></summary><div className="ad-card-body ad-form-stack"><Field label="Heading"><Input value={clause.heading} onChange={e => updateClause(clause.id, { heading: e.target.value })} data-testid={`input-policy-heading-${clause.id}`} /></Field><Field label="Body"><Area value={clause.body} onChange={e => updateClause(clause.id, { body: e.target.value })} data-testid={`input-policy-body-${clause.id}`} /></Field><Button className="small danger" onClick={() => setPolicyData({ clauses: doc.clauses.filter(c => c.id !== clause.id) })} data-testid={`button-delete-policy-clause-${clause.id}`}><Trash2/> Remove section</Button></div></details>)}
        {error && <div className="ad-error" role="alert">{error}</div>}<div><Button className="primary" onClick={save} data-testid="button-save-policy"><Save /> Save {policyLabels[policy].toLowerCase()}</Button></div>
      </div>
    </Card>}
    {pageEditorTab==='seo'&&<><SeoSocialFields prefix={`page-${policy}`} value={doc.seo} source={{title:doc.title,description:`${doc.intro} ${doc.clauses.map(clause=>`${clause.heading}. ${clause.body}`).join(' ')}`,imageUrl:doc.seo?.ogImageUrl||data.content.heroSlides[0]?.desktopImageUrl,siteName:data.settings.general.storeName}} onChange={seo=>setPolicyData({seo})}/><div style={{marginTop:14}}><Button className="primary" onClick={save} data-testid="button-save-page-seo"><Save/> Save SEO & Social</Button></div></>}
    {message && <Toast text={message} onClose={clear} />}
  </>;
}

function InboxPage() {
  const { data, setData } = useAdminStore();
  const storeName=configuredStoreName(data.settings.general.storeName);
  const { settings: emailSettings } = useEmailSettings();
  const { message, notify, clear } = useFeedback();
  const [filter, setFilter] = useState<'all' | 'new' | 'read' | 'replied' | 'archived'>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [replySubject, setReplySubject] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [senderProfileId, setSenderProfileId] = useState('');
  const [replyBusy, setReplyBusy] = useState(false);
  const [replyError, setReplyError] = useState('');
  const [providerStatus, setProviderStatus] = useState<EmailProviderStatus | null>(null);
  const [providerStatusLoading, setProviderStatusLoading] = useState(true);
  useEffect(() => {
    let active = true;
    if (!functions) {
      setProviderStatus({ provider: emailSettings.provider, credentialsConfigured: false, canSend: false, detail: 'The Vercel server API is not configured.' });
      setProviderStatusLoading(false);
      return () => { active = false; };
    }
    setProviderStatusLoading(true);
    void (async () => {
      try {
        await protectForm();
        const result = await httpsCallable<void, EmailProviderStatus>(functions, 'getEmailProviderStatus')();
        if (active) setProviderStatus(result.data);
      } catch (failure) {
        if (active) setProviderStatus({
          provider: emailSettings.provider,
          credentialsConfigured: false,
          canSend: false,
          detail: failure instanceof Error ? failure.message : 'Email provider status could not be checked.',
        });
      } finally {
        if (active) setProviderStatusLoading(false);
      }
    })();
    return () => { active = false; };
  }, [emailSettings.provider]);
  const messages = data.inbox.filter(m => (filter === 'all' || m.status === filter) && `${m.name} ${m.email} ${m.message}`.toLowerCase().includes(query.toLowerCase()));
  const current = data.inbox.find(m => m.id === selected);
  const currentSenderId = senderProfileId || emailSettings.defaultSenderProfileId || emailSettings.senderProfiles[0]?.id || '';
  const changeStatus = (id: string, status: 'new' | 'read' | 'replied' | 'archived') => setData(prev => ({ ...prev, inbox: prev.inbox.map(m => m.id === id ? { ...m, status } : m) }));
  const openMessage = (item: typeof data.inbox[number]) => {
    setSelected(item.id);
    setReplyError('');
    setReplySubject(`Re: Your message to ${storeName||'the store'}`);
    setReplyBody('');
    setSenderProfileId(emailSettings.defaultSenderProfileId || emailSettings.senderProfiles[0]?.id || '');
    if (item.status === 'new') changeStatus(item.id, 'read');
  };
  const sendReply = async (event: FormEvent) => {
    event.preventDefault();
    if (!current || !functions || !currentSenderId) return;
    setReplyBusy(true);
    setReplyError('');
    try {
      await protectForm();
      await httpsCallable(functions, 'adminReplyToInbox')({
        messageId: current.id,
        senderProfileId: currentSenderId,
        subject: replySubject.trim(),
        body: replyBody.trim(),
      });
      setReplyBody('');
      await notify('Email reply sent to the customer');
    } catch (failure) {
      setReplyError(failure instanceof Error ? failure.message : 'The reply could not be sent.');
    } finally {
      setReplyBusy(false);
    }
  };
  const messageStatusLabel = (status: string) => ({
    new: 'New', read: 'Read', replied: 'Replied', archived: 'Archived',
  }[status] || 'New');
  return <>
    <PageHead kicker="Customer care" title="Inbox" subtitle="Read customer notes, track their status, and reply when email delivery is configured." />
    <div className="ad-toolbar"><div className="ad-search"><Search /><Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, email or message" data-testid="input-inbox-search" /></div><Select value={filter} onChange={e => setFilter(e.target.value as typeof filter)} style={{ width: 150 }} data-testid="select-inbox-filter"><option value="all">All messages</option><option value="new">New</option><option value="read">Read</option><option value="replied">Replied</option><option value="archived">Archived</option></Select><span style={{ marginLeft: 'auto', fontSize: 10, color: '#91867b' }}>{data.inbox.filter(m => m.status === 'new').length} unread</span></div>
    <Card title="Customer messages" note="Messages are stored in Supabase. Opening a new message marks it as read.">
      {messages.length ? <div className="ad-table-wrap"><table className="ad-table"><thead><tr><th>From</th><th>Message</th><th>Received</th><th>Status</th><th /></tr></thead><tbody>{messages.map(m => <tr key={m.id} data-testid={`row-inbox-${m.id}`}><td><div className="ad-item-name">{m.name}</div><div className="ad-item-sub">{m.email}</div></td><td style={{ maxWidth: 420 }}>{m.message.length > 110 ? `${m.message.slice(0, 110)}…` : m.message}</td><td>{dateLabel(m.submittedAt)}</td><td><Badge>{messageStatusLabel(m.status)}</Badge></td><td><Button className="small" onClick={() => openMessage(m)} data-testid={`button-open-message-${m.id}`}><Eye /> Open</Button></td></tr>)}</tbody></table></div> : <Empty title={query || filter !== 'all' ? 'No messages match' : 'Your inbox is clear'} body="Storefront contact messages saved in Supabase will appear here." />}
    </Card>
    {current && <Modal title={`Message from ${current.name}`} description={`Received ${dateLabel(current.submittedAt)} · ${current.email} · ${messageStatusLabel(current.status)}`} onClose={() => setSelected(null)} footer={<><Button onClick={() => setSelected(null)}>Close</Button><Button onClick={() => { changeStatus(current.id, current.status === 'archived' ? 'read' : 'archived'); void notify(current.status === 'archived' ? 'Message restored to inbox' : 'Message archived'); }} data-testid="button-archive-message">{current.status === 'archived' ? 'Restore to inbox' : 'Archive'}</Button></>}>
      <div className="ad-grid two" style={{ marginBottom: 16 }}><div><div className="ad-kicker">Email</div><a style={{ color: 'var(--nura-primary,#4A2837)', fontSize: 11 }} href={`mailto:${current.email}`} data-testid="link-message-email">{current.email}</a></div><div><div className="ad-kicker">Phone</div><div style={{ fontSize: 11, marginTop: 7 }}>{current.phone || 'Not provided'}</div></div></div><div style={{ background: '#f3eee5', borderRadius: 6, padding: 16, fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{current.message}</div>
      {Array.isArray(current.replies) && current.replies.length > 0 && <div style={{ marginTop: 16 }}><div className="ad-kicker">Previous replies</div>{current.replies.map((reply,index)=><div key={`${reply.sentAt}-${index}`} style={{ background: '#f8f5ef', border: '1px solid #e9e1d8', borderRadius: 6, padding: 12, marginTop: 8 }}><strong style={{ fontSize: 10 }}>{reply.subject}</strong><div style={{ fontSize: 10, marginTop: 6, whiteSpace: 'pre-wrap' }}>{reply.body}</div><div className="ad-help" style={{ marginTop: 6 }}>Sent {dateLabel(reply.sentAt)} from {reply.senderEmail}</div></div>)}</div>}
      <form onSubmit={sendReply} className="ad-form-stack" style={{ marginTop: 18 }}>
        <div className="ad-kicker">Reply by email</div>
        <Field label="From profile"><Select required value={currentSenderId} onChange={event => setSenderProfileId(event.target.value)} data-testid="select-inbox-reply-sender"><option value="">Choose a sender</option>{emailSettings.senderProfiles.map(profile=><option key={profile.id} value={profile.id}>{profile.name} · {profile.email}</option>)}</Select></Field>
        <Field label="Subject"><Input required maxLength={180} value={replySubject} onChange={event=>setReplySubject(event.target.value)} data-testid="input-inbox-reply-subject"/></Field>
        <Field label="Message"><Area required maxLength={12000} rows={6} value={replyBody} onChange={event=>setReplyBody(event.target.value)} data-testid="textarea-inbox-reply-body"/></Field>
        {!providerStatus?.canSend && <div className="ad-help" role="status" data-testid="text-inbox-email-disabled">{providerStatusLoading?'Checking email provider…':providerStatus?.detail||'Email delivery is not configured yet.'}</div>}
        {replyError && <div className="ad-error" role="alert" data-testid="error-inbox-reply">{replyError}</div>}
        <Button className="primary" type="submit" disabled={!providerStatus?.canSend||replyBusy||!currentSenderId||!replyBody.trim()} data-testid="button-send-inbox-reply">{replyBusy?'Sending reply…':'Send email'}</Button>
      </form>
    </Modal>}
    {message && <Toast text={message} onClose={clear} />}
  </>;
}

const pakistanBankOptions=[
  'Meezan Bank','HBL','UBL','MCB Bank','Bank Alfalah','Allied Bank','Faysal Bank','BankIslami','Askari Bank',
  'Bank of Punjab','Bank AL Habib','Habib Metro','Soneri Bank','Standard Chartered Pakistan','National Bank of Pakistan',
  'JS Bank','Sindh Bank','Bank of Khyber','Dubai Islamic Bank Pakistan','NayaPay','SadaPay','JazzCash','Easypaisa',
];

function CountdownTimerManager(){
  const {data,setData}=useAdminStore();
  const timer=data.content.countdownTimer;
  const update=(patch:Partial<typeof timer>)=>setData(previous=>({...previous,content:{...previous.content,countdownTimer:{...previous.content.countdownTimer,...patch}}}));
  return <Card title="Countdown timer customizer" note="Configure a store-wide promotion timer. Changes stay local until saved.">
    <div className="ad-card-body ad-form-stack">
      <label className="ad-checkline"><input type="checkbox" checked={timer.enabled} onChange={event=>update({enabled:event.target.checked})} data-testid="toggle-countdown-enabled"/> Enable countdown timer</label>
      <div className="ad-form-row">
        <Field label="Promotion title / label"><Input maxLength={120} value={timer.title} onChange={event=>update({title:event.target.value})} data-testid="input-countdown-title"/></Field>
        <Field label="Target date and time"><Input type="datetime-local" value={timer.targetDate} onChange={event=>update({targetDate:event.target.value})} data-testid="input-countdown-target"/></Field>
      </div>
      <div className="ad-form-row">
        <Field label="Timer style"><Select value={timer.style} onChange={event=>update({style:event.target.value as typeof timer.style})} data-testid="select-countdown-style"><option value="slim-bar">Minimalist slim bar</option><option value="luxury-banner">Luxury floating banner</option><option value="block-card">Bold card blocks</option><option value="rounded-pill">Rounded pill timer</option></Select></Field>
        <Field label="Display placement"><Select value={timer.placement} onChange={event=>update({placement:event.target.value as typeof timer.placement})} data-testid="select-countdown-placement"><option value="announcement">Top announcement bar</option><option value="hero">Homepage hero</option><option value="product">Product detail page</option></Select></Field>
      </div>
      <div className="ad-form-row">
        <Field label="Timer background"><Input type="color" value={timer.backgroundColor} onChange={event=>update({backgroundColor:event.target.value})} data-testid="input-countdown-background"/></Field>
        <Field label="Timer text"><Input type="color" value={timer.textColor} onChange={event=>update({textColor:event.target.value})} data-testid="input-countdown-text"/></Field>
        <Field label="Timer border"><Input type="color" value={timer.borderColor} onChange={event=>update({borderColor:event.target.value})} data-testid="input-countdown-border"/></Field>
        <Field label="When it expires"><Select value={timer.expiredBehavior} onChange={event=>update({expiredBehavior:event.target.value as typeof timer.expiredBehavior})} data-testid="select-countdown-expiry"><option value="hide">Hide timer</option><option value="message">Show expiry message</option></Select></Field>
      </div>
      {timer.expiredBehavior==='message'&&<Field label="Expiry message"><Input maxLength={160} value={timer.expiredMessage} onChange={event=>update({expiredMessage:event.target.value})} data-testid="input-countdown-expired-message"/></Field>}
      <AdminSaveButton scope="content.countdownTimer" testId="button-save-countdown-settings"/>
    </div>
  </Card>;
}

function SettingsPage() {
  const [searchParams]=useSearchParams();
  const { data, setData } = useAdminStore();
  
  const storeName=configuredStoreName(data.settings.general.storeName);
    const settingSections=['general','theme','preloader','seo','payments','social','browsing','header','widgets','countdown'] as const;
   const requestedSettingSection=searchParams.get('section');
    const resolveSection=(value:string|null)=>(value==='filter-bar'?'theme':settingSections.includes(value as (typeof settingSections)[number])?value as (typeof settingSections)[number]:'general');
    const [section, setSection] = useState<(typeof settingSections)[number]>(resolveSection(requestedSettingSection));
   useEffect(()=>{
      setSection(resolveSection(requestedSettingSection));
    },[requestedSettingSection]);
  const updateGeneral = (key: keyof typeof data.settings.general, value: string | number | boolean) => setData(prev => ({ ...prev, settings: { ...prev.settings, general: { ...prev.settings.general, [key]: value } } }));
  const updateStaticSeo=(page:'home'|'shop'|'collections'|'about'|'reviews',key:'metaTitle'|'metaDescription'|'ogTitle'|'ogDescription',value:string)=>setData(previous=>({...previous,settings:{...previous.settings,seo:{...previous.settings.seo,pages:{...previous.settings.seo.pages,[page]:{...previous.settings.seo.pages[page],[key]:value}}}}}));
  const updatePayment = (key: 'easypaisaAccountTitle'|'easypaisaNumber'|'jazzcashAccountTitle'|'jazzcashNumber', value: string) => setData(prev => ({ ...prev, settings: { ...prev.settings, paymentDetails: { ...prev.settings.paymentDetails, [key]: value } } }));
  const updateBankAccounts=(update:(accounts:typeof data.settings.paymentDetails.bankAccounts)=>typeof data.settings.paymentDetails.bankAccounts)=>setData(previous=>({...previous,settings:{...previous.settings,paymentDetails:{...previous.settings.paymentDetails,bankAccounts:update(previous.settings.paymentDetails.bankAccounts)}}}));
  const updatePreloader=(patch:Partial<typeof data.settings.preloader>)=>setData(previous=>({...previous,settings:{...previous.settings,preloader:{...previous.settings.preloader,...patch}}}));
  return <>
       <PageHead kicker="Workspace" title="Settings" subtitle="Set store defaults, social links, storefront controls and security options. Use the single Save changes action in the admin toolbar."  />
        {section==='seo'&&<Card title="SEO & metadata" note="Automatic metadata follows live product, category, and page content. Non-empty manual fields always take priority.">
          <div className="ad-card-body ad-form-stack">
            <label className="ad-checkline"><input type="checkbox" checked={data.settings.seo.autoGenerate} onChange={event=>setData(previous=>({...previous,settings:{...previous.settings,seo:{...previous.settings.seo,autoGenerate:event.target.checked}}}))} data-testid="toggle-seo-auto"/>Automatically generate SEO metadata</label>
            <p className="ad-help">When disabled, saved manual fields are used; blank fields receive safe basic metadata. Product, category, and policy overrides stay in their editors.</p>
            {(['home','shop','collections','about','reviews'] as const).map(page=><section className="ad-card" key={page} data-testid={`seo-static-page-${page}`}><header className="ad-card-head"><div><h2 className="ad-card-title">{({home:'Homepage',shop:'Shop all products',collections:'Collections',about:'About',reviews:'Reviews'} as const)[page]}</h2><div className="ad-card-note">Optional manual metadata overrides</div></div></header><div className="ad-card-body ad-form-stack">
              <Field label="Meta title"><Input maxLength={70} value={data.settings.seo.pages[page].metaTitle??''} onChange={event=>updateStaticSeo(page,'metaTitle',event.target.value)} data-testid={`input-seo-static-title-${page}`}/></Field>
              <Field label="Meta description"><Area maxLength={320} value={data.settings.seo.pages[page].metaDescription??''} onChange={event=>updateStaticSeo(page,'metaDescription',event.target.value)} data-testid={`input-seo-static-description-${page}`}/></Field>
              <div className="ad-form-row"><Field label="Open Graph title"><Input maxLength={100} value={data.settings.seo.pages[page].ogTitle??''} onChange={event=>updateStaticSeo(page,'ogTitle',event.target.value)} data-testid={`input-seo-static-og-title-${page}`}/></Field>
              <Field label="Open Graph description"><Input maxLength={320} value={data.settings.seo.pages[page].ogDescription??''} onChange={event=>updateStaticSeo(page,'ogDescription',event.target.value)} data-testid={`input-seo-static-og-description-${page}`}/></Field></div>
            </div></section>)}
            
          </div>
        </Card>}
        {section==='theme'&&<MasterThemeControls/>}
        {section==='preloader'&&<Card title="Preloader & page loading settings" note="These Supabase settings are included in the initial storefront HTML so the selected loader is ready before the app starts.">
          <div className="ad-card-body ad-form-stack">
            <label className="ad-checkline"><input type="checkbox" checked={data.settings.preloader.enabled} onChange={event=>updatePreloader({enabled:event.target.checked})} data-testid="toggle-preloader-enabled"/> Enable branded preloader</label>
            <Field label="Preloader style"><Select value={data.settings.preloader.style} onChange={event=>updatePreloader({style:event.target.value as typeof data.settings.preloader.style})} data-testid="select-preloader-style"><option value="nura-pulse">Default Store Mark Pulse</option><option value="store-logo">Custom Store Logo</option><option value="favicon">Browser Favicon</option><option value="minimal-spinner">Minimal Clean Spinner</option></Select></Field>
            <Field label="Loading text"><Input value={data.settings.preloader.loadingText} maxLength={80} onChange={event=>updatePreloader({loadingText:event.target.value})} placeholder="Loading your store..." data-testid="input-preloader-text"/><div className="ad-help">Shown beneath the selected loader. Leave blank to show no message.</div></Field>
            <Field label="Minimum display time (500–1500 ms)"><div className="ad-form-stack"><Input type="number" min={500} max={1500} step={50} value={data.settings.preloader.minimumDisplayMs} onChange={event=>updatePreloader({minimumDisplayMs:Math.max(500,Math.min(1500,Number(event.target.value)||500))})} data-testid="input-preloader-duration"/><input type="range" min={500} max={1500} step={50} value={data.settings.preloader.minimumDisplayMs} onChange={event=>updatePreloader({minimumDisplayMs:Number(event.target.value)})} aria-label="Minimum preloader display time" data-testid="range-preloader-duration"/></div><div className="ad-help">The loader fades out as soon as the storefront is mounted and this minimum time has passed. Web fonts finish loading in the background.</div></Field>
            
          </div>
        </Card>}
        {section === 'general' && <Card title="Store defaults" note="Shared storefront and backend checkout settings"><div className="ad-card-body ad-form-stack"><div className="ad-form-row"><Field label="Store name" help="Leave blank until your brand name is ready; the storefront will use a neutral label."><Input value={storeName} onChange={e => updateGeneral('storeName', e.target.value)} placeholder="e.g. Studio Name" data-testid="input-settings-store-name" /></Field><Field label="Currency"><Select value={data.settings.general.currency} disabled data-testid="select-settings-currency"><option value="PKR">PKR — Pakistani rupee</option></Select><div className="ad-help">The storefront catalog and checkout are priced in PKR.</div></Field></div><Field label="Store subtitle / tagline" help="Shown directly beneath your store name or logo, and on the preloader."><Input value={data.settings.general.storeSubtitle} maxLength={140} onChange={event=>updateGeneral('storeSubtitle',event.target.value)} placeholder="A short line about your store" data-testid="input-settings-store-subtitle"/></Field><div className="ad-form-row"><Field label="Standard delivery fee (PKR)"><Input type="number" min="0" value={data.settings.general.deliveryFee} onChange={e => updateGeneral('deliveryFee', Number(e.target.value))} data-testid="input-settings-delivery-fee" /></Field><div><span className="ad-label">Cash on delivery</span><label className="ad-checkline"><input type="checkbox" checked={data.settings.general.cashOnDelivery} onChange={e => updateGeneral('cashOnDelivery', e.target.checked)} data-testid="checkbox-cod" /> Allow as an optional method</label><div className="ad-help">Product-level eligibility is also required. Bank or wallet transfer remains the preferred checkout method.</div></div></div></div></Card>}
       {section==='payments'&&<><Card title="Bank and wallet accounts" note="Each active, complete bank destination appears at checkout">
        <div className="ad-card-body ad-form-stack">
          <p className="ad-notice">Bank account details are public payment instructions shown to customers. Do not enter private card data or banking credentials.</p>
          <datalist id="nura-pakistan-banks">{pakistanBankOptions.map(bank=><option key={bank} value={bank}/>)}</datalist>
          {!data.settings.paymentDetails.bankAccounts.length&&<p className="ad-help">No bank accounts are configured. If an older single-bank account was saved, it will appear here after it is migrated.</p>}
          {data.settings.paymentDetails.bankAccounts.map((account,index)=><article className="ad-bank-account" key={account.id} data-testid={`bank-account-${account.id}`}>
            <header className="ad-bank-account-head"><strong>Bank account {index+1}</strong><div className="ad-menu-item-actions"><label className="ad-checkline"><input type="checkbox" checked={account.active} onChange={event=>updateBankAccounts(accounts=>accounts.map(row=>row.id===account.id?{...row,active:event.target.checked}:row))} data-testid={`toggle-bank-active-${account.id}`}/> Active at checkout</label><button className="ad-icon-btn" type="button" aria-label={`Remove bank account ${index+1}`} onClick={()=>updateBankAccounts(accounts=>accounts.filter(row=>row.id!==account.id))} data-testid={`button-delete-bank-${account.id}`}><Trash2/></button></div></header>
            <div className="ad-form-row">
              <Field label="Bank or wallet"><Input list="nura-pakistan-banks" value={account.institution} onChange={event=>updateBankAccounts(accounts=>accounts.map(row=>row.id===account.id?{...row,institution:event.target.value}:row))} placeholder="Search or enter institution" data-testid={`input-bank-institution-${account.id}`}/></Field>
              <Field label="Account title"><Input value={account.accountTitle} onChange={event=>updateBankAccounts(accounts=>accounts.map(row=>row.id===account.id?{...row,accountTitle:event.target.value}:row))} data-testid={`input-bank-title-${account.id}`}/></Field>
            </div>
            <div className="ad-form-row">
              <Field label="Account number or IBAN"><Input value={account.accountNumberOrIban} onChange={event=>updateBankAccounts(accounts=>accounts.map(row=>row.id===account.id?{...row,accountNumberOrIban:event.target.value}:row))} data-testid={`input-bank-number-${account.id}`}/></Field>
              <Field label="Branch code / city"><Input value={account.branchInfo} onChange={event=>updateBankAccounts(accounts=>accounts.map(row=>row.id===account.id?{...row,branchInfo:event.target.value}:row))} data-testid={`input-bank-branch-${account.id}`}/></Field>
            </div>
            <Field label="Customer instructions (optional)"><Area value={account.instructions} maxLength={500} onChange={event=>updateBankAccounts(accounts=>accounts.map(row=>row.id===account.id?{...row,instructions:event.target.value}:row))} data-testid={`input-bank-instructions-${account.id}`}/></Field>
          </article>)}
          <div className="ad-actions-row"><Button type="button" onClick={()=>updateBankAccounts(accounts=>[...accounts,{id:idFor(),institution:'',accountTitle:'',accountNumberOrIban:'',branchInfo:'',instructions:'',active:true}])} data-testid="button-add-bank-account"><Plus/> Add new bank account</Button></div>
        </div>
      </Card><Card title="Wallet transfer details" note="Only completed Easypaisa and JazzCash destinations appear at checkout"><div className="ad-card-body ad-form-stack"><p className="ad-help">Wallet instructions are shown directly beneath bank payment methods at checkout.</p><div className="ad-form-row"><Field label="Easypaisa account title"><Input value={data.settings.paymentDetails.easypaisaAccountTitle} onChange={e=>updatePayment('easypaisaAccountTitle',e.target.value)} data-testid="input-payment-easypaisa-title"/></Field><Field label="Easypaisa number"><Input value={data.settings.paymentDetails.easypaisaNumber} onChange={e=>updatePayment('easypaisaNumber',e.target.value)} data-testid="input-payment-easypaisa-number"/></Field></div><div className="ad-form-row"><Field label="JazzCash account title"><Input value={data.settings.paymentDetails.jazzcashAccountTitle} onChange={e=>updatePayment('jazzcashAccountTitle',e.target.value)} data-testid="input-payment-jazzcash-title"/></Field><Field label="JazzCash number"><Input value={data.settings.paymentDetails.jazzcashNumber} onChange={e=>updatePayment('jazzcashNumber',e.target.value)} data-testid="input-payment-jazzcash-number"/></Field></div></div></Card></>}
    {section === 'social' && <Card title="Social profiles moved to Footer information" note="Keep description and footer social links together in one editor."><div className="ad-card-body ad-form-stack"><p className="ad-help">Manage profile names, URLs, icons, visibility, and display order inside the Brand description &amp; social links block.</p><Link className="ad-btn primary" to="/admin/content?section=footer" data-testid="link-manage-footer-social-profiles">Open Footer information</Link></div></Card>}
         {section==='header'&&<HeaderAndCardsManager/>}
         {section==='widgets'&&<FloatingWidgetsManager/>}
         {section==='countdown'&&<CountdownTimerManager/>}
      {section === 'browsing'&&<ProductBrowsingControls/>}
    
  </>;
}

function SecurityPage(){
  return <div className="ad-form-stack">
    <PageHead kicker="System protection" title="Security & access" subtitle="Store access is enforced by Supabase Auth, database policies, and server-side Vercel API routes."/>
    <div className="ad-grid two" style={{alignItems:'start'}}>
      <Card title="Row-level security" note="Policies run in PostgreSQL, not in the browser">
        <div className="ad-card-body ad-form-stack">
          <div className="ad-notice"><strong>Customer data.</strong> Profiles, checkout sessions, and orders are scoped to the authenticated customer. Catalog and published reviews are publicly readable.</div>
          <div className="ad-notice"><strong>Administrator access.</strong> Administrative writes require a matching Supabase admin allowlist record. Client-visible account metadata alone does not grant administrator permissions.</div>
          <div className="ad-notice"><strong>Database setup.</strong> Apply the versioned files in <code>supabase/migrations</code> to provision policies, the compatibility document store, and the public media bucket.</div>
        </div>
      </Card>
      <Card title="Deployment secrets" note="Keep privileged values in server-side Vercel environment variables">
        <div className="ad-card-body" style={{display:'grid',gap:11}}>
          <div className="ad-notice"><strong>Browser configuration.</strong> Only the Supabase project URL and anon key belong in <code>VITE_*</code> variables. Row-level security must remain enabled.</div>
          <div className="ad-notice"><strong>Server-only credentials.</strong> Never expose the Supabase service-role key, email-provider credentials, or messaging tokens in browser variables.</div>
          <div className="ad-notice"><strong>Launch check.</strong> Configure the initial administrator on the server before enabling admin workflows in a production deployment.</div>
        </div>
      </Card>
    </div>
  </div>;
}

function NotificationsPage(){
  const {data,setData}=useAdminStore();
  const general=data.settings.general;
  const [campaignText,setCampaignText]=useState('');
  const [campaignBusy,setCampaignBusy]=useState(false);
  const [campaignResult,setCampaignResult]=useState('');
  const update=(patch:Partial<typeof general>)=>setData(previous=>({...previous,settings:{...previous.settings,general:{...previous.settings.general,...patch}}}));
  const sendCampaign=async()=>{
    if(!functions){setCampaignResult('The Vercel server API is not configured.');return;}
    if(!window.confirm('Send this approved WhatsApp template to opted-in customers (up to 100 recipients)?'))return;
    setCampaignBusy(true);setCampaignResult('');
    try{const response=await httpsCallable(functions,'sendWhatsAppMarketingCampaign')({message:campaignText});const result=response.data as {configured?:boolean;sent?:number;failed?:number;total?:number};setCampaignResult(result.configured?`Sent ${result.sent||0} of ${result.total||0}; ${result.failed||0} failed.`:'WhatsApp API is not configured.');}
    catch(error){setCampaignResult(error instanceof Error?error.message:'Campaign could not be sent.');}
    finally{setCampaignBusy(false);}
  };
  return <div className="ad-form-stack">
    <PageHead kicker="Customer communication" title="WhatsApp API" subtitle="WhatsApp remains optional; missing credentials never block checkout or order placement."/>
    <Card title="Automatic COD WhatsApp confirmation" note="Messages are sent through the server-side Meta Cloud API adapter. Customers must opt in at checkout before any message is sent.">
      <div className="ad-card-body ad-form-stack">
        <label className="ad-checkline"><input type="checkbox" checked={general.codWhatsAppAutoSendEnabled} onChange={event=>update({codWhatsAppAutoSendEnabled:event.target.checked})} data-testid="toggle-cod-whatsapp-confirmation"/> Automatically send confirmations to customers who opt in</label>
        <label className="ad-checkline"><input type="checkbox" checked={general.codWhatsAppEnabled} onChange={event=>update({codWhatsAppEnabled:event.target.checked})} data-testid="toggle-cod-whatsapp-manual"/> Show a manual WhatsApp draft if automatic delivery is unavailable</label>
        <div className="ad-grid two">
          <Field label="Meta Phone Number ID" help="The sender's WhatsApp Business phone-number ID, not the public phone number."><Input maxLength={80} value={general.codWhatsAppPhoneNumberId} onChange={event=>update({codWhatsAppPhoneNumberId:event.target.value})} data-testid="input-cod-whatsapp-phone-id"/></Field>
          <Field label="Approved template name" help="Template must be approved in Meta and have body variables for customer name, order ID, and total."><Input maxLength={120} value={general.codWhatsAppTemplateName} onChange={event=>update({codWhatsAppTemplateName:event.target.value})} data-testid="input-cod-whatsapp-template"/></Field>
          <Field label="Template language code"><Input maxLength={16} value={general.codWhatsAppLanguage} onChange={event=>update({codWhatsAppLanguage:event.target.value})} placeholder="en" data-testid="input-cod-whatsapp-language"/></Field>
          <Field label="Store WhatsApp number (manual fallback)" help="Use international digits, e.g. 923001234567."><Input type="tel" maxLength={24} value={general.codWhatsAppNumber} onChange={event=>update({codWhatsAppNumber:event.target.value})} placeholder="923001234567" data-testid="input-cod-whatsapp-number"/></Field>
        </div>
        <div className="ad-divider"/>
        <h3 className="ad-card-title">Shipping, abandoned checkout & reviews</h3>
        <label className="ad-checkline"><input type="checkbox" checked={general.whatsappShippingUpdatesEnabled===true} onChange={event=>update({whatsappShippingUpdatesEnabled:event.target.checked})}/> Send opted-in customers Shipped and Out for Delivery updates</label>
        <div className="ad-grid two">
          <Field label="Shipped template"><Input value={general.whatsappShippedTemplateName||''} onChange={event=>update({whatsappShippedTemplateName:event.target.value})}/></Field>
          <Field label="Out for Delivery template"><Input value={general.whatsappOutForDeliveryTemplateName||''} onChange={event=>update({whatsappOutForDeliveryTemplateName:event.target.value})}/></Field>
        </div>
        <label className="ad-checkline"><input type="checkbox" checked={general.whatsappReviewRequestsEnabled===true} onChange={event=>update({whatsappReviewRequestsEnabled:event.target.checked})}/> Send one review request 72 hours after delivery</label>
        <Field label="Review request template"><Input value={general.whatsappReviewTemplateName||''} onChange={event=>update({whatsappReviewTemplateName:event.target.value})}/></Field>
        <label className="ad-checkline"><input type="checkbox" checked={general.whatsappAbandonedCartEnabled===true} onChange={event=>update({whatsappAbandonedCartEnabled:event.target.checked})}/> Send one reminder for an opted-in abandoned checkout</label>
        <Field label="Abandoned checkout template"><Input value={general.whatsappAbandonedCartTemplateName||''} onChange={event=>update({whatsappAbandonedCartTemplateName:event.target.value})}/></Field>
        <div className="ad-divider"/>
        <h3 className="ad-card-title">Promotional broadcasts</h3>
        <Field label="Approved campaign template"><Input value={general.whatsappMarketingTemplateName||''} onChange={event=>update({whatsappMarketingTemplateName:event.target.value})}/></Field>
        <p className="ad-help">Only shoppers who checked the optional WhatsApp offers consent at checkout are eligible. The approved Meta template must accept one body variable for this message. Maximum 100 unique recipients per send.</p>
        <label className="ad-field"><span className="ad-label">Campaign message variable</span><textarea className="ad-input" maxLength={500} rows={3} value={campaignText} onChange={event=>setCampaignText(event.target.value)} placeholder="Share a concise offer or new-arrival note"/></label>
        <div className="ad-actions-row"><Button className="primary" disabled={campaignBusy||!campaignText.trim()} onClick={()=>void sendCampaign()} data-testid="button-send-whatsapp-campaign">{campaignBusy?'Sending…':'Send approved-template campaign'}</Button>{campaignResult&&<span role="status" className="ad-item-sub">{campaignResult}</span>}</div>
        <div className="ad-divider"/>
        <h3 className="ad-card-title">Admin order alerts and replies</h3>
        <label className="ad-checkline"><input type="checkbox" checked={general.whatsappAdminNotificationsEnabled===true} onChange={event=>update({whatsappAdminNotificationsEnabled:event.target.checked})} data-testid="toggle-whatsapp-admin-alerts"/> Send a WhatsApp template when a new order arrives</label>
        <div className="ad-grid two">
          <Field label="Admin WhatsApp number" help="International digits, for example 923001234567. Only this number can issue CONFIRM and SHIP commands."><Input type="tel" maxLength={24} value={general.whatsappAdminPhone||''} onChange={event=>update({whatsappAdminPhone:event.target.value})} placeholder="923001234567" data-testid="input-whatsapp-admin-phone"/></Field>
          <Field label="Approved new-order template"><Input maxLength={120} value={general.whatsappAdminOrderTemplateName||''} onChange={event=>update({whatsappAdminOrderTemplateName:event.target.value})} placeholder="admin_new_order" data-testid="input-whatsapp-admin-template"/></Field>
        </div>
        <p className="ad-notice">Set WHATSAPP_ACCESS_TOKEN, WHATSAPP_APP_SECRET, and WHATSAPP_VERIFY_TOKEN as server-only Vercel environment variables. Register /api/store/whatsappWebhook with Meta to receive signed customer messages and the restricted admin commands.</p>
        <AdminSaveButton scope="settings.general" testId="button-save-whatsapp-api"/>
      </div>
    </Card>
  </div>;
}

function CustomerAdminManager(){
  const [tab,setTab]=useState<'customers'|'profile-fields'>('customers');
  return <div className="ad-form-stack">
    <div className="ad-tabs" role="tablist" aria-label="Customer settings">
      <button className={`ad-tab ${tab==='customers'?'active':''}`} role="tab" aria-selected={tab==='customers'} onClick={()=>setTab('customers')} data-testid="tab-customers-list">Customers</button>
      <button className={`ad-tab ${tab==='profile-fields'?'active':''}`} role="tab" aria-selected={tab==='profile-fields'} onClick={()=>setTab('profile-fields')} data-testid="tab-profile-field-settings">Profile field settings</button>
    </div>
    {tab==='customers'?<CustomersPage/>:<ProfileFieldSettingsManager/>}
  </div>;
}

export default function AdminPanel() {
  return <AdminShell />;
}
