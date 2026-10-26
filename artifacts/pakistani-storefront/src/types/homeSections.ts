export type HomeSectionId =
  | 'hero'
  | 'promises'
  | 'categories'
  | 'statistics'
  | 'products'
  | 'bestsellers'
  | 'newArrivals'
  | 'offerBanner'
  | 'story'
  | 'testimonials'
  | 'instagram'
  | 'mediaBanner'
  | 'features'
  | 'faq'
  | 'newsletter'
  | 'contact'
  | 'announcement'
  | 'footer';

export type HomeSectionAlignment='default'|'left'|'center'|'right';

export type HomeSectionAppearance={
  backgroundColor:string;
  borderColor:string;
  borderWidthPx:number;
  borderRadiusPx:number;
  borderOpacity:number;
  headingFontSizePx:number;
  bodyFontSizePx:number;
  alignment:HomeSectionAlignment;
};

export type HomeSectionSetting={
  id:HomeSectionId;
  visible:boolean;
  appearance:HomeSectionAppearance;
  headingOverride:string;
  subheadingOverride:string;
};

export const homeSectionDefinitions:{id:HomeSectionId;label:string;defaultVisible:boolean;heading:string;subheading:string}[]=[
  {id:'announcement',label:'Announcement bar',defaultVisible:true,heading:'',subheading:''},
  {id:'hero',label:'Hero slider',defaultVisible:true,heading:'',subheading:''},
  {id:'promises',label:'Trust badges / guarantees',defaultVisible:true,heading:'',subheading:''},
  {id:'categories',label:'Featured categories',defaultVisible:true,heading:'Shop by category',subheading:'Browse products by category'},
  {id:'statistics',label:'Store statistics / milestones',defaultVisible:false,heading:'Our store',subheading:'A few facts about the business'},
  {id:'products',label:'Featured products',defaultVisible:true,heading:'Featured products',subheading:'Explore the catalog'},
  {id:'bestsellers',label:'Bestsellers',defaultVisible:false,heading:'Popular products',subheading:'Customer favorites'},
  {id:'newArrivals',label:'New arrivals',defaultVisible:false,heading:'New arrivals',subheading:'Recently added products'},
  {id:'offerBanner',label:'Sale / offer banner',defaultVisible:false,heading:'',subheading:''},
  {id:'story',label:'Brand story / About us',defaultVisible:true,heading:'',subheading:''},
  {id:'testimonials',label:'Customer reviews',defaultVisible:false,heading:'Customer reviews',subheading:'Feedback from our customers'},
  {id:'instagram',label:'Instagram feed',defaultVisible:false,heading:'From our community',subheading:'Updates from our social channels'},
  {id:'mediaBanner',label:'Custom image / video banner',defaultVisible:false,heading:'',subheading:''},
  {id:'features',label:'Store features',defaultVisible:false,heading:'Why shop with us',subheading:'Add the benefits your store offers'},
  {id:'faq',label:'Frequently asked questions',defaultVisible:false,heading:'Frequently asked questions',subheading:'Answers to common questions'},
  {id:'newsletter',label:'Newsletter signup',defaultVisible:true,heading:'',subheading:''},
  {id:'contact',label:'Contact form',defaultVisible:true,heading:'Get in touch',subheading:'Contact our team for help with products or orders.'},
  {id:'footer',label:'Store footer',defaultVisible:true,heading:'',subheading:''},
];

export type HomeHeroSettings={
  desktopHeightPx:number;
  mobileHeightPx:number;
  showArrows:boolean;
  showCtas:boolean;
  showDots:boolean;
  arrowsStyle:'overlay'|'outer'|'minimal';
  autoPlayEnabled:boolean;
  autoPlayDurationMs:number;
};

export type HomeOfferBanner={
  eyebrow:string;
  title:string;
  copy:string;
  buttonText:string;
  targetUrl:string;
  backgroundColor:string;
  foregroundColor:string;
  imageUrl:string;
  mobileImageUrl:string;
};

export type HomeFeature={
  id:string;
  title:string;
  description:string;
  icon:string;
  visible:boolean;
};

export type HomeFeatureSectionSettings={
  schemaVersion:number;
  eyebrow:string;
  tagline:string;
  sectionSpacingPx:number;
  cardGapPx:number;
  cardRadiusPx:number;
  iconSizePx:number;
  layout:'two-column'|'single-column';
  cardBackgroundColor:string;
  cardBorderColor:string;
  plumColor:string;
  goldColor:string;
  sageColor:string;
};

export const defaultHomeFeatureSectionSettings:HomeFeatureSectionSettings={
  schemaVersion:3,
  eyebrow:'WHY SHOP WITH US',
  tagline:'SERVICE · QUALITY · CARE',
  sectionSpacingPx:52,
  cardGapPx:14,
  cardRadiusPx:20,
  iconSizePx:20,
  layout:'two-column',
  cardBackgroundColor:'#fffdf8',
  cardBorderColor:'#e5d8c2',
  plumColor:'#54233f',
  goldColor:'#a7824a',
  sageColor:'#e9ede4',
};

export type InstagramPost={
  id:string;
  imageUrl:string;
  caption:string;
  postUrl:string;
};

export type HomeMediaBanner={
  mode:'image'|'video';
  title:string;
  copy:string;
  buttonText:string;
  imageUrl:string;
  mobileImageUrl:string;
  mediaUrl:string;
  targetUrl:string;
};

export type HomeFaqItem={
  id:string;
  question:string;
  answer:string;
};

export type HomeNewsletterSettings={
  eyebrow:string;
  title:string;
  copy:string;
  emailPlaceholder:string;
  buttonText:string;
  guarantees:string[];
};
