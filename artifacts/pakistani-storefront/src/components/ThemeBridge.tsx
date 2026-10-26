import { useEffect } from 'react';
import { useAdminStore } from '../context/AdminContext';
const rules = [
  ['bg', '#4A2837', '--nura-primary'], ['text', '#4A2837', '--nura-primary'], ['border', '#4A2837', '--nura-primary'],
  ['bg', '#4a2837', '--nura-primary'], ['text', '#4a2837', '--nura-primary'], ['border', '#4a2837', '--nura-primary'],
  ['bg', '#6B2447', '--nura-primary'], ['text', '#6B2447', '--nura-primary'], ['border', '#6B2447', '--nura-primary'],
  ['bg', '#6b2447', '--nura-primary'], ['text', '#6b2447', '--nura-primary'], ['border', '#6b2447', '--nura-primary'],
  ['bg', '#6b214c', '--nura-primary'],
  ['bg', '#334155', '--nura-primary'], ['text', '#334155', '--nura-primary'], ['border', '#334155', '--nura-primary'],
  ['bg', '#64748b', '--nura-accent'], ['text', '#64748b', '--nura-accent'], ['border', '#64748b', '--nura-accent'],
  ['bg', '#FDFBF7', '--nura-background'], ['bg', '#fffefa', '--nura-background'], ['bg', '#f8fafc', '--nura-background'], ['bg', '#eef2f6', '--nura-background'],
  ['text', '#74816c', '--nura-accent'], ['text', '#60705d', '--nura-accent'], ['text', '#61725c', '--nura-accent'],
];
const weights = { regular: '400', medium: '500', bold: '700' } as const;
function hexToHslChannels(hex:string){
  const red=parseInt(hex.slice(1,3),16)/255;
  const green=parseInt(hex.slice(3,5),16)/255;
  const blue=parseInt(hex.slice(5,7),16)/255;
  const maximum=Math.max(red,green,blue);
  const minimum=Math.min(red,green,blue);
  const lightness=(maximum+minimum)/2;
  let hue=0;
  let saturation=0;
  if(maximum!==minimum){
    const delta=maximum-minimum;
    saturation=lightness>.5?delta/(2-maximum-minimum):delta/(maximum+minimum);
    if(maximum===red)hue=(green-blue)/delta+(green<blue?6:0);
    else if(maximum===green)hue=(blue-red)/delta+2;
    else hue=(red-green)/delta+4;
    hue/=6;
  }
  return `${Math.round(hue*360)} ${Math.round(saturation*100)}% ${Math.round(lightness*100)}%`;
}
function isLightHex(hex:string){
  const channels=[1,3,5].map(index=>parseInt(hex.slice(index,index+2),16)/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4);
  return channels[0]!*0.2126+channels[1]!*0.7152+channels[2]!*0.0722>.55;
}
export default function ThemeBridge() {
  const { data } = useAdminStore();
  useEffect(() => {
    const theme = data.content.theme;
    const root = document.documentElement;
    for (const key of ['primary', 'accent', 'background', 'trustBadgeBackground'] as const) {
      const value = theme[key];
      if (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) {
        root.style.setProperty(`--nura-${key}`, value);
      } else {
        root.style.removeProperty(`--nura-${key}`);
      }
    }
    const semanticColors={logoDotColor:'logo-dot-color',taglineColor:'tagline-color',sectionTitleColor:'section-title-color',descriptionColor:'description-color',subtitleColor:'subtitle-color'} as const;
    for(const [key,variable] of Object.entries(semanticColors)){
      const value=theme[key as keyof typeof semanticColors];
      if(typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value))root.style.setProperty(`--nura-${variable}`,value);
      else root.style.removeProperty(`--nura-${variable}`);
    }
    root.style.setProperty('--nura-logo-dot-display',theme.logoDotVisible?'inline-block':'none');
    root.style.setProperty('--nura-logo-dot-radius',theme.logoDotShape==='square'?'0':'50%');
    const iconScale=Math.min(1.3,Math.max(.75,Number(theme.iconScale)||1));
    const textScale=Math.min(1.25,Math.max(.8,Number(theme.textScale)||1));
    root.style.setProperty('--nura-icon-scale',String(iconScale));
    root.style.setProperty('--nura-text-scale',String(textScale));
    const primaryHsl=hexToHslChannels(theme.primary);
    const accentHsl=hexToHslChannels(theme.accent);
    const backgroundHsl=hexToHslChannels(theme.background);
    const primaryFill=theme.primaryGradientMode==='gradient'
      ?`linear-gradient(135deg,${theme.primaryGradientStart},${theme.primaryGradientEnd})`
      :theme.primary;
    root.style.setProperty('--nura-primary-fill',primaryFill);
    root.style.setProperty('--nura-primary-contrast',isLightHex(theme.primary)?'#2b2320':'#FDFBF7');
    root.style.setProperty('--nura-accent-fill',theme.accent);
    root.style.setProperty('--nura-accent-contrast',isLightHex(theme.accent)?'#2b2320':'#FDFBF7');
    root.style.setProperty('--nura-global-font-family',theme.globalFontFamily==='serif'?'Georgia, \"Times New Roman\", serif':'\"DM Sans\", Manrope, Arial, sans-serif');
    root.style.setProperty('--nura-gold',theme.accent||'#C6A15B');
    root.style.setProperty('--primary',primaryHsl);
    root.style.setProperty('--ring',primaryHsl);
    root.style.setProperty('--primary-foreground',isLightHex(theme.primary)?'27 23% 19%':'40 60% 98%');
    root.style.setProperty('--accent',accentHsl);
    root.style.setProperty('--accent-foreground',isLightHex(theme.accent)?'27 23% 19%':'40 60% 98%');
    root.style.setProperty('--background',backgroundHsl);
    root.style.setProperty('--card',backgroundHsl);
    root.style.setProperty('--popover',backgroundHsl);
    root.style.setProperty('--foreground',isLightHex(theme.background)?'27 23% 19%':'40 43% 98%');
    root.style.setProperty('--card-foreground',isLightHex(theme.background)?'27 23% 19%':'40 43% 98%');
    root.style.setProperty('--popover-foreground',isLightHex(theme.background)?'27 23% 19%':'40 43% 98%');
    const density = { compact: '.84', balanced: '1', spacious: '1.18' }[theme.spacingDensity] || '1';
    const radii = theme.radiusStyle === 'sharp'
      ? { control: '4px', surface: '6px' }
      : theme.radiusStyle === 'pill'
        ? { control: '999px', surface: '16px' }
        : { control: '12px', surface: '18px' };
    const globalScale=Math.min(1.15,Math.max(.8,theme.globalScale||1));
    root.style.setProperty('--nura-global-scale',String(globalScale));
    const updateScaledViewportWidth=()=>root.style.setProperty('--nura-scaled-viewport-width',`${window.innerWidth/globalScale}px`);
    updateScaledViewportWidth();
    window.addEventListener('resize',updateScaledViewportWidth);
    root.style.setProperty('--nura-content-max-width',`${1240/globalScale}px`);
    root.style.setProperty('--nura-page-gutter',`${64/globalScale}px`);
    root.style.setProperty('--nura-mobile-gutter',`${36/globalScale}px`);
    root.style.setProperty('--nura-spacing-density', density);
    root.style.setProperty('--nura-control-radius', radii.control);
    root.style.setProperty('--nura-surface-radius', radii.surface);
    root.style.setProperty('--nura-glass-blur', `${Math.min(24,Math.max(0,theme.glassBlurPx||0))}px`);
    const typography = data.content.typography;
    root.style.setProperty('--nura-nav-font-size', `${Math.round(typography.navigation.fontSizePx*textScale)}px`);
    root.style.setProperty('--nura-nav-font-weight', weights[typography.navigation.fontWeight]);
    root.style.setProperty('--nura-nav-font-style', typography.navigation.fontStyle);
    root.style.setProperty('--nura-nav-decoration', typography.navigation.textDecoration);
    root.style.setProperty('--nura-heading-font-weight', weights[typography.headings.fontWeight]);
    root.style.setProperty('--nura-heading-font-style', typography.headings.fontStyle);
    root.style.setProperty('--nura-heading-decoration', typography.headings.textDecoration);
    root.style.setProperty('--nura-heading-h1-size', `${Math.round(typography.headings.h1FontSizePx * 0.92 * textScale)}px`);
    root.style.setProperty('--nura-heading-h2-size', `${Math.round(typography.headings.h2FontSizePx * 0.92 * textScale)}px`);
    root.style.setProperty('--nura-heading-small-size', `${Math.min(20, Math.max(12, Math.round(typography.headings.h2FontSizePx * 0.35 * textScale)))}px`);
    root.style.setProperty('--nura-product-card-size', `${Math.round(typography.productTitles.cardFontSizePx*textScale)}px`);
    root.style.setProperty('--nura-product-detail-size', `${Math.round(typography.productTitles.detailFontSizePx * 0.94 * textScale)}px`);
    root.style.setProperty('--nura-body-font-size', `${Math.round(typography.body.fontSizePx*textScale)}px`);
    root.style.setProperty('--nura-body-font-weight', weights[typography.body.fontWeight]);
    root.style.setProperty('--nura-body-font-style', typography.body.fontStyle);
    root.style.setProperty('--nura-body-decoration', typography.body.textDecoration);
    for (const key of ['announcement','footerHeadings','footerBody','subFooter'] as const) {
      const group=typography[key];
      const prefix=key==='footerHeadings'?'footer-heading':key==='footerBody'?'footer-body':key==='subFooter'?'subfooter':'announcement';
      root.style.setProperty(`--nura-${prefix}-font-size`,`${Math.round(group.fontSizePx*textScale)}px`);
      root.style.setProperty(`--nura-${prefix}-font-weight`,weights[group.fontWeight]);
      root.style.setProperty(`--nura-${prefix}-font-style`,group.fontStyle);
      root.style.setProperty(`--nura-${prefix}-decoration`,group.textDecoration);
    }
    const style = document.createElement('style');
    style.textContent = rules.map(([kind,color,variable]) => `[class~="${kind}-[${color}]"]{${kind === 'bg' ? 'background-color' : kind === 'text' ? 'color' : 'border-color'}:var(${variable})!important}`).join('\n') +
      `body{background:var(--nura-background)!important}.nura-admin{--ad-burgundy:var(--nura-primary);--ad-paper:var(--nura-background)}[class~="bg-[#FDFBF7]/95"]{background:color-mix(in srgb,var(--nura-background) 95%,transparent)!important}[class~="hover:bg-[#54203a]"]:hover,[class~="hover:bg-[#55203a]"]:hover{background:color-mix(in srgb,var(--nura-primary),black 20%)!important}
      .nura-storefront,.nura-commerce{zoom:var(--nura-global-scale,1);width:var(--nura-scaled-viewport-width,100%);max-width:none}
      .nura-storefront :is(button,input,select,textarea),.nura-commerce :is(button,input,select,textarea){border-radius:var(--nura-control-radius)!important}
      .nura-storefront :is(article,[data-theme-surface]),.nura-commerce :is(article,[data-theme-surface]){border-radius:var(--nura-surface-radius)!important}
      .nura-storefront [class*="backdrop-blur"],.nura-commerce [class*="backdrop-blur"]{backdrop-filter:blur(var(--nura-glass-blur))!important}
      .nura-storefront .nura-footer-grid,.nura-commerce .nura-footer-grid{gap:calc(36px * var(--nura-spacing-density)) calc(28px * var(--nura-spacing-density))!important}
      .nura-storefront .nura-trust-badge-grid,.nura-commerce .nura-trust-badge-grid{gap:calc(12px * var(--nura-spacing-density)) calc(10px * var(--nura-spacing-density))!important}
      .nura-storefront .page-wrap,.nura-commerce .page-wrap{width:min(var(--nura-content-max-width,1240px),calc(100% - var(--nura-page-gutter,64px) * var(--nura-spacing-density)))}
      @media(max-width:700px){.nura-storefront .page-wrap,.nura-commerce .page-wrap{width:calc(100% - var(--nura-mobile-gutter,36px))}}
       .nura-commerce [data-testid="product-detail-layout"]{min-width:0}
       .nura-commerce [data-testid="product-detail-layout"]>*,
       .nura-commerce [data-testid="product-detail-layout"]>.contents>*,
       .nura-commerce [data-testid="product-purchase-actions"]>*{min-width:0}
      [class~="bg-[#6B2447]"],[class~="bg-[#6b2447]"],[class~="bg-[#334155]"],[class*="bg-[var(--nura-primary"]{color:hsl(var(--primary-foreground))!important}
      .nura-admin{--ad-burgundy:var(--nura-primary);--ad-burgundy-deep:color-mix(in srgb,var(--nura-primary) 78%,black);--ad-paper:var(--nura-background);--ad-surface:color-mix(in srgb,var(--nura-background) 72%,white);--ad-border:color-mix(in srgb,var(--nura-primary) 14%,var(--nura-background));--ad-sage-ink:var(--nura-accent)}
       .nura-admin .ad-card,.nura-admin .ad-modal,.nura-admin .ad-notice{border-color:var(--ad-border)!important;border-radius:var(--nura-surface-radius)!important}
       .nura-admin :is(button,input,select,textarea){border-radius:var(--nura-control-radius)!important}
       .nura-storefront,.nura-commerce,.nura-admin{font-family:var(--nura-global-font-family)!important}
       .nura-storefront :is(h1,h2,h3,h4,p,li,label,button,input,select,textarea,a,small,span:not(.nura-urdu-text)),.nura-commerce :is(h1,h2,h3,h4,p,li,label,button,input,select,textarea,a,small,span:not(.nura-urdu-text)),.nura-admin :is(h1,h2,h3,h4,p,li,label,button,input,select,textarea,a,small,span){font-family:var(--nura-global-font-family)!important}
       .nura-urdu-text,.nura-urdu-text *{font-family:'Jameel Noori Nastaliq','Noto Nastaliq Urdu','Noto Sans Arabic',serif!important}
       .nura-storefront,.nura-commerce{font-size:17px;font-weight:500}
       .nura-admin .ad-btn.primary,.nura-admin .ad-btn.ad-top-store-link,.nura-storefront .nura-contact-submit,.nura-storefront [class~="bg-[#6B2447]"],.nura-storefront [class~="bg-[#6b2447]"],.nura-commerce [class~="bg-[#6B2447]"],.nura-commerce [class~="bg-[#6b2447]"],.nura-storefront [class~="bg-[#334155]"],.nura-commerce [class~="bg-[#334155]"]{background:var(--nura-primary-fill)!important;border:1px solid var(--nura-gold,#c6a15b)!important;box-shadow:0 0 0 1px color-mix(in srgb,var(--nura-gold,#c6a15b) 24%,transparent)}
       .nura-storefront .nura-hero-cta-solid,.nura-storefront .nura-hero-cta-outline,.nura-storefront .nura-hero-cta-minimal{border-color:var(--nura-gold,#c6a15b)!important}
       .nura-admin .ad-btn.primary:hover,.nura-admin .ad-btn.ad-top-store-link:hover,.nura-storefront .nura-contact-submit:hover:not(:disabled){filter:brightness(.96)}
       .nura-storefront main .nura-home-section-frame{background-color:var(--nura-background)!important;border-color:color-mix(in srgb,var(--nura-primary) 14%,var(--nura-background))!important;border-radius:var(--nura-surface-radius)!important}
      .nura-storefront header nav,.nura-commerce header nav,.nura-storefront header nav a,.nura-commerce header nav a{font-size:var(--nura-nav-font-size)!important;font-weight:var(--nura-nav-font-weight)!important;font-style:var(--nura-nav-font-style)!important;text-decoration:var(--nura-nav-decoration)!important}
      .nura-storefront :is(h1,h2,h3),.nura-commerce :is(h1,h2,h3){font-weight:var(--nura-heading-font-weight)!important;font-style:var(--nura-heading-font-style)!important;text-decoration:var(--nura-heading-decoration)!important}
       .nura-storefront main [data-home-hero] h1,.nura-commerce main h1:not([data-testid="text-product-name"]){font-size:var(--nura-heading-h1-size)!important}
        @media(max-width:700px){.nura-commerce main h1:not([data-testid="text-product-name"]){font-size:min(var(--nura-heading-h1-size),12.5vw)!important;max-width:100%;overflow-wrap:anywhere}}
      .nura-storefront main h2.serif,.nura-commerce main h2.serif,.nura-commerce main section>h2{font-size:var(--nura-heading-h2-size)!important}
       .nura-storefront main [data-home-collections] .nura-category-section-heading{font-size:clamp(24px,3vw,34px)!important;line-height:1.15!important;white-space:nowrap!important;overflow:hidden;text-overflow:ellipsis}
       .nura-storefront main [data-home-collections] h3{font-size:var(--nura-heading-small-size)!important}
       .nura-storefront main [data-home-shop] article h3,.nura-commerce main section h3{font-size:var(--nura-product-card-size)!important}
      .nura-storefront footer .serif{font-size:clamp(44px,4.5vw,52px)!important}
      .nura-commerce main [data-testid="text-product-name"]{font-size:var(--nura-product-detail-size)!important}
      .nura-storefront footer [data-footer-zone="heading"],.nura-commerce footer [data-footer-zone="heading"]{font-size:var(--nura-footer-heading-font-size)!important;font-weight:var(--nura-footer-heading-font-weight)!important;font-style:var(--nura-footer-heading-font-style)!important;text-decoration:var(--nura-footer-heading-decoration)!important}
       .nura-storefront main :is(p,li,label,summary,dd),.nura-commerce main :is(p,li,label,summary,dd){font-size:var(--nura-body-font-size)!important;font-weight:var(--nura-body-font-weight)!important;font-style:var(--nura-body-font-style)!important;text-decoration:var(--nura-body-decoration)!important}
        .nura-storefront main [data-testid="text-home-milestone-value"]{font-size:calc(clamp(42px,3.8vw,48px) * var(--nura-text-scale,1))!important;line-height:1!important}
        .nura-storefront main [data-testid="text-home-milestone-label"]{font-size:calc(clamp(9px,.9vw,10px) * var(--nura-text-scale,1))!important;line-height:1.3!important;letter-spacing:.08em!important;padding-inline:2px}
        .nura-storefront main [data-testid^="icon-home-milestone-"]{width:26px!important;height:26px!important}
        @media(max-width:700px){.nura-storefront main [data-testid="text-home-milestone-value"]{font-size:calc(clamp(30px,8vw,38px) * var(--nura-text-scale,1))!important}.nura-storefront main [data-testid="icon-home-milestone-"]{width:23px!important;height:23px!important}}
      .nura-storefront footer :is(p,a:not(.serif),span:not(.serif span)),.nura-commerce footer :is(p,a,span){font-size:var(--nura-footer-body-font-size)!important;font-weight:var(--nura-footer-body-font-weight)!important;font-style:var(--nura-footer-body-font-style)!important;text-decoration:var(--nura-footer-body-decoration)!important}
      .nura-storefront footer [data-footer-zone="subfooter"],.nura-storefront footer [data-footer-zone="subfooter"] :is(p,a,span):not(.serif),.nura-commerce footer [data-footer-zone="subfooter"],.nura-commerce footer [data-footer-zone="subfooter"] :is(p,a,span):not(.serif){font-size:var(--nura-subfooter-font-size)!important;font-weight:var(--nura-subfooter-font-weight)!important;font-style:var(--nura-subfooter-font-style)!important;text-decoration:var(--nura-subfooter-decoration)!important}
      .nura-storefront>.nura-announcement [data-testid="text-announcement"],.nura-commerce>.nura-announcement [data-testid="text-announcement"]{font-size:var(--nura-announcement-font-size)!important;font-weight:var(--nura-announcement-font-weight)!important;font-style:var(--nura-announcement-font-style)!important;text-decoration:var(--nura-announcement-decoration)!important}
      .nura-logo-dot{display:var(--nura-logo-dot-display,inline-block)!important;flex:0 0 auto;width:.16em;height:.16em;border-radius:var(--nura-logo-dot-radius,50%);background:var(--nura-logo-dot-color,#C6A15B)!important;color:transparent!important;vertical-align:baseline;translate:0 -.06em}.nura-storefront svg,.nura-commerce svg,.nura-mobile-bottom-nav svg{scale:var(--nura-icon-scale,1);transform-origin:center}
      .nura-storefront header [data-theme-role="tagline"],.nura-loader-message{color:var(--nura-tagline-color,#766D63)!important}
      .nura-storefront main h2:not([data-theme-tone="preserve"]),.nura-commerce main h2:not([data-theme-tone="preserve"]){color:var(--nura-section-title-color,var(--nura-primary))!important}
      .nura-storefront main section h2 + p:not([class*="text-white"]),.nura-commerce main section h2 + p:not([class*="text-white"]){color:var(--nura-subtitle-color,#766D63)!important}
      .nura-storefront main p:not([class*="text-white"]):not([data-theme-tone="preserve"]),.nura-commerce main p:not([class*="text-white"]):not([data-theme-tone="preserve"]){color:var(--nura-description-color,#625952)!important}
      .nura-storefront main .eyebrow,.nura-commerce main .eyebrow{color:var(--nura-tagline-color,#766D63)!important}
       .nura-theme-button,.nura-storefront .nura-contact-submit,.nura-commerce .nura-contact-submit{background:var(--nura-primary-fill,var(--nura-primary,#4A2837))!important;color:var(--nura-primary-contrast,#FDFBF7)!important;border:1px solid var(--nura-gold,#C6A15B)!important;border-radius:var(--nura-control-radius,12px)!important}
       .nura-theme-button:hover,.nura-storefront .nura-contact-submit:hover:not(:disabled),.nura-commerce .nura-contact-submit:hover:not(:disabled){filter:brightness(.96)}
       .nura-storefront .nura-product-toolbar,.nura-commerce .nura-product-toolbar{background:var(--nura-background,#FDFBF7)!important;color:var(--nura-primary,#4A2837)!important;border-color:color-mix(in srgb,var(--nura-primary,#4A2837) 18%,transparent)!important;border-radius:var(--nura-control-radius,12px)!important}
       .nura-storefront .nura-product-toolbar button,.nura-commerce .nura-product-toolbar button{color:var(--nura-primary,#4A2837)!important}
       .nura-storefront .nura-product-toolbar button[aria-pressed="true"],.nura-commerce .nura-product-toolbar button[aria-pressed="true"]{background:var(--nura-primary-fill,var(--nura-primary,#4A2837))!important;color:var(--nura-primary-contrast,#FDFBF7)!important;border-color:var(--nura-gold,#C6A15B)!important}
       .nura-storefront main :is(a,button)[class*="bg-[#6b2447]"],.nura-storefront main :is(a,button)[class*="bg-[#6B2447]"],.nura-commerce main :is(a,button)[class*="bg-[#6b2447]"],.nura-commerce main :is(a,button)[class*="bg-[#6B2447]"]{background:var(--nura-primary-fill,var(--nura-primary,#4A2837))!important;color:var(--nura-primary-contrast,#FDFBF7)!important;border-color:var(--nura-gold,#C6A15B)!important}
       .nura-storefront main :is(a,button)[class*="text-[#6b2447]"],.nura-storefront main :is(a,button)[class*="text-[#6B2447]"],.nura-commerce main :is(a,button)[class*="text-[#6b2447]"],.nura-commerce main :is(a,button)[class*="text-[#6B2447]"]{color:var(--nura-primary,#4A2837)!important}
       .nura-storefront .nura-countdown,.nura-commerce .nura-countdown{background:var(--nura-primary-fill,var(--nura-primary,#4A2837))!important;color:var(--nura-primary-contrast,#FDFBF7)!important;border:1px solid var(--nura-gold,#C6A15B)!important;border-radius:var(--nura-control-radius,12px)!important}
       .nura-storefront .nura-feature-card{background:var(--nura-background,#FDFBF7)!important;border-color:color-mix(in srgb,var(--nura-primary,#4A2837) 16%,transparent)!important;border-radius:var(--nura-control-radius,18px)!important}
       .nura-storefront footer [data-footer-zone="body"]:is(a,button),.nura-commerce footer [data-footer-zone="body"]:is(a,button){color:var(--nura-primary-contrast,#FDFBF7)!important;border-color:var(--nura-gold,#C6A15B)!important}
       .nura-storefront footer.nura-store-footer,.nura-commerce footer.nura-store-footer{background:var(--nura-primary-fill,var(--nura-primary,#4A2837))!important;color:var(--nura-primary-contrast,#FDFBF7)!important}
       .nura-storefront footer.nura-store-footer :is(p,a,span,svg),.nura-commerce footer.nura-store-footer :is(p,a,span,svg){color:var(--nura-primary-contrast,#FDFBF7)}
       .nura-storefront footer.nura-store-footer [data-footer-zone="heading"],.nura-commerce footer.nura-store-footer [data-footer-zone="heading"]{color:var(--nura-accent,#C6A15B)!important}
       .nura-storefront footer.nura-store-footer a:hover,.nura-commerce footer.nura-store-footer a:hover{color:var(--nura-accent,#C6A15B)!important}
       .nura-storefront footer.nura-store-footer .nura-footer-subfooter,.nura-commerce footer.nura-store-footer .nura-footer-subfooter{border-color:color-mix(in srgb,var(--nura-gold,#C6A15B) 38%,transparent)!important;color:var(--nura-primary-contrast,#FDFBF7)!important}
       .nura-storefront footer.nura-store-footer .nura-footer-subfooter :is(span,p,a),.nura-commerce footer.nura-store-footer .nura-footer-subfooter :is(span,p,a){color:var(--nura-primary-contrast,#FDFBF7)!important}
       .nura-storefront main [class*="border-[#6B2447]"],.nura-storefront main [class*="border-[#6b2447]"],.nura-commerce main [class*="border-[#6B2447]"],.nura-commerce main [class*="border-[#6b2447]"]{border-color:var(--nura-gold,#C6A15B)!important}`;
    document.head.append(style);
    return () => {
      window.removeEventListener('resize',updateScaledViewportWidth);
      style.remove();
    };
  }, [data.content.theme,data.content.typography]);
  return null;
}
