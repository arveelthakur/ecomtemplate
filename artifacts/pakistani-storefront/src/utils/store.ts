import type { SeoMetadata } from './seo.js';

export type Product = {
  id:number;
  name:string;
  category:string;
  brand?:string;
  createdAt?:string;
  status?:'active'|'draft'|'archived';
  price:number;
  oldPrice?:number;
  badge?:string;
  image:string;
  mobileImage?:string;
  images?:string[];
  shade:string;
  fromPrice?:boolean;
  variants?:string[];
  variationTypes?:ProductVariationType[];
  variantMatrix?:ProductVariant[];
  features?:string[];
  additionalInfo?:string;
  description?:string;
  usage?:string;
  shippingInfo?:string;
  inStock?:boolean;
  rating?:number;
  reviewCount?:number;
  stock:number;
  freeDeliveryEligible:boolean;
  cashOnDeliveryEnabled?:boolean;
  quantityDiscounts?:ProductQuantityDiscountOverride;
  seo?:SeoMetadata;
};
export function isProductCustomerVisible(product:Product):boolean{
  return (product.status??'active')==='active';
}
export type ProductVariationType={id:string;name:string;values:string[];valuesText?:string};
export type ProductVariant={id:string;label:string;options:Record<string,string>;price:number;oldPrice?:number;stock:number;sku:string;image?:string};
function variationKey(value:string){let left=2166136261,right=5381;for(let index=0;index<value.length;index++){left=Math.imul(left^value.charCodeAt(index),16777619);right=Math.imul(right^value.charCodeAt(index),33);}return `variant-${(left>>>0).toString(36)}${(right>>>0).toString(36)}`;}
export function buildProductVariantMatrix(types:ProductVariationType[],previous:ProductVariant[]=[]):ProductVariant[]{
  if(!types.length||types.length>5||types.some(type=>!type.name.trim()||!type.values.length||type.values.length>40))return [];
  if(types.reduce((total,type)=>total*type.values.length,1)>250)return [];
  const combinations:Record<string,string>[]=[];
  const walk=(index:number,options:Record<string,string>)=>{
    if(index===types.length){combinations.push(options);return;}
    const type=types[index];
    type.values.forEach(value=>walk(index+1,{...options,[type.id]:value}));
  };
  walk(0,{});
  const old=new Map(previous.map(variant=>[JSON.stringify(Object.entries(variant.options).sort()),variant]));
  return combinations.map(options=>{
    const id=JSON.stringify(Object.entries(options).sort());
    const existing=old.get(id);
    const label=types.map(type=>options[type.id]).join(' / ');
    return existing?{...existing,options,label}:{id:variationKey(id),label,options,price:0,stock:0,sku:''};
  });
}
export function validateProductVariations(types:ProductVariationType[],matrix:ProductVariant[]):string|null{
  if(!types.length)return null;
  if(types.length>5)return 'A product can have up to five variation types.';
  if(types.some(type=>!type.name.trim()||!type.values.length||type.values.length>40||type.values.some(value=>!value.trim())))return 'Each variation type needs a name and at least one option.';
  if(types.reduce((total,type)=>total*type.values.length,1)>250)return 'This product creates too many combinations (maximum 250).';
  const expected=buildProductVariantMatrix(types,matrix);
  if(expected.length>250)return 'This product creates too many combinations (maximum 250).';
  if(matrix.length!==expected.length)return 'Complete every generated option combination.';
  if(matrix.some(variant=>!Number.isFinite(variant.price)||variant.price<=0||!Number.isInteger(variant.stock)||variant.stock<0||(variant.oldPrice!==undefined&&(!Number.isFinite(variant.oldPrice)||variant.oldPrice<=variant.price))))return 'Every combination needs a valid price and whole stock count; compare-at price must exceed its price.';
  return null;
}
export type QuantityDiscountTier={
  id:string;
  minQuantity:number;
  maxQuantity?:number;
  discountType:'percent'|'fixed';
  discountValue:number;
};
export type ProductQuantityDiscountOverride={
  mode:'custom'|'disabled';
  tiers:QuantityDiscountTier[];
};
export type QuantityDiscountSettings={
  enabled:boolean;
  tiers:QuantityDiscountTier[];
};
export const defaultQuantityDiscountTiers:QuantityDiscountTier[]=[
  {id:'volume-2-4',minQuantity:2,maxQuantity:4,discountType:'percent',discountValue:5},
  {id:'volume-5-plus',minQuantity:5,discountType:'percent',discountValue:10},
];
export function normalizeQuantityDiscountTiers(value:unknown):QuantityDiscountTier[]{
  if(!Array.isArray(value))return [];
  return value.flatMap((entry,index):QuantityDiscountTier[]=>{
    if(!entry||typeof entry!=='object')return [];
    const tier=entry as Partial<QuantityDiscountTier>;
    const minQuantity=Number(tier.minQuantity);
    const maxQuantity=tier.maxQuantity===undefined||tier.maxQuantity===null?undefined:Number(tier.maxQuantity);
    const discountValue=Number(tier.discountValue);
    if(!Number.isInteger(minQuantity)||minQuantity<1||(maxQuantity!==undefined&&(!Number.isInteger(maxQuantity)||maxQuantity<minQuantity)))return [];
    if((tier.discountType!=='percent'&&tier.discountType!=='fixed')||!Number.isFinite(discountValue)||discountValue<=0||(tier.discountType==='percent'&&discountValue>100))return [];
    return [{id:typeof tier.id==='string'&&tier.id.trim()?tier.id:`tier-${index+1}`,minQuantity,...(maxQuantity===undefined?{}:{maxQuantity}),discountType:tier.discountType,discountValue}];
  });
}
export function validateQuantityDiscountTiers(tiers:QuantityDiscountTier[]):string|null{
  if(!tiers.length)return 'Add at least one quantity tier.';
  const normalized=normalizeQuantityDiscountTiers(tiers);
  if(normalized.length!==tiers.length)return 'Each tier needs a valid quantity range and positive discount.';
  if(normalized.some(tier=>tier.discountType==='percent'&&tier.discountValue>100))return 'Percentage discounts cannot exceed 100%.';
  const sorted=[...normalized].sort((a,b)=>a.minQuantity-b.minQuantity);
  for(let index=1;index<sorted.length;index++){
    const previous=sorted[index-1];
    if(previous.maxQuantity===undefined||previous.maxQuantity>=sorted[index].minQuantity)return 'Quantity ranges cannot overlap.';
  }
  return null;
}
export type StoreCategory = {
  id:string;
  name:string;
  image:string;
  mobileImage?:string;
  images?:string[];
  sub:string;
  color:string;
  parentId?:string;
  seo?:SeoMetadata;
};

export const formatPKR=(n:number)=>`Rs ${n.toLocaleString('en-PK')}`;

export type QuantityDealRule={active:boolean;buyX:number;getY:number;productIds:number[]};
export function calculateDealDiscount(
  lines:Array<{product:Pick<Product,'id'|'price'>;quantity:number}>,
  deals:QuantityDealRule[],
){
  const units=lines.flatMap(({product,quantity})=>Array.from({length:Math.max(0,Math.floor(quantity))},()=>({productId:product.id,price:product.price,used:false})));
  let discount=0;
  for(const deal of deals){
    if(!deal.active||deal.buyX<1||deal.getY<1)continue;
    const groupSize=deal.buyX+deal.getY;
    const eligible=units.filter(unit=>!unit.used&&(!deal.productIds.length||deal.productIds.includes(unit.productId)));
    const groupCount=Math.floor(eligible.length/groupSize);
    for(let groupIndex=0;groupIndex<groupCount;groupIndex++){
      const group=eligible.slice(groupIndex*groupSize,(groupIndex+1)*groupSize).sort((a,b)=>a.price-b.price);
      group.forEach(unit=>{unit.used=true;});
      discount+=group.slice(0,deal.getY).reduce((total,unit)=>total+unit.price,0);
    }
  }
  return Math.round(discount*100)/100;
}
export function calculateBuyXGetYDiscount(lines:Array<{product:Pick<Product,'id'|'price'>;quantity:number}>){
  return calculateDealDiscount(lines,[{active:true,buyX:2,getY:1,productIds:[]}]);
}
export function getQuantityDiscountTiers(product:Product,settings:QuantityDiscountSettings):QuantityDiscountTier[]{
  if(!settings.enabled)return [];
  const override=product.quantityDiscounts;
  if(override?.mode==='disabled')return [];
  if(override?.mode==='custom')return normalizeQuantityDiscountTiers(override.tiers);
  return normalizeQuantityDiscountTiers(settings.tiers);
}
export function getQuantityDiscountQuote(product:Product,quantity:number,settings:QuantityDiscountSettings){
  const safeQuantity=Math.max(0,Math.floor(quantity));
  const tiers=getQuantityDiscountTiers(product,settings);
  const matching=tiers.filter(tier=>safeQuantity>=tier.minQuantity&&(tier.maxQuantity===undefined||safeQuantity<=tier.maxQuantity)).sort((a,b)=>b.minQuantity-a.minQuantity)[0];
  const perItemDiscount=matching
    ?Math.min(product.price,matching.discountType==='percent'?product.price*matching.discountValue/100:matching.discountValue)
    :0;
  const roundedPerItemDiscount=Math.round(perItemDiscount*100)/100;
  return {tiers,activeTier:matching??null,perItemDiscount:roundedPerItemDiscount,discountAmount:Math.round(roundedPerItemDiscount*safeQuantity*100)/100};
}
type DiscountLine={product:Product;quantity:number};
export function calculatePromotionSummary(
  lines:DiscountLine[],
  deals:QuantityDealRule[],
  quantityDiscounts:QuantityDiscountSettings,
){
  const grouped=new Map<number,{product:Product;quantity:number}>();
  lines.forEach(line=>{
    const current=grouped.get(line.product.id);
    if(current)current.quantity+=Math.max(0,Math.floor(line.quantity));
    else grouped.set(line.product.id,{product:line.product,quantity:Math.max(0,Math.floor(line.quantity))});
  });
  let quantityTierDiscount=0;
  const quotes=new Map<number,ReturnType<typeof getQuantityDiscountQuote>>();
  grouped.forEach(({product,quantity},productId)=>{
    const quote=getQuantityDiscountQuote(product,quantity,quantityDiscounts);
    quotes.set(productId,quote);
    quantityTierDiscount+=quote.discountAmount;
  });
  quantityTierDiscount=Math.round(quantityTierDiscount*100)/100;
  const tierAdjustedLines=lines.map(line=>{
    const quote=quotes.get(line.product.id);
    const adjustedPrice=Math.max(0,Math.round((line.product.price-(quote?.perItemDiscount??0))*100)/100);
    return {...line,product:{...line.product,price:adjustedPrice}};
  });
  const buyXGetYDiscount=calculateDealDiscount(tierAdjustedLines,deals);
  const subtotal=Math.round(lines.reduce((total,line)=>total+line.product.price*line.quantity,0)*100)/100;
  return {
    quantityTierDiscount,
    buyXGetYDiscount,
    discountedSubtotal:Math.max(0,Math.round((subtotal-quantityTierDiscount-buyXGetYDiscount)*100)/100),
  };
}