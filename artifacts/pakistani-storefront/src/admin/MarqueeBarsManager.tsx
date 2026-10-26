import { useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { useAdminStore, type MarqueeBar } from '../context/AdminContext';

const emptyBar=(id:string):MarqueeBar=>({id,text:'',visible:true,position:'top',style:'classic',backgroundColor:'#6b2447',textColor:'#fffaf4',speedSeconds:24,icon:'',centerBadge:'',pageMode:'all',pagePaths:[],customSectionId:'hero'});
const styles:{value:MarqueeBar['style'];label:string}[]=[
  {value:'classic',label:'Classic full-width strip'},{value:'pill',label:'Rounded pill'},{value:'floating',label:'Floating banner'},
  {value:'neon',label:'Glowing neon border'},{value:'minimal',label:'Minimal thin line'},{value:'gradient',label:'Gradient strip'},
  {value:'split',label:'Split badge style'},{value:'outline',label:'Outline border'},{value:'wavy',label:'Wavy / curved banner'},
  {value:'slanted-ribbon',label:'Slanted ribbon'},{value:'dual-border',label:'Dual-layer border'},{value:'glass',label:'Glassmorphism card'},
];

export default function MarqueeBarsManager({embedded=false}:{embedded?:boolean}){
  const {data,setData,flush}=useAdminStore();
  const [feedback,setFeedback]=useState('');
  const update=(id:string,patch:Partial<MarqueeBar>)=>setData(previous=>({...previous,content:{...previous.content,marqueeBars:previous.content.marqueeBars.map(bar=>bar.id===id?{...bar,...patch}:bar)}}));
  const add=()=>setData(previous=>({...previous,content:{...previous.content,marqueeBars:[...previous.content.marqueeBars,emptyBar(`marquee-${Date.now()}`)].slice(0,12)}}));
  const save=async()=>{try{const result=await flush('content');setFeedback(result==='local'?'Saved on this device; sync is pending.':'Marquee bars saved.');}catch(error){setFeedback(error instanceof Error?error.message:'Could not save marquee bars.');}};
  return <section className="ad-card" data-testid="marquee-bars-manager">
     <header className="ad-card-head"><div><h2 className="ad-card-title">Marquee / announcement bars</h2><p className="ad-card-note">Create up to 12 scrolling announcements. Each bar can be shown or hidden independently.</p></div><button className="ad-btn" type="button" onClick={add} disabled={data.content.marqueeBars.length>=12}><Plus/> Add marquee</button></header>
    {!data.content.marqueeBars.length?<p className="ad-card-body ad-help">No scrolling bars yet. Add one to create a separate announcement from the standard delivery message.</p>:data.content.marqueeBars.map((bar,index)=><div key={bar.id} className="ad-card-body ad-form-stack border-t border-[#eee8df]" data-testid={`marquee-row-${index}`}>
      <div className="flex flex-wrap items-center justify-between gap-3"><strong className="ad-label">Marquee {index+1}</strong><div className="flex items-center gap-2"><label className="ad-checkline"><input type="checkbox" checked={bar.visible} onChange={event=>update(bar.id,{visible:event.target.checked})}/> Show this bar</label><button type="button" className="ad-btn danger small" aria-label={`Remove marquee ${index+1}`} onClick={()=>setData(previous=>({...previous,content:{...previous.content,marqueeBars:previous.content.marqueeBars.filter(item=>item.id!==bar.id)}}))}><Trash2/> Remove</button></div></div>
      <label className="ad-field"><span className="ad-label">Scrolling text</span><input className="ad-input" maxLength={240} value={bar.text} onChange={event=>update(bar.id,{text:event.target.value})} placeholder="A little note for your customers" /></label>
      <div className="ad-form-row">
        <label className="ad-field"><span className="ad-label">Position</span><select className="ad-select" value={bar.position} onChange={event=>update(bar.id,{position:event.target.value as MarqueeBar['position']})}><option value="top">Top header (above navbar)</option><option value="below-header">Below navbar</option><option value="footer">Footer</option><option value="floating">Floating bottom banner</option><option value="custom">Custom homepage section</option></select></label>
        <label className="ad-field"><span className="ad-label">Style</span><select className="ad-select" value={bar.style} onChange={event=>update(bar.id,{style:event.target.value as MarqueeBar['style']})}>{styles.map(style=><option key={style.value} value={style.value}>{style.label}</option>)}</select></label>
      </div>
      <div className="ad-form-row">
        <label className="ad-field"><span className="ad-label">Page visibility</span><select className="ad-select" value={bar.pageMode} onChange={event=>update(bar.id,{pageMode:event.target.value as MarqueeBar['pageMode']})}><option value="all">All pages</option><option value="home">Homepage only</option><option value="specific">Specific pages</option></select></label>
        <label className="ad-field"><span className="ad-label">Scroll speed: {bar.speedSeconds}s per loop</span><input className="ad-input" type="range" min="8" max="50" value={bar.speedSeconds} onChange={event=>update(bar.id,{speedSeconds:Number(event.target.value)})}/></label>
      </div>
      {bar.pageMode==='specific'&&<label className="ad-field"><span className="ad-label">Page paths (comma-separated)</span><input className="ad-input" value={bar.pagePaths.join(', ')} onChange={event=>update(bar.id,{pagePaths:event.target.value.split(',').map(path=>path.trim()).filter(path=>path.startsWith('/')&&!path.startsWith('//')).slice(0,30)})} placeholder="/about, /policies/shipping"/></label>}
      {bar.position==='custom'&&<label className="ad-field"><span className="ad-label">Homepage section</span><select className="ad-select" value={bar.customSectionId} onChange={event=>update(bar.id,{customSectionId:event.target.value})}>{data.content.homeSections.map(section=><option key={section.id} value={section.id}>{section.headingOverride||section.id}</option>)}</select></label>}
      <div className="ad-form-row">
        <label className="ad-field"><span className="ad-label">Emoji / icon (optional)</span><input className="ad-input" maxLength={16} value={bar.icon} onChange={event=>update(bar.id,{icon:event.target.value})} placeholder="✨"/></label>
        {bar.style==='wavy'&&<label className="ad-field"><span className="ad-label">Centered badge (optional)</span><input className="ad-input" maxLength={40} value={bar.centerBadge} onChange={event=>update(bar.id,{centerBadge:event.target.value})} placeholder="EID SPECIAL"/></label>}
        <div className="ad-form-row"><label className="ad-field"><span className="ad-label">Banner background</span><input className="ad-input h-10 p-1" type="color" value={bar.backgroundColor} onChange={event=>update(bar.id,{backgroundColor:event.target.value})}/></label><label className="ad-field"><span className="ad-label">Banner text</span><input className="ad-input h-10 p-1" type="color" value={bar.textColor} onChange={event=>update(bar.id,{textColor:event.target.value})}/></label></div>
      </div>
    </div>)}
     {!embedded&&<footer className="ad-card-body flex flex-wrap items-center gap-3 border-t border-[#eee8df]"><button type="button" className="ad-btn primary" onClick={()=>void save()}><Save/> Save marquee bars</button>{feedback&&<span role="status" className="ad-help">{feedback}</span>}</footer>}
  </section>;
}
