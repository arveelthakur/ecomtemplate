import { useEffect, useRef, useState, type DragEvent } from 'react';
import { ArrowDown, ArrowUp, GripVertical, Plus, Settings2, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAdminStore, type AdminSaveScope } from '../context/AdminContext';
import { homeSectionDefinitions, type HomeSectionId, type HomeSectionSetting } from '../types/homeSections';
import HomepageSectionContentControls from './HomepageSectionContentControls';
import AdminSaveButton from './AdminSaveButton';
import AdminModalPortal from './AdminModalPortal';
import StoreStatisticsManager from './StoreStatisticsManager';

export default function HomepageSectionsManager(){
  const {data,setData}=useAdminStore();
  const location=useLocation();
  const navigate=useNavigate();
  const [addDrawerOpen,setAddDrawerOpen]=useState(false);
  const [editorId,setEditorId]=useState<HomeSectionId|null>(null);
  useEffect(()=>{
    const state=location.state&&typeof location.state==='object'?location.state as Record<string,unknown>:{};
    setEditorId(typeof state.homepageSectionEditor==='string'?state.homepageSectionEditor as HomeSectionId:null);
    setAddDrawerOpen(state.homepageSectionsDrawer===true);
  },[location.key,location.state]);
  const dragging=useRef<number|null>(null);
  // The announcement bar has its own admin destination and is not part of
  // the reorderable homepage section list.
  const sections=data.content.homeSections.filter(section=>section.id!=='announcement');
  const selected=editorId&&editorId!=='footer'?sections.find(section=>section.id===editorId):undefined;
  const labels=new Map(homeSectionDefinitions.map(section=>[section.id,section.label]));
  const hiddenSections=sections.filter(section=>!section.visible);
  const contentEditor:Partial<Record<HomeSectionId,'promises'|'offer'|'features'|'instagram'|'media'|'faq'|'newsletter'|'story'|'contact'|'hero'|'reviews'|'bestsellers'|'newArrivals'>>={
    promises:'promises',offerBanner:'offer',features:'features',instagram:'instagram',mediaBanner:'media',faq:'faq',newsletter:'newsletter',story:'story',contact:'contact',hero:'hero',testimonials:'reviews',bestsellers:'bestsellers',newArrivals:'newArrivals',
  };
  const contentFields:Partial<Record<HomeSectionId,AdminSaveScope[]>>={
    testimonials:['content.reviewCarousel'],bestsellers:['content.bestsellerCarousel'],newArrivals:['content.newArrivalsCarousel'],
    promises:['content.promiseCards','content.trustBadgeDisplay','content.theme.trustBadgeBackground'],
    statistics:['content.homeSections','content.milestoneStats','content.milestoneSettings','content.milestoneBadges'],offerBanner:['content.offerBanner'],features:['content.featureCards','content.featureSectionSettings'],
    story:['content.story'],contact:['content.contact'],
    hero:['content.heroSlides','content.heroSettings'],
    instagram:['content.instagramPosts'],mediaBanner:['content.homeMediaBanner'],faq:['content.homeFaq'],newsletter:['content.newsletter'],
  };
  const sectionScopes:AdminSaveScope[]=[
    'content.homeSections',
    ...(editorId?contentFields[editorId]??[]:[]),
  ];
  function navigateWithOverlayState(patch:Record<string,unknown>){
    const currentState=location.state&&typeof location.state==='object'?location.state as Record<string,unknown>:{};
    navigate(`${location.pathname}${location.search}${location.hash}`,{state:{...currentState,...patch},preventScrollReset:true});
  }
  function closeOverlay(stateKey:'homepageSectionEditor'|'homepageSectionsDrawer',fallback:()=>void){
    const state=location.state&&typeof location.state==='object'?location.state as Record<string,unknown>:{};
    if(stateKey in state)navigate(-1);
    else fallback();
  }

  function reorder(from:number,to:number){
    if(from===to||from<0||to<0||from>=sections.length||to>=sections.length)return;
    setData(previous=>{
      const next=[...previous.content.homeSections];
      const visibleIndexes=next.map((item,index)=>item.id==='announcement'?-1:index).filter(index=>index>=0);
      const [item]=next.splice(visibleIndexes[from]!,1);
      next.splice(visibleIndexes[to]!,0,item);
      return {...previous,content:{...previous.content,homeSections:next}};
    });
  }
  function setVisible(id:HomeSectionId,visible:boolean){
    setData(previous=>({...previous,content:{...previous.content,announcement:id==='announcement'?{...previous.content.announcement,visible}:previous.content.announcement,homeSections:previous.content.homeSections.map(item=>item.id===id?{...item,visible}:item)}}));
  }
  function dropAt(event:DragEvent<HTMLDivElement>,index:number){
    event.preventDefault();
    const from=dragging.current;
    if(from!==null)reorder(from,index);
    dragging.current=null;
  }

  return <div className="ad-form-stack">
      <section className="ad-card">
        <header className="ad-card-head"><h2 className="ad-card-title">Homepage sections</h2><button className="ad-btn small" type="button" onClick={()=>navigateWithOverlayState({homepageSectionsDrawer:true})} data-testid="button-add-homepage-section"><Plus size={14}/> Add more section</button></header>
        <div className="ad-card-body">
          <div className="ad-toolbar" style={{justifyContent:'space-between',marginBottom:14}}><p className="ad-help">Use the single Save changes action in the admin toolbar. Reorder sections or change visibility here.</p><AdminSaveButton scope="content.homeSections" testId="button-save-homepage-sections"/></div>
          <label className="ad-checkline" style={{marginBottom:16}}>
            <input type="checkbox" checked={data.content.homeSections.find(section=>section.id==='announcement')?.visible!==false&&data.content.announcement.visible} onChange={event=>setVisible('announcement',event.target.checked)} data-testid="toggle-homepage-section-announcement"/>
            Announcement bar (always at the top)
          </label>
          <div className="ad-form-stack" data-testid="list-homepage-sections">
            {sections.map((item,index)=><div
              key={item.id}
              draggable={item.id!=='footer'}
              onDragStart={item.id==='footer'?undefined:event=>{dragging.current=index;event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',item.id);}}
              onDragOver={item.id==='footer'?undefined:event=>{event.preventDefault();event.dataTransfer.dropEffect='move';}}
              onDrop={item.id==='footer'?undefined:event=>dropAt(event,index)}
              onDragEnd={()=>{dragging.current=null;}}
              className="ad-toolbar"
              style={{gap:8,padding:'9px 0',borderBottom:'1px solid var(--ad-border)',opacity:item.visible?1:.65}}
              data-testid={`row-homepage-section-${item.id}`}
            >
              {item.id!=='footer'&&<span aria-hidden="true" className="ad-help" title="Drag to reorder"><GripVertical size={16}/></span>}
              <label className="ad-checkline" style={{flex:1,minWidth:0}}>
                <input type="checkbox" checked={item.visible} onChange={event=>setVisible(item.id,event.target.checked)} data-testid={`toggle-homepage-section-${item.id}`}/>
                <span>{labels.get(item.id)??item.id}</span>
              </label>
               {item.id!=='footer'&&<button className={`ad-btn small ${editorId===item.id?'active':''}`} type="button" onClick={()=>navigateWithOverlayState({homepageSectionEditor:item.id})} aria-label={`Edit ${labels.get(item.id)??item.id}`} aria-pressed={editorId===item.id} data-testid={`button-style-homepage-section-${item.id}`}><Settings2 size={14}/><span className="sr-only">Edit section</span></button>}
              <button className="ad-btn small" type="button" disabled={index===0} onClick={()=>reorder(index,index-1)} aria-label={`Move ${labels.get(item.id)??item.id} up`} data-testid={`button-move-homepage-section-up-${item.id}`}><ArrowUp size={14}/></button>
              <button className="ad-btn small" type="button" disabled={index===sections.length-1} onClick={()=>reorder(index,index+1)} aria-label={`Move ${labels.get(item.id)??item.id} down`} data-testid={`button-move-homepage-section-down-${item.id}`}><ArrowDown size={14}/></button>
            </div>)}
          </div>
        </div>
      </section>

      {selected&&<AdminModalPortal><div className="ad-modal-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)closeOverlay('homepageSectionEditor',()=>setEditorId(null));}}>
        <section className="ad-modal" role="dialog" aria-modal="true" aria-labelledby="homepage-section-editor-title" data-testid={`dialog-homepage-section-${selected.id}`}>
          <header className="ad-modal-head"><div><h2 id="homepage-section-editor-title" className="ad-card-title">{labels.get(selected.id)??selected.id}</h2><p className="ad-card-note">Edit this section without leaving the homepage manager.</p></div><button type="button" className="ad-icon-btn" onClick={()=>closeOverlay('homepageSectionEditor',()=>setEditorId(null))} aria-label="Close section editor" data-testid="button-close-homepage-section-editor"><X/></button></header>
          <div className="ad-modal-body ad-form-stack">
           <p className="ad-help">Edit section wording and content here. Typography, sizes, and the shared color palette are managed in Global Master Control.</p>
          <label className="ad-field"><span className="ad-label">Section heading override</span><input className="ad-input" value={selected.headingOverride} onChange={event=>setData(previous=>({...previous,content:{...previous.content,homeSections:previous.content.homeSections.map(item=>item.id===selected.id?{...item,headingOverride:event.target.value}:item)}}))} data-testid={`input-home-section-heading-${selected.id}`}/></label>
          <label className="ad-field"><span className="ad-label">Section subheading override</span><textarea className="ad-input" rows={2} value={selected.subheadingOverride} onChange={event=>setData(previous=>({...previous,content:{...previous.content,homeSections:previous.content.homeSections.map(item=>item.id===selected.id?{...item,subheadingOverride:event.target.value}:item)}}))} data-testid={`input-home-section-subheading-${selected.id}`}/></label>
          {selected.id==='statistics'&&<StoreStatisticsManager/>}
          {contentEditor[selected.id]&&<HomepageSectionContentControls editor={contentEditor[selected.id]!}/>}
          </div>
           <footer className="ad-modal-foot">{selected.id!=='footer'&&<AdminSaveButton scope={sectionScopes} testId={`button-save-homepage-section-${selected.id}`} label="Save Changes"/>}</footer>
        </section>
      </div></AdminModalPortal>}

    {addDrawerOpen&&<AdminModalPortal><div className="ad-modal-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)closeOverlay('homepageSectionsDrawer',()=>setAddDrawerOpen(false));}}>
      <aside className="ad-side-drawer" role="dialog" aria-modal="true" aria-labelledby="home-sections-available-title" data-testid="drawer-available-homepage-sections">
        <header className="ad-card-head"><div><h2 id="home-sections-available-title" className="ad-card-title">Available Sections</h2><p className="ad-help">Add a hidden section back to the homepage.</p></div><button type="button" className="ad-btn small" onClick={()=>closeOverlay('homepageSectionsDrawer',()=>setAddDrawerOpen(false))} aria-label="Close available sections" data-testid="button-close-available-homepage-sections"><X size={16}/></button></header>
        <div className="ad-card-body ad-form-stack">
          {hiddenSections.length===0?<p className="ad-help">Every section is currently visible. Hide a section to remove it from the homepage.</p>:hiddenSections.map(item=><div key={item.id} className="ad-toolbar" style={{justifyContent:'space-between',borderBottom:'1px solid var(--ad-border)',paddingBottom:10}}>
            <span>{labels.get(item.id)??item.id}</span>
            <button type="button" className="ad-btn small" onClick={()=>setVisible(item.id,true)} data-testid={`button-restore-homepage-section-${item.id}`}><Plus size={14}/> Add</button>
          </div>)}
        </div>
      </aside>
    </div></AdminModalPortal>}
  </div>;
}
