import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CommerceLayout } from '../components/CommerceLayout';
import ProductBrowse from '../components/ProductBrowse';
import { useStore } from '../context/StoreContext';
import { useAdminStore } from '../context/AdminContext';
import { configuredStoreName } from '../utils/branding';

export default function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { products, categories } = useStore();
  const {data}=useAdminStore();
  const pageCopy=data.content.storePages.catalog;
  const storeName=configuredStoreName(data.settings.general.storeName);
  const modules=data.content.storePageLayouts.catalog;
  const moduleOrder=(id:string)=>modules.findIndex(module=>module.id===id);
  const query = searchParams.get('q') || '';
  const categoryParam = searchParams.get('category') || '';
  const category = categories.find(item => item.id === categoryParam || item.name.toLocaleLowerCase() === categoryParam.toLocaleLowerCase());
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  useEffect(() => {
    if (category) setSelectedCategories([category.name]);
  }, [category?.id, category?.name]);

  const clearCategoryFromUrl = () => {
    if (!searchParams.has('category')) return;
    const next = new URLSearchParams(searchParams);
    next.delete('category');
    setSearchParams(next, { replace: true });
  };

  const pageTitle = query.trim()
    ? `Results for “${query.trim()}”`
    : category?.name || pageCopy.title;

  return <CommerceLayout
    eyebrow={query.trim() ? 'Search results' : storeName ? `The ${storeName} collection` : 'Shop the collection'}
    title={pageTitle}
    intro={query.trim() ? 'Browse the products that match your search, then narrow the list with filters.' : pageCopy.intro}
  >
    <ProductBrowse
      products={products}
      categories={categories}
      selectedCategories={selectedCategories}
      onSelectedCategoriesChange={setSelectedCategories}
      query={query}
      onClearExternalCategory={clearCategoryFromUrl}
      emptyTitle={pageCopy.emptyTitle}
      emptyBody={pageCopy.emptyBody}
      showFilters={modules.find(module=>module.id==='filters')?.visible!==false}
      showProducts={modules.find(module=>module.id==='productGrid')?.visible!==false}
      filtersOrder={moduleOrder('filters')}
      productsOrder={moduleOrder('productGrid')}
    />
  </CommerceLayout>;
}
