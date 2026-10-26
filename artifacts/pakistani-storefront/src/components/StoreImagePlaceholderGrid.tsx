import StoreImage from './StoreImage';
import type { StoreImagePlaceholderShape } from './StoreImage';

type StoreImagePlaceholderGridProps = {
  itemType: 'category' | 'product';
  shape?: StoreImagePlaceholderShape;
  dimensions: string;
  count?: number;
  hint?: string;
  testId: string;
};

export default function StoreImagePlaceholderGrid({
  itemType,
  shape = itemType === 'category' ? 'portrait' : 'box',
  dimensions,
  count = 4,
  hint,
  testId,
}: StoreImagePlaceholderGridProps) {
  const label = itemType === 'category' ? 'Category' : 'Product';
  const description = hint ?? (itemType === 'category'
    ? 'Add a category and upload its image in the admin panel.'
    : 'Add a product and upload its image in the admin panel.');
  const aspectClass = shape === 'circle'
    ? 'aspect-square'
    : shape === 'landscape'
      ? 'aspect-[4/3]'
      : shape === 'portrait'
        ? 'aspect-[4/5]'
        : 'aspect-square';

  return <div
    className="nura-empty-image-grid grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-5"
    role="group"
    aria-label={`Example ${itemType} image placeholders`}
    data-testid={testId}
    data-placeholder-shape={shape}
  >
    {Array.from({ length: Math.max(1, count) }, (_, index) => <article className="min-w-0" key={`${itemType}-${index}`}>
      <div className={`relative mb-3 overflow-hidden ${aspectClass} ${shape === 'circle' ? 'mx-auto w-full max-w-[220px] rounded-full' : 'w-full rounded-xl'}`}>
        <StoreImage
          src={null}
          alt=""
          aria-hidden="true"
          placeholderShape={shape}
          placeholderTitle={`${label} image`}
          placeholderHint={description}
          placeholderDimensions={dimensions}
          pictureClassName="block h-full w-full"
          className="h-full w-full"
          data-testid={`img-placeholder-${itemType}-${index + 1}`}
        />
      </div>
      <h3 className="nura-heading-small text-center text-[12px] font-semibold sm:text-[13px]">{label} {index + 1}</h3>
      <p className="mt-1 text-center text-[10px] leading-5 text-[#80756b]">Example {itemType.toLowerCase()} description</p>
    </article>)}
  </div>;
}
