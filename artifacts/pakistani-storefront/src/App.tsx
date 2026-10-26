import { lazy, Suspense, useEffect, useLayoutEffect, useRef } from 'react';
import { BrowserRouter, Route, Routes, useLocation, useNavigationType } from 'react-router-dom';
import { AdminProvider } from './context/AdminContext';
import { StoreProvider } from './context/StoreContext';
import { WishlistProvider } from './context/WishlistContext';
import { AuthProvider } from './context/AuthContext';
import RequireAdmin from './components/RequireAdmin';
import ThemeBridge from './components/ThemeBridge';
import CartToast from './components/CartToast';
import FloatingWidgets from './components/FloatingWidgets';
import { GlobalCartDrawer } from './components/Storefront';
import DynamicSeoHead from './components/DynamicSeoHead';
import { supabaseConfigured, missingSupabaseConfiguration } from './lib/supabase/client';
import { useAdminStore } from './context/AdminContext';
import { ErrorBoundary } from './components/error-boundary';
import HomePage from './pages/HomePage';

const AdminPanel=lazy(()=>import('./admin/AdminPanel'));
const NotFound=lazy(()=>import('./pages/not-found'));
const ProductDetailPage=lazy(()=>import('./pages/ProductDetailPage'));
const CartPage=lazy(()=>import('./pages/CartPage'));
const CheckoutPage=lazy(()=>import('./pages/CheckoutPage'));
const TrackOrderPage=lazy(()=>import('./pages/TrackOrderPage'));
const PolicyPage=lazy(()=>import('./pages/PolicyPage'));
const AccountPage=lazy(()=>import('./pages/CustomerAccountPage'));
const OrderSuccessPage=lazy(()=>import('./pages/OrderSuccessPage'));
const CatalogPage=lazy(()=>import('./pages/CatalogPage'));
const CategoryPage=lazy(()=>import('./pages/CategoryPage'));
const CollectionsPage=lazy(()=>import('./pages/CollectionsPage'));
const AboutPage=lazy(()=>import('./pages/AboutPage'));
const ContactPage=lazy(()=>import('./pages/ContactPage'));
const ReviewsPage=lazy(()=>import('./pages/ReviewsPage'));
const WishlistPage=lazy(()=>import('./pages/WishlistPage'));

type AnalyticsWindow=Window&{dataLayer?:unknown[][];gtag?:(...args:unknown[])=>void};

function RouteLoadingFallback(){
  return <main className="page-wrap flex min-h-[45vh] items-center justify-center py-16" role="status" aria-live="polite" data-route-loading-fallback>
    <span className="sr-only">Loading page…</span>
    <span className="h-7 w-7 animate-spin rounded-full border-2 border-[#e8dfd8] border-t-[#6b2447]"/>
  </main>;
}

function StartupDataReadySignal(){
  const {data,storefrontSettingsState,catalogReady,categoriesReady}=useAdminStore();
  useEffect(()=>{
    if(storefrontSettingsState==='loading'||!catalogReady||!categoriesReady)return;
    window.dispatchEvent(new CustomEvent('nura-storefront-brand-ready',{detail:{
      storeName:data.settings.general.storeName.trim(),
      storeSubtitle:data.settings.general.storeSubtitle.trim(),
      logoDotColor:data.content.theme.logoDotColor,
      logoDotVisible:data.content.theme.logoDotVisible,logoDotShape:data.content.theme.logoDotShape,
      taglineColor:data.content.theme.taglineColor,
    }}));
    window.dispatchEvent(new Event('nura-storefront-data-ready'));
  },[data.settings.general.storeName,data.settings.general.storeSubtitle,data.content.theme.logoDotColor,data.content.theme.logoDotVisible,data.content.theme.logoDotShape,data.content.theme.taglineColor,storefrontSettingsState,catalogReady,categoriesReady]);
  return null;
}

function SupabaseSetupScreen(){
  useEffect(()=>{window.dispatchEvent(new Event('nura-storefront-data-ready'));},[]);
  return <main className="page-wrap py-20"><p className="eyebrow">Store setup · Supabase</p><h1 className="mt-4 text-3xl font-semibold">Supabase configuration is required.</h1><p className="mt-4 max-w-2xl text-sm leading-7">Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to the deployment environment, apply the supplied Supabase migrations, then rebuild the storefront.</p><p className="mt-5 text-xs">Missing configuration: {missingSupabaseConfiguration.join(', ')}</p></main>;
}

function PersistedScrollPosition() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const firstRender = useRef(true);
  const activeKey = useRef(`${location.pathname}${location.search}${location.hash}`);
  const savePosition = (key = activeKey.current) => {
    try {
      sessionStorage.setItem(`nura-scroll-v1:${key}`, JSON.stringify({ x: window.scrollX, y: window.scrollY }));
    } catch { /* Session storage is optional; navigation remains usable without it. */ }
  };
  useLayoutEffect(() => {
    const key = `${location.pathname}${location.search}${location.hash}`;
    const previousKey = activeKey.current;
    if (previousKey !== key) savePosition(previousKey);
    activeKey.current = key;
    const restore = () => {
      try {
        const saved = sessionStorage.getItem(`nura-scroll-v1:${key}`);
        const position = saved ? JSON.parse(saved) as { x?: unknown; y?: unknown } : null;
        if (position && Number.isFinite(position.x) && Number.isFinite(position.y)) {
          window.scrollTo(Number(position.x), Number(position.y));
          return;
        }
      } catch { /* Ignore malformed or unavailable session state. */ }
      if (navigationType !== 'POP') window.scrollTo(0, 0);
    };
    if (firstRender.current || navigationType === 'POP') requestAnimationFrame(restore);
    else if (previousKey !== key) requestAnimationFrame(() => window.scrollTo(0, 0));
    firstRender.current = false;
  }, [location.pathname, location.search, location.hash, navigationType]);

  useEffect(() => {
    const remember = () => savePosition();
    let timer = 0;
    const onScroll = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(remember, 120);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pagehide', remember);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pagehide', remember);
      remember();
    };
  }, []);
  return null;
}

function StorefrontAnalyticsTag(){
  const {data}=useAdminStore();
  const {pathname}=useLocation();
  const analytics=data.settings.analytics;
  useEffect(()=>{
    if(pathname.startsWith('/admin')||!analytics.enabled||!/^G-[A-Z0-9-]+$/i.test(analytics.measurementId))return;
    const id=analytics.measurementId;
    const browser=window as AnalyticsWindow;
    browser.dataLayer=browser.dataLayer||[];
    browser.gtag=browser.gtag||((...args:unknown[])=>browser.dataLayer!.push(args));
    let script=document.getElementById('nura-ga4-tag') as HTMLScriptElement|null;
    if(!script){
      script=document.createElement('script');
      script.async=true;
      script.id='nura-ga4-tag';
      document.head.appendChild(script);
    }
    if(script.dataset.nuraAnalytics!==id){
      script.dataset.nuraAnalytics=id;
      script.src=`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
    }
    browser.gtag('js',new Date());
    browser.gtag('config',id,{send_page_view:false});
  },[analytics.enabled,analytics.measurementId]);
  useEffect(()=>{
    if(pathname.startsWith('/admin')||!analytics.enabled||!/^G-[A-Z0-9-]+$/i.test(analytics.measurementId))return;
    const browser=window as AnalyticsWindow;
    browser.gtag?.('event','page_view',{
      page_path:pathname,
      page_location:`${window.location.origin}${pathname}`,
      page_title:document.title,
      send_to:analytics.measurementId,
    });
  },[analytics.enabled,analytics.measurementId,pathname]);
  return null;
}

function App() {
  if (!supabaseConfigured) return <SupabaseSetupScreen />;
  return (
    <BrowserRouter>
      <AuthProvider>
      <AdminProvider>
        <StartupDataReadySignal />
        <ThemeBridge />
        <StoreProvider>
        <WishlistProvider>
          <DynamicSeoHead />
          <PersistedScrollPosition />
          <StorefrontAnalyticsTag />
          <CartToast />
          <FloatingWidgets />
          <Suspense fallback={null}><GlobalCartDrawer /></Suspense>
          <ErrorBoundary resetKey={window.location.pathname}>
          <Suspense fallback={<RouteLoadingFallback />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/shop" element={<CatalogPage />} />
            <Route path="/collections" element={<CollectionsPage />} />
            <Route path="/collections/:collectionSlug" element={<CategoryPage />} />
            <Route path="/category/:categorySlug" element={<CategoryPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/reviews" element={<ReviewsPage />} />
            <Route path="/product/:id/:slug" element={<ProductDetailPage />} />
            <Route path="/product/:id" element={<ProductDetailPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/track-order" element={<TrackOrderPage />} />
            <Route path="/policies/:type" element={<PolicyPage />} />
            <Route path="/policy/:type" element={<PolicyPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/wishlist" element={<WishlistPage />} />
            <Route path="/order-success/:orderId" element={<OrderSuccessPage />} />
            <Route path="/admin/*" element={<RequireAdmin><AdminPanel /></RequireAdmin>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
          </ErrorBoundary>
        </WishlistProvider>
        </StoreProvider>
      </AdminProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;