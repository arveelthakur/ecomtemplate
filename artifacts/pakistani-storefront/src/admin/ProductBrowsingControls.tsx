import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import {
  catalogFilterIconOptions,
  defaultCatalogFilterSections,
  normalizeCatalogBrowsingSettings,
  type CatalogFilterKind,
  type CatalogFilterSection,
} from '../context/AdminContext';
import { useAdminStore } from '../context/AdminContext';
import AdminSaveButton from './AdminSaveButton';

function SettingSwitch({
  label,
  description,
  checked,
  onChange,
  testId,
}: {
  label:string;
  description:string;
  checked:boolean;
  onChange:(value:boolean)=>void;
  testId:string;
}) {
  return <div className="ad-browse-setting">
    <div className="ad-browse-setting-copy">
      <div className="ad-item-name">{label}</div>
      <div className="ad-item-sub">{description}</div>
    </div>
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      onClick={()=>onChange(!checked)}
      className={`ad-browse-switch${checked?' on':''}`}
      data-testid={testId}
    >
      <span />
    </button>
  </div>;
}

export default function ProductBrowsingControls() {
  const { data, setData }=useAdminStore();
  const browsing=normalizeCatalogBrowsingSettings(data.settings?.catalogBrowsing);
  const [newKind,setNewKind]=useState<CatalogFilterKind|'none'>('price');
  const editableSections=browsing.filterSections.filter(section=>section.kind!=='categories');
  const availableToAdd=defaultCatalogFilterSections.filter(section=>section.kind!=='categories'&&!browsing.filterSections.some(existing=>existing.kind===section.kind));

  useEffect(()=>{
    if(!availableToAdd.some(section=>section.kind===newKind))setNewKind(availableToAdd[0]?.kind??'none');
  },[availableToAdd,newKind]);

  const updateBrowsing=(update:(current:typeof browsing)=>typeof browsing)=>{
    setData(previous=>({
      ...previous,
      settings:{
        ...previous.settings,
        catalogBrowsing:update(normalizeCatalogBrowsingSettings(previous.settings?.catalogBrowsing)),
      },
    }));
  };

  const updateVisibility=(kind:CatalogFilterKind,value:boolean)=>{
    updateBrowsing(current=>({...current,filters:{...current.filters,[kind]:value}}));
  };
  const updateSection=(id:string,patch:Partial<CatalogFilterSection>)=>{
    updateBrowsing(current=>({
      ...current,
      filterSections:current.filterSections.map(section=>section.id===id?{...section,...patch}:section),
    }));
  };
  const moveSection=(id:string,offset:-1|1)=>{
    updateBrowsing(current=>{
      const visible=current.filterSections.filter(section=>section.kind!=='categories');
      const visibleIndex=visible.findIndex(section=>section.id===id);
      const target=visible[visibleIndex+offset];
      if(visibleIndex<0||!target)return current;
      const from=current.filterSections.findIndex(section=>section.id===id);
      const to=current.filterSections.findIndex(section=>section.id===target.id);
      const filterSections=[...current.filterSections];
      [filterSections[from],filterSections[to]]=[filterSections[to],filterSections[from]];
      return {...current,filterSections};
    });
  };
  const removeSection=(id:string)=>{
    updateBrowsing(current=>{
      const removed=current.filterSections.find(section=>section.id===id);
      return {
        ...current,
        filterSections:current.filterSections.filter(section=>section.id!==id),
        filters:removed?{...current.filters,[removed.kind]:false}:current.filters,
      };
    });
  };
  const addSection=()=>{
    if(newKind==='none')return;
    const section=defaultCatalogFilterSections.find(item=>item.kind===newKind);
    if(!section)return;
    updateBrowsing(current=>({
      ...current,
      filterSections:[...current.filterSections,{...section}],
      filters:{...current.filters,[newKind]:true},
    }));
  };
  return <div className="ad-form-stack">
    <section className="ad-card">
      <header className="ad-card-head">
        <div>
          <h2 className="ad-card-title">Filter management</h2>
          <div className="ad-card-note">Control shopper-facing accordion sections, their order, icons and type sizes.</div>
        </div>
      </header>
      <div className="ad-card-body">
        <div className="ad-toolbar">
          <select
            className="ad-select"
            aria-label="Filter section to add"
            value={newKind}
            disabled={availableToAdd.length===0}
            onChange={event=>setNewKind(event.target.value as CatalogFilterKind|'none')}
            data-testid="select-add-filter-section"
            style={{maxWidth:260}}
          >
            {availableToAdd.length===0?<option value="none">All filter sections are added</option>:availableToAdd.map(section=><option key={section.kind} value={section.kind}>{section.title}</option>)}
          </select>
          <button type="button" className="ad-btn primary" onClick={addSection} disabled={availableToAdd.length===0} data-testid="button-add-filter-section">
            <Plus/> Add filter section
          </button>
        </div>

        <div className="space-y-4">
          {editableSections.map((section,index)=>{
            const enabled=browsing.filters[section.kind];
            const visibleIndex=editableSections.findIndex(item=>item.id===section.id);
            return <section key={section.id} className="rounded-md border border-[#e8dfd4] bg-[#fffdf9] p-3" data-testid={`filter-section-${section.kind}`}>
              <div className="mb-3 flex items-center gap-2 border-b border-[#eee7df] pb-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#f2ece4]">
                </span>
                <div className="min-w-0 flex-1">
                  <div className="ad-item-name">{section.title}</div>
                  <div className="ad-item-sub">{section.kind==='topRated'?'Filters to products rated 4.5 stars or higher.':section.kind==='categories'?'Uses the current active product categories.':`Controls the ${section.kind==='alphabetical'?'A–Z sorting':'shopper'} accordion.`}</div>
                </div>
                 <button type="button" className="ad-icon-btn" aria-label={`Move ${section.title} up`} onClick={()=>moveSection(section.id,-1)} disabled={visibleIndex===0} data-testid={`button-filter-section-up-${section.kind}`}><ArrowUp/></button>
                 <button type="button" className="ad-icon-btn" aria-label={`Move ${section.title} down`} onClick={()=>moveSection(section.id,1)} disabled={visibleIndex===editableSections.length-1} data-testid={`button-filter-section-down-${section.kind}`}><ArrowDown/></button>
                <button type="button" className="ad-icon-btn" aria-label={`Remove ${section.title}`} onClick={()=>removeSection(section.id)} data-testid={`button-filter-section-remove-${section.kind}`}><Trash2/></button>
              </div>

              <SettingSwitch
                label={`Show ${section.title}`}
                description="Show or hide this accordion on the collection page."
                checked={enabled}
                onChange={value=>updateVisibility(section.kind,value)}
                testId={`switch-product-filter-${section.kind==='topRated'?'top-rated':section.kind}`}
              />

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="ad-field">
                  <span className="ad-label">Accordion heading</span>
                  <input className="ad-input" value={section.title} onChange={event=>updateSection(section.id,{title:event.target.value})} aria-label={`Heading for ${section.title}`} data-testid={`input-filter-heading-${section.kind}`}/>
                </label>
                <label className="ad-field">
                  <span className="ad-label">Accordion icon</span>
                  <select className="ad-select" value={section.icon} onChange={event=>updateSection(section.id,{icon:event.target.value})} aria-label={`Icon for ${section.title}`} data-testid={`select-filter-icon-${section.kind}`}>
                    {catalogFilterIconOptions.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
              </div>
            </section>;
          })}
          {editableSections.length===0&&<div className="ad-empty"><h3>No filter sections</h3><p>Add a filter accordion to make one available in the collection drawer. Category filtering is managed from Categories.</p></div>}
        </div>
        <p className="ad-notice" style={{marginTop:16}}>Changes are a local draft until saved. Removed sections can be added again from the selector above.</p>
        <AdminSaveButton scope="settings.catalogBrowsing" testId="button-save-catalog-browsing"/>
      </div>
    </section>

  </div>;
}
