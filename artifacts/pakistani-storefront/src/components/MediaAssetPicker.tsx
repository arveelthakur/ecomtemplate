import { useEffect, useRef, useState } from 'react';
import { getDownloadURL, list, ref } from '../lib/supabase/storage';
import { getSupabaseStorage } from '../lib/supabase/index';
import type { UploadedStoreAsset } from '../utils/images';
import type { StoreAssetFolder } from '../utils/images';

type MediaAsset = { name: string; path: string; url: string };
const folders: StoreAssetFolder[] = ['products', 'banners', 'widgets', 'categories', 'brand'];
const PAGE_SIZE = 40;
const URL_WORKERS = 5;
const REQUEST_TIMEOUT_MS = 15_000;

async function withStorageTimeout<T>(request: Promise<T>, label: string): Promise<T> {
  let timeoutId = 0;
  try {
    return await Promise.race([
      request,
      new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(
          () => reject(new Error(`${label} timed out. You can retry or continue with the upload control.`)),
          REQUEST_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export default function MediaAssetPicker({ onSelect, disabled = false }: { onSelect: (url: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [tokens, setTokens] = useState<Partial<Record<StoreAssetFolder, string>>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [loaded, setLoaded] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    const receiveUploadedAsset = (asset: UploadedStoreAsset) => {
      setAssets(current => {
        const unique = new Map(current.map(item => [item.url, item]));
        unique.set(asset.url, { name: asset.name, path: asset.path, url: asset.url });
        return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name));
      });
    };
    const onUploaded = (event: Event) => receiveUploadedAsset((event as CustomEvent<UploadedStoreAsset>).detail);
    window.addEventListener('nura:media-uploaded', onUploaded);
    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('nura-media-assets') : null;
    if (channel) channel.onmessage = event => receiveUploadedAsset(event.data as UploadedStoreAsset);
    return () => {
      window.removeEventListener('nura:media-uploaded', onUploaded);
      channel?.close();
      requestId.current++;
    };
  }, []);

  const loadPages = async (initial = false) => {
    if (loading) return;
    const storage = await getSupabaseStorage();
    if (!storage) {
      setError('Supabase Storage is not configured.');
      setLoaded(true);
      return;
    }
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError('');
    const nextTokens = initial ? {} : { ...tokens };
    const pageErrors: string[] = [];
    if (initial) setAssets([]);
    let activeUrlRequests = 0;
    const urlRequestWaiters: Array<() => void> = [];
    const withUrlSlot = async <T,>(request: () => Promise<T>): Promise<T> => {
      if (activeUrlRequests >= URL_WORKERS) {
        await new Promise<void>(resolve => urlRequestWaiters.push(resolve));
      } else {
        activeUrlRequests++;
      }
      try {
        return await request();
      } finally {
        const next = urlRequestWaiters.shift();
        if (next) next();
        else activeUrlRequests--;
      }
    };
    const addAsset = (asset: MediaAsset) => {
      if (currentRequest !== requestId.current) return;
      setAssets(current => {
        const unique = new Map(current.map(item => [item.url, item]));
        unique.set(asset.url, asset);
        return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name));
      });
    };

    try {
      await Promise.all(folders.map(async folder => {
        try {
          const page = await withStorageTimeout(list(ref(storage!, `store/${folder}`), {
            maxResults: PAGE_SIZE,
            ...(nextTokens[folder] ? { pageToken: nextTokens[folder] } : {}),
          }), `Listing store/${folder}`);
          if (page.nextPageToken) nextTokens[folder] = page.nextPageToken;
          else delete nextTokens[folder];
          if (currentRequest !== requestId.current) return;
          await Promise.all(page.items.map(item => withUrlSlot(async () => {
            try {
              const url = await withStorageTimeout(getDownloadURL(item), `Opening ${item.name}`);
              addAsset({ name: item.name, path: item.fullPath, url });
            } catch (failure) {
              if (currentRequest === requestId.current) {
                pageErrors.push(`${item.name}: ${failure instanceof Error ? failure.message : 'download URL unavailable'}`);
              }
            }
          })));
        } catch (failure) {
          if (currentRequest === requestId.current) {
            pageErrors.push(`${folder}: ${failure instanceof Error ? failure.message : 'could not load'}`);
          }
        }
      }));
      if (currentRequest !== requestId.current) return;
      setTokens(nextTokens);
      setLoaded(true);
      if (pageErrors.length) {
        const shown = pageErrors.slice(0, 5).join('; ');
        const extra = pageErrors.length > 5 ? `; and ${pageErrors.length - 5} more` : '';
        setError(`Some media could not be opened (${shown}${extra}). Files from available folders are still shown.`);
      }
    } catch (failure) {
      if (currentRequest === requestId.current) {
        setLoaded(true);
        setError(failure instanceof Error ? failure.message : 'Media listing failed. You can retry or continue with the upload control.');
      }
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  };

  const showPicker = () => {
    setOpen(true);
    if (!loaded) void loadPages(true);
  };
  const filtered = assets.filter(asset => `${asset.name} ${asset.path}`.toLowerCase().includes(query.toLowerCase()));

  return <>
    <button className="ad-btn small" type="button" onClick={showPicker} disabled={disabled} data-testid="button-choose-media">Choose from Media Library</button>
    {open && <div className="ad-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="ad-modal ad-media-picker" role="dialog" aria-modal="true" aria-labelledby="media-picker-title">
        <header className="ad-modal-head"><div><h2 className="ad-card-title" id="media-picker-title">Choose an image</h2><p className="ad-card-note">Select an uploaded Supabase Storage asset to use its URL.</p></div><button className="ad-btn small" type="button" onClick={() => setOpen(false)}>Close</button></header>
        <div className="ad-modal-body">
          <input className="ad-input" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search uploaded media" aria-label="Search uploaded media"/>
          {error && <p className="ad-error" role="alert">{error}</p>}
          {error && !loading && <button className="ad-btn small" type="button" onClick={() => void loadPages(true)}>Retry media listing</button>}
          {loading && !assets.length && <p className="ad-help" role="status">Loading uploaded media…</p>}
          {!loading && !assets.length && <p className="ad-help">No uploaded images found yet.</p>}
          <div className="ad-media-picker-grid">{filtered.map(asset => <button className="ad-media-picker-item" type="button" key={asset.url} onClick={() => { onSelect(asset.url); setOpen(false); }} title={`Use ${asset.name}`} data-testid="button-select-media">
            <img src={asset.url} alt="" loading="lazy"/><span>{asset.name}</span>
          </button>)}</div>
          {loading && assets.length > 0 && <p className="ad-help" role="status">Loading more images…</p>}
          {!loading && Object.keys(tokens).length > 0 && <button className="ad-btn" type="button" onClick={() => void loadPages()} data-testid="button-load-more-media">Load more images</button>}
        </div>
      </section>
    </div>}
  </>;
}
