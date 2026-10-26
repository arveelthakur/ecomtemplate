import { Plus, Trash2 } from 'lucide-react';
import { useAdminStore, type PromiseCard, type TrustBadgeDisplaySettings } from '../context/AdminContext';

const icons=['shield','truck','phone','leaf','sparkle','award','check','lock','rotate','pin'];

export default function HomeTrustBadgesManager(){
  const {data,setData}=useAdminStore();
  const patchContent=(patch:Partial<typeof data.content>)=>setData(previous=>({...previous,content:{...previous.content,...patch}}));
  const patchBadge=(id:string,patch:Partial<PromiseCard>)=>patchContent({promiseCards:data.content.promiseCards.map(badge=>badge.id===id?{...badge,...patch}:badge)});
  const add=()=>patchContent({promiseCards:[...data.content.promiseCards,{id:`promise-${Date.now()}`,title:'',detail:'',icon:'shield',active:true}]});
  const display=data.content.trustBadgeDisplay;
  const updateDisplay=(patch:Partial<TrustBadgeDisplaySettings>)=>patchContent({trustBadgeDisplay:{...display,...patch}});
  return <section className="ad-card" data-testid="homepage-trust-badges-manager">
    <header className="ad-card-head"><div><h3 className="ad-card-title">Trust badges & guarantees</h3><p className="ad-card-note">Manage the badges and responsive layouts shown on the storefront.</p></div><button className="ad-btn small" type="button" onClick={add} data-testid="button-add-trust-badge"><Plus size={14}/> Add badge</button></header>
    <div className="ad-card-body ad-form-stack">
      {!data.content.promiseCards.length&&<p className="ad-help">No trust badges yet. Add one to share delivery, payment, support or quality details.</p>}
      {data.content.promiseCards.map((badge,index)=><details key={badge.id} className="ad-menu-item" data-testid={`row-trust-badge-${badge.id}`}>
        <summary className="ad-menu-item-summary"><span><strong>{badge.title||`Trust badge ${index+1}`}</strong><small>{badge.detail||'Add a short supporting detail'}</small></span><span className={`ad-status ${badge.active===false?'rose':'green'}`}>{badge.active===false?'Hidden':'Active'}</span></summary>
        <div className="ad-menu-item-editor ad-form-stack">
          <label className="ad-field"><span className="ad-label">Title</span><input className="ad-input" maxLength={80} value={badge.title} onChange={event=>patchBadge(badge.id,{title:event.target.value})} data-testid={`input-trust-badge-title-${badge.id}`}/></label>
          <label className="ad-field"><span className="ad-label">Subtitle</span><textarea className="ad-input" rows={2} maxLength={180} value={badge.detail} onChange={event=>patchBadge(badge.id,{detail:event.target.value})} data-testid={`input-trust-badge-detail-${badge.id}`}/></label>
          <div className="ad-form-row"><label className="ad-field"><span className="ad-label">Icon</span><select className="ad-select" value={icons.includes(badge.icon)?badge.icon:'check'} onChange={event=>patchBadge(badge.id,{icon:event.target.value})}><option value="shield">Shield</option><option value="truck">Truck</option><option value="phone">Phone</option><option value="leaf">Leaf</option><option value="sparkle">Sparkle</option><option value="award">Award</option><option value="check">Check circle</option><option value="lock">Lock</option><option value="rotate">Returns</option><option value="pin">Location pin</option></select></label>
            <label className="ad-checkline"><input type="checkbox" checked={badge.active!==false} onChange={event=>patchBadge(badge.id,{active:event.target.checked})} data-testid={`toggle-trust-badge-${badge.id}`}/> Show badge</label>
            <button className="ad-btn danger small" type="button" onClick={()=>patchContent({promiseCards:data.content.promiseCards.filter(item=>item.id!==badge.id)})} aria-label={`Delete ${badge.title||`trust badge ${index+1}`}`}><Trash2 size={14}/> Remove</button>
          </div>
        </div>
      </details>)}
    </div>
    <div className="ad-card-body ad-form-stack border-t border-[#eee8df]" data-testid="trust-badge-layout-settings">
      <h4 className="ad-card-title">Badge layout</h4>
      <div className="ad-form-row"><label className="ad-field"><span className="ad-label">Desktop layout</span><select className="ad-select" value={display.desktopLayout} onChange={event=>updateDisplay({desktopLayout:event.target.value as TrustBadgeDisplaySettings['desktopLayout']})} data-testid="select-trust-badge-desktop-layout"><option value="single-row">Single row</option><option value="grid-2x2">2 × 2 grid</option></select></label>
        <label className="ad-field"><span className="ad-label">Mobile layout</span><select className="ad-select" value={display.mobileLayout} onChange={event=>updateDisplay({mobileLayout:event.target.value as TrustBadgeDisplaySettings['mobileLayout']})} data-testid="select-trust-badge-mobile-layout"><option value="single-row">Single row</option><option value="grid-2x2">2 × 2 grid</option><option value="scroll">Scrollable row</option><option value="stack">Vertical stack</option><option value="grid-3x2">3 × 2 grid</option><option value="compact-4">Compact 4 badges</option></select></label>
      </div>
      
    </div>
  </section>;
}
