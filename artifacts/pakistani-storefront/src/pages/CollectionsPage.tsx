import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CommerceLayout } from '../components/CommerceLayout';
import { useAdminStore } from '../context/AdminContext';
import { useStore } from '../context/StoreContext';
import { categoryRoute } from '../utils/categoryRoutes';
import { isProductCustomerVisible } from '../utils/store';
import StoreImage from '../components/StoreImage';

export default function CollectionsPage(){
  const {products,categories}=useStore();
  const {data,categoriesReady,catalogReady}=useAdminStore();

  return <CommerceLayout eyebrow="Find your feeling" title="Shop by category" intro="Explore thoughtful essentials, grouped into collections.">
    {!categoriesReady||!catalogReady
      ?<p role="status" className="text-sm text-[#81766c]">Loading collections…</p>
      :categories.length===0
        ?<div className="nura-empty-catalog-state py-8 text-center text-sm text-[#81766c]" data-testid="empty-collections">No collections are available yet.</div>
        :<div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4" data-testid="collection-grid">
          {categories.map(category=>{
            const count=products.filter(product=>isProductCustomerVisible(product)&&product.category===category.name).length;
            return <Link key={category.id} to={categoryRoute(category,categories)} className="group text-left" data-testid={`link-collection-${category.id}`}>
              <div className="relative mb-4 aspect-[4/5] overflow-hidden bg-[#eee5dc]" style={{backgroundColor:category.color}}>
                 <StoreImage src={category.image} mobileSrc={category.mobileImage} fallbackSources={category.images} alt="" loading="lazy" decoding="async" pictureClassName="absolute inset-0 block" className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-[1.03]"/>
                {data.content.showCategoryProductCount&&<span className="absolute left-3 top-3 rounded-full bg-[#FDFBF7]/90 px-3 py-1.5 text-[10px] tracking-wide" data-testid={`badge-collection-product-count-${category.id}`}>{count} products</span>}
              </div>
              <h2 className="nura-heading-small text-[14px] font-semibold sm:text-[16px]">{category.name}</h2>
              <p className="mt-1 text-xs text-[#80756b]">{category.sub}</p>
              <span className="mt-3 inline-flex items-center gap-2 text-[11px] font-semibold text-[#6B2447]">Explore collection <ArrowRight size={13}/></span>
            </Link>;
          })}
        </div>}
  </CommerceLayout>;
}
