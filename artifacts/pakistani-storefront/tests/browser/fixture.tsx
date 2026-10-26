// Dev-server-only fixture with actual components and no live backend. Not a build entry.
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter,Routes,Route,Link} from 'react-router-dom';
import {AdminContext,defaultAdminData,type AdminContextValue} from '../../src/context/AdminContext';
import {AuthContext,type AuthValue} from '../../src/context/AuthContext';
import {StoreProvider} from '../../src/context/StoreContext';
import {WishlistProvider} from '../../src/context/WishlistContext';
import ThemeBridge from '../../src/components/ThemeBridge';
import StoreImage from '../../src/components/StoreImage';
import Storefront,{GlobalCartDrawer} from '../../src/components/Storefront';
import { browserFixtureCategories, browserFixtureProducts } from '../fixtures/catalog';
import CartPage from '../../src/pages/CartPage';
import CheckoutPage from '../../src/pages/CheckoutPage';
import CatalogPage from '../../src/pages/CatalogPage';
import ProductDetailPage from '../../src/pages/ProductDetailPage';
import AboutPage from '../../src/pages/AboutPage';
import PolicyPage from '../../src/pages/PolicyPage';
import CollectionsPage from '../../src/pages/CollectionsPage';
import WishlistPage from '../../src/pages/WishlistPage';
import {synchronizeSectionCopy} from '../../src/utils/storefrontLayout';
import '../../src/index.css';

const auth={user:null,isAdmin:false,loading:false,profile:null,error:'',adminCheckStatus:'denied'} as unknown as AuthValue;
function Fixture(){
  const [data,setRawData]=useState(()=>({
    ...structuredClone(defaultAdminData),
    categories:structuredClone(browserFixtureCategories),
    products:structuredClone(browserFixtureProducts),
  }));
  const setData:AdminContextValue['setData']=update=>setRawData(previous=>{
    const next=typeof update==='function'?update(previous):update;
    return {...next,content:{...next.content,homeSections:synchronizeSectionCopy(previous.content,next.content)}};
  });
  const admin={data,setData,storefrontSettingsState:'ready',initialized:true,catalogReady:true,categoriesReady:true,syncError:'',saving:false,dirty:false,flush:async()=>'remote'} as unknown as AdminContextValue;
  const toggle=(id:string)=>setData(previous=>{
    const visible=!previous.content.homeSections.find(section=>section.id===id)?.visible;
    return {...previous,content:{...previous.content,announcement:id==='announcement'?{...previous.content.announcement,visible}:previous.content.announcement,homeSections:previous.content.homeSections.map(s=>s.id===id?{...s,visible}:s)}};
  });
  return <AuthContext.Provider value={auth}><AdminContext.Provider value={admin}><StoreProvider><WishlistProvider><BrowserRouter>
    <ThemeBridge/>
    <StoreImage src={data.content.heroSlides[0].desktopImageUrl} mobileSrc="/intentionally-missing-test.jpg" alt="" aria-hidden="true" data-testid="fixture-responsive-fallback" style={{position:'absolute',width:1,height:1,pointerEvents:'none'}}/>
    <details style={{padding:8,fontSize:12,background:'#fff',color:'#222'}}>
      <summary>Isolated audit controls (no live database)</summary>
      <nav style={{display:'flex',flexWrap:'wrap',gap:12,padding:8}}>
        <Link to="/">Home</Link><Link to="/cart">Cart</Link><Link to="/checkout">Checkout</Link><Link to="/wishlist">Wishlist</Link>
        <button onClick={()=>toggle('story')}>Toggle story</button><button onClick={()=>toggle('offerBanner')}>Toggle occasion</button><button onClick={()=>toggle('mediaBanner')}>Toggle gift</button><button onClick={()=>toggle('footer')}>Toggle footer</button>
        <button onClick={()=>setData(p=>({...p,content:{...p.content,categoryLayout:'box',categoryDisplayMode:'grid'}}))}>Box grid</button>
        <button onClick={()=>setData(p=>({...p,content:{...p.content,categoryLayout:'circle',categoryDisplayMode:'horizontal',categoryMotionStyle:'auto'}}))}>Circle marquee</button>
      </nav>
      <fieldset style={{display:'flex',flexWrap:'wrap',gap:12}}>
        {data.content.homeSections.map(section=><label key={section.id}><input type="checkbox" checked={section.visible} onChange={()=>toggle(section.id)} data-testid={`fixture-section-${section.id}`}/>{section.id}</label>)}
      </fieldset>
    </details>
    <Routes>
      <Route path="/" element={<Storefront/>}/><Route path="/tests/browser/fixture.html" element={<Storefront/>}/>
      <Route path="/cart" element={<CartPage/>}/><Route path="/checkout" element={<CheckoutPage/>}/>
      <Route path="/shop" element={<CatalogPage/>}/><Route path="/about" element={<AboutPage/>}/>
      <Route path="/collections" element={<CollectionsPage/>}/><Route path="/wishlist" element={<WishlistPage/>}/>
      <Route path="/product/:id/:slug" element={<ProductDetailPage/>}/><Route path="/product/:id" element={<ProductDetailPage/>}/>
      <Route path="/policies/:type" element={<PolicyPage/>}/>
    </Routes><GlobalCartDrawer/>
  </BrowserRouter></WishlistProvider></StoreProvider></AdminContext.Provider></AuthContext.Provider>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
