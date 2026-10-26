import { useState } from 'react';
import { doc, updateDoc } from '../lib/supabase/documents';
import { db } from '../lib/supabase/index';
import { protectForm } from '../hooks/use-recaptcha';
import { sanitizeText } from '../utils/sanitize';
import type { CustomerOrder } from '../context/StoreContext';
export default function OrderNote({order}:{order:CustomerOrder}){
  const [note,setNote]=useState(order.customerNote||'');
  const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
  if(order.status!=='Pending')return order.customerNote?<p className="mt-4 text-xs">Your note: {order.customerNote}</p>:null;
  return <form className="mt-4 border-t pt-3" onSubmit={async event=>{
    event.preventDefault();setBusy(true);setMessage('');
    try{if(!db)throw new Error('Supabase is not configured.');await protectForm();await updateDoc(doc(db,'orders',order.id),{customerNote:sanitizeText(note,1000).trim()});setMessage('Order note saved.');}
    catch(failure){setMessage(failure instanceof Error?failure.message:String(failure));}
    finally{setBusy(false);}
  }}><label className="block text-xs">Delivery note<textarea maxLength={1000} value={note} onChange={event=>setNote(event.target.value)} className="mt-2 w-full border p-2 text-xs" rows={2}/></label><button disabled={busy} type="submit" className="mt-2 text-xs underline">{busy?'Saving…':'Save note'}</button>{message&&<p role="status" className="mt-2 text-xs">{message}</p>}</form>;
}
