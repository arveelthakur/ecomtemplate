import { useEffect, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Check, ChevronRight, Eye, EyeOff, MapPin, Pencil, ShieldCheck, X } from 'lucide-react';
import { useAuth, type CustomerProfile } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { CommerceLayout, ActionButton } from '../components/CommerceLayout';
import { formatPKR } from '../utils/store';
import { shouldShowAdminPanelLink } from '../utils/adminAuthorization';
import OrderNote from '../components/OrderNote';
import { pakistanCities } from '../utils/pakistan';
import { useAdminStore } from '../context/AdminContext';
import { useBodyScrollLock } from '../hooks/use-body-scroll-lock';
import { configuredStoreName } from '../utils/branding';
function ProfileEditor({onClose,onSaved}:{onClose:()=>void;onSaved:()=>void}){
  const {profile,saveProfile}=useAuth();
  const {data}=useAdminStore();
  const [draft,setDraft]=useState<CustomerProfile>(()=>({
    displayName:profile?.displayName||'',phone:profile?.phone||'',
    addressLine1:profile?.addressLine1||'',addressLine2:profile?.addressLine2||'',
    city:profile?.city||'',province:profile?.province||'',postalCode:profile?.postalCode||'',
    birthday:profile?.birthday||'',marketingConsent:profile?.marketingConsent===true,
  }));
  const [busy,setBusy]=useState(false),[notice,setNotice]=useState('');
  const fields=data.settings.profileFields;
  useBodyScrollLock(true);
  if(typeof document==='undefined')return null;
  return createPortal(<div className="fixed inset-0 z-[10000] flex h-[100dvh] max-h-[100dvh] items-center justify-center overflow-y-auto bg-[#21191b]/45 p-4 backdrop-blur-sm" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}>
    <form role="dialog" aria-modal="true" aria-labelledby="profile-editor-title" className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto border border-[#e9e2d8] bg-[#FDFBF7] p-5 shadow-2xl sm:p-7" onSubmit={async event=>{event.preventDefault();setBusy(true);setNotice('');try{await saveProfile(draft);onSaved();}catch(failure){setNotice(failure instanceof Error?failure.message:String(failure));}finally{setBusy(false);}}}>
      <div className="mb-5 flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#74816c]">Profile settings</p><h2 id="profile-editor-title" className="mt-1 text-xl font-semibold">Your details</h2></div><button type="button" onClick={onClose} aria-label="Close profile settings" className="p-2 text-[#81776e]"><X size={17}/></button></div>
      <div className="grid gap-4 sm:grid-cols-2">
         {fields.displayName.enabled&&<label className="text-[10px] font-semibold text-[#62564e]">Full name<input required={fields.displayName.required} maxLength={120} autoComplete="name" value={draft.displayName} onChange={event=>setDraft({...draft,displayName:event.target.value})} className="mt-2 h-11 w-full rounded-[10px] border border-[#e0d8cf] bg-transparent px-3 text-xs focus:border-[#6b2447] focus:outline-none focus:ring-2 focus:ring-[#6b2447]/15"/></label>}
         {fields.phone.enabled&&<label className="text-[10px] font-semibold text-[#62564e]">Phone<input required={fields.phone.required} type="tel" maxLength={25} autoComplete="tel" value={draft.phone} onChange={event=>setDraft({...draft,phone:event.target.value})} className="mt-2 h-11 w-full rounded-[10px] border border-[#e0d8cf] bg-transparent px-3 text-xs focus:border-[#6b2447] focus:outline-none focus:ring-2 focus:ring-[#6b2447]/15"/></label>}
         {fields.addressLine1.enabled&&<label className="text-[10px] font-semibold text-[#62564e] sm:col-span-2">Address line 1<input required={fields.addressLine1.required} maxLength={240} autoComplete="address-line1" value={draft.addressLine1} onChange={event=>setDraft({...draft,addressLine1:event.target.value})} className="mt-2 h-11 w-full rounded-[10px] border border-[#e0d8cf] bg-transparent px-3 text-xs focus:border-[#6b2447] focus:outline-none focus:ring-2 focus:ring-[#6b2447]/15"/></label>}
         {fields.addressLine2.enabled&&<label className="text-[10px] font-semibold text-[#62564e] sm:col-span-2">Address line 2 {!fields.addressLine2.required&&<span className="font-normal">(optional)</span>}<input required={fields.addressLine2.required} maxLength={240} autoComplete="address-line2" value={draft.addressLine2} onChange={event=>setDraft({...draft,addressLine2:event.target.value})} className="mt-2 h-11 w-full rounded-[10px] border border-[#e0d8cf] bg-transparent px-3 text-xs focus:border-[#6b2447] focus:outline-none focus:ring-2 focus:ring-[#6b2447]/15"/></label>}
         {fields.province.enabled&&<label className="text-[10px] font-semibold text-[#62564e]">Province<select required={fields.province.required} value={draft.province} onChange={event=>setDraft({...draft,province:event.target.value,city:''})} className="mt-2 h-11 w-full rounded-[10px] border border-[#e0d8cf] bg-transparent px-3 text-xs focus:border-[#6b2447] focus:outline-none focus:ring-2 focus:ring-[#6b2447]/15"><option value="">Choose province / territory</option>{Object.keys(pakistanCities).map(province=><option key={province}>{province}</option>)}</select></label>}
         {fields.city.enabled&&<label className="text-[10px] font-semibold text-[#62564e]">City<select required={fields.city.required} disabled={!draft.province} value={draft.city} onChange={event=>setDraft({...draft,city:event.target.value})} className="mt-2 h-11 w-full rounded-[10px] border border-[#e0d8cf] bg-transparent px-3 text-xs focus:border-[#6b2447] focus:outline-none focus:ring-2 focus:ring-[#6b2447]/15"><option value="">Choose city</option>{(pakistanCities[draft.province]||[]).map(city=><option key={city}>{city}</option>)}</select></label>}
         {fields.postalCode.enabled&&<label className="text-[10px] font-semibold text-[#62564e]">Postal code<input required={fields.postalCode.required} maxLength={20} autoComplete="postal-code" value={draft.postalCode} onChange={event=>setDraft({...draft,postalCode:event.target.value})} className="mt-2 h-11 w-full rounded-[10px] border border-[#e0d8cf] bg-transparent px-3 text-xs focus:border-[#6b2447] focus:outline-none focus:ring-2 focus:ring-[#6b2447]/15"/></label>}
         {fields.birthday.enabled&&<label className="text-[10px] font-semibold text-[#62564e]">Birthday<input required={fields.birthday.required} type="date" value={draft.birthday} onChange={event=>setDraft({...draft,birthday:event.target.value})} className="mt-2 h-11 w-full rounded-[10px] border border-[#e0d8cf] bg-transparent px-3 text-xs focus:border-[#6b2447] focus:outline-none focus:ring-2 focus:ring-[#6b2447]/15"/></label>}
          <label className="ad-checkline sm:col-span-2"><input type="checkbox" checked={draft.marketingConsent} onChange={event=>setDraft({...draft,marketingConsent:event.target.checked})}/> Send me occasional store updates and offers. I can opt out anytime.</label>
      </div>
      {notice&&<p role="alert" className="mt-4 text-xs text-[#9b3e4c]">{notice}</p>}
      <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} className="min-h-11 border border-[#d8cec2] px-4 text-xs">Cancel</button><button type="submit" disabled={busy} className="inline-flex min-h-11 items-center gap-2 bg-[#6B2447] px-5 text-xs font-semibold text-white disabled:opacity-50"><Check size={14}/>{busy?'Saving…':'Save profile'}</button></div>
    </form>
  </div>,document.body);
}

export default function CustomerAccountPage() {
  const {data}=useAdminStore();
  const storeName=configuredStoreName(data.settings.general.storeName);
  const pageCopy=data.content.storePages.account;
  const pageModules=data.content.storePageLayouts.account;
  const moduleOrder=(id:string)=>pageModules.findIndex(module=>module.id===id);
  const { user, isAdmin, loading,profile, signIn, signUp, resetPassword, signOut } = useAuth();
  const { orders, cancelOrder, orderError } = useStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'signin'|'signup'|'reset'>('signin');
  const [form, setForm] = useState({ name: '', email: '', password: '', marketingConsent:false });
  const [showPassword,setShowPassword]=useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editingProfile,setEditingProfile]=useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      if (mode === 'reset') { await resetPassword(form.email); setNotice('If this email has an account, a password reset message will arrive shortly.'); }
      else {
        if (mode === 'signup') await signUp(form.name.trim(), form.email, form.password,form.marketingConsent);
        else await signIn(form.email, form.password);
        setForm(previous => ({ ...previous, password: '' }));
        const from = (location.state as { from?: string } | null)?.from;
        if (from?.startsWith('/') && !from.startsWith('//')) navigate(from, { replace: true });
        else setNotice('You are signed in.');
      }
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to complete this request.'); }
    finally { setBusy(false); }
  }
  const ownOrders = orders.filter(order => order.userId === user?.uid).sort((a,b)=>+new Date(b.createdAt)-+new Date(a.createdAt));
  const activeOrders=ownOrders.filter(order=>order.status==='Pending'||order.status==='Processing'||order.status==='Shipped').length;
  if (loading) return <CommerceLayout title={pageCopy.title} intro={pageCopy.intro}><p role="status">Loading your account…</p></CommerceLayout>;
  return <CommerceLayout eyebrow={user?undefined:storeName?`Your ${storeName} account`:'Customer account'} title={user?undefined:pageCopy.title} intro={user?undefined:pageCopy.intro}>
    {!user ? <form onSubmit={submit} className="max-w-xl border border-[#e9e2d8] bg-[#f7f3ec] p-6 space-y-4">
      <div className="flex gap-4 text-xs">{(['signin','signup','reset'] as const).map(value => <button key={value} type="button" onClick={() => { setMode(value); setShowPassword(false); setError(''); setNotice(''); }} className={mode === value ? 'text-[#6B2447] font-bold underline' : ''}>{value === 'signin' ? 'Sign in' : value === 'signup' ? 'Create account' : 'Forgot password'}</button>)}</div>
      {mode === 'signup' && <label className="block text-xs">Full name<input required maxLength={120} autoComplete="name" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} className="mt-2 h-11 w-full border px-3" data-testid="input-account-name" /></label>}
      <label className="block text-xs">Email address<input required type="email" autoComplete="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} className="mt-2 h-11 w-full border px-3" data-testid="input-account-email" /></label>
      {mode !== 'reset' && <div className="block text-xs"><label htmlFor="input-account-password">Password</label><span className="relative mt-2 block"><input id="input-account-password" required type={showPassword?'text':'password'} minLength={mode === 'signup' ? 8 : 1} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} className="h-11 w-full border px-3 pr-12" data-testid="input-account-password"/><button type="button" onClick={()=>setShowPassword(value=>!value)} aria-label={showPassword?'Hide password':'Show password'} aria-pressed={showPassword} className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center text-[#766d63] hover:text-[#4A2837]" data-testid="button-toggle-password-visibility">{showPassword?<EyeOff size={16}/>:<Eye size={16}/>}</button></span></div>}
      {mode==='signup'&&<label className="flex items-start gap-2 text-[10px] leading-5 text-[#756b62]"><input type="checkbox" checked={form.marketingConsent} onChange={event=>setForm({...form,marketingConsent:event.target.checked})}/> I agree to receive occasional store emails about new collections and offers. This is optional.</label>}
      <ActionButton type="submit" disabled={busy} testId="button-account-submit">{busy ? 'Please wait…' : mode === 'reset' ? 'Send reset email' : mode === 'signup' ? 'Create account' : 'Sign in'}</ActionButton>
      <p className="text-[10px] leading-5 text-[#81776e]">Your account and customer records are protected by Supabase authentication and row-level security.</p>
    </form> : <div className="flex flex-col gap-7">
      {pageModules.find(module=>module.id==='welcome')?.visible!==false&&<section style={{order:moduleOrder('welcome')}} className="flex flex-col justify-between gap-6 rounded-2xl border border-[#e9e2d8] bg-gradient-to-br from-[#faf7f0] via-[#fdfbf7] to-[#f2ece4] p-5 shadow-[0_16px_40px_rgba(58,42,32,.06)] sm:flex-row sm:items-center sm:p-8">
        <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[.24em] text-[#74816c]">{storeName?`Your ${storeName} account`:'Your account'}</p><h1 data-testid="text-page-title" className="mt-2 font-serif text-[32px] font-medium leading-tight tracking-[-.035em] text-[#3c3032] sm:text-[42px]">{pageCopy.welcomeTitle.replace('{firstName}',(profile?.displayName||user.displayName||'Customer').split(' ')[0])}</h1><p className="mt-3 text-sm leading-6 text-[#766d64]">{pageCopy.welcomeIntro}</p></div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          {shouldShowAdminPanelLink(isAdmin,loading)&&<Link to="/admin/dashboard" style={{backgroundColor:'var(--nura-primary,#6b2447)',borderColor:'color-mix(in srgb,var(--nura-primary,#6b2447) 64%,white)'}} className="group inline-flex min-h-11 items-center gap-2 rounded-md border px-4 text-xs font-semibold tracking-[.02em] text-white shadow-[0_5px_16px_rgba(55,25,39,.16)] transition duration-200 hover:scale-[1.02] hover:brightness-110 hover:shadow-[0_8px_22px_rgba(55,25,39,.24)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nura-primary,#6b2447)]" data-testid="link-open-admin-dashboard"><ShieldCheck size={15} className="text-white/75 transition-transform group-hover:scale-110"/>Open Admin Dashboard</Link>}
          <button type="button" onClick={()=>setEditingProfile(true)} className="inline-flex min-h-11 items-center gap-2 border border-[#d8cec2] px-4 text-xs font-semibold text-[#6B2447] hover:bg-[#f4efe7]"><Pencil size={14}/> Edit profile</button>
          <button type="button" className="min-h-11 px-3 text-xs text-[#81776e] hover:text-[#6B2447]" onClick={async()=>{try{await signOut();setNotice('You have signed out.');}catch(failure){setError(String(failure));}}}>Sign out</button>
        </div>
      </section>}
      {pageModules.find(module=>module.id==='quickStats')?.visible!==false&&<div style={{order:moduleOrder('quickStats')}} className="grid gap-3 sm:grid-cols-3">
        <div className="border border-[#e9e2d8] bg-white/60 p-4"><p className="text-[9px] font-bold uppercase tracking-[.16em] text-[#81766c]">All orders</p><p className="mt-2 text-2xl font-semibold text-[#6B2447]">{ownOrders.length}</p></div>
        <div className="border border-[#e9e2d8] bg-white/60 p-4"><p className="text-[9px] font-bold uppercase tracking-[.16em] text-[#81766c]">In progress</p><p className="mt-2 text-2xl font-semibold text-[#6B2447]">{activeOrders}</p></div>
        <div className="border border-[#e9e2d8] bg-white/60 p-4"><p className="text-[9px] font-bold uppercase tracking-[.16em] text-[#81766c]">Saved delivery address</p><p className="mt-2 flex items-start gap-2 text-xs font-medium"><MapPin size={14} className="mt-0.5 shrink-0 text-[#74816c]"/><span>{profile?.addressLine1?`${profile.addressLine1}${profile.addressLine2?`, ${profile.addressLine2}`:''}${profile.city?`, ${profile.city}`:''}${profile.province?`, ${profile.province}`:''}`:'Add an address to speed up checkout.'}</span></p></div>
      </div>}
      {pageModules.find(module=>module.id==='orderHistory')?.visible!==false&&<section style={{order:moduleOrder('orderHistory')}}>
        <div className="flex items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#74816c]">Your activity</p><h2 className="mt-1 text-xl font-semibold">Order history</h2></div><span className="text-[10px] text-[#877c71]">{ownOrders.length} orders</span></div>
        {!ownOrders.length&&<div className="mt-4 border border-[#e9e2d8] bg-white/60 p-6"><p className="text-sm font-semibold">Your orders will appear here.</p><p className="mt-2 text-xs text-[#81766c]">Once you place an order, you can follow its status from this page.</p><Link to="/collections" className="mt-4 inline-block text-xs font-semibold text-[#6B2447] underline underline-offset-4">Explore the collection</Link></div>}
        <div className="mt-4 space-y-3">{ownOrders.map(order=><article key={order.id} className="overflow-hidden border border-[#e9e2d8] bg-white/65">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eee8df] px-4 py-3 sm:px-5"><div className="flex items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[9px] font-semibold ${order.status==='Delivered'?'bg-[#e8ece1] text-[#596752]':order.status==='Cancelled'?'bg-[#eee8e4] text-[#766d64]':'bg-[#f6ead8] text-[#856541]'}`}>{order.status}</span><span className="text-[10px] text-[#877c71]">{new Date(order.createdAt).toLocaleDateString('en-PK')}</span></div><strong className="text-xs">{order.id}</strong></div>
          <div className="p-4 sm:px-5"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div className="min-w-0"><p className="text-sm font-semibold">{order.items.map(item=>`${item.product.name} × ${item.quantity}`).join(', ')}</p><p className="mt-2 text-[10px] text-[#81766c]">Payment: {order.paymentMethod==='BANK_TRANSFER'?'Bank transfer':order.paymentMethod==='EASYPAISA'?'Easypaisa':order.paymentMethod==='JAZZCASH'?'JazzCash':'Cash on delivery'}</p>{order.transactionReference&&<p className="mt-1 text-[10px] text-[#81766c]">Reference submitted: {order.transactionReference} · {order.paymentVerified?'payment verified':'awaiting store review'}</p>}{order.customerNote&&<p className="mt-2 border-l-2 border-[#74816c] pl-2 text-[10px] text-[#675c54]">Your note: {order.customerNote}</p>}</div><div className="flex items-center justify-between gap-4 sm:block sm:text-right"><strong className="text-sm text-[#6B2447]">{formatPKR(order.grandTotal)}</strong><Link to={`/order-success/${order.id}`} className="ml-3 inline-flex items-center gap-1 text-[10px] font-semibold text-[#6B2447] underline underline-offset-4 sm:ml-0 sm:mt-3">Order details <ChevronRight size={12}/></Link></div></div>
            {order.status==='Pending'&&<button className="mt-3 text-[10px] underline" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await cancelOrder(order.id);setNotice('Your pending order was cancelled.');}catch(failure){setError(String(failure));}finally{setBusy(false);}}}>Cancel pending order</button>}<OrderNote order={order}/>
          </div>
        </article>)}</div>
      </section>}
      {editingProfile&&<ProfileEditor onClose={()=>setEditingProfile(false)} onSaved={()=>{setEditingProfile(false);setNotice('Profile saved.');}}/>}
    </div>}
    {(error || orderError) && <p role="alert" className="mt-5 text-xs text-red-800">{error || orderError}</p>}
    {notice && <p role="status" className="mt-5 text-xs text-[#60705d]">{notice}</p>}
  </CommerceLayout>;
}
