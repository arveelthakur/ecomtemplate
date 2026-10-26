import { normalizeCatalogBrowsingSettings, useAdminStore } from '../context/AdminContext';

function Toggle({label,checked,onChange,testId}:{label:string;checked:boolean;onChange:(value:boolean)=>void;testId:string}){
  return <label className="ad-checkline"><input type="checkbox" checked={checked} onChange={event=>onChange(event.target.checked)} data-testid={testId}/><span>{label}</span></label>;
}

export default function CatalogToolbarControls(){
  const {data,setData}=useAdminStore();
  const toolbar=normalizeCatalogBrowsingSettings(data.settings?.catalogBrowsing).toolbar;
  const update=(patch:Partial<typeof toolbar>)=>setData(previous=>({
    ...previous,
    settings:{...previous.settings,catalogBrowsing:{
      ...normalizeCatalogBrowsingSettings(previous.settings?.catalogBrowsing),
      toolbar:{...normalizeCatalogBrowsingSettings(previous.settings?.catalogBrowsing).toolbar,...patch},
    }},
  }));
  return <section className="ad-card" data-testid="catalog-toolbar-manager">
    <header className="ad-card-head"><div><h2 className="ad-card-title">Filter, sort &amp; view toolbar</h2><p className="ad-card-note">Choose which shopping controls appear. All frame, color, spacing, corner, and icon styling follows the Global Master Control.</p></div></header>
    <div className="ad-card-body ad-form-stack">
      <div className="ad-field"><span className="ad-label">Visible toolbar controls</span>
        <Toggle label="Filter button" checked={toolbar.showFilterButton} onChange={showFilterButton=>update({showFilterButton})} testId="switch-toolbar-filter"/>
        <Toggle label="Sort dropdown" checked={toolbar.showSortDropdown} onChange={showSortDropdown=>update({showSortDropdown})} testId="switch-toolbar-sort"/>
        <Toggle label="Grid / list view switcher" checked={toolbar.showViewSwitcher} onChange={showViewSwitcher=>update({showViewSwitcher})} testId="switch-toolbar-view"/>
        <Toggle label="Grid column count toggles" checked={toolbar.showColumnLayoutSwitcher} onChange={showColumnLayoutSwitcher=>update({showColumnLayoutSwitcher})} testId="switch-toolbar-columns"/>
      </div>
      <p className="ad-help">Changes save with the master settings; no separate toolbar styling overrides are needed.</p>
    </div>
  </section>;
}
