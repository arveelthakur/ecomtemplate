import { useEffect } from 'react';
import { useAdminStore } from '../context/AdminContext';
const rules = [
  ['bg', '#6B2447', '--nura-primary'], ['text', '#6B2447', '--nura-primary'], ['border', '#6B2447', '--nura-primary'],
  ['bg', '#6b2447', '--nura-primary'], ['text', '#6b2447', '--nura-primary'], ['border', '#6b2447', '--nura-primary'],
  ['bg', '#6b214c', '--nura-primary'],
  ['bg', '#FDFBF7', '--nura-background'], ['bg', '#fffefa', '--nura-background'],
  ['text', '#74816c', '--nura-accent'], ['text', '#60705d', '--nura-accent'],
];
const weights = { regular: '400', medium: '500', bold: '700' } as const;
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
    root.style.setProperty('--nura-nav-font-size', `${typography.navigation.fontSizePx}px`);
    root.style.setProperty('--nura-nav-font-weight', weights[typography.navigation.fontWeight]);
    root.style.setProperty('--nura-nav-font-style', typography.navigation.fontStyle);
    root.style.setProperty('--nura-nav-decoration', typography.navigation.textDecoration);
    root.style.setProperty('--nura-heading-font-weight', weights[typography.headings.fontWeight]);
    root.style.setProperty('--nura-heading-font-style', typography.headings.fontStyle);
    root.style.setProperty('--nura-heading-decoration', typography.headings.textDecoration);
    root.style.setProperty('--nura-heading-h1-size', `${Math.round(typography.headings.h1FontSizePx * 0.92)}px`);
    root.style.setProperty('--nura-heading-h2-size', `${Math.round(typography.headings.h2FontSizePx * 0.92)}px`);
    root.style.setProperty('--nura-heading-small-size', `${Math.min(20, Math.max(12, Math.round(typography.headings.h2FontSizePx * 0.35)))}px`);
    root.style.setProperty('--nura-product-card-size', `${typography.productTitles.cardFontSizePx}px`);
    root.style.setProperty('--nura-product-detail-size', `${Math.round(typography.productTitles.detailFontSizePx * 0.94)}px`);
    root.style.setProperty('--nura-body-font-size', `${typography.body.fontSizePx}px`);
    root.style.setProperty('--nura-body-font-weight', weights[typography.body.fontWeight]);
    root.style.setProperty('--nura-body-font-style', typography.body.fontStyle);
    root.style.setProperty('--nura-body-decoration', typography.body.textDecoration);
    for (const key of ['announcement','footerHeadings','footerBody','subFooter'] as const) {
      const group=typography[key];
      const prefix=key==='footerHeadings'?'footer-heading':key==='footerBody'?'footer-body':key==='subFooter'?'subfooter':'announcement';
      root.style.setProperty(`--nura-${prefix}-font-size`,`${group.fontSizePx}px`);
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
      .nura-storefront,.nura-commerce{font-size:17px;font-weight:500}
      .nura-storefront header nav,.nura-commerce header nav,.nura-storefront header nav a,.nura-commerce header nav a{font-size:var(--nura-nav-font-size)!important;font-weight:var(--nura-nav-font-weight)!important;font-style:var(--nura-nav-font-style)!important;text-decoration:var(--nura-nav-decoration)!important}
      .nura-storefront :is(h1,h2,h3),.nura-commerce :is(h1,h2,h3){font-weight:var(--nura-heading-font-weight)!important;font-style:var(--nura-heading-font-style)!important;text-decoration:var(--nura-heading-decoration)!important}
       .nura-storefront main [data-home-hero] h1,.nura-commerce main h1:not([data-testid="text-product-name"]){font-size:var(--nura-heading-h1-size)!important}
        @media(max-width:700px){.nura-commerce main h1:not([data-testid="text-product-name"]){font-size:min(var(--nura-heading-h1-size),12.5vw)!important;max-width:100%;overflow-wrap:anywhere}}
      .nura-storefront main h2.serif,.nura-commerce main h2.serif,.nura-commerce main section>h2{font-size:var(--nura-heading-h2-size)!important}
       .nura-storefront main [data-home-collections] h3{font-size:var(--nura-heading-small-size)!important}
       .nura-storefront main [data-home-shop] article h3,.nura-commerce main section h3{font-size:var(--nura-product-card-size)!important}
      .nura-storefront footer .serif{font-size:35px!important}
      .nura-commerce main [data-testid="text-product-name"]{font-size:var(--nura-product-detail-size)!important}
      .nura-storefront footer [data-footer-zone="heading"],.nura-commerce footer [data-footer-zone="heading"]{font-size:var(--nura-footer-heading-font-size)!important;font-weight:var(--nura-footer-heading-font-weight)!important;font-style:var(--nura-footer-heading-font-style)!important;text-decoration:var(--nura-footer-heading-decoration)!important}
       .nura-storefront main :is(p,li,label,summary,dd),.nura-commerce main :is(p,li,label,summary,dd){font-size:var(--nura-body-font-size)!important;font-weight:var(--nura-body-font-weight)!important;font-style:var(--nura-body-font-style)!important;text-decoration:var(--nura-body-decoration)!important}
        .nura-storefront main [data-testid="text-home-milestone-value"]{font-size:clamp(42px,3.8vw,48px)!important;line-height:1!important}
        .nura-storefront main [data-testid="text-home-milestone-label"]{font-size:clamp(9px,.9vw,10px)!important;line-height:1.3!important;letter-spacing:.08em!important;padding-inline:2px}
        .nura-storefront main [data-testid^="icon-home-milestone-"]{width:26px!important;height:26px!important}
        @media(max-width:700px){.nura-storefront main [data-testid="text-home-milestone-value"]{font-size:clamp(30px,8vw,38px)!important}.nura-storefront main [data-testid="icon-home-milestone-"]{width:23px!important;height:23px!important}}
      .nura-storefront footer :is(p,a:not(.serif),span:not(.serif span)),.nura-commerce footer :is(p,a,span){font-size:var(--nura-footer-body-font-size)!important;font-weight:var(--nura-footer-body-font-weight)!important;font-style:var(--nura-footer-body-font-style)!important;text-decoration:var(--nura-footer-body-decoration)!important}
      .nura-storefront footer [data-footer-zone="subfooter"],.nura-storefront footer [data-footer-zone="subfooter"] :is(p,a,span):not(.serif),.nura-commerce footer [data-footer-zone="subfooter"],.nura-commerce footer [data-footer-zone="subfooter"] :is(p,a,span):not(.serif){font-size:var(--nura-subfooter-font-size)!important;font-weight:var(--nura-subfooter-font-weight)!important;font-style:var(--nura-subfooter-font-style)!important;text-decoration:var(--nura-subfooter-decoration)!important}
      .nura-storefront>.nura-announcement [data-testid="text-announcement"],.nura-commerce>.nura-announcement [data-testid="text-announcement"]{font-size:var(--nura-announcement-font-size)!important;font-weight:var(--nura-announcement-font-weight)!important;font-style:var(--nura-announcement-font-style)!important;text-decoration:var(--nura-announcement-decoration)!important}`;
    document.head.append(style);
    return () => {
      window.removeEventListener('resize',updateScaledViewportWidth);
      style.remove();
    };
  }, [data.content.theme,data.content.typography]);
  return null;
}
