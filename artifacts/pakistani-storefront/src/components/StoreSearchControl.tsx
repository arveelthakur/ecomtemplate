import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Clock3, Search, Trash2, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { formatPKR } from '../utils/store';
import { productRoute } from '../utils/seo';
import { useStore } from '../context/StoreContext';
import { isProductCustomerVisible } from '../utils/store';
import { useBodyScrollLock } from '../hooks/use-body-scroll-lock';

const searchHistoryKey = 'nura-store-search-history';
const maximumSearchHistoryItems = 8;

function readSearchHistory(): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(searchHistoryKey) || '[]');
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean))].slice(0, maximumSearchHistoryItems);
  } catch {
    return [];
  }
}

export default function StoreSearchControl() {
  const [open, setOpen] = useState(false);
  useBodyScrollLock(open);
  const [query, setQuery] = useState('');
  const [visibleViewport, setVisibleViewport] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const wasOpenRef = useRef(false);
  const { products } = useStore();
  const navigate = useNavigate();
  const [searchHistory, setSearchHistory] = useState<string[]>(readSearchHistory);
  const normalizedQuery = query.trim().toLowerCase();
  const allResults = normalizedQuery
    ? products.filter((product) => isProductCustomerVisible(product)&&`${product.name} ${product.category} ${product.brand || ''}`.toLowerCase().includes(normalizedQuery))
    : [];
  const results = allResults.slice(0, 6);

  useEffect(() => {
    if (!open) return;
    const viewport = window.visualViewport;
    const updateVisibleViewport = () => {
      if (!viewport) return;
      setVisibleViewport({
        top: viewport.offsetTop,
        left: viewport.offsetLeft,
        width: viewport.width,
        height: viewport.height,
      });
    };
    updateVisibleViewport();
    viewport?.addEventListener('resize', updateVisibleViewport);
    viewport?.addEventListener('scroll', updateVisibleViewport);
    window.addEventListener('resize', updateVisibleViewport);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        setQuery('');
        setVisibleViewport(null);
        return;
      }
      if (event.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
      )).filter(element => element.getClientRects().length > 0 && element.getAttribute('aria-hidden') !== 'true');
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement;

      if (!first || !last) {
        event.preventDefault();
        dialog.focus();
      } else if (event.shiftKey && (activeElement === first || !dialog.contains(activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (activeElement === last || !dialog.contains(activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    const handleFocusIn = (event: FocusEvent) => {
      const dialog = dialogRef.current;
      if (!dialog || dialog.contains(event.target as Node)) return;
      const firstFocusable = dialog.querySelector<HTMLElement>(
        'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
      );
      firstFocusable?.focus();
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('focusin', handleFocusIn);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('focusin', handleFocusIn);
      viewport?.removeEventListener('resize', updateVisibleViewport);
      viewport?.removeEventListener('scroll', updateVisibleViewport);
      window.removeEventListener('resize', updateVisibleViewport);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
    } else if (wasOpenRef.current) {
      wasOpenRef.current = false;
      triggerRef.current?.focus();
    }
  }, [open]);

  const closeSearch = () => {
    setOpen(false);
    setQuery('');
    setVisibleViewport(null);
  };
  const rememberSearch = (value: string) => {
    const term = value.trim();
    if (!term) return;
    const next = [term, ...searchHistory.filter(item => item.toLocaleLowerCase() !== term.toLocaleLowerCase())].slice(0, maximumSearchHistoryItems);
    setSearchHistory(next);
    try {
      window.localStorage.setItem(searchHistoryKey, JSON.stringify(next));
    } catch {
      // Search remains usable when browser storage is disabled or full.
    }
  };
  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const term = query.trim();
    if (!term) return;
    rememberSearch(term);
    closeSearch();
    navigate(`/shop?q=${encodeURIComponent(term)}`);
  };
  const clearSearchHistory = () => {
    setSearchHistory([]);
    try {
      window.localStorage.removeItem(searchHistoryKey);
    } catch {
      // Keep the in-memory history cleared if storage is unavailable.
    }
  };

  return <div className="grid h-9 w-9 shrink-0 place-items-center">
    <button
      ref={triggerRef}
      type="button"
      aria-label="Search products"
      aria-expanded={open}
      aria-controls="store-search-popover"
      onClick={() => open ? closeSearch() : setOpen(true)}
      className="grid h-9 w-9 place-items-center rounded-full text-[#5d514c] transition-colors hover:bg-[#f2ede5] hover:text-[#6B2447]"
      data-testid="button-open-search"
    >
      <Search size={18} strokeWidth={1.7} />
    </button>
    {open && typeof document !== 'undefined' && createPortal(<div className="fixed inset-0 z-[10000] flex h-[100dvh] max-h-[100dvh] items-center justify-center overflow-y-auto bg-[#21191b]/35 p-3 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm" style={visibleViewport ? { top: visibleViewport.top, left: visibleViewport.left, right: 'auto', bottom: 'auto', width: visibleViewport.width, height: visibleViewport.height, maxHeight: visibleViewport.height } : undefined} role="presentation" onClick={event=>{if(event.target===event.currentTarget)closeSearch();}}>
       <section ref={dialogRef} id="store-search-popover" role="dialog" aria-modal="true" aria-label="Search products" tabIndex={-1} className="max-h-full w-full max-w-xl overflow-y-auto rounded-xl border border-[#e9e2d8] bg-[#fffefa] p-4 text-[#352b2b] shadow-2xl sm:p-5">
      <form onSubmit={submitSearch} className="flex items-center gap-2 border-b border-[#d8cec2] pb-2">
        <Search size={17} className="shrink-0 text-[#8b7c70]" />
        <label className="sr-only" htmlFor="store-search-query">Search products and categories</label>
        <input
          id="store-search-query"
          type="search"
          autoFocus
          placeholder="Search something lovely..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#a79b8e]"
          data-testid="input-search"
        />
        <button type="submit" aria-label="Show search results" className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[#6B2447] hover:bg-[#f2ede5]" data-testid="button-submit-search"><ArrowRight size={15}/></button>
        <button type="button" onClick={closeSearch} aria-label="Close search" className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[#81766c] hover:bg-[#f2ede5]" data-testid="button-close-search"><X size={16} /></button>
      </form>
      {normalizedQuery
        ? <div className="max-h-[min(50vh,360px)] overflow-y-auto pt-2" style={visibleViewport ? { maxHeight: Math.max(96, Math.min(visibleViewport.height * 0.5, 360)) } : undefined} aria-live="polite" data-testid="list-search-results">
          {searchHistory.length > 0 && <div className="mb-2 flex items-center justify-between gap-2 border-b border-[#eee8df] pb-2">
            <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-[#83796f]">Recent searches</span>
            <button type="button" onClick={clearSearchHistory} className="inline-flex items-center gap-1 text-[10px] text-[#6B2447] underline underline-offset-2" data-testid="button-clear-search-history"><Trash2 size={11}/>Clear History</button>
          </div>}
          {results.length
            ? <>{results.map((product) => <Link key={product.id} to={productRoute(product,products)} onClick={() => { rememberSearch(query); closeSearch(); }} className="flex items-center justify-between gap-3 border-b border-[#eee8df] py-3 text-xs last:border-b-0 hover:text-[#6B2447]" data-testid={`link-search-result-${product.id}`}><span>{product.name}</span><span className="shrink-0 font-medium">{formatPKR(product.price)}</span></Link>)}<Link to={`/shop?q=${encodeURIComponent(query.trim())}`} onClick={() => { rememberSearch(query); closeSearch(); }} className="flex items-center justify-between gap-3 pt-3 text-[11px] font-semibold text-[#6B2447]" data-testid="link-search-view-all">View all {allResults.length} matching product{allResults.length === 1 ? '' : 's'} <ArrowRight size={13} /></Link></>
            : <p className="py-4 text-xs text-[#74685d]">Nothing found just yet. Try a product name or category.</p>}
        </div>
        : searchHistory.length
          ? <div className="pt-3" data-testid="list-search-history">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-[#83796f]">Recent searches</span>
              <button type="button" onClick={clearSearchHistory} className="inline-flex items-center gap-1 text-[10px] text-[#6B2447] underline underline-offset-2" data-testid="button-clear-search-history"><Trash2 size={11}/>Clear History</button>
            </div>
            {searchHistory.map(term => <button type="button" key={term} onClick={() => setQuery(term)} className="flex w-full items-center gap-2 border-b border-[#eee8df] py-2.5 text-left text-xs text-[#514742] hover:text-[#6B2447]" data-testid={`button-search-history-${term.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}><Clock3 size={13} className="shrink-0 text-[#a2978b]"/><span className="truncate">{term}</span></button>)}
          </div>
          : <p className="pt-3 text-[11px] text-[#83796f]">Search products and collections.</p>}
      </section>
    </div>, document.body)}
  </div>;
}
