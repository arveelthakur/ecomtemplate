import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { type Product, type StoreCategory } from '../utils/store';
import { useAdminStore } from './AdminContext';
import { collection, doc, getDocFromServer, onSnapshot, query, setDoc, where } from '../lib/supabase/documents';
import { httpsCallable, functions } from '../lib/supabase/functions';
import { db } from '../lib/supabase/index';
import { useAuth } from './AuthContext';
import { cleanData } from '../utils/sanitize';
import { protectForm } from '../hooks/use-recaptcha';

export type CartLine={key:string;product:Product;quantity:number;variant:string;variantId?:string};
export function cartLineInventoryIssue(line:CartLine):string|null{
  const stock=line.product.stock;
  const option=line.variant?` (${line.variant})`:'';
  if(!Number.isSafeInteger(stock)||stock<1||line.product.inStock===false)return `${line.product.name}${option} is out of stock. Remove it or choose another option.`;
  if(line.quantity>stock)return `Only ${stock} of ${line.product.name}${option} remain. Reduce the quantity to continue.`;
  return null;
}
export type OrderStatus='Pending'|'Processing'|'Confirmed by Call'|'Shipped'|'Out for Delivery'|'Delivered'|'Cancelled';
export type VoiceCallEvent={status:string;message:string;createdAt:string};
export type VoiceCallState={status:'not-called'|'dispatched'|'confirmed'|'cancelled'|'failed';callSid?:string;updatedAt?:string;events?:VoiceCallEvent[]};
export type PaymentMethod='BANK_TRANSFER'|'EASYPAISA'|'JAZZCASH'|'COD';
export type CustomerOrder={
  id:string;
  userId:string;
  fullName:string;
  email:string;
  phone:string;
  address:string;
  addressLine2?:string;
  city:string;
  province:string;
  postalCode?:string;
  items:CartLine[];
  cartAddons?:{id:string;name:string;description:string;price:number}[];
  subtotal:number;
  quantityTierDiscount?:number;
  buyXGetYDiscount:number;
  couponCode:string;
  couponDiscount:number;
  deliveryCharge:number;
  grandTotal:number;
  status:OrderStatus;
  courier:string;
  trackingNumber:string;
  trackingUrl?:string;
  createdAt:string;
  paymentMethod:PaymentMethod;
  transactionReference?:string;
  paymentVerified?:boolean;
  paymentVerifiedAt?:string|Date|{toDate:()=>Date};
  paymentVerifiedBy?:string;
  paymentVerifiedByLabel?:string;
  customerNote?:string;
  whatsappOptIn?:boolean;
  whatsappUpdatesOptIn?:boolean;
  whatsappMarketingOptIn?:boolean;
  whatsappConfirmation?:{status:'sending'|'sent'|'failed';messageId?:string;attempts?:number;sentAt?:string;updatedAt?:string};
  voiceCall?:VoiceCallState;
};
export type PlaceOrderInput=Pick<CustomerOrder,'fullName'|'email'|'phone'|'address'|'addressLine2'|'city'|'province'|'postalCode'|'couponCode'|'paymentMethod'|'transactionReference'|'customerNote'>&{whatsappOptIn?:boolean;whatsappUpdatesOptIn?:boolean;whatsappMarketingOptIn?:boolean;cartAddonIds?:string[]};
type StoreUser={name:string;email:string};
export type StoreCtx={
  products:Product[];
  categories:StoreCategory[];
  cart:CartLine[];
  selectedCartAddonIds:string[];
  setCartAddonSelected:(id:string,selected:boolean)=>void;
  cartSyncError:string;
  cartDrawerOpen:boolean;
  openCartDrawer:()=>void;
  closeCartDrawer:()=>void;
  add:(product:Product,quantity?:number,variant?:string,variantId?:string)=>boolean;
  remove:(keyOrId:string|number)=>void;
  quantity:(keyOrId:string|number,nextQuantity:number)=>void;
  clearCart:()=>void;
  count:number;
  subtotal:number;
  orders:CustomerOrder[];
   placeOrder:(input:PlaceOrderInput)=>Promise<CustomerOrder>;
   cancelOrder:(orderId:string)=>Promise<void>;
   updateOrder:(orderId:string,patch:Partial<Pick<CustomerOrder,'status'|'courier'|'trackingNumber'|'trackingUrl'>>)=>Promise<void>;
  verifyOrderPayment:(orderId:string)=>Promise<void>;
  updateProduct:(product:Product)=>void;
  deleteProduct:(productId:number)=>void;
  saveCategory:(category:StoreCategory)=>void;
  deleteCategory:(categoryId:string)=>boolean;
  findOrder:(orderId:string,phone:string)=>CustomerOrder|undefined;
  currentUser:StoreUser|null;
   orderError:string;
  cartToast:{message:string}|null;
};
export const StoreContext=createContext<StoreCtx|null>(null);
const CART_KEY='nura-cart-v2';
const CART_STORAGE_PREFIX='nura-cart-v3:';

function readStorage<T>(key:string,fallback:T):T{
  if(typeof window==='undefined')return fallback;
  try{
    const value=window.localStorage.getItem(key);
    return value?JSON.parse(value) as T:fallback;
  }catch{return fallback;}
}
function serializeCart(cart:CartLine[]){
  return cart.map(line=>({productId:line.product.id,quantity:line.quantity,variant:line.variant,...(line.variantId?{variantId:line.variantId}:{})}));
}
function variantProduct(product:Product,variantId?:string){
  const variant=product.variantMatrix?.find(item=>item.id===variantId);
  return variant?{...product,price:variant.price,oldPrice:variant.oldPrice,image:variant.image||product.image,mobileImage:variant.image?undefined:product.mobileImage,stock:variant.stock,inStock:variant.stock>0,variants:[variant.label]}:product;
}
function resolveCartLine(line:CartLine,product:Product):CartLine{
  const selected=product.variantMatrix?.find(item=>item.id===line.variantId||(!line.variantId&&item.label===line.variant));
  if((product.variantMatrix?.length&&!selected)||(line.variantId&&!selected)){
    return {...line,product:{...product,stock:0,inStock:false,variants:[line.variant]}};
  }
  const resolved=variantProduct(product,selected?.id);
  return {...line,product:resolved,...(selected?.id?{variantId:selected.id}:{})};
}
function mergeCart(primary:CartLine[],secondary:CartLine[]){
  const result=new Map(primary.map(line=>[line.key,line]));
  for(const line of secondary)if(!result.has(line.key))result.set(line.key,line);
  return [...result.values()].slice(0,100);
}
function writeStorage(key:string,value:string|null){
  try{
    if(value===null)window.localStorage.removeItem(key);
    else window.localStorage.setItem(key,value);
  }catch{/* The storefront remains usable when browser storage is unavailable. */}
}
function normalizePhone(phone:string){return phone.replace(/\D/g,'');}
function hydrateCart(raw:unknown,catalog:Product[]):CartLine[]{
  if(!Array.isArray(raw))return [];
  return raw.flatMap((entry):CartLine[]=>{
    if(!entry||typeof entry!=='object')return [];
    const line=entry as Partial<CartLine>;
    const productId=Number((entry as {productId?:unknown;product?:{id?:unknown}}).productId??line.product?.id);
    const product=catalog.find(item=>item.id===productId);
    if(!product||typeof line.quantity!=='number'||!Number.isFinite(line.quantity)||!Number.isInteger(line.quantity)||line.quantity<1)return [];
    const variant=typeof line.variant==='string'&&line.variant?line.variant:'Standard';
    const variantId=typeof line.variantId==='string'?line.variantId:undefined;
    const selected=product.variantMatrix?.find(item=>item.id===variantId||(!variantId&&item.label===variant));
    const validVariant=product.variantMatrix?.length?Boolean(selected):((Array.isArray(product.variants)&&product.variants.length?product.variants:['Standard']).includes(variant));
    if(!validVariant)return [];
    const hydrated:CartLine={key:`${product.id}-${variantId??selected?.id??variant}`,product,quantity:Math.min(99,Math.floor(line.quantity)),variant,...(variantId||selected?.id?{variantId:variantId??selected?.id}:{})};
    return [resolveCartLine(hydrated,product)];
  }).slice(0,100);
}
export function StoreProvider({children}:{children:ReactNode}) {
  const {data,setData,catalogReady}=useAdminStore();
  const {user,isAdmin,profile,loading:authLoading,ensureCustomerSession}=useAuth();
  const products=data.products;
  const categories=data.categories;
  const [cart,setCart]=useState<CartLine[]>([]);
  const [selectedCartAddonIds,setSelectedCartAddonIds]=useState<string[]>(()=>{
    const saved=readStorage<unknown>('nura-cart-addon-ids',[]);
    return Array.isArray(saved)?saved.filter((id):id is string=>typeof id==='string').slice(0,8):[];
  });
  const [cartSyncError,setCartSyncError]=useState('');
  const [cartDrawerOpen,setCartDrawerOpen]=useState(false);
  const [cartScope,setCartScope]=useState('');
  const [cartCloudReady,setCartCloudReady]=useState({uid:'',revision:-1});
  const [cartToast,setCartToast]=useState<{message:string}|null>(null);
  const cartToastTimer=useRef<number|null>(null);
  const placingOrder=useRef(false);
  const [orders,setOrders]=useState<CustomerOrder[]>([]);
  const [orderError,setOrderError]=useState('');
  const currentUser:StoreUser|null=user?{name:profile?.displayName||user.displayName||(user.isAnonymous?'':'Customer'),email:user.email||''}:null;
  const desiredCartScope=user?.uid??'guest';
  const cartScopeRevision=useRef(0);
  const previousCartScope=useRef(desiredCartScope);
  if(previousCartScope.current!==desiredCartScope){
    previousCartScope.current=desiredCartScope;
    cartScopeRevision.current++;
  }
  const cartHydrated=catalogReady&&!authLoading&&cartScope===desiredCartScope;
  useEffect(()=>{
    if(cartHydrated&&cart.length===0)setSelectedCartAddonIds([]);
  },[cartHydrated,cart.length]);

  const showAddedToast=useCallback(()=>{
    setCartToast({message:'Item added to your cart'});
    if(cartToastTimer.current!==null)window.clearTimeout(cartToastTimer.current);
    cartToastTimer.current=window.setTimeout(()=>{setCartToast(null);cartToastTimer.current=null;},3200);
  },[]);
  const openCartDrawer=useCallback(()=>setCartDrawerOpen(true),[]);
  const closeCartDrawer=useCallback(()=>setCartDrawerOpen(false),[]);
  const setCartAddonSelected=useCallback((id:string,selected:boolean)=>{
    setSelectedCartAddonIds(current=>selected?[...new Set([...current,id])].slice(0,8):current.filter(currentId=>currentId!==id));
  },[]);
  useEffect(()=>writeStorage('nura-cart-addon-ids',JSON.stringify(selectedCartAddonIds)),[selectedCartAddonIds]);
  useEffect(()=>()=>{if(cartToastTimer.current!==null)window.clearTimeout(cartToastTimer.current);},[]);
  useEffect(()=>{
    if(!catalogReady||authLoading||cartScope===desiredCartScope)return;
    const scoped=readStorage<unknown|null>(`${CART_STORAGE_PREFIX}${desiredCartScope}`,null);
    const legacy=desiredCartScope==='guest'?readStorage<unknown>(CART_KEY,readStorage<unknown>('nura-demo-cart-v1',[])):[];
    setCart(hydrateCart(scoped??legacy,products));
    setCartScope(desiredCartScope);
    setCartSyncError('');
  },[catalogReady,authLoading,desiredCartScope,cartScope,products]);
  useEffect(()=>{
    if(!cartHydrated)return;
    const serialized=serializeCart(cart);
    const storageValue=JSON.stringify(serialized);
    writeStorage(`${CART_STORAGE_PREFIX}${desiredCartScope}`,storageValue);
    if(desiredCartScope==='guest')writeStorage(CART_KEY,storageValue);
    const uid=user?.uid;
    if(!uid||!db||cartCloudReady.uid!==uid||cartCloudReady.revision!==cartScopeRevision.current)return;
    const timer=window.setTimeout(()=>{
      const storeClient=db;
      if(!storeClient)return;
      void setDoc(doc(storeClient,'users',uid,'storefrontState','cart'),{items:serialized,updatedAt:Date.now()})
        .then(()=>setCartSyncError(''))
        .catch(()=>setCartSyncError('Your cart is saved on this device, but cloud sync is temporarily unavailable.'));
    },250);
    return ()=>window.clearTimeout(timer);
  },[cart,cartHydrated,desiredCartScope,user?.uid,cartCloudReady]);
  useEffect(()=>{
    if(!cartHydrated||!user?.uid||!db)return;
    const uid=user.uid;
    const revision=cartScopeRevision.current;
    let firstSnapshot=true;
    let active=true;
    const unsubscribe=onSnapshot(doc(db,'users',uid,'storefrontState','cart'),snapshot=>{
      if(!active)return;
      const remote=hydrateCart(snapshot.exists()?snapshot.data()?.items:[],products);
      if(firstSnapshot){
        firstSnapshot=false;
        const local=hydrateCart(readStorage<unknown>(`${CART_STORAGE_PREFIX}${uid}`,[]),products);
        const guest=hydrateCart(readStorage<unknown>(`${CART_STORAGE_PREFIX}guest`,readStorage<unknown>(CART_KEY,[])),products);
        setCart(snapshot.exists()?remote:mergeCart(local,guest));
      }else{
        setCart(current=>current.length===remote.length&&current.every((line,index)=>line.key===remote[index]?.key&&line.quantity===remote[index]?.quantity)?current:remote);
      }
      setCartCloudReady({uid,revision});
      setCartSyncError('');
    },()=>{
      if(!active)return;
      firstSnapshot=false;
      setCartCloudReady({uid,revision});
      setCartSyncError('Your cart is saved on this device, but cloud sync is temporarily unavailable.');
    });
    return ()=>{active=false;unsubscribe();};
  },[cartHydrated,user?.uid,products]);
  useEffect(()=>{
    setOrders([]);setOrderError('');
    if(!db||!user?.uid)return;
    const source=isAdmin?collection(db,'orders'):query(collection(db,'orders'),where('userId','==',user.uid));
    return onSnapshot(source,snapshot=>setOrders(snapshot.docs.flatMap(item=>{
      const raw=item.data();
      return typeof raw.id==='string'&&typeof raw.userId==='string'&&Array.isArray(raw.items)?[{...raw,id:item.id} as CustomerOrder]:[];
    })),()=>setOrderError('Orders could not be refreshed. Please try again shortly.'));
  },[user?.uid,isAdmin]);
   useEffect(()=>{
     setCart(old=>{
       const next=old.flatMap(line=>{
         const current=products.find(product=>product.id===line.product.id);
         return current?[resolveCartLine(line,current)]:[];
       });
       return next.length===old.length&&next.every((line,index)=>line.product===old[index].product&&line.quantity===old[index].quantity&&line.variantId===old[index].variantId)?old:next;
     });
    },[products,catalogReady,cartHydrated]);

  const add=useCallback((product:Product,quantity=1,variant?:string,variantId?:string):boolean=>{
    const safeQuantity=Math.max(1,Math.min(99,Math.floor(quantity)));
    const selectedVariant=variant??product.variantMatrix?.[0]?.label??product.variants?.[0]??'Standard';
    const current=products.find(item=>item.id===product.id)??product;
    const selected=current.variantMatrix?.find(item=>item.id===variantId);
    if(current.variantMatrix?.length&&!selected)return false;
    const available=Math.max(0,selected?.stock??current.stock??0);
    const key=`${product.id}-${selected?.id??selectedVariant}`;
    const pricedProduct=variantProduct(current,selected?.id);
    if((selected?selected.stock<1:current.inStock===false||available===0))return false;
    setCart(old=>old.some(line=>line.key===key)
      ?old.map(line=>line.key===key?{...line,product:pricedProduct,quantity:Math.min(available,99,line.quantity+safeQuantity)}:line)
      :[...old,{key,product:pricedProduct,quantity:Math.min(available,safeQuantity),variant:selectedVariant,...(selected?.id?{variantId:selected.id}:{})}]);
    showAddedToast();
    return true;
  },[products,showAddedToast]);
  const remove=useCallback((keyOrId:string|number)=>{
    setCart(old=>old.filter(line=>typeof keyOrId==='number'?line.product.id!==keyOrId:line.key!==keyOrId));
  },[]);
  const quantity=useCallback((keyOrId:string|number,nextQuantity:number)=>{
    const safeQuantity=Math.floor(nextQuantity);
    setCart(old=>old.flatMap(line=>{
      const matches=typeof keyOrId==='number'?line.product.id===keyOrId:line.key===keyOrId;
      if(!matches)return [line];
        const base=products.find(item=>item.id===line.product.id);
        if(!base)return [];
        const refreshed=resolveCartLine(line,base);
        const product=refreshed.product;
        if(safeQuantity<1)return [];
        if(cartLineInventoryIssue(refreshed))return safeQuantity<line.quantity?[{...refreshed,quantity:safeQuantity}]:[refreshed];
        return [{...refreshed,quantity:Math.min(product.stock,99,safeQuantity)}];
    }));
  },[products]);
  const clearCart=useCallback(()=>setCart([]),[]);
   const placeOrder=useCallback(async(input:PlaceOrderInput):Promise<CustomerOrder>=>{
      if(!functions)throw new Error('Checkout is temporarily unavailable. Please try again later.');
     if(!cart.length)throw new Error('Your cart is empty.');
     if(placingOrder.current)throw new Error('An order is already being submitted.');
     placingOrder.current=true;
     try{
       await protectForm();
        const storeClient=db;
        if(!storeClient)throw new Error('We could not verify current stock. Please check your connection and try again.');
        let snapshots;
        try{
          snapshots=await Promise.all([...new Set(cart.map(line=>line.product.id))].map(productId=>getDocFromServer(doc(storeClient,'products',String(productId)))));
        }catch{
          throw new Error('We could not verify current stock. Please check your connection and try again.');
        }
        const latestById=new Map<number,Product>();
        for(const snapshot of snapshots){
          if(!snapshot.exists())continue;
          const raw=snapshot.data();
          const productId=Number(raw.id??snapshot.id);
          const current=products.find(product=>product.id===productId)??cart.find(line=>line.product.id===productId)?.product;
          if(!current)continue;
          const stock=Number(raw.stock);
          latestById.set(productId,{
            ...current,
            stock:Number.isSafeInteger(stock)&&stock>=0?stock:0,
            inStock:raw.inStock!==false,
            variantMatrix:Array.isArray(raw.variantMatrix)?raw.variantMatrix as Product['variantMatrix']:undefined,
          });
        }
        const refreshedCart=cart.map(line=>{
          const latest=latestById.get(line.product.id);
          return latest?resolveCartLine(line,latest):{...line,product:{...line.product,stock:0,inStock:false}};
        });
        setCart(current=>current.map(line=>{
          const latest=latestById.get(line.product.id);
          return latest?resolveCartLine(line,latest):{...line,product:{...line.product,stock:0,inStock:false}};
        }));
        const inventoryIssue=refreshedCart.map(cartLineInventoryIssue).find(Boolean);
        if(inventoryIssue)throw new Error(inventoryIssue);
        const orderUser=user??await ensureCustomerSession();
       const items=cart.map(line=>({productId:line.product.id,quantity:line.quantity,variant:line.variant,...(line.variantId?{variantId:line.variantId}:{})}));
        const enabledAddonIds=new Set(data.content.cartDrawerSettings.addons.filter(addon=>addon.enabled).map(addon=>addon.id));
        const activeAddonIds=selectedCartAddonIds.filter(id=>enabledAddonIds.has(id)).sort();
        const fingerprint=JSON.stringify({items,cartAddonIds:activeAddonIds});
       const previous=readStorage<{fingerprint:string;id:string}|null>('nura-checkout-attempt',null);
       const attempt=previous?.fingerprint===fingerprint?previous:{fingerprint,id:crypto.randomUUID()};
       writeStorage('nura-checkout-attempt',JSON.stringify(attempt));
       const request=httpsCallable<unknown,CustomerOrder>(functions,'placeOrder');
         const result=await request({ ...cleanData(input),cartAddonIds:activeAddonIds,requestId:attempt.id,items });
       const order=result.data;
        setOrders(old=>[order,...old.filter(item=>item.id!==order.id)]);setCart([]);setSelectedCartAddonIds([]);
       writeStorage('nura-checkout-attempt',null);
       return order;
     }finally{placingOrder.current=false;}
       },[cart,products,user?.uid,ensureCustomerSession,selectedCartAddonIds,data.content.cartDrawerSettings.addons]);
   const cancelOrder=useCallback(async(orderId:string)=>{
     if(!functions)throw new Error('The Vercel server API is not configured.');
     await protectForm();
     await httpsCallable(functions,'cancelOrder')({orderId});
   },[]);
    const updateOrder=useCallback(async(orderId:string,patch:Partial<Pick<CustomerOrder,'status'|'courier'|'trackingNumber'|'trackingUrl'>>)=>{
      if(!functions||!isAdmin)throw new Error('Administrator access is required.');
      await protectForm();
      await httpsCallable(functions,'adminUpdateOrder')({orderId,patch:cleanData(patch)});
   },[isAdmin]);
   const verifyOrderPayment=useCallback(async(orderId:string)=>{
     if(!functions||!isAdmin)throw new Error('Administrator access is required.');
     await protectForm();
     await httpsCallable(functions,'adminVerifyOrderPayment')({orderId});
   },[isAdmin]);
  const updateProduct=useCallback((product:Product)=>{
    setData(old=>({...old,products:old.products.some(item=>item.id===product.id)?old.products.map(item=>item.id===product.id?product:item):[...old.products,product]}));
  },[setData]);
  const deleteProduct=useCallback((productId:number)=>{
    setData(old=>({...old,products:old.products.filter(product=>product.id!==productId),deals:old.deals.map(deal=>({...deal,productIds:deal.productIds.filter(id=>id!==productId)}))}));
    setCart(old=>old.filter(line=>line.product.id!==productId));
  },[setData]);
  const saveCategory=useCallback((category:StoreCategory)=>{
    setData(old=>{
      const previous=old.categories.find(item=>item.id===category.id);
      return {
        ...old,
        categories:previous?old.categories.map(item=>item.id===category.id?category:item):[...old.categories,category],
        products:previous&&previous.name!==category.name?old.products.map(product=>product.category===previous.name?{...product,category:category.name}:product):old.products,
      };
    });
  },[setData]);
  const deleteCategory=useCallback((categoryId:string)=>{
    const category=categories.find(item=>item.id===categoryId);
    if(!category||products.some(product=>product.category===category.name))return false;
    setData(old=>({...old,categories:old.categories.filter(item=>item.id!==categoryId)}));
    return true;
  },[categories,products,setData]);
  const findOrder=useCallback((orderId:string,phone:string)=>{
    const normalizedId=orderId.trim().toUpperCase();
    const normalizedNumber=normalizePhone(phone);
    if(!normalizedId||!normalizedNumber)return undefined;
    return orders.find(order=>order.id.toUpperCase()===normalizedId&&normalizePhone(order.phone)===normalizedNumber);
  },[orders]);

  const value=useMemo(()=>({
    products,categories,
      cart,selectedCartAddonIds,setCartAddonSelected,cartSyncError,cartDrawerOpen,openCartDrawer,closeCartDrawer,add,remove,quantity,clearCart,cartToast,
    count:cart.reduce((total,line)=>total+line.quantity,0),
    subtotal:cart.reduce((total,line)=>total+line.product.price*line.quantity,0),
     orders,placeOrder,cancelOrder,updateOrder,verifyOrderPayment,updateProduct,deleteProduct,saveCategory,deleteCategory,findOrder,currentUser,orderError,
     }),[products,categories,cart,selectedCartAddonIds,setCartAddonSelected,cartSyncError,cartDrawerOpen,openCartDrawer,closeCartDrawer,add,remove,quantity,clearCart,cartToast,orders,placeOrder,cancelOrder,updateOrder,verifyOrderPayment,updateProduct,deleteProduct,saveCategory,deleteCategory,findOrder,currentUser,orderError]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
export function useStore(){const ctx=useContext(StoreContext);if(!ctx)throw new Error('StoreProvider is required');return ctx;}