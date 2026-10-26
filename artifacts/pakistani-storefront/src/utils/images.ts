import { arrayRemove, arrayUnion, doc, runTransaction, serverTimestamp, setDoc } from '../lib/supabase/documents';
import { deleteObject, getDownloadURL, ref, uploadBytesResumable, defaultBucket, type StorageReference } from '../lib/supabase/storage';
import { db, getSupabaseStorage } from '../lib/supabase/index';

export type StoreAssetFolder = 'products' | 'banners' | 'widgets' | 'categories' | 'brand';
export const PRODUCT_DOCUMENT_SAFE_SIZE_BYTES = 900 * 1024;
const estimatedStorageDownloadUrl = `${import.meta.env.VITE_SUPABASE_URL || 'https://project.supabase.co'}/storage/v1/object/public/${import.meta.env.VITE_SUPABASE_STORAGE_BUCKET || 'store-assets'}/store/products/00000000-0000-0000-0000-000000000000.webp`;
const supportedImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const COMPRESSION_TIMEOUT_MS = 25_000;
const STORAGE_UPLOAD_TIMEOUT_MS = 5 * 60_000;
const DOWNLOAD_URL_TIMEOUT_MS = 60_000;

export function estimateSerializedProductSize(product: unknown, stagedImagePreviews: string[] = []): number {
  const stagedPreviews = new Set(stagedImagePreviews);
  const projectImageUrls = (value: unknown): unknown => {
    if (typeof value === 'string') return stagedPreviews.has(value) ? estimatedStorageDownloadUrl : value;
    if (Array.isArray(value)) return value.map(projectImageUrls);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, projectImageUrls(child)]));
    }
    return value;
  };
  return new TextEncoder().encode(JSON.stringify(projectImageUrls(product)) ?? 'null').byteLength;
}

export type ImageUploadProgress = {
  stage: 'compressing' | 'uploading';
  percent: number;
};

export type ImageUploadOptions = {
  onProgress?: (progress: ImageUploadProgress) => void;
  signal?: AbortSignal;
};

export class ImageCompressionUnavailableError extends Error {
  constructor(reason = '') {
    super(`Background image compression is unavailable.${reason ? ` ${reason}` : ''} You can retry with the original file.`);
    this.name = 'ImageCompressionUnavailableError';
  }
}

const brandImageTypes = [...supportedImageTypes, 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon'];
export type UploadedStoreAsset = { url:string; path:string; name:string; contentType:string; indexed?:boolean };

export function getStorageUploadError(error:unknown):Error{
  const detail=error instanceof Error?error.message:'Unknown Supabase Storage error';
  const code=typeof error==='object'&&error!==null&&'code' in error?String(error.code):'';
  const status=typeof error==='object'&&error!==null&&'statusCode' in error?String(error.statusCode):'';
  const guidance=status==='401'||status==='403'||/unauthorized|forbidden/i.test(detail)
    ?'Upload denied by Supabase Storage policies. Confirm this signed-in account is in the store administrator allowlist.'
    :status==='404'||/bucket.*not found/i.test(detail)
      ?`The Supabase Storage bucket "${defaultBucket}" was not found. Apply the provided Storage migration.`
      :status==='413'||/too large|payload/i.test(detail)
        ?'The image exceeds the configured Supabase Storage upload limit.'
        :/cancel/i.test(detail)
          ?'The Supabase Storage upload was cancelled.'
          :'Supabase Storage could not upload this file.';
  return new Error(`${guidance}${code?` (${code})`:''} ${detail}`);
}

async function indexUploadedAsset(asset:Omit<UploadedStoreAsset,'indexed'>):Promise<boolean>{
  if(!db)return false;
  let timeoutId=0;
  try{
    await Promise.race([
      setDoc(doc(db,'mediaAssets',asset.name),{...asset,uploadedAt:serverTimestamp()}),
      new Promise<never>((_,reject)=>{timeoutId=window.setTimeout(()=>reject(new Error('Media index write timed out.')),8_000);}),
    ]);
    return true;
  }catch(error){
    // Keep the Storage URL usable even if its searchable Supabase index is unavailable.
    console.warn('[media-upload] Supabase media indexing failed; the Storage URL remains available.',error);
    return false;
  }finally{
    window.clearTimeout(timeoutId);
  }
}

function assetExtension(type:string,fileName:string){
  const known:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','image/svg+xml':'svg','image/x-icon':'ico','image/vnd.microsoft.icon':'ico'};
  const extension=known[type];
  if(extension)return extension;
  const original=fileName.split('.').pop()?.toLowerCase();
  return original&&/^[a-z0-9]{1,8}$/.test(original)?original:'img';
}

function announceUploaded(asset:UploadedStoreAsset){
  if(typeof window==='undefined')return;
  window.dispatchEvent(new CustomEvent<UploadedStoreAsset>('nura:media-uploaded',{detail:asset}));
  if(typeof BroadcastChannel!=='undefined'){
    const channel=new BroadcastChannel('nura-media-assets');
    channel.postMessage(asset);
    channel.close();
  }
}

export async function compressImage(file: File, options: ImageUploadOptions = {}): Promise<Blob> {
  if (!supportedImageTypes.includes(file.type)) throw new Error('Choose a JPEG, PNG, WebP or GIF image.');
  if (file.size > 12 * 1024 * 1024) throw new Error('The original image must be smaller than 12 MB.');
  throwIfAborted(options.signal);
  if (file.type === 'image/gif') {
    const { default: gifsicle } = await import('gifsicle-wasm-browser');
    throwIfAborted(options.signal);
    options.onProgress?.({ stage: 'compressing', percent: 5 });
    const [optimized] = await waitForTimeout(
      waitForAbort(gifsicle.run({
        input: [{ file, name: 'upload.gif' }],
        command: ['-O2 --lossy=10 upload.gif -o /out/optimized.gif'],
      }), options.signal),
      COMPRESSION_TIMEOUT_MS,
      'GIF optimization timed out.',
    );
    throwIfAborted(options.signal);
    if (!optimized) throw new Error('GIF optimization did not produce an image.');
    options.onProgress?.({ stage: 'compressing', percent: 100 });
    return optimized.size < file.size ? optimized : file;
  }
  const compressed = await compressRasterImage(file, options);
  return compressed.size < file.size ? compressed : file;
}

export async function uploadStoreAsset(
  file: File,
  folder: StoreAssetFolder,
  autoCompress = true,
  options: ImageUploadOptions = {},
): Promise<UploadedStoreAsset> {
  const storage = await getSupabaseStorage();
  if (!storage) throw new Error('Supabase Storage is not configured. Check VITE_SUPABASE_URL and the Storage bucket configuration.');
  if(!file||typeof file.arrayBuffer!=='function')throw new Error('No image file is attached to this upload. Select the image again and retry.');
  const allowedTypes = folder === 'brand' ? brandImageTypes : supportedImageTypes;
  const sizeLimit = folder === 'widgets' || folder === 'brand' ? 5 * 1024 * 1024 : 12 * 1024 * 1024;
  if (!allowedTypes.includes(file.type)) {
    throw new Error(folder === 'brand'
      ? 'Choose a JPEG, PNG, WebP, GIF, SVG or ICO image.'
      : 'Choose a JPEG, PNG, WebP or GIF image.');
  }
  if (file.size > sizeLimit) throw new Error(`Choose a file smaller than ${sizeLimit / (1024 * 1024)} MB.`);
  throwIfAborted(options.signal);
  const canCompress = supportedImageTypes.includes(file.type);
  let upload: Blob = file;
  if (autoCompress && canCompress) {
    try {
      upload = await waitForTimeout(
        compressImage(file, options),
        COMPRESSION_TIMEOUT_MS,
        new ImageCompressionUnavailableError('Image optimization timed out.'),
      );
    } catch (error) {
      throwIfAborted(options.signal);
      if (error instanceof ImageCompressionUnavailableError) throw error;
      console.warn('[media-upload] Image optimization failed; uploading the original file instead.', error);
      options.onProgress?.({ stage: 'uploading', percent: 0 });
    }
  }
  throwIfAborted(options.signal);
  const contentType = upload.type || file.type;
  const name = `${crypto.randomUUID()}.${assetExtension(contentType, file.name)}`;
  let target:StorageReference;
  let task:ReturnType<typeof uploadBytesResumable>;
  try{
    // Upload to the configured public Supabase media bucket.
    target=ref(storage,`store/${folder}/${name}`);
    task=uploadBytesResumable(target,upload,{contentType,cacheControl:'public,max-age=31536000,immutable'});
  }catch(error){
    const actionable=getStorageUploadError(error);
    console.error('[media-upload] Could not initialize the Supabase Storage upload.',error);
    throw actionable;
  }
  options.onProgress?.({ stage: 'uploading', percent: 0 });

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      if (timeoutId) clearTimeout(timeoutId);
      removeAbortListener();
      callback();
    };
    const removeAbortListener = () => options.signal?.removeEventListener('abort', abort);
    const abort = () => task.cancel();
    const timeoutId = setTimeout(() => {
      task.cancel();
      finish(() => reject(new Error('Upload timed out. Check your connection and try again.')));
    }, STORAGE_UPLOAD_TIMEOUT_MS);
    options.signal?.addEventListener('abort', abort, { once: true });
    if (options.signal?.aborted) task.cancel();
    task.on('state_changed', snapshot => {
      const percent = snapshot.totalBytes === 0 ? 0 : Math.round(snapshot.bytesTransferred / snapshot.totalBytes * 100);
      options.onProgress?.({ stage: 'uploading', percent });
    }, failure => {
      const actionable=getStorageUploadError(failure);
      console.error('[media-upload] Supabase Storage task failed.',failure);
      finish(() => reject(actionable));
    }, () => {
      finish(resolve);
    });
  });
  let url:string;
  try{
    url=await waitForTimeout(
      getDownloadURL(target),
      DOWNLOAD_URL_TIMEOUT_MS,
      'The file uploaded, but Supabase did not return its public URL in time. Please try again.',
    );
  }catch(error){
    const actionable=getStorageUploadError(error);
    console.error('[media-upload] Supabase Storage could not return the uploaded file URL.',error);
    throw actionable;
  }
  const assetBase = { url, path: target.fullPath, name, contentType };
  const asset: UploadedStoreAsset = { ...assetBase };
  announceUploaded(asset);
  void indexUploadedAsset(assetBase).then(indexed => {
    asset.indexed = indexed;
  });
  return asset;
}

export async function deleteWidgetImage(url: string): Promise<boolean> {
  const storage = await getSupabaseStorage();
  if (!storage) return false;
  let target: StorageReference;
  try {
    target = ref(storage, url);
  } catch {
    return false;
  }
  if (target.bucket !== defaultBucket || !target.fullPath.startsWith('store/widgets/')) return false;
  try {
    await deleteObject(target);
    return true;
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error && String(error.statusCode) === '404') {
      return true;
    }
    throw error;
  }
}

type WidgetImageCleanupResult = 'deleted' | 'referenced' | 'deferred';
type WidgetImageCleanupStage = 'pending' | 'deleting' | 'deleted' | 'referenced' | 'unavailable';

function widgetImageIsReferenced(data: Record<string, unknown>, url: string) {
  const content = data.content as { floatingWidgets?: { widgets?: Array<{ customImageUrl?: unknown }> } } | undefined;
  return (content?.floatingWidgets?.widgets || []).some(widget => widget.customImageUrl === url);
}

async function stageWidgetImageCleanup(url: string): Promise<WidgetImageCleanupStage> {
  if (!db) return 'unavailable';
  return runTransaction(db, async transaction => {
    const globalRef = doc(db!, 'storeContent', 'global');
    const snapshot = await transaction.get(globalRef);
    if (!snapshot.exists()) return 'unavailable';
    const data = snapshot.data();
    if (widgetImageIsReferenced(data, url)) return 'referenced';
    const pending = Array.isArray(data.widgetImageCleanupPending) ? data.widgetImageCleanupPending : [];
    const deleting = Array.isArray(data.widgetImageCleanupDeleting) ? data.widgetImageCleanupDeleting : [];
    const deleted = Array.isArray(data.widgetImageCleanupDeleted) ? data.widgetImageCleanupDeleted : [];
    if (deleted.includes(url)) return 'deleted';
    if (deleting.includes(url)) return 'deleting';
    if (!pending.includes(url)) {
      transaction.set(globalRef, { widgetImageCleanupPending: arrayUnion(url) }, { merge: true });
    }
    return 'pending';
  });
}

async function claimWidgetImageCleanup(url: string): Promise<'claimed' | 'referenced' | 'cancelled'> {
  if (!db) return 'cancelled';
  return runTransaction(db, async transaction => {
    const globalRef = doc(db!, 'storeContent', 'global');
    const snapshot = await transaction.get(globalRef);
    if (!snapshot.exists()) return 'cancelled';
    const data = snapshot.data();
    const pending = Array.isArray(data.widgetImageCleanupPending) ? data.widgetImageCleanupPending : [];
    if (!pending.includes(url)) return 'cancelled';
    if (widgetImageIsReferenced(data, url)) {
      transaction.set(globalRef, { widgetImageCleanupPending: arrayRemove(url) }, { merge: true });
      return 'referenced';
    }
    transaction.set(globalRef, {
      widgetImageCleanupPending: arrayRemove(url),
      widgetImageCleanupDeleting: arrayUnion(url),
    }, { merge: true });
    return 'claimed';
  });
}

async function finishWidgetImageCleanup(url: string, deleted: boolean) {
  if (!db) return;
  await runTransaction(db, async transaction => {
    const globalRef = doc(db!, 'storeContent', 'global');
    const snapshot = await transaction.get(globalRef);
    if (snapshot.exists()) {
      transaction.set(globalRef, {
        widgetImageCleanupDeleting: arrayRemove(url),
        ...(deleted ? { widgetImageCleanupDeleted: arrayUnion(url) } : {}),
      }, { merge: true });
    }
  });
}

export async function cleanupUnusedWidgetImage(url: string): Promise<WidgetImageCleanupResult> {
  const stage = await stageWidgetImageCleanup(url);
  if (stage === 'referenced') return 'referenced';
  if (stage === 'deleted') return 'deleted';
  if (stage !== 'pending') return 'deferred';

  // Give another admin's already-open editor a chance to cancel cleanup in its save transaction.
  await new Promise(resolve => setTimeout(resolve, 800));
  const claim = await claimWidgetImageCleanup(url);
  if (claim === 'referenced') return 'referenced';
  if (claim !== 'claimed') return 'deferred';

  const deleted = await deleteWidgetImage(url);
  await finishWidgetImageCleanup(url, deleted);
  return deleted ? 'deleted' : 'deferred';
}

export async function uploadStoreImage(
  file: File,
  folder: 'products' | 'banners',
  autoCompress = true,
  options: ImageUploadOptions = {},
): Promise<string> {
  return (await uploadStoreAsset(file, folder, autoCompress, options)).url;
}

export async function uploadFloatingWidgetImage(
  file: File,
  autoCompress = true,
  options: ImageUploadOptions = {},
): Promise<string> {
  return (await uploadStoreAsset(file, 'widgets', autoCompress, options)).url;
}

function compressRasterImage(file: File, options: ImageUploadOptions): Promise<Blob> {
  throwIfAborted(options.signal);
  if (typeof Worker === 'undefined') {
    return Promise.reject(new ImageCompressionUnavailableError('This browser does not support image compression in a background worker.'));
  }

  return new Promise((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL('./image-compression.worker.ts', import.meta.url), { type: 'module' });
    } catch (error) {
      reject(new ImageCompressionUnavailableError(error instanceof Error ? error.message : 'The background worker could not start.'));
      return;
    }
    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout>;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      options.signal?.removeEventListener('abort', abort);
      worker.terminate();
      callback();
    };
    const abort = () => finish(() => reject(new DOMException('Upload cancelled.', 'AbortError')));
    options.signal?.addEventListener('abort', abort, { once: true });
    timeoutId = setTimeout(() => finish(() => reject(new ImageCompressionUnavailableError('Image optimization timed out.'))), COMPRESSION_TIMEOUT_MS);
    if (options.signal?.aborted) {
      abort();
      return;
    }
    worker.onmessage = (event: MessageEvent<{ type: 'progress'; percent: number } | { type: 'result'; blob: Blob } | { type: 'error'; message: string }>) => {
      const message = event.data;
      if (message.type === 'progress') {
        options.onProgress?.({ stage: 'compressing', percent: message.percent });
      } else if (message.type === 'result') {
        finish(() => resolve(message.blob));
      } else {
        finish(() => reject(new ImageCompressionUnavailableError(message.message)));
      }
    };
    worker.onerror = () => finish(() => reject(new ImageCompressionUnavailableError('The background image worker could not process this file.')));
    options.onProgress?.({ stage: 'compressing', percent: 0 });
    worker.postMessage({ file });
  });
}

function waitForAbort<T>(operation: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return operation;
  if (signal.aborted) return Promise.reject(new DOMException('Upload cancelled.', 'AbortError'));
  return new Promise((resolve, reject) => {
    const abort = () => {
      signal.removeEventListener('abort', abort);
      reject(new DOMException('Upload cancelled.', 'AbortError'));
    };
    signal.addEventListener('abort', abort, { once: true });
    operation.then(value => {
      signal.removeEventListener('abort', abort);
      resolve(value);
    }, error => {
      signal.removeEventListener('abort', abort);
      reject(error);
    });
  });
}

function waitForTimeout<T>(operation: Promise<T>, timeoutMs: number, message: string | Error): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(message instanceof Error ? message : new Error(message)), timeoutMs);
    operation.then(value => {
      clearTimeout(timeoutId);
      resolve(value);
    }, error => {
      clearTimeout(timeoutId);
      reject(error);
    });
  });
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('Upload cancelled.', 'AbortError');
}
