import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CommerceLayout } from '../components/CommerceLayout';
import ProductBrowse from '../components/ProductBrowse';
import { useAdminStore } from '../context/AdminContext';
import { useStore } from '../context/StoreContext';
import { findCategoryBySlug } from '../utils/categoryRoutes';
import { isProductCustomerVisible } from '../utils/store';
import NotFound from './not-found';

export default function CategoryPage(){
  const {categorySlug='',collectionSlug=''}=useParams();
  const {products,categories}=useStore();
  const {catalogReady,categoriesReady,syncError}=useAdminStore();
  const category=findCategoryBySlug(categories,collectionSlug||categorySlug);
  const [selectedCategories,setSelectedCategories]=useState<string[]>([]);

  useEffect(()=>{
    setSelectedCategories(category?[category.name]:[]);
  },[category?.id,category?.name]);

  if(!catalogReady||!categoriesReady){
    if(syncError)return <CommerceLayout eyebrow="Collection" title="Collection unavailable"><p role="alert" className="text-sm text-[#9b3e4c]">This collection could not be loaded. Please try again shortly.</p></CommerceLayout>;
    return <CommerceLayout eyebrow="Collection" title={category?.name||'Loading collection'}><p role="status" className="text-sm text-[#81766c]">Loading products…</p></CommerceLayout>;
  }
  if(!category)return <NotFound/>;

  const categoryProducts=products.filter(product=>isProductCustomerVisible(product)&&product.category===category.name);
  return <CommerceLayout eyebrow="Collection" title={category.name}>
    <ProductBrowse
      products={categoryProducts}
      categories={[category]}
      selectedCategories={selectedCategories}
      onSelectedCategoriesChange={setSelectedCategories}
      onClearExternalCategory={()=>setSelectedCategories([category.name])}
    />
  </CommerceLayout>;
}
