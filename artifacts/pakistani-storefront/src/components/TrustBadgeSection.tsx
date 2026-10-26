import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import {
  Award,
  CircleCheck,
  Leaf,
  LockKeyhole,
  MapPin,
  Phone,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Truck,
  type LucideIcon,
} from 'lucide-react';
import { useAdminStore } from '../context/AdminContext';
import { formatPKR } from '../utils/store';

const badgeIcons:Record<string,LucideIcon>={
  truck:Truck,
  rotate:RotateCcw,
  shield:ShieldCheck,
  phone:Phone,
  leaf:Leaf,
  sparkle:Sparkles,
  award:Award,
  lock:LockKeyhole,
  pin:MapPin,
  check:CircleCheck,
};

export default function TrustBadgeSection({headingOverride,subheadingOverride}:{headingOverride?:string;subheadingOverride?:string}={}){
  const {data}=useAdminStore();
  const cards=data.content.promiseCards.filter(card=>card.active!==false);
  const settings=data.content.trustBadgeDisplay;
  if(!cards.length)return null;

  const gridStyle={
    '--nura-trust-count':cards.length,
    '--nura-trust-title-size':`${settings.titleFontSizePx}px`,
    '--nura-trust-subtitle-size':`${settings.subtitleFontSizePx}px`,
    '--nura-trust-icon-size':`${settings.iconSizePx}px`,
    '--nura-trust-icon-box-size':`${Math.max(30,settings.iconSizePx+14)}px`,
    '--nura-trust-mobile-title-size':`${Math.min(settings.titleFontSizePx,settings.mobileLayout==='grid-3x2'?10:settings.mobileLayout==='compact-4'?11:settings.titleFontSizePx)}px`,
    '--nura-trust-mobile-subtitle-size':`${Math.min(settings.subtitleFontSizePx,settings.mobileLayout==='grid-3x2'?8:settings.mobileLayout==='compact-4'?9:settings.subtitleFontSizePx)}px`,
    '--nura-trust-mobile-icon-size':`${Math.min(settings.iconSizePx,settings.mobileLayout==='grid-3x2'?14:settings.mobileLayout==='compact-4'?15:settings.iconSizePx)}px`,
  } as CSSProperties;

   return <section className="w-full" style={{backgroundColor:data.content.theme.trustBadgeBackground}} aria-label="Store promises" data-testid="trust-badge-section">
     <div className="page-wrap">
    {(headingOverride||subheadingOverride)&&<div className="mb-4 text-center sm:mb-5"><h2 className="serif text-xl font-semibold text-[#3d3032] sm:text-2xl">{headingOverride}</h2>{subheadingOverride&&<p className="mt-1 text-xs leading-5 text-[#81766c] sm:text-sm">{subheadingOverride}</p>}</div>}
    <div
      className="nura-trust-badge-grid"
      role="list"
      data-count={cards.length}
      data-layout-desktop={settings.desktopLayout}
      data-layout-mobile={settings.mobileLayout}
      style={gridStyle}
      data-testid="trust-badge-grid"
    >
      {cards.map(card=>{
        const Icon=badgeIcons[card.icon]??CircleCheck;
        const detail=card.detail==='On orders over Rs 3,000'
          ?`On orders over ${formatPKR(data.content.announcement.freeDeliveryThreshold)}`
          :card.detail;
        const copy=`${card.title} ${detail}`.toLowerCase();
        const policyHref=/return|refund|exchange/.test(copy)?'/policies/returns':/shipping|deliver|courier/.test(copy)?'/policies/shipping':null;
        const content=<>
          <span className="nura-trust-badge-icon grid shrink-0 place-items-center rounded-full bg-[#e8ece1] text-[#60705d]">
            <Icon size={settings.iconSizePx} strokeWidth={1.6} aria-hidden="true" data-testid={`trust-badge-icon-${card.id}`}/>
          </span>
          <span className="nura-trust-badge-copy min-w-0">
            <span className="block font-semibold leading-tight" style={{fontSize:'var(--nura-trust-effective-title-size,var(--nura-trust-title-size))'}} data-testid={`trust-badge-title-${card.id}`}>{card.title}</span>
            <span className="mt-0.5 block leading-[1.35] text-[#83796f]" style={{fontSize:'var(--nura-trust-effective-subtitle-size,var(--nura-trust-subtitle-size))'}} data-testid={`trust-badge-subtitle-${card.id}`}>{detail}</span>
          </span>
        </>;
        const className="nura-trust-badge flex min-w-0 items-start gap-2.5 sm:gap-3";
        return policyHref
          ?<Link to={policyHref} className={`${className} rounded-sm transition-colors hover:text-[#6B2447] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6B2447]`} key={card.id} role="listitem" data-testid={`trust-badge-${card.id}`} aria-label={`${card.title}. Read ${policyHref.endsWith('returns')?'returns':'shipping'} policy.`}>{content}</Link>
          :<div className={className} key={card.id} role="listitem" data-testid={`trust-badge-${card.id}`}>{content}</div>;
      })}
    </div>
     </div>
  </section>;
}
