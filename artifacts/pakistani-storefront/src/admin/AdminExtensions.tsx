import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, Copy, ExternalLink, Plus, Save, Trash2 } from 'lucide-react';
import { deleteObject, getDownloadURL, list, ref as storageRef } from '../lib/supabase/storage';
import ImageUpload from '../components/ImageUpload';
import { useAdminStore, type ManagedNavigationItem } from '../context/AdminContext';
import { useStore } from '../context/StoreContext';
import { formatPKR } from '../utils/store';
import type { StoreAssetFolder, UploadedStoreAsset } from '../utils/images';
import { getSupabaseStorage } from '../lib/supabase/index';

type GtagWindow=Window&{dataLayer?:unknown[][];gtag?:(command:string,action:string|Date,parameters?:Record<string,unknown>)=>void};

export function AnalyticsPage(){
  const {data,setData,flush}=useAdminStore();
  const {orders}=useStore();
  const [tab,setTab]=useState<'overview'|'settings'>('overview');
  const [period,setPeriod]=useState('7d');
  const [message,setMessage]=useState('');
  const analytics=data.settings.analytics;
  const setAnalytics=(patch:Partial<typeof analytics>)=>setData(previous=>({...previous,settings:{...previous.settings,analytics:{...previous.settings.analytics,...patch}}}));
  const verify=()=>{
    const id=analytics.measurementId.trim();
    if(!/^G-[A-Z0-9-]+$/i.test(id)){setMessage('Enter a valid GA4 Measurement ID (G-XXXXXXXXXX) first.');return;}
    if(!analytics.enabled){setMessage('Save the ID and enable analytics to load the tag on the storefront.');return;}
    const browser=window as GtagWindow;
    browser.dataLayer=browser.dataLayer||[];
    browser.gtag=browser.gtag||((...args:unknown[])=>browser.dataLayer!.push(args));
    const gtag=browser.gtag;
    const selector=`script[data-nura-analytics="${CSS.escape(id)}"]`;
    if(!document.querySelector(selector)){
      const script=document.createElement('script');
      script.async=true;
      script.src=`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
      script.dataset.nuraAnalytics=id;
      document.head.appendChild(script);
    }
    gtag('js',new Date());
    gtag('config',id,{send_page_view:false});
    gtag('event','admin_connection_test',{send_to:id});
    setMessage('Test event queued. Confirm it in GA4 Realtime; aggregate reports require a server-side reporting connection.');
  };
  const save=async()=>{
    try{const result=await flush();setMessage(result==='local'?'Analytics settings are saved on this device; cloud sync is pending.':'Analytics settings saved. The storefront will load the tag on its next page visit.');}
    catch(error){setMessage(error instanceof Error?`Save failed: ${error.message}`:'Save failed.');}
  };
  const now=new Date();
  const periodStart=period==='24h'?now.getTime()-24*60*60*1000:period==='7d'?now.getTime()-7*86400000:period==='30d'?now.getTime()-30*86400000:now.getTime()-365*86400000;
  const validOrders=orders.filter(order=>order.status!=='Cancelled'&&(!periodStart||Date.parse(order.createdAt)>=periodStart));
  const orderValue=validOrders.reduce((sum,order)=>sum+order.grandTotal,0);
  const averageOrder=validOrders.length?orderValue/validOrders.length:0;
  const bucketCount=period==='24h'?24:period==='7d'?7:period==='30d'?30:12;
  const buckets=Array.from({length:bucketCount},(_,index)=>{
    const date=new Date(now);
    if(period==='24h')date.setHours(now.getHours()-(bucketCount-1-index),0,0,0);
    else if(period==='all')date.setMonth(now.getMonth()-(bucketCount-1-index),1);
    else {date.setDate(now.getDate()-(bucketCount-1-index));date.setHours(0,0,0,0);}
    return {date,value:0};
  });
  for(const order of validOrders){
    const created=new Date(order.createdAt);
    const bucket=period==='24h'?buckets.find(item=>item.date.getHours()===created.getHours()&&item.date.toDateString()===created.toDateString()):period==='all'?buckets.find(item=>item.date.getMonth()===created.getMonth()&&item.date.getFullYear()===created.getFullYear()):buckets.find(item=>item.date.toDateString()===created.toDateString());
    if(bucket)bucket.value+=order.grandTotal;
  }
  const maxValue=Math.max(1,...buckets.map(item=>item.value));
  const chartPoints=buckets.map((item,index)=>`${40+(index*(660/Math.max(1,bucketCount-1)))} ${150-(item.value/maxValue)*120}`).join(' ');
  const topProducts=new Map<string,{quantity:number;value:number}>();
  validOrders.forEach(order=>order.items.forEach(line=>{const current=topProducts.get(line.product.name)||{quantity:0,value:0};current.quantity+=line.quantity;current.value+=line.product.price*line.quantity;topProducts.set(line.product.name,current);}));
  const bestSellers=[...topProducts.entries()].sort((a,b)=>b[1].quantity-a[1].quantity).slice(0,5);
  return <>
    <div className="ad-page-head"><div><div className="ad-kicker">Overview</div><h1 className="ad-page-title">Analytics</h1><p className="ad-page-subtitle">Track storefront visits and manage the GA4 tag without editing code.</p></div></div>
    <div className="ad-tabs" role="tablist" aria-label="Analytics sections">
      <button type="button" role="tab" aria-selected={tab==='overview'} className={`ad-tab ${tab==='overview'?'active':''}`} onClick={()=>setTab('overview')} data-testid="tab-analytics-overview">Overview</button>
      <button type="button" role="tab" aria-selected={tab==='settings'} className={`ad-tab ${tab==='settings'?'active':''}`} onClick={()=>setTab('settings')} data-testid="tab-analytics-settings">Settings</button>
    </div>
    {tab==='overview'?<>
      <div className="ad-toolbar">
        <span className="ad-help" style={{margin:0}}>Reporting period</span>
        {[
          ['24h','Last 24 hours'],['7d','Last 7 days'],['30d','Last 30 days'],['all','Last 12 months'],
        ].map(([value,label])=><button type="button" key={value} className={`ad-btn small ${period===value?'primary':''}`} onClick={()=>setPeriod(value)} data-testid={`button-analytics-period-${value}`}>{label}</button>)}
      </div>
      <div className="ad-stats ad-analytics-stats">
        {[{label:'Order value',value:formatPKR(orderValue),foot:'Cancelled orders excluded'},{label:'Orders',value:String(validOrders.length),foot:'Within the selected period'},{label:'Average order value',value:formatPKR(averageOrder),foot:'Order value divided by order count'}].map(card=><article className="ad-stat" key={card.label}><div className="ad-stat-label">{card.label}</div><div className="ad-stat-value">{card.value}</div><div className="ad-stat-foot">{card.foot}</div></article>)}
      </div>
      <section className="ad-card">
        <header className="ad-card-head"><div><h2 className="ad-card-title">Order value over time</h2><div className="ad-card-note">Based on non-cancelled order totals; payment verification is tracked separately.</div></div></header>
        <div className="ad-card-body">
          <svg className="ad-analytics-chart" viewBox="0 0 760 190" role="img" aria-label={`Order value trend for ${period}`}>
            {[20,60,100,140,180].map(y=><line key={y} x1="40" y1={y} x2="750" y2={y} stroke="#eee7df" strokeWidth="1" strokeDasharray="4 5"/>)}
            <line x1="40" y1="20" x2="40" y2="180" stroke="#d8cec2"/>
            <line x1="40" y1="180" x2="750" y2="180" stroke="#d8cec2"/>
            {validOrders.length>0&&<polyline points={chartPoints} fill="none" stroke="#6b2447" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"/>}
            {!validOrders.length&&<text x="395" y="94" textAnchor="middle" fill="#92877d" fontSize="12">No order data for this period</text>}
          </svg>
          <div className="ad-notice">This report uses order totals already available to the admin. GA4 visitor and referral reports still require a server-side GA4 Data API credential; tracking setup remains in Analytics → Settings.</div>
        </div>
      </section>
      <div className="ad-grid two ad-analytics-tables">
        <section className="ad-card"><header className="ad-card-head"><h2 className="ad-card-title">Top products</h2><div className="ad-card-note">Ranked by units ordered</div></header>{bestSellers.length?<div className="ad-table-wrap"><table className="ad-table"><thead><tr><th>Product</th><th>Units</th><th>Order value</th></tr></thead><tbody>{bestSellers.map(([name,stats])=><tr key={name}><td>{name}</td><td>{stats.quantity}</td><td>{formatPKR(stats.value)}</td></tr>)}</tbody></table></div>:<div className="ad-card-body"><div className="ad-empty-inline">Product sales will appear after the first order.</div></div>}</section>
        <section className="ad-card"><header className="ad-card-head"><h2 className="ad-card-title">Sales by period</h2></header><div className="ad-card-body"><div className="ad-form-stack">{buckets.filter(bucket=>bucket.value>0).slice(-8).reverse().map(bucket=><div key={bucket.date.toISOString()}><div className="ad-item-sub" style={{display:'flex',justifyContent:'space-between'}}><span>{period==='24h'?bucket.date.toLocaleTimeString('en-PK',{hour:'numeric'}):bucket.date.toLocaleDateString('en-PK',{month:'short',day:period==='all'?undefined:'numeric'})}</span><strong>{formatPKR(bucket.value)}</strong></div><div style={{height:5,marginTop:5,background:'#eee7df',borderRadius:99}}><div style={{height:'100%',width:`${Math.max(4,bucket.value/maxValue*100)}%`,background:'#74816c',borderRadius:99}}/></div></div>)}</div>{!validOrders.length&&<div className="ad-empty-inline">No sales to summarize for this period.</div>}</div></section>
      </div>
      {analytics.measurementId&&<a className="ad-btn ghost" href="https://analytics.google.com/analytics/web/" target="_blank" rel="noreferrer">Open Google Analytics <ExternalLink size={13}/></a>}
    </>:<div className="ad-grid two ad-analytics-settings">
      <section className="ad-card">
        <header className="ad-card-head"><div><h2 className="ad-card-title">Tracking integration</h2><div className="ad-card-note">The Measurement ID is public configuration, not an API secret.</div></div></header>
        <div className="ad-card-body ad-form-stack">
          <label className="ad-field"><span className="ad-label">Provider</span><select className="ad-select" value={analytics.provider} onChange={event=>setAnalytics({provider:event.target.value as typeof analytics.provider})} data-testid="select-analytics-provider"><option value="ga4">Google Analytics 4</option><option value="custom">Custom GA4-compatible tag</option></select></label>
          <label className="ad-field"><span className="ad-label">Measurement ID</span><input className="ad-input" value={analytics.measurementId} placeholder="G-XXXXXXXXXX" maxLength={64} onChange={event=>setAnalytics({measurementId:event.target.value.trim()})} data-testid="input-analytics-measurement-id"/><span className="ad-help">Only a GA4 Measurement ID is stored here. Do not enter a service-account key, API token, or JavaScript source.</span></label>
          <label className="ad-checkline"><input type="checkbox" checked={analytics.enabled} onChange={event=>setAnalytics({enabled:event.target.checked})} data-testid="toggle-analytics-enabled"/> Enable storefront analytics</label>
          {analytics.provider==='custom'&&<div className="ad-notice">Arbitrary JavaScript from the database is not injected into the storefront. This safe custom mode uses the standard GA4 tag format only.</div>}
          <div className="ad-actions-row"><button className="ad-btn primary" type="button" onClick={()=>void save()} data-testid="button-save-analytics"><Save size={14}/> Save settings</button><button className="ad-btn" type="button" onClick={verify} data-testid="button-test-analytics">Test connection / Verify tag</button></div>
          {message&&<p role="status" className="ad-help ad-feedback">{message}</p>}
        </div>
      </section>
      <section className="ad-card">
        <header className="ad-card-head"><div><h2 className="ad-card-title">Reporting connection</h2><div className="ad-card-note">Required for visitor totals and report tables in this panel.</div></div></header>
        <div className="ad-card-body ad-form-stack">
          <div className="ad-notice">GA4 browser tracking is enabled independently from report access. The GA4 Data API credential is a secret and must be configured on the server; it cannot safely be stored in the shared settings document.</div>
          <div className="ad-item-sub">Status <strong className="ad-report-status">{analytics.enabled&&analytics.measurementId?'Tracking ID configured':'Not configured'}</strong></div>
          <p className="ad-help">Once a server-side credential is available, the dashboard can query the selected time period without exposing it to shoppers.</p>
        </div>
      </section>
    </div>}
  </>;
}

export function CustomersPage(){
  const {orders}=useStore();
  const customers=new Map<string,{name:string;email:string;phone:string;orders:number;spend:number;latest:string}>();
  orders.forEach(order=>{
    const key=order.email.trim().toLowerCase();
    if(!key)return;
    const current=customers.get(key)||{name:order.fullName,email:order.email,phone:order.phone,orders:0,spend:0,latest:order.createdAt};
    current.orders+=1;
    current.spend+=order.grandTotal;
    if(Date.parse(order.createdAt)>Date.parse(current.latest))current.latest=order.createdAt;
    if(!current.name&&order.fullName)current.name=order.fullName;
    if(!current.phone&&order.phone)current.phone=order.phone;
    customers.set(key,current);
  });
  const rows=[...customers.values()].sort((a,b)=>Date.parse(b.latest)-Date.parse(a.latest));
  return <>
    <div className="ad-page-head"><div><div className="ad-kicker">Sales</div><h1 className="ad-page-title">Customers</h1><p className="ad-page-subtitle">Customer records are summarized from Supabase orders; no separate duplicate customer database is created.</p></div></div>
    <section className="ad-card"><header className="ad-card-head"><div><h2 className="ad-card-title">Customer directory</h2><div className="ad-card-note">{rows.length} customers with at least one order</div></div></header>
      {rows.length?<div className="ad-table-wrap"><table className="ad-table"><thead><tr><th>Customer</th><th>Email</th><th>Phone</th><th>Orders</th><th>Lifetime spend</th><th>Latest order</th></tr></thead><tbody>{rows.map(customer=><tr key={customer.email}><td><div className="ad-item-name">{customer.name||'Customer'}</div></td><td>{customer.email}</td><td>{customer.phone||'—'}</td><td>{customer.orders}</td><td>{formatPKR(customer.spend)}</td><td>{new Date(customer.latest).toLocaleDateString('en-PK')}</td></tr>)}</tbody></table></div>:<div className="ad-empty-inline">Customer records will appear after the first order.</div>}
    </section>
  </>;
}

const MEDIA_PAGE_SIZE=50;
const MEDIA_URL_CONCURRENCY=8;
const MEDIA_REQUEST_TIMEOUT_MS=12_000;

async function withMediaRequestTimeout<T>(request:Promise<T>,description:string):Promise<T>{
  let timeoutId=0;
  try{
    return await Promise.race([
      request,
      new Promise<never>((_,reject)=>{
        timeoutId=window.setTimeout(
          ()=>reject(new Error(`${description} did not respond within ${MEDIA_REQUEST_TIMEOUT_MS/1000} seconds.`)),
          MEDIA_REQUEST_TIMEOUT_MS,
        );
      }),
    ]);
  }finally{
    window.clearTimeout(timeoutId);
  }
}

export function MediaLibraryPage(){
  const {data,setData,flush}=useAdminStore();
  const [query,setQuery]=useState('');
  const [compressionSaving,setCompressionSaving]=useState(false);
  const [compressionFeedback,setCompressionFeedback]=useState('');
  const [uploadedAssets,setUploadedAssets]=useState<{url:string;path:string;name:string}[]>([]);
  const [loadError,setLoadError]=useState('');
  const [loading,setLoading]=useState(true);
  const [pendingDelete,setPendingDelete]=useState<{url:string;path:string;name:string}|null>(null);
  const [deleting,setDeleting]=useState('');
  const [feedback,setFeedback]=useState('');
  const [copiedUrl,setCopiedUrl]=useState('');
  const [uploadFolder,setUploadFolder]=useState<StoreAssetFolder>('products');
  const [pageTokens,setPageTokens]=useState<Partial<Record<StoreAssetFolder,string>>>({});
  const loadRequest=useRef(0);
  const saveAutoCompression=async(enabled:boolean)=>{
    setData(previous=>({...previous,settings:{...previous.settings,general:{...previous.settings.general,autoCompressUploads:enabled}}}));
    setCompressionSaving(true);
    setCompressionFeedback('');
    try{
      const result=await flush('settings.general');
      setCompressionFeedback(result==='local'
        ?'Saved on this device; cloud sync is pending.'
        :'Upload optimization preference saved.');
    }catch(error){
      setCompressionFeedback(error instanceof Error
        ?`Could not save upload optimization preference: ${error.message}`
        :'Could not save upload optimization preference. Check your connection and try again.');
    }finally{
      setCompressionSaving(false);
    }
  };
  const receiveUploadedAsset=(asset:UploadedStoreAsset)=>{
    setUploadedAssets(current=>{
      const unique=new Map(current.map(existing=>[existing.url,existing]));
      unique.set(asset.url,{url:asset.url,path:asset.path,name:asset.name});
      return [...unique.values()].sort((a,b)=>a.name.localeCompare(b.name));
    });
    setLoadError('');
  };
  const loadAssets=async(loadMore=false)=>{
    const requestId=++loadRequest.current;
    const activeStorage=await getSupabaseStorage();
    if(!activeStorage){setLoadError('Supabase Storage is not configured.');setLoading(false);return;}
    setLoading(true);setLoadError('');
    const errors:string[]=[];
    try{
      const folderNames:StoreAssetFolder[]=['products','banners','widgets','categories','brand'];
      const tokenSnapshot=loadMore?pageTokens:{};
      if(!loadMore)setPageTokens({});
      let activeUrlRequests=0;
      const urlRequestWaiters:Array<()=>void>=[];
      const withUrlSlot=async<T,>(request:()=>Promise<T>):Promise<T>=>{
        if(activeUrlRequests>=MEDIA_URL_CONCURRENCY){
          await new Promise<void>(resolve=>urlRequestWaiters.push(resolve));
        }else{
          activeUrlRequests++;
        }
        try{return await request();}
        finally{
          const next=urlRequestWaiters.shift();
          if(next)next();
          else activeUrlRequests--;
        }
      };
      await Promise.all(folderNames.map(async folderName=>{
        let page;
        try{
          page=await withMediaRequestTimeout(
            list(storageRef(activeStorage,`store/${folderName}`),{
              maxResults:MEDIA_PAGE_SIZE,
              ...(tokenSnapshot[folderName]?{pageToken:tokenSnapshot[folderName]}:{}),
            }),
            `Listing store/${folderName}`,
          );
        }catch(error){
          errors.push(`${folderName} listing: ${error instanceof Error?error.message:'request failed'}`);
          return;
        }
        if(requestId!==loadRequest.current)return;
        setPageTokens(current=>{
          const next={...current};
          if(page.nextPageToken)next[folderName]=page.nextPageToken;
          else delete next[folderName];
          return next;
        });
        await Promise.all(page.items.map(item=>withUrlSlot(async()=>{
          try{
            const url=await withMediaRequestTimeout(getDownloadURL(item),`Opening ${item.name}`);
            if(requestId!==loadRequest.current)return;
            const asset={url,path:item.fullPath,name:item.name};
            setUploadedAssets(current=>{
              const unique=new Map(current.map(existing=>[existing.url,existing]));
              unique.set(asset.url,asset);
              return [...unique.values()].sort((a,b)=>a.name.localeCompare(b.name));
            });
          }catch(error){
            if(requestId===loadRequest.current)errors.push(
              `${item.fullPath}: ${error instanceof Error?error.message:'download URL unavailable'}`,
            );
          }
        })));
      }));
      if(requestId===loadRequest.current&&errors.length){
        const visibleErrors=errors.slice(0,6).join('; ');
        const remaining=errors.length>6?`; and ${errors.length-6} more issue(s)`:'';
        setLoadError(`Some media could not be listed or opened: ${visibleErrors}${remaining}. Files from available folders remain visible.`);
      }
    }catch(error){
      if(requestId===loadRequest.current){
        setLoadError(error instanceof Error
          ?`Media listing stopped unexpectedly: ${error.message}. Uploaded files remain available through the upload workflow.`
          :'Media listing stopped unexpectedly. Uploaded files remain available through the upload workflow.');
      }
    }finally{
      if(requestId===loadRequest.current)setLoading(false);
    }
  };
  useEffect(()=>{
    const onUploaded=(event:Event)=>receiveUploadedAsset((event as CustomEvent<UploadedStoreAsset>).detail);
    window.addEventListener('nura:media-uploaded',onUploaded);
    const channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('nura-media-assets'):null;
    if(channel)channel.onmessage=event=>receiveUploadedAsset(event.data as UploadedStoreAsset);
    void loadAssets();
    return()=>{window.removeEventListener('nura:media-uploaded',onUploaded);channel?.close();loadRequest.current++;};
  },[]);
  const references=useMemo(()=>{
    const found=new Map<string,string[]>();
    const scan=(value:unknown,path:string[]=[]):void=>{
      if(typeof value==='string'&&/^https?:\/\//i.test(value)){
        const label=path.filter(part=>part&&!/^\d+$/.test(part)).slice(-3).map(part=>part.replace(/([a-z])([A-Z])/g,'$1 $2')).join(' / ')||'Store content';
        found.set(value,[...(found.get(value)??[]),label]);
      }else if(Array.isArray(value))value.forEach((item,index)=>scan(item,[...path,String(index)]));
      else if(value&&typeof value==='object'){
        const record=value as Record<string,unknown>;
        const displayName=[record.name,record.title,record.label].find(item=>typeof item==='string'&&item.trim());
        const namedPath=displayName?[...path,displayName as string]:path;
        Object.entries(record).forEach(([key,item])=>scan(item,[...namedPath,key]));
      }
    };
    scan(data);return found;
  },[data]);
  const assets=useMemo(()=>{
    return [...new Map(uploadedAssets.map(asset=>[asset.url,asset])).values()];
  },[uploadedAssets]);
  const filtered=assets.filter(asset=>`${asset.name} ${asset.path} ${references.get(asset.url)?.join(' ')??''} ${asset.url}`.toLowerCase().includes(query.toLowerCase()));
  const confirmDelete=async()=>{
    if(!pendingDelete)return;
    const storage=await getSupabaseStorage();
    if(!storage)return;
    const activeReferences=references.get(pendingDelete.url)??[];
    if(activeReferences.length){
      setFeedback('This file is still referenced. Replace or remove those links before deleting it.');
      setPendingDelete(null);return;
    }
    setDeleting(pendingDelete.url);setFeedback('');
    try{
      await deleteObject(storageRef(storage,pendingDelete.url));
      setFeedback(`${pendingDelete.name} was deleted from Supabase Storage.`);
      setUploadedAssets(current=>current.filter(asset=>asset.url!==pendingDelete.url));
      setPendingDelete(null);await loadAssets();
    }catch(error){setFeedback(error instanceof Error?`Delete failed: ${error.message}`:'Delete failed. Check storage access and try again.');}
    finally{setDeleting('');}
  };
  const copyMediaUrl=async(url:string)=>{
    try{
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      setFeedback('Image URL copied to clipboard.');
      window.setTimeout(()=>setCopiedUrl(current=>current===url?'':current),1800);
    }catch{
      setFeedback('Could not copy the URL. Select the URL text and copy it manually.');
    }
  };
  return <>
    <div className="ad-page-head"><div><div className="ad-kicker">Content</div><h1 className="ad-page-title">Media library</h1><p className="ad-page-subtitle">Browse uploaded images and GIFs, see where each file is referenced, and safely remove unused assets.</p></div><div className="ad-media-head-actions"><label className="ad-checkline" title="Controls automatic image optimization for uploads across the admin panel."><input type="checkbox" checked={data.settings.general.autoCompressUploads!==false} disabled={compressionSaving} onChange={event=>void saveAutoCompression(event.target.checked)} data-testid="toggle-auto-compress-uploads"/>Automatically optimize uploads</label><button className="ad-btn" type="button" onClick={()=>void loadAssets()} disabled={loading} data-testid="button-refresh-media">{loading?'Loading…':'Refresh media'}</button></div></div>
    {compressionFeedback&&<p className={compressionFeedback.startsWith('Could not save')?'ad-error':'ad-help'} role={compressionFeedback.startsWith('Could not save')?'alert':'status'} data-testid="status-auto-compress-uploads">{compressionFeedback}</p>}
    <section className="ad-card"><header className="ad-card-head"><div><h2 className="ad-card-title">Store assets</h2><div className="ad-card-note">{filtered.length} of {assets.length} uploaded images and GIFs</div></div><input className="ad-input ad-media-search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search uploaded files" aria-label="Search media library" data-testid="input-media-search"/></header>
      <div className="ad-card-body ad-form-row"><label className="ad-field"><span className="ad-label">Upload to</span><select className="ad-select" value={uploadFolder} onChange={event=>setUploadFolder(event.target.value as StoreAssetFolder)} data-testid="select-media-upload-folder"><option value="products">Product images</option><option value="banners">Banners &amp; story media</option><option value="categories">Category images</option><option value="widgets">Floating widgets</option><option value="brand">Store logo &amp; favicon</option></select></label><div className="ad-field"><span className="ad-label">Upload asset</span><ImageUpload folder={uploadFolder} onUploaded={()=>undefined}/></div></div>
       {loadError&&<div className="ad-notice" role="status">Storage media warning: {loadError}</div>}
      {feedback&&<div className="ad-notice" role="status" aria-live="polite">{feedback}</div>}
       {loading&&assets.length>0&&<div className="ad-empty-inline" role="status">{Object.keys(pageTokens).length?'Loading another page of uploaded media…':'Loading uploaded media…'}</div>}
      {loading&&!assets.length?<div className="ad-empty-inline">Loading uploaded media…</div>:filtered.length?<div className="ad-media-grid">{filtered.map(asset=>{
        const uses=references.get(asset.url)??[];const used=uses.length>0;
        return <article className="ad-media-card" key={asset.url} data-testid="media-item">
        <a href={asset.url} target="_blank" rel="noreferrer" aria-label={`Open ${asset.name}`} className="ad-media-preview"><img src={asset.url} alt={asset.name} loading="lazy"/></a>
        <div className="ad-media-meta"><strong>{asset.name}</strong><span>{asset.path||'Referenced external image'}</span><a href={asset.url} target="_blank" rel="noreferrer" className="ad-media-url" title={asset.url}>{asset.url}</a><button className="ad-btn small ad-media-copy" type="button" onClick={()=>void copyMediaUrl(asset.url)} aria-label={`Copy URL for ${asset.name}`} data-testid={`button-copy-media-${asset.name}`}>{copiedUrl===asset.url?'Copied!':<><Copy size={13}/> Copy URL</>}</button>
          {used&&<div className="ad-media-usage" data-testid="media-usage"><strong>In use — deletion blocked</strong><ul>{[...new Set(uses)].map((usage,index)=><li key={`${usage}-${index}`}>{usage}</li>)}</ul><span>Replace or remove these references in their editor before deleting this file.</span></div>}
          {asset.path?<button className="ad-btn small danger" type="button" disabled={deleting===asset.url} title={used?'View current references; deletion is blocked until they are removed.':'Delete this uploaded file from Supabase Storage.'} onClick={()=>setPendingDelete(asset)} data-testid={`button-delete-media-${asset.name}`}>{deleting===asset.url?'Deleting…':<><Trash2 size={13}/>{used?'Check usage':'Delete'}</>}</button>:<span className="ad-help">External URLs cannot be deleted here.</span>}
        </div></article>;
      })}</div>:<div className="ad-empty-inline">{assets.length?'No matching uploaded files.':'No uploaded images or GIFs found in Supabase Storage.'}</div>}
       {!loading&&Object.keys(pageTokens).length>0&&<div className="ad-media-load-more"><button className="ad-btn" type="button" onClick={()=>void loadAssets(true)} data-testid="button-load-more-media">Load more media</button></div>}
    </section>
    {pendingDelete&&<div className="ad-modal-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setPendingDelete(null);}}><section className="ad-modal" role="alertdialog" aria-modal="true" aria-labelledby="media-delete-title"><header className="ad-modal-head"><div><h2 className="ad-card-title" id="media-delete-title">{(references.get(pendingDelete.url)??[]).length?'Image is still in use':'Delete this unused image?'}</h2><p className="ad-card-note">{pendingDelete.name}</p></div></header><div className="ad-modal-body">{(references.get(pendingDelete.url)??[]).length?<><p>This image is currently referenced in the store database. Deletion is blocked so the storefront will not show a broken image.</p><ul className="ad-media-usage-list">{[...new Set(references.get(pendingDelete.url)??[])].map((usage,index)=><li key={`${usage}-${index}`}>{usage}</li>)}</ul><p className="ad-help">Replace or remove this image in the listed editor, save the change, then return here to delete it.</p><div className="ad-media-delete-actions"><button className="ad-btn primary" type="button" onClick={()=>setPendingDelete(null)}>Close</button></div></>:<><p>This permanently deletes the file from Supabase Storage. This action cannot be undone.</p><div className="ad-media-delete-actions"><button className="ad-btn" type="button" onClick={()=>setPendingDelete(null)}>Cancel</button><button className="ad-btn danger" type="button" onClick={()=>void confirmDelete()} disabled={Boolean(deleting)} data-testid="button-confirm-delete-media"><Trash2 size={14}/> Delete permanently</button></div></>}</div></section></div>}
    <section className="ad-card ad-media-guide"><header className="ad-card-head"><div><h2 className="ad-card-title">Recommended image sizes</h2><div className="ad-card-note">Upload helpers in the editors use the same guidance.</div></div></header>
      <div className="ad-table-wrap"><table className="ad-table"><thead><tr><th>Asset</th><th>Recommended size</th><th>Shape</th><th>Notes</th></tr></thead><tbody>
        <tr><td>Store logo</td><td>1200 × 400 px</td><td>Wide PNG / SVG</td><td>Transparent background recommended.</td></tr>
        <tr><td>Favicon icon</td><td>512 × 512 px</td><td>Square PNG / ICO</td><td>Keep the mark centered with clear padding.</td></tr>
        <tr><td>Main product images</td><td>1000 × 1000 px</td><td>Square 1:1</td><td>Maximum 2 MB; use a centered product image.</td></tr>
        <tr><td>Color swatch / texture</td><td>150 × 150 px</td><td>Square, circular display</td><td>Use a close, evenly lit crop.</td></tr>
        <tr><td>Category thumbnail tile</td><td>800 × 800 px</td><td>Square 1:1</td><td>Center the main subject for small-screen cards.</td></tr>
        <tr><td>Desktop hero</td><td>1920 × 800 px</td><td>Wide</td><td>Keep key text and subjects inside the center-safe area.</td></tr>
        <tr><td>Mobile hero</td><td>800 × 1000 px or 800 × 600 px</td><td>Portrait or compact landscape</td><td>Use the mobile slide image field to avoid cropping.</td></tr>
        <tr><td>Category header banner</td><td>1600 × 500 px</td><td>Wide</td><td>Allow a clear text-safe area on the left or center.</td></tr>
        <tr><td>Brand story image</td><td>1200 × 800 px</td><td>Landscape 3:2</td><td>Leave room for the neighboring story copy.</td></tr>
        <tr><td>Trust badge icon</td><td>128 × 128 px</td><td>Square PNG</td><td>Use a simple high-contrast transparent icon.</td></tr>
        <tr><td>Floating widget icon / GIF</td><td>256 × 256 px</td><td>Square PNG, WebP or animated GIF</td><td>Transparent backgrounds work best; maximum 5 MB. GIF animation is preserved.</td></tr>
      </tbody></table></div>
    </section>
  </>;
}

function reorder(items:ManagedNavigationItem[],index:number,by:number){
  const next=[...items];
  const target=index+by;
  if(target<0||target>=next.length)return items;
  [next[index],next[target]]=[next[target],next[index]];
  return next.map((item,order)=>({...item,order}));
}
function newItem(id:string,order:number,icon='custom'):ManagedNavigationItem{
  return {id:`${id}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`,label:'New link',href:'/shop',icon,visible:true,order};
}

export function NavigationManagerPage(){
  const {data,setData,flush}=useAdminStore();
  const [searchParams,setSearchParams]=useSearchParams();
  const requestedTab=searchParams.get('view');
  const [tab,setTab]=useState<'desktop'|'mobile'|'drawer'>(requestedTab==='mobile'||requestedTab==='drawer'?requestedTab:'desktop');
  useEffect(()=>setTab(requestedTab==='mobile'||requestedTab==='drawer'?requestedTab:'desktop'),[requestedTab]);
  const [message,setMessage]=useState('');
  const navigation=data.content.navigation;
  const desktop=navigation.desktopLinks;
  const mobile=navigation.mobileBottomBar.items;
  const drawerItems=navigation.drawer.items;
  const updateDesktop=(items:ManagedNavigationItem[])=>setData(previous=>({...previous,content:{...previous.content,navigation:{...previous.content.navigation,desktopLinks:items}}}));
  const updateMobile=(items:ManagedNavigationItem[])=>setData(previous=>({...previous,content:{...previous.content,navigation:{...previous.content.navigation,mobileBottomBar:{...previous.content.navigation.mobileBottomBar,items}}}}));
  const updateDrawer=(patch:Partial<typeof navigation.drawer>)=>setData(previous=>({...previous,content:{...previous.content,navigation:{...previous.content.navigation,drawer:{...previous.content.navigation.drawer,...patch}}}}));
  const updateDrawerItems=(items:ManagedNavigationItem[])=>updateDrawer({items});
  const updateDock=(patch:Partial<typeof navigation.mobileBottomBar.dock>)=>setData(previous=>({...previous,content:{...previous.content,navigation:{...previous.content.navigation,mobileBottomBar:{...previous.content.navigation.mobileBottomBar,dock:{...previous.content.navigation.mobileBottomBar.dock,...patch}}}}}));
  const updateItem=(items:ManagedNavigationItem[],id:string,patch:Partial<ManagedNavigationItem>)=>items.map(item=>item.id===id?{...item,...patch}:item);
  const save=async()=>{
    setMessage('Saving navigation settings…');
    try{
      const result=await flush('content.navigation');
      setMessage(result==='local'?'Saved on this device; cloud sync is pending.':'Navigation settings saved to Supabase.');
    }catch(error){
      const detail=error instanceof Error?error.message:'Navigation settings could not be saved.';
      setMessage(`Save failed: ${detail} Check your connection and administrator access, then try Save navigation again.`);
    }
  };
  const move=(items:ManagedNavigationItem[],index:number,by:number,update:(items:ManagedNavigationItem[])=>void)=>update(reorder(items,index,by));
  const iconOptions=[['home','Home'],['bag','Bag'],['grid','Grid'],['heart','Heart'],['user','User'],['search','Search'],['tag','Tag'],['truck','Truck'],['package','Package'],['book-open','Story'],['rotate-ccw','Returns'],['custom','Custom']];
  const renderList=(items:ManagedNavigationItem[],isMobile:boolean,update:(items:ManagedNavigationItem[])=>void)=> <div className="ad-menu-list">
    {items.map((item,index)=><details className="ad-menu-item" key={item.id} data-testid={`row-nav-item-${item.id}`}>
      <summary className="ad-menu-item-summary"><span><strong>{item.label||'Untitled link'}</strong><small>{item.href}</small></span><span className={`ad-status ${item.visible?'green':'rose'}`}>{item.visible?'Visible':'Hidden'}</span></summary>
      <div className="ad-menu-item-editor">
        <label className="ad-field"><span className="ad-label">Button label</span><input className="ad-input" maxLength={40} value={item.label} onChange={event=>update(updateItem(items,item.id,{label:event.target.value}))} data-testid={`input-nav-label-${item.id}`}/></label>
        <label className="ad-field"><span className="ad-label">Target URL / route</span><input className="ad-input" maxLength={500} value={item.href} placeholder="/shop or mailto:hello@example.com" onChange={event=>update(updateItem(items,item.id,{href:event.target.value}))} data-testid={`input-nav-href-${item.id}`}/></label>
        {isMobile&&<label className="ad-field"><span className="ad-label">Icon</span><select className="ad-select" value={iconOptions.some(([value])=>value===item.icon)?item.icon:'custom'} onChange={event=>update(updateItem(items,item.id,{icon:event.target.value}))} data-testid={`select-nav-icon-${item.id}`}>{iconOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>}
        <div className="ad-menu-item-actions">
          <label className="ad-checkline"><input type="checkbox" checked={item.visible} onChange={event=>update(updateItem(items,item.id,{visible:event.target.checked}))} data-testid={`toggle-nav-visible-${item.id}`}/> Visible</label>
          <button className="ad-icon-btn" type="button" aria-label={`Move ${item.label} up`} disabled={!index} onClick={()=>move(items,index,-1,update)}><ArrowUp/></button>
          <button className="ad-icon-btn" type="button" aria-label={`Move ${item.label} down`} disabled={index===items.length-1} onClick={()=>move(items,index,1,update)}><ArrowDown/></button>
          <button className="ad-icon-btn" type="button" aria-label={`Delete ${item.label}`} onClick={()=>update(items.filter(row=>row.id!==item.id))} data-testid={`button-delete-nav-${item.id}`}><Trash2/></button>
        </div>
      </div>
    </details>)}
  </div>;
  return <>
    <div className="ad-page-head"><div><div className="ad-kicker">Content</div><h1 className="ad-page-title">Navigation & menus</h1><p className="ad-page-subtitle">Manage the desktop links and mobile quick buttons shown across the storefront.</p></div><button className="ad-btn primary" type="button" onClick={()=>void save()} data-testid="button-save-navigation"><Save size={14}/> Save navigation</button></div>
    <div className="ad-tabs" role="tablist" aria-label="Navigation types">
      <button className={`ad-tab ${tab==='desktop'?'active':''}`} type="button" role="tab" aria-selected={tab==='desktop'} onClick={()=>{setTab('desktop');const next=new URLSearchParams(searchParams);next.set('view','desktop');setSearchParams(next);}} data-testid="tab-navigation-desktop">Desktop header menu</button>
      <button className={`ad-tab ${tab==='mobile'?'active':''}`} type="button" role="tab" aria-selected={tab==='mobile'} onClick={()=>{setTab('mobile');const next=new URLSearchParams(searchParams);next.set('view','mobile');setSearchParams(next);}} data-testid="tab-navigation-mobile">Mobile bottom bar</button>
      <button className={`ad-tab ${tab==='drawer'?'active':''}`} type="button" role="tab" aria-selected={tab==='drawer'} onClick={()=>{setTab('drawer');const next=new URLSearchParams(searchParams);next.set('view','drawer');setSearchParams(next);}} data-testid="tab-navigation-drawer">Mobile menu drawer</button>
    </div>
    {tab==='desktop'?<section className="ad-card"><header className="ad-card-head"><div><h2 className="ad-card-title">Desktop header links</h2><div className="ad-card-note">Links appear in the same order on desktop. Account/search/cart/wishlist icons remain separate controls.</div></div><button className="ad-btn small" type="button" onClick={()=>updateDesktop([...desktop,newItem('desktop',desktop.length)])}><Plus size={13}/> Add link</button></header><div className="ad-card-body">{renderList(desktop,false,updateDesktop)}</div></section>
        :tab==='mobile'?<>
         <section className="ad-card"><header className="ad-card-head"><div><h2 className="ad-card-title">Mobile bottom quick buttons</h2><div className="ad-card-note">Choose the label, route, icon, order, and visibility for each button.</div></div></header><div className="ad-card-body ad-form-stack">
           <label className="ad-checkline"><input type="checkbox" checked={navigation.mobileBottomBar.enabled} onChange={event=>setData(previous=>({...previous,content:{...previous.content,navigation:{...previous.content.navigation,mobileBottomBar:{...previous.content.navigation.mobileBottomBar,enabled:event.target.checked}}}}))} data-testid="toggle-mobile-bottom-bar"/> Enable mobile bottom bar</label>
           {renderList(mobile,true,updateMobile)}
           <button className="ad-btn" type="button" onClick={()=>updateMobile([...mobile,newItem('mobile',mobile.length,'home')])} data-testid="button-add-mobile-nav"><Plus size={13}/> Add quick button</button>
         </div></section>
          <section className="ad-card"><header className="ad-card-head"><div><h2 className="ad-card-title">Mobile navigation dock</h2><div className="ad-card-note">Choose a bottom bar, side dock, or floating pill and tune its appearance.</div></div></header><div className="ad-card-body ad-form-stack">
            <div className="ad-form-row"><label className="ad-field"><span className="ad-label">Layout</span><select className="ad-select" value={navigation.mobileBottomBar.dock.orientation} onChange={event=>updateDock({orientation:event.target.value as typeof navigation.mobileBottomBar.dock.orientation})}><option value="horizontal">Horizontal sticky bottom bar</option><option value="floating-right">Vertical floating dock — right</option><option value="floating-left">Vertical floating dock — left</option><option value="pill">Floating pill island</option></select></label><label className="ad-field"><span className="ad-label">Background color</span><input className="ad-input" type="color" value={navigation.mobileBottomBar.dock.backgroundColor} onChange={event=>updateDock({backgroundColor:event.target.value})}/></label><label className="ad-field"><span className="ad-label">Active item color</span><input className="ad-input" type="color" value={navigation.mobileBottomBar.dock.activeColor} onChange={event=>updateDock({activeColor:event.target.value})}/></label><label className="ad-field"><span className="ad-label">Inactive item color</span><input className="ad-input" type="color" value={navigation.mobileBottomBar.dock.inactiveColor} onChange={event=>updateDock({inactiveColor:event.target.value})}/></label></div>
            <div className="ad-form-row"><label className="ad-checkline"><input type="checkbox" checked={navigation.mobileBottomBar.dock.collapsible} onChange={event=>updateDock({collapsible:event.target.checked})}/> Show collapse/expand control</label><label className="ad-checkline"><input type="checkbox" checked={navigation.mobileBottomBar.dock.collapsedByDefault} onChange={event=>updateDock({collapsedByDefault:event.target.checked})}/> Start collapsed</label><label className="ad-checkline"><input type="checkbox" checked={navigation.mobileBottomBar.dock.showLabels} onChange={event=>updateDock({showLabels:event.target.checked})}/> Show text labels</label><label className="ad-checkline"><input type="checkbox" checked={navigation.mobileBottomBar.dock.glassmorphism} onChange={event=>updateDock({glassmorphism:event.target.checked})}/> Glass background</label></div>
          </div></section>
        </>:<>
          <section className="ad-card"><header className="ad-card-head"><div><h2 className="ad-card-title">Mobile menu drawer</h2><div className="ad-card-note">Set the compact slide-out width, link visibility, colors, icon treatment, and typography.</div></div></header><div className="ad-card-body ad-form-stack">
            <div className="ad-form-row"><label className="ad-field"><span className="ad-label">Drawer width</span><select className="ad-select" value={navigation.drawer.widthMode} onChange={event=>updateDrawer({widthMode:event.target.value as typeof navigation.drawer.widthMode})}><option value="75%">75%</option><option value="80%">80%</option><option value="custom">Custom px</option></select></label>
              {navigation.drawer.widthMode==='custom'&&<label className="ad-field"><span className="ad-label">Custom width (px, capped to 80vw)</span><input className="ad-input" type="number" min="240" max="320" value={navigation.drawer.customWidthPx} onChange={event=>updateDrawer({customWidthPx:Math.max(240,Math.min(320,Number(event.target.value)||240))})}/></label>}
             <label className="ad-field"><span className="ad-label">Background</span><select className="ad-select" value={navigation.drawer.backgroundMode} onChange={event=>updateDrawer({backgroundMode:event.target.value as typeof navigation.drawer.backgroundMode})}><option value="solid">Solid</option><option value="gradient">Gradient</option><option value="cream">Soft cream</option></select></label>
             {navigation.drawer.backgroundMode==='solid'&&<label className="ad-field"><span className="ad-label">Drawer color</span><input className="ad-input" type="color" value={navigation.drawer.backgroundColor} onChange={event=>updateDrawer({backgroundColor:event.target.value})}/></label>}
           </div>
           {navigation.drawer.backgroundMode==='gradient'&&<div className="ad-form-row"><label className="ad-field"><span className="ad-label">Gradient start</span><input className="ad-input" type="color" value={navigation.drawer.gradientStart} onChange={event=>updateDrawer({gradientStart:event.target.value})}/></label><label className="ad-field"><span className="ad-label">Gradient end</span><input className="ad-input" type="color" value={navigation.drawer.gradientEnd} onChange={event=>updateDrawer({gradientEnd:event.target.value})}/></label></div>}
           <div className="ad-form-row"><label className="ad-checkline"><input type="checkbox" checked={navigation.drawer.showSearch} onChange={event=>updateDrawer({showSearch:event.target.checked})}/> Show in-drawer search</label><label className="ad-checkline"><input type="checkbox" checked={navigation.drawer.showCategories} onChange={event=>updateDrawer({showCategories:event.target.checked})}/> Show collapsible categories</label></div>
             <div className="ad-form-row"><label className="ad-field"><span className="ad-label">Icon style</span><select className="ad-select" value={navigation.drawer.iconStyle} onChange={event=>updateDrawer({iconStyle:event.target.value as typeof navigation.drawer.iconStyle})}><option value="minimal">Minimal line</option><option value="circle">Soft circle</option><option value="none">No icons</option></select></label></div>
            <div className="ad-menu-list">{renderList(drawerItems,true,updateDrawerItems)}</div>
            <button className="ad-btn" type="button" onClick={()=>updateDrawerItems([...drawerItems,newItem('drawer',drawerItems.length,'tag')])} data-testid="button-add-drawer-link"><Plus size={13}/> Add menu item</button>
         </div></section>
       </>}
     {message&&<p role={message.startsWith('Save failed:')?'alert':'status'} className={`${message.startsWith('Save failed:')?'ad-error':'ad-help'} ad-feedback`}>{message}</p>}
  </>;
}
