import { useEffect, useRef, useState } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp } from '../lib/supabase/documents';
import { PhoneCall, Save } from 'lucide-react';
import { httpsCallable, functions } from '../lib/supabase/functions';
import { db } from '../lib/supabase/index';

type VoiceConfig={enabled:boolean;provider:'twilio'|'custom-webhook'|'api-service'|'local-ivr';senderPhone:string;customWebhookUrl:string;sendCallUrl:string;callResultUrl:string;checkBalanceUrl:string;username:string;authMode:'bearer'|'basic';balanceMethod:'GET'|'POST';prompt:string;autoCallOnCod:boolean};
const initial:VoiceConfig={enabled:false,provider:'twilio',senderPhone:'',customWebhookUrl:'',sendCallUrl:'',callResultUrl:'',checkBalanceUrl:'',username:'',authMode:'bearer',balanceMethod:'GET',prompt:'Aapke [Store Name] se [Order Amount] ka order موصول hua hai. Order confirm karne ke liye 1 dabayein, cancel karne ke liye 2 dabayein.',autoCallOnCod:false};
const VOICE_SESSION_KEY='nura-admin-voice-config-v1';
function readVoiceDraft():VoiceConfig|null{
  try{
    const value=JSON.parse(sessionStorage.getItem(VOICE_SESSION_KEY)||'null');
    if(!value||typeof value!=='object')return null;
    return {
      enabled:value.enabled===true,
       provider:['twilio','custom-webhook','api-service','local-ivr'].includes(value.provider)?value.provider:initial.provider,
      senderPhone:typeof value.senderPhone==='string'?value.senderPhone.slice(0,24):'',
      customWebhookUrl:typeof value.customWebhookUrl==='string'?value.customWebhookUrl.slice(0,500):'',
       sendCallUrl:typeof value.sendCallUrl==='string'?value.sendCallUrl.slice(0,500):'',
       callResultUrl:typeof value.callResultUrl==='string'?value.callResultUrl.slice(0,500):'',
       checkBalanceUrl:typeof value.checkBalanceUrl==='string'?value.checkBalanceUrl.slice(0,500):'',
       username:typeof value.username==='string'?value.username.slice(0,160):'',
       authMode:value.authMode==='basic'?'basic':'bearer',
       balanceMethod:value.balanceMethod==='POST'?'POST':'GET',
      prompt:typeof value.prompt==='string'?value.prompt.slice(0,700):initial.prompt,
      autoCallOnCod:value.autoCallOnCod===true,
    };
  }catch{return null;}
}
export default function VoiceIVRPage(){
  const [config,setConfig]=useState<VoiceConfig>(()=>readVoiceDraft()??initial);
  const hasLocalDraft=useRef(readVoiceDraft()!==null);
  const [loaded,setLoaded]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [balance,setBalance]=useState('');
  const [resultOrderId,setResultOrderId]=useState('');
  useEffect(()=>{
    if(!db){setLoaded(true);return;}
    return onSnapshot(doc(db,'voiceSettings','config'),snapshot=>{
      const value=snapshot.data()||{};
       if(!hasLocalDraft.current)setConfig({
        enabled:value.enabled===true,
         provider:['twilio','custom-webhook','api-service','local-ivr'].includes(value.provider)?value.provider:initial.provider,
        senderPhone:typeof value.senderPhone==='string'?value.senderPhone.slice(0,24):'',
        customWebhookUrl:typeof value.customWebhookUrl==='string'?value.customWebhookUrl.slice(0,500):'',
         sendCallUrl:typeof value.sendCallUrl==='string'?value.sendCallUrl.slice(0,500):'',
         callResultUrl:typeof value.callResultUrl==='string'?value.callResultUrl.slice(0,500):'',
         checkBalanceUrl:typeof value.checkBalanceUrl==='string'?value.checkBalanceUrl.slice(0,500):'',
         username:typeof value.username==='string'?value.username.slice(0,160):'',
         authMode:value.authMode==='basic'?'basic':'bearer',
         balanceMethod:value.balanceMethod==='POST'?'POST':'GET',
        prompt:typeof value.prompt==='string'?value.prompt.slice(0,700):initial.prompt,
        autoCallOnCod:value.autoCallOnCod===true,
      });
      setLoaded(true);
     },()=>{setMessage('Voice settings could not be loaded. Supabase will retry transient connection interruptions.');setLoaded(true);});
  },[]);
  useEffect(()=>{
    if(!hasLocalDraft.current)return;
    try{sessionStorage.setItem(VOICE_SESSION_KEY,JSON.stringify(config));}catch{}
  },[config]);
  const patch=(changes:Partial<VoiceConfig>)=>{hasLocalDraft.current=true;setConfig(current=>({...current,...changes}));};
  async function save(){
    if(!db)return setMessage('Supabase is not configured.');
     if(config.provider==='custom-webhook'&&config.customWebhookUrl&&!/^https:\/\/[^/]+/i.test(config.customWebhookUrl))return setMessage('The custom gateway URL must use HTTPS.');
     for(const endpoint of [config.sendCallUrl,config.callResultUrl,config.checkBalanceUrl])if(endpoint&&!/^https:\/\/[^/]+/i.test(endpoint))return setMessage('Every voice API endpoint must use HTTPS.');
    setBusy(true);setMessage('');
     try{await setDoc(doc(db,'voiceSettings','config'),{...config,updatedAt:serverTimestamp()},{merge:true});hasLocalDraft.current=false;try{sessionStorage.removeItem(VOICE_SESSION_KEY);}catch{}setMessage('Voice & IVR settings saved.');}
    catch{setMessage('Could not save settings. Confirm administrator access and try again.');}
    finally{setBusy(false);}
  }
  async function checkBalance(){
    if(!functions)return setMessage('The Vercel server API is not configured.');
    setBusy(true);setMessage('');setBalance('');
    try{const result=await httpsCallable(functions,'adminCheckVoiceBalance')({});const data=result.data as {configured?:boolean;available?:boolean;balance?:number|null;currency?:string};setBalance(data.configured&&data.available?`${data.balance} ${data.currency||''}`.trim(): 'Provider is not configured or returned no balance.');}
    catch(error){setMessage(error instanceof Error?error.message:'Balance check failed.');}
    finally{setBusy(false);}
  }
  async function checkCallResult(){
    if(!functions||!resultOrderId.trim())return setMessage('Enter an order ID to check.');
    setBusy(true);setMessage('');
    try{const result=await httpsCallable(functions,'adminRefreshVoiceCallResult')({orderId:resultOrderId.trim()});const data=result.data as {configured?:boolean;result?:{status:string;providerStatus:string;callId:string;duration:number|null;userResponse:string}};setMessage(data.configured&&data.result?`Result: ${data.result.status} · provider ${data.result.providerStatus||'unknown'} · key ${data.result.userResponse||'none'} · ${data.result.duration??'—'} sec`: 'Call Result API is not configured.');}
    catch(error){setMessage(error instanceof Error?error.message:'Call result request failed.');}
    finally{setBusy(false);}
  }
  if(!loaded)return <section className="ad-card"><div className="ad-card-body">Loading voice settings…</div></section>;
  return <section className="ad-card">
    <header className="ad-card-head"><div><h2 className="ad-card-title"><PhoneCall size={15}/> Voice & IVR Engine</h2><p className="ad-card-note">Calls run through server-side Vercel adapters. Keep provider credentials in server-only environment variables.</p></div></header>
    <div className="ad-card-body ad-form-stack">
      <label className="ad-checkline"><input type="checkbox" checked={config.enabled} onChange={event=>patch({enabled:event.target.checked})}/> Enable voice calls</label>
       <div className="ad-form-row">
         <label className="ad-field"><span className="ad-label">API provider / gateway</span><select className="ad-input" value={config.provider} onChange={event=>patch({provider:event.target.value as VoiceConfig['provider']})}><option value="twilio">Twilio</option><option value="custom-webhook">Custom Webhook</option><option value="api-service">Generic voice API</option><option value="local-ivr">Local IVR (adapter required)</option></select></label>
        <label className="ad-field"><span className="ad-label">Sender phone / Caller ID</span><input className="ad-input" type="tel" maxLength={24} value={config.senderPhone} onChange={event=>patch({senderPhone:event.target.value})} placeholder="+1..." /></label>
      </div>
      {config.provider==='custom-webhook'&&<label className="ad-field"><span className="ad-label">Custom gateway HTTPS URL</span><input className="ad-input" type="url" value={config.customWebhookUrl} onChange={event=>patch({customWebhookUrl:event.target.value})} placeholder="https://voice-provider.example/calls" /></label>}
       {config.provider==='api-service'&&<><div className="ad-form-row">
         {([['sendCallUrl','Send Call API endpoint'],['callResultUrl','Call Result API endpoint'],['checkBalanceUrl','Check Balance API endpoint']] as const).map(([key,label])=><label className="ad-field" key={key}><span className="ad-label">{label}</span><input className="ad-input" type="url" value={config[key]} onChange={event=>patch({[key]:event.target.value})} placeholder="https://provider.example/api/..." /></label>)}
       </div><div className="ad-form-row">
          <label className="ad-field"><span className="ad-label">API username {config.authMode==='basic'?'(required for Basic auth)':'(used for Basic auth)'}</span><input className="ad-input" maxLength={160} value={config.username} onChange={event=>patch({username:event.target.value})} /></label>
         <label className="ad-field"><span className="ad-label">Authentication method</span><select className="ad-input" value={config.authMode} onChange={event=>patch({authMode:event.target.value as VoiceConfig['authMode']})}><option value="bearer">Bearer token</option><option value="basic">Username + password</option></select></label>
         <label className="ad-field"><span className="ad-label">Balance request method</span><select className="ad-input" value={config.balanceMethod} onChange={event=>patch({balanceMethod:event.target.value as VoiceConfig['balanceMethod']})}><option>GET</option><option>POST</option></select></label>
       </div><div className="ad-actions-row"><button className="ad-btn" type="button" disabled={busy} onClick={()=>void checkBalance()}>Check balance</button>{balance&&<span role="status" className="ad-item-sub">Balance: {balance}</span>}</div>
       <div className="ad-form-row"><label className="ad-field"><span className="ad-label">Order ID for call result lookup</span><input className="ad-input" value={resultOrderId} onChange={event=>setResultOrderId(event.target.value)} placeholder="Order ID" /></label><button className="ad-btn" type="button" disabled={busy} onClick={()=>void checkCallResult()}>Fetch call result</button></div></>}
      <label className="ad-field"><span className="ad-label">Text-to-speech prompt</span><textarea className="ad-input" rows={4} maxLength={700} value={config.prompt} onChange={event=>patch({prompt:event.target.value})}/><small className="ad-help">Placeholders: [Customer Name], [Order Amount], [Order ID]. Key 1 confirms; key 2 cancels.</small></label>
       <div className="ad-notice"><strong>DTMF callback:</strong> Twilio and custom gateways use the signed <code>/api/store/voiceCallWebhook</code> endpoint. Responses are single-use and update inventory transactionally if a COD order is cancelled.</div>
      <label className="ad-checkline"><input type="checkbox" checked={config.autoCallOnCod} onChange={event=>patch({autoCallOnCod:event.target.checked})}/> Automatically call new cash-on-delivery orders</label>
        <div className="ad-notice"><strong>Server secrets:</strong> Configure Twilio account credentials or the selected gateway token/password in Vercel. Do not store API passwords or tokens in these settings.</div>
      {config.provider==='local-ivr'&&<div className="ad-notice">Local IVR is a configuration placeholder until its carrier adapter and public callback endpoint are connected.</div>}
      <div className="ad-actions-row"><button className="ad-btn primary" type="button" disabled={busy} onClick={()=>void save()}><Save size={14}/>{busy?'Saving…':'Save voice settings'}</button>{message&&<span role="status" className="ad-item-sub">{message}</span>}</div>
    </div>
  </section>;
}
