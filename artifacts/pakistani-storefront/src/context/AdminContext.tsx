import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { arrayRemove, collection, deleteField, doc, getDocFromServer, getDocsFromServer, onSnapshot, query, runTransaction, where, writeBatch } from '../lib/supabase/documents';
import { db } from '../lib/supabase/index';
import { useAuth } from './AuthContext';
import { cleanData } from '../utils/sanitize';
import { categories, products, defaultQuantityDiscountTiers, normalizeQuantityDiscountTiers, type Product, type QuantityDiscountSettings, type StoreCategory } from '../utils/store';
import type { SeoMetadata } from '../utils/seo';
import { canonicalStorefrontLink } from '../utils/storefrontLinks';
import { defaultFloatingWidgets, normalizeFloatingWidgets, type FloatingWidgetsSettings } from '../utils/floatingWidgets';
import { defaultHomeFeatureSectionSettings, homeSectionDefinitions, type HomeFaqItem, type HomeFeature, type HomeFeatureSectionSettings, type HomeHeroSettings, type HomeMediaBanner, type HomeNewsletterSettings, type HomeOfferBanner, type HomeSectionAppearance, type HomeSectionSetting, type InstagramPost } from '../types/homeSections';
import { adminSettingsDraftIsSynced, mergeAdminSettingsDraft, resolvePendingAdminSaveState, sanitizeAdminSettingsDraft } from '../utils/adminSettingsDraft';
import { configuredStoreName } from '../utils/branding';
import { normalizeCategoryDisplayMode } from '../utils/storefrontLayout';

type CriticalStartupFeed='settings'|'products'|'categories';

declare global {
  interface Window {
    __nuraStartupSnapshotGate?:(feed:CriticalStartupFeed)=>Promise<void>;
  }
}

function waitForStartupSnapshotTestGate(feed:CriticalStartupFeed):Promise<void>|undefined{
  if(!import.meta.env.DEV)return;
  return window.__nuraStartupSnapshotGate?.(feed);
}

export type {
  FloatingActionAnimation,
  FloatingActionKind,
  FloatingActionPosition,
  FloatingActionWidget,
  FloatingContactChannel,
  FloatingContactWidgetSettings,
  FloatingOfferAction,
  FloatingOfferBadgeSettings,
  FloatingWidgetPosition,
  FloatingWidgetsSettings,
  FloatingWidgetShape,
} from '../utils/floatingWidgets';

export type DealRule = { id:string; name:string; buyX:number; getY:number; productIds:number[]; active:boolean };
export type Coupon = { id:string; code:string; percentOff:number; minimumSubtotal:number; active:boolean; expiresAt:string };
export type AdminReview = { id:string; customer:string; city:string; text:string; rating:number; published:boolean; videoUrl:string; thumbnailUrl:string; avatarUrl?:string; createdAt:string };
export type HeroButtonStyle='solid'|'outline'|'minimal';
export type HeroButtonSettings={label:string;href:string;visible:boolean;style:HeroButtonStyle;backgroundColor:string;textColor:string;borderColor:string;transparentBackground:boolean;secondaryEnabled:boolean;secondaryLabel:string;secondaryHref:string;secondaryStyle:HeroButtonStyle;secondaryBackgroundColor:string;secondaryTextColor:string;secondaryBorderColor:string;secondaryTransparentBackground:boolean};
export type HeroContentAlignment='left'|'center'|'right';
export type HeroOverlayPosition='top-left'|'center'|'bottom-left'|'bottom-center';
export type HeroSlide = {
  id:string;eyebrow:string;title:string;copy:string;cta:string;desktopImageUrl:string;mobileImageUrl:string;
  primaryCta?:{label:string;href:string;visible:boolean;style:HeroButtonStyle};
  secondaryCta?:{enabled:boolean;label:string;href:string;style:HeroButtonStyle};
  horizontalAlignment?:HeroContentAlignment;overlayPosition?:HeroOverlayPosition;
  mobileHorizontalAlignment?:HeroContentAlignment;mobileOverlayPosition?:HeroOverlayPosition;
};
export type PromiseCard = { id:string; title:string; detail:string; icon:string; active?:boolean };
export type TrustBadgeDisplaySettings = {
  desktopLayout:'single-row'|'grid-2x2';
  mobileLayout:'single-row'|'grid-2x2'|'scroll'|'stack'|'grid-3x2'|'compact-4';
  titleFontSizePx:number;
  subtitleFontSizePx:number;
  iconSizePx:number;
};
export type ManagedNavigationItem={id:string;label:string;href:string;icon:string;visible:boolean;order:number};
export type MobileDockOrientation='horizontal'|'floating-right'|'floating-left'|'pill';
export type MobileDrawerSettings={
  widthMode:'75%'|'80%'|'custom';
  customWidthPx:number;
  showSearch:boolean;
  showCategories:boolean;
  backgroundMode:'solid'|'gradient'|'cream';
  backgroundColor:string;
  gradientStart:string;
  gradientEnd:string;
  fontSizePx:number;
  fontWeight:'regular'|'medium'|'bold';
  letterSpacingPx:number;
  rowSpacingPx:number;
  iconStyle:'minimal'|'circle'|'none';
  items:ManagedNavigationItem[];
};
export type MobileDockSettings={
  orientation:MobileDockOrientation;
  collapsible:boolean;
  collapsedByDefault:boolean;
  backgroundColor:string;
  glassmorphism:boolean;
  activeColor:string;
  inactiveColor:string;
  radiusPx:number;
  iconSizePx:number;
  textSizePx:number;
  showLabels:boolean;
};
export type StoreNavigationSettings={
  desktopLinks:ManagedNavigationItem[];
  mobileBottomBar:{enabled:boolean;items:ManagedNavigationItem[];dock:MobileDockSettings};
  drawer:MobileDrawerSettings;
};
export type AnalyticsSettings={enabled:boolean;provider:'ga4'|'custom';measurementId:string};
export type BankAccount={
  id:string;
  institution:string;
  accountTitle:string;
  accountNumberOrIban:string;
  branchInfo:string;
  instructions:string;
  active:boolean;
};
export const trustBadgePixelLimits={
  title:{min:8,max:24},
  subtitle:{min:8,max:20},
  icon:{min:12,max:40},
} as const;
const defaultTrustBadgeDisplay:TrustBadgeDisplaySettings={
  desktopLayout:'single-row',
  mobileLayout:'grid-2x2',
  titleFontSizePx:12,
  subtitleFontSizePx:10,
  iconSizePx:18,
};
export const defaultStoreNavigation:StoreNavigationSettings={
  desktopLinks:[
    {id:'home',label:'Home',href:'/',icon:'home',visible:true,order:0},
    {id:'shop',label:'Shop',href:'/shop',icon:'bag',visible:true,order:1},
    {id:'categories',label:'Categories',href:'/collections',icon:'grid',visible:true,order:2},
    {id:'wishlist',label:'Wishlist',href:'/wishlist',icon:'heart',visible:true,order:3},
    {id:'about',label:'About',href:'/about',icon:'custom',visible:true,order:4},
    {id:'reviews',label:'Kind words',href:'/reviews',icon:'custom',visible:true,order:5},
    {id:'contact',label:'Contact',href:'/contact',icon:'custom',visible:true,order:6},
  ],
  mobileBottomBar:{
    enabled:true,
    items:[
      {id:'home',label:'Home',href:'/',icon:'home',visible:true,order:0},
      {id:'shop',label:'Shop',href:'/shop',icon:'bag',visible:true,order:1},
      {id:'categories',label:'Categories',href:'/collections',icon:'grid',visible:true,order:2},
      {id:'wishlist',label:'Wishlist',href:'/wishlist',icon:'heart',visible:true,order:3},
      {id:'account',label:'Account',href:'/account',icon:'user',visible:true,order:4},
    ],
    dock:{
      orientation:'horizontal',collapsible:false,collapsedByDefault:false,backgroundColor:'#f8f3ea',glassmorphism:true,
      activeColor:'#51223d',inactiveColor:'#81766c',radiusPx:0,iconSizePx:18,textSizePx:9,showLabels:true,
    },
  },
  drawer:{
    widthMode:'80%',customWidthPx:300,showSearch:true,showCategories:true,backgroundMode:'cream',backgroundColor:'#f8f3ea',
    gradientStart:'#f8f3ea',gradientEnd:'#efe8da',fontSizePx:14,fontWeight:'medium',letterSpacingPx:0,rowSpacingPx:2,iconStyle:'minimal',
    items:[
      {id:'shop',label:'Shop',href:'/shop',icon:'bag',visible:true,order:0},
      {id:'collections',label:'Categories',href:'/collections',icon:'grid',visible:true,order:1},
      {id:'about',label:'Our story',href:'/about',icon:'book-open',visible:true,order:2},
      {id:'reviews',label:'Kind words',href:'/reviews',icon:'heart',visible:true,order:3},
      {id:'track-order',label:'Track order',href:'/track-order',icon:'truck',visible:true,order:4},
      {id:'account',label:'Account',href:'/account',icon:'user',visible:true,order:5},
      {id:'shipping',label:'Shipping',href:'/policies/shipping',icon:'package',visible:true,order:6},
      {id:'returns',label:'Returns',href:'/policies/returns',icon:'rotate-ccw',visible:true,order:7},
    ],
  },
};
export type PolicyClause = { id:string; heading:string; body:string };
export type PolicyDocument = { title:string; intro:string; clauses:PolicyClause[]; seo?:SeoMetadata };
export type InboxReply = { subject:string; body:string; senderProfileId:string; senderEmail:string; sentAt:string; provider:string; messageId:string };
export type InboxMessage = { id:string; name:string; email:string; phone:string; message:string; submittedAt:string; status:'new'|'read'|'replied'|'archived'; repliedAt?:string; replies?:InboxReply[] };

function defaultSectionAppearance():HomeSectionAppearance{
  return {backgroundColor:'',borderColor:'#e8e3dd',borderWidthPx:0,borderRadiusPx:0,borderOpacity:24,headingFontSizePx:0,bodyFontSizePx:0,alignment:'default'};
}

export function normalizeHomeSections(value:unknown):HomeSectionSetting[]{
  const rows=Array.isArray(value)?value:[];
  const known=new Map(homeSectionDefinitions.map(section=>[section.id,section]));
  const seen=new Set<string>();
  const normalized:HomeSectionSetting[]=[];
  for(const raw of rows){
    if(!raw||typeof raw!=='object')continue;
    const row=raw as Record<string,unknown>;
    if(typeof row.id!=='string'||!known.has(row.id as HomeSectionSetting['id'])||seen.has(row.id))continue;
    const id=row.id as HomeSectionSetting['id'];
    const definition=known.get(id)!;
    const savedSubheading=typeof row.subheadingOverride==='string'?row.subheadingOverride:definition.subheading;
    const savedAppearance=row.appearance&&typeof row.appearance==='object'?row.appearance as Record<string,unknown>:{};
    const defaultAppearance=defaultSectionAppearance();
    const alignment=savedAppearance.alignment;
    normalized.push({
      id,
      visible:typeof row.visible==='boolean'?row.visible:definition.defaultVisible,
      headingOverride:typeof row.headingOverride==='string'?row.headingOverride.slice(0,160):definition.heading,
      subheadingOverride:(id==='features'&&savedSubheading==='Thoughtful craft, considered quality and lasting detail.'?definition.subheading:savedSubheading).slice(0,300),
      appearance:{
        ...defaultAppearance,
        backgroundColor:typeof savedAppearance.backgroundColor==='string'&&/^#[0-9a-f]{6}$/i.test(savedAppearance.backgroundColor)?savedAppearance.backgroundColor:'',
        borderColor:typeof savedAppearance.borderColor==='string'&&/^#[0-9a-f]{6}$/i.test(savedAppearance.borderColor)?savedAppearance.borderColor:defaultAppearance.borderColor,
        borderWidthPx:typeof savedAppearance.borderWidthPx==='number'?Math.min(6,Math.max(0,Math.round(savedAppearance.borderWidthPx))):defaultAppearance.borderWidthPx,
        borderRadiusPx:typeof savedAppearance.borderRadiusPx==='number'?Math.min(40,Math.max(0,Math.round(savedAppearance.borderRadiusPx))):defaultAppearance.borderRadiusPx,
        borderOpacity:typeof savedAppearance.borderOpacity==='number'?Math.min(100,Math.max(0,Math.round(savedAppearance.borderOpacity))):defaultAppearance.borderOpacity,
        headingFontSizePx:typeof savedAppearance.headingFontSizePx==='number'?Math.min(80,Math.max(0,Math.round(savedAppearance.headingFontSizePx))):defaultAppearance.headingFontSizePx,
        bodyFontSizePx:typeof savedAppearance.bodyFontSizePx==='number'?Math.min(40,Math.max(0,Math.round(savedAppearance.bodyFontSizePx))):defaultAppearance.bodyFontSizePx,
        alignment:alignment==='left'||alignment==='center'||alignment==='right'?alignment:'default',
      },
    });
    seen.add(id);
  }
  for(const section of homeSectionDefinitions){
    if(seen.has(section.id))continue;
    normalized.push({id:section.id,visible:section.defaultVisible,headingOverride:section.heading,subheadingOverride:section.subheading,appearance:defaultSectionAppearance()});
  }
  return normalized;
}

function normalizeHeroSettings(value:unknown):HomeHeroSettings{
  const saved=value&&typeof value==='object'?value as Record<string,unknown>:{};
  const bounded=(number:unknown,fallback:number,min:number,max:number)=>typeof number==='number'&&Number.isFinite(number)?Math.min(max,Math.max(min,Math.round(number))):fallback;
  const arrowsStyle=saved.arrowsStyle;
  return {
    desktopHeightPx:bounded(saved.desktopHeightPx,560,320,900),
    mobileHeightPx:bounded(saved.mobileHeightPx,520,300,900),
    showArrows:typeof saved.showArrows==='boolean'?saved.showArrows:true,
    showCtas:typeof saved.showCtas==='boolean'?saved.showCtas:true,
    showDots:typeof saved.showDots==='boolean'?saved.showDots:true,
    arrowsStyle:arrowsStyle==='outer'||arrowsStyle==='minimal'||arrowsStyle==='overlay'?arrowsStyle:'overlay',
    autoPlayEnabled:typeof saved.autoPlayEnabled==='boolean'?saved.autoPlayEnabled:true,
    autoPlayDurationMs:bounded(saved.autoPlayDurationMs,4000,2000,12000),
  };
}

function normalizeOfferBanner(value:unknown,fallback:HomeOfferBanner):HomeOfferBanner{
  const saved=value&&typeof value==='object'?value as Record<string,unknown>:{};
  const color=(input:unknown,otherwise:string)=>typeof input==='string'&&/^#[0-9a-f]{6}$/i.test(input)?input:otherwise;
  const text=(input:unknown,otherwise:string,max:number)=>typeof input==='string'?input.slice(0,max):otherwise;
  return {
    eyebrow:text(saved.eyebrow,fallback.eyebrow,100),
    title:text(saved.title,fallback.title,160),
    copy:text(saved.copy,fallback.copy,500),
    buttonText:text(saved.buttonText,fallback.buttonText,80),
    targetUrl:text(saved.targetUrl,fallback.targetUrl,1000),
    backgroundColor:color(saved.backgroundColor,fallback.backgroundColor),
    foregroundColor:color(saved.foregroundColor,fallback.foregroundColor),
    imageUrl:text(saved.imageUrl,fallback.imageUrl,2048),
    mobileImageUrl:text(saved.mobileImageUrl,fallback.mobileImageUrl,2048),
  };
}

function normalizeFeatureCards(value:unknown,fallback:HomeFeature[],migrateStandardCard=false):HomeFeature[]{
  if(!Array.isArray(value))return fallback;
  const normalized=value.slice(0,32).flatMap((raw,index)=>{
    if(!raw||typeof raw!=='object')return [];
    const item=raw as Record<string,unknown>;
    return [{
      id:typeof item.id==='string'&&item.id?item.id.slice(0,120):`feature-${index+1}`,
      title:typeof item.title==='string'?item.title.slice(0,120):'',
      description:typeof item.description==='string'?item.description.slice(0,500):'',
      icon:typeof item.icon==='string'?item.icon.slice(0,40):'sparkles',
      visible:typeof item.visible==='boolean'?item.visible:true,
    }];
  });
  if(migrateStandardCard&&!normalized.some(item=>item.id==='feature-meaning')){
    const defaultCard=fallback.find(item=>item.id==='feature-meaning');
    if(defaultCard)normalized.push(defaultCard);
  }
  return normalized;
}

function normalizeHomeFeatureSectionSettings(value:unknown):HomeFeatureSectionSettings{
  const saved=record(value);
  const color=(input:unknown,fallback:string)=>typeof input==='string'&&/^#[0-9a-f]{6}$/i.test(input)?input:fallback;
  const number=(input:unknown,fallback:number,min:number,max:number)=>typeof input==='number'&&Number.isFinite(input)?Math.min(max,Math.max(min,Math.round(input))):fallback;
  return {
    schemaVersion:3,
    eyebrow:typeof saved.eyebrow==='string'?saved.eyebrow.slice(0,100):defaultHomeFeatureSectionSettings.eyebrow,
    tagline:typeof saved.tagline==='string'?saved.tagline.slice(0,140):defaultHomeFeatureSectionSettings.tagline,
    sectionSpacingPx:number(saved.sectionSpacingPx,defaultHomeFeatureSectionSettings.sectionSpacingPx,28,140),
    cardGapPx:number(saved.cardGapPx,defaultHomeFeatureSectionSettings.cardGapPx,8,48),
    cardRadiusPx:number(saved.cardRadiusPx,defaultHomeFeatureSectionSettings.cardRadiusPx,0,36),
    iconSizePx:number(saved.iconSizePx,defaultHomeFeatureSectionSettings.iconSizePx,16,44),
    layout:saved.layout==='single-column'?'single-column':'two-column',
    cardBackgroundColor:color(saved.cardBackgroundColor,defaultHomeFeatureSectionSettings.cardBackgroundColor),
    cardBorderColor:color(saved.cardBorderColor,defaultHomeFeatureSectionSettings.cardBorderColor),
    plumColor:color(saved.plumColor,defaultHomeFeatureSectionSettings.plumColor),
    goldColor:color(saved.goldColor,defaultHomeFeatureSectionSettings.goldColor),
    sageColor:color(saved.sageColor,defaultHomeFeatureSectionSettings.sageColor),
  };
}

function normalizeInstagramPosts(value:unknown,fallback:InstagramPost[]):InstagramPost[]{
  if(!Array.isArray(value))return fallback;
  return value.slice(0,40).flatMap((raw,index)=>{
    if(!raw||typeof raw!=='object')return [];
    const item=raw as Record<string,unknown>;
    return [{
      id:typeof item.id==='string'&&item.id?item.id.slice(0,120):`instagram-${index+1}`,
      imageUrl:typeof item.imageUrl==='string'?item.imageUrl.slice(0,1500):'',
      caption:typeof item.caption==='string'?item.caption.slice(0,240):'',
      postUrl:typeof item.postUrl==='string'?item.postUrl.slice(0,1500):'',
    }];
  });
}

function normalizeMediaBanner(value:unknown,fallback:HomeMediaBanner):HomeMediaBanner{
  const saved=value&&typeof value==='object'?value as Record<string,unknown>:{};
  const text=(key:string,limit:number)=>typeof saved[key]==='string'?(saved[key] as string).slice(0,limit):fallback[key as keyof HomeMediaBanner] as string;
  return {
    mode:saved.mode==='video'?'video':'image',
    title:text('title',160),
    copy:text('copy',500),
    buttonText:text('buttonText',80),
    imageUrl:text('imageUrl',1500),
    mobileImageUrl:text('mobileImageUrl',1500),
    mediaUrl:text('mediaUrl',1500),
    targetUrl:text('targetUrl',1500),
  };
}

function normalizeFaqItems(value:unknown,fallback:HomeFaqItem[]):HomeFaqItem[]{
  if(!Array.isArray(value))return fallback;
  return value.slice(0,60).flatMap((raw,index)=>{
    if(!raw||typeof raw!=='object')return [];
    const item=raw as Record<string,unknown>;
    return [{
      id:typeof item.id==='string'&&item.id?item.id.slice(0,120):`faq-${index+1}`,
      question:typeof item.question==='string'?item.question.slice(0,240):'',
      answer:typeof item.answer==='string'?item.answer.slice(0,1200):'',
    }];
  });
}
function normalizeMilestoneStats(value:unknown,fallback:StoreMilestoneStat[]):StoreMilestoneStat[]{
  if(!Array.isArray(value))return fallback;
  return value.slice(0,8).flatMap((raw,index)=>{
    if(!raw||typeof raw!=='object')return [];
    const item=raw as Record<string,unknown>;
    const defaults=fallback[index]??fallback[0];
    const radius=typeof item.borderRadiusPx==='number'&&Number.isFinite(item.borderRadiusPx)?Math.max(0,Math.min(32,Math.round(item.borderRadiusPx))):defaults?.borderRadiusPx??16;
    const icons=['package','heart','star','award','truck','shield','users','leaf','sparkles'];
    const rawValue=boundedString(item.value,40);
    const hasSuffix=typeof item.suffix==='string';
    const splitLegacy=!hasSuffix&&rawValue.endsWith('+');
    return [{
      ...defaults,
      id:boundedString(item.id,100,`milestone-${index+1}`)||`milestone-${index+1}`,
      value:splitLegacy?rawValue.slice(0,-1):rawValue,
      suffix:hasSuffix?boundedString(item.suffix,12):splitLegacy?'+':'',
      label:boundedString(item.label,80),
      enabled:typeof item.enabled==='boolean'?item.enabled:false,
      order:typeof item.order==='number'&&Number.isFinite(item.order)?Math.max(0,Math.min(1000,Math.round(item.order))):index,
      valueSource:item.valueSource==='products'?'products' as const:'manual' as const,
      icon:typeof item.icon==='string'&&icons.includes(item.icon)?item.icon:defaults?.icon??'package',
      iconSizePx:typeof item.iconSizePx==='number'&&Number.isFinite(item.iconSizePx)?Math.max(24,Math.min(72,Math.round(item.iconSizePx))):defaults?.iconSizePx??40,
      valueSizePx:typeof item.valueSizePx==='number'&&Number.isFinite(item.valueSizePx)?Math.max(68,Math.min(96,Math.round(item.valueSizePx))):defaults?.valueSizePx??68,
      labelSizePx:typeof item.labelSizePx==='number'&&Number.isFinite(item.labelSizePx)?Math.max(10,Math.min(20,Math.round(item.labelSizePx))):defaults?.labelSizePx??12,
      cardBackgroundColor:normalizeThemeColor(item.cardBackgroundColor,defaults?.cardBackgroundColor??'#fdfbf7'),
      borderColor:normalizeThemeColor(item.borderColor,defaults?.borderColor??'#e8e3dd'),
      borderRadiusPx:radius,
      valueColor:normalizeThemeColor(item.valueColor,defaults?.valueColor??'#6b2447'),
      labelColor:normalizeThemeColor(item.labelColor,defaults?.labelColor??'#71665e'),
      iconColor:normalizeThemeColor(item.iconColor,defaults?.iconColor??'#6b2447'),
    }];
  }).sort((a,b)=>a.order-b.order);
}
function normalizeMilestoneSettings(value:unknown):MilestoneSectionSettings{
  const saved=value&&typeof value==='object'?value as Record<string,unknown>:{};
  const text=(key:keyof MilestoneSectionSettings,fallback:string,max:number)=>typeof saved[key]==='string'?(saved[key] as string).slice(0,max):fallback;
  const layout=['single-row','single-column','double-row','double-column'].includes(String(saved.layout))
    ?saved.layout as MilestoneSectionSettings['layout']
    :'single-row';
  return {eyebrow:text('eyebrow','ABOUT OUR STORE',80),title:text('title','STORE MILESTONES',120),subheading:text('subheading','',160),description:text('description','',360),layout};
}
function normalizeMilestoneBadges(value:unknown):MilestoneBadge[]{
  if(!Array.isArray(value))return [];
  const icons=['shield-check','leaf','lock','package','heart','star'];
  return value.slice(0,8).flatMap((raw,index)=>{
    if(!raw||typeof raw!=='object')return [];
    const item=raw as Record<string,unknown>;
    return [{id:boundedString(item.id,100,`milestone-badge-${index+1}`)||`milestone-badge-${index+1}`,label:boundedString(item.label,100),icon:typeof item.icon==='string'&&icons.includes(item.icon)?item.icon:'shield-check',enabled:item.enabled===true,order:typeof item.order==='number'&&Number.isFinite(item.order)?Math.max(0,Math.min(1000,Math.round(item.order))):index}];
  }).sort((a,b)=>a.order-b.order);
}

function normalizeNewsletter(value:unknown,fallback:HomeNewsletterSettings):HomeNewsletterSettings{
  const saved=value&&typeof value==='object'?value as Record<string,unknown>:{};
  const text=(key:keyof Omit<HomeNewsletterSettings,'guarantees'>,limit:number)=>typeof saved[key]==='string'?(saved[key] as string).slice(0,300):fallback[key];
  return {
    eyebrow:text('eyebrow',100),
    title:text('title',160),
    copy:text('copy',500),
    emailPlaceholder:text('emailPlaceholder',100),
    buttonText:text('buttonText',80),
    guarantees:Array.isArray(saved.guarantees)?saved.guarantees.slice(0,6).map(item=>typeof item==='string'?item.slice(0,100):'').filter(Boolean):fallback.guarantees,
  };
}
export type TypographyStyle = 'normal'|'italic';
export type TypographyDecoration = 'none'|'underline';
export type NavigationTypography = { fontSizePx:number; fontWeight:'regular'|'bold'; fontStyle:TypographyStyle; textDecoration:TypographyDecoration };
export type HeadingTypography = { h1FontSizePx:number; h2FontSizePx:number; fontWeight:'medium'|'bold'; fontStyle:TypographyStyle; textDecoration:TypographyDecoration };
export type ContentTypography = { fontSizePx:number; fontWeight:'medium'|'bold'; fontStyle:TypographyStyle; textDecoration:TypographyDecoration };
export type ProductTitleTypography = { cardFontSizePx:number; detailFontSizePx:number };
export type StorefrontTypography = {
  navigation:NavigationTypography;
  headings:HeadingTypography;
  body:ContentTypography;
  productTitles:ProductTitleTypography;
  announcement:ContentTypography;
  footerHeadings:ContentTypography;
  footerBody:ContentTypography;
  subFooter:ContentTypography;
};
export type AnnouncementLinkType='none'|'shop'|'category'|'url';
export type AnnouncementSettings={
  text:string;
  freeDeliveryThreshold:number;
  visible:boolean;
  linkType:AnnouncementLinkType;
  linkUrl:string;
  linkCategoryId:string;
};
export type StoreMilestoneStat={
  id:string;value:string;suffix:string;label:string;enabled:boolean;order:number;valueSource:'manual'|'products';
  icon:string;cardBackgroundColor:string;borderColor:string;borderRadiusPx:number;
  valueColor:string;labelColor:string;iconColor:string;iconSizePx:number;valueSizePx:number;labelSizePx:number;
};
export type MilestoneLayout='single-row'|'single-column'|'double-row'|'double-column';
export type MilestoneSectionSettings={eyebrow:string;title:string;subheading:string;description:string;layout:MilestoneLayout};
export type MilestoneBadge={id:string;label:string;icon:string;enabled:boolean;order:number};
export type MarqueeBarStyle='classic'|'pill'|'floating'|'neon'|'minimal'|'gradient'|'split'|'outline'|'wavy'|'slanted-ribbon'|'dual-border'|'glass';
export type MarqueeBarPosition='top'|'below-header'|'footer'|'floating'|'custom';
export type MarqueeBar={id:string;text:string;visible:boolean;position:MarqueeBarPosition;style:MarqueeBarStyle;backgroundColor:string;textColor:string;speedSeconds:number;icon:string;centerBadge:string;pageMode:'all'|'home'|'specific';pagePaths:string[];customSectionId:string};
export type FooterBlockId='brand'|'explore'|'help'|'contact'|'hours'|'subfooter';
export type FooterBlockSetting={id:FooterBlockId;visible:boolean;heading:string};
export type FooterLinkItem={id:string;label:string;href:string};
export type FooterContent={
  description:string;
  hours:string;
  helpText:string;
  blocks:FooterBlockSetting[];
  exploreLinks:FooterLinkItem[];
  helpLinks:FooterLinkItem[];
  subFooter:{copyrightText:string;priceText:string;paymentNotes:string};
};
export type CountdownTimerStyle='slim-bar'|'luxury-banner'|'block-card'|'rounded-pill';
export type CountdownTimerPlacement='announcement'|'hero'|'product';
export type CountdownExpiredBehavior='hide'|'message';
export type CountdownTimerSettings={
  enabled:boolean;targetDate:string;title:string;style:CountdownTimerStyle;placement:CountdownTimerPlacement;
  backgroundColor:string;textColor:string;borderColor:string;borderWidthPx:number;borderRadiusPx:number;
  expiredBehavior:CountdownExpiredBehavior;expiredMessage:string;
};
export const defaultCountdownTimerSettings:CountdownTimerSettings={
  enabled:false,targetDate:'',title:'Limited-time offer',style:'rounded-pill',placement:'announcement',
  backgroundColor:'#6b2447',textColor:'#fffaf4',borderColor:'#d8c4ac',borderWidthPx:0,borderRadiusPx:999,
  expiredBehavior:'hide',expiredMessage:'This offer has ended.',
};
function normalizeCountdownTimer(value:unknown):CountdownTimerSettings{
  const saved=value&&typeof value==='object'?value as Record<string,unknown>:{};
  const safeColor=(candidate:unknown,fallback:string)=>typeof candidate==='string'&&/^#[0-9a-f]{6}$/i.test(candidate)?candidate:fallback;
  const number=(candidate:unknown,fallback:number,min:number,max:number)=>typeof candidate==='number'&&Number.isFinite(candidate)?Math.max(min,Math.min(max,Math.round(candidate))):fallback;
  return {
    ...defaultCountdownTimerSettings,
    enabled:saved.enabled===true,
    targetDate:typeof saved.targetDate==='string'?saved.targetDate.slice(0,40):'',
    title:typeof saved.title==='string'?saved.title.slice(0,120):defaultCountdownTimerSettings.title,
    style:['slim-bar','luxury-banner','block-card','rounded-pill'].includes(String(saved.style))?saved.style as CountdownTimerStyle:defaultCountdownTimerSettings.style,
    placement:['announcement','hero','product'].includes(String(saved.placement))?saved.placement as CountdownTimerPlacement:defaultCountdownTimerSettings.placement,
    backgroundColor:safeColor(saved.backgroundColor,defaultCountdownTimerSettings.backgroundColor),
    textColor:safeColor(saved.textColor,defaultCountdownTimerSettings.textColor),
    borderColor:safeColor(saved.borderColor,defaultCountdownTimerSettings.borderColor),
    borderWidthPx:number(saved.borderWidthPx,defaultCountdownTimerSettings.borderWidthPx,0,8),
    borderRadiusPx:number(saved.borderRadiusPx,defaultCountdownTimerSettings.borderRadiusPx,0,999),
    expiredBehavior:saved.expiredBehavior==='message'?'message':'hide',
    expiredMessage:typeof saved.expiredMessage==='string'?saved.expiredMessage.slice(0,160):defaultCountdownTimerSettings.expiredMessage,
  };
}
export type HeaderIconKey='search'|'account'|'wishlist'|'cart';
export type HeaderIconVisibility=Record<HeaderIconKey,{desktop:boolean;mobile:boolean}>;
export type HeaderCustomAction={id:string;label:string;icon:string;href:string;desktop:boolean;mobile:boolean;order:number};
export type ProductBadgePosition='top-left'|'top-right'|'bottom-left'|'bottom-right';
export type ProductBadgeStyle='pill'|'square'|'ribbon';
export type ProductCustomBadge={id:string;label:string;icon:string;enabled:boolean};
export type ProductCardBadgeSettings={
  wishlistVisible:boolean;discountVisible:boolean;tagVisible:boolean;defaultTagText:string;tagIcon:string;
  tagPosition:ProductBadgePosition;discountPosition:ProductBadgePosition;style:ProductBadgeStyle;
  backgroundColor:string;textColor:string;discountBackgroundColor:string;discountTextColor:string;opacity:number;glassmorphism:boolean;
  fontSizePx:number;fontWeight:'regular'|'medium'|'bold';letterSpacingPx:number;paddingPx:number;borderRadiusPx:number;
  customBadges:ProductCustomBadge[];
};
export type ProfileFieldId='displayName'|'phone'|'addressLine1'|'addressLine2'|'city'|'province'|'postalCode'|'birthday';
export type ProfileFieldSettings=Record<ProfileFieldId,{enabled:boolean;required:boolean}>;
export type CatalogFilterKind='price'|'availability'|'categories'|'brands'|'topRated'|'alphabetical';
export type CatalogFilterSection={
  id:string;
  kind:CatalogFilterKind;
  title:string;
  icon:string;
  headingSizePx:number;
  itemSizePx:number;
};
export type CatalogBrowsingSettings={
  filters:{price:boolean;availability:boolean;categories:boolean;brands:boolean;topRated:boolean;alphabetical:boolean};
  filterSections:CatalogFilterSection[];
  categoryIcons:Record<string,string>;
  viewSwitcher:boolean;
  toolbar:{
    showFilterButton:boolean;
    showSortDropdown:boolean;
    showViewSwitcher:boolean;
    showColumnLayoutSwitcher:boolean;
    backgroundMode:'global'|'custom';
    backgroundColor:string;
    borderColor:string;
    borderRadiusMode:'global'|'custom';
    borderRadiusPx:number;
    iconSizePx:number;
    paddingPx:number;
  };
};
export const defaultCatalogToolbarSettings:CatalogBrowsingSettings['toolbar']={
  showFilterButton:true,showSortDropdown:true,showViewSwitcher:true,showColumnLayoutSwitcher:true,
  backgroundMode:'global',backgroundColor:'#fdfbf7',borderColor:'#e5e0d8',
  borderRadiusMode:'global',borderRadiusPx:12,iconSizePx:15,paddingPx:10,
};
function normalizeCatalogToolbar(value:unknown,legacyViewSwitcher:unknown):CatalogBrowsingSettings['toolbar']{
  const saved=value&&typeof value==='object'?value as Partial<CatalogBrowsingSettings['toolbar']>:{};
  const color=(candidate:unknown,fallback:string)=>typeof candidate==='string'&&/^#[0-9a-f]{6}$/i.test(candidate)?candidate:fallback;
  const clamp=(candidate:unknown,fallback:number,min:number,max:number)=>typeof candidate==='number'&&Number.isFinite(candidate)?Math.min(max,Math.max(min,candidate)):fallback;
  return {
    showFilterButton:typeof saved.showFilterButton==='boolean'?saved.showFilterButton:true,
    showSortDropdown:typeof saved.showSortDropdown==='boolean'?saved.showSortDropdown:true,
    showViewSwitcher:typeof saved.showViewSwitcher==='boolean'?saved.showViewSwitcher:typeof legacyViewSwitcher==='boolean'?legacyViewSwitcher:true,
    showColumnLayoutSwitcher:typeof saved.showColumnLayoutSwitcher==='boolean'?saved.showColumnLayoutSwitcher:true,
    backgroundMode:saved.backgroundMode==='custom'?'custom':'global',
    backgroundColor:color(saved.backgroundColor,defaultCatalogToolbarSettings.backgroundColor),
    borderColor:color(saved.borderColor,defaultCatalogToolbarSettings.borderColor),
    borderRadiusMode:saved.borderRadiusMode==='custom'?'custom':'global',
    borderRadiusPx:clamp(saved.borderRadiusPx,defaultCatalogToolbarSettings.borderRadiusPx,0,32),
    iconSizePx:clamp(saved.iconSizePx,defaultCatalogToolbarSettings.iconSizePx,12,24),
    paddingPx:clamp(saved.paddingPx,defaultCatalogToolbarSettings.paddingPx,4,20),
  };
}
export const catalogFilterIconOptions=[
  {value:'leaf',label:'Leaf'},
  {value:'waves',label:'Waves / Hair'},
  {value:'droplets',label:'Droplets'},
  {value:'shirt',label:'Clothing'},
  {value:'tag',label:'Tag'},
  {value:'star',label:'Star'},
  {value:'layers',label:'Layers'},
  {value:'sliders',label:'Sliders'},
  {value:'package',label:'Package'},
  {value:'sparkles',label:'Sparkles'},
  {value:'shield',label:'Shield'},
] as const;
export const defaultCatalogFilterSections:CatalogFilterSection[]=[
  {id:'price',kind:'price',title:'Price Range (PKR)',icon:'sliders',headingSizePx:13,itemSizePx:12},
  {id:'availability',kind:'availability',title:'Availability',icon:'package',headingSizePx:13,itemSizePx:12},
  {id:'categories',kind:'categories',title:'Categories',icon:'layers',headingSizePx:13,itemSizePx:12},
  {id:'brands',kind:'brands',title:'Brand',icon:'tag',headingSizePx:13,itemSizePx:12},
  {id:'topRated',kind:'topRated',title:'Top Rated',icon:'star',headingSizePx:13,itemSizePx:12},
  {id:'alphabetical',kind:'alphabetical',title:'Sort A–Z',icon:'sliders',headingSizePx:13,itemSizePx:12},
];
const catalogFilterKinds:CatalogFilterKind[]=['price','availability','categories','brands','topRated','alphabetical'];
function normalizeCatalogFilterSections(value:unknown):CatalogFilterSection[]{
  if(!Array.isArray(value))return defaultCatalogFilterSections.map(section=>({...section}));
  const seen=new Set<CatalogFilterKind>();
  return value.flatMap((entry,index)=>{
    if(!entry||typeof entry!=='object')return [];
    const saved=entry as Partial<CatalogFilterSection>;
    if(!saved.kind||!catalogFilterKinds.includes(saved.kind)||seen.has(saved.kind))return [];
    seen.add(saved.kind);
    const fallback=defaultCatalogFilterSections.find(section=>section.kind===saved.kind)!;
    const clampSize=(size:unknown,defaultSize:number)=>typeof size==='number'&&Number.isFinite(size)?Math.max(9,Math.min(24,size)):defaultSize;
    const icon=typeof saved.icon==='string'&&catalogFilterIconOptions.some(option=>option.value===saved.icon)?saved.icon:fallback.icon;
    return [{
      id:typeof saved.id==='string'&&saved.id.trim()?saved.id:`${saved.kind}-${index+1}`,
      kind:saved.kind,
      title:typeof saved.title==='string'&&saved.title.trim()?saved.title:fallback.title,
      icon,
      headingSizePx:clampSize(saved.headingSizePx,fallback.headingSizePx),
      itemSizePx:clampSize(saved.itemSizePx,fallback.itemSizePx),
    }];
  });
}
export const defaultCatalogBrowsingSettings:CatalogBrowsingSettings={
  filters:{price:true,availability:true,categories:true,brands:true,topRated:true,alphabetical:true},
  filterSections:defaultCatalogFilterSections.map(section=>({...section})),
  categoryIcons:{},
  viewSwitcher:true,
  toolbar:{...defaultCatalogToolbarSettings},
};
export function normalizeCatalogBrowsingSettings(value:unknown):CatalogBrowsingSettings{
  const saved=record(value);
  const savedFilters=record(saved.filters);
  const savedIcons=record(saved.categoryIcons);
  return {
    ...defaultCatalogBrowsingSettings,
    ...saved,
    filters:Object.fromEntries(
      (Object.keys(defaultCatalogBrowsingSettings.filters) as CatalogFilterKind[])
        .map(kind=>[kind,typeof savedFilters[kind]==='boolean'?savedFilters[kind]:defaultCatalogBrowsingSettings.filters[kind]]),
    ) as CatalogBrowsingSettings['filters'],
    filterSections:normalizeCatalogFilterSections(saved.filterSections),
    categoryIcons:Object.fromEntries(Object.entries(savedIcons).filter((entry):entry is [string,string]=>typeof entry[1]==='string')),
    viewSwitcher:typeof saved.viewSwitcher==='boolean'?saved.viewSwitcher:true,
    toolbar:normalizeCatalogToolbar(saved.toolbar,saved.viewSwitcher),
  };
}
export const defaultTrustBadgeBackground='#FDFBF7';
function normalizeThemeColor(value:unknown,fallback:string,legacyDefaults:string[]=[]):string{
  if(typeof value!=='string'||!/^#[0-9a-f]{6}$/i.test(value))return fallback;
  return legacyDefaults.some(legacy=>legacy.toLowerCase()===value.toLowerCase())?fallback:value;
}
export const typographyPixelLimits = {
  navigation:{min:12,max:32},
  h1:{min:24,max:80},
  h2:{min:20,max:64},
  body:{min:12,max:32},
  productCard:{min:12,max:32},
  productDetail:{min:20,max:64},
  announcement:{min:10,max:32},
  footerHeadings:{min:10,max:32},
  footerBody:{min:10,max:32},
  subFooter:{min:8,max:24},
} as const;
export const defaultStorefrontTypography:StorefrontTypography = {
  navigation:{fontSizePx:16,fontWeight:'bold',fontStyle:'normal',textDecoration:'none'},
  headings:{h1FontSizePx:68,h2FontSizePx:42,fontWeight:'bold',fontStyle:'normal',textDecoration:'none'},
  body:{fontSizePx:15,fontWeight:'medium',fontStyle:'normal',textDecoration:'none'},
  productTitles:{cardFontSizePx:16,detailFontSizePx:40},
  announcement:{fontSizePx:11,fontWeight:'medium',fontStyle:'normal',textDecoration:'none'},
  footerHeadings:{fontSizePx:12,fontWeight:'bold',fontStyle:'normal',textDecoration:'none'},
  footerBody:{fontSizePx:12,fontWeight:'medium',fontStyle:'normal',textDecoration:'none'},
  subFooter:{fontSizePx:10,fontWeight:'medium',fontStyle:'normal',textDecoration:'none'},
};

const legacyTypographySizes = {
  navigation:{small:12,medium:14,large:16,xl:18},
  h1:{small:52,medium:60,large:68,xl:76},
  h2:{small:32,medium:37,large:42,xl:48},
  body:{small:14,medium:15,large:17,xl:19},
  productCard:{small:14,medium:15,large:16,xl:18},
  productDetail:{small:32,medium:36,large:40,xl:44},
} as const;

function readTypographyPx(value:unknown,legacyPreset:unknown,range:{min:number;max:number},legacyValues:Record<string,number>,fallback:number){
  const parsed=typeof value==='number'?value:typeof value==='string'&&value.trim()?Number(value):NaN;
  const legacy=typeof legacyPreset==='string'?legacyValues[legacyPreset]:undefined;
  const resolved=Number.isFinite(parsed)?parsed:legacy??fallback;
  return Math.min(range.max,Math.max(range.min,Math.round(resolved)));
}

function hydrateTypography(saved:Record<string,any>|undefined):StorefrontTypography{
  const navigation=saved?.navigation||{};
  const headings=saved?.headings||{};
  const body=saved?.body||{};
  const productTitles=saved?.productTitles||{};
  const hydrateContentGroup=(key:'announcement'|'footerHeadings'|'footerBody'|'subFooter')=>{
    const group=saved?.[key]||{};
    return {
      ...defaultStorefrontTypography[key],
      ...group,
      fontSizePx:readTypographyPx(group.fontSizePx,undefined,typographyPixelLimits[key],{},defaultStorefrontTypography[key].fontSizePx),
    };
  };
  const {fontSize:legacyNavigationSize,...savedNavigation}=navigation;
  const {fontSize:legacyHeadingSize,...savedHeadings}=headings;
  const {fontSize:legacyBodySize,...savedBody}=body;
  return {
    navigation:{
      ...defaultStorefrontTypography.navigation,
      ...savedNavigation,
      fontSizePx:readTypographyPx(savedNavigation.fontSizePx,legacyNavigationSize,typographyPixelLimits.navigation,legacyTypographySizes.navigation,defaultStorefrontTypography.navigation.fontSizePx),
    },
    headings:{
      ...defaultStorefrontTypography.headings,
      ...savedHeadings,
      h1FontSizePx:readTypographyPx(savedHeadings.h1FontSizePx,legacyHeadingSize,typographyPixelLimits.h1,legacyTypographySizes.h1,defaultStorefrontTypography.headings.h1FontSizePx),
      h2FontSizePx:readTypographyPx(savedHeadings.h2FontSizePx,legacyHeadingSize,typographyPixelLimits.h2,legacyTypographySizes.h2,defaultStorefrontTypography.headings.h2FontSizePx),
    },
    body:{
      ...defaultStorefrontTypography.body,
      ...savedBody,
      fontSizePx:readTypographyPx(savedBody.fontSizePx,legacyBodySize,typographyPixelLimits.body,legacyTypographySizes.body,defaultStorefrontTypography.body.fontSizePx),
    },
    productTitles:{
      ...defaultStorefrontTypography.productTitles,
      ...productTitles,
      cardFontSizePx:readTypographyPx(productTitles.cardFontSizePx,legacyHeadingSize,typographyPixelLimits.productCard,legacyTypographySizes.productCard,defaultStorefrontTypography.productTitles.cardFontSizePx),
      detailFontSizePx:readTypographyPx(productTitles.detailFontSizePx,legacyHeadingSize,typographyPixelLimits.productDetail,legacyTypographySizes.productDetail,defaultStorefrontTypography.productTitles.detailFontSizePx),
    },
    announcement:hydrateContentGroup('announcement'),
    footerHeadings:hydrateContentGroup('footerHeadings'),
    footerBody:hydrateContentGroup('footerBody'),
    subFooter:hydrateContentGroup('subFooter'),
  };
}

const defaultAnnouncement:AnnouncementSettings={
  text:'',
  freeDeliveryThreshold:3000,
  visible:false,
  linkType:'none',
  linkUrl:'',
  linkCategoryId:'',
};

function normalizeTrustBadgeDisplay(value:unknown):TrustBadgeDisplaySettings{
  const saved=value&&typeof value==='object'?value as Record<string,unknown>:{};
  const bounded=(input:unknown,range:{min:number;max:number},fallback:number)=>{
    const parsed=typeof input==='number'?input:typeof input==='string'&&input.trim()?Number(input):NaN;
    const size=Number.isFinite(parsed)?parsed:fallback;
    return Math.min(range.max,Math.max(range.min,Math.round(size)));
  };
  return {
    desktopLayout:saved.desktopLayout==='grid-2x2'?'grid-2x2':'single-row',
    mobileLayout:['single-row','grid-2x2','scroll','stack','grid-3x2','compact-4'].includes(String(saved.mobileLayout))
      ?saved.mobileLayout as TrustBadgeDisplaySettings['mobileLayout']
      :defaultTrustBadgeDisplay.mobileLayout,
    titleFontSizePx:bounded(saved.titleFontSizePx,trustBadgePixelLimits.title,defaultTrustBadgeDisplay.titleFontSizePx),
    subtitleFontSizePx:bounded(saved.subtitleFontSizePx,trustBadgePixelLimits.subtitle,defaultTrustBadgeDisplay.subtitleFontSizePx),
    iconSizePx:bounded(saved.iconSizePx,trustBadgePixelLimits.icon,defaultTrustBadgeDisplay.iconSizePx),
  };
}

function safeNavigationHref(value:unknown,fallback:string){
  if(typeof value!=='string')return fallback;
  const href=value.trim().slice(0,500);
  if(href.startsWith('/')&&!href.startsWith('//')&&!href.startsWith('/#'))return href;
  if(/^(https?:\/\/|mailto:|tel:)/i.test(href))return href;
  return fallback;
}
function normalizeNavigationItems(value:unknown,defaults:ManagedNavigationItem[]):ManagedNavigationItem[]{
  const rows=Array.isArray(value)?value:[];
  const seen=new Set<string>();
  const normalized:ManagedNavigationItem[]=[];
  for(const [index,raw] of rows.entries()){
    if(!raw||typeof raw!=='object')continue;
    const saved=raw as Record<string,unknown>;
    const id=typeof saved.id==='string'?saved.id.trim().slice(0,60):'';
    if(!id||seen.has(id))continue;
    seen.add(id);
    const fallback=defaults.find(item=>item.id===id);
    const order=Number(saved.order);
    normalized.push({
      id,
      label:typeof saved.label==='string'&&saved.label.trim()?saved.label.trim().slice(0,40):fallback?.label||'New link',
      href:safeNavigationHref(saved.href,fallback?.href||'/shop'),
      icon:typeof saved.icon==='string'?saved.icon.trim().slice(0,32):fallback?.icon||'custom',
      visible:saved.visible!==false,
      order:Number.isFinite(order)?Math.max(0,Math.min(1000,Math.round(order))):index,
    });
  }
  const nextOrder=normalized.length;
  defaults.forEach((item,index)=>{
    if(seen.has(item.id))return;
    normalized.push({...item,order:nextOrder+index});
  });
  return normalized.sort((a,b)=>a.order-b.order).map((item,index)=>({...item,order:index}));
}
function normalizeHeroSlides(value:unknown,fallback:HeroSlide[],forcePrimaryOutline=false):HeroSlide[]{
  if(!Array.isArray(value))return fallback.map(slide=>({...slide,primaryCta:slide.primaryCta?{...slide.primaryCta,style:forcePrimaryOutline?'outline':slide.primaryCta.style}:undefined}));
  const alignment=(candidate:unknown,defaultValue:HeroContentAlignment):HeroContentAlignment=>candidate==='center'||candidate==='right'||candidate==='left'?candidate:defaultValue;
  const overlay=(candidate:unknown,defaultValue:HeroOverlayPosition):HeroOverlayPosition=>candidate==='top-left'||candidate==='center'||candidate==='bottom-left'||candidate==='bottom-center'?candidate:defaultValue;
  const buttonStyle=(candidate:unknown,defaultValue:HeroButtonStyle='outline'):HeroButtonStyle=>candidate==='outline'||candidate==='minimal'||candidate==='solid'?candidate:defaultValue;
  return value.flatMap((entry,index)=>{
    if(!entry||typeof entry!=='object')return [];
    const saved=entry as Record<string,unknown>;
    const id=typeof saved.id==='string'&&saved.id.trim()?saved.id.slice(0,80):`hero-${index+1}`;
    const prior:HeroSlide=fallback[index]||fallback[0]||{
      id,eyebrow:'',title:'',copy:'',cta:'',desktopImageUrl:'',mobileImageUrl:'',
      primaryCta:{label:'',href:'/shop',visible:false,style:'outline'},
      secondaryCta:{enabled:false,label:'',href:'/shop',style:'outline'},
    };
    const primary=saved.primaryCta&&typeof saved.primaryCta==='object'?saved.primaryCta as Record<string,unknown>:{};
    const secondary=saved.secondaryCta&&typeof saved.secondaryCta==='object'?saved.secondaryCta as Record<string,unknown>:{};
    const legacyCta=typeof saved.cta==='string'?saved.cta.slice(0,80):prior.cta;
    return [{
      id,
      eyebrow:typeof saved.eyebrow==='string'?saved.eyebrow.slice(0,180):prior.eyebrow,
      title:typeof saved.title==='string'?saved.title.slice(0,300):prior.title,
      copy:typeof saved.copy==='string'?saved.copy.slice(0,500):prior.copy,
      cta:typeof primary.label==='string'?primary.label.slice(0,80):legacyCta,
      desktopImageUrl:typeof saved.desktopImageUrl==='string'?saved.desktopImageUrl.slice(0,1500):prior.desktopImageUrl,
      mobileImageUrl:typeof saved.mobileImageUrl==='string'?saved.mobileImageUrl.slice(0,1500):prior.mobileImageUrl,
      primaryCta:{label:typeof primary.label==='string'?primary.label.slice(0,80):legacyCta,href:typeof primary.href==='string'?primary.href.slice(0,1000):'/shop',visible:primary.visible!==false,style:forcePrimaryOutline?'outline':buttonStyle(primary.style,prior.primaryCta?.style??'outline')},
      secondaryCta:{enabled:secondary.enabled===true,label:typeof secondary.label==='string'?secondary.label.slice(0,80):'',href:typeof secondary.href==='string'?secondary.href.slice(0,1000):'/shop',style:buttonStyle(secondary.style)},
      horizontalAlignment:alignment(saved.horizontalAlignment,'left'),
      overlayPosition:overlay(saved.overlayPosition,'bottom-left'),
      mobileHorizontalAlignment:alignment(saved.mobileHorizontalAlignment,'left'),
      mobileOverlayPosition:overlay(saved.mobileOverlayPosition,'bottom-left'),
    }];
  });
}
function normalizeHeroButtonSettings(value:unknown,slides:unknown,fallback:HeroButtonSettings):HeroButtonSettings{
  const saved=value&&typeof value==='object'?value as Record<string,unknown>:{};
  const first=Array.isArray(slides)&&slides[0]&&typeof slides[0]==='object'?slides[0] as Record<string,unknown>:{};
  const legacy=first.primaryCta&&typeof first.primaryCta==='object'?first.primaryCta as Record<string,unknown>:{};
  const legacySecondary=first.secondaryCta&&typeof first.secondaryCta==='object'?first.secondaryCta as Record<string,unknown>:{};
  const color=(value:unknown,defaultValue:string)=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)?value:defaultValue;
  return {
    label:typeof saved.label==='string'?saved.label.slice(0,80):typeof legacy.label==='string'?legacy.label.slice(0,80):typeof first.cta==='string'?first.cta.slice(0,80):fallback.label,
    href:safeNavigationHref(saved.href,typeof legacy.href==='string'?legacy.href:fallback.href),
    visible:typeof saved.visible==='boolean'?saved.visible:legacy.visible!==false,
    style:saved.style==='solid'||saved.style==='outline'||saved.style==='minimal'?saved.style:fallback.style,
    backgroundColor:color(saved.backgroundColor,fallback.backgroundColor),
    textColor:color(saved.textColor,fallback.textColor),
    borderColor:color(saved.borderColor,fallback.borderColor),
    transparentBackground:typeof saved.transparentBackground==='boolean'?saved.transparentBackground:fallback.transparentBackground,
    secondaryEnabled:typeof saved.secondaryEnabled==='boolean'?saved.secondaryEnabled:legacySecondary.enabled===true,
    secondaryLabel:typeof saved.secondaryLabel==='string'?saved.secondaryLabel.slice(0,80):typeof legacySecondary.label==='string'?legacySecondary.label.slice(0,80):'Learn more',
    secondaryHref:safeNavigationHref(saved.secondaryHref,typeof legacySecondary.href==='string'?legacySecondary.href:'/about'),
    secondaryStyle:saved.secondaryStyle==='solid'||saved.secondaryStyle==='outline'||saved.secondaryStyle==='minimal'?saved.secondaryStyle:'outline',
    secondaryBackgroundColor:color(saved.secondaryBackgroundColor,'#6B2447'),
    secondaryTextColor:color(saved.secondaryTextColor,'#FFFFFF'),
    secondaryBorderColor:color(saved.secondaryBorderColor,'#FFFFFF'),
    secondaryTransparentBackground:typeof saved.secondaryTransparentBackground==='boolean'?saved.secondaryTransparentBackground:true,
  };
}
function normalizeMobileDock(value:unknown):MobileDockSettings{
  const saved=value&&typeof value==='object'?value as Record<string,unknown>:{};
  const fallback=defaultStoreNavigation.mobileBottomBar.dock;
  const pixel=(candidate:unknown,fallbackValue:number,min:number,max:number)=>typeof candidate==='number'&&Number.isFinite(candidate)?Math.max(min,Math.min(max,Math.round(candidate))):fallbackValue;
  const color=(candidate:unknown,defaultValue:string)=>typeof candidate==='string'&&/^#[0-9a-f]{6}$/i.test(candidate)?candidate:defaultValue;
  const orientation=saved.orientation;
  return {
    ...fallback,
    orientation:orientation==='floating-right'||orientation==='floating-left'||orientation==='pill'||orientation==='horizontal'?orientation:fallback.orientation,
    collapsible:saved.collapsible===true,
    collapsedByDefault:saved.collapsedByDefault===true,
    backgroundColor:color(saved.backgroundColor,fallback.backgroundColor),
    glassmorphism:typeof saved.glassmorphism==='boolean'?saved.glassmorphism:fallback.glassmorphism,
    activeColor:color(saved.activeColor,fallback.activeColor),
    inactiveColor:color(saved.inactiveColor,fallback.inactiveColor),
    radiusPx:pixel(saved.radiusPx,fallback.radiusPx,0,40),
    iconSizePx:pixel(saved.iconSizePx,fallback.iconSizePx,14,32),
    textSizePx:pixel(saved.textSizePx,fallback.textSizePx,8,16),
    showLabels:typeof saved.showLabels==='boolean'?saved.showLabels:fallback.showLabels,
  };
}
function normalizeMobileDrawer(value:unknown):MobileDrawerSettings{
  const saved=value&&typeof value==='object'?value as Record<string,unknown>:{};
  const fallback=defaultStoreNavigation.drawer;
  const pixel=(candidate:unknown,fallbackValue:number,min:number,max:number)=>typeof candidate==='number'&&Number.isFinite(candidate)?Math.max(min,Math.min(max,Math.round(candidate))):fallbackValue;
  const color=(candidate:unknown,defaultValue:string)=>typeof candidate==='string'&&/^#[0-9a-f]{6}$/i.test(candidate)?candidate:defaultValue;
  return {
    ...fallback,
    widthMode:saved.widthMode==='75%'?'75%':saved.widthMode==='80%'?'80%':saved.widthMode==='85%'?'80%':saved.widthMode==='custom'?'custom':fallback.widthMode,
    customWidthPx:pixel(saved.customWidthPx,fallback.customWidthPx,240,320),
    showSearch:typeof saved.showSearch==='boolean'?saved.showSearch:fallback.showSearch,
    showCategories:typeof saved.showCategories==='boolean'?saved.showCategories:fallback.showCategories,
    backgroundMode:saved.backgroundMode==='solid'||saved.backgroundMode==='gradient'||saved.backgroundMode==='cream'?saved.backgroundMode:fallback.backgroundMode,
    backgroundColor:color(saved.backgroundColor,fallback.backgroundColor),
    gradientStart:color(saved.gradientStart,fallback.gradientStart),
    gradientEnd:color(saved.gradientEnd,fallback.gradientEnd),
    fontSizePx:pixel(saved.fontSizePx,fallback.fontSizePx,12,24),
    fontWeight:saved.fontWeight==='regular'||saved.fontWeight==='bold'||saved.fontWeight==='medium'?saved.fontWeight:fallback.fontWeight,
    letterSpacingPx:typeof saved.letterSpacingPx==='number'&&Number.isFinite(saved.letterSpacingPx)?Math.max(0,Math.min(3,saved.letterSpacingPx)):fallback.letterSpacingPx,
    rowSpacingPx:pixel(saved.rowSpacingPx,fallback.rowSpacingPx,0,16),
    iconStyle:saved.iconStyle==='minimal'||saved.iconStyle==='circle'||saved.iconStyle==='none'?saved.iconStyle:fallback.iconStyle,
    items:normalizeNavigationItems(saved.items,fallback.items),
  };
}
function normalizeStoreNavigation(value:unknown):StoreNavigationSettings{
  const saved=value&&typeof value==='object'?value as Record<string,unknown>:{};
  const mobile=saved.mobileBottomBar&&typeof saved.mobileBottomBar==='object'
    ?saved.mobileBottomBar as Record<string,unknown>:{};
  return {
    desktopLinks:normalizeNavigationItems(saved.desktopLinks,defaultStoreNavigation.desktopLinks),
    mobileBottomBar:{
      enabled:mobile.enabled!==false,
      items:normalizeNavigationItems(mobile.items,defaultStoreNavigation.mobileBottomBar.items),
      dock:normalizeMobileDock(mobile.dock),
    },
    drawer:normalizeMobileDrawer(saved.drawer),
  };
}
function mergeSharedSettings(base:unknown,local:unknown,remote:unknown,path:string,forceOverwritePaths:readonly string[]=[]):unknown{
  const same=(left:unknown,right:unknown):boolean=>{
    if(Object.is(left,right))return true;
    if(Array.isArray(left)||Array.isArray(right)){
      return Array.isArray(left)&&Array.isArray(right)
        &&left.length===right.length
        &&left.every((value,index)=>same(value,right[index]));
    }
    if(left===null||right===null||typeof left!=='object'||typeof right!=='object')return false;
    const leftRecord=left as Record<string,unknown>;
    const rightRecord=right as Record<string,unknown>;
    const leftKeys=Object.keys(leftRecord);
    const rightKeys=Object.keys(rightRecord);
    return leftKeys.length===rightKeys.length
      &&leftKeys.every(key=>Object.hasOwn(rightRecord,key)&&same(leftRecord[key],rightRecord[key]));
  };
  if(remote===undefined&&base!==undefined)remote=base;
  if(same(local,base))return remote;
  if(forceOverwritePaths.some(forcePath=>path===forcePath||path.startsWith(`${forcePath}.`)))return local===undefined?deleteField():local;
  if(local===undefined&&base!==undefined&&same(remote,base))return deleteField();
  if(same(remote,base)||same(local,remote))return local;
  if(base!==null&&local!==null&&remote!==null
    &&typeof base==='object'&&typeof local==='object'&&typeof remote==='object'
    &&!Array.isArray(base)&&!Array.isArray(local)&&!Array.isArray(remote)){
    const before=base as Record<string,unknown>;
    const edited=local as Record<string,unknown>;
    const latest=remote as Record<string,unknown>;
    const merged:Record<string,unknown>={};
    const keys=new Set([...Object.keys(before),...Object.keys(edited),...Object.keys(latest)]);
    keys.forEach(key=>{
      const value=mergeSharedSettings(before[key],edited[key],latest[key],`${path}.${key}`,forceOverwritePaths);
      if(value!==undefined)merged[key]=value;
    });
    return merged;
  }
  const navigationPath=path.startsWith('content.navigation.')?path.slice('content.'.length):path;
  if(navigationPath==='navigation.drawer.items'
    &&Array.isArray(base)&&Array.isArray(local)&&Array.isArray(remote)){
    const byId=(items:unknown[])=>new Map(items.map(item=>{
      const value=item&&typeof item==='object'?item as Record<string,unknown>:{};
      return [String(value.id??''),value] as const;
    }));
    const before=byId(base);
    const edited=byId(local);
    const latest=byId(remote);
    const baseIds=base.map(item=>String((item as Record<string,unknown>)?.id??''));
    const localIds=local.map(item=>String((item as Record<string,unknown>)?.id??''));
    const remoteIds=remote.map(item=>String((item as Record<string,unknown>)?.id??''));
    const localStructureChanged=!same(localIds,baseIds);
    const remoteStructureChanged=!same(remoteIds,baseIds);
    let mergedIds:string[];
    if(!localStructureChanged)mergedIds=remoteIds;
    else if(!remoteStructureChanged)mergedIds=localIds;
    else if(same(localIds,remoteIds))mergedIds=localIds;
    else mergedIds=localIds;

    return mergedIds.map(id=>{
      const value=mergeSharedSettings(before.get(id),edited.get(id),latest.get(id),`${path}.${id}`,forceOverwritePaths);
      return value as Record<string,unknown>;
    });
  }
  // Concurrent edits to the same value are last-write-wins: this transaction
  // is the latest committed save, so persist this session's value.
  return local===undefined?deleteField():local;
}
function removeUndefinedStoreValues<T>(value:T):T{
  if(Array.isArray(value))return value.filter(item=>item!==undefined).map(removeUndefinedStoreValues) as T;
  if(value&&typeof value==='object'){
    const prototype=Object.getPrototypeOf(value);
    // Keep adapter sentinels (for example deleteField()) intact.
    if(prototype!==Object.prototype&&prototype!==null)return value;
    return Object.fromEntries(
      Object.entries(value as Record<string,unknown>)
        .filter(([,entry])=>entry!==undefined)
        .map(([key,entry])=>[key,removeUndefinedStoreValues(entry)]),
    ) as T;
  }
  return value;
}
const headerIconKeys:HeaderIconKey[]=['search','account','wishlist','cart'];
function normalizeHeaderIconVisibility(value:unknown,legacy:AdminSettings['headerIcons']):HeaderIconVisibility{
  const saved=value&&typeof value==='object'?value as Record<string,unknown>:{};
  return Object.fromEntries(headerIconKeys.map(key=>{
    const item=saved[key]&&typeof saved[key]==='object'?saved[key] as Record<string,unknown>:{};
    return [key,{
      desktop:typeof item.desktop==='boolean'?item.desktop:legacy[key],
      mobile:typeof item.mobile==='boolean'?item.mobile:legacy[key],
    }];
  })) as HeaderIconVisibility;
}
function normalizeHeaderCustomActions(value:unknown):HeaderCustomAction[]{
  if(!Array.isArray(value))return [];
  return value.flatMap((entry,index)=>{
    if(!entry||typeof entry!=='object')return [];
    const saved=entry as Record<string,unknown>;
    const id=typeof saved.id==='string'&&saved.id.trim()?saved.id.slice(0,80):`header-action-${index+1}`;
    const order=Number(saved.order);
    return [{
      id,
      label:typeof saved.label==='string'?saved.label.slice(0,48):'',
      icon:typeof saved.icon==='string'?saved.icon.slice(0,40):'sparkles',
      href:safeNavigationHref(saved.href,'/shop'),
      desktop:saved.desktop!==false,
      mobile:saved.mobile===true,
      order:Number.isFinite(order)?Math.max(0,Math.min(1000,Math.round(order))):index,
    }];
  }).sort((a,b)=>a.order-b.order);
}
function normalizeProductBadgeSettings(value:unknown):ProductCardBadgeSettings{
  const saved=value&&typeof value==='object'?value as Record<string,unknown>:{};
  const fallback=defaultProductCardBadgeSettings;
  const hex=(candidate:unknown,defaultValue:string)=>typeof candidate==='string'&&/^#[0-9a-f]{6}$/i.test(candidate)?candidate:defaultValue;
  const px=(candidate:unknown,defaultValue:number,min:number,max:number)=>typeof candidate==='number'&&Number.isFinite(candidate)?Math.max(min,Math.min(max,candidate)):defaultValue;
  const position=(candidate:unknown,defaultValue:ProductBadgePosition):ProductBadgePosition=>candidate==='top-left'||candidate==='top-right'||candidate==='bottom-left'||candidate==='bottom-right'?candidate:defaultValue;
  const rawBadges=Array.isArray(saved.customBadges)?saved.customBadges:[];
  const customBadges=rawBadges.slice(0,12).flatMap((entry,index)=>{
    if(!entry||typeof entry!=='object')return [];
    const badge=entry as Record<string,unknown>;
    const label=typeof badge.label==='string'?badge.label.trim().slice(0,32):'';
    if(!label)return [];
    return [{id:typeof badge.id==='string'&&badge.id.trim()?badge.id.slice(0,80):`custom-badge-${index+1}`,label,icon:typeof badge.icon==='string'?badge.icon.slice(0,32):'tag',enabled:badge.enabled!==false}];
  });
  return {
    wishlistVisible:typeof saved.wishlistVisible==='boolean'?saved.wishlistVisible:fallback.wishlistVisible,
    discountVisible:typeof saved.discountVisible==='boolean'?saved.discountVisible:fallback.discountVisible,
    tagVisible:typeof saved.tagVisible==='boolean'?saved.tagVisible:fallback.tagVisible,
    defaultTagText:typeof saved.defaultTagText==='string'?saved.defaultTagText.slice(0,40):fallback.defaultTagText,
    tagIcon:typeof saved.tagIcon==='string'?saved.tagIcon.slice(0,32):fallback.tagIcon,
    tagPosition:position(saved.tagPosition,fallback.tagPosition),
    discountPosition:position(saved.discountPosition,fallback.discountPosition),
    style:saved.style==='square'||saved.style==='ribbon'||saved.style==='pill'?saved.style:fallback.style,
    backgroundColor:hex(saved.backgroundColor,fallback.backgroundColor),
    textColor:hex(saved.textColor,fallback.textColor),
    discountBackgroundColor:hex(saved.discountBackgroundColor,fallback.discountBackgroundColor),
    discountTextColor:hex(saved.discountTextColor,fallback.discountTextColor),
    opacity:px(saved.opacity,fallback.opacity,20,100),
    glassmorphism:saved.glassmorphism===true,
    fontSizePx:px(saved.fontSizePx,fallback.fontSizePx,8,18),
    fontWeight:saved.fontWeight==='regular'||saved.fontWeight==='medium'||saved.fontWeight==='bold'?saved.fontWeight:fallback.fontWeight,
    letterSpacingPx:px(saved.letterSpacingPx,fallback.letterSpacingPx,0,3),
    paddingPx:px(saved.paddingPx,fallback.paddingPx,2,18),
    borderRadiusPx:px(saved.borderRadiusPx,fallback.borderRadiusPx,0,999),
    customBadges,
  };
}
function normalizeProfileFieldSettings(value:unknown):ProfileFieldSettings{
  const saved=value&&typeof value==='object'?value as Record<string,unknown>:{};
  const fields:ProfileFieldId[]=['displayName','phone','addressLine1','addressLine2','city','province','postalCode','birthday'];
  return Object.fromEntries(fields.map(field=>{
    const candidate=saved[field]&&typeof saved[field]==='object'?saved[field] as Record<string,unknown>:{};
    const fallback=defaultProfileFieldSettings[field];
    return [field,{enabled:typeof candidate.enabled==='boolean'?candidate.enabled:fallback.enabled,required:typeof candidate.required==='boolean'?candidate.required:fallback.required}];
  })) as ProfileFieldSettings;
}
function normalizeAnalyticsSettings(value:unknown):AnalyticsSettings{
  const saved=value&&typeof value==='object'?value as Record<string,unknown>:{};
  const provider=['ga4','custom'].includes(String(saved.provider))
    ?saved.provider as AnalyticsSettings['provider']:'ga4';
  const measurementId=typeof saved.measurementId==='string'?saved.measurementId.trim().slice(0,64):'';
  return {
    enabled:saved.enabled===true,
    provider,
    measurementId:/^G-[A-Z0-9-]+$/i.test(measurementId)?measurementId:'',
  };
}
function normalizePreloaderSettings(value:unknown):PreloaderSettings{
  const saved=value&&typeof value==='object'?value as Record<string,unknown>:{};
  const rawDuration=Number(saved.minimumDisplayMs);
  const style=saved.style;
  const normalizedStyle:PreloaderStyle=style==='store-logo'||style==='favicon'||style==='minimal-spinner'
    ?style
    :style==='plum-spinner'
      ?'minimal-spinner'
      :'nura-pulse';
  return {
    enabled:typeof saved.enabled==='boolean'?saved.enabled:defaultPreloaderSettings.enabled,
    style:normalizedStyle,
    loadingText:typeof saved.loadingText==='string'?saved.loadingText.trim().slice(0,80):defaultPreloaderSettings.loadingText,
    minimumDisplayMs:Number.isFinite(rawDuration)?Math.max(500,Math.min(1500,Math.round(rawDuration/50)*50)):defaultPreloaderSettings.minimumDisplayMs,
  };
}
function normalizeBankAccounts(value:unknown,legacy:Record<string,unknown>):BankAccount[]{
  if(Array.isArray(value)){
    const seen=new Set<string>();
    return value.flatMap((raw,index)=>{
      if(!raw||typeof raw!=='object')return [];
      const saved=raw as Record<string,unknown>;
      const id=typeof saved.id==='string'&&saved.id.trim()?saved.id.trim().slice(0,80):`bank-${index+1}`;
      if(seen.has(id))return [];
      seen.add(id);
      return [{
        id,
        institution:typeof saved.institution==='string'?saved.institution.slice(0,100):'',
        accountTitle:typeof saved.accountTitle==='string'?saved.accountTitle.slice(0,160):'',
        accountNumberOrIban:typeof saved.accountNumberOrIban==='string'?saved.accountNumberOrIban.slice(0,100):'',
        branchInfo:typeof saved.branchInfo==='string'?saved.branchInfo.slice(0,160):'',
        instructions:typeof saved.instructions==='string'?saved.instructions.slice(0,500):'',
        active:saved.active!==false,
      }];
    });
  }
  const institution=typeof legacy.bankName==='string'?legacy.bankName.trim():'';
  const accountTitle=typeof legacy.bankAccountTitle==='string'?legacy.bankAccountTitle.trim():'';
  const accountNumberOrIban=typeof legacy.bankAccountNumberOrIban==='string'?legacy.bankAccountNumberOrIban.trim():'';
  return institution&&accountTitle&&accountNumberOrIban?[{
    id:'legacy-bank-account',
    institution:institution.slice(0,100),
    accountTitle:accountTitle.slice(0,160),
    accountNumberOrIban:accountNumberOrIban.slice(0,100),
    branchInfo:'',
    instructions:'',
    active:true,
  }]:[];
}

const footerBlockIds:FooterBlockId[]=['brand','explore','help','contact','hours','subfooter'];
const defaultFooterContent:FooterContent={
  description:'A thoughtfully curated selection of useful, well-made pieces for everyday life. Replace this example with a short introduction to your store.',
  hours:'Example hours: Monday–Saturday, 10:00 am–6:00 pm. Confirm your actual opening hours before publishing.',
  helpText:'Contact our team for help with products, orders, or delivery.',
  blocks:[
    {id:'brand',visible:true,heading:''},
    {id:'explore',visible:true,heading:'EXPLORE'},
    {id:'help',visible:true,heading:'HERE TO HELP'},
    {id:'contact',visible:true,heading:'STAY IN TOUCH'},
    {id:'hours',visible:true,heading:'BUSINESS HOURS'},
    {id:'subfooter',visible:true,heading:''},
  ],
  exploreLinks:[
     {id:'shop',label:'Shop all products',href:'/shop'},
     {id:'collections',label:'Browse categories',href:'/collections'},
     {id:'story',label:'About us',href:'/about'},
     {id:'reviews',label:'Customer reviews',href:'/reviews'},
    {id:'continue-shopping',label:'Continue shopping',href:'/collections'},
  ],
  helpLinks:[
    {id:'shipping',label:'Shipping policy',href:'/policies/shipping'},
    {id:'returns',label:'Return policy',href:'/policies/returns'},
    {id:'track',label:'Track an order',href:'/track-order'},
    {id:'terms',label:'Terms & conditions',href:'/policies/terms'},
    {id:'privacy',label:'Privacy policy',href:'/policies/privacy'},
  ],
  subFooter:{
    copyrightText:'Made thoughtfully in Pakistan.',
    priceText:'Prices in {currency}',
    paymentNotes:'Payment options are shown at checkout',
  },
};

function normalizeAnnouncement(value:unknown):AnnouncementSettings{
  const saved=value&&typeof value==='object'?value as Record<string,unknown>:{};
  const linkType=saved.linkType;
  return {
    ...defaultAnnouncement,
    text:typeof saved.text==='string'?saved.text.slice(0,140):defaultAnnouncement.text,
    freeDeliveryThreshold:typeof saved.freeDeliveryThreshold==='number'&&Number.isFinite(saved.freeDeliveryThreshold)?Math.max(0,saved.freeDeliveryThreshold):defaultAnnouncement.freeDeliveryThreshold,
    visible:typeof saved.visible==='boolean'?saved.visible:defaultAnnouncement.visible,
    linkType:linkType==='shop'||linkType==='category'||linkType==='url'||linkType==='none'?linkType:defaultAnnouncement.linkType,
    linkUrl:typeof saved.linkUrl==='string'?saved.linkUrl.slice(0,1000):defaultAnnouncement.linkUrl,
    linkCategoryId:typeof saved.linkCategoryId==='string'?saved.linkCategoryId.slice(0,120):defaultAnnouncement.linkCategoryId,
  };
}
function normalizeMarqueeBars(value:unknown):MarqueeBar[]{
  if(!Array.isArray(value))return [];
  const positions:MarqueeBarPosition[]=['top','below-header','footer','floating','custom'];
  const styles:MarqueeBarStyle[]=['classic','pill','floating','neon','minimal','gradient','split','outline','wavy','slanted-ribbon','dual-border','glass'];
  return value.slice(0,12).flatMap((raw,index)=>{
    if(!raw||typeof raw!=='object')return [];
    const item=raw as Record<string,unknown>;
    const color=(input:unknown,fallback:string)=>typeof input==='string'&&/^#[0-9a-f]{6}$/i.test(input)?input:fallback;
    return [{
      id:boundedString(item.id,100,`marquee-${index+1}`),
      text:boundedString(item.text,240),
      visible:item.visible===true,
      position:positions.includes(item.position as MarqueeBarPosition)?item.position as MarqueeBarPosition:'top',
      style:styles.includes(item.style as MarqueeBarStyle)?item.style as MarqueeBarStyle:'classic',
      backgroundColor:color(item.backgroundColor,'#6b2447'),
      textColor:color(item.textColor,'#fffaf4'),
      speedSeconds:typeof item.speedSeconds==='number'&&Number.isFinite(item.speedSeconds)?Math.max(8,Math.min(50,Math.round(item.speedSeconds))):24,
      icon:boundedString(item.icon,16),
      centerBadge:boundedString(item.centerBadge,40),
      pageMode:item.pageMode==='home'||item.pageMode==='specific'?item.pageMode:'all',
      pagePaths:Array.isArray(item.pagePaths)?item.pagePaths.slice(0,30).flatMap(path=>typeof path==='string'&&path.startsWith('/')&&!path.startsWith('//')?[path.slice(0,180)]:[]):[],
      customSectionId:boundedString(item.customSectionId,80),
    }];
  });
}

function normalizeFooterLinks(value:unknown,fallback:FooterLinkItem[]):FooterLinkItem[]{
  if(!Array.isArray(value))return fallback;
  return value.flatMap((entry,index)=>{
    if(!entry||typeof entry!=='object')return [];
    const link=entry as Record<string,unknown>;
    return [{
      id:typeof link.id==='string'?link.id.slice(0,120):`footer-link-${index}`,
      label:typeof link.label==='string'?link.label.slice(0,80):'',
      href:typeof link.href==='string'?canonicalStorefrontLink(link.href.slice(0,1000)):'',
    }];
  });
}

function normalizeFooter(value:unknown):FooterContent{
  const saved=value&&typeof value==='object'?value as Record<string,unknown>:{};
  const rawBlocks=Array.isArray(saved.blocks)?saved.blocks:defaultFooterContent.blocks;
  const seen=new Set<FooterBlockId>();
  const blocks:FooterBlockSetting[]=[];
  for(const entry of rawBlocks){
    if(!entry||typeof entry!=='object')continue;
    const candidate=entry as Record<string,unknown>;
    const id=candidate.id;
    if(typeof id!=='string'||!footerBlockIds.includes(id as FooterBlockId)||seen.has(id as FooterBlockId))continue;
    const blockId=id as FooterBlockId;
    const fallback=defaultFooterContent.blocks.find(block=>block.id===blockId)!;
    blocks.push({
      id:blockId,
      visible:typeof candidate.visible==='boolean'?candidate.visible:fallback.visible,
      heading:typeof candidate.heading==='string'?candidate.heading.slice(0,80):fallback.heading,
    });
    seen.add(blockId);
  }
  for(const block of defaultFooterContent.blocks)if(!seen.has(block.id))blocks.push(block);
  const subFooter=saved.subFooter&&typeof saved.subFooter==='object'?saved.subFooter as Record<string,unknown>:{};
  return {
    ...defaultFooterContent,
    description:typeof saved.description==='string'?saved.description.slice(0,2000):defaultFooterContent.description,
    hours:typeof saved.hours==='string'?saved.hours.slice(0,500):defaultFooterContent.hours,
    helpText:typeof saved.helpText==='string'?saved.helpText.slice(0,1000):defaultFooterContent.helpText,
    blocks,
    exploreLinks:normalizeFooterLinks(saved.exploreLinks,defaultFooterContent.exploreLinks),
    helpLinks:normalizeFooterLinks(saved.helpLinks,defaultFooterContent.helpLinks),
    subFooter:{
      copyrightText:typeof subFooter.copyrightText==='string'?subFooter.copyrightText.slice(0,240):defaultFooterContent.subFooter.copyrightText,
      priceText:typeof subFooter.priceText==='string'?subFooter.priceText.slice(0,240):defaultFooterContent.subFooter.priceText,
      paymentNotes:typeof subFooter.paymentNotes==='string'?subFooter.paymentNotes.slice(0,300):defaultFooterContent.subFooter.paymentNotes,
    },
  };
}
export type StorefrontContent = {
  announcement:AnnouncementSettings;
  marqueeBars:MarqueeBar[];
  categoryLayout:'circle'|'box';
  categoryDisplayMode:'grid'|'horizontal';
  categoryMotionStyle:'auto'|'manual';
  categoryMotionSpeed:'slow'|'medium'|'fast';
  reviewCarousel:{autoScroll:boolean;showArrows:boolean;speedSeconds:number;layout:'horizontal'|'grid'};
  bestsellerCarousel:{autoScroll:boolean;showArrows:boolean;speedSeconds:number;layout:'horizontal'|'grid'};
  newArrivalsCarousel:{autoScroll:boolean;showArrows:boolean;speedSeconds:number;layout:'horizontal'|'grid'};
  showCategoryProductCount:boolean;
  homeAnimations:boolean;
  storePages:StorePageCopySettings;
  storePageLayouts:StorePageLayouts;
  heroSlides:HeroSlide[];
  heroSettings:HomeHeroSettings;
  heroButtonSettings:HeroButtonSettings;
  story:{ eyebrow:string; title:string; paragraphOne:string; paragraphTwo:string; imageUrl:string; imageCaption:string; buttonText:string; urduTitle:string; urduCopy:string; seo?:Partial<SeoMetadata> };
  promiseCards:PromiseCard[];
  trustBadgeDisplay:TrustBadgeDisplaySettings;
  navigation:StoreNavigationSettings;
  contact:{ phone:string; email:string; address:string };
  footer:FooterContent;
  homeSections:HomeSectionSetting[];
  offerBanner:HomeOfferBanner;
  featureCards:HomeFeature[];
  featureSectionSettings:HomeFeatureSectionSettings;
  instagramPosts:InstagramPost[];
  homeMediaBanner:HomeMediaBanner;
  homeFaq:HomeFaqItem[];
  milestoneStats:StoreMilestoneStat[];
  milestoneSettings:MilestoneSectionSettings;
  milestoneBadges:MilestoneBadge[];
  newsletter:HomeNewsletterSettings;
  productGalleryStyle:'grid'|'slider';
  quantityDiscounts:QuantityDiscountSettings;
  floatingWidgets:FloatingWidgetsSettings;
  countdownTimer:CountdownTimerSettings;
  pdpSections:{videoReviews:boolean;accordions:boolean;trustBadges:boolean;relatedProducts:boolean};
  relatedProductsSettings:{title:string;subtitle:string;productLimit:number;prioritizeSameCategory:boolean};
  theme:{
    primary:string;accent:string;background:string;trustBadgeBackground:string;
    primaryGradientMode:'solid'|'gradient';primaryGradientStart:string;primaryGradientEnd:string;globalFontFamily:'sans-serif'|'serif';
    globalScale:number;radiusStyle:'sharp'|'rounded'|'pill';glassBlurPx:number;spacingDensity:'compact'|'balanced'|'spacious';
  };
  typography:StorefrontTypography;
};
export type StorePageCopySettings={
  catalog:{title:string;intro:string;emptyTitle:string;emptyBody:string};
  cart:{title:string;intro:string;emptyTitle:string;emptyBody:string;checkoutLabel:string};
  checkout:{title:string;intro:string;submitLabel:string};
  account:{title:string;intro:string;welcomeTitle:string;welcomeIntro:string};
  wishlist:{title:string;intro:string;emptyTitle:string;emptyBody:string;shopLabel:string};
};
export type StorePageLayoutId='catalog'|'cart'|'checkout'|'account'|'wishlist';
export type StorePageModuleSetting={id:string;visible:boolean};
export type StorePageLayouts=Record<StorePageLayoutId,StorePageModuleSetting[]>;
export const defaultStorePageLayouts:StorePageLayouts={
  catalog:[{id:'filters',visible:true},{id:'productGrid',visible:true}],
  cart:[{id:'items',visible:true},{id:'summary',visible:true}],
  checkout:[{id:'deliveryDetails',visible:true},{id:'payment',visible:true}],
  account:[{id:'welcome',visible:true},{id:'quickStats',visible:true},{id:'orderHistory',visible:true}],
  wishlist:[{id:'savedItems',visible:true},{id:'wishlistActions',visible:true}],
};
const requiredStorePageModules:Record<StorePageLayoutId,Set<string>>={
  catalog:new Set(['productGrid']),
  cart:new Set(['items','summary']),
  checkout:new Set(['deliveryDetails','payment']),
  account:new Set(),
  wishlist:new Set(['savedItems']),
};
export function normalizeStorePageLayouts(value:unknown):StorePageLayouts{
  const saved=value&&typeof value==='object'?value as Record<string,unknown>:{};
  return Object.fromEntries((Object.keys(defaultStorePageLayouts) as StorePageLayoutId[]).map(page=>{
    const defaults=defaultStorePageLayouts[page];
    const incoming=Array.isArray(saved[page])?saved[page] as unknown[]:[];
    const normalized:StorePageModuleSetting[]=[];
    for(const entry of incoming){
      if(!entry||typeof entry!=='object')continue;
      const candidate=entry as Record<string,unknown>;
      const fallback=defaults.find(module=>module.id===candidate.id);
      if(!fallback||normalized.some(module=>module.id===fallback.id))continue;
      const required=requiredStorePageModules[page].has(fallback.id);
      normalized.push({id:fallback.id,visible:required?true:typeof candidate.visible==='boolean'?candidate.visible:fallback.visible});
    }
    for(const module of defaults)if(!normalized.some(current=>current.id===module.id))normalized.push({...module});
    return [page,normalized];
  })) as StorePageLayouts;
}
export const defaultStorePageCopySettings:StorePageCopySettings={
  catalog:{title:'Shop all products',intro:'Browse products and refine the results by price, availability, category, or brand.',emptyTitle:'No products found',emptyBody:'Try adjusting your search or filters.'},
  cart:{title:'Your cart',intro:'Review the products you plan to order.',emptyTitle:'Your cart is empty.',emptyBody:'Products you add will appear here.',checkoutLabel:'Continue to checkout'},
  checkout:{title:'Checkout',intro:'Enter your details to place an order.',submitLabel:'Place order'},
  account:{title:'Your account',intro:'Sign in or create an account to place orders and view your history.',welcomeTitle:'Welcome back, {firstName}.',welcomeIntro:'View your orders and manage your account details.'},
  wishlist:{title:'Your wishlist',intro:'Products you save for later.',emptyTitle:'Your wishlist is empty.',emptyBody:'Save a product to find it here later.',shopLabel:'Explore the shop'},
};
export function normalizeStorePageCopySettings(value:unknown):StorePageCopySettings{
  const saved=value&&typeof value==='object'?value as Record<string,unknown>:{};
  const normalizeGroup=<K extends keyof StorePageCopySettings,>(key:K):StorePageCopySettings[K]=>{
    const source=saved[key]&&typeof saved[key]==='object'?saved[key] as Record<string,unknown>:{};
    const fallback=defaultStorePageCopySettings[key];
    return Object.fromEntries(Object.entries(fallback).map(([field,defaultValue])=>[
      field,typeof source[field]==='string'?source[field].slice(0,field.toLowerCase().includes('intro')||field.toLowerCase().includes('body')?500:140):defaultValue,
    ])) as StorePageCopySettings[K];
  };
  return {catalog:normalizeGroup('catalog'),cart:normalizeGroup('cart'),checkout:normalizeGroup('checkout'),account:normalizeGroup('account'),wishlist:normalizeGroup('wishlist')};
}
export type AdminSettings = {
  socialUrls:Record<string,string>;
  headerLogoAlignment:'left'|'center'|'right';
  headerIcons:{search:boolean;account:boolean;wishlist:boolean;cart:boolean};
  headerIconVisibility:HeaderIconVisibility;
  headerCustomActions:HeaderCustomAction[];
  analytics:AnalyticsSettings;
  security:{appCheckEnabled:boolean};
  preloader:PreloaderSettings;
  productCardBadges:ProductCardBadgeSettings;
  profileFields:ProfileFieldSettings;
  seo:GlobalSeoSettings;
  recaptchaSiteKey:string;
  recaptchaSecretConfigured:boolean;
   general:{ storeName:string; storeSubtitle:string; storeLogoUrl:string; faviconUrl:string; currency:string; deliveryFee:number; cashOnDelivery:boolean; autoCompressUploads:boolean; codWhatsAppEnabled:boolean; codWhatsAppAutoSendEnabled:boolean; codWhatsAppNumber:string; codWhatsAppPhoneNumberId:string; codWhatsAppTemplateName:string; codWhatsAppLanguage:string; whatsappAdminNotificationsEnabled:boolean; whatsappAdminPhone:string; whatsappAdminOrderTemplateName:string; whatsappShippingUpdatesEnabled:boolean; whatsappShippedTemplateName:string; whatsappOutForDeliveryTemplateName:string; whatsappReviewRequestsEnabled:boolean; whatsappReviewTemplateName:string; whatsappAbandonedCartEnabled:boolean; whatsappAbandonedCartTemplateName:string; whatsappMarketingTemplateName:string };
  paymentDetails:{
    bankName:string;
    bankAccountTitle:string;
    bankAccountNumberOrIban:string;
    bankAccounts:BankAccount[];
    easypaisaAccountTitle:string;
    easypaisaNumber:string;
    jazzcashAccountTitle:string;
    jazzcashNumber:string;
  };
  catalogBrowsing:CatalogBrowsingSettings;
};
export type SeoPageKey='home'|'shop'|'collections'|'about'|'reviews';
export type GlobalSeoSettings={autoGenerate:boolean;pages:Record<SeoPageKey,Partial<SeoMetadata>>};
export const defaultGlobalSeoSettings:GlobalSeoSettings={
  autoGenerate:true,
  pages:{home:{},shop:{},collections:{},about:{},reviews:{}},
};
export type PreloaderStyle='nura-pulse'|'store-logo'|'favicon'|'minimal-spinner';
export type PreloaderSettings={
  enabled:boolean;
  style:PreloaderStyle;
  loadingText:string;
  minimumDisplayMs:number;
};
export const defaultPreloaderSettings:PreloaderSettings={
  enabled:true,
  style:'nura-pulse',
  loadingText:'Loading your store...',
  minimumDisplayMs:500,
};
export const defaultHeaderIconVisibility:HeaderIconVisibility={
  search:{desktop:true,mobile:true},account:{desktop:true,mobile:true},wishlist:{desktop:true,mobile:true},cart:{desktop:true,mobile:true},
};
export const defaultProductCardBadgeSettings:ProductCardBadgeSettings={
  wishlistVisible:true,discountVisible:true,tagVisible:true,defaultTagText:'',tagIcon:'tag',
  tagPosition:'top-left',discountPosition:'bottom-left',style:'pill',
  backgroundColor:'#51223d',textColor:'#f8f3ea',discountBackgroundColor:'#b08d4f',discountTextColor:'#fffdf8',
  opacity:100,glassmorphism:false,fontSizePx:9,fontWeight:'bold',letterSpacingPx:0.6,paddingPx:8,borderRadiusPx:999,
  customBadges:[],
};
export const defaultProfileFieldSettings:ProfileFieldSettings={
  displayName:{enabled:true,required:true},phone:{enabled:true,required:false},addressLine1:{enabled:true,required:false},
  addressLine2:{enabled:true,required:false},city:{enabled:true,required:false},province:{enabled:true,required:false},
  postalCode:{enabled:true,required:false},birthday:{enabled:true,required:false},
};
export type AdminData = {
  products:Product[];
  categories:StoreCategory[];
  deals:DealRule[];
  coupons:Coupon[];
  reviews:AdminReview[];
  content:StorefrontContent;
  policies:Record<'terms'|'privacy'|'shipping'|'return',PolicyDocument>;
  inbox:InboxMessage[];
  settings:AdminSettings;
};
export type AdminSaveScope=keyof AdminData|`content.${string}`|`settings.${string}`;
export type AdminSaveResult='remote'|'local';
const RESTORED_SETTINGS_SAVE_SCOPES:AdminSaveScope[]=[
  'content',
  'settings.general',
  'settings.socialUrls',
  'settings.headerLogoAlignment',
  'settings.headerIconVisibility',
  'settings.headerCustomActions',
  'settings.preloader',
  'settings.seo',
  'settings.productCardBadges',
  'settings.profileFields',
  'settings.catalogBrowsing',
];
export type AdminContextValue = {
  data:AdminData;
  setData:Dispatch<SetStateAction<AdminData>>;
  storefrontSettingsState:'loading'|'ready'|'error';
   saving:boolean;
   dirty:boolean;
   syncError:string;
   localDraftAvailable:boolean;
   localDraftRestored:boolean;
   saveRetryAvailable:boolean;
   restoreLocalDraft:()=>Promise<void>;
   discardLocalDraft:()=>void;
    flushAllRestoredSettings:()=>Promise<AdminSaveResult>;
    restoredSettingsDirty:boolean;
   initialized:boolean;
   catalogReady:boolean;
    categoriesReady:boolean;
   flush:(scope?:AdminSaveScope|AdminSaveScope[])=>Promise<AdminSaveResult>;
   seedStore:()=>Promise<void>;
};

export const defaultAdminData:AdminData={
  products,
  categories,
  deals:[],
  coupons:[],
  reviews:[],
  content:{
    announcement:defaultAnnouncement,
    marqueeBars:[],
    categoryLayout:'box',
    categoryDisplayMode:'grid',
    categoryMotionStyle:'auto',
    categoryMotionSpeed:'medium',
    reviewCarousel:{autoScroll:false,showArrows:true,speedSeconds:30,layout:'horizontal'},
    bestsellerCarousel:{autoScroll:false,showArrows:true,speedSeconds:30,layout:'horizontal'},
    newArrivalsCarousel:{autoScroll:false,showArrows:true,speedSeconds:30,layout:'horizontal'},
     showCategoryProductCount:true,
    homeAnimations:true,
    storePages:defaultStorePageCopySettings,
    storePageLayouts:defaultStorePageLayouts,
     heroSlides:[],
     heroSettings:{desktopHeightPx:560,mobileHeightPx:520,showArrows:true,showCtas:true,showDots:true,arrowsStyle:'overlay',autoPlayEnabled:true,autoPlayDurationMs:4000},
      heroButtonSettings:{label:'Shop products',href:'/shop',visible:true,style:'outline',backgroundColor:'#334155',textColor:'#334155',borderColor:'#334155',transparentBackground:true,secondaryEnabled:false,secondaryLabel:'About us',secondaryHref:'/about',secondaryStyle:'outline',secondaryBackgroundColor:'#334155',secondaryTextColor:'#FFFFFF',secondaryBorderColor:'#FFFFFF',secondaryTransparentBackground:true},
      story:{eyebrow:'Our story',title:'A thoughtful shop for everyday life',paragraphOne:'We bring together considered essentials that make daily routines feel a little more intentional. Each piece is chosen for its useful details, enduring quality, and the way it fits into real life.',paragraphTwo:'This is sample copy. Replace it with your own story, product values, sourcing details, and the people behind your store before launch.',imageUrl:'',imageCaption:'',buttonText:'Learn more',urduTitle:'',urduCopy:''},
     promiseCards:[],
     trustBadgeDisplay:defaultTrustBadgeDisplay,
     navigation:defaultStoreNavigation,
     contact:{phone:'',email:'',address:''},
    footer:defaultFooterContent,
    homeSections:homeSectionDefinitions.map(section=>({id:section.id,visible:section.defaultVisible,headingOverride:section.heading,subheadingOverride:section.subheading,appearance:defaultSectionAppearance()})),
      offerBanner:{eyebrow:'',title:'',copy:'',buttonText:'',targetUrl:'/shop',backgroundColor:'#f1f5f9',foregroundColor:'#1e293b',imageUrl:'',mobileImageUrl:''},
     featureCards:[
       {id:'sample-selection',title:'Considered selection',description:'Example: Share the qualities and practical details you look for when choosing products.',icon:'sparkles',visible:true},
       {id:'sample-delivery',title:'Clear delivery details',description:'Example: Explain how orders are prepared, which areas you serve, and where customers can find delivery estimates.',icon:'delivery',visible:true},
       {id:'sample-support',title:'Here when you need us',description:'Add your support email, response hours, and the best way for customers to get in touch.',icon:'heart',visible:true},
     ],
    featureSectionSettings:defaultHomeFeatureSectionSettings,
    instagramPosts:[],
      homeMediaBanner:{mode:'image',title:'',copy:'',buttonText:'',imageUrl:'',mobileImageUrl:'',mediaUrl:'',targetUrl:'/shop'},
      homeFaq:[
        {id:'sample-shipping',question:'When will my order arrive?',answer:'Example answer: Add your order processing time, delivery window, and the locations you serve.'},
        {id:'sample-returns',question:'Can I request a return or exchange?',answer:'Example answer: Explain your actual return window, eligibility rules, and how customers can contact your team.'},
        {id:'sample-support',question:'How can I contact the store?',answer:'Add the email address, phone number, or contact form your customers should use.'},
      ],
     milestoneStats:[],
      milestoneSettings:{eyebrow:'',title:'',subheading:'',description:'',layout:'single-row'},
     milestoneBadges:[],
      newsletter:{eyebrow:'Occasional notes',title:'Stay in touch',copy:'Hear about new arrivals, useful updates, and considered offers. Replace this example with your own newsletter invitation.',emailPlaceholder:'Your email address',buttonText:'Subscribe',guarantees:[]},
    productGalleryStyle:'grid',
    quantityDiscounts:{enabled:false,tiers:defaultQuantityDiscountTiers},
    floatingWidgets:defaultFloatingWidgets,
     countdownTimer:defaultCountdownTimerSettings,
    pdpSections:{videoReviews:true,accordions:true,trustBadges:true,relatedProducts:true},
      relatedProductsSettings:{title:'You may also like',subtitle:'More products to explore.',productLimit:4,prioritizeSameCategory:true},
        theme:{primary:'#4A2837',accent:'#4A2837',background:'#FDFBF7',trustBadgeBackground:defaultTrustBadgeBackground,primaryGradientMode:'solid',primaryGradientStart:'#4A2837',primaryGradientEnd:'#6B2447',globalFontFamily:'sans-serif',globalScale:1,radiusStyle:'rounded',glassBlurPx:10,spacingDensity:'balanced'},
    typography:defaultStorefrontTypography,
  },
  policies:{
    terms:{title:'Terms of use',intro:'Example terms for a storefront template. Review and replace these details with the rules that apply to your business before accepting orders.',clauses:[
      {id:'orders-and-prices',heading:'Orders and pricing',body:'Example: Product availability, prices, and delivery charges are confirmed at checkout. Replace this text with your order acceptance, pricing, and cancellation terms.'},
      {id:'product-details',heading:'Product information',body:'Example: Product descriptions and images are provided to help customers choose. Add any important sizing, color, care, or product-specific conditions.'},
      {id:'contact-terms',heading:'Questions about these terms',body:'Add the store email address or contact method customers should use for questions about an order or these terms.'},
    ]},
    privacy:{title:'Privacy policy',intro:'Example privacy information for a storefront template. Confirm what your store actually collects, why it is used, and which providers process it before publishing.',clauses:[
      {id:'information-collected',heading:'Information you provide',body:'Example: Checkout may request contact and delivery details needed to process an order. List the exact information your store collects and how it is used.'},
      {id:'privacy-communications',heading:'Order updates and marketing',body:'Explain which service providers send order updates and how customers can change their marketing preferences.'},
      {id:'privacy-questions',heading:'Privacy questions',body:'Add a monitored contact address for customer requests about their personal information.'},
    ]},
    shipping:{title:'Shipping policy',intro:'Example delivery information for a storefront template. Confirm your service areas, actual charges, couriers, and delivery estimates before publishing.',clauses:[
      {id:'shipping-areas',heading:'Where we deliver',body:'Example: Delivery is available in [list cities, regions, or countries]. Replace the bracketed text with locations your courier can reliably serve.'},
      {id:'shipping-charges',heading:'Delivery charges',body:'Example: Standard delivery is [enter your fee]. Add any free-delivery threshold or remote-area surcharge that applies at checkout.'},
      {id:'shipping-times',heading:'Delivery estimates',body:'Example: Orders are prepared within [enter processing time] and usually arrive within [enter delivery window]. Actual timing can vary by location and courier.'},
      {id:'shipping-help',heading:'Delivery help',body:'If a parcel is delayed or an address needs correcting, contact [store email or phone] with your order number.'},
    ]},
    return:{title:'Returns and exchanges',intro:'Example return information for a storefront template. Set rules that match your products and local consumer requirements before publishing.',clauses:[
      {id:'return-eligibility',heading:'Return eligibility',body:'Example: Contact us within [enter return window] of delivery. Explain the condition products must be in and list any items that cannot be returned.'},
      {id:'return-request',heading:'How to request a return',body:'Send your order number and the reason for your request to [store email or contact page]. Wait for instructions before shipping anything back.'},
      {id:'refund-timing',heading:'Refunds and exchanges',body:'Explain which outcomes you offer and the expected processing time after an approved return is received.'},
      {id:'return-shipping',heading:'Return delivery costs',body:'State who pays return shipping and how damaged, incorrect, or faulty items should be reported.'},
    ]},
  },
  inbox:[],
  settings:{
    socialUrls:{facebook:'https://facebook.com',instagram:'https://instagram.com',tiktok:'https://tiktok.com'},
     headerLogoAlignment:'center',
     headerIcons:{search:true,account:true,wishlist:true,cart:true},
     headerIconVisibility:defaultHeaderIconVisibility,
     headerCustomActions:[],
     analytics:{enabled:false,provider:'ga4',measurementId:''},
      security:{appCheckEnabled:false},
     preloader:defaultPreloaderSettings,
    productCardBadges:defaultProductCardBadgeSettings,
    profileFields:defaultProfileFieldSettings,
    seo:defaultGlobalSeoSettings,
    recaptchaSiteKey:'',
    recaptchaSecretConfigured:false,
          general:{storeName:'',storeSubtitle:'',storeLogoUrl:'',faviconUrl:'',currency:'PKR',deliveryFee:250,cashOnDelivery:true,autoCompressUploads:true,codWhatsAppEnabled:true,codWhatsAppAutoSendEnabled:false,codWhatsAppNumber:'',codWhatsAppPhoneNumberId:'',codWhatsAppTemplateName:'cod_order_confirmation',codWhatsAppLanguage:'en',whatsappAdminNotificationsEnabled:false,whatsappAdminPhone:'',whatsappAdminOrderTemplateName:'admin_new_order',whatsappShippingUpdatesEnabled:false,whatsappShippedTemplateName:'order_shipped',whatsappOutForDeliveryTemplateName:'order_out_for_delivery',whatsappReviewRequestsEnabled:false,whatsappReviewTemplateName:'review_request',whatsappAbandonedCartEnabled:false,whatsappAbandonedCartTemplateName:'abandoned_cart',whatsappMarketingTemplateName:'store_promotion'},
    paymentDetails:{
       bankName:'',bankAccountTitle:'',bankAccountNumberOrIban:'',bankAccounts:[],
      easypaisaAccountTitle:'',easypaisaNumber:'',jazzcashAccountTitle:'',jazzcashNumber:'',
    },
    catalogBrowsing:defaultCatalogBrowsingSettings,
  },
};

export const AdminContext=createContext<AdminContextValue|null>(null);

function record(value:unknown):Record<string,unknown>{
  return value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
}
function isBackendThrottled(error:unknown):boolean{
  const failure=record(error);
  const values=[failure.code,failure.status,failure.statusCode,failure.message];
  const customData=record(failure.customData);
  values.push(customData.serverResponse,record(failure.cause).code,record(failure.cause).message);
  return values.some(value=>{
    if(value===8||value===429)return true;
    const normalized=String(value??'').toLowerCase();
    return /^(?:8|429)$|resource[-_ ]exhausted|quota/.test(normalized);
  });
}
function boundedString(value:unknown,max:number,fallback=''){
  return typeof value==='string'?value.trim().slice(0,max):fallback;
}
function normalizeSeo(value:unknown):Product['seo']{
  const seo=record(value);
  if(!Object.keys(seo).length)return undefined;
  return {
    metaTitle:boundedString(seo.metaTitle,70),
    metaDescription:boundedString(seo.metaDescription,320),
    keywords:boundedString(seo.keywords,500),
    imageAlt:boundedString(seo.imageAlt,180),
    slug:boundedString(seo.slug,180),
    ogTitle:boundedString(seo.ogTitle,100),
    ogDescription:boundedString(seo.ogDescription,320),
    ogImageUrl:boundedString(seo.ogImageUrl,2048),
  };
}
function normalizeGlobalSeoSettings(value:unknown):GlobalSeoSettings{
  const source=record(value);
  const pages=record(source.pages);
  const keys:SeoPageKey[]=['home','shop','collections','about','reviews'];
  return {
    autoGenerate:typeof source.autoGenerate==='boolean'?source.autoGenerate:defaultGlobalSeoSettings.autoGenerate,
    pages:Object.fromEntries(keys.map(key=>[key,normalizeSeo(pages[key])??{}])) as GlobalSeoSettings['pages'],
  };
}
function normalizeCatalogProduct(value:unknown):Product|null{
  const item=record(value);
  const id=Number(item.id),price=Number(item.price);
  const name=boundedString(item.name,180),category=boundedString(item.category,120);
  if(!Number.isSafeInteger(id)||id<1||!name||!category||!Number.isFinite(price)||price<0)return null;
  const stockValue=Number(item.stock);
  const stock=Number.isSafeInteger(stockValue)&&stockValue>=0?stockValue:0;
  const stringList=(candidate:unknown,limit:number,maxLength:number)=>Array.isArray(candidate)
    ?[...new Set(candidate.filter((entry):entry is string=>typeof entry==='string'&&Boolean(entry.trim())).map(entry=>entry.trim().slice(0,maxLength)))].slice(0,limit)
    :[];
  const normalizedProductImage=(value:unknown)=>{
    if(typeof value!=='string')return '';
    const image=value.trim();
    return /^data:image\/(?:jpeg|png|webp|gif);base64,/i.test(image)?image.slice(0,800*1024):image.slice(0,2048);
  };
  const imageList=(candidate:unknown)=>Array.isArray(candidate)
    ?[...new Set(candidate.map(normalizedProductImage).filter(Boolean))].slice(0,12)
    :[];
  const variants=stringList(item.variants,30,120);
  const variationTypes=Array.isArray(item.variationTypes)?item.variationTypes.slice(0,5).flatMap((raw,index)=>{
    const type=record(raw),typeId=boundedString(type.id,80,`option-${index+1}`),typeName=boundedString(type.name,80);
    const values=stringList(type.values,40,100);
    return typeName&&values.length? [{id:typeId,name:typeName,values,...(typeof type.valuesText==='string'?{valuesText:boundedString(type.valuesText,4096)}:{})}]:[];
  }):[];
  const validOptionValues=new Map(variationTypes.map(type=>[type.id,new Set(type.values)]));
  const variantMatrix=Array.isArray(item.variantMatrix)?item.variantMatrix.slice(0,250).flatMap((raw,index)=>{
    const variant=record(raw),optionsRaw=record(variant.options),options:Record<string,string>={};
    for(const type of variationTypes){const value=optionsRaw[type.id];if(typeof value!=='string'||!validOptionValues.get(type.id)?.has(value))return [];options[type.id]=value;}
    const variantPrice=Number(variant.price),variantStock=Number(variant.stock);
    if(!variationTypes.length||!Number.isFinite(variantPrice)||variantPrice<=0||!Number.isSafeInteger(variantStock)||variantStock<0)return [];
    const oldPrice=Number(variant.oldPrice),label=boundedString(variant.label,600,variationTypes.map(type=>options[type.id]).join(' / '));
     return [{id:boundedString(variant.id,100,`variant-${index+1}`),label,options,price:variantPrice,...(Number.isFinite(oldPrice)&&oldPrice>variantPrice?{oldPrice}:{}),stock:variantStock,sku:boundedString(variant.sku,100),...(typeof variant.image==='string'&&variant.image.trim()?{image:normalizedProductImage(variant.image)}:{})}];
  }):[];
  const quantityDiscounts=record(item.quantityDiscounts);
  const quantityDiscountMode=quantityDiscounts.mode==='custom'||quantityDiscounts.mode==='disabled'?quantityDiscounts.mode:undefined;
  return {
    id,name,category,
    ...(typeof item.brand==='string'?{brand:boundedString(item.brand,120)}:{}),
    ...(typeof item.createdAt==='string'?{createdAt:boundedString(item.createdAt,64)}:{}),
     ...(item.status==='active'||item.status==='draft'||item.status==='archived'?{status:item.status}:{}),
    price,
    ...(Number.isFinite(item.oldPrice)&&Number(item.oldPrice)>=0?{oldPrice:Number(item.oldPrice)}:{}),
    ...(typeof item.badge==='string'?{badge:boundedString(item.badge,48)}:{}),
      image:normalizedProductImage(item.image),
      ...((typeof item.mobileImage==='string'&&item.mobileImage.trim())||(typeof item.mobileImageUrl==='string'&&item.mobileImageUrl.trim())
        ?{mobileImage:normalizedProductImage(item.mobileImage||item.mobileImageUrl)}
        :{}),
      images:imageList(item.images),
    shade:/^#[0-9a-f]{6}$/i.test(String(item.shade||''))?String(item.shade):'#f3eee7',
    ...(item.fromPrice===true?{fromPrice:true}:{}),
    variants,
    variationTypes,
    variantMatrix,
    features:stringList(item.features,40,400),
    ...(typeof item.description==='string'?{description:boundedString(item.description,5000)}:{}),
    ...(typeof item.usage==='string'?{usage:boundedString(item.usage,3000)}:{}),
    ...(typeof item.shippingInfo==='string'?{shippingInfo:boundedString(item.shippingInfo,3000)}:{}),
    inStock:item.inStock===false?false:stock>0,
    ...(Number.isFinite(item.rating)?{rating:Math.max(0,Math.min(5,Number(item.rating)))}:{}),
    reviewCount:Number.isSafeInteger(item.reviewCount)&&Number(item.reviewCount)>=0?Number(item.reviewCount):0,
    stock,
    freeDeliveryEligible:item.freeDeliveryEligible===true,
    ...(item.cashOnDeliveryEnabled===true?{cashOnDeliveryEnabled:true}:item.cashOnDeliveryEnabled===false?{cashOnDeliveryEnabled:false}:{}),
    ...(quantityDiscountMode?{quantityDiscounts:{mode:quantityDiscountMode,tiers:normalizeQuantityDiscountTiers(quantityDiscounts.tiers)}}:{}),
    seo:normalizeSeo(item.seo),
  };
}
function normalizeCatalogCategory(value:unknown):StoreCategory|null{
  const item=record(value);
  const id=boundedString(item.id,120),name=boundedString(item.name,140);
  if(!id||!name)return null;
  return {
    id,name,image:boundedString(item.image,2048),
    ...((typeof item.mobileImage==='string'&&item.mobileImage.trim())||(typeof item.mobileImageUrl==='string'&&item.mobileImageUrl.trim())
      ?{mobileImage:boundedString(item.mobileImage||item.mobileImageUrl,2048)}
      :{}),
    ...(Array.isArray(item.images)?{images:item.images.filter((image):image is string=>typeof image==='string'&&Boolean(image.trim())).slice(0,12).map(image=>image.trim().slice(0,2048))}:{}),
    sub:boundedString(item.sub,240),
    color:/^#[0-9a-f]{6}$/i.test(String(item.color||''))?String(item.color):'#f3eee7',
    ...(typeof item.parentId==='string'?{parentId:boundedString(item.parentId,120)}:{}),
    seo:normalizeSeo(item.seo),
  };
}

const ADMIN_SETTINGS_CACHE_KEY='nura-admin-settings-cache-v1';
type AdminSettingsCache={
  baseline:{content:StorefrontContent;settings:AdminSettings};
  draft:{content:StorefrontContent;settings:AdminSettings};
  pending:boolean;
  scopes?:AdminSaveScope[];
  failureReason?:'backend-throttled';
};
function readAdminSettingsCache():AdminSettingsCache|null{
  try{
    const raw=localStorage.getItem(ADMIN_SETTINGS_CACHE_KEY);
    if(!raw)return null;
    const parsed=JSON.parse(raw) as Partial<AdminSettingsCache>;
    const valid=(value:unknown)=>Boolean(value&&typeof value==='object'&&'content'in value&&'settings'in value);
    if(!valid(parsed.baseline)||!valid(parsed.draft))return null;
    const safe=sanitizeAdminSettingsDraft(parsed) as AdminSettingsCache;
    safe.scopes=(Array.isArray(parsed.scopes)?parsed.scopes:[])
      .filter((scope):scope is AdminSaveScope=>typeof scope==='string'&&/^(content|settings)(?:\.[a-z0-9_-]+)*$/i.test(scope));
    safe.failureReason=parsed.failureReason==='backend-throttled'?'backend-throttled':undefined;
    localStorage.setItem(ADMIN_SETTINGS_CACHE_KEY,JSON.stringify(safe));
    return safe;
  }catch{return null;}
}
function writeAdminSettingsCache(baseline:Pick<AdminData,'content'|'settings'>,draft:Pick<AdminData,'content'|'settings'>,pending:boolean,scopes:AdminSaveScope[]=[],failureReason?:AdminSettingsCache['failureReason']):boolean{
  try{
    localStorage.setItem(ADMIN_SETTINGS_CACHE_KEY,JSON.stringify({
      baseline:sanitizeAdminSettingsDraft({content:baseline.content,settings:baseline.settings}),
      draft:sanitizeAdminSettingsDraft({content:draft.content,settings:draft.settings}),
      pending,
      scopes:scopes.filter(scope=>/^(content|settings)(?:\.[a-z0-9_-]+)*$/i.test(scope)),
      ...(failureReason==='backend-throttled'?{failureReason}:{}),
    } satisfies AdminSettingsCache));
    return true;
  }catch{return false;}
}
function overlayRemoteRecord<T>(base:T,remote:unknown):T{
  if(!remote||typeof remote!=='object'||Array.isArray(remote))return base;
  const result={...(base&&typeof base==='object'?base as object:{})} as Record<string,unknown>;
  Object.entries(remote as Record<string,unknown>).forEach(([key,value])=>{
    const prior=result[key];
    result[key]=prior&&typeof prior==='object'&&!Array.isArray(prior)&&value&&typeof value==='object'&&!Array.isArray(value)
      ?overlayRemoteRecord(prior,value)
      :value;
  });
  return result as T;
}
function storeValuesEqual(left:unknown,right:unknown):boolean{
  if(Object.is(left,right))return true;
  if(left instanceof Date&&right instanceof Date)return left.getTime()===right.getTime();
  if(!left||!right||typeof left!=='object'||typeof right!=='object')return false;
  if(Array.isArray(left)||Array.isArray(right)){
    return Array.isArray(left)&&Array.isArray(right)&&left.length===right.length
      &&left.every((value,index)=>storeValuesEqual(value,right[index]));
  }
  const leftRecord=left as Record<string,unknown>;
  const rightRecord=right as Record<string,unknown>;
  const keys=Object.keys(leftRecord);
  return keys.length===Object.keys(rightRecord).length
    &&keys.every(key=>Object.prototype.hasOwnProperty.call(rightRecord,key)&&storeValuesEqual(leftRecord[key],rightRecord[key]));
}
function storeValueContains(actual:unknown,expected:unknown):boolean{
  if(expected&&typeof expected==='object'&&!Array.isArray(expected)){
    if(!actual||typeof actual!=='object'||Array.isArray(actual))return false;
    return Object.entries(expected as Record<string,unknown>).every(([key,value])=>
      Object.prototype.hasOwnProperty.call(actual,key)
      &&storeValueContains((actual as Record<string,unknown>)[key],value));
  }
  return storeValuesEqual(actual,expected);
}
function scopeIncludes(parent:AdminSaveScope,child:AdminSaveScope):boolean{
  return parent===child
    ||parent==='content'&&child.startsWith('content.')
    ||parent==='settings'&&child.startsWith('settings.');
}

export function AdminProvider({
  children,
  readSettingsDocumentFromServer=getDocFromServer,
}:{
  children:ReactNode;
  readSettingsDocumentFromServer?:typeof getDocFromServer;
}){
  const {isAdmin}=useAuth();
  const [localCache]=useState(readAdminSettingsCache);
  const [storefrontSettingsState,setStorefrontSettingsState]=useState<'loading'|'ready'|'error'>('loading');
  const [data,replaceData]=useState<AdminData>(()=>cleanData({
    ...overlayRemoteRecord(defaultAdminData,localCache?.baseline||{}),
    products:[],categories:[],reviews:[],deals:[],coupons:[],inbox:[],
  }));
  const current=useRef(data);
  const persisted=useRef<AdminData>(data);
  const queue=useRef<Promise<AdminSaveResult>>(Promise.resolve('remote'));
  const inFlight=useRef(false);
  const persistPendingRef=useRef<(scope?:AdminSaveScope|AdminSaveScope[],confirmSettings?:boolean)=>Promise<AdminSaveResult>>(async()=> 'remote');
  const [localDraftAvailable,setLocalDraftAvailable]=useState(localCache?.pending===true&&isAdmin);
  const [localDraftRestored,setLocalDraftRestored]=useState(false);
  const [saveRetryAvailable,setSaveRetryAvailable]=useState(false);
  const [saving,setSaving]=useState(false);
  const [dirty,setDirty]=useState(false);
  const [syncError,setSyncError]=useState('');
  const restoredSettingsDirty=RESTORED_SETTINGS_SAVE_SCOPES.some(scope=>{
    if(scope==='content')return !storeValuesEqual(current.current.content,persisted.current.content);
    const key=scope.slice('settings.'.length);
    return !storeValuesEqual(
      (current.current.settings as unknown as Record<string,unknown>)[key],
      (persisted.current.settings as unknown as Record<string,unknown>)[key],
    );
  });
  const [initialized,setInitialized]=useState(false);
  const [catalogReady,setCatalogReady]=useState(false);
  const [categoriesReady,setCategoriesReady]=useState(false);
  const pending=useRef(0);
  const pendingScopes=useRef<AdminSaveScope[]>([]);
  const pendingSettingsConfirmation=useRef(false);
  const remote=useRef<Record<string,unknown>>({});
  useEffect(()=>setLocalDraftAvailable(Boolean(isAdmin&&localCache?.pending)),[isAdmin,localCache]);
  const applyRemote=useCallback((key:string,value:unknown)=>{
    remote.current[key]=value;
    if(pending.current&&isAdmin)return;
    const next={...current.current,...(key==='global'?value as object:{[key]:value})} as AdminData;
    current.current=next;persisted.current=next;replaceData(next);
    if(key==='global'&&isAdmin&&localCache?.pending){
      const latest={content:next.content,settings:next.settings};
      const scopes=localCache.scopes?.length?localCache.scopes:['content','settings'];
      if(adminSettingsDraftIsSynced(localCache.baseline,localCache.draft,latest,scopes)){
        try{localStorage.removeItem(ADMIN_SETTINGS_CACHE_KEY);}catch{}
        pending.current=0;pendingScopes.current=[];
        setLocalDraftAvailable(false);setLocalDraftRestored(false);setSaveRetryAvailable(false);setDirty(false);setSyncError('');
      }
    }else if(key==='global')writeAdminSettingsCache(next,next,false);
  },[isAdmin,localCache]);
  const restoreLocalDraft=useCallback(async()=>{
    if(!isAdmin)throw new Error('Administrator access is required to restore a local draft.');
    if(!localCache?.pending)throw new Error('There is no local settings draft to restore.');
    if(!db)throw new Error('Supabase is unavailable. Connect to Supabase before restoring this draft.');
    const snapshot=await getDocFromServer(doc(db,'storeContent','global')).catch(()=>{
      throw new Error('Could not read the latest Supabase settings. Your local draft is still available; check your connection or access, then try restoring it again.');
    });
    if(!snapshot.exists())throw new Error('Supabase settings could not be found. The local draft was not restored.');
    const remoteGlobal=record(snapshot.data());
    const latest={
      content:overlayRemoteRecord(defaultAdminData.content,remoteGlobal.content),
      settings:overlayRemoteRecord(defaultAdminData.settings,remoteGlobal.settings),
    };
    const merged=mergeAdminSettingsDraft(localCache.baseline,localCache.draft,latest);
    const next=cleanData({...current.current,content:merged.value.content,settings:merged.value.settings});
    const changed=!storeValuesEqual({content:next.content,settings:next.settings},latest);
    persisted.current=cleanData({...current.current,content:latest.content,settings:latest.settings});
    current.current=next;
    replaceData(next);
    if(!changed){
      pending.current=0;pendingScopes.current=[];
      setDirty(false);setLocalDraftAvailable(false);setLocalDraftRestored(false);setSyncError('');
      try{localStorage.removeItem(ADMIN_SETTINGS_CACHE_KEY);}catch{}
      return;
    }
    pending.current=1;
    pendingScopes.current=localCache.scopes?.length?localCache.scopes:['content','settings'];
    setDirty(true);setLocalDraftAvailable(false);setLocalDraftRestored(true);
    const conflictNote=merged.conflicts.length
      ?` ${merged.conflicts.length} overlapping newer Supabase value${merged.conflicts.length===1?' was':'s were'} kept unchanged.`
      :'';
    const quotaNotice=localCache.failureReason==='backend-throttled'
      ?'The backend is temporarily limiting writes. Changes are saved on this device; retry when the limit clears.'
      :`Local draft restored. These edits are not saved to Supabase yet.${conflictNote}`;
    setSyncError(`LOCAL_DRAFT:${quotaNotice}`);
    writeAdminSettingsCache(persisted.current,next,true,pendingScopes.current,localCache.failureReason);
  },[isAdmin,localCache]);
  const discardLocalDraft=useCallback(()=>{
    try{localStorage.removeItem(ADMIN_SETTINGS_CACHE_KEY);}catch{}
    if(localDraftRestored){
      const latestRemote=remote.current.global;
      const reverted=latestRemote&&typeof latestRemote==='object'
        ?cleanData({...persisted.current,...latestRemote as object})
        :persisted.current;
      current.current=reverted;persisted.current=reverted;replaceData(reverted);
      pending.current=0;pendingScopes.current=[];
    }
    setDirty(false);setLocalDraftAvailable(false);setLocalDraftRestored(false);setSaveRetryAvailable(false);setSyncError('');
  },[localDraftRestored]);
  useEffect(()=>{
    if(!db){setStorefrontSettingsState('error');return;}
    setSyncError('');
    const unsubscribers:Array<()=>void>=[];
    const failure=(error:Error)=>setSyncError(error.message);
    for(const key of ['products','categories','deals','coupons','reviews'] as const){
      const source=key==='reviews'&&!isAdmin?query(collection(db,key),where('published','==',true)):collection(db,key);
      unsubscribers.push(onSnapshot(source,async snapshot=>{
        if(key==='products'||key==='categories'){
          const testGate=waitForStartupSnapshotTestGate(key);
          if(testGate)await testGate;
        }
        const documents=snapshot.docs.map(item=>item.data());
        applyRemote(key,key==='products'
          ?documents.flatMap(item=>{const product=normalizeCatalogProduct(item);return product?[product]:[];})
          :key==='categories'
            ?documents.flatMap(item=>{const category=normalizeCatalogCategory(item);return category?[category]:[];})
            :documents);
        if(key==='products')setCatalogReady(true);
        if(key==='categories')setCategoriesReady(true);
      },error=>{failure(error);if(key==='products')setCatalogReady(true);if(key==='categories')setCategoriesReady(true);}));
    }
    unsubscribers.push(onSnapshot(doc(db,'storeContent','global'),{includeMetadataChanges:true},async snapshot=>{
       const testGate=waitForStartupSnapshotTestGate('settings');
       if(testGate)await testGate;
      setInitialized(snapshot.exists());
      if(snapshot.exists()){
        const saved=snapshot.data();
         const savedSettings=saved.settings||{};
         applyRemote('global',{
           content:{
             ...defaultAdminData.content,
              storePages:normalizeStorePageCopySettings(saved.content?.storePages),
             storePageLayouts:normalizeStorePageLayouts(saved.content?.storePageLayouts),
             ...saved.content,
              pdpSections:{
                videoReviews:saved.content?.pdpSections?.videoReviews!==false,
                accordions:saved.content?.pdpSections?.accordions!==false,
                trustBadges:saved.content?.pdpSections?.trustBadges!==false,
                relatedProducts:saved.content?.pdpSections?.relatedProducts!==false,
              },
              relatedProductsSettings:{
                title:typeof saved.content?.relatedProductsSettings?.title==='string'
                  ?saved.content.relatedProductsSettings.title.slice(0,80)
                  :defaultAdminData.content.relatedProductsSettings.title,
                subtitle:typeof saved.content?.relatedProductsSettings?.subtitle==='string'
                  ?saved.content.relatedProductsSettings.subtitle.slice(0,160)
                  :defaultAdminData.content.relatedProductsSettings.subtitle,
                productLimit:Number.isFinite(saved.content?.relatedProductsSettings?.productLimit)
                  ?Math.min(8,Math.max(2,Math.round(Number(saved.content.relatedProductsSettings.productLimit))))
                  :defaultAdminData.content.relatedProductsSettings.productLimit,
                prioritizeSameCategory:saved.content?.relatedProductsSettings?.prioritizeSameCategory!==false,
              },
              announcement:normalizeAnnouncement(saved.content?.announcement),
              marqueeBars:normalizeMarqueeBars(saved.content?.marqueeBars),
              categoryLayout:saved.content?.categoryLayout==='circle'?'circle':'box',
              categoryDisplayMode:normalizeCategoryDisplayMode(saved.content?.categoryDisplayMode),
              categoryMotionStyle:saved.content?.categoryMotionStyle==='manual'?'manual':'auto',
              categoryMotionSpeed:['slow','medium','fast'].includes(saved.content?.categoryMotionSpeed)?saved.content.categoryMotionSpeed:'medium',
              reviewCarousel:{
                autoScroll:saved.content?.reviewCarousel?.autoScroll===true,
                showArrows:saved.content?.reviewCarousel?.showArrows!==false,
                speedSeconds:Math.max(10,Math.min(90,Number(saved.content?.reviewCarousel?.speedSeconds)||30)),
                layout:saved.content?.reviewCarousel?.layout==='grid'?'grid':'horizontal',
              },
              bestsellerCarousel:{
                autoScroll:saved.content?.bestsellerCarousel?.autoScroll===true,
                showArrows:saved.content?.bestsellerCarousel?.showArrows!==false,
                speedSeconds:Math.max(10,Math.min(90,Number(saved.content?.bestsellerCarousel?.speedSeconds)||30)),
                layout:saved.content?.bestsellerCarousel?.layout==='grid'?'grid':'horizontal',
              },
              newArrivalsCarousel:{
                autoScroll:saved.content?.newArrivalsCarousel?.autoScroll===true,
                showArrows:saved.content?.newArrivalsCarousel?.showArrows!==false,
                speedSeconds:Math.max(10,Math.min(90,Number(saved.content?.newArrivalsCarousel?.speedSeconds)||30)),
                layout:saved.content?.newArrivalsCarousel?.layout==='grid'?'grid':'horizontal',
              },
               showCategoryProductCount:saved.content?.showCategoryProductCount!==false,
              homeAnimations:saved.content?.homeAnimations!==false,
                heroSlides:normalizeHeroSlides(saved.content?.heroSlides,defaultAdminData.content.heroSlides,saved.heroCtaOutlineVersion!==1),
               heroSettings:normalizeHeroSettings(saved.content?.heroSettings),
                heroButtonSettings:normalizeHeroButtonSettings(saved.content?.heroButtonSettings,saved.content?.heroSlides,defaultAdminData.content.heroButtonSettings),
              story:{
                ...defaultAdminData.content.story,
                ...saved.content?.story,
                urduTitle:typeof saved.content?.story?.urduTitle==='string'?saved.content.story.urduTitle.slice(0,240):defaultAdminData.content.story.urduTitle,
                urduCopy:typeof saved.content?.story?.urduCopy==='string'?saved.content.story.urduCopy.slice(0,1200):defaultAdminData.content.story.urduCopy,
              },
              homeSections:normalizeHomeSections(saved.content?.homeSections),
              offerBanner:normalizeOfferBanner(saved.content?.offerBanner,defaultAdminData.content.offerBanner),
              featureCards:normalizeFeatureCards(saved.content?.featureCards,defaultAdminData.content.featureCards,(saved.content?.featureSectionSettings?.schemaVersion||0)<2),
              featureSectionSettings:normalizeHomeFeatureSectionSettings(saved.content?.featureSectionSettings),
              instagramPosts:normalizeInstagramPosts(saved.content?.instagramPosts,defaultAdminData.content.instagramPosts),
              homeMediaBanner:normalizeMediaBanner(saved.content?.homeMediaBanner,defaultAdminData.content.homeMediaBanner),
              homeFaq:normalizeFaqItems(saved.content?.homeFaq,defaultAdminData.content.homeFaq),
              milestoneStats:normalizeMilestoneStats(saved.content?.milestoneStats,defaultAdminData.content.milestoneStats),
              milestoneSettings:normalizeMilestoneSettings(saved.content?.milestoneSettings),
              milestoneBadges:normalizeMilestoneBadges(saved.content?.milestoneBadges),
              newsletter:normalizeNewsletter(saved.content?.newsletter,defaultAdminData.content.newsletter),
              footer:normalizeFooter(saved.content?.footer),
                trustBadgeDisplay:normalizeTrustBadgeDisplay(saved.content?.trustBadgeDisplay),
               navigation:normalizeStoreNavigation(saved.content?.navigation),
              theme:{
                ...defaultAdminData.content.theme,
                ...saved.content?.theme,
                 primary:normalizeThemeColor(saved.content?.theme?.primary,defaultAdminData.content.theme.primary,['#334155','#6b2447']),
                 accent:normalizeThemeColor(saved.content?.theme?.accent,defaultAdminData.content.theme.accent,['#64748b','#61725c','#60705d']),
                 background:normalizeThemeColor(saved.content?.theme?.background,defaultAdminData.content.theme.background,['#f8fafc']),
                 globalScale:Number.isFinite(saved.content?.theme?.globalScale)?Math.min(1.15,Math.max(.8,Number(saved.content.theme.globalScale))):defaultAdminData.content.theme.globalScale,
                 radiusStyle:['sharp','rounded','pill'].includes(saved.content?.theme?.radiusStyle)?saved.content.theme.radiusStyle:defaultAdminData.content.theme.radiusStyle,
                 glassBlurPx:Number.isFinite(saved.content?.theme?.glassBlurPx)?Math.min(24,Math.max(0,Number(saved.content.theme.glassBlurPx))):defaultAdminData.content.theme.glassBlurPx,
                 spacingDensity:['compact','balanced','spacious'].includes(saved.content?.theme?.spacingDensity)?saved.content.theme.spacingDensity:defaultAdminData.content.theme.spacingDensity,
                 trustBadgeBackground:normalizeThemeColor(saved.content?.theme?.trustBadgeBackground,defaultAdminData.content.theme.trustBadgeBackground,['#eef2f6','#efe8da']),
                  primaryGradientMode:saved.content?.theme?.primaryGradientMode==='gradient'?'gradient':'solid',
                  primaryGradientStart:normalizeThemeColor(saved.content?.theme?.primaryGradientStart,defaultAdminData.content.theme.primaryGradientStart),
                  primaryGradientEnd:normalizeThemeColor(saved.content?.theme?.primaryGradientEnd,defaultAdminData.content.theme.primaryGradientEnd),
                  globalFontFamily:saved.content?.theme?.globalFontFamily==='serif'?'serif':'sans-serif',
              },
              productGalleryStyle:saved.content?.productGalleryStyle==='slider'?'slider':'grid',
              quantityDiscounts:{
                enabled:saved.content?.quantityDiscounts?.enabled===true,
                tiers:Array.isArray(saved.content?.quantityDiscounts?.tiers)
                  ?normalizeQuantityDiscountTiers(saved.content.quantityDiscounts.tiers)
                  :defaultQuantityDiscountTiers,
              },
              floatingWidgets:normalizeFloatingWidgets(saved.content?.floatingWidgets),
              countdownTimer:normalizeCountdownTimer(saved.content?.countdownTimer),
             typography:hydrateTypography(saved.content?.typography),
           },
           settings:{
             ...defaultAdminData.settings,
             ...savedSettings,
             socialUrls:{...defaultAdminData.settings.socialUrls,...savedSettings.socialUrls},
             headerLogoAlignment:savedSettings.headerLogoAlignment==='left'||savedSettings.headerLogoAlignment==='right'?savedSettings.headerLogoAlignment:'center',
              headerIcons:{
                search:typeof savedSettings.headerIcons?.search==='boolean'?savedSettings.headerIcons.search:defaultAdminData.settings.headerIcons.search,
                account:typeof savedSettings.headerIcons?.account==='boolean'?savedSettings.headerIcons.account:defaultAdminData.settings.headerIcons.account,
                 wishlist:typeof savedSettings.headerIcons?.wishlist==='boolean'?savedSettings.headerIcons.wishlist:defaultAdminData.settings.headerIcons.wishlist,
                cart:typeof savedSettings.headerIcons?.cart==='boolean'?savedSettings.headerIcons.cart:defaultAdminData.settings.headerIcons.cart,
              },
               headerIconVisibility:normalizeHeaderIconVisibility(savedSettings.headerIconVisibility,{
                 search:typeof savedSettings.headerIcons?.search==='boolean'?savedSettings.headerIcons.search:defaultAdminData.settings.headerIcons.search,
                 account:typeof savedSettings.headerIcons?.account==='boolean'?savedSettings.headerIcons.account:defaultAdminData.settings.headerIcons.account,
                 wishlist:typeof savedSettings.headerIcons?.wishlist==='boolean'?savedSettings.headerIcons.wishlist:defaultAdminData.settings.headerIcons.wishlist,
                 cart:typeof savedSettings.headerIcons?.cart==='boolean'?savedSettings.headerIcons.cart:defaultAdminData.settings.headerIcons.cart,
               }),
               headerCustomActions:normalizeHeaderCustomActions(savedSettings.headerCustomActions),
              analytics:normalizeAnalyticsSettings(savedSettings.analytics),
              preloader:normalizePreloaderSettings(savedSettings.preloader),
              productCardBadges:normalizeProductBadgeSettings(savedSettings.productCardBadges),
              profileFields:normalizeProfileFieldSettings(savedSettings.profileFields),
              seo:normalizeGlobalSeoSettings(savedSettings.seo),
              general:{...defaultAdminData.settings.general,...savedSettings.general,storeName:configuredStoreName(savedSettings.general?.storeName),storeSubtitle:typeof savedSettings.general?.storeSubtitle==='string'?savedSettings.general.storeSubtitle.slice(0,140):'',storeLogoUrl:typeof savedSettings.general?.storeLogoUrl==='string'?savedSettings.general.storeLogoUrl.slice(0,1500):'',faviconUrl:typeof savedSettings.general?.faviconUrl==='string'?savedSettings.general.faviconUrl.slice(0,1500):''},
              paymentDetails:{
                ...defaultAdminData.settings.paymentDetails,
                ...savedSettings.paymentDetails,
                bankAccounts:normalizeBankAccounts(savedSettings.paymentDetails?.bankAccounts,savedSettings.paymentDetails||{}),
              },
              catalogBrowsing:{
                ...defaultCatalogBrowsingSettings,
                ...savedSettings.catalogBrowsing,
                filters:{
                  ...defaultCatalogBrowsingSettings.filters,
                  ...savedSettings.catalogBrowsing?.filters,
                },
                filterSections:normalizeCatalogFilterSections(savedSettings.catalogBrowsing?.filterSections),
                categoryIcons:{
                  ...(savedSettings.catalogBrowsing?.categoryIcons&&typeof savedSettings.catalogBrowsing.categoryIcons==='object'
                    ?savedSettings.catalogBrowsing.categoryIcons
                    :{}),
                },
                toolbar:normalizeCatalogToolbar(savedSettings.catalogBrowsing?.toolbar,savedSettings.catalogBrowsing?.viewSwitcher),
              },
           },
           policies:{...defaultAdminData.policies,...saved.policies},
         });
      }
      if(!snapshot.metadata.fromCache)setStorefrontSettingsState('ready');
    },error=>{
      setStorefrontSettingsState('error');
      failure(error);
    }));
    if(isAdmin)unsubscribers.push(onSnapshot(collection(db,'inbox'),snapshot=>applyRemote('inbox',snapshot.docs.map(item=>item.data())),failure));
    else applyRemote('inbox',[]);
    return()=>unsubscribers.forEach(unsubscribe=>unsubscribe());
  },[isAdmin,applyRemote]);
    const persistPending=useCallback(async(scope?:AdminSaveScope|AdminSaveScope[],confirmSettings=false)=>{
      if(confirmSettings&&(inFlight.current||pending.current>0))pendingSettingsConfirmation.current=true;
     if(inFlight.current){
        const requestedScopes=Array.isArray(scope)?scope:scope?[scope]:[];
        pendingScopes.current=[...new Set([...pendingScopes.current,...requestedScopes])];
        return queue.current;
     }
      if(!pending.current)return 'remote';
       const confirmSettingsOnSave=pendingSettingsConfirmation.current;
      if(!isAdmin){setSyncError('Administrator authorization is required to save changes.');setSaving(false);throw new Error('Administrator authorization is required to save changes.');}
      const scopes=Array.isArray(scope)?scope:scope?[scope]:pendingScopes.current.length?pendingScopes.current:['products','categories','deals','coupons','reviews','content','settings','policies','inbox'] as AdminSaveScope[];
      if(!db){
        pendingScopes.current=scopes;
        if(writeAdminSettingsCache(persisted.current,current.current,true,scopes)){
          setSyncError('LOCAL_DRAFT:Your settings are saved on this device; retry when the connection returns.');
            setDirty(true);setLocalDraftAvailable(false);setLocalDraftRestored(true);setSaveRetryAvailable(false);setSaving(false);return 'local';
        }
        setSaveRetryAvailable(true);
        setSyncError('Supabase and browser storage are unavailable. Keep this page open and retry when storage is available.');
        setSaving(false);throw new Error('Could not save to Supabase or browser storage.');
      }
     inFlight.current=true;
     const writeCount=pending.current;
     const previous=persisted.current;
      const previouslyPendingScopes=[...pendingScopes.current];
      // Homepage section visibility/order is saved as one intentional ordered value.
      const forceOverwritePaths=new Set<string>(['content.floatingWidgets','content.homeSections']);
      scopes.forEach(item=>{
        if(item.startsWith('settings.'))forceOverwritePaths.add(item);
      });
     const next={...previous,content:{...previous.content},settings:{...previous.settings}} as AdminData;
     if(scopes.includes('products'))next.products=current.current.products;
     if(scopes.includes('categories'))next.categories=current.current.categories;
     if(scopes.includes('deals'))next.deals=current.current.deals;
     if(scopes.includes('coupons'))next.coupons=current.current.coupons;
     if(scopes.includes('reviews'))next.reviews=current.current.reviews;
     if(scopes.includes('inbox'))next.inbox=current.current.inbox;
     if(scopes.includes('content'))next.content=current.current.content;
     else for(const item of scopes){if(item.startsWith('content.')){const key=item.slice(8);(next.content as unknown as Record<string,unknown>)[key]=(current.current.content as unknown as Record<string,unknown>)[key];}}
     if(scopes.includes('settings'))next.settings=current.current.settings;
     else for(const item of scopes){if(item.startsWith('settings.')){const key=item.slice(9);(next.settings as unknown as Record<string,unknown>)[key]=(current.current.settings as unknown as Record<string,unknown>)[key];}}
      if(scopes.includes('settings')){
        const prior=previous.settings as unknown as Record<string,unknown>;
        const edited=next.settings as unknown as Record<string,unknown>;
        new Set([...Object.keys(prior),...Object.keys(edited)]).forEach(key=>{
          if(!storeValuesEqual(prior[key],edited[key]))forceOverwritePaths.add(`settings.${key}`);
        });
      }
     if(scopes.includes('policies'))next.policies=current.current.policies;
     const batch=writeBatch(db);
     let hasCollectionWrites=false;
      for(const key of ['categories','deals','coupons','reviews','inbox'] as const){
       const before=new Map(previous[key].map(item=>[String(item.id),item]));
       const after=new Map(next[key].map(item=>[String(item.id),item]));
       after.forEach((item,id)=>{
          const old=before.get(id);
          if(storeValuesEqual(item,old))return;
         if(!old){batch.set(doc(db!,key,id),item);hasCollectionWrites=true;}
         else {
            const changed=Object.fromEntries(Object.entries(item).filter(([field,value])=>!storeValuesEqual(value,(old as unknown as Record<string,unknown>)[field])));
           if(Object.keys(changed).length){batch.update(doc(db!,key,id),changed);hasCollectionWrites=true;}
         }
       });
       before.forEach((_,id)=>{if(!after.has(id)){batch.delete(doc(db!,key,id));hasCollectionWrites=true;}});
     }
      const previousProducts=new Map(previous.products.map(item=>[String(item.id),item]));
      const nextProducts=new Map(next.products.map(item=>[String(item.id),item]));
      const productIds=new Set([...previousProducts.keys(),...nextProducts.keys()]);
      const changedProductIds=[...productIds].filter(id=>!storeValuesEqual(previousProducts.get(id),nextProducts.get(id)));
     const changedGlobalKeys=(['content','settings','policies'] as const)
        .filter(key=>!storeValuesEqual(previous[key],next[key]));
     setSaving(true);setSyncError('');
      let drainPendingAfterSuccess=false;
      queue.current=(async():Promise<AdminSaveResult>=>{
        if(changedProductIds.length){
          await runTransaction(db!,async transaction=>{
            const productRefs=changedProductIds.map(id=>({id,ref:doc(db!,'products',id)}));
            const snapshots=await Promise.all(productRefs.map(({ref})=>transaction.get(ref)));
            const writes:Array<{ref:typeof productRefs[number]['ref'];data:Record<string,unknown>|null}>= [];
            for(let index=0;index<productRefs.length;index++){
              const {id,ref}=productRefs[index];
              const before=previousProducts.get(id) as Product|undefined;
              const edited=nextProducts.get(id) as Product|undefined;
              const snapshot=snapshots[index];
              if(!before&&!edited)continue;
              if(!before){
                // New records use last-write-wins if another save created the
                // same ID while this editor was open.
                writes.push({ref,data:removeUndefinedStoreValues(edited) as unknown as Record<string,unknown>});
                continue;
              }
              if(!edited){
                if(!snapshot.exists())continue;
                writes.push({ref,data:null});
                continue;
              }
              if(!snapshot.exists()){
                 writes.push({ref,data:removeUndefinedStoreValues(edited) as unknown as Record<string,unknown>});
                continue;
              }
              const latestRaw=snapshot.data() as Record<string,unknown>;
              const latestProduct=normalizeCatalogProduct(latestRaw);
              if(!latestProduct){
                writes.push({ref,data:edited as unknown as Record<string,unknown>});
                continue;
              }
              const latest=latestProduct as unknown as Record<string,unknown>;
              const base=before as unknown as Record<string,unknown>;
              const draft=edited as unknown as Record<string,unknown>;
              const changedFields=new Set([...Object.keys(base),...Object.keys(draft)].filter(field=>
                Object.prototype.hasOwnProperty.call(base,field)!==Object.prototype.hasOwnProperty.call(draft,field)
                ||!storeValuesEqual(base[field],draft[field])));
              const patch:Record<string,unknown>= {};
              for(const field of changedFields){
                const alreadyHasEdit=storeValuesEqual(draft[field],latest[field])
                  &&Object.prototype.hasOwnProperty.call(draft,field)===Object.prototype.hasOwnProperty.call(latest,field);
                if(!alreadyHasEdit){
                   patch[field]=Object.prototype.hasOwnProperty.call(draft,field)?removeUndefinedStoreValues(draft[field]):deleteField();
                }
              }
              if(Object.keys(patch).length)writes.push({ref,data:patch});
            }
            writes.forEach(({ref,data})=>data===null?transaction.delete(ref):transaction.set(ref,data,{merge:true}));
          });
           const confirmedProducts=await getDocsFromServer(collection(db!,'products'));
           const confirmedById=new Map(confirmedProducts.docs.map(snapshot=>[snapshot.id,snapshot.data()]));
           // Confirm every changed record by its document reference as well as
           // the catalogue query. A live collection snapshot can lag a just-
           // committed product write, which must not turn a valid save into a
           // local-only draft.
           const changedSnapshots=await Promise.all(changedProductIds.map(id=>getDocFromServer(doc(db!,'products',id))));
           for(let index=0;index<changedProductIds.length;index++){
             const id=changedProductIds[index],confirmed=changedSnapshots[index];
             if(confirmed.exists())confirmedById.set(id,confirmed.data());
             else confirmedById.delete(id);
           }
           for(const id of changedProductIds){
             const expected=nextProducts.get(id);
              const confirmedRaw=confirmedById.get(id);
              const confirmed=confirmedRaw?normalizeCatalogProduct(confirmedRaw):null;
              const normalizedExpected=expected?normalizeCatalogProduct(expected)??expected:null;
             if(!expected&&confirmed){
               throw new Error(`Supabase did not confirm removal of product ${id}. Refresh the product list and retry.`);
             }
              if(expected&&(!confirmed||!storeValueContains(confirmed,cleanData(normalizedExpected)))){
                const expectedFields=cleanData(normalizedExpected) as Record<string,unknown>;
                const mismatchedFields=Object.entries(expectedFields)
                  .filter(([field,value])=>!confirmed||!storeValueContains((confirmed as unknown as Record<string,unknown>)[field],value))
                  .map(([field])=>field);
                throw new Error(`Supabase did not confirm the saved data for "${expected.name}"${mismatchedFields.length?` (${mismatchedFields.join(', ')} did not match)`:''}. Refresh the product list and retry Save product.`);
             }
           }
           remote.current.products=[...confirmedById.values()].flatMap(raw=>{
             const product=normalizeCatalogProduct(raw);
             return product?[product]:[];
           });
        }
        let committedGlobalUpdate:Record<string,unknown>|null=null;
        if(changedGlobalKeys.length){
          committedGlobalUpdate=await runTransaction(db!,async transaction=>{
           const globalRef=doc(db!,'storeContent','global');
           const snapshot=await transaction.get(globalRef);
           const remoteDocument=snapshot.exists()?snapshot.data():{};
           const update:Record<string,unknown>={};
           changedGlobalKeys.forEach(key=>{
              const latest=record(remoteDocument[key]);
              update[key]=mergeSharedSettings(previous[key],next[key],latest,key,[...forceOverwritePaths]);
           });
            if(scopes.includes('content.heroSlides'))update.heroCtaOutlineVersion=1;
            if(changedGlobalKeys.includes('content')){
              const savedContent=(update.content||remoteDocument.content||{}) as {floatingWidgets?:{widgets?:Array<{customImageUrl?:unknown}>}};
              const savedWidgetImages=(savedContent.floatingWidgets?.widgets||[])
                .map(widget=>widget.customImageUrl)
                .filter((url):url is string=>typeof url==='string'&&Boolean(url));
              const deletingImages=Array.isArray(remoteDocument.widgetImageCleanupDeleting)?remoteDocument.widgetImageCleanupDeleting:[];
              const deletedImages=Array.isArray(remoteDocument.widgetImageCleanupDeleted)?remoteDocument.widgetImageCleanupDeleted:[];
              const blockedImage=savedWidgetImages.find(url=>deletingImages.includes(url)||deletedImages.includes(url));
              if(blockedImage){
                throw new Error('Widget image is no longer available or is being removed by another administrator. Remove it from this draft or upload it again before saving.');
              }
              const pendingImages=Array.isArray(remoteDocument.widgetImageCleanupPending)?remoteDocument.widgetImageCleanupPending:[];
              const cancelledPendingImages=pendingImages.filter((url):url is string=>typeof url==='string'&&savedWidgetImages.includes(url));
              if(cancelledPendingImages.length){
                update.widgetImageCleanupPending=arrayRemove(...cancelledPendingImages);
              }
            }
            transaction.set(globalRef,removeUndefinedStoreValues(update),{merge:true});
            return update;
         });
            if(!confirmSettingsOnSave&&scopes.includes('content.navigation')){
           const confirmed=await readSettingsDocumentFromServer(doc(db!,'storeContent','global'));
           if(!confirmed.exists())throw new Error('Supabase could not confirm the navigation changes. Check your connection and try Save navigation again.');
         }
       }
         if(confirmSettingsOnSave){
          const confirmed=await readSettingsDocumentFromServer(doc(db!,'storeContent','global'));
          if(!confirmed.exists())throw new Error('Supabase could not confirm the restored settings. Your local draft is still available; retry the save when the connection returns.');
          const saved=confirmed.data();
          const notConfirmed=scopes.filter(scope=>{
            const [group,key]=scope.split('.');
            if(group!=='content'&&group!=='settings')return false;
            if(scope===group)return !storeValueContains(saved[group],next[group]);
            return !storeValueContains(record(saved[group])[key],(next[group] as unknown as Record<string,unknown>)[key]);
          });
          if(notConfirmed.length)throw new Error('Supabase could not confirm every restored setting. Your local draft is still available; retry the save when the connection returns.');
        }
       if(hasCollectionWrites)await batch.commit();
        if(confirmSettingsOnSave)pendingSettingsConfirmation.current=false;
        // The transaction may merge newer independent Supabase values into
        // its write. Keep the committed document as the next save baseline.
        const committedBaseline=committedGlobalUpdate
          ?cleanData(overlayRemoteRecord(next,committedGlobalUpdate))
          :next;
        persisted.current=committedBaseline;
        const requestedDuringWrite=pendingScopes.current.filter(pendingScope=>!previouslyPendingScopes.includes(pendingScope));
        const saveState=resolvePendingAdminSaveState({
          writesAtStart:writeCount,
          writesNow:pending.current,
          savedScopes:scopes,
          pendingScopesAtStart:previouslyPendingScopes,
          scopesRequestedDuringSave:requestedDuringWrite,
        });
        pending.current=saveState.pendingCount;
        pendingScopes.current=saveState.pendingScopes;
        writeAdminSettingsCache(persisted.current,current.current,pending.current>0,pendingScopes.current);
         setLocalDraftAvailable(false);
        setLocalDraftRestored(pending.current>0);
        setSaveRetryAvailable(false);
        setSyncError('');
         drainPendingAfterSuccess=saveState.changedDuringSave&&pending.current>0;
        return 'remote';
      })().catch(error=>{
          console.warn('[admin-save] Supabase persistence failed; retaining a local draft.',error);
         const unsavedScopes=previouslyPendingScopes.filter(pendingScope=>!scopes.some(scope=>scopeIncludes(scope,pendingScope)));
         pendingScopes.current=[...new Set([...unsavedScopes,...scopes])];
         const quotaFailure=isBackendThrottled(error);
         const failure=error as {message?:unknown};
          if(String(failure?.message||'').startsWith('Widget image is no longer available')){
          const message=String(failure.message);
          setSyncError(message);
          throw new Error(message);
        }
         if(writeAdminSettingsCache(previous,current.current,true,scopes,quotaFailure?'backend-throttled':undefined)){
           const reason=quotaFailure?'The backend is temporarily limiting writes. ':'';
          setSyncError(`LOCAL_DRAFT:${reason}Changes are saved on this device. Retry the save when Supabase is available to sync them.`);
           setLocalDraftAvailable(false);
           setLocalDraftRestored(true);
           setSaveRetryAvailable(false);
           return 'local' as const;
        }
        setSaveRetryAvailable(true);
        const message=quotaFailure
           ?'The backend is temporarily limiting writes and browser storage is unavailable. Keep this page open and retry later.'
           :'Could not save to Supabase or browser storage. Keep this page open and retry.';
        setSyncError(message);throw new Error(message);
     }).finally(()=>{
       inFlight.current=false;
       setDirty(pending.current>0);
       if(drainPendingAfterSuccess&&pending.current>0){
         setSaving(true);
         queueMicrotask(()=>{void persistPendingRef.current().catch(()=>{});});
       }else{
         setSaving(false);
         if(!pending.current)Object.entries(remote.current).forEach(([key,value])=>applyRemote(key,value));
       }
     });
      try{return await queue.current;}catch(error){throw error;}
   },[isAdmin,applyRemote,readSettingsDocumentFromServer]);
   persistPendingRef.current=persistPending;
   const setData:Dispatch<SetStateAction<AdminData>>=useCallback(update=>{
      if(!isAdmin){setSyncError('Administrator authorization is required to save changes.');return;}
     const next=cleanData(typeof update==='function'?update(current.current):update);
     current.current=next;replaceData(next);pending.current++;setDirty(true);setSyncError('');
   },[isAdmin]);
    const flush=useCallback((scope?:AdminSaveScope|AdminSaveScope[])=>persistPending(scope),[persistPending]);
    const flushAllRestoredSettings=useCallback(
      ()=>persistPending(RESTORED_SETTINGS_SAVE_SCOPES,true),
      [persistPending],
    );
  const seedStore=useCallback(async()=>{
    if(!db||!isAdmin)throw new Error('Administrator access required.');
    if(initialized)throw new Error('The store is already initialized. Existing data was not overwritten.');
    await runTransaction(db,async transaction=>{
      const globalRef=doc(db!,'storeContent','global');
      const global=await transaction.get(globalRef);
      if(global.exists())throw new Error('The store is already initialized. Existing data was not overwritten.');
      const entries=(['products','categories','deals','coupons','reviews'] as const).flatMap(key=>defaultAdminData[key].map(item=>({ref:doc(db!,key,String(item.id)),item})));
      const existing=await Promise.all(entries.map(entry=>transaction.get(entry.ref)));
      entries.forEach((entry,index)=>{if(!existing[index].exists())transaction.set(entry.ref,cleanData(entry.item));});
      transaction.set(globalRef,{content:defaultAdminData.content,settings:defaultAdminData.settings,policies:defaultAdminData.policies});
    });
  },[isAdmin,initialized]);
   const value=useMemo(()=>({data,setData,storefrontSettingsState,saving,dirty,syncError,localDraftAvailable,localDraftRestored,saveRetryAvailable,restoreLocalDraft,discardLocalDraft,flushAllRestoredSettings,restoredSettingsDirty,initialized,catalogReady,categoriesReady,flush,seedStore}),[data,setData,storefrontSettingsState,saving,dirty,syncError,localDraftAvailable,localDraftRestored,saveRetryAvailable,restoreLocalDraft,discardLocalDraft,flushAllRestoredSettings,restoredSettingsDirty,initialized,catalogReady,categoriesReady,flush,seedStore]);
  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdminStore(){
  const context=useContext(AdminContext);
  if(!context)throw new Error('AdminProvider is required');
  return context;
}
