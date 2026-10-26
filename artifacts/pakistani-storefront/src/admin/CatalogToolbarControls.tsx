import { normalizeCatalogBrowsingSettings, useAdminStore } from '../context/AdminContext';

function Toggle({label,checked,onChange,testId}:{label:string;checked:boolean;onChange:(value:boolean)=>void;testId:string}){
  return <label className="ad-checkline"><input type="checkbox" checked={checked} onChange={event=>onChange(event.target.checked)} data-testid={testId}/><span>{label}</span></label>;
}

export default function CatalogToolbarControls(){
  const {data,setData}=useAdminStore();
  const toolbar=normalizeCatalogBrowsingSettings(data.settings?.catalogBrowsing).toolbar;
  const update=(patch:Partial<typeof toolbar>)=>setData(previous=>({
    ...previous,
    settings:{
      ...previous.settings,
      catalogBrowsing:{
        ...normalizeCatalogBrowsingSettings(previous.settings?.catalogBrowsing),
        toolbar:{...normalizeCatalogBrowsingSettings(previous.settings?.catalogBrowsing).toolbar,...patch},
      },
    },
  }));
  return <section className="ad-card" data-testid="catalog-toolbar-manager">
    <header className="ad-card-head"><div><h2 className="ad-card-title">Filter, sort &amp; view toolbar</h2><p className="ad-card-note">Choose which shopping controls appear and tune their frame. The global scale applies automatically; global theme background and corner style stay connected unless you choose custom values.</p></div></header>
    <div className="ad-card-body ad-form-stack">
      <div className="ad-form-row">
        <div className="ad-field"><span className="ad-label">Visible toolbar controls</span>
          <Toggle label="Filter button" checked={toolbar.showFilterButton} onChange={showFilterButton=>update({showFilterButton})} testId="switch-toolbar-filter"/>
          <Toggle label="Sort dropdown" checked={toolbar.showSortDropdown} onChange={showSortDropdown=>update({showSortDropdown})} testId="switch-toolbar-sort"/>
          <Toggle label="Grid / list view switcher" checked={toolbar.showViewSwitcher} onChange={showViewSwitcher=>update({showViewSwitcher})} testId="switch-toolbar-view"/>
          <Toggle label="Grid column count toggles" checked={toolbar.showColumnLayoutSwitcher} onChange={showColumnLayoutSwitcher=>update({showColumnLayoutSwitcher})} testId="switch-toolbar-columns"/>
        </div>
        <div className="ad-field">
          <span className="ad-label">Toolbar frame</span>
           <label className="ad-checkline"><input type="checkbox" checked={toolbar.backgroundMode==='global'} onChange={event=>update({backgroundMode:event.target.checked?'global':'custom'})} aria-label="Use global background for the toolbar" data-testid="switch-toolbar-global-background"/><span>Use global page background</span></label>
          {toolbar.backgroundMode==='custom'&&<label className="ad-field"><span className="ad-label">Background color</span><input type="color" value={toolbar.backgroundColor} onChange={event=>update({backgroundColor:event.target.value})} aria-label="Toolbar background color" data-testid="color-toolbar-background"/></label>}
          <label className="ad-field"><span className="ad-label">Border color</span><input type="color" value={toolbar.borderColor} onChange={event=>update({borderColor:event.target.value})} aria-label="Toolbar border color" data-testid="color-toolbar-border"/></label>
          <label className="ad-checkline"><input type="checkbox" checked={toolbar.borderRadiusMode==='global'} onChange={event=>update({borderRadiusMode:event.target.checked?'global':'custom'})} data-testid="switch-toolbar-global-radius"/><span>Use global corner style</span></label>
          {toolbar.borderRadiusMode==='custom'&&<label className="ad-field"><span className="ad-label">Border radius · {toolbar.borderRadiusPx}px</span><input type="range" min="0" max="32" value={toolbar.borderRadiusPx} onChange={event=>update({borderRadiusPx:Number(event.target.value)})} aria-label="Toolbar border radius" data-testid="range-toolbar-radius"/></label>}
        </div>
      </div>
      <div className="ad-form-row">
        <label className="ad-field"><span className="ad-label">Icon size · {toolbar.iconSizePx}px</span><input type="range" min="12" max="24" value={toolbar.iconSizePx} onChange={event=>update({iconSizePx:Number(event.target.value)})} aria-label="Toolbar icon size" data-testid="range-toolbar-icon-size"/></label>
        <label className="ad-field"><span className="ad-label">Outer padding · {toolbar.paddingPx}px</span><input type="range" min="4" max="20" value={toolbar.paddingPx} onChange={event=>update({paddingPx:Number(event.target.value)})} aria-label="Toolbar padding" data-testid="range-toolbar-padding"/></label>
      </div>
      <div className="ad-notice">Global scale controls still zoom the complete storefront. “Use global” options follow the master theme background and radius settings automatically.</div>
    </div>
  </section>;
}
