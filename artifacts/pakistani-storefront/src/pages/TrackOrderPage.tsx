import { useEffect, useState, type FormEvent } from 'react';
import { ExternalLink, PackageCheck, Search } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { formatPKR } from '../utils/store';
import { ActionButton, CommerceLayout } from '../components/CommerceLayout';

const courierPortals:Record<string,{name:string;url:string}>={
  tcs:{name:'TCS',url:'https://www.tcsexpress.com/track'},
  tcsexpress:{name:'TCS',url:'https://www.tcsexpress.com/track'},
  pakistanpost:{name:'Pakistan Post',url:'https://ep.gov.pk/track.asp'},
  pakistanpostoffice:{name:'Pakistan Post',url:'https://ep.gov.pk/track.asp'},
  mp:{name:'M&P',url:'https://mpex.mulphilog.com/track-shipment.php'},
  mpexpress:{name:'M&P',url:'https://mpex.mulphilog.com/track-shipment.php'},
  mulphilog:{name:'M&P',url:'https://mpex.mulphilog.com/track-shipment.php'},
  leopard:{name:'Leopards',url:'https://pk.leopardscourier.com/tracking'},
  leopards:{name:'Leopards',url:'https://pk.leopardscourier.com/tracking'},
  leopardscourier:{name:'Leopards',url:'https://pk.leopardscourier.com/tracking'},
  callcourier:{name:'Call Courier',url:'https://callcourier.com.pk/tracking'},
  postex:{name:'PostEx',url:'https://postex.pk/tracking'},
  trax:{name:'Trax',url:'https://trax.pk/tracking'},
};
function resolveCourierPortal(courier:string){
  const normalized=courier.toLowerCase().replace(/[^a-z0-9]/g,'');
  if(courierPortals[normalized])return courierPortals[normalized];
  const alias=Object.keys(courierPortals).find(key=>key.length>3&&normalized.startsWith(key));
  return alias?courierPortals[alias]:undefined;
}
function resolveHttpsTrackingUrl(value:unknown):string|undefined{
  if(typeof value!=='string'||!value.trim())return undefined;
  try{
    const url=new URL(value.trim());
    return url.protocol==='https:'&&url.hostname?url.href:undefined;
  }catch{return undefined;}
}

export default function TrackOrderPage() {
  const { findOrder } = useStore();
  const {user,loading}=useAuth();
  const [orderId, setOrderId] = useState('');
  const [phone, setPhone] = useState('');
  const [searchedFor,setSearchedFor]=useState<{orderId:string;phone:string}|null>(null);
  const [copied,setCopied]=useState(false);
  const [copyError,setCopyError]=useState('');
  const result=searchedFor?findOrder(searchedFor.orderId,searchedFor.phone):undefined;
  const courierPortal=result?.courier?resolveCourierPortal(result.courier):undefined;
  const customTrackingUrl=resolveHttpsTrackingUrl(result?.trackingUrl);
  const courierTrackingUrl=customTrackingUrl||courierPortal?.url;
  useEffect(()=>{
    if(!copied)return;
    const timer=window.setTimeout(()=>setCopied(false),1800);
    return()=>window.clearTimeout(timer);
  },[copied]);
  function submit(event: FormEvent) {
    event.preventDefault();
    setCopied(false);
    setCopyError('');
    setSearchedFor({orderId:orderId.trim(),phone:phone.trim()});
  }
  async function copyTrackingNumber(){
    if(!result?.trackingNumber)return;
    setCopyError('');
    try{
      let copiedToClipboard=false;
      if(navigator.clipboard?.writeText){
        try{await navigator.clipboard.writeText(result.trackingNumber);copiedToClipboard=true;}
        catch{/* Retry with the browser's selection-based clipboard fallback. */}
      }
      if(!copiedToClipboard){
        const field=document.createElement('textarea');
        field.value=result.trackingNumber;
        field.setAttribute('readonly','');
        field.style.position='fixed';
        field.style.opacity='0';
        document.body.appendChild(field);
        field.select();
        try{copiedToClipboard=document.execCommand('copy');}
        finally{field.remove();}
      }
      if(!copiedToClipboard)throw new Error('Clipboard access is unavailable.');
      setCopied(true);
    }catch{
      setCopied(false);
      setCopyError('Copy was unavailable. Select the tracking number to copy it manually.');
    }
  }
  if(loading)return <CommerceLayout title="Track your order"><p role="status">Checking your account…</p></CommerceLayout>;
  if(!user)return <CommerceLayout title="Sign in to track your order" intro="Order details are private to your account."><Link to="/account" state={{from:'/track-order'}} className="underline">Sign in</Link></CommerceLayout>;
  return <CommerceLayout eyebrow="A little reassurance" title="Track your order" intro="Enter the order ID and phone number used at checkout. Only orders accessible to your signed-in account can be found.">
    <div className="grid gap-8 lg:grid-cols-[.85fr_1.15fr]">
        <form onSubmit={submit} className="h-fit border border-[#e9e2d8] bg-[#f7f3ec] p-5 sm:p-7"><label className="block text-[11px] font-semibold">Order ID<input required value={orderId} onChange={e=>setOrderId(e.target.value)} placeholder="Enter your order ID" className="mt-2 h-11 w-full border border-[#dfd6ca] bg-[#FDFBF7] px-3 text-xs outline-none focus:border-[#6B2447]" data-testid="input-track-order-id"/></label><label className="mt-4 block text-[11px] font-semibold">Phone number<input required value={phone} onChange={e=>setPhone(e.target.value)} placeholder="0300 1234567" className="mt-2 h-11 w-full border border-[#dfd6ca] bg-[#FDFBF7] px-3 text-xs outline-none focus:border-[#6B2447]" data-testid="input-track-phone"/></label><div className="mt-5"><ActionButton type="submit" testId="button-track-order"><Search size={14}/>Find my order</ActionButton></div><p className="mt-4 text-[10px] leading-5 text-[#8a7e73]">Use the order ID shown in your account and the exact phone number from checkout.</p></form>
      <div className="min-h-[240px]">
         {searchedFor&&!result&&<div className="border border-[#ead6d6] bg-[#fbf1ef] p-5 text-xs leading-6 text-[#844b53]" role="status" data-testid="status-order-not-found">We couldn’t find a matching order in this account. Check both details and try again.</div>}
         {result&&<section className="border border-[#dfe5da] bg-[#f3f6f0] p-5 sm:p-7" data-testid="card-tracking-result">
           <div className="flex items-start justify-between gap-3">
             <div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#74816c]">Order found</p><h2 className="mt-1 text-xl font-semibold" data-testid="text-tracking-order-id">{result.id}</h2></div>
             <span className="bg-[#e2e9dc] px-3 py-1.5 text-[10px] font-semibold text-[#58674f]" data-testid="status-order-state">{result.status}</span>
           </div>
           <div className="mt-5 grid gap-4 text-xs sm:grid-cols-2">
             <p><span className="text-[#82776c]">Placed</span><br/><strong data-testid="text-order-created">{new Date(result.createdAt).toLocaleDateString('en-PK',{day:'numeric',month:'long',year:'numeric'})}</strong></p>
             <p><span className="text-[#82776c]">Courier partner</span><br/><strong data-testid="text-order-courier">{result.courier||'Preparing your parcel'}</strong></p>
             <div>
               <span className="text-[#82776c]">Tracking number</span>
               {result.trackingNumber?<div className="mt-1 flex flex-wrap items-center gap-2">
                 <strong className="break-all font-semibold" data-testid="text-tracking-number">{result.trackingNumber}</strong>
                 <button type="button" onClick={()=>void copyTrackingNumber()} className="inline-flex min-h-8 shrink-0 items-center rounded-sm border border-[#c9d4c2] px-3 text-[10px] font-semibold text-[#53644d] hover:bg-[#e6ecdf]" data-testid="button-copy-tracking-number" aria-live="polite">{copied?'Copied!':'Copy'}</button>
                 {copyError&&<span className="basis-full text-[10px] text-[#844b53]" role="status" data-testid="status-copy-tracking">{copyError}</span>}
               </div>:<strong className="mt-1 block" data-testid="text-tracking-number">Will be shared when dispatched</strong>}
             </div>
             <p><span className="text-[#82776c]">Order total</span><br/><strong>{formatPKR(result.grandTotal)}</strong></p>
           </div>
           <div className="mt-5 border-t border-[#dce3d7] pt-4">
             <p className="flex items-center gap-2 text-xs font-semibold"><PackageCheck size={15} className="text-[#74816c]"/>Your order, at a glance</p>
             <p className="mt-2 text-[11px] leading-5 text-[#74695f]">{result.status==='Pending'?'Your order is pending review.':result.status==='Processing'?'Your order is being prepared.':result.status==='Shipped'?'Your parcel is on its way. Use your courier tracking number for the latest update.':result.status==='Delivered'?'Your parcel has been marked delivered. We hope it brings a softer moment.':'This order has been cancelled.'}</p>
           </div>
            {result.trackingNumber&&courierTrackingUrl&&<a href={courierTrackingUrl} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex min-h-11 items-center gap-2 bg-[#6B2447] px-4 text-xs font-semibold text-white hover:bg-[#55203a]" data-testid="link-official-courier">{customTrackingUrl?`Open ${result.courier||'Courier'} Shipment Tracking`:`Open ${result.courier||'Courier'} Tracking Portal`} <ExternalLink size={13}/></a>}
         </section>}
      </div>
    </div>
  </CommerceLayout>;
}