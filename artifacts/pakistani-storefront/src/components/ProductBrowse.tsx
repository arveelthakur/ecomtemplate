import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ChevronDown, Grid2X2, List, RotateCcw, SlidersHorizontal } from 'lucide-react';
import type { Product, StoreCategory } from '../utils/store';
import { isProductCustomerVisible } from '../utils/store';
import { normalizeCatalogBrowsingSettings, useAdminStore, type CatalogFilterKind, type CatalogFilterSection } from '../context/AdminContext';
import ProductCard from './ProductCard';
import StoreImagePlaceholderGrid from './StoreImagePlaceholderGrid';
import CatalogFilterIcon from './CatalogFilterIcon';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from './ui/sheet';

type SortMode = 'featured' | 'price-asc' | 'price-desc' | 'newest' | 'popular' | 'name-asc';

type ProductBrowseProps = {
  products: Product[];
  categories: StoreCategory[];
  selectedCategories: string[];
  onSelectedCategoriesChange: (categories: string[]) => void;
  query?: string;
  onClearExternalCategory?: () => void;
  emptyTitle?:string;
  emptyBody?:string;
  showFilters?:boolean;
  showProducts?:boolean;
  filtersOrder?:number;
  productsOrder?:number;
};

function isAvailable(product: Product) {
  return product.inStock !== false && product.stock > 0;
}

function isNewer(left: Product, right: Product) {
  const leftDate = Date.parse(left.createdAt || '');
  const rightDate = Date.parse(right.createdAt || '');
  const leftValue = Number.isFinite(leftDate) ? leftDate : left.id;
  const rightValue = Number.isFinite(rightDate) ? rightDate : right.id;
  return rightValue - leftValue;
}

export default function ProductBrowse({
  products,
  categories,
  selectedCategories,
  onSelectedCategoriesChange,
  query = '',
  onClearExternalCategory,
  emptyTitle='No products found',
  emptyBody='Try adjusting your search or filters.',
  showFilters=true,
  showProducts=true,
  filtersOrder=0,
  productsOrder=1,
}: ProductBrowseProps) {
  const { data, catalogReady } = useAdminStore();
  const visibleProducts=useMemo(()=>products.filter(isProductCustomerVisible),[products]);
  const browsing = normalizeCatalogBrowsingSettings(data.settings?.catalogBrowsing);
  const [minimumPrice, setMinimumPrice] = useState('');
  const [maximumPrice, setMaximumPrice] = useState('');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [topRatedOnly, setTopRatedOnly] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('featured');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [gridColumns,setGridColumns]=useState<2|3|4>(4);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterButtonRef=useRef<HTMLButtonElement>(null);
  const configuredKinds = new Set(browsing.filterSections.map(section => section.kind));
  const filterEnabled = (kind: CatalogFilterKind) => browsing.filters[kind] && configuredKinds.has(kind);
  const priceFilterEnabled = filterEnabled('price');
  const availabilityFilterEnabled = filterEnabled('availability');
  const categoryFilterEnabled = filterEnabled('categories');
  const brandFilterEnabled = filterEnabled('brands');
  const topRatedFilterEnabled = filterEnabled('topRated');
  const alphabeticalSortEnabled = filterEnabled('alphabetical');
  const toolbar=browsing.toolbar;
  const effectiveView = toolbar.showViewSwitcher ? viewMode : 'grid';
  const normalizedQuery = query.trim().toLocaleLowerCase();

  useEffect(() => {
    if (!alphabeticalSortEnabled && sortMode === 'name-asc') setSortMode('featured');
  }, [alphabeticalSortEnabled, sortMode]);

  const availableCategories = useMemo(
    () => categories.filter(category => visibleProducts.some(product => product.category === category.name)),
    [categories, visibleProducts],
  );
  const availableBrands = useMemo(
    () => [...new Set(visibleProducts.map(product => product.brand?.trim()).filter((brand): brand is string => Boolean(brand)))].sort((a, b) => a.localeCompare(b)),
    [visibleProducts],
  );
  const priceBounds = useMemo(() => {
    const prices = visibleProducts.map(product => product.price).filter(Number.isFinite);
    return prices.length ? { min: Math.floor(Math.min(...prices)), max: Math.ceil(Math.max(...prices)) } : { min: 0, max: 0 };
  }, [visibleProducts]);

  const filteredProducts = useMemo(() => {
    const matching = visibleProducts.filter(product => {
      if (normalizedQuery && !`${product.name} ${product.category} ${product.brand || ''}`.toLocaleLowerCase().includes(normalizedQuery)) return false;
      if (selectedCategories.length && !selectedCategories.includes(product.category)) return false;
      if (priceFilterEnabled && minimumPrice !== '' && product.price < Number(minimumPrice)) return false;
      if (priceFilterEnabled && maximumPrice !== '' && product.price > Number(maximumPrice)) return false;
      if (availabilityFilterEnabled && inStockOnly && !isAvailable(product)) return false;
      if (brandFilterEnabled && selectedBrands.length && !selectedBrands.includes(product.brand?.trim() || '')) return false;
      if (topRatedFilterEnabled && topRatedOnly && (product.rating ?? 0) < 4.5) return false;
      return true;
    });

    switch (sortMode) {
      case 'price-asc':
        return matching.sort((a, b) => a.price - b.price);
      case 'price-desc':
        return matching.sort((a, b) => b.price - a.price);
      case 'newest':
        return matching.sort(isNewer);
      case 'popular':
        return matching.sort((a, b) => (b.reviewCount ?? 0) - (a.reviewCount ?? 0) || (b.rating ?? 0) - (a.rating ?? 0));
      case 'name-asc':
        return matching.sort((a, b) => a.name.localeCompare(b.name));
      default:
        return matching;
    }
  }, [
    visibleProducts,
    normalizedQuery,
    selectedCategories,
    priceFilterEnabled,
    minimumPrice,
    maximumPrice,
    availabilityFilterEnabled,
    inStockOnly,
    brandFilterEnabled,
    topRatedFilterEnabled,
    topRatedOnly,
    alphabeticalSortEnabled,
    selectedBrands,
    sortMode,
  ]);

  const activeFilters = Number(priceFilterEnabled && (minimumPrice !== '' || maximumPrice !== ''))
    + Number(availabilityFilterEnabled && inStockOnly)
    + (categoryFilterEnabled ? selectedCategories.length : 0)
    + (brandFilterEnabled ? selectedBrands.length : 0)
    + Number(topRatedFilterEnabled && topRatedOnly);

  const toggleValue = (values: string[], value: string, onChange: (next: string[]) => void) => {
    onChange(values.includes(value) ? values.filter(item => item !== value) : [...values, value]);
  };

  const clearFilters = () => {
    setMinimumPrice('');
    setMaximumPrice('');
    setInStockOnly(false);
    setSelectedBrands([]);
    setTopRatedOnly(false);
    setSortMode('featured');
    setViewMode('grid');
    onSelectedCategoriesChange([]);
    onClearExternalCategory?.();
  };

  const displayedFilterSections=browsing.filterSections.filter(section=>
    filterEnabled(section.kind)
    &&(section.kind!=='categories'||availableCategories.length>0)
    &&(section.kind!=='brands'||availableBrands.length>0),
  );
  const hasToolbarControls=(showFilters&&toolbar.showFilterButton)||toolbar.showSortDropdown||toolbar.showViewSwitcher||toolbar.showColumnLayoutSwitcher;
  const toolbarStyle:CSSProperties={
    backgroundColor:toolbar.backgroundMode==='global'?'var(--nura-background,#fdfbf7)':toolbar.backgroundColor,
    borderColor:toolbar.borderColor,
    borderRadius:toolbar.borderRadiusMode==='global'?'var(--nura-control-radius,12px)':`${toolbar.borderRadiusPx}px`,
    padding:`calc(${toolbar.paddingPx}px * var(--nura-spacing-density,1))`,
  };
  const productGridStyle={'--nura-product-columns':gridColumns,order:productsOrder} as CSSProperties;

  return <div className="mt-6 flex flex-col">
    {hasToolbarControls&&<div
      className="nura-product-toolbar mx-1 flex min-h-12 w-auto min-w-0 items-center justify-between gap-1 rounded-xl border border-[#e5e0d8] bg-[#fdfbf7] p-2.5 sm:mx-0 sm:gap-2"
      data-testid="product-toolbar-control-box"
      style={{...toolbarStyle,order:filtersOrder}}
    >
      {showFilters&&toolbar.showFilterButton&&<button ref={filterButtonRef} type="button" onClick={() => setFilterOpen(true)} aria-haspopup="dialog" aria-label={`Open product filters${activeFilters > 0 ? `, ${activeFilters} active` : ''}`} className="inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg px-2 text-[11px] font-medium text-[#514742] transition-colors hover:bg-[#f3eee6] sm:gap-2 sm:px-3 sm:text-xs" data-testid="button-open-product-filters">
        <SlidersHorizontal size={toolbar.iconSizePx}/><span data-testid="filter-label">Filter</span>{activeFilters > 0 && <span aria-hidden="true" className="grid h-5 min-w-5 place-items-center rounded-full bg-[#6B2447] px-1 text-[9px] text-white">{activeFilters}</span>}
      </button>}
      {showFilters&&toolbar.showFilterButton&&toolbar.showSortDropdown&&<span aria-hidden="true" className="mx-1 h-6 w-px shrink-0 bg-gray-300 sm:mx-2" />}
      {toolbar.showSortDropdown&&<label className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-gray-500 sm:gap-2" htmlFor="browse-sort">
        <span className="shrink-0 text-xs font-normal text-gray-500">Sort by</span>
        <select id="browse-sort" aria-label="Sort products" value={sortMode} onChange={event => setSortMode(event.target.value as SortMode)} className="min-w-0 flex-1 truncate border-0 bg-transparent px-0.5 text-sm font-medium text-[#514742] outline-none focus:bg-[#f3eee6] sm:px-1" data-testid="select-product-sort">
          <option value="featured">Featured</option><option value="price-asc">Price: Low</option><option value="price-desc">Price: High</option><option value="newest">Newest</option><option value="popular">Popular</option>
          {alphabeticalSortEnabled && <option value="name-asc">Name: A–Z</option>}
        </select>
      </label>}
      {toolbar.showViewSwitcher && <div role="group" aria-label="Product view" className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#f0ebe1] p-1">
        <button
          type="button"
          aria-label="Grid view"
          aria-pressed={effectiveView === 'grid'}
          onClick={() => setViewMode('grid')}
          className={`grid h-8 w-8 place-items-center rounded-md p-1.5 transition-colors ${effectiveView === 'grid' ? 'bg-[#6b214c] text-white' : 'text-[#645951] hover:bg-white/70'}`}
          data-testid="button-product-view-grid"
        ><Grid2X2 size={toolbar.iconSizePx} /></button>
        <button
          type="button"
          aria-label="List view"
          aria-pressed={effectiveView === 'list'}
          onClick={() => setViewMode('list')}
          className={`grid h-8 w-8 place-items-center rounded-md p-1.5 transition-colors ${effectiveView === 'list' ? 'bg-[#6b214c] text-white' : 'text-[#645951] hover:bg-white/70'}`}
          data-testid="button-product-view-list"
        ><List size={toolbar.iconSizePx} /></button>
      </div>}
      {toolbar.showColumnLayoutSwitcher&&effectiveView==='grid'&&<div role="group" aria-label="Grid columns" className="inline-flex shrink-0 items-center gap-0.5 rounded-lg bg-[#f0ebe1] p-1" data-testid="group-grid-columns">{([2,3,4] as const).map(count=><button key={count} type="button" aria-label={`${count} columns`} aria-pressed={gridColumns===count} onClick={()=>setGridColumns(count)} className={`grid min-h-7 min-w-7 place-items-center rounded-md px-1 text-[10px] font-semibold transition-colors ${gridColumns===count?'bg-[#6b214c] text-white':'text-[#645951] hover:bg-white/70'}`} data-testid={`button-grid-columns-${count}`}>{count}</button>)}</div>}
    </div>}
    {showProducts&&<div className="flex justify-end pt-2" style={{order:productsOrder}}>
      <p className="text-[11px] text-[#81766c]" aria-live="polite" data-testid="text-product-results-count">
         Showing {filteredProducts.length} of {visibleProducts.length} products
      </p>
    </div>}

    {showFilters&&<Sheet open={filterOpen} onOpenChange={setFilterOpen}>
      <SheetContent side="right" onCloseAutoFocus={event=>{event.preventDefault();filterButtonRef.current?.focus();}} className="flex h-full max-h-[100dvh] w-[min(92vw,420px)] max-w-[420px] flex-col overflow-hidden border-l-[#e9e2d8] bg-[#fffefa] p-0 text-[#352b2b]">
        <SheetHeader className="border-b border-[#e9e2d8] px-5 pb-4 pt-6 text-left">
          <SheetTitle className="font-semibold text-[#352b2b]">Filters</SheetTitle>
          <SheetDescription className="text-[11px] leading-5 text-[#81766c]">Narrow the collection to find what suits you.</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-2">
          {displayedFilterSections.map(section=>{
            const itemStyle={fontSize:`${section.itemSizePx}px`};
            const summaryStyle={fontSize:`${section.headingSizePx}px`};
            return <details key={section.id} className="catalog-filter-accordion border-b border-[#ece5dc]" data-testid={`accordion-filter-${section.kind}`}>
              <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 py-3 font-semibold text-[#493f3b]" style={summaryStyle} data-testid={`summary-filter-${section.kind}`}>
                <CatalogFilterIcon name={section.icon} size={16} className="shrink-0 text-[#6B2447]"/>
                <span className="min-w-0 flex-1">{section.title}</span>
                <ChevronDown size={16} strokeWidth={1.8} className="catalog-filter-chevron shrink-0 text-[#766d64]"/>
              </summary>
              <div className="space-y-2 pb-4 pl-7 pr-1 text-[#514742]" style={itemStyle}>
                {section.kind==='price'&&<div className="grid grid-cols-2 gap-3">
                  <label className="text-[#81766c]" htmlFor="browse-price-min">Minimum
                    <input id="browse-price-min" type="number" inputMode="numeric" min={priceBounds.min} max={priceBounds.max} value={minimumPrice} onChange={event=>setMinimumPrice(event.target.value)} placeholder={priceBounds.min.toLocaleString('en-PK')} aria-label="Minimum price" className="mt-1 h-10 w-full rounded-sm border border-[#ded5c9] bg-[#fdfbf7] px-2 text-[#463b38] outline-none focus:border-[#6B2447]" style={itemStyle} data-testid="input-filter-price-min"/>
                  </label>
                  <label className="text-[#81766c]" htmlFor="browse-price-max">Maximum
                    <input id="browse-price-max" type="number" inputMode="numeric" min={priceBounds.min} max={priceBounds.max} value={maximumPrice} onChange={event=>setMaximumPrice(event.target.value)} placeholder={priceBounds.max.toLocaleString('en-PK')} aria-label="Maximum price" className="mt-1 h-10 w-full rounded-sm border border-[#ded5c9] bg-[#fdfbf7] px-2 text-[#463b38] outline-none focus:border-[#6B2447]" style={itemStyle} data-testid="input-filter-price-max"/>
                  </label>
                </div>}
                {section.kind==='availability'&&<label className="flex cursor-pointer items-center gap-2 py-1">
                  <input type="checkbox" checked={inStockOnly} onChange={event=>setInStockOnly(event.target.checked)} className="accent-[#6B2447]" data-testid="checkbox-filter-in-stock"/>
                  In stock
                </label>}
                {section.kind==='categories'&&<div className="max-h-56 space-y-1 overflow-y-auto">
                  {availableCategories.map(category=><label key={category.id} className="flex cursor-pointer items-center gap-2 py-2">
                    <input type="checkbox" checked={selectedCategories.includes(category.name)} onChange={()=>toggleValue(selectedCategories,category.name,onSelectedCategoriesChange)} className="accent-[#6B2447]" data-testid={`checkbox-filter-category-${category.id}`}/>
                    <CatalogFilterIcon name={browsing.categoryIcons[category.id]||'layers'} size={15} className="shrink-0 text-[#8a7b6e]"/>
                    <span>{category.name}</span>
                  </label>)}
                </div>}
                {section.kind==='brands'&&<div className="max-h-48 space-y-1 overflow-y-auto">
                  {availableBrands.map(brand=><label key={brand} className="flex cursor-pointer items-center gap-2 py-2">
                    <input type="checkbox" checked={selectedBrands.includes(brand)} onChange={()=>toggleValue(selectedBrands,brand,setSelectedBrands)} className="accent-[#6B2447]" data-testid={`checkbox-filter-brand-${brand.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`}/>
                    <span>{brand}</span>
                  </label>)}
                </div>}
                {section.kind==='topRated'&&<label className="flex cursor-pointer items-center gap-2 py-1">
                  <input type="checkbox" checked={topRatedOnly} onChange={event=>setTopRatedOnly(event.target.checked)} className="accent-[#6B2447]" data-testid="checkbox-filter-top-rated"/>
                  <span className="text-[#b88422]" aria-hidden="true">★</span> 4.5 stars &amp; up
                </label>}
                {section.kind==='alphabetical'&&<label className="flex cursor-pointer items-center gap-2 py-1">
                  <input type="checkbox" checked={sortMode==='name-asc'} onChange={event=>setSortMode(event.target.checked?'name-asc':'featured')} className="accent-[#6B2447]" data-testid="checkbox-filter-sort-alphabetical"/>
                  Sort alphabetically (A–Z)
                </label>}
              </div>
            </details>;
          })}
          {displayedFilterSections.length===0&&<p className="py-8 text-center text-xs text-[#81766c]">No filter sections are currently available.</p>}
        </div>
        <div className="grid grid-cols-2 gap-2 border-t border-[#e9e2d8] bg-[#fffefa] px-5 py-4">
          <button type="button" onClick={()=>setFilterOpen(false)} className="inline-flex h-11 items-center justify-center border border-[#6B2447] bg-[#6B2447] text-[11px] font-semibold text-white transition-colors hover:bg-[#571b39]" data-testid="button-apply-product-filters">
            Apply Filters
          </button>
          <button type="button" onClick={clearFilters} className="inline-flex h-11 items-center justify-center gap-2 border border-[#ded5c9] bg-white text-[11px] font-semibold text-[#6B2447] transition-colors hover:bg-[#f6f1ea]" data-testid="button-clear-product-filters">
            <RotateCcw size={13}/> Clear filters{activeFilters?` (${activeFilters})`:''}
          </button>
        </div>
      </SheetContent>
    </Sheet>}

    <div style={{order:productsOrder}}>{showProducts&&<>{filteredProducts.length
      ? <div className={effectiveView === 'grid' ? 'nura-product-grid mt-6 grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5' : 'mt-3 divide-y divide-[#e4dcd1]'} style={effectiveView==='grid'?productGridStyle:undefined}>
        {filteredProducts.map(product => <ProductCard key={product.id} product={product} view={effectiveView} />)}
      </div>
      : <div className="nura-empty-catalog-state py-8 text-sm text-[#83796f]" role="status" data-testid="text-no-products">
        <strong className="block">{emptyTitle}</strong><span className="mt-1 block">{emptyBody}</span>
        {!visibleProducts.length&&catalogReady&&<StoreImagePlaceholderGrid itemType="product" shape="portrait" dimensions="Recommended: 1000 × 1000 px" count={4} hint="Add a product and upload a square image in Admin → Catalog → Products." testId="grid-empty-products"/>}
      </div>}</>}
    </div>
  </div>;
}
