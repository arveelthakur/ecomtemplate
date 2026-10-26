import { defaultTrustBadgeBackground, useAdminStore } from '../context/AdminContext';
import AdminSaveButton from './AdminSaveButton';
import CatalogToolbarControls from './CatalogToolbarControls';
const pdpLabels = { videoReviews: 'Video Reviews', accordions: 'Accordions', trustBadges: 'Trust Badges', relatedProducts: 'Related Products' };

export function MasterThemeControls() {
  const { data, setData } = useAdminStore();
  const theme = data.content.theme;
  const typography = data.content.typography;
  const update = (patch: Partial<typeof theme>) => setData(previous => ({
    ...previous, content: { ...previous.content, theme: { ...previous.content.theme, ...patch } },
  }));
  const updateTypography = (group: keyof typeof typography, patch: Record<string, unknown>) => setData(previous => ({
    ...previous,
    content: {
      ...previous.content,
      typography: {
        ...previous.content.typography,
        [group]: { ...previous.content.typography[group], ...patch },
      } as typeof previous.content.typography,
    },
  }));
  const sizeField = (group: keyof typeof typography, field: string, label: string, value: number, min: number, max: number) => <label className="ad-field" key={`${group}-${field}`}><span className="ad-label">{label}</span><input className="ad-input" type="number" min={min} max={max} value={value} onChange={event=>updateTypography(group,{[field]:Number(event.target.value)})} aria-label={label}/></label>;
  const textStyleFields = (group: Exclude<keyof typeof typography,'productTitles'>, value: (typeof typography)[Exclude<keyof typeof typography,'productTitles'>]) => <div className="ad-form-row" key={`${group}-style`}>
    <label className="ad-field"><span className="ad-label">{group} weight</span><select className="ad-select" value={value.fontWeight} onChange={event=>updateTypography(group,{fontWeight:event.target.value})}><option value="regular">Regular</option><option value="medium">Medium</option><option value="bold">Bold</option></select></label>
    <label className="ad-field"><span className="ad-label">{group} style</span><select className="ad-select" value={value.fontStyle} onChange={event=>updateTypography(group,{fontStyle:event.target.value})}><option value="normal">Normal</option><option value="italic">Italic</option></select></label>
    <label className="ad-field"><span className="ad-label">{group} decoration</span><select className="ad-select" value={value.textDecoration} onChange={event=>updateTypography(group,{textDecoration:event.target.value})}><option value="none">None</option><option value="underline">Underline</option></select></label>
  </div>;
  return <div className="ad-form-stack" data-testid="global-master-controls">
    <section className="ad-card">
      <header className="ad-card-head"><div><h2 className="ad-card-title">Global Master Control</h2><p className="ad-card-note">Manage shared storefront scale, typography, colors, and surface styling in one place.</p></div><strong className="ad-status">{Math.round(theme.globalScale * 100)}%</strong></header>
      <div className="ad-card-body ad-form-stack">
        <label className="ad-field"><span className="ad-label">Storefront scale</span>
          <input type="range" min="80" max="115" step="1" value={Math.round(theme.globalScale * 100)} onChange={event=>update({globalScale:Number(event.target.value)/100})} aria-label="Master storefront zoom" data-testid="range-global-storefront-scale"/>
          <span className="ad-help">80%–115%. Applies to every storefront route; Admin Panel sizing is unchanged.</span>
        </label>
      </div>
    </section>
    <section className="ad-card">
      <header className="ad-card-head"><div><h2 className="ad-card-title">Global color &amp; surface defaults</h2><p className="ad-card-note">Shared palette, corner shape, glass blur, and spacing defaults. Existing section-specific custom appearances remain in effect.</p></div></header>
      <div className="ad-card-body ad-form-stack">
        <div className="ad-form-row">
          {([['primary','Primary brand'],['accent','Accent'],['background','Page background'],['trustBadgeBackground','Trust badges background']] as const).map(([key,label])=><label className="ad-field" key={key}><span className="ad-label">{label}</span><div style={{display:'flex',alignItems:'center',gap:10}}><input aria-label={label} type="color" value={theme[key]} onChange={event=>update({[key]:event.target.value})}/><code>{theme[key]}</code>{key==='trustBadgeBackground'&&<button type="button" className="ad-btn small" onClick={()=>update({trustBadgeBackground:defaultTrustBadgeBackground})}>Reset</button>}</div></label>)}
        </div>
        <div className="ad-form-row">
          <label className="ad-field"><span className="ad-label">Corner style</span><select className="ad-select" value={theme.radiusStyle} onChange={event=>update({radiusStyle:event.target.value as typeof theme.radiusStyle})} data-testid="select-global-radius-style"><option value="sharp">Sharp</option><option value="rounded">Soft rounded</option><option value="pill">Pill controls</option></select><span className="ad-help">Controls shared storefront cards, fields, buttons, and surfaces.</span></label>
          <label className="ad-field"><span className="ad-label">Glass blur · {theme.glassBlurPx}px</span><input type="range" min="0" max="24" step="1" value={theme.glassBlurPx} onChange={event=>update({glassBlurPx:Number(event.target.value)})} aria-label="Glass blur intensity" data-testid="range-global-glass-blur"/></label>
          <label className="ad-field"><span className="ad-label">Spacing density</span><select className="ad-select" value={theme.spacingDensity} onChange={event=>update({spacingDensity:event.target.value as typeof theme.spacingDensity})} data-testid="select-global-spacing-density"><option value="compact">Compact</option><option value="balanced">Balanced</option><option value="spacious">Spacious</option></select></label>
        </div>
      </div>
    </section>
    <section className="ad-card" data-testid="master-typography-controls">
      <header className="ad-card-head"><div><h2 className="ad-card-title">Global typography</h2><p className="ad-card-note">Existing saved sizes and styles are loaded as the starting values. Section-level custom typography remains preserved.</p></div></header>
      <div className="ad-card-body ad-form-stack">
        <div className="ad-grid two">
          {sizeField('navigation','fontSizePx','Navigation size (px)',typography.navigation.fontSizePx,10,30)}
          {sizeField('headings','h1FontSizePx','Main heading size (px)',typography.headings.h1FontSizePx,24,100)}
          {sizeField('headings','h2FontSizePx','Section heading size (px)',typography.headings.h2FontSizePx,18,80)}
          {sizeField('body','fontSizePx','Body text size (px)',typography.body.fontSizePx,10,32)}
          {sizeField('productTitles','cardFontSizePx','Product card title size (px)',typography.productTitles.cardFontSizePx,10,32)}
          {sizeField('productTitles','detailFontSizePx','Product detail title size (px)',typography.productTitles.detailFontSizePx,18,80)}
          {sizeField('announcement','fontSizePx','Announcement text size (px)',typography.announcement.fontSizePx,8,32)}
          {sizeField('footerHeadings','fontSizePx','Footer heading size (px)',typography.footerHeadings.fontSizePx,8,32)}
          {sizeField('footerBody','fontSizePx','Footer text size (px)',typography.footerBody.fontSizePx,8,32)}
          {sizeField('subFooter','fontSizePx','Subfooter text size (px)',typography.subFooter.fontSizePx,8,24)}
        </div>
        {textStyleFields('navigation',typography.navigation)}
        {textStyleFields('headings',typography.headings)}
        {textStyleFields('body',typography.body)}
        {textStyleFields('announcement',typography.announcement)}
        {textStyleFields('footerHeadings',typography.footerHeadings)}
        {textStyleFields('footerBody',typography.footerBody)}
        {textStyleFields('subFooter',typography.subFooter)}
        <p className="ad-help">These controls update shared typography. Existing section-specific appearance data is retained and still applied.</p>
        <CatalogToolbarControls/>
        <AdminSaveButton scope={['content.theme','content.typography','settings.catalogBrowsing']} testId="button-save-global-theme" label="Save master controls"/>
      </div>
    </section>
  </div>;
}

export default function LayoutControls() {
  const { data, setData } = useAdminStore();
  const content = data.content;
  const related=content.relatedProductsSettings;
  const updateRelated=(patch:Partial<typeof related>)=>setData(previous=>({
    ...previous,content:{...previous.content,relatedProductsSettings:{...previous.content.relatedProductsSettings,...patch}},
  }));
  return <section className="ad-card">
    <header className="ad-card-head"><h2 className="ad-card-title">Product-page sections</h2></header>
    <div className="ad-card-body ad-form-stack">
      {Object.entries(pdpLabels).map(([key,label])=><label key={key} className="ad-checkline"><input type="checkbox" checked={content.pdpSections[key as keyof typeof pdpLabels]} onChange={event=>setData(previous=>({...previous,content:{...previous.content,pdpSections:{...previous.content.pdpSections,[key]:event.target.checked}}}))} data-testid={`toggle-pdp-section-${key}`}/>{label}</label>)}
      <section className="ad-card" aria-label="You may also like controls">
        <header className="ad-card-head"><div><h3 className="ad-card-title">You may also like</h3><p className="ad-card-note">Control the related products section shown on product pages.</p></div></header>
        <div className="ad-card-body ad-form-stack">
          <label className="ad-field"><span className="ad-label">Section heading</span><input className="ad-input" value={related.title} maxLength={80} onChange={event=>updateRelated({title:event.target.value})} aria-label="Related products heading" data-testid="input-related-products-title"/></label>
          <label className="ad-field"><span className="ad-label">Supporting text</span><input className="ad-input" value={related.subtitle} maxLength={160} onChange={event=>updateRelated({subtitle:event.target.value})} aria-label="Related products supporting text" data-testid="input-related-products-subtitle"/></label>
          <div className="ad-form-row">
            <label className="ad-field"><span className="ad-label">Products to show</span><input className="ad-input" type="number" min={2} max={8} value={related.productLimit} onChange={event=>updateRelated({productLimit:Math.min(8,Math.max(2,Number(event.target.value)||2))})} aria-label="Related products count" data-testid="input-related-products-limit"/></label>
            <label className="ad-checkline"><input type="checkbox" checked={related.prioritizeSameCategory} onChange={event=>updateRelated({prioritizeSameCategory:event.target.checked})} data-testid="toggle-related-products-category-priority"/>Show products from the same category first</label>
          </div>
        </div>
      </section>
      <label className="ad-field"><span className="ad-label">Product Gallery Style</span><select className="ad-select" value={content.productGalleryStyle} onChange={event=>setData(previous=>({...previous,content:{...previous.content,productGalleryStyle:event.target.value as 'grid'|'slider'}}))} data-testid="select-product-gallery-style"><option value="grid">Grid / Stacked Layout</option><option value="slider">Slider / Carousel Layout</option></select><span className="ad-help">Changes stay on this screen until explicitly saved.</span></label>
      <AdminSaveButton scope={['content.pdpSections','content.relatedProductsSettings','content.productGalleryStyle']} testId="button-save-product-page-layout"/>
    </div>
  </section>;
}
