import { useId, type CSSProperties, type ReactNode } from 'react';
import { Award, ArrowRight, CheckCircle, ChevronDown, Heart, Leaf, LockKeyhole, PackageCheck, ShieldCheck, Sparkles, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';
import './FeatureGridSection.css';
import type {
  HomeFaqItem,
  HomeFeature,
  HomeMediaBanner,
  HomeOfferBanner,
  HomeSectionAppearance,
  InstagramPost,
} from '../../types/homeSections';
import StoreImage from '../StoreImage';

type AppearanceProps = { appearance?: HomeSectionAppearance };

const sectionStyle = (appearance?: HomeSectionAppearance): CSSProperties => ({
  backgroundColor: appearance?.backgroundColor || '#fdfbf7',
  borderColor: appearance?.borderColor
    ? `color-mix(in srgb, ${appearance.borderColor} ${Math.round(Math.max(0, Math.min(100, appearance.borderOpacity)))}%, transparent)`
    : '#e9e2d8',
  borderWidth: appearance?.borderWidthPx ? `${appearance.borderWidthPx}px` : undefined,
  borderStyle: appearance?.borderWidthPx ? 'solid' : undefined,
  borderRadius: appearance?.borderRadiusPx ? `${appearance.borderRadiusPx}px` : undefined,
  textAlign: appearance?.alignment&&appearance.alignment!=='default'?appearance.alignment:undefined,
  '--home-heading-size': appearance?.headingFontSizePx ? `${appearance.headingFontSizePx}px` : undefined,
  '--home-body-size': appearance?.bodyFontSizePx ? `${appearance.bodyFontSizePx}px` : undefined,
} as CSSProperties);

const alignmentClass = (appearance?: HomeSectionAppearance) =>
  appearance?.alignment === 'center' ? 'text-center' : appearance?.alignment === 'right' ? 'text-right' : 'text-left';

function validExternalUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

function safeInternalPath(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith('//') || /[\u0000-\u001f\\]/.test(trimmed)) return null;
  try {
    const parsed = new URL(trimmed, window.location.origin);
    return parsed.origin === window.location.origin ? `${parsed.pathname}${parsed.search}${parsed.hash}` : null;
  } catch {
    return null;
  }
}

function SafeCta({ href, children, className, testId, dir, lang }: {
  href: string;
  children: ReactNode;
  className: string;
  testId: string;
  dir?:'rtl'|'ltr'|'auto';
  lang?:string;
}) {
  const internal = safeInternalPath(href);
  if (internal) {
    return <Link to={internal} dir={dir} lang={lang} className={className} data-testid={testId}>{children}</Link>;
  }
  const external = validExternalUrl(href);
  if (external) {
    return <a href={external} target="_blank" rel="noopener noreferrer" dir={dir} lang={lang} className={className} data-testid={testId}>{children}</a>;
  }
  return null;
}

function EmptyState({ children, testId }: { children: ReactNode; testId: string }) {
  return <p className="mx-auto max-w-lg py-5 text-sm leading-6 text-[#81766c]" data-testid={testId}>{children}</p>;
}

function containsUrdu(value:string){
  return /[\u0600-\u06ff\u0750-\u077f]/u.test(value);
}

export function OfferBannerSection({ content, appearance, headingOverride, subheadingOverride }: { content: HomeOfferBanner; headingOverride?:string; subheadingOverride?:string } & AppearanceProps) {
  const buttonText=content.buttonText.trim()||'Explore the collection';
  const targetUrl=content.targetUrl.trim()||'/shop';
  const hasCta = Boolean(safeInternalPath(targetUrl) || validExternalUrl(targetUrl));
  const title=headingOverride||content.title||'A considered find for every day';
  const copy=subheadingOverride||content.copy||'Use this space to introduce a seasonal edit, a featured collection, or a current offer. Replace this example before publishing.';
  const isUrduEyebrow=containsUrdu(content.eyebrow);
  const isUrduTitle=containsUrdu(title);
  const isUrduCopy=containsUrdu(copy);
   const isUrduCta=containsUrdu(buttonText);
  return (
    <section
      className="relative isolate overflow-hidden px-5 py-10 sm:px-8 sm:py-14"
      style={{ ...sectionStyle(appearance), backgroundColor: content.backgroundColor || appearance?.backgroundColor || '#f3eee7', color: content.foregroundColor || '#332822' }}
      data-testid="section-home-offer-banner"
    >
      <StoreImage src={content.imageUrl} mobileSrc={content.mobileImageUrl} alt="" aria-hidden="true" placeholderTitle="Offer banner image" placeholderHint="Add a visual in Admin → Content → Offer Banner." placeholderDimensions="Recommended: 1920 × 800 px" loading="lazy" decoding="async" pictureClassName="absolute inset-0 z-0 block" className="h-full w-full object-cover opacity-25" data-testid="img-home-offer-banner"/>
      <div className="absolute inset-0 z-0 bg-white/15" aria-hidden="true"/>
      <div className={`relative z-10 mx-auto max-w-5xl ${alignmentClass(appearance)}`}>
        <p dir={isUrduEyebrow?'rtl':undefined} lang={isUrduEyebrow?'ur':undefined} className={`mb-3 ${isUrduEyebrow?'nura-urdu-text':'eyebrow'}`} style={{ color: content.foregroundColor }} data-testid="text-offer-eyebrow">{content.eyebrow||'A note from the store'}</p>
        <h2 dir={isUrduTitle?'rtl':undefined} lang={isUrduTitle?'ur':undefined} className={`${isUrduTitle?'nura-urdu-text':'serif'} text-[clamp(28px,5vw,46px)] leading-[1.08]`} style={{ fontSize: 'var(--home-heading-size, clamp(28px, 5vw, 46px))' }} data-testid="text-offer-title">{title}</h2>
        {copy && <p dir={isUrduCopy?'rtl':undefined} lang={isUrduCopy?'ur':undefined} className={`mx-auto mt-3 max-w-2xl text-sm opacity-80 sm:text-[length:var(--home-body-size,14px)] ${isUrduCopy?'nura-urdu-text':'leading-6'}`} data-testid="text-offer-copy">{copy}</p>}
        {hasCta && <SafeCta href={targetUrl} dir={isUrduCta?'rtl':undefined} lang={isUrduCta?'ur':undefined} className={`mt-6 inline-flex min-h-11 items-center gap-3 rounded-full bg-[#6b2447] px-5 py-3 text-xs font-semibold text-[#fffaf5] transition-colors hover:bg-[#54203a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#6b2447] ${isUrduCta?'nura-urdu-text flex-row-reverse':''}`} testId="link-offer-cta">{buttonText}<ArrowRight size={15} aria-hidden="true" /></SafeCta>}
      </div>
    </section>
  );
}

const featureIcons: Record<string, typeof Heart> = {
  heart: Heart,
  care: Heart,
  leaf: Leaf,
  natural: Leaf,
  delivery: Truck,
  truck: Truck,
  package: PackageCheck,
  packaging: PackageCheck,
  quality: ShieldCheck,
  safe: ShieldCheck,
  sparkle: Sparkles,
  sparkles:Sparkles,
  shield:ShieldCheck,
  award:Award,
  check:CheckCircle,
  lock:LockKeyhole,
};

type FeatureGridSectionProps = {
  items: HomeFeature[];
  heading?: string;
  subheading?: string;
  eyebrow?: string;
  tagline?: string;
  settings?: {
    sectionSpacingPx:number;cardGapPx:number;cardRadiusPx:number;iconSizePx:number;
    layout:'two-column'|'single-column';cardBackgroundColor:string;cardBorderColor:string;
    plumColor:string;goldColor:string;sageColor:string;
  };
} & AppearanceProps;

function BotanicalDetail({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 112 128" fill="none" aria-hidden="true">
      <path d="M12 120C40 94 56 63 67 11" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" />
      <path d="M32 91C16 83 12 70 16 59C29 63 37 74 32 91Z" stroke="currentColor" strokeWidth="1.15" />
      <path d="M45 68C61 60 66 47 62 36C49 40 41 51 45 68Z" stroke="currentColor" strokeWidth="1.15" />
      <path d="M56 43C42 35 39 23 44 13C56 18 63 30 56 43Z" stroke="currentColor" strokeWidth="1.15" />
      <path d="M23 103C10 101 3 92 3 83C14 84 23 91 23 103Z" stroke="currentColor" strokeWidth="1.15" />
    </svg>
  );
}

export function FeatureGridSection({
  items,
  appearance,
  heading,
  subheading,
  eyebrow,
  tagline,
  settings,
}: FeatureGridSectionProps) {
  const visibleFeatures=items.length===0?[
    {id:'sample-selection',title:'Considered selection',description:'Example: Share the qualities and practical details you look for when choosing products.',icon:'sparkles',visible:true},
    {id:'sample-delivery',title:'Clear delivery details',description:'Example: Explain how orders are prepared, which areas you serve, and where customers can find delivery estimates.',icon:'delivery',visible:true},
    {id:'sample-support',title:'Here when you need us',description:'Add your support email, response hours, and the best way for customers to get in touch.',icon:'heart',visible:true},
  ]:items.filter(item=>item.visible);
  const style = {
    ...sectionStyle(appearance),
    '--nura-feature-spacing': `${Math.max(28, settings?.sectionSpacingPx ?? 72)}px`,
    '--nura-feature-gap': `${Math.max(8, settings?.cardGapPx ?? 18)}px`,
    '--nura-feature-card-radius': `${Math.max(0, settings?.cardRadiusPx ?? 18)}px`,
    '--nura-feature-card-background': settings?.cardBackgroundColor || '#fffdf8',
    '--nura-feature-card-border': settings?.cardBorderColor || '#e7ddcc',
    '--nura-feature-plum':settings?.plumColor||'#4A2837',
    '--nura-feature-gold':settings?.goldColor||'#a7824a',
    '--nura-feature-sage':settings?.sageColor||'#e9ede4',
    '--nura-feature-icon-size':`${Math.max(16,Math.min(44,settings?.iconSizePx??22))}px`,
  } as CSSProperties;

  return (
    <section className="nura-feature-section" style={style} data-testid="section-home-features">
      <div className="nura-feature-inner">
        <BotanicalDetail className="nura-feature-botanical nura-feature-botanical-top" />
        <BotanicalDetail className="nura-feature-botanical nura-feature-botanical-bottom" />
        <header className="nura-feature-heading">
          <p className="eyebrow nura-feature-eyebrow" data-testid="text-home-feature-eyebrow"><span/>{eyebrow || 'WHY SHOP WITH US'}<span/></p>
          <span className="nura-feature-rule" aria-hidden="true"><span /></span>
          <h2 className="serif nura-feature-title" style={{ fontSize: 'var(--home-heading-size, clamp(34px, 4.2vw, 48px))' }} data-testid="text-home-feature-heading">{heading || 'Made with meaning'}</h2>
          <p className="nura-feature-intro" style={{ fontSize: 'var(--home-body-size, 15px)' }} data-testid="text-home-feature-intro">{subheading || 'A little more care in every choice, from the first sketch to the final detail.'}</p>
        </header>
         {visibleFeatures.length === 0 ? <EmptyState testId="empty-home-features">Turn on the feature cards you want shoppers to see, then add a short description to each one.</EmptyState> : (
          <div className="nura-feature-grid" data-layout={settings?.layout || 'two-column'} data-testid="grid-home-features">
             {visibleFeatures.map((item) => {
              const Icon = featureIcons[item.icon.trim().toLowerCase()] || Sparkles;
              return (
                <article key={item.id} className="nura-feature-card" data-testid={`card-home-feature-${item.id}`}>
                  <div className="nura-feature-card-head">
                    <span className="nura-feature-icon" aria-hidden="true"><Icon size={21} strokeWidth={1.45} /></span>
                  </div>
                  {item.title && <h3 className="serif nura-feature-card-title" style={{ fontSize: 'var(--home-heading-size, 23px)' }} data-testid={`text-home-feature-title-${item.id}`}>{item.title}</h3>}
                  {item.description && <p className="nura-feature-card-copy" style={{ fontSize: 'var(--home-body-size, 14px)' }} data-testid={`text-home-feature-description-${item.id}`}>{item.description}</p>}
                  <span className="nura-feature-card-accent" aria-hidden="true" />
                </article>
              );
            })}
          </div>
        )}
        <footer className="nura-feature-footer">
          <p className="nura-feature-tagline">{tagline || 'Considered, always. Treasured, for years.'}</p>
        </footer>
      </div>
    </section>
  );
}

export function InstagramFeedSection({ items, appearance, heading, subheading }: { items: InstagramPost[]; heading?:string; subheading?:string } & AppearanceProps) {
  const visibleItems=items;
  return (
    <section className="px-5 py-12 sm:px-8 sm:py-16" style={sectionStyle(appearance)} data-testid="section-home-instagram">
      <div className="mx-auto max-w-6xl">
        <div className={`mb-7 ${alignmentClass(appearance)}`}>
          <p className="eyebrow" data-testid="text-instagram-eyebrow">{subheading||'From our community'}</p>
          <h2 className="serif mt-2 text-[32px] sm:text-[40px]" style={{ fontSize: 'var(--home-heading-size, clamp(32px, 5vw, 40px))' }} data-testid="text-instagram-title">{heading||'From our community'}</h2>
        </div>
        {visibleItems.length === 0 ? <EmptyState testId="empty-home-instagram">Add a photo and optional caption in Admin → Content → Social Feed to introduce this section.</EmptyState> : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4" data-testid="grid-home-instagram">
            {visibleItems.map((item) => {
              const url = validExternalUrl(item.postUrl);
              const photo = (
                <figure className="group relative aspect-square overflow-hidden bg-[#eee8df]" data-testid={`card-instagram-post-${item.id}`}>
                  <StoreImage src={item.imageUrl} alt={item.caption || 'Store community update'} placeholderTitle="Community image" placeholderHint="Add a photo in Admin → Content → Social Feed." placeholderDimensions="Recommended: 1000 × 1000 px" loading="lazy" decoding="async" pictureClassName="absolute inset-0 block" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" data-testid={`img-instagram-post-${item.id}`} />
                  <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#2c241f]/75 to-transparent px-3 pb-3 pt-10 text-left text-[11px] leading-4 text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 sm:text-xs">
                    {item.caption}
                  </figcaption>
                </figure>
              );
              return url
                ? <a key={item.id} href={url} target="_blank" rel="noopener noreferrer" aria-label={item.caption ? `View post: ${item.caption}` : 'View store community post'} className="block rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6b2447]" data-testid={`link-instagram-post-${item.id}`}>{photo}</a>
                : <div key={item.id} className="block" data-testid={`instagram-post-${item.id}`}>{photo}</div>;
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function youtubeEmbedUrl(value: string): string | null {
  const valid = validExternalUrl(value);
  if (!valid) return null;
  try {
    const url = new URL(valid);
    let videoId = '';
    if (url.hostname === 'youtu.be' || url.hostname === 'www.youtu.be') videoId = url.pathname.split('/').filter(Boolean)[0] || '';
    if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.hostname)) {
      if (url.pathname === '/watch') videoId = url.searchParams.get('v') || '';
      else if (url.pathname.startsWith('/embed/')) videoId = url.pathname.split('/')[2] || '';
      else if (url.pathname.startsWith('/shorts/')) videoId = url.pathname.split('/')[2] || '';
    }
    return /^[A-Za-z0-9_-]{11}$/.test(videoId) ? `https://www.youtube-nocookie.com/embed/${videoId}` : null;
  } catch {
    return null;
  }
}

export function CustomMediaBannerSection({ content, appearance, headingOverride, subheadingOverride }: { content: HomeMediaBanner; headingOverride?:string; subheadingOverride?:string } & AppearanceProps) {
  const videoUrl = content.mode === 'video' ? validExternalUrl(content.mediaUrl) : null;
  const youtubeUrl = videoUrl ? youtubeEmbedUrl(videoUrl) : null;
  const isMp4 = Boolean(videoUrl && /\.mp4(?:$|[?#])/i.test(videoUrl));
  const hasVideo = Boolean(youtubeUrl || isMp4);
  const buttonText=content.buttonText.trim()||'Discover the collection';
  const targetUrl=content.targetUrl.trim()||'/shop';
  const hasCta = Boolean(safeInternalPath(targetUrl) || validExternalUrl(targetUrl));
  const title=headingOverride||content.title||'A closer look at the collection';
  const copy=subheadingOverride||content.copy||'Add a short introduction to the feature, collection, or story shown here. Replace this sample with details that help customers decide where to explore next.';
  const isUrduTitle=containsUrdu(title);
  const isUrduCopy=containsUrdu(copy);
  const isUrduCta=containsUrdu(buttonText);
  const media = content.mode === 'video' && hasVideo ? (
    youtubeUrl
      ? <iframe src={youtubeUrl} title={content.title || 'Store video'} className="absolute inset-0 h-full w-full" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" data-testid="embed-home-media-video" />
      : <video className="absolute inset-0 h-full w-full object-contain" controls playsInline preload="metadata" poster={content.imageUrl || undefined} data-testid="video-home-media"><source src={videoUrl || undefined} type="video/mp4" />Your browser does not support embedded video.</video>
  ) : (
    <StoreImage src={content.imageUrl} mobileSrc={content.mobileImageUrl} alt={content.title || 'Store feature'} placeholderTitle="Feature image placeholder" placeholderHint="Add a photo or video in Admin → Content → Media Banner." placeholderDimensions="Recommended: 1600 × 1200 px" loading="lazy" decoding="async" pictureClassName="absolute inset-0 block" className="h-full w-full object-contain" data-testid="img-home-media" />
  );

  return (
    <section className="px-5 py-12 sm:px-8 sm:py-16" style={sectionStyle(appearance)} data-testid="section-home-media-banner">
      <div className="mx-auto grid max-w-6xl overflow-hidden rounded-sm bg-[#f5f1e9] md:grid-cols-2" style={{ borderRadius: appearance?.borderRadiusPx ? `${appearance.borderRadiusPx}px` : undefined }}>
        <div className="relative aspect-[4/3] min-h-[220px] bg-[#ebe5dc]" data-testid="container-home-media">{media}</div>
        <div className={`flex flex-col justify-center px-6 py-8 sm:px-10 sm:py-12 ${alignmentClass(appearance)}`}>
          <h2 dir={isUrduTitle?'rtl':undefined} lang={isUrduTitle?'ur':undefined} className={`${isUrduTitle?'nura-urdu-text':'serif'} text-[32px] leading-[1.08] sm:text-[40px]`} style={{ fontSize: 'var(--home-heading-size, clamp(32px, 5vw, 40px))' }} data-testid="text-home-media-title">{title}</h2>
          <p dir={isUrduCopy?'rtl':undefined} lang={isUrduCopy?'ur':undefined} className={`mt-4 max-w-lg text-sm text-[#766d64] ${isUrduCopy?'nura-urdu-text':'leading-6'}`} style={{ fontSize: 'var(--home-body-size, 14px)' }} data-testid="text-home-media-copy">{copy}</p>
          {hasCta && <SafeCta href={targetUrl} dir={isUrduCta?'rtl':undefined} lang={isUrduCta?'ur':undefined} className={`mt-6 inline-flex min-h-11 w-fit items-center gap-3 border-b border-[#6b2447] pb-1 text-xs font-semibold text-[#6b2447] transition-colors hover:text-[#54203a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#6b2447] ${isUrduCta?'nura-urdu-text flex-row-reverse':''}`} testId="link-home-media-cta">{buttonText}<ArrowRight size={15} aria-hidden="true" /></SafeCta>}
        </div>
      </div>
    </section>
  );
}

export function FAQSection({ items, appearance, heading, subheading }: { items: HomeFaqItem[]; heading?:string; subheading?:string } & AppearanceProps) {
  const idPrefix = useId();
  const faqItems=items.length?items:[
    {id:'sample-delivery',question:'When will my order arrive?',answer:'Example answer: Add your order processing time, delivery estimate, and locations served.'},
    {id:'sample-returns',question:'How do returns or exchanges work?',answer:'Example answer: Explain your actual return window, eligibility, and how customers can contact your team.'},
    {id:'sample-support',question:'How can I contact the store?',answer:'Add the email address, phone number, or contact form customers should use.'},
  ];
  return (
    <section className="px-5 py-12 sm:px-8 sm:py-16" style={sectionStyle(appearance)} data-testid="section-home-faq">
      <div className="mx-auto max-w-4xl">
        <div className={`mb-7 ${alignmentClass(appearance)}`}>
          <p className="eyebrow" data-testid="text-faq-eyebrow">{subheading||'The useful details'}</p>
          <h2 className="serif mt-2 text-[32px] sm:text-[40px]" style={{ fontSize: 'var(--home-heading-size, clamp(32px, 5vw, 40px))' }} data-testid="text-faq-title">{heading||'A few good answers'}</h2>
        </div>
        <div className="divide-y divide-[#e4ddd4] border-y border-[#e4ddd4]" data-testid="list-home-faq">
            {faqItems.map((item, index) => {
              const answerId = `${idPrefix}-faq-answer-${index}`;
              return (
                <details key={item.id} className="group py-1" data-testid={`item-home-faq-${item.id}`}>
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6b2447] [&::-webkit-details-marker]:hidden" aria-controls={answerId} data-testid={`button-home-faq-${item.id}`}>
                    <span className="serif text-base leading-6 sm:text-lg" style={{ fontSize: 'var(--home-body-size, 16px)' }}>{item.question}</span>
                    <ChevronDown size={17} className="shrink-0 text-[#6b2447] transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
                  </summary>
                  <div id={answerId} className="max-w-3xl pb-5 pr-8 text-sm leading-6 text-[#766d64]" style={{ fontSize: 'var(--home-body-size, 14px)' }} data-testid={`text-home-faq-answer-${item.id}`}>{item.answer}</div>
                </details>
              );
            })}
        </div>
      </div>
    </section>
  );
}
