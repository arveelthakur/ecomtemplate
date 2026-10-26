import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { useAdminStore } from '../context/AdminContext';
import { defaultHomeFeatureSectionSettings, type HomeFaqItem, type HomeFeature, type InstagramPost } from '../types/homeSections';
import ImageUpload from '../components/ImageUpload';
import MarqueeBarsManager from './MarqueeBarsManager';
import HomeTrustBadgesManager from './HomeTrustBadgesManager';

function createId(prefix:string){
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
}

type HomepageEditor='categories'|'promises'|'offer'|'features'|'instagram'|'media'|'faq'|'newsletter'|'story'|'contact'|'hero'|'reviews'|'videoReviews'|'bestsellers'|'newArrivals'|'announcement';
const editorTitles:Record<HomepageEditor,string>={categories:'Featured categories',promises:'Trust badges / guarantees',offer:'Sale / offer banner',features:'More Than Just Beauty',instagram:'Instagram feed',media:'Custom image / video banner',faq:'Frequently asked questions',newsletter:'Newsletter signup',story:'Our story',contact:'Contact details',hero:'Hero slider',reviews:'Customer reviews carousel',videoReviews:'Video reviews carousel',bestsellers:'Bestseller carousel',newArrivals:'New arrivals carousel',announcement:'Announcement bar'};

export default function HomepageSectionContentControls({editor}:{editor:HomepageEditor}){
  const {data,setData}=useAdminStore();
  const openEditor=editor;
  const content=data.content;
  const featureDraft=useRef({cards:content.featureCards,settings:content.featureSectionSettings,section:content.homeSections.find(item=>item.id==='features')});
  const [heroIndex,setHeroIndex]=useState(0);
  const hero=content.heroSlides[heroIndex];
  const patchContent=(patch:Partial<typeof content>)=>setData(previous=>({...previous,content:{...previous.content,...patch}}));
  const patchHero=(patch:Record<string,unknown>)=>patchContent({heroSlides:content.heroSlides.map((slide,index)=>index===heroIndex?{...slide,...patch}:slide)});

  function updateFeature(id:string,patch:Partial<HomeFeature>){
    patchContent({featureCards:content.featureCards.map(item=>item.id===id?{...item,...patch}:item)});
  }
  function reorderFeature(index:number,offset:number){
    const next=[...content.featureCards];
    const target=index+offset;
    if(target<0||target>=next.length)return;
    [next[index],next[target]]=[next[target],next[index]];
    patchContent({featureCards:next});
  }
  function patchFeatureSettings(patch:Partial<typeof content.featureSectionSettings>){
    patchContent({featureSectionSettings:{...content.featureSectionSettings,...patch}});
  }
  function patchFeatureSection(patch:Partial<(typeof content.homeSections)[number]>){
    setData(previous=>({...previous,content:{...previous.content,homeSections:previous.content.homeSections.map(item=>item.id==='features'?{...item,...patch}:item)}}));
  }
  function updateInstagram(id:string,patch:Partial<InstagramPost>){
    patchContent({instagramPosts:content.instagramPosts.map(item=>item.id===id?{...item,...patch}:item)});
  }
  function reorderInstagram(index:number,offset:number){
    const next=[...content.instagramPosts];
    const target=index+offset;
    if(target<0||target>=next.length)return;
    [next[index],next[target]]=[next[target],next[index]];
    patchContent({instagramPosts:next});
  }
  function updateFaq(id:string,patch:Partial<HomeFaqItem>){
    patchContent({homeFaq:content.homeFaq.map(item=>item.id===id?{...item,...patch}:item)});
  }
  function reorderFaq(index:number,offset:number){
    const next=[...content.homeFaq];
    const target=index+offset;
    if(target<0||target>=next.length)return;
    [next[index],next[target]]=[next[target],next[index]];
    patchContent({homeFaq:next});
  }

  return <section className="ad-card" data-testid={`homepage-content-editor-${editor}`}>
    <header className="ad-card-head"><div><h2 className="ad-card-title">{editorTitles[editor]}</h2><p className="ad-help">Edit this section’s storefront content, then use the floating Save changes button.</p></div></header>
    <div className="ad-card-body">
      {(openEditor==='reviews'||openEditor==='videoReviews'||openEditor==='bestsellers'||openEditor==='newArrivals')&&(()=>{const key=openEditor==='reviews'||openEditor==='videoReviews'?'reviewCarousel':openEditor==='newArrivals'?'newArrivalsCarousel':'bestsellerCarousel';const config=content[key];const update=(patch:Partial<typeof config>)=>patchContent({[key]:{...config,...patch}});return <div className="ad-form-stack" data-testid={`panel-homepage-editor-${openEditor}`}>
        <p className="ad-help">Configure smooth swipe scrolling, animation, and navigation for this homepage carousel.</p>
        <label className="ad-field"><span className="ad-label">Card layout</span><select className="ad-select" value={config.layout} onChange={event=>update({layout:event.target.value as typeof config.layout,autoScroll:event.target.value==='grid'?false:config.autoScroll})} data-testid={`select-home-${openEditor}-layout`}><option value="horizontal">Horizontal carousel</option><option value="grid">Responsive grid</option></select></label>
        <label className="ad-checkline"><input type="checkbox" checked={config.autoScroll} disabled={config.layout==='grid'} onChange={event=>update({autoScroll:event.target.checked})} data-testid={`toggle-home-${openEditor}-animation`}/> Enable automatic scrolling animation</label>
        <label className="ad-checkline"><input type="checkbox" checked={config.showArrows} onChange={event=>update({showArrows:event.target.checked})} data-testid={`toggle-home-${openEditor}-arrows`}/> Show side navigation arrows</label>
        <label className="ad-field"><span className="ad-label">Motion speed preset</span><select className="ad-select" value={config.speedSeconds<=20?'fast':config.speedSeconds>=45?'slow':'medium'} onChange={event=>update({speedSeconds:event.target.value==='fast'?15:event.target.value==='slow'?60:30})} data-testid={`select-home-${openEditor}-speed-preset`}><option value="slow">Slow</option><option value="medium">Medium</option><option value="fast">Fast</option></select></label>
        <label className="ad-field"><span className="ad-label">Animation duration: {config.speedSeconds}s</span><input className="ad-input" type="range" min="10" max="90" step="5" value={config.speedSeconds} onChange={event=>update({speedSeconds:Number(event.target.value)})} data-testid={`range-home-${openEditor}-speed`}/></label>
      </div>;})()}
      {openEditor==='story'&&<div className="ad-form-stack" data-testid="panel-homepage-editor-story">
        <div className="ad-form-row">
          <label className="ad-field"><span className="ad-label">Eyebrow</span><input className="ad-input" value={content.story.eyebrow} onChange={event=>patchContent({story:{...content.story,eyebrow:event.target.value}})} data-testid="input-home-story-eyebrow"/></label>
          <label className="ad-field"><span className="ad-label">Button label</span><input className="ad-input" value={content.story.buttonText} onChange={event=>patchContent({story:{...content.story,buttonText:event.target.value}})} data-testid="input-home-story-button"/></label>
        </div>
        <label className="ad-field"><span className="ad-label">Headline</span><input className="ad-input" value={content.story.title} onChange={event=>patchContent({story:{...content.story,title:event.target.value}})} data-testid="input-home-story-title"/></label>
        <div className="ad-form-row"><label className="ad-field"><span className="ad-label">First paragraph</span><textarea className="ad-input" rows={4} value={content.story.paragraphOne} onChange={event=>patchContent({story:{...content.story,paragraphOne:event.target.value}})} data-testid="input-home-story-paragraph-one"/></label><label className="ad-field"><span className="ad-label">Second paragraph</span><textarea className="ad-input" rows={4} value={content.story.paragraphTwo} onChange={event=>patchContent({story:{...content.story,paragraphTwo:event.target.value}})} data-testid="input-home-story-paragraph-two"/></label></div>
        <div className="ad-form-row"><label className="ad-field"><span className="ad-label">Story image URL</span><input className="ad-input" value={content.story.imageUrl} onChange={event=>patchContent({story:{...content.story,imageUrl:event.target.value}})} data-testid="input-home-story-image"/><ImageUpload folder="banners" recommendation="Story image: 1000 × 1000 px · square 1:1 composition" onUploaded={url=>patchContent({story:{...content.story,imageUrl:url}})}/></label><label className="ad-field"><span className="ad-label">Image caption</span><input className="ad-input" value={content.story.imageCaption} onChange={event=>patchContent({story:{...content.story,imageCaption:event.target.value}})} data-testid="input-home-story-caption"/></label></div>
        <label className="ad-field"><span className="ad-label">Urdu headline</span><input className="ad-input" dir="rtl" value={content.story.urduTitle} onChange={event=>patchContent({story:{...content.story,urduTitle:event.target.value}})} data-testid="input-home-story-urdu-title"/></label>
        <label className="ad-field"><span className="ad-label">Urdu copy</span><textarea className="ad-input" dir="rtl" rows={3} value={content.story.urduCopy} onChange={event=>patchContent({story:{...content.story,urduCopy:event.target.value}})} data-testid="input-home-story-urdu-copy"/></label>
      </div>}
      {openEditor==='contact'&&<div className="ad-form-stack" data-testid="panel-homepage-editor-contact">
        <label className="ad-field"><span className="ad-label">Contact phone</span><input className="ad-input" value={content.contact.phone} onChange={event=>patchContent({contact:{...content.contact,phone:event.target.value}})} data-testid="input-home-contact-phone"/></label>
        <label className="ad-field"><span className="ad-label">Contact email</span><input className="ad-input" type="email" value={content.contact.email} onChange={event=>patchContent({contact:{...content.contact,email:event.target.value}})} data-testid="input-home-contact-email"/></label>
        <label className="ad-field"><span className="ad-label">Contact address</span><textarea className="ad-input" rows={3} value={content.contact.address} onChange={event=>patchContent({contact:{...content.contact,address:event.target.value}})} data-testid="input-home-contact-address"/></label>
      </div>}
      {openEditor==='announcement'&&<div className="ad-form-stack" data-testid="panel-homepage-editor-announcement">
        <label className="ad-field"><span className="ad-label">Announcement text</span><input className="ad-input" maxLength={140} value={content.announcement.text} onChange={event=>patchContent({announcement:{...content.announcement,text:event.target.value}})} data-testid="input-home-announcement-text"/></label>
        <div className="ad-form-row"><label className="ad-field"><span className="ad-label">Free-delivery threshold (PKR)</span><input className="ad-input" type="number" min="0" value={content.announcement.freeDeliveryThreshold} onChange={event=>patchContent({announcement:{...content.announcement,freeDeliveryThreshold:Number(event.target.value)||0}})} data-testid="input-home-announcement-threshold"/></label><label className="ad-field"><span className="ad-label">Announcement link</span><select className="ad-select" value={content.announcement.linkType} onChange={event=>patchContent({announcement:{...content.announcement,linkType:event.target.value as typeof content.announcement.linkType}})} data-testid="select-home-announcement-link"><option value="none">No link</option><option value="shop">Shop</option><option value="category">Category</option><option value="url">Custom URL</option></select></label></div>
        {content.announcement.linkType==='url'&&<label className="ad-field"><span className="ad-label">Destination URL</span><input className="ad-input" value={content.announcement.linkUrl} onChange={event=>patchContent({announcement:{...content.announcement,linkUrl:event.target.value}})} data-testid="input-home-announcement-url"/></label>}
        <MarqueeBarsManager embedded/>
      </div>}
      {openEditor==='promises'&&<HomeTrustBadgesManager/>}
      {openEditor==='hero'&&<div className="ad-form-stack" data-testid="panel-homepage-editor-hero">
        <div className="ad-toolbar"><select className="ad-select" value={heroIndex} onChange={event=>setHeroIndex(Number(event.target.value))} aria-label="Choose hero slide">{content.heroSlides.map((slide,index)=><option key={slide.id} value={index}>Slide {index+1}{slide.title?` · ${slide.title}`:''}</option>)}</select><button type="button" className="ad-btn small" onClick={()=>{patchContent({heroSlides:[...content.heroSlides,{id:createId('hero'),eyebrow:'',title:'',copy:'',cta:'Shop now',desktopImageUrl:'',mobileImageUrl:'',primaryCta:{label:'Shop now',href:'/shop',visible:true,style:'outline'}}]});setHeroIndex(content.heroSlides.length);}}><Plus/> Add slide</button>{hero&&<button type="button" className="ad-btn small danger" disabled={content.heroSlides.length<=1} onClick={()=>{const next=content.heroSlides.filter((_,index)=>index!==heroIndex);patchContent({heroSlides:next});setHeroIndex(Math.max(0,heroIndex-1));}}><Trash2/> Remove</button>}</div>
        {hero&&<><label className="ad-field"><span className="ad-label">Headline</span><textarea className="ad-input" rows={2} value={hero.title} onChange={event=>patchHero({title:event.target.value})} data-testid="input-home-hero-title"/></label><label className="ad-field"><span className="ad-label">Supporting copy</span><textarea className="ad-input" rows={3} value={hero.copy} onChange={event=>patchHero({copy:event.target.value})} data-testid="input-home-hero-copy"/></label><div className="ad-form-row"><label className="ad-field"><span className="ad-label">Button label</span><input className="ad-input" value={hero.cta} onChange={event=>patchHero({cta:event.target.value})}/></label><label className="ad-field"><span className="ad-label">Eyebrow</span><input className="ad-input" value={hero.eyebrow} onChange={event=>patchHero({eyebrow:event.target.value})}/></label></div><div className="ad-form-row"><label className="ad-field"><span className="ad-label">Desktop image URL</span><input className="ad-input" value={hero.desktopImageUrl} onChange={event=>patchHero({desktopImageUrl:event.target.value})}/><ImageUpload folder="banners" recommendation="Desktop hero: 1920 × 800 px · wide 12:5 composition" onUploaded={url=>patchHero({desktopImageUrl:url})}/></label><label className="ad-field"><span className="ad-label">Mobile image URL</span><input className="ad-input" value={hero.mobileImageUrl} onChange={event=>patchHero({mobileImageUrl:event.target.value})}/><ImageUpload folder="banners" recommendation="Mobile hero: 800 × 1000 px · portrait 4:5 composition" onUploaded={url=>patchHero({mobileImageUrl:url})}/></label></div></>}
        <div className="ad-form-row"><label className="ad-field"><span className="ad-label">Desktop height (px)</span><input className="ad-input" type="number" min="320" max="900" value={content.heroSettings.desktopHeightPx} onChange={event=>patchContent({heroSettings:{...content.heroSettings,desktopHeightPx:Number(event.target.value)||320}})}/></label><label className="ad-field"><span className="ad-label">Mobile height (px)</span><input className="ad-input" type="number" min="300" max="900" value={content.heroSettings.mobileHeightPx} onChange={event=>patchContent({heroSettings:{...content.heroSettings,mobileHeightPx:Number(event.target.value)||300}})}/></label></div>
      </div>}
      {openEditor==='offer'&&<div className="ad-form-stack" role="tabpanel" data-testid="panel-homepage-editor-offer">
        <p className="ad-help">Edit the homepage promotion independently from the top announcement bar and floating offer badge.</p>
        <div className="ad-form-row"><label className="ad-field"><span className="ad-label">Desktop banner</span><input className="ad-input" type="url" value={content.offerBanner.imageUrl} onChange={event=>patchContent({offerBanner:{...content.offerBanner,imageUrl:event.target.value}})} data-testid="input-home-offer-image"/><ImageUpload folder="banners" recommendation="Desktop offer banner: 1920 × 800 px · wide 12:5 composition" onUploaded={url=>patchContent({offerBanner:{...content.offerBanner,imageUrl:url}})}/></label><label className="ad-field"><span className="ad-label">Mobile banner (optional)</span><input className="ad-input" type="url" value={content.offerBanner.mobileImageUrl} onChange={event=>patchContent({offerBanner:{...content.offerBanner,mobileImageUrl:event.target.value}})} data-testid="input-home-offer-mobile-image"/><ImageUpload folder="banners" recommendation="Mobile offer banner: 800 × 1000 px · portrait 4:5 composition" onUploaded={url=>patchContent({offerBanner:{...content.offerBanner,mobileImageUrl:url}})}/></label></div>
        <div className="ad-form-row">
          <label className="ad-field"><span className="ad-label">Eyebrow</span><input className="ad-input" value={content.offerBanner.eyebrow} onChange={event=>patchContent({offerBanner:{...content.offerBanner,eyebrow:event.target.value}})} data-testid="input-home-offer-eyebrow"/></label>
          <label className="ad-field"><span className="ad-label">Button label</span><input className="ad-input" value={content.offerBanner.buttonText} onChange={event=>patchContent({offerBanner:{...content.offerBanner,buttonText:event.target.value}})} data-testid="input-home-offer-button"/></label>
        </div>
        <label className="ad-field"><span className="ad-label">Headline</span><input className="ad-input" value={content.offerBanner.title} onChange={event=>patchContent({offerBanner:{...content.offerBanner,title:event.target.value}})} data-testid="input-home-offer-title"/></label>
        <label className="ad-field"><span className="ad-label">Supporting text</span><textarea className="ad-input" rows={3} value={content.offerBanner.copy} onChange={event=>patchContent({offerBanner:{...content.offerBanner,copy:event.target.value}})} data-testid="input-home-offer-copy"/></label>
        <label className="ad-field"><span className="ad-label">Destination URL or route</span><input className="ad-input" value={content.offerBanner.targetUrl} onChange={event=>patchContent({offerBanner:{...content.offerBanner,targetUrl:event.target.value}})} placeholder="/shop or https://example.com" data-testid="input-home-offer-target"/></label>
        
      </div>}

      {openEditor==='features'&&<div className="ad-form-stack" role="tabpanel" data-testid="panel-homepage-editor-features">
        <div className="ad-toolbar"><p className="ad-help" style={{flex:1}}>Edit the editorial copy and cards. Brand colors, typography, spacing, and icon scale come from Global Master Control.</p><button type="button" className="ad-btn small" onClick={()=>patchContent({featureCards:[...content.featureCards,{id:createId('feature'),title:'',description:'',icon:'sparkles',visible:true}]})} data-testid="button-add-home-feature"><Plus size={14}/> Add feature</button></div>
        <div className="ad-form-row">
          <label className="ad-field"><span className="ad-label">Eyebrow</span><input className="ad-input" maxLength={100} value={content.featureSectionSettings.eyebrow} onChange={event=>patchFeatureSettings({eyebrow:event.target.value})} data-testid="input-feature-section-eyebrow"/></label>
          <label className="ad-field"><span className="ad-label">Closing tagline</span><input className="ad-input" maxLength={140} value={content.featureSectionSettings.tagline} onChange={event=>patchFeatureSettings({tagline:event.target.value})} data-testid="input-feature-section-tagline"/></label>
        </div>
        <label className="ad-field"><span className="ad-label">Main heading</span><input className="ad-input" maxLength={160} value={content.homeSections.find(item=>item.id==='features')?.headingOverride||''} onChange={event=>patchFeatureSection({headingOverride:event.target.value})} data-testid="input-feature-section-heading"/></label>
        <label className="ad-field"><span className="ad-label">Introduction</span><textarea className="ad-input" rows={3} maxLength={300} value={content.homeSections.find(item=>item.id==='features')?.subheadingOverride||''} onChange={event=>patchFeatureSection({subheadingOverride:event.target.value})} data-testid="input-feature-section-intro"/></label>
        {content.featureCards.map((item,index)=><div key={item.id} className="ad-card" data-testid={`card-home-feature-editor-${item.id}`}><div className="ad-card-body ad-form-stack">
          <div className="ad-toolbar"><label className="ad-checkline" style={{flex:1}}><input type="checkbox" checked={item.visible} onChange={event=>updateFeature(item.id,{visible:event.target.checked})}/> Show this feature</label><strong>Feature {index+1}</strong><button type="button" className="ad-btn small" disabled={index===0} onClick={()=>reorderFeature(index,-1)} aria-label={`Move feature ${index+1} up`}><ArrowUp size={14}/></button><button type="button" className="ad-btn small" disabled={index===content.featureCards.length-1} onClick={()=>reorderFeature(index,1)} aria-label={`Move feature ${index+1} down`}><ArrowDown size={14}/></button><button type="button" className="ad-btn small danger" onClick={()=>patchContent({featureCards:content.featureCards.filter(feature=>feature.id!==item.id)})} aria-label={`Remove feature ${index+1}`}><Trash2 size={14}/></button></div>
          <div className="ad-form-row"><label className="ad-field"><span className="ad-label">Title</span><input className="ad-input" maxLength={120} value={item.title} onChange={event=>updateFeature(item.id,{title:event.target.value})} data-testid={`input-home-feature-title-${item.id}`}/></label><label className="ad-field"><span className="ad-label">Icon</span><select className="ad-select" value={item.icon} onChange={event=>updateFeature(item.id,{icon:event.target.value})} data-testid={`select-home-feature-icon-${item.id}`}><option value="sparkles">Sparkle</option><option value="shield">Shield</option><option value="truck">Delivery</option><option value="leaf">Leaf</option><option value="award">Award</option><option value="check">Check circle</option><option value="lock">Lock</option><option value="heart">Heart</option><option value="package">Package</option></select></label></div>
          <label className="ad-field"><span className="ad-label">Description</span><textarea className="ad-input" rows={2} maxLength={500} value={item.description} onChange={event=>updateFeature(item.id,{description:event.target.value})} data-testid={`input-home-feature-description-${item.id}`}/></label>
        </div></div>)}
        <div className="ad-form-row">
          <label className="ad-field"><span className="ad-label">Card layout</span><select className="ad-select" value={content.featureSectionSettings.layout} onChange={event=>patchFeatureSettings({layout:event.target.value as 'two-column'|'single-column'})}><option value="two-column">Two columns</option><option value="single-column">Single column</option></select></label>
          
          
        </div>
        
        <div className="ad-toolbar"><button type="button" className="ad-btn small" onClick={()=>{setData(previous=>({...previous,content:{...previous.content,featureCards:featureDraft.current.cards,featureSectionSettings:featureDraft.current.settings,homeSections:previous.content.homeSections.map(item=>item.id==='features'&&featureDraft.current.section?featureDraft.current.section:item)}}));}}>Cancel unsaved edits</button><button type="button" className="ad-btn small" onClick={()=>{patchContent({featureCards:[],featureSectionSettings:defaultHomeFeatureSectionSettings});patchFeatureSection({headingOverride:'Why shop with us',subheadingOverride:'Add the benefits your store offers.'});}}>Clear feature content</button></div>
      </div>}

      {openEditor==='instagram'&&<div className="ad-form-stack" role="tabpanel" data-testid="panel-homepage-editor-instagram">
        <div className="ad-toolbar"><p className="ad-help" style={{flex:1}}>Add the image, caption, and destination for each post. Images can use a public URL or an uploaded storage URL.</p><button type="button" className="ad-btn small" onClick={()=>patchContent({instagramPosts:[...content.instagramPosts,{id:createId('instagram'),imageUrl:'',caption:'',postUrl:''}]})} data-testid="button-add-instagram-post"><Plus size={14}/> Add post</button></div>
        {content.instagramPosts.length===0&&<p className="ad-help">No Instagram posts yet.</p>}
        {content.instagramPosts.map((item,index)=><div key={item.id} className="ad-card" data-testid={`card-instagram-post-editor-${item.id}`}><div className="ad-card-body ad-form-stack">
          <div className="ad-toolbar"><strong style={{flex:1}}>Post {index+1}</strong><button type="button" className="ad-btn small" disabled={index===0} onClick={()=>reorderInstagram(index,-1)} aria-label={`Move Instagram post ${index+1} up`} data-testid={`button-move-instagram-post-up-${item.id}`}><ArrowUp size={14}/></button><button type="button" className="ad-btn small" disabled={index===content.instagramPosts.length-1} onClick={()=>reorderInstagram(index,1)} aria-label={`Move Instagram post ${index+1} down`} data-testid={`button-move-instagram-post-down-${item.id}`}><ArrowDown size={14}/></button><button type="button" className="ad-btn small danger" onClick={()=>patchContent({instagramPosts:content.instagramPosts.filter(post=>post.id!==item.id)})} aria-label={`Remove Instagram post ${index+1}`} data-testid={`button-remove-instagram-post-${item.id}`}><Trash2 size={14}/></button></div>
          <div className="ad-form-row"><label className="ad-field"><span className="ad-label">Image URL</span><input className="ad-input" type="url" value={item.imageUrl} onChange={event=>updateInstagram(item.id,{imageUrl:event.target.value})} data-testid={`input-instagram-image-${item.id}`}/></label><div className="ad-field"><span className="ad-label">Upload image</span><ImageUpload folder="banners" recommendation="Instagram post: 1080 × 1080 px · square 1:1 composition" onUploaded={url=>updateInstagram(item.id,{imageUrl:url})}/></div></div>
          <label className="ad-field"><span className="ad-label">Caption / alt text</span><input className="ad-input" value={item.caption} onChange={event=>updateInstagram(item.id,{caption:event.target.value})} data-testid={`input-instagram-caption-${item.id}`}/></label>
          <label className="ad-field"><span className="ad-label">Post URL</span><input className="ad-input" type="url" value={item.postUrl} onChange={event=>updateInstagram(item.id,{postUrl:event.target.value})} data-testid={`input-instagram-url-${item.id}`}/></label>
        </div></div>)}
      </div>}

      {openEditor==='media'&&<div className="ad-form-stack" role="tabpanel" data-testid="panel-homepage-editor-media">
        <label className="ad-field"><span className="ad-label">Media type</span><select className="ad-select" value={content.homeMediaBanner.mode} onChange={event=>patchContent({homeMediaBanner:{...content.homeMediaBanner,mode:event.target.value as 'image'|'video'}})} data-testid="select-home-media-mode"><option value="image">Image</option><option value="video">Video / YouTube</option></select></label>
        <div className="ad-form-row"><label className="ad-field"><span className="ad-label">Headline</span><input className="ad-input" value={content.homeMediaBanner.title} onChange={event=>patchContent({homeMediaBanner:{...content.homeMediaBanner,title:event.target.value}})} data-testid="input-home-media-title"/></label><label className="ad-field"><span className="ad-label">Button label</span><input className="ad-input" value={content.homeMediaBanner.buttonText} onChange={event=>patchContent({homeMediaBanner:{...content.homeMediaBanner,buttonText:event.target.value}})} data-testid="input-home-media-button"/></label></div>
        <label className="ad-field"><span className="ad-label">Supporting text</span><textarea className="ad-input" rows={3} value={content.homeMediaBanner.copy} onChange={event=>patchContent({homeMediaBanner:{...content.homeMediaBanner,copy:event.target.value}})} data-testid="input-home-media-copy"/></label>
        {content.homeMediaBanner.mode==='image'?<div className="ad-form-row"><label className="ad-field"><span className="ad-label">Desktop image URL</span><input className="ad-input" type="url" value={content.homeMediaBanner.imageUrl} onChange={event=>patchContent({homeMediaBanner:{...content.homeMediaBanner,imageUrl:event.target.value}})} data-testid="input-home-media-image-url"/><ImageUpload folder="banners" recommendation="Desktop media image: 1600 × 1200 px · landscape 4:3 composition" onUploaded={url=>patchContent({homeMediaBanner:{...content.homeMediaBanner,imageUrl:url}})}/></label><label className="ad-field"><span className="ad-label">Mobile image (optional)</span><input className="ad-input" type="url" value={content.homeMediaBanner.mobileImageUrl} onChange={event=>patchContent({homeMediaBanner:{...content.homeMediaBanner,mobileImageUrl:event.target.value}})} data-testid="input-home-media-mobile-image-url"/><ImageUpload folder="banners" recommendation="Mobile media image: 800 × 1000 px · portrait 4:5 composition" onUploaded={url=>patchContent({homeMediaBanner:{...content.homeMediaBanner,mobileImageUrl:url}})}/></label></div>:<label className="ad-field"><span className="ad-label">Video URL (MP4 or YouTube)</span><input className="ad-input" type="url" value={content.homeMediaBanner.mediaUrl} onChange={event=>patchContent({homeMediaBanner:{...content.homeMediaBanner,mediaUrl:event.target.value}})} data-testid="input-home-media-video-url"/></label>}
        <label className="ad-field"><span className="ad-label">Button destination URL or route</span><input className="ad-input" value={content.homeMediaBanner.targetUrl} onChange={event=>patchContent({homeMediaBanner:{...content.homeMediaBanner,targetUrl:event.target.value}})} data-testid="input-home-media-target"/></label>
      </div>}

      {openEditor==='faq'&&<div className="ad-form-stack" role="tabpanel" data-testid="panel-homepage-editor-faq">
        <div className="ad-toolbar"><p className="ad-help" style={{flex:1}}>Only questions with text will render in the storefront.</p><button type="button" className="ad-btn small" onClick={()=>patchContent({homeFaq:[...content.homeFaq,{id:createId('faq'),question:'',answer:''}]})} data-testid="button-add-home-faq"><Plus size={14}/> Add question</button></div>
        {content.homeFaq.map((item,index)=><div key={item.id} className="ad-card" data-testid={`card-home-faq-editor-${item.id}`}><div className="ad-card-body ad-form-stack">
          <div className="ad-toolbar"><strong style={{flex:1}}>Question {index+1}</strong><button type="button" className="ad-btn small" disabled={index===0} onClick={()=>reorderFaq(index,-1)} aria-label={`Move question ${index+1} up`} data-testid={`button-move-home-faq-up-${item.id}`}><ArrowUp size={14}/></button><button type="button" className="ad-btn small" disabled={index===content.homeFaq.length-1} onClick={()=>reorderFaq(index,1)} aria-label={`Move question ${index+1} down`} data-testid={`button-move-home-faq-down-${item.id}`}><ArrowDown size={14}/></button><button type="button" className="ad-btn small danger" onClick={()=>patchContent({homeFaq:content.homeFaq.filter(faq=>faq.id!==item.id)})} aria-label={`Remove question ${index+1}`} data-testid={`button-remove-home-faq-${item.id}`}><Trash2 size={14}/></button></div>
          <label className="ad-field"><span className="ad-label">Question</span><input className="ad-input" value={item.question} onChange={event=>updateFaq(item.id,{question:event.target.value})} data-testid={`input-home-faq-question-${item.id}`}/></label>
          <label className="ad-field"><span className="ad-label">Answer</span><textarea className="ad-input" rows={3} value={item.answer} onChange={event=>updateFaq(item.id,{answer:event.target.value})} data-testid={`input-home-faq-answer-${item.id}`}/></label>
        </div></div>)}
      </div>}

      {openEditor==='newsletter'&&<div className="ad-form-stack" role="tabpanel" data-testid="panel-homepage-editor-newsletter">
        <div className="ad-form-row"><label className="ad-field"><span className="ad-label">Eyebrow</span><input className="ad-input" value={content.newsletter.eyebrow} onChange={event=>patchContent({newsletter:{...content.newsletter,eyebrow:event.target.value}})} data-testid="input-newsletter-eyebrow"/></label><label className="ad-field"><span className="ad-label">Button text</span><input className="ad-input" value={content.newsletter.buttonText} onChange={event=>patchContent({newsletter:{...content.newsletter,buttonText:event.target.value}})} data-testid="input-newsletter-button-text"/></label></div>
        <label className="ad-field"><span className="ad-label">Headline</span><input className="ad-input" value={content.newsletter.title} onChange={event=>patchContent({newsletter:{...content.newsletter,title:event.target.value}})} data-testid="input-newsletter-title"/></label>
        <label className="ad-field"><span className="ad-label">Supporting text</span><textarea className="ad-input" rows={2} value={content.newsletter.copy} onChange={event=>patchContent({newsletter:{...content.newsletter,copy:event.target.value}})} data-testid="input-newsletter-copy"/></label>
        <label className="ad-field"><span className="ad-label">Email field placeholder</span><input className="ad-input" value={content.newsletter.emailPlaceholder} onChange={event=>patchContent({newsletter:{...content.newsletter,emailPlaceholder:event.target.value}})} data-testid="input-newsletter-placeholder"/></label>
        <div className="ad-form-row">{content.newsletter.guarantees.map((guarantee,index)=><label className="ad-field" key={`${index}-${guarantee}`}><span className="ad-label">Guarantee {index+1}</span><input className="ad-input" value={guarantee} onChange={event=>{const guarantees=[...content.newsletter.guarantees];guarantees[index]=event.target.value;patchContent({newsletter:{...content.newsletter,guarantees}});}} data-testid={`input-newsletter-guarantee-${index}`}/></label>)}</div>
      </div>}
    </div>
  </section>;
}
