import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useAdminStore, type MilestoneBadge, type MilestoneSectionSettings, type StoreMilestoneStat } from '../context/AdminContext';

export default function StoreStatisticsManager(){
  const {data,setData}=useAdminStore();
  const rows=data.content.milestoneStats;
  const badges=data.content.milestoneBadges;
  const settings=data.content.milestoneSettings;
  const globalStyle=rows[0]??{iconColor:'#6b2447',valueColor:'#6b2447',labelColor:'#71665e',iconSizePx:48,valueSizePx:68,labelSizePx:12};
  const patchContent=<K extends keyof typeof data.content>(key:K,value:(typeof data.content)[K])=>setData(previous=>({...previous,content:{...previous.content,[key]:value}}));
  const update=(id:string,patch:Partial<StoreMilestoneStat>)=>patchContent('milestoneStats',rows.map(row=>row.id===id?{...row,...patch}:row));
  const updateSettings=(patch:Partial<MilestoneSectionSettings>)=>patchContent('milestoneSettings',{...settings,...patch});
  const add=()=>patchContent('milestoneStats',[...rows,{id:`milestone-${Date.now()}`,value:'',suffix:'',label:'',enabled:false,order:rows.length,valueSource:'manual' as const,icon:'package',cardBackgroundColor:'#fdfbf7',borderColor:'#e8e3dd',borderRadiusPx:16,iconColor:globalStyle.iconColor,valueColor:globalStyle.valueColor,labelColor:globalStyle.labelColor,iconSizePx:globalStyle.iconSizePx,valueSizePx:globalStyle.valueSizePx,labelSizePx:globalStyle.labelSizePx}].slice(0,8));
  const move=(id:string,direction:-1|1)=>{const index=rows.findIndex(row=>row.id===id);const target=index+direction;if(index<0||target<0||target>=rows.length)return;const next=[...rows];[next[index],next[target]]=[next[target],next[index]];patchContent('milestoneStats',next.map((row,order)=>({...row,order})));};
  const remove=(id:string)=>patchContent('milestoneStats',rows.filter(row=>row.id!==id).map((row,order)=>({...row,order})));
  const addBadge=()=>patchContent('milestoneBadges',[...badges,{id:`milestone-badge-${Date.now()}`,label:'',icon:'shield-check',enabled:false,order:badges.length}].slice(0,8));
  const updateBadge=(id:string,patch:Partial<MilestoneBadge>)=>patchContent('milestoneBadges',badges.map(badge=>badge.id===id?{...badge,...patch}:badge));
  const moveBadge=(id:string,direction:-1|1)=>{const index=badges.findIndex(item=>item.id===id);const target=index+direction;if(index<0||target<0||target>=badges.length)return;const next=[...badges];[next[index],next[target]]=[next[target],next[index]];patchContent('milestoneBadges',next.map((item,order)=>({...item,order})));};
  const section=data.content.homeSections.find(item=>item.id==='statistics');
  const setVisible=(visible:boolean)=>patchContent('homeSections',data.content.homeSections.map(item=>item.id==='statistics'?{...item,visible}:item));
  return <div className="ad-form-stack" data-testid="store-statistics-manager">
    <h3 className="ad-card-title">Store statistics / milestones</h3>
     <p className="ad-help">Add optional store milestones here. Only enabled milestones with content are shown on the storefront.</p>
    <label className="ad-checkline"><input type="checkbox" checked={section?.visible!==false} onChange={event=>setVisible(event.target.checked)} data-testid="toggle-statistics-section"/> Publish statistics section</label>
    <section className="ad-card"><header className="ad-card-head"><div><h4 className="ad-card-title">Section copy</h4></div></header><div className="ad-card-body ad-form-stack">
      <div className="ad-form-row">{([
        ['eyebrow','Eyebrow',80],['title','Main heading',120],
      ] as const).map(([key,label,max])=><label key={key} className="ad-field"><span className="ad-label">{label}</span><input className="ad-input" maxLength={max} value={settings[key]} onChange={event=>updateSettings({[key]:event.target.value})} data-testid={`input-statistics-${key}`}/></label>)}</div>
      <label className="ad-field"><span className="ad-label">Supporting heading</span><input className="ad-input" maxLength={160} value={settings.subheading} onChange={event=>updateSettings({subheading:event.target.value})} data-testid="input-statistics-subheading"/></label>
      <label className="ad-field"><span className="ad-label">Description</span><textarea className="ad-input" maxLength={360} value={settings.description} onChange={event=>updateSettings({description:event.target.value})} data-testid="input-statistics-description"/></label>
    </div></section>
     <section className="ad-card" data-testid="store-statistics-layout"><header className="ad-card-head"><div><h4 className="ad-card-title">Card layout</h4><p className="ad-card-note">Double Row places two cards across; Double Column fills two vertical columns.</p></div></header><div className="ad-card-body">
       <label className="ad-field"><span className="ad-label">Display arrangement</span><select className="ad-select" value={settings.layout} onChange={event=>updateSettings({layout:event.target.value as MilestoneSectionSettings['layout']})} data-testid="select-statistics-layout"><option value="single-row">Single Row</option><option value="single-column">Single Column</option><option value="double-row">Double Row</option><option value="double-column">Double Column</option></select></label>
     </div></section>
    <section className="ad-card" data-testid="store-statistics-global-style"><header className="ad-card-head"><div><h4 className="ad-card-title">Card appearance</h4><p className="ad-card-note">Colors, typography, corner treatment, and icon scale inherit from Global Master Control.</p></div></header></section>
    <section className="ad-card"><header className="ad-card-head"><div><h4 className="ad-card-title">Statistic cards</h4><p className="ad-card-note">Enter accurate values or derive the published product count from live catalog data.</p></div><button type="button" className="ad-btn" disabled={rows.length>=8} onClick={add} data-testid="button-add-store-statistic"><Plus size={14}/> Add statistic</button></header><div className="ad-card-body ad-form-stack">
      {rows.map((row,index)=><div key={row.id} className="ad-card" data-testid={`store-statistic-row-${index}`}><div className="ad-card-body ad-form-stack">
        <div className="ad-toolbar"><strong>Statistic {index+1}</strong><label className="ad-checkline"><input type="checkbox" checked={row.enabled} onChange={event=>update(row.id,{enabled:event.target.checked})} data-testid={`toggle-store-stat-enabled-${index}`}/> Published</label><button type="button" className="ad-btn" aria-label={`Move statistic ${index+1} up`} disabled={index===0} onClick={()=>move(row.id,-1)}><ArrowUp size={14}/></button><button type="button" className="ad-btn" aria-label={`Move statistic ${index+1} down`} disabled={index===rows.length-1} onClick={()=>move(row.id,1)}><ArrowDown size={14}/></button><button type="button" className="ad-btn danger" aria-label={`Remove statistic ${index+1}`} onClick={()=>remove(row.id)}><Trash2 size={14}/></button></div>
        <div className="ad-form-row"><label className="ad-field"><span className="ad-label">Value source</span><select className="ad-select" value={row.valueSource} onChange={event=>update(row.id,{valueSource:event.target.value as StoreMilestoneStat['valueSource']})}><option value="manual">Manual verified value</option><option value="products">Live published product count</option></select></label>
          <label className="ad-field"><span className="ad-label">Value</span><input className="ad-input" value={row.value} maxLength={40} disabled={row.valueSource==='products'} onChange={event=>update(row.id,{value:event.target.value})} placeholder="Enter a verified figure" data-testid={`input-store-stat-value-${index}`}/></label>
          <label className="ad-field"><span className="ad-label">Suffix</span><input className="ad-input" value={row.suffix} maxLength={12} onChange={event=>update(row.id,{suffix:event.target.value})} placeholder="+" data-testid={`input-store-stat-suffix-${index}`}/></label>
          <label className="ad-field"><span className="ad-label">Label</span><input className="ad-input" value={row.label} maxLength={80} onChange={event=>update(row.id,{label:event.target.value})} placeholder="Products for sale" data-testid={`input-store-stat-label-${index}`}/></label>
          <label className="ad-field"><span className="ad-label">Icon</span><select className="ad-select" value={row.icon} onChange={event=>update(row.id,{icon:event.target.value})} data-testid={`select-store-stat-icon-${index}`}><option value="package">Package</option><option value="heart">Heart</option><option value="star">Star</option><option value="award">Award</option><option value="truck">Delivery truck</option><option value="shield-check">Shield check</option><option value="users">People</option><option value="leaf">Leaf</option><option value="lock">Lock</option><option value="sparkles">Sparkles</option></select></label>
        </div>
      </div></div>)}
      {!rows.length&&<p className="ad-help">No statistic cards yet. Add verified figures before publishing.</p>}
    </div></section>
    <section className="ad-card"><header className="ad-card-head"><div><h4 className="ad-card-title">Optional trust badges</h4><p className="ad-card-note">No claims are enabled by default. Add only claims you can substantiate.</p></div><button type="button" className="ad-btn" disabled={badges.length>=8} onClick={addBadge} data-testid="button-add-statistics-badge"><Plus size={14}/> Add badge</button></header><div className="ad-card-body ad-form-stack">
      {badges.map((badge,index)=><div key={badge.id} className="ad-form-row items-end" data-testid={`statistics-badge-row-${index}`}>
        <label className="ad-checkline"><input type="checkbox" checked={badge.enabled} onChange={event=>updateBadge(badge.id,{enabled:event.target.checked})} data-testid={`toggle-statistics-badge-${index}`}/> Published</label>
        <label className="ad-field"><span className="ad-label">Badge label</span><input className="ad-input" maxLength={100} value={badge.label} onChange={event=>updateBadge(badge.id,{label:event.target.value})} data-testid={`input-statistics-badge-label-${index}`}/></label>
        <label className="ad-field"><span className="ad-label">Icon</span><select className="ad-select" value={badge.icon} onChange={event=>updateBadge(badge.id,{icon:event.target.value})} data-testid={`select-statistics-badge-icon-${index}`}><option value="shield-check">Shield check</option><option value="leaf">Leaf</option><option value="lock">Lock</option><option value="package">Package</option><option value="heart">Heart</option><option value="star">Star</option></select></label>
        <button type="button" className="ad-btn" aria-label={`Move badge ${index+1} up`} disabled={index===0} onClick={()=>moveBadge(badge.id,-1)}><ArrowUp size={14}/></button><button type="button" className="ad-btn" aria-label={`Move badge ${index+1} down`} disabled={index===badges.length-1} onClick={()=>moveBadge(badge.id,1)}><ArrowDown size={14}/></button><button type="button" className="ad-btn danger" aria-label={`Remove badge ${index+1}`} onClick={()=>patchContent('milestoneBadges',badges.filter(item=>item.id!==badge.id).map((item,order)=>({...item,order})))}><Trash2 size={14}/></button>
      </div>)}
      {!badges.length&&<p className="ad-help">No trust claims are published. Add verified badges if applicable.</p>}
    </div></section>
  </div>;
}
