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
  | 'videoReviews'
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

export type HomeSectionDefinition={id:HomeSectionId;label:string;defaultVisible:boolean;heading:string;subheading:string};

export const homeSectionDefinitions:HomeSectionDefinition[]=[
  {id:'announcement',label:'Announcement bar',defaultVisible:true,heading:'',subheading:''},
  {id:'hero',label:'Hero slider',defaultVisible:true,heading:'',subheading:'THE NURA EDIT'},
  {id:'promises',label:'Trust badges / guarantees',defaultVisible:true,heading:'The Nura promise',subheading:'Thoughtful details, made easy to shop'},
  {id:'categories',label:'Featured categories',defaultVisible:true,heading:'Discover the Collection',subheading:'Pieces for every kind of glow'},
  {id:'statistics',label:'Store statistics / milestones',defaultVisible:true,heading:'A little proof, in numbers',subheading:'Clear details to shop with confidence'},
  {id:'products',label:'Featured products',defaultVisible:true,heading:'The Heirloom Edit',subheading:'Fashion jewelry for everyday and occasions'},
  {id:'bestsellers',label:'Bestsellers',defaultVisible:true,heading:'Most Adored',subheading:'A considered edit of Nura favorites'},
  {id:'newArrivals',label:'New arrivals',defaultVisible:false,heading:'Just Arrived',subheading:'Fresh pieces for your next glow'},
  {id:'offerBanner',label:'Occasion edit',defaultVisible:true,heading:"Crafted for Life's Special Moments",subheading:'Fashion jewelry for celebrations and keepsake-worthy days'},
  {id:'story',label:'Brand story / About us',defaultVisible:true,heading:'Our story',subheading:'Wear your glow.'},
  {id:'testimonials',label:'Customer reviews',defaultVisible:true,heading:'Words from the Nura community',subheading:'Verified customer notes, shared with care'},
  {id:'videoReviews',label:'Video reviews',defaultVisible:true,heading:'In their own words',subheading:'Real customer stories, shared with permission'},
  {id:'instagram',label:'Social gallery',defaultVisible:true,heading:'The Nura edit, in real life',subheading:'A little inspiration from every angle'},
  {id:'mediaBanner',label:'Gift edit',defaultVisible:true,heading:'A Gift That Lasts Forever',subheading:'Thoughtful details, for someone special'},
  {id:'features',label:'Store features',defaultVisible:true,heading:'The Nura standard',subheading:'The details behind the edit'},
  {id:'faq',label:'Frequently asked questions',defaultVisible:true,heading:'The details, answered',subheading:'A few helpful notes before you choose'},
  {id:'newsletter',label:'Newsletter signup',defaultVisible:true,heading:'Get Exclusive Offers',subheading:'New edits, care notes and occasional offers'},
  {id:'contact',label:'Contact form',defaultVisible:true,heading:'We’re here to help',subheading:'Questions about a piece, an order, or care? Reach out.'},
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
  plumColor:'#4A2837',
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
