import {
  Droplets,
  Layers,
  Leaf,
  Package,
  ShieldCheck,
  Shirt,
  SlidersHorizontal,
  Sparkles,
  Star,
  Tag,
  Waves,
  type LucideIcon,
} from 'lucide-react';

const iconByName:Record<string,LucideIcon>={
  droplets:Droplets,
  layers:Layers,
  leaf:Leaf,
  package:Package,
  shield:ShieldCheck,
  shirt:Shirt,
  sliders:SlidersHorizontal,
  sparkles:Sparkles,
  star:Star,
  tag:Tag,
  waves:Waves,
};

export default function CatalogFilterIcon({name,size=15,className}:{name:string;size?:number;className?:string}){
  const Icon=iconByName[name]??SlidersHorizontal;
  return <Icon size={size} strokeWidth={1.8} className={className} aria-hidden="true"/>;
}
