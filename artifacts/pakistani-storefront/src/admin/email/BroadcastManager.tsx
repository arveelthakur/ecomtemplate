import { useEffect, useMemo, useState } from 'react';
import { collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc } from '../../lib/supabase/documents';
import { httpsCallable, functions } from '../../lib/supabase/functions';
import { RefreshCw, Save, Send } from 'lucide-react';
import { db } from '../../lib/supabase/index';
import { protectForm } from '../../hooks/use-recaptcha';
import ImageUpload from '../../components/ImageUpload';
import type { EmailProviderStatus, EmailSettings } from './emailTypes';

type Audience='all-consented'|'newsletter'|'past-buyers';
type CampaignDraft={
  id:string;name:string;template:'new-collection'|'flash-sale'|'seasonal';audience:Audience;subject:string;previewText:string;promoCode:string;
  headerImageUrl:string;body:string;ctaLabel:string;ctaHref:string;senderProfileId:string;
};
type CampaignHistory={id:string;name?:string;subject?:string;audience?:Audience;status?:string;recipientCount?:number;sentCount?:number;failedCount?:number;createdAt?:{toDate?:()=>Date}|string};
const defaultDraft=(settings:EmailSettings):CampaignDraft=>({
  id:'',name:'New campaign',template:'new-collection',audience:'newsletter',subject:'Something new from {store_name}',previewText:'A fresh edit for the season.',promoCode:'',
  headerImageUrl:'',body:'Hello {customer_name},\\n\\nDiscover a new collection made for softer days.',ctaLabel:'Explore the collection',ctaHref:'/shop',
  senderProfileId:settings.defaultSenderProfileId||settings.senderProfiles[0]?.id||'',
});
const campaignTemplates:Record<CampaignDraft['template'],Pick<CampaignDraft,'name'|'subject'|'previewText'|'body'|'ctaLabel'|'ctaHref'>>={
  'new-collection':{name:'New collection launch',subject:'Meet the new {store_name} collection',previewText:'A considered edit, just arrived.',body:'Hello {customer_name},\\n\\nOur new collection has arrived. Explore the pieces we have been making for the season.',ctaLabel:'Shop new arrivals',ctaHref:'/shop?sort=newest'},
  'flash-sale':{name:'Flash sale / promo code',subject:'A little offer, for a limited time',previewText:'A note from {store_name}.',body:'Hello {customer_name},\\n\\nEnjoy our limited-time offer. Use code {promo_code} at checkout.',ctaLabel:'Shop the offer',ctaHref:'/shop'},
  seasonal:{name:'Seasonal event',subject:'A softer season starts here',previewText:'Thoughtful finds for the moment.',body:'Hello {customer_name},\\n\\nCelebrate the season with a few of our favorite finds.',ctaLabel:'Explore the edit',ctaHref:'/shop'},
};
const variableNames=['customer_name','order_id','order_total','items_list','courier_name','tracking_number','tracking_url','promo_code'];
function timestamp(value:CampaignHistory['createdAt']){
  if(value&&typeof value==='object'&&typeof value.toDate==='function')return value.toDate().toLocaleString();
  if(typeof value==='string')return new Date(value).toLocaleString();
  return '—';
}
export default function BroadcastManager({settings,providerStatus,onSendTestEmail}:{settings:EmailSettings;providerStatus:EmailProviderStatus|null;onSendTestEmail:(input:{recipient:string;senderProfileId:string})=>Promise<void>}){
  const [draft,setDraft]=useState<CampaignDraft>(()=>defaultDraft(settings));
  const [drafts,setDrafts]=useState<CampaignDraft[]>([]);
  const [history,setHistory]=useState<CampaignHistory[]>([]);
  const [testRecipient,setTestRecipient]=useState('');
  const [working,setWorking]=useState(false);
  const [feedback,setFeedback]=useState('');
  const campaignReady=settings.masterEnabled&&providerStatus?.canSend===true;
  useEffect(()=>{
    if(!db)return;
    const draftsQuery=query(collection(db,'emailCampaignDrafts'),orderBy('updatedAt','desc'),limit(25));
    const historyQuery=query(collection(db,'emailCampaigns'),orderBy('createdAt','desc'),limit(25));
    const stopDrafts=onSnapshot(draftsQuery,snapshot=>setDrafts(snapshot.docs.map(item=>({...item.data(),id:item.id} as CampaignDraft))));
    const stopHistory=onSnapshot(historyQuery,snapshot=>setHistory(snapshot.docs.map(item=>({...item.data(),id:item.id} as CampaignHistory))));
    return()=>{stopDrafts();stopHistory();};
  },[]);
  useEffect(()=>{if(!draft.senderProfileId&&settings.senderProfiles.length)setDraft(current=>({...current,senderProfileId:settings.defaultSenderProfileId||settings.senderProfiles[0].id}));},[settings.defaultSenderProfileId,settings.senderProfiles,draft.senderProfileId]);
  const audienceLabel=useMemo(()=>({ 'all-consented':'Registered customers who opted into marketing',newsletter:'Newsletter subscribers', 'past-buyers':'Past buyers who opted into marketing' }[draft.audience]),[draft.audience]);
  const chooseTemplate=(template:CampaignDraft['template'])=>setDraft(current=>({...current,...campaignTemplates[template],template}));
  const saveDraft=async()=>{
    if(!db){setFeedback('Supabase is not configured.');return;}
    setWorking(true);setFeedback('');
    try{
      const ref=draft.id?doc(db,'emailCampaignDrafts',draft.id):doc(collection(db,'emailCampaignDrafts'));
      const value={...draft,id:ref.id,updatedAt:serverTimestamp()};
      await setDoc(ref,value,{merge:true});
      setDraft(value as CampaignDraft);setFeedback('Campaign draft saved.');
    }catch(error){setFeedback(error instanceof Error?error.message:'Campaign draft could not be saved.');}
    finally{setWorking(false);}
  };
  const sendTest=async()=>{
    if(!testRecipient.trim()||!draft.senderProfileId)return;
    setWorking(true);setFeedback('');
    try{await onSendTestEmail({recipient:testRecipient.trim(),senderProfileId:draft.senderProfileId});setFeedback('Test email request sent.');}
    catch(error){setFeedback(error instanceof Error?error.message:'Test email could not be sent.');}
    finally{setWorking(false);}
  };
  const sendCampaign=async()=>{
    if(!functions||!draft.senderProfileId||!draft.subject.trim()||!draft.body.trim())return;
    setWorking(true);setFeedback('');
    try{
      await protectForm();
      const send=httpsCallable<CampaignDraft,{campaignId:string;status:string;sentCount:number;failedCount:number;recipientCount:number}>(functions,'sendMarketingCampaign');
      const response=await send(draft);
      setFeedback(`Campaign ${response.data.status}: ${response.data.sentCount} sent of ${response.data.recipientCount}; ${response.data.failedCount} failed.`);
    }catch(error){setFeedback(error instanceof Error?error.message:'Campaign could not be dispatched.');}
    finally{setWorking(false);}
  };
  const update=(patch:Partial<CampaignDraft>)=>setDraft(current=>({...current,...patch}));
  return <div className="ad-card-body ad-form-stack" data-testid="email-broadcast-manager">
    <div className="ad-notice"><strong>Marketing permission:</strong> Newsletter subscribers opted in through the signup form. Registered customers and past buyers are included only when their Supabase profile has marketing consent enabled. Provider credentials remain server-side.</div>
    <div className="ad-form-row"><label className="ad-field"><span className="ad-label">Start from a campaign template</span><select className="ad-select" value={draft.template} onChange={event=>chooseTemplate(event.target.value as CampaignDraft['template'])}><option value="new-collection">New collection launch</option><option value="flash-sale">Flash sale / promo code</option><option value="seasonal">Seasonal event</option></select></label><label className="ad-field"><span className="ad-label">Audience</span><select className="ad-select" value={draft.audience} onChange={event=>update({audience:event.target.value as Audience})}><option value="all-consented">All registered customers (opted in)</option><option value="newsletter">Newsletter subscribers</option><option value="past-buyers">Past buyers (opted in)</option></select></label><label className="ad-field"><span className="ad-label">Sender profile</span><select className="ad-select" value={draft.senderProfileId} onChange={event=>update({senderProfileId:event.target.value})}>{settings.senderProfiles.map(profile=><option key={profile.id} value={profile.id}>{profile.name||profile.email||'Unnamed sender'}</option>)}</select></label></div>
    <label className="ad-field"><span className="ad-label">Campaign name</span><input className="ad-input" maxLength={100} value={draft.name} onChange={event=>update({name:event.target.value})}/></label>
    <div className="ad-form-row"><label className="ad-field"><span className="ad-label">Subject line</span><input className="ad-input" maxLength={180} value={draft.subject} onChange={event=>update({subject:event.target.value})}/></label><label className="ad-field"><span className="ad-label">Preview text</span><input className="ad-input" maxLength={180} value={draft.previewText} onChange={event=>update({previewText:event.target.value})}/></label></div>
    {draft.template==='flash-sale'&&<label className="ad-field"><span className="ad-label">Promo code</span><input className="ad-input" maxLength={80} value={draft.promoCode} onChange={event=>update({promoCode:event.target.value})} placeholder="e.g. SAVE10"/></label>}
    <label className="ad-field"><span className="ad-label">Header banner</span><ImageUpload folder="banners" recommendation="Email campaign header: 1200 × 400 px · wide 3:1" onUploaded={url=>update({headerImageUrl:url})}/>{draft.headerImageUrl&&<img src={draft.headerImageUrl} alt="Campaign header preview" loading="lazy" decoding="async" style={{maxWidth:280,maxHeight:110,objectFit:'contain',marginTop:8}}/>}</label>
    <label className="ad-field"><span className="ad-label">Campaign message</span><textarea className="ad-input" rows={9} maxLength={12000} value={draft.body} onChange={event=>update({body:event.target.value})}/></label>
    <div className="email-shortcodes">{variableNames.map(name=><button type="button" key={name} className="email-shortcode" onClick={()=>update({body:`${draft.body}{${name}}`})}>{`{${name}}`}</button>)}</div>
    <div className="ad-form-row"><label className="ad-field"><span className="ad-label">CTA button label</span><input className="ad-input" maxLength={60} value={draft.ctaLabel} onChange={event=>update({ctaLabel:event.target.value})}/></label><label className="ad-field"><span className="ad-label">CTA route or URL</span><input className="ad-input" maxLength={1000} value={draft.ctaHref} onChange={event=>update({ctaHref:event.target.value})}/></label></div>
    <p className="ad-help">Audience: {audienceLabel}. Dispatch is limited to opted-in contacts and requires the global email switch plus a server-configured provider.</p>
    <div className="ad-actions-row"><button type="button" className="ad-btn" onClick={()=>void saveDraft()} disabled={working}><Save size={14}/> Save draft</button><button type="button" className="ad-btn" onClick={()=>{const selected=drafts.find(item=>item.id===draft.id);if(selected){setDraft({...defaultDraft(settings),...selected});setFeedback('Draft reloaded.');}}} disabled={!drafts.some(item=>item.id===draft.id)}>Reload saved draft</button><button type="button" className="ad-btn primary" onClick={()=>void sendCampaign()} disabled={!campaignReady||working||!draft.subject.trim()||!draft.body.trim()}><Send size={14}/> {working?'Working…':'Dispatch campaign'}</button></div>
    <div className="ad-form-row"><label className="ad-field"><span className="ad-label">Send test to</span><input className="ad-input" type="email" value={testRecipient} onChange={event=>setTestRecipient(event.target.value)} placeholder="you@example.com"/></label><button type="button" className="ad-btn" onClick={()=>void sendTest()} disabled={!providerStatus?.canSend||working||!testRecipient.trim()||!draft.senderProfileId}><Send size={14}/> Send test</button></div>
    {!campaignReady&&<p className="ad-help" role="status">{!settings.masterEnabled?'Turn on the master email switch before dispatching.':providerStatus?.detail||'Configure a provider and sender profile before dispatching.'}</p>}
    {feedback&&<p className="ad-feedback" role="status">{feedback}</p>}
    <section className="ad-card"><header className="ad-card-head"><div><h3 className="ad-card-title">Saved drafts</h3><p className="ad-card-note">Load a saved campaign into the composer.</p></div></header><div className="ad-card-body">{drafts.length?<div className="ad-menu-list">{drafts.map(item=><button type="button" className="ad-menu-item" key={item.id} onClick={()=>setDraft({...defaultDraft(settings),...item})} data-testid={`button-load-campaign-${item.id}`}><strong>{item.name||item.subject||'Untitled campaign'}</strong><span>{item.subject}</span></button>)}</div>:<p className="ad-help">No saved campaign drafts.</p>}</div></section>
    <section className="ad-card"><header className="ad-card-head"><div><h3 className="ad-card-title">Campaign history</h3><p className="ad-card-note">Dispatch status is saved in Supabase.</p></div><button type="button" className="ad-icon-btn" aria-label="Refresh campaign history" onClick={()=>setFeedback('Campaign history is live-updating.')}><RefreshCw size={14}/></button></header><div className="ad-card-body">{history.length?<div className="ad-table-wrap"><table className="ad-table"><thead><tr><th>Campaign</th><th>Audience</th><th>Status</th><th>Sent / Failed</th><th>Created</th></tr></thead><tbody>{history.map(item=><tr key={item.id}><td>{item.name||item.subject||'Campaign'}</td><td>{item.audience||'—'}</td><td>{item.status||'—'}</td><td>{item.sentCount??0} / {item.failedCount??0} of {item.recipientCount??0}</td><td>{timestamp(item.createdAt)}</td></tr>)}</tbody></table></div>:<p className="ad-help">No campaigns have been sent.</p>}</div></section>
  </div>;
}
