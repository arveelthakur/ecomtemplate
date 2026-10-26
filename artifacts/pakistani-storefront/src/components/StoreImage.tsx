import { useState, type ComponentPropsWithoutRef, type CSSProperties } from 'react';
import { ImagePlus } from '../lib/lucide-icons';
import { defaultBucket } from '../lib/supabase/storage';
import { resolveResponsiveStoreImageSources } from '../utils/storeImages';

type StoreImageProps = Omit<ComponentPropsWithoutRef<'img'>, 'src' | 'srcSet' | 'onError' | 'data-testid'> & {
  src?: string | null;
  mobileSrc?: string | null;
  fallbackSources?: readonly (string | null | undefined)[];
  pictureClassName?: string;
  pictureStyle?: CSSProperties;
  onAllSourcesError?: () => void;
  placeholderTitle?: string;
  placeholderHint?: string;
  placeholderDimensions?: string;
  'data-testid'?: string;
};

export default function StoreImage({
  src,
  mobileSrc,
  fallbackSources = [],
  pictureClassName,
  pictureStyle,
  onAllSourcesError,
  placeholderTitle = 'Image coming soon',
  placeholderHint = 'Add an image in the store admin to complete this section.',
  placeholderDimensions = 'Recommended: 1000 × 1000 px',
  ...imageProps
}: StoreImageProps) {
  const [failedState, setFailedState] = useState<{ key: string; sources: string[] }>({ key: '', sources: [] });
  const sourceKey = JSON.stringify([src ?? '', mobileSrc ?? '', fallbackSources]);
  const failedSources = failedState.key === sourceKey ? failedState.sources : [];
  const sources = resolveResponsiveStoreImageSources(
    src,
    mobileSrc,
    fallbackSources,
    failedSources,
    import.meta.env.VITE_SUPABASE_URL ?? '',
    defaultBucket,
  );
  const {
    alt = '',
    className = '',
    style,
    role,
    'aria-label': ariaLabel,
    'aria-hidden': ariaHidden,
    'data-testid': testId,
    ...imgProps
  } = imageProps;

  if (!sources.desktop && !sources.mobile) return <div className={pictureClassName ?? 'contents'} style={pictureStyle}>
    <div
      className={`store-image-placeholder ${className}`}
      style={style}
      role={ariaHidden ? 'presentation' : role || 'img'}
      aria-label={ariaHidden ? undefined : ariaLabel || (alt ? `${alt} image placeholder` : 'Store image placeholder')}
      aria-hidden={ariaHidden}
      data-testid={testId}
    >
      <span className="store-image-placeholder-icon" aria-hidden="true"><ImagePlus size={23} strokeWidth={1.45}/></span>
      <strong className="store-image-placeholder-title">{placeholderTitle}</strong>
      <span className="store-image-placeholder-hint">{placeholderHint}</span>
      <small className="store-image-placeholder-dimensions">{placeholderDimensions}</small>
    </div>
  </div>;

  return <picture className={pictureClassName ?? 'contents'} style={pictureStyle}>
    {sources.mobile && <source media="(max-width: 767px)" srcSet={sources.mobile} />}
    <img
      {...imgProps}
      alt={alt}
      className={className}
      style={style}
      src={sources.desktop || sources.mobile}
      onError={event => {
        const failed = event.currentTarget.currentSrc || event.currentTarget.src;
        const matchingSource = sources.fallbacks.find(source => source === failed || source === event.currentTarget.src);
        const nextFailed = matchingSource || sources.desktop || sources.mobile;
        const currentFailures = failedState.key === sourceKey ? failedState.sources : [];
        if (sources.fallbacks.every(source => source === nextFailed || currentFailures.includes(source))) onAllSourcesError?.();
        setFailedState(previous => {
          const current = previous.key === sourceKey ? previous.sources : [];
          return { key: sourceKey, sources: current.includes(nextFailed) ? current : [...current, nextFailed] };
        });
      }}
    />
  </picture>;
}
