import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { useAdminStore } from '../context/AdminContext';
import { CommerceLayout } from '../components/CommerceLayout';
import { formatPKR } from '../utils/store';
import { useAuth } from '../context/AuthContext';
export default function OrderSuccessPage() {
  const { orderId } = useParams();
  const { orders, currentUser } = useStore();
  const {user,upgradeGuestAccount,loading:authLoading}=useAuth();
  const { data } = useAdminStore();
  const order = orders.find(item => item.id === orderId);
  const [accountEmail,setAccountEmail]=useState('');
  const [accountPassword,setAccountPassword]=useState('');
  const [accountBusy,setAccountBusy]=useState(false);
  const [accountCreated,setAccountCreated]=useState(false);
  const [accountMessage,setAccountMessage]=useState('');
  useEffect(()=>{if(order?.email)setAccountEmail(order.email);},[order?.email]);
  async function createAccount(event:FormEvent){
    event.preventDefault();
    if(!order)return;
    setAccountBusy(true);setAccountMessage('');
    try{
      await upgradeGuestAccount(order.fullName,accountEmail,accountPassword,{
        displayName:order.fullName,phone:order.phone,addressLine1:order.address,addressLine2:order.addressLine2||'',
        city:order.city,province:order.province,postalCode:order.postalCode||'',birthday:'',marketingConsent:false,
      });
      setAccountPassword('');
      setAccountCreated(true);
      setAccountMessage('Your account is ready. This order is now part of your account history.');
    }catch(error){
      const code=(error as {code?:string})?.code;
      setAccountMessage(code==='auth/email-already-in-use'
        ?'That email already has an account. This order remains with your guest session; use another email here or contact the store about linking your existing account.'
        :error instanceof Error?error.message:'We could not create the account right now. Your order is still confirmed.');
    }finally{setAccountBusy(false);}
  }
  if(authLoading)return <CommerceLayout title="Restoring your session"><p>Your guest order confirmation is loading.</p></CommerceLayout>;
  if (!currentUser) return <CommerceLayout title="Sign in to view your confirmation"><Link to="/account" className="underline">Sign in</Link></CommerceLayout>;
  if (!order) return <CommerceLayout title="Order confirmation"><p>Your order is loading, or is not available to this account.</p><Link to="/account" className="mt-5 inline-block underline">View your orders</Link></CommerceLayout>;
  const paymentMethod=order.paymentMethod||'COD';
  const digits = (data.settings.general.codWhatsAppNumber||data.content.contact.phone).replace(/\D/g, '').replace(/^0/, '92');
  const whatsappSent=order.whatsappConfirmation?.status==='sent';
  const showWhatsAppConfirmation=paymentMethod==='COD'&&data.settings.general.codWhatsAppEnabled&&!whatsappSent;
  const paymentLabel=paymentMethod==='BANK_TRANSFER'?'Bank transfer':paymentMethod==='EASYPAISA'?'Easypaisa':paymentMethod==='JAZZCASH'?'JazzCash':'Cash on delivery';
  const paymentMessage=paymentMethod==='COD'
    ? 'Pay the courier when your parcel arrives.'
    : order.paymentVerified
      ? `The store has verified your ${paymentLabel} payment.`
      : `Your order will remain pending while the store reviews your ${paymentLabel} reference.`;
  const shippingAddress=[order.address,order.addressLine2,order.city,order.province,'Pakistan'].filter(Boolean).join(', ');
  const message = `Please confirm my ${data.settings.general.storeName} order.\nOrder ID: ${order.id}\nCustomer: ${order.fullName}\nItems:\n${order.items.map(item => `• ${item.product.name}${item.variant!=='Standard'||(item.product.variants?.length??0)>0?` (${item.variant})`:''} × ${item.quantity}`).join('\n')}${order.cartAddons?.length?`\nExtras:\n${order.cartAddons.map(addon=>`• ${addon.name} · ${formatPKR(addon.price)}`).join('\n')}`:''}\nTotal: ${formatPKR(order.grandTotal)} PKR\nShipping: ${shippingAddress}\nPhone: ${order.phone}\nPayment: ${paymentLabel}${order.transactionReference?`\nTransaction reference: ${order.transactionReference}`:''}`;
  return <CommerceLayout eyebrow="Thank you" title="Your order is received." intro={`Order ${order.id} has been securely saved. ${paymentMessage}`}>
     <div className="max-w-2xl border p-6"><p className="text-sm font-semibold">{order.fullName}</p><p className="mt-2 text-xs">{shippingAddress}</p><ul className="my-5 space-y-2 text-sm">{order.items.map(line => <li key={line.key}>{line.product.name} × {line.quantity}</li>)}{order.cartAddons?.map(addon=><li key={addon.id}>{addon.name} · {formatPKR(addon.price)}</li>)}</ul>{(order.quantityTierDiscount??0)>0&&<p className="mb-2 text-xs text-[#60705d]" data-testid="text-order-volume-savings">Buy more, save more: − {formatPKR(order.quantityTierDiscount!)}</p>}<strong>{formatPKR(order.grandTotal)}</strong><p className="mt-2 text-xs">Status: {order.status}</p><p className="mt-2 text-xs">Payment: {paymentLabel}</p>{order.transactionReference&&<p className="mt-2 text-xs">Reference submitted: {order.transactionReference} · {order.paymentVerified?'payment verified':'awaiting store review'}</p>}{order.customerNote&&<p className="mt-3 border-l-2 border-[#74816c] pl-3 text-xs">Your note: {order.customerNote}</p>}
       {showWhatsAppConfirmation&&digits&&<a href={`https://wa.me/${digits}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer" className="mt-6 inline-flex min-h-11 items-center gap-2 bg-[#6B2447] px-5 text-xs font-semibold text-white" data-testid="button-confirm-whatsapp"><MessageCircle size={16} />Confirm Order via WhatsApp</a>}
       {showWhatsAppConfirmation&&!digits&&<p className="mt-5 text-xs">WhatsApp confirmation is unavailable until a store number is added.</p>}
        {whatsappSent&&<p className="mt-5 text-xs text-[#60705d]" role="status" data-testid="status-cod-whatsapp-sent">WhatsApp confirmation sent to your phone.</p>}
        {showWhatsAppConfirmation&&digits&&<p className="mt-3 text-[10px]">Automatic delivery may be pending. This opens a draft instead; you choose Send in WhatsApp.</p>}
       {accountCreated&&<p role="status" className="mt-5 text-xs text-[#60705d]" data-testid="text-guest-account-status">{accountMessage}</p>}
       {user?.isAnonymous&&!accountCreated&&<details className="mt-7 border-t border-[#e9e2d8] pt-5" data-testid="section-optional-account-creation"><summary className="cursor-pointer text-xs font-semibold text-[#6B2447]">Save your details for next time (optional)</summary><form onSubmit={createAccount} className="mt-4 space-y-3"><p className="text-[10px] leading-5 text-[#766d64]">Choose an email and password. Your guest order history will stay with this account.</p><label className="block text-[10px] font-semibold">Email address<input required type="email" autoComplete="email" value={accountEmail} onChange={event=>setAccountEmail(event.target.value)} className="mt-2 h-11 w-full border border-[#dfd6ca] bg-white px-3 text-xs font-normal outline-none focus:border-[#6B2447]" data-testid="input-guest-account-email"/></label><label className="block text-[10px] font-semibold">Create a password<input required type="password" minLength={8} autoComplete="new-password" value={accountPassword} onChange={event=>setAccountPassword(event.target.value)} className="mt-2 h-11 w-full border border-[#dfd6ca] bg-white px-3 text-xs font-normal outline-none focus:border-[#6B2447]" data-testid="input-guest-account-password"/></label><button disabled={accountBusy} className="inline-flex min-h-11 items-center bg-[#6B2447] px-5 text-xs font-semibold text-white disabled:opacity-60" data-testid="button-create-guest-account">{accountBusy?'Creating account…':'Create account'}</button>{accountMessage&&<p role="alert" className="text-[10px] leading-5 text-[#9b3e4c]" data-testid="text-guest-account-error">{accountMessage}</p>}</form></details>}
    </div><Link to="/account" className="mt-6 inline-block text-xs underline">Return to your orders</Link>
  </CommerceLayout>;
}
