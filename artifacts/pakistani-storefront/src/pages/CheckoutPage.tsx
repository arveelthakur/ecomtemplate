import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, LockKeyhole } from 'lucide-react';
import { cartLineInventoryIssue, useStore } from '../context/StoreContext';
import { useAdminStore } from '../context/AdminContext';
import { calculatePromotionSummary, formatPKR } from '../utils/store';
import { ActionButton, CommerceLayout, formatMoney } from '../components/CommerceLayout';
import { pakistanCities } from '../utils/pakistan';
import { useAuth } from '../context/AuthContext';
import type { PaymentMethod } from '../context/StoreContext';
import { httpsCallable } from '../lib/supabase/functions';
import { functions } from '../lib/supabase/index';
import { protectForm } from '../hooks/use-recaptcha';

export default function CheckoutPage() {
  const { cart, subtotal, placeOrder, currentUser } = useStore();
  const {data}=useAdminStore();
  const pageCopy=data.content.storePages.checkout;
  const pageModules=data.content.storePageLayouts.checkout;
  const moduleOrder=(id:string)=>pageModules.findIndex(module=>module.id===id);
  const {loading,profile}=useAuth();
  const navigate = useNavigate();
  const [coupon, setCoupon] = useState('');
  const [couponApplied, setCouponApplied] = useState(false);
  const [couponMessage, setCouponMessage] = useState('');
   const [form, setForm] = useState({ fullName: currentUser?.name ?? '', email: currentUser?.email ?? '', phone: '', address: '', addressLine2:'', city: '', province:'',postalCode:'', customerNote:'' });
   const [paymentMethod,setPaymentMethod]=useState<PaymentMethod>('BANK_TRANSFER');
   const [transactionReference,setTransactionReference]=useState('');
   const [copied,setCopied]=useState('');
   const [busy,setBusy]=useState(false);
    const [recoveryConsent,setRecoveryConsent]=useState(false);
     const [whatsappRecoveryConsent,setWhatsappRecoveryConsent]=useState(false);
    const [whatsappOptIn,setWhatsappOptIn]=useState(false);
     const [whatsappUpdatesOptIn,setWhatsappUpdatesOptIn]=useState(false);
     const [whatsappMarketingOptIn,setWhatsappMarketingOptIn]=useState(false);
    const [recoveryNote,setRecoveryNote]=useState('');
   useEffect(()=>setForm(previous=>({
     ...previous,
     fullName:previous.fullName||profile?.displayName||currentUser?.name||'',
     email:currentUser?.email||previous.email,
     phone:previous.phone||profile?.phone||'',
     address:previous.address||profile?.addressLine1||'',
     addressLine2:previous.addressLine2||profile?.addressLine2||'',
     city:previous.city||profile?.city||'',
     province:previous.province||profile?.province||'',
      postalCode:previous.postalCode||profile?.postalCode||'',
   })),[currentUser?.email,currentUser?.name,profile]);
  const [error, setError] = useState('');
  const promotions=calculatePromotionSummary(cart,data.deals,data.content.quantityDiscounts);
  const inventoryIssues=cart.map(cartLineInventoryIssue).filter((issue):issue is string=>Boolean(issue));
  const bogoDiscount=promotions.buyXGetYDiscount;
  const quantityTierDiscount=promotions.quantityTierDiscount;
  const eligibleSubtotal=promotions.discountedSubtotal;
  const activeCoupon=couponApplied?data.coupons.find(item=>item.code===coupon.trim().toUpperCase()&&item.active&&(!item.expiresAt||item.expiresAt>=new Date().toISOString().slice(0,10))):undefined;
  const couponDiscount = activeCoupon&&subtotal>=activeCoupon.minimumSubtotal ? Math.round(eligibleSubtotal*activeCoupon.percentOff/100) : 0;
  const deliveryEligibleSubtotal=cart.filter(line=>line.product.freeDeliveryEligible).reduce((sum,line)=>sum+line.product.price*line.quantity,0);
  const deliveryThreshold=data.content.announcement.freeDeliveryThreshold;
  const deliveryCharge = deliveryEligibleSubtotal > deliveryThreshold ? 0 : data.settings.general.deliveryFee;
  const grandTotal = eligibleSubtotal - couponDiscount + deliveryCharge;
  const paymentDetails=data.settings.paymentDetails;
  const bankAccounts=paymentDetails.bankAccounts.filter(account=>account.active&&account.institution.trim()&&account.accountTitle.trim()&&account.accountNumberOrIban.trim());
  const bankConfigured=bankAccounts.length>0;
  const easypaisaConfigured=Boolean(String(paymentDetails.easypaisaAccountTitle??'').trim()&&String(paymentDetails.easypaisaNumber??'').trim());
  const jazzcashConfigured=Boolean(String(paymentDetails.jazzcashAccountTitle??'').trim()&&String(paymentDetails.jazzcashNumber??'').trim());
  const availableTransfers:PaymentMethod[]=[
    ...(bankConfigured?['BANK_TRANSFER' as const]:[]),
    ...(easypaisaConfigured?['EASYPAISA' as const]:[]),
    ...(jazzcashConfigured?['JAZZCASH' as const]:[]),
  ];
   const cityOptions=Object.entries(pakistanCities).flatMap(([province,cities])=>cities.map(city=>({city,province})));
   const codAvailable=data.settings.general.cashOnDelivery&&cart.length>0&&cart.every(line=>line.product.cashOnDeliveryEnabled===true);
   useEffect(()=>{
      if(!currentUser||(!recoveryConsent&&!whatsappRecoveryConsent)||!cart.length||!functions)return;
     const callableFunctions=functions;
     let active=true;
     const saveSession=async()=>{
       try{
         await protectForm();
         await httpsCallable(callableFunctions,'trackCheckoutSession')({
            consent:recoveryConsent,
            whatsappConsent:whatsappRecoveryConsent,
            phone:form.phone,
            email:recoveryConsent?form.email:'',
           items:cart.map(line=>({productId:line.product.id,quantity:line.quantity,variant:line.variant})),
         });
         if(active)setRecoveryNote('One-reminder permission saved.');
       }catch{
         if(active)setRecoveryNote('We could not save the reminder preference. Checkout is still available.');
       }
     };
     const timer=window.setTimeout(()=>{void saveSession();},800);
     const heartbeat=window.setInterval(()=>{void saveSession();},5*60*1000);
     return()=>{active=false;window.clearTimeout(timer);window.clearInterval(heartbeat);};
   },[currentUser?.email,cart,recoveryConsent,whatsappRecoveryConsent,form.email,form.phone]);
   const changeRecoveryConsent=async(consented:boolean)=>{
     setRecoveryConsent(consented);
     setRecoveryNote('');
     if(consented||whatsappRecoveryConsent||!currentUser||!functions)return;
     try{
       await protectForm();
       await httpsCallable(functions,'clearCheckoutSession')({});
       setRecoveryNote('The checkout reminder has been removed.');
     }catch{
       setRecoveryNote('We could not update the reminder preference. Please try again.');
     }
   };
   const changeWhatsAppRecoveryConsent=async(consented:boolean)=>{
     setWhatsappRecoveryConsent(consented);
     if(consented||recoveryConsent||!currentUser||!functions)return;
     try{await protectForm();await httpsCallable(functions,'clearCheckoutSession')({});setRecoveryNote('Checkout reminders have been removed.');}
     catch{setRecoveryNote('We could not update the reminder preference. Please try again.');}
   };
  useEffect(()=>{
    if(paymentMethod==='COD'&&codAvailable)return;
    if(availableTransfers.includes(paymentMethod))return;
    if(paymentMethod==='BANK_TRANSFER'&&!availableTransfers.length)return;
    setPaymentMethod(availableTransfers[0]??(codAvailable?'COD':'BANK_TRANSFER'));
  },[paymentMethod,bankConfigured,easypaisaConfigured,jazzcashConfigured,codAvailable]);
  const paymentMethodAvailable=paymentMethod==='COD'?codAvailable:availableTransfers.includes(paymentMethod);
   const recipientDetails: Array<[string,string]> = paymentMethod==='EASYPAISA'
      ? [['Account title',paymentDetails.easypaisaAccountTitle],['Easypaisa number',paymentDetails.easypaisaNumber]]
      : paymentMethod==='JAZZCASH'
        ? [['Account title',paymentDetails.jazzcashAccountTitle],['JazzCash number',paymentDetails.jazzcashNumber]]
        : [];
  const paymentLabel=paymentMethod==='BANK_TRANSFER'?'Bank transfer':paymentMethod==='EASYPAISA'?'Easypaisa':paymentMethod==='JAZZCASH'?'JazzCash':'Cash on delivery';
  async function copyPaymentDetail(label:string,value:string){
    try{await navigator.clipboard.writeText(value);setCopied(label);window.setTimeout(()=>setCopied(''),1600);}
    catch{setError('Copy was blocked. Select the payment detail and copy it manually.');}
  }
  function applyCoupon() {
    const code=coupon.trim().toUpperCase();
    const candidate=data.coupons.find(item=>item.code.toUpperCase()===code);
    if(!candidate||!candidate.active){setCouponApplied(false);setCouponMessage('That coupon is not active. Check the code and try again.');return;}
    if(candidate.expiresAt&&candidate.expiresAt<new Date().toISOString().slice(0,10)){setCouponApplied(false);setCouponMessage('That coupon has expired.');return;}
    if(subtotal<candidate.minimumSubtotal){setCouponApplied(false);setCouponMessage(`This code requires a subtotal of at least ${formatMoney(candidate.minimumSubtotal)}.`);return;}
    setCoupon(candidate.code);
    setCouponApplied(true);
    setCouponMessage(`${candidate.code} applied: ${candidate.percentOff}% off.`);
  }
   async function submit(event: FormEvent) {
    event.preventDefault();
    if (!cart.length) return;
      if(!paymentMethodAvailable){setError('This payment method is unavailable for your cart. Choose a configured bank or wallet method.');return;}
      if(paymentMethod!=='COD'&&!transactionReference.trim()){setError('Enter the transaction reference for your transfer.');return;}
      const selectedCity=cityOptions.find(option=>option.city===form.city);
      if(!selectedCity){setError('Choose a supported delivery city.');return;}
     setBusy(true);setError('');
     try {
          const order = await placeOrder({ ...form, province:selectedCity.province, paymentMethod, transactionReference:paymentMethod==='COD'?'':transactionReference.trim(), couponCode: activeCoupon ? activeCoupon.code : '', whatsappOptIn:paymentMethod==='COD'&&whatsappOptIn, whatsappUpdatesOptIn, whatsappMarketingOptIn });
       navigate(`/order-success/${order.id}`);
      } catch(failure) {
        const code=(failure as {code?:string})?.code;
        setError(code==='auth/operation-not-allowed'
          ?'Guest checkout is not enabled in this store configuration yet. Please try again later or sign in from the account menu.'
          :failure instanceof Error?failure.message:'Unable to place the order. Please try again.');
      }
     finally {setBusy(false);}
  }
   if(loading)return <CommerceLayout title={pageCopy.title} intro={pageCopy.intro}><p role="status">Preparing secure checkout…</p></CommerceLayout>;
   if (!cart.length) return <CommerceLayout eyebrow="Almost there" title={pageCopy.title} intro={pageCopy.intro}><Link to="/collections" className="mt-5 inline-flex min-h-11 items-center bg-[#6B2447] px-5 text-xs font-semibold text-white" data-testid="link-checkout-shop">Explore the collection</Link></CommerceLayout>;
     return <CommerceLayout eyebrow="Secure checkout" title={pageCopy.title} intro={pageCopy.intro}>
     <div className="grid min-w-0 gap-9 lg:grid-cols-[1fr_360px]">
        <form onSubmit={submit} className="flex min-w-0 flex-col gap-8">
          {inventoryIssues.length>0&&<div className="border border-[#e5c4c1] bg-[#fff6f4] p-4 text-xs leading-5 text-[#8f3e43]" role="alert" data-testid="status-checkout-stock"><p>{inventoryIssues.join(' ')}</p><Link to="/cart" className="mt-2 inline-block font-semibold underline underline-offset-2" data-testid="link-checkout-review-cart">Review your cart and update it</Link></div>}
          {pageModules.find(module=>module.id==='deliveryDetails')?.visible!==false&&<section style={{order:moduleOrder('deliveryDetails')}}><div className="mb-4 flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-full bg-[#e8ece1] text-xs font-semibold text-[#596752]">01</span><div><h2 className="text-sm font-semibold">Delivery details</h2><p className="mt-1 text-[10px] text-[#877c71]">These details are used to fulfill your order.</p></div></div>
           <div className="grid gap-4 sm:grid-cols-2">{[['fullName','Full name','text'],['phone','Phone number','tel'],['email','Email address (optional)','email']].map(([key,label,type])=><label key={key} className="text-[11px] font-semibold text-[#62564e]">{label}<input required={key!=='email'} maxLength={key==='phone'?25:150} type={type} value={form[key as keyof typeof form]} onChange={e=>setForm({...form,[key]:e.target.value})} className="mt-2 h-11 w-full border border-[#dfd6ca] bg-transparent px-3 text-xs font-normal outline-none focus:border-[#6B2447]" data-testid={`input-checkout-${key}`} placeholder={key==='phone'?'+92 3xx xxx xxxx':key==='email'?'For order updates':''}/></label>)}
              <label className="text-[11px] font-semibold">City<select required value={form.city} onChange={event=>{const choice=cityOptions.find(option=>option.city===event.target.value);setForm({...form,city:event.target.value,province:choice?.province||''});}} className="mt-2 h-11 w-full border bg-transparent px-3 text-xs" data-testid="select-checkout-city"><option value="">Choose city</option>{cityOptions.map(({city,province})=><option key={`${province}-${city}`} value={city}>{city}</option>)}</select></label>
           </div>
           <label className="mt-4 block text-[11px] font-semibold text-[#62564e]">Address line 1<input required maxLength={240} value={form.address} onChange={e=>setForm({...form,address:e.target.value})} className="mt-2 h-11 w-full border border-[#dfd6ca] bg-transparent px-3 text-xs font-normal outline-none focus:border-[#6B2447]" data-testid="input-checkout-address" placeholder="House number and street"/></label>
           <details className="mt-4"><summary className="cursor-pointer text-[10px] text-[#6B2447]">Add optional delivery details</summary><label className="mt-3 block text-[11px] font-semibold text-[#62564e]">Address line 2<input maxLength={240} value={form.addressLine2} onChange={e=>setForm({...form,addressLine2:e.target.value})} className="mt-2 h-11 w-full border border-[#dfd6ca] bg-transparent px-3 text-xs font-normal outline-none focus:border-[#6B2447]" data-testid="input-checkout-address-line2" placeholder="Apartment, floor, area"/></label><label className="mt-3 block text-[11px] font-semibold text-[#62564e]">Postal code<input maxLength={20} autoComplete="postal-code" value={form.postalCode} onChange={event=>setForm({...form,postalCode:event.target.value})} className="mt-2 h-11 w-full border border-[#dfd6ca] bg-transparent px-3 text-xs" data-testid="input-checkout-postal-code"/></label><label className="mt-3 block text-[11px] font-semibold text-[#62564e]">Order note<textarea maxLength={1000} value={form.customerNote} onChange={e=>setForm({...form,customerNote:e.target.value})} rows={3} className="mt-2 w-full border border-[#dfd6ca] bg-transparent px-3 py-3 text-xs font-normal outline-none focus:border-[#6B2447]" data-testid="input-checkout-customer-note"/></label></details>
              {currentUser&&form.email&&<label className="mt-4 flex cursor-pointer items-start gap-2 text-[10px] leading-5 text-[#766d64]" data-testid="label-abandoned-cart-consent"><input type="checkbox" checked={recoveryConsent} onChange={event=>void changeRecoveryConsent(event.target.checked)} className="mt-1 accent-[#6B2447]" data-testid="checkbox-abandoned-cart-consent"/><span>Email me one reminder if I leave this checkout unfinished. This is optional.</span></label>}
              {currentUser&&form.phone&&<label className="mt-3 flex cursor-pointer items-start gap-2 text-[10px] leading-5 text-[#766d64]" data-testid="label-abandoned-whatsapp-consent"><input type="checkbox" checked={whatsappRecoveryConsent} onChange={event=>void changeWhatsAppRecoveryConsent(event.target.checked)} className="mt-1 accent-[#6B2447]" data-testid="checkbox-abandoned-whatsapp-consent"/><span>Send me one WhatsApp reminder if I leave checkout unfinished. Optional; I can withdraw by unchecking this.</span></label>}
              {currentUser&&(recoveryConsent||whatsappRecoveryConsent)&&recoveryNote&&<p className="mt-2 text-[10px] text-[#766d64]" role="status" data-testid="text-abandoned-cart-status">{recoveryNote}</p>}
              <label className="mt-3 flex cursor-pointer items-start gap-2 text-[10px] leading-5 text-[#766d64]" data-testid="label-whatsapp-updates-consent"><input type="checkbox" checked={whatsappUpdatesOptIn} onChange={event=>setWhatsappUpdatesOptIn(event.target.checked)} className="mt-1 accent-[#6B2447]" data-testid="checkbox-whatsapp-updates-consent"/><span>Send order shipping and delivery updates and one review request to this phone via WhatsApp. Optional.</span></label>
              <label className="mt-3 flex cursor-pointer items-start gap-2 text-[10px] leading-5 text-[#766d64]" data-testid="label-whatsapp-marketing-consent"><input type="checkbox" checked={whatsappMarketingOptIn} onChange={event=>setWhatsappMarketingOptIn(event.target.checked)} className="mt-1 accent-[#6B2447]" data-testid="checkbox-whatsapp-marketing-consent"/><span>I agree to receive occasional WhatsApp offers and new-arrival messages. Optional.</span></label>
         </section>}
           {pageModules.find(module=>module.id==='payment')?.visible!==false&&<section style={{order:moduleOrder('payment')}} className="border-t border-[#e9e2d8] pt-6"><div className="mb-4 flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-full bg-[#e8ece1] text-xs font-semibold text-[#596752]">02</span><div><h2 className="text-sm font-semibold">Payment</h2><p className="mt-1 text-[10px] text-[#877c71]">Bank or wallet transfer is the default</p></div></div>
            <div className="space-y-2">
              {availableTransfers.map(method=><label key={method} className={`flex cursor-pointer items-start gap-3 border p-3 text-xs ${paymentMethod===method?'border-[#6B2447] bg-[#f7f3ec]':'border-[#dfd6ca]'}`}><input type="radio" name="paymentMethod" value={method} checked={paymentMethod===method} onChange={()=>setPaymentMethod(method)} className="mt-0.5 accent-[#6B2447]"/><span><strong className="block">{method==='BANK_TRANSFER'?'Bank transfer':method==='EASYPAISA'?'Easypaisa':'JazzCash'}</strong><span className="mt-1 block text-[10px] text-[#81766c]">Transfer the order total before dispatch.</span></span></label>)}
              {codAvailable&&<label className={`flex cursor-pointer items-start gap-3 border p-3 text-xs ${paymentMethod==='COD'?'border-[#6B2447] bg-[#f7f3ec]':'border-[#dfd6ca]'}`}><input type="radio" name="paymentMethod" value="COD" checked={paymentMethod==='COD'} onChange={()=>setPaymentMethod('COD')} className="mt-0.5 accent-[#6B2447]"/><span><strong className="block">Cash on delivery</strong><span className="mt-1 block text-[10px] text-[#81766c]">Pay the courier when your parcel arrives.</span></span></label>}
              {codAvailable&&paymentMethod==='COD'&&data.settings.general.codWhatsAppAutoSendEnabled&&<label className="flex cursor-pointer items-start gap-2 text-[11px] leading-5 text-[#62564e]" data-testid="consent-cod-whatsapp"><input type="checkbox" checked={whatsappOptIn} onChange={event=>setWhatsappOptIn(event.target.checked)} className="mt-1 accent-[#6B2447]"/><span>Send my COD order confirmation to this phone number on WhatsApp. I agree to receive this message.</span></label>}
            </div>
            {data.settings.general.cashOnDelivery&&cart.length>0&&!codAvailable&&<p className="mt-3 text-[10px] leading-5 text-[#81766c]">Cash on delivery is shown only when every product in your cart has been approved for it.</p>}
            {!paymentMethodAvailable&&!availableTransfers.length&&!codAvailable&&<p className="mt-3 border border-[#d8cec2] bg-[#f7f3ec] p-3 text-xs leading-5 text-[#74695f]">No payment method is configured for this cart yet. Please contact the store before placing an order.</p>}
            {paymentMethod!=='COD'&&paymentMethodAvailable&&<><div className="mt-4 border border-[#dfd6ca] bg-[#f7f3ec] p-4 text-xs leading-5 text-[#74695f]"><LockKeyhole size={15} className="mr-2 inline text-[#74816c]"/>Transfer <strong>{formatMoney(grandTotal)}</strong> to the details below. Your order stays pending until the store manually verifies your reference.</div>
              {paymentMethod==='BANK_TRANSFER'
                ?<div className="mt-3 space-y-3" data-testid="list-checkout-bank-accounts">{bankAccounts.map(account=><article key={account.id} className="border border-[#e9e2d8] bg-white/60 p-4" data-testid={`checkout-bank-account-${account.id}`}>
                  <h3 className="text-xs font-semibold text-[#352b2b]">{account.institution}</h3>
                  <div className="mt-2 space-y-2">{([
                    ['Account title',account.accountTitle],
                    ['Account number / IBAN',account.accountNumberOrIban],
                    ['Branch / city',account.branchInfo],
                  ] as const).filter(([,value])=>value.trim()).map(([label,value])=>{const copyKey=`${account.id}:${label}`;return <div key={label} className="flex items-center justify-between gap-3 border-t border-[#eee7df] pt-2"><div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-[.12em] text-[#81766c]">{label}</p><p className="mt-1 break-all text-xs font-semibold text-[#352b2b]">{value}</p></div><button type="button" onClick={()=>void copyPaymentDetail(copyKey,value)} className="min-h-9 shrink-0 border border-[#d8cec2] px-3 text-[10px] font-semibold text-[#6B2447]">{copied===copyKey?'Copied':'Copy'}</button></div>})}</div>
                  {account.instructions&&<p className="mt-3 border-t border-[#eee7df] pt-2 text-[10px] leading-5 text-[#74695f]">{account.instructions}</p>}
                </article>)}</div>
                :<div className="mt-3 space-y-2">{recipientDetails.map(([label,value])=><div key={label} className="flex items-center justify-between gap-3 border border-[#e9e2d8] bg-white/60 p-3"><div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-[.12em] text-[#81766c]">{label}</p><p className="mt-1 break-all text-xs font-semibold text-[#352b2b]">{value}</p></div><button type="button" onClick={()=>void copyPaymentDetail(label,value)} className="min-h-9 shrink-0 border border-[#d8cec2] px-3 text-[10px] font-semibold text-[#6B2447]">{copied===label?'Copied':'Copy'}</button></div>)}</div>}
              <label className="mt-4 block text-[11px] font-semibold text-[#62564e]">Transaction reference <span className="text-[#9b3e4c]">*</span><input required maxLength={160} value={transactionReference} onChange={e=>setTransactionReference(e.target.value)} className="mt-2 h-11 w-full border border-[#dfd6ca] bg-transparent px-3 text-xs font-normal outline-none focus:border-[#6B2447]" data-testid="input-checkout-transaction-reference" placeholder="Enter the reference from your bank or wallet"/></label>
            </>}
           </section>}
        {error && <p role="alert" className="text-xs text-[#9b3e4c]" data-testid="status-checkout-error">{error}</p>}
          <div style={{order:99}}><ActionButton testId="button-place-order" type="submit" disabled={busy||!paymentMethodAvailable||inventoryIssues.length>0}><span>{busy?'Saving order…':`${pageCopy.submitLabel} · ${formatMoney(grandTotal)}`}</span><Check size={14}/></ActionButton></div>
      </form>
      <aside className="h-fit min-w-0 border border-[#e9e2d8] bg-[#f7f3ec] p-5 sm:p-6"><h2 className="text-sm font-semibold">Order summary <span className="text-[#92877c]">({cart.reduce((n,line)=>n+line.quantity,0)} items)</span></h2>
        <div className="mt-4 space-y-3 border-b border-[#dfd6ca] pb-4">{cart.map(line=><div key={line.key} className="flex items-start justify-between gap-3 text-xs" data-testid={`row-checkout-item-${line.key}`}><span className="max-w-[210px] text-[#675c54]">{line.product.name} <span className="text-[#958a7e">× {line.quantity}</span></span><strong className="shrink-0">{formatPKR(line.product.price * line.quantity)}</strong></div>)}</div>
         <label className="mt-4 block text-[10px] font-semibold uppercase tracking-[.12em] text-[#7b7065]">Coupon code</label><div className="mt-2 flex"><input value={coupon} onChange={e=>{setCoupon(e.target.value);setCouponMessage('');setCouponApplied(false)}} disabled={couponApplied} placeholder="Enter coupon" className="h-10 min-w-0 flex-1 border border-[#dfd6ca] bg-[#FDFBF7] px-3 text-xs uppercase outline-none focus:border-[#6B2447]" data-testid="input-coupon-code"/><button type="button" onClick={applyCoupon} disabled={couponApplied} className="bg-[#6B2447] px-4 text-[10px] font-semibold text-white disabled:opacity-50" data-testid="button-apply-coupon">{couponApplied?'Applied':'Apply'}</button></div>
        {couponMessage&&<p className={`mt-2 text-[10px] ${couponApplied?'text-[#60705d]':'text-[#9b3e4c]'}`} role="status" data-testid="status-coupon">{couponMessage}</p>}
          <div className="mt-5 space-y-3 text-xs"><div className="flex justify-between"><span className="text-[#786e65]">Subtotal</span><span data-testid="text-checkout-subtotal">{formatMoney(subtotal)}</span></div>{quantityTierDiscount>0&&<div className="flex justify-between"><span className="text-[#786e65]">Buy more, save more</span><span className="text-[#60705d]" data-testid="text-checkout-quantity-tier-discount">− {formatMoney(quantityTierDiscount)}</span></div>}{data.deals.some(deal=>deal.active)&&<div className="flex justify-between"><span className="text-[#786e65]">{data.deals.filter(deal=>deal.active).map(deal=>deal.name).join(', ')}</span><span className="text-[#60705d]" data-testid="text-buy-two-get-one-discount">− {formatMoney(bogoDiscount)}</span></div>}{activeCoupon&&couponDiscount>0&&<div className="flex justify-between"><span className="text-[#786e65]">{activeCoupon.code} · {activeCoupon.percentOff}%</span><span className="text-[#60705d]" data-testid="text-coupon-discount">− {formatMoney(couponDiscount)}</span></div>}<div className="flex justify-between"><span className="text-[#786e65]">Delivery</span><span data-testid="text-checkout-delivery">{deliveryCharge===0?'Complimentary':formatMoney(deliveryCharge)}</span></div></div>
          <div className="my-4 border-t border-[#dfd6ca]"/><div className="flex justify-between text-sm font-semibold"><span>Total</span><span className="text-[#6B2447]" data-testid="text-checkout-grand-total">{formatMoney(grandTotal)}</span></div><p className="mt-3 text-[10px] leading-5 text-[#887d72]">Complimentary delivery applies to delivery-eligible items above {formatMoney(deliveryThreshold)}. Quantity offers apply only to their selected products.</p>
      </aside>
    </div>
  </CommerceLayout>;
}