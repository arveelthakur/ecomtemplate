import { useState } from 'react';
import { ImagePlus } from '../lib/lucide-icons';
import {
  ImageCompressionUnavailableError,
  uploadStoreAsset,
  type ImageUploadProgress,
  type StoreAssetFolder,
} from '../utils/images';
import { useAdminStore } from '../context/AdminContext';
import MediaAssetPicker from './MediaAssetPicker';

type UploadHandler = (
  file: File,
  folder: StoreAssetFolder,
  autoCompress: boolean,
  onProgress: (progress: ImageUploadProgress) => void,
  signal: AbortSignal,
) => Promise<string | { url: string; supabaseIndexed?: boolean }>;

type ImageUploadControlProps = {
  folder: StoreAssetFolder;
  onUploaded: (url: string) => void;
  actionLabel?: string;
  compact?: boolean;
  deferUpload?: boolean;
  onFileSelected?: (file: File) => void;
  disabled?: boolean;
  recommendation?: string;
  autoCompress: boolean;
  upload: UploadHandler;
};

export function ImageUploadControl({
  folder,
  onUploaded,
  actionLabel,
  compact = false,
  deferUpload = false,
  onFileSelected,
  disabled = false,
  recommendation,
  autoCompress,
  upload,
}: ImageUploadControlProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [uploadedUrl, setUploadedUrl] = useState('');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [progress, setProgress] = useState<ImageUploadProgress | null>(null);
  const [controller, setController] = useState<AbortController | null>(null);
  const [originalRetryFile, setOriginalRetryFile] = useState<File | null>(null);
  const accept = folder === 'brand'
    ? 'image/jpeg,image/png,image/webp,image/gif,image/svg+xml,image/x-icon,image/vnd.microsoft.icon'
    : 'image/jpeg,image/png,image/webp,image/gif';
  const imageRecommendation = recommendation || (folder === 'products'
    ? 'Recommended 1000 × 1000 px · square 1:1 · up to 2 MB'
    : folder === 'widgets'
      ? 'Recommended 256 × 256 px · square 1:1 · up to 5 MB'
      : folder === 'brand'
        ? 'Logo 1200 × 400 px · favicon 512 × 512 px · up to 5 MB'
        : folder === 'categories'
          ? 'Recommended 800 × 800 px · square 1:1'
          : 'Desktop 1920 × 800 px · mobile 800 × 1000 px');
  const isCancelled = (failure: unknown, signal: AbortSignal) =>
    signal.aborted || (failure instanceof Error && failure.name === 'AbortError');
  const startUpload = async (file: File, shouldCompress: boolean) => {
    const abortController = new AbortController();
    setController(abortController);
    setBusy(true);
    setError('');
    setNotice('');
    setProgress(shouldCompress ? { stage: 'compressing', percent: 0 } : { stage: 'uploading', percent: 0 });
    try {
      const result = await upload(file, folder, shouldCompress, setProgress, abortController.signal);
      const url = typeof result === 'string' ? result : result.url;
      setUploadedUrl(url);
      setOriginalRetryFile(null);
      if (typeof result !== 'string') {
        setNotice(result.supabaseIndexed
          ? 'Uploaded to Supabase Storage and indexed in the media library.'
          : result.supabaseIndexed === false
            ? 'Uploaded to Supabase Storage. Media library indexing was unavailable; the image URL is ready to use.'
            : 'Uploaded to Supabase Storage. Media Library indexing is continuing in the background.');
      }
      onUploaded(url);
    } catch (failure) {
      if (isCancelled(failure, abortController.signal)) {
        setNotice('Upload cancelled.');
      } else {
        console.error('[media-upload] Supabase Storage upload failed.', failure);
        const code = typeof failure === 'object' && failure !== null && 'code' in failure
          ? String(failure.code)
          : '';
        if (failure instanceof ImageCompressionUnavailableError) setOriginalRetryFile(file);
        setError(code === 'storage/unauthorized'
          ? 'Supabase Storage denied this upload. Confirm your admin access and storage policies, then try again.'
          : code === 'storage/quota-exceeded'
            ? 'Supabase Storage quota is exhausted. Try again after the quota resets.'
            : failure instanceof Error ? failure.message : 'Upload failed. Please try again.');
      }
    } finally {
      setBusy(false);
      setController(null);
      setProgress(null);
    }
  };

  return <div className={compact ? 'ad-upload-compact' : ''}>
    <label
      className={`ad-image-upload-dropzone${compact ? ' compact' : ''}${busy || disabled ? ' disabled' : ''}`}
      data-testid={`dropzone-image-${folder}`}
    >
      <span className="ad-image-upload-icon"><ImagePlus size={20} aria-hidden="true" /></span>
      <span className="ad-image-upload-copy">
        <strong>{actionLabel ?? 'Upload an image'}</strong>
        <span className="ad-image-upload-instructions">Choose a file from your device, or select an existing image from the media library below.</span>
        <span className="ad-image-upload-recommendation">{imageRecommendation}</span>
      </span>
      <input className="ad-image-upload-input" type="file" accept={accept} aria-label={actionLabel ?? 'Upload image'} disabled={busy||disabled} onChange={async event => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (deferUpload) {
          setError('');
          setUploadedUrl('');
          setOriginalRetryFile(null);
          setNotice('Image selected. It will upload when you save the product.');
          onFileSelected?.(file);
          event.target.value = '';
          return;
        }
        const canCompress = autoCompress && ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type);
        setError('');
        setOriginalRetryFile(null);
        event.target.value = '';
        await startUpload(file, canCompress);
      }} />
    </label>
    <div className="ad-upload-actions"><MediaAssetPicker disabled={disabled||busy} onSelect={url => { setUploadedUrl(url); onUploaded(url); setCopiedUrl(false); }}/></div>
    {uploadedUrl && <div className="ad-upload-url" data-testid="uploaded-media-url">
      <span title={uploadedUrl}>{uploadedUrl}</span>
      <button type="button" className="ad-btn small" onClick={async () => {
        try { await navigator.clipboard.writeText(uploadedUrl); setCopiedUrl(true); }
        catch { setError('Could not copy the URL. Select and copy it manually.'); }
      }} aria-label="Copy uploaded image URL">{copiedUrl ? 'Copied!' : 'Copy URL'}</button>
    </div>}
    <p className="sr-only" data-testid={`text-image-recommendation-${folder}`}>{imageRecommendation}</p>
    {busy && <div className="ad-help" role="status">
      <p>{progress?.stage === 'compressing' ? `Optimizing image${progress.percent > 0 ? `: ${progress.percent}%` : '…'}` : `Uploading${progress?.percent ? `: ${progress.percent}%` : '…'}`}</p>
      {progress && <progress aria-label={progress.stage === 'compressing' ? 'Image optimization progress' : 'Image upload progress'} max={100} value={progress.percent} />}
      <button type="button" className="ad-btn small" onClick={() => controller?.abort()}>Cancel upload</button>
    </div>}
    {originalRetryFile && !busy && <button
      type="button"
      className="ad-btn small"
      onClick={() => void startUpload(originalRetryFile, false)}
      data-testid="button-retry-original-image"
    >Retry with original file</button>}
    {notice && <p role="status" className="ad-help">{notice}</p>}
    {error && <p role="alert" className="ad-error">{error}</p>}
  </div>;
}

export default function ImageUpload({
  folder,
  onUploaded,
  actionLabel,
  compact = false,
  deferUpload = false,
  onFileSelected,
  disabled = false,
  recommendation,
}: {
  folder: StoreAssetFolder;
  onUploaded: (url: string) => void;
  actionLabel?: string;
  compact?: boolean;
  deferUpload?: boolean;
  onFileSelected?: (file: File) => void;
  disabled?: boolean;
  recommendation?: string;
}) {
  const { data } = useAdminStore();
  const autoCompress = data.settings.general.autoCompressUploads !== false;
  return <ImageUploadControl
    folder={folder}
    onUploaded={onUploaded}
    actionLabel={actionLabel}
    compact={compact}
    deferUpload={deferUpload}
    onFileSelected={onFileSelected}
    disabled={disabled}
    recommendation={recommendation}
    autoCompress={autoCompress}
    upload={(file, targetFolder, shouldCompress, onProgress, signal) =>
      uploadStoreAsset(file, targetFolder, shouldCompress, { onProgress, signal })
    }
  />;
}
