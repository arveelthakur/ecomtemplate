import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { doc, onSnapshot, setDoc } from '../lib/supabase/documents';
import { db } from '../lib/supabase/index';
import { useAuth } from './AuthContext';
import { isProductCustomerVisible, type Product } from '../utils/store';

const WISHLIST_STORAGE_KEY='nura-wishlist-v1';
const WISHLIST_STORAGE_PREFIX='nura-wishlist-v2:';

export type WishlistContextValue={
  productIds:number[];
  isSaved:(productId:number)=>boolean;
  toggle:(productId:number)=>void;
  clear:()=>void;
  syncError:string;
};

export const WishlistContext=createContext<WishlistContextValue|null>(null);

function normalizeWishlist(value:unknown):number[]{
  return Array.isArray(value)?[...new Set(value.filter((id):id is number=>typeof id==='number'&&Number.isSafeInteger(id)&&id>0))].slice(0,100):[];
}
export function getVisibleWishlistProducts(productIds:number[],products:Product[]):Product[]{
  return productIds
    .map(id=>products.find(product=>product.id===id&&isProductCustomerVisible(product)))
    .filter((product):product is Product=>Boolean(product));
}
function readWishlist(scope='guest'):number[]{
  if(typeof window==='undefined')return [];
  try{
    const scoped=window.localStorage.getItem(`${WISHLIST_STORAGE_PREFIX}${scope}`);
    const parsed=JSON.parse(scoped??(scope==='guest'?window.localStorage.getItem(WISHLIST_STORAGE_KEY)||'[]':'[]'));
    return normalizeWishlist(parsed);
  }catch{return [];}
}

export function WishlistProvider({children}:{children:ReactNode}){
  const {user,loading}=useAuth();
  const scope=user?.uid??'guest';
  const [productIds,setProductIds]=useState<number[]>([]);
  const [loadedScope,setLoadedScope]=useState('');
  const [cloudReady,setCloudReady]=useState({uid:'',revision:-1});
  const [syncError,setSyncError]=useState('');
  const scopeRevision=useRef(0);
  const previousScope=useRef(scope);
  if(previousScope.current!==scope){
    previousScope.current=scope;
    scopeRevision.current++;
  }
  const ready=!loading&&loadedScope===scope;
  useEffect(()=>{
    if(loading||loadedScope===scope)return;
    setProductIds(readWishlist(scope));
    setLoadedScope(scope);
    setSyncError('');
  },[loading,scope,loadedScope]);
  useEffect(()=>{
    if(!ready)return;
    try{
      const serialized=JSON.stringify(productIds);
      window.localStorage.setItem(`${WISHLIST_STORAGE_PREFIX}${scope}`,serialized);
      if(scope==='guest')window.localStorage.setItem(WISHLIST_STORAGE_KEY,serialized);
    }catch{/* Storage can be unavailable in private browsing. */}
  },[productIds,ready,scope]);
  useEffect(()=>{
    if(!ready||!user?.uid||!db)return;
    const uid=user.uid;
    const revision=scopeRevision.current;
    let firstSnapshot=true;
    let active=true;
    const unsubscribe=onSnapshot(doc(db,'users',uid,'storefrontState','wishlist'),snapshot=>{
      if(!active)return;
      const remote=normalizeWishlist(snapshot.exists()?snapshot.data()?.items:[]);
      if(firstSnapshot){
        firstSnapshot=false;
        const local=readWishlist(uid);
        const guest=readWishlist('guest');
        setProductIds(snapshot.exists()?remote:normalizeWishlist([...local,...guest]));
      }else setProductIds(current=>current.length===remote.length&&current.every((id,index)=>id===remote[index])?current:remote);
      setCloudReady({uid,revision});
      setSyncError('');
    },()=>{
      if(!active)return;
      firstSnapshot=false;
      setCloudReady({uid,revision});
      setSyncError('Your wishlist is saved on this device, but cloud sync is temporarily unavailable.');
    });
    return ()=>{active=false;unsubscribe();};
  },[ready,user?.uid]);
  useEffect(()=>{
    if(!ready||!user?.uid||!db||cloudReady.uid!==user.uid||cloudReady.revision!==scopeRevision.current)return;
    const timer=window.setTimeout(()=>{
      const storeClient=db;
      if(!storeClient)return;
      void setDoc(doc(storeClient,'users',user.uid,'storefrontState','wishlist'),{items:productIds,updatedAt:Date.now()})
        .then(()=>setSyncError(''))
        .catch(()=>setSyncError('Your wishlist is saved on this device, but cloud sync is temporarily unavailable.'));
    },250);
    return ()=>window.clearTimeout(timer);
  },[productIds,ready,user?.uid,cloudReady]);
  const isSaved=useCallback((productId:number)=>productIds.includes(productId),[productIds]);
  const toggle=useCallback((productId:number)=>setProductIds(current=>current.includes(productId)?current.filter(id=>id!==productId):current.length>=100?current:[...current,productId]),[]);
  const clear=useCallback(()=>setProductIds([]),[]);
  const value=useMemo(()=>({productIds,isSaved,toggle,clear,syncError}),[productIds,isSaved,toggle,clear,syncError]);
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist(){
  const context=useContext(WishlistContext);
  if(!context)throw new Error('useWishlist must be used inside WishlistProvider.');
  return context;
}
