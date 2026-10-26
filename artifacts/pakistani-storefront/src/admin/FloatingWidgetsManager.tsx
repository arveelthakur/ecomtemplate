import { useRef } from 'react';
import { useAdminStore, type FloatingActionWidget } from '../context/AdminContext';
import { floatingWidgetPresets, floatingWidgetShapes } from '../utils/floatingWidgets';
import { floatingWidgetIconOptions } from '../utils/floatingWidgetIcons';
import AdminSaveButton from './AdminSaveButton';
import ImageUpload from '../components/ImageUpload';
import { cleanupUnusedWidgetImage } from '../utils/images';

const positions:FloatingActionWidget['position'][]=['bottom-right','bottom-left','bottom-center','middle-right','middle-left'];
const animations:FloatingActionWidget['animation'][]=['pulse','bounce','glow','static'];
const channels=['whatsapp','instagram','facebook','x','phone','messenger'] as const;
function createWidget(kind:FloatingActionWidget['kind']):FloatingActionWidget{
  const id=`floating-${crypto.randomUUID()}`;
  const preset=floatingWidgetPresets.find(item=>item.kind===kind)||floatingWidgetPresets[3];
  return {
    id,kind,label:preset.label,target:preset.target,icon:preset.icon,
    color:preset.color,visible:true,position:'bottom-right',animation:'static',shape:'pill',channel:'whatsapp',
    desktopOffsetX:16,desktopOffsetY:16,mobileOffsetX:16,mobileOffsetY:0,visibleOnRoutes:[],
    offerAction:'popup',categoryId:'',countdownEnabled:false,expiresAt:'',
  };
}
export default function FloatingWidgetsManager(){
  const {data,setData}=useAdminStore();
  const widgets=data.content.floatingWidgets.widgets;
  const pendingImageCleanup=useRef(new Set<string>());
  const update=(id:string,patch:Partial<FloatingActionWidget>)=>setData(previous=>({...previous,content:{...previous.content,floatingWidgets:{...previous.content.floatingWidgets,widgets:previous.content.floatingWidgets.widgets.map(widget=>{
    if(widget.id!==id)return widget;
    if(Object.prototype.hasOwnProperty.call(patch,'customImageUrl')&&widget.customImageUrl&&widget.customImageUrl!==patch.customImageUrl){
      pendingImageCleanup.current.add(widget.customImageUrl);
    }
    return {...widget,...patch};
  })}}}));
  const add=(kind:FloatingActionWidget['kind'])=>setData(previous=>({...previous,content:{...previous.content,floatingWidgets:{...previous.content.floatingWidgets,widgets:[...previous.content.floatingWidgets.widgets,createWidget(kind)]}}}));
  const remove=(id:string)=>setData(previous=>({...previous,content:{...previous.content,floatingWidgets:{...previous.content.floatingWidgets,widgets:previous.content.floatingWidgets.widgets.filter(widget=>{
    if(widget.id!==id)return true;
    if(widget.customImageUrl)pendingImageCleanup.current.add(widget.customImageUrl);
    return false;
  })}}}));
  const cleanUnusedImages=async()=>{
    for(const url of pendingImageCleanup.current){
      try{
        const result=await cleanupUnusedWidgetImage(url);
        if(result==='deleted'||result==='referenced')pendingImageCleanup.current.delete(url);
      }catch(error){
        console.warn('[floating-widgets] Could not delete an unused widget image.',error);
      }
    }
  };
  const move=(index:number,direction:-1|1)=>{
    const target=index+direction;if(target<0||target>=widgets.length)return;
    const next=[...widgets];[next[index],next[target]]=[next[target],next[index]];
    setData(previous=>({...previous,content:{...previous.content,floatingWidgets:{...previous.content.floatingWidgets,widgets:next}}}));
  };
  return <div className="ad-form-stack" data-testid="floating-widgets-manager">
      <div className="ad-card-body ad-notice">Widgets are saved in storefront content settings. Add a direct chat, quick FAQ, coupon, flash sale, review link, or custom action. Mobile offsets are measured above the fixed bottom navigation.</div>
    <div className="ad-toolbar">
      {floatingWidgetPresets.map(({kind,label})=><button key={kind} className="ad-btn" type="button" onClick={()=>add(kind)} data-testid={`button-add-floating-${kind}`}>+ {kind==='contact'?'WhatsApp chat':label}</button>)}
    </div>
    {widgets.length===0&&<div className="ad-empty"><h3>No floating widgets</h3><p>Add a chat shortcut, promotion, FAQ, review link, or custom action.</p></div>}
    {widgets.map((widget,index)=><section className="ad-card" key={widget.id} data-testid={`card-floating-widget-${widget.id}`}>
      <header className="ad-card-head"><div><h3 className="ad-card-title">{widget.label||'Floating widget'}</h3><p className="ad-card-note">{widget.kind} · order {index+1}</p></div><div style={{display:'flex',gap:6,alignItems:'center'}}>
        <button type="button" className="ad-icon-btn" aria-label="Move widget up" onClick={()=>move(index,-1)} disabled={index===0}>↑</button><button type="button" className="ad-icon-btn" aria-label="Move widget down" onClick={()=>move(index,1)} disabled={index===widgets.length-1}>↓</button><button type="button" className="ad-icon-btn" aria-label="Delete widget" onClick={()=>remove(widget.id)}>×</button>
      </div></header>
      <div className="ad-card-body ad-form-stack">
        <div className="ad-form-row">
          <label className="ad-field"><span className="ad-label">Label</span><input className="ad-input" maxLength={64} value={widget.label} onChange={event=>update(widget.id,{label:event.target.value})}/></label>
          <label className="ad-field"><span className="ad-label">{widget.kind==='contact'&&widget.channel==='whatsapp'?'WhatsApp number or profile URL':widget.kind==='faq'?'FAQ popup destination':'Target URL or route'}</span><input className="ad-input" maxLength={1000} value={widget.target} onChange={event=>update(widget.id,{target:event.target.value})} placeholder={widget.kind==='track-order'?'/track-order':widget.kind==='faq'?'/shop or https://…':'https://… or /shop'}/></label>
        </div>
        <div className="ad-form-row">
          <label className="ad-field"><span className="ad-label">Widget type</span><select className="ad-select" value={widget.kind} onChange={event=>{const kind=event.target.value as FloatingActionWidget['kind'];const preset=floatingWidgetPresets.find(item=>item.kind===kind)!;update(widget.id,{kind,label:preset.label,icon:preset.icon,target:preset.target,color:preset.color});}}>{floatingWidgetPresets.map(({kind,label})=><option key={kind} value={kind}>{kind==='contact'?'Contact / WhatsApp chat':label}</option>)}</select></label>
          {widget.kind==='contact'&&<label className="ad-field"><span className="ad-label">Contact channel</span><select className="ad-select" value={widget.channel||'whatsapp'} onChange={event=>update(widget.id,{channel:event.target.value as typeof channels[number]})}>{channels.map(channel=><option key={channel} value={channel}>{channel==='x'?'X / Twitter':channel[0].toUpperCase()+channel.slice(1)}</option>)}</select></label>}
           <label className="ad-field"><span className="ad-label">Icon</span><select className="ad-select" value={widget.icon} onChange={event=>update(widget.id,{icon:event.target.value})}>{floatingWidgetIconOptions.map(icon=><option key={icon} value={icon}>{icon.replaceAll('-',' ')}</option>)}</select></label>
        </div>
        <div className="ad-form-row">
          <div className="ad-field"><span className="ad-label">Custom image or animated GIF</span><p className="ad-help">Overrides the icon above while set. Animated GIFs are stored without compression so their animation and sharpness are preserved.</p><ImageUpload folder="widgets" onUploaded={url=>update(widget.id,{customImageUrl:url})}/>{widget.customImageUrl&&<div style={{display:'flex',alignItems:'center',gap:12,marginTop:8}}><img src={widget.customImageUrl} alt="" width="48" height="48" style={{objectFit:'contain',borderRadius:8,background:'#f5f0e9'}}/><button type="button" className="ad-btn small" onClick={()=>update(widget.id,{customImageUrl:undefined})} data-testid={`button-remove-floating-image-${widget.id}`}>Remove custom image</button></div>}</div>
        </div>
        <div className="ad-form-row">
          <label className="ad-field"><span className="ad-label">Widget shape</span><select className="ad-select" value={widget.shape||'pill'} onChange={event=>update(widget.id,{shape:event.target.value as FloatingActionWidget['shape']})}>{floatingWidgetShapes.map(shape=><option key={shape} value={shape}>{shape.replaceAll('-',' ')}</option>)}</select></label>
          <label className="ad-field"><span className="ad-label">Position</span><select className="ad-select" value={widget.position} onChange={event=>update(widget.id,{position:event.target.value as FloatingActionWidget['position']})}>{positions.map(position=><option key={position} value={position}>{position.replaceAll('-',' ')}</option>)}</select></label>
          <label className="ad-field"><span className="ad-label">Animation</span><select className="ad-select" value={widget.animation} onChange={event=>update(widget.id,{animation:event.target.value as FloatingActionWidget['animation']})}>{animations.map(animation=><option key={animation} value={animation}>{animation}</option>)}</select></label>
          <label className="ad-field"><span className="ad-label">Button background</span><input className="ad-input" type="color" value={widget.color} onChange={event=>update(widget.id,{color:event.target.value})}/></label>
          <label className="ad-field"><span className="ad-label">Button text / icon</span><input className="ad-input" type="color" value={widget.textColor||'#FDFBF7'} onChange={event=>update(widget.id,{textColor:event.target.value})}/></label>
        </div>
        <div className="ad-form-row">
          <label className="ad-field"><span className="ad-label">Desktop X offset (px)</span><input className="ad-input" type="number" min="0" max="240" value={widget.desktopOffsetX} onChange={event=>update(widget.id,{desktopOffsetX:Number(event.target.value)})}/></label>
          <label className="ad-field"><span className="ad-label">Desktop Y offset (px)</span><input className="ad-input" type="number" min="0" max="240" value={widget.desktopOffsetY} onChange={event=>update(widget.id,{desktopOffsetY:Number(event.target.value)})}/></label>
          <label className="ad-field"><span className="ad-label">Mobile X offset (px)</span><input className="ad-input" type="number" min="0" max="240" value={widget.mobileOffsetX} onChange={event=>update(widget.id,{mobileOffsetX:Number(event.target.value)})}/></label>
          <label className="ad-field"><span className="ad-label">Mobile Y offset (px)</span><input className="ad-input" type="number" min="0" max="240" value={widget.mobileOffsetY} onChange={event=>update(widget.id,{mobileOffsetY:Number(event.target.value)})}/></label>
        </div>
        <label className="ad-field"><span className="ad-label">Show only on these route prefixes (comma-separated; blank means all storefront pages)</span><input className="ad-input" value={widget.visibleOnRoutes.join(', ')} onChange={event=>update(widget.id,{visibleOnRoutes:event.target.value.split(',').map(route=>route.trim()).filter(Boolean).slice(0,30)})} placeholder="/, /shop, /product/"/></label>
        {widget.kind==='offer'&&<div className="ad-form-row">
          <label className="ad-field"><span className="ad-label">Offer click action</span><select className="ad-select" value={widget.offerAction||'popup'} onChange={event=>update(widget.id,{offerAction:event.target.value as NonNullable<FloatingActionWidget['offerAction']>})}><option value="popup">Open offer popup</option><option value="sale-page">Open target route</option><option value="category">Open category</option></select></label>
          <label className="ad-checkline"><input type="checkbox" checked={widget.countdownEnabled===true} onChange={event=>update(widget.id,{countdownEnabled:event.target.checked})}/> Show countdown</label>
          {widget.countdownEnabled&&<label className="ad-field"><span className="ad-label">Offer expires</span><input className="ad-input" type="datetime-local" value={widget.expiresAt||''} onChange={event=>update(widget.id,{expiresAt:event.target.value})}/></label>}
        </div>}
        <label className="ad-checkline"><input type="checkbox" checked={widget.visible} onChange={event=>update(widget.id,{visible:event.target.checked})}/> Show this widget</label>
      </div>
    </section>)}
    <AdminSaveButton scope="content.floatingWidgets" testId="button-save-floating-widgets" onSaved={cleanUnusedImages}/>
  </div>;
}
