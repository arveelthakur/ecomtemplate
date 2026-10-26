import { useRef, type TouchEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import StoreImage from './StoreImage';

type ProductGalleryImageProps = {
  src: string;
  alt: string;
  shade: string;
  className: string;
  loading?: 'eager' | 'lazy';
  fetchPriority?: 'high' | 'low' | 'auto';
  fallbackSources?: string[];
  mobileSrc?: string;
};

function ProductGalleryImage({ src, alt, shade, className, loading, fetchPriority, fallbackSources=[], mobileSrc }: ProductGalleryImageProps) {
  return <StoreImage
    src={src}
    mobileSrc={mobileSrc}
    fallbackSources={fallbackSources}
    alt={alt}
    loading={loading}
    fetchPriority={fetchPriority}
    decoding="async"
    className={className}
    style={{ background: shade }}
    placeholderTitle="Product image placeholder"
    placeholderHint="Add a product photo in Admin → Products."
    placeholderDimensions="Recommended: 1000 × 1000 px"
  />;
}

type ProductGalleryProps = {
  images: string[];
  productName: string;
  shade: string;
  badge?: string;
  mode: 'grid'|'slider';
  mobileImage?: string;
  index: number;
  onIndexChange: (index: number) => void;
};

export default function ProductGallery({ images, productName, shade, badge, mode, mobileImage, index, onIndexChange }: ProductGalleryProps) {
  const touchStart = useRef<{x:number;y:number}|null>(null);
  const pointerStart = useRef<{x:number;y:number}|null>(null);
  if (!images.length) return null;

  const activeIndex = Math.max(0, Math.min(index, images.length - 1));
  const sliderMode = mode === 'slider' || images.length === 1;
  const move = (direction: number) => {
    if (images.length < 2) return;
    onIndexChange((activeIndex + direction + images.length) % images.length);
  };
  const finishSwipe = (event: TouchEvent<HTMLDivElement>) => {
    const start = touchStart.current;
    touchStart.current = null;
    const end = event.changedTouches[0];
    if (!start || !end) return;
    const distanceX = start.x - end.clientX;
    const distanceY = start.y - end.clientY;
    if (Math.abs(distanceX) < 45 || Math.abs(distanceX) <= Math.abs(distanceY)) return;
    move(distanceX > 0 ? 1 : -1);
  };
  const badgeElement = badge
    ? <span className="absolute left-3 top-3 z-10 max-w-[85%] truncate bg-[#FDFBF7] px-2.5 py-1.5 text-[8px] font-bold uppercase tracking-[.15em] text-[#6B2447] sm:left-4 sm:top-4 sm:px-3 sm:py-2 sm:text-[9px]">{badge}</span>
    : null;

  if (sliderMode) return <div
    className="group relative aspect-square overflow-hidden bg-[#eee5dc] sm:aspect-[.88]"
    data-testid="product-main-image"
    onTouchStart={(event) => { const touch = event.touches[0]; touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null; }}
    onTouchEnd={finishSwipe}
    onTouchCancel={() => { touchStart.current = null; }}
    onPointerDown={(event) => {
      if (event.pointerType !== 'mouse' || (event.target as HTMLElement).closest('button')) return;
      pointerStart.current = { x: event.clientX, y: event.clientY };
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerUp={(event) => {
      const start = pointerStart.current;
      pointerStart.current = null;
      if (!start) return;
      const dx = start.x - event.clientX;
      const dy = start.y - event.clientY;
      if (Math.abs(dx) >= 45 && Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : -1);
    }}
    onPointerCancel={() => { pointerStart.current = null; }}
    style={{ touchAction: 'pan-y' }}
  >
    <div className="flex h-full w-full transition-transform duration-300 ease-out" style={{ transform: `translateX(-${activeIndex * 100}%)` }} data-testid="product-gallery-slider">
      {images.map((image, imageIndex) => <div key={`${image}-${imageIndex}`} className="h-full min-w-full shrink-0">
        <ProductGalleryImage key={`${image}-${imageIndex}`} src={image} mobileSrc={imageIndex===0?mobileImage:undefined} fallbackSources={images.filter(candidate=>candidate!==image)} alt={`${productName} — image ${imageIndex + 1}`} shade={shade} loading="lazy" className="h-full w-full object-contain object-center p-3 mix-blend-multiply sm:p-4" />
      </div>)}
    </div>
    {badgeElement}
    <button type="button" onClick={() => move(-1)} disabled={images.length < 2} aria-label="Previous product image" className="absolute left-3 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-[#FDFBF7]/90 text-[#6B2447] shadow-sm transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50" data-testid="button-product-gallery-previous"><ChevronLeft size={20}/></button>
    <button type="button" onClick={() => move(1)} disabled={images.length < 2} aria-label="Next product image" className="absolute right-3 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-[#FDFBF7]/90 text-[#6B2447] shadow-sm transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50" data-testid="button-product-gallery-next"><ChevronRight size={20}/></button>
    <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/20 px-3 py-2 backdrop-blur-sm" role="group" aria-label="Product image navigation">
      {images.map((_, imageIndex) => <button key={imageIndex} type="button" onClick={() => onIndexChange(imageIndex)} aria-label={`Show product image ${imageIndex + 1}`} aria-current={activeIndex === imageIndex ? 'true' : undefined} className={`h-2 rounded-full transition-all ${activeIndex === imageIndex ? 'w-5 bg-white' : 'w-2 bg-white/65 hover:bg-white'}`} data-testid={`button-product-gallery-dot-${imageIndex}`} />)}
    </div>
  </div>;

  return <>
    <div className="relative aspect-square overflow-hidden bg-[#eee5dc] sm:aspect-[.88]" data-testid="product-main-image">
       <ProductGalleryImage key={images[activeIndex]} src={images[activeIndex]} mobileSrc={activeIndex===0?mobileImage:undefined} fallbackSources={images.filter(candidate=>candidate!==images[activeIndex])} alt={productName} shade={shade} fetchPriority="high" className="h-full w-full object-contain object-center p-3 mix-blend-multiply sm:p-4" />
      {badgeElement}
    </div>
    {images.length > 1 && <div className="mt-3 grid grid-cols-2 gap-3">
      {images.map((image, imageIndex) => imageIndex === activeIndex ? null : <button key={`${image}-${imageIndex}`} type="button" onClick={() => onIndexChange(imageIndex)} aria-label={`Show product image ${imageIndex + 1}`} aria-pressed={false} className="aspect-square overflow-hidden bg-[#eee5dc] transition-opacity hover:opacity-80" data-testid={`button-product-thumbnail-${imageIndex}`}>
         <ProductGalleryImage key={`${image}-${imageIndex}`} src={image} fallbackSources={images.filter(candidate=>candidate!==image)} alt="" shade={shade} loading="lazy" className="h-full w-full object-contain object-center p-2 mix-blend-multiply sm:p-3" />
      </button>)}
    </div>}
  </>;
}
