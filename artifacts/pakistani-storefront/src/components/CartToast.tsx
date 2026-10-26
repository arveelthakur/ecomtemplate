import { Check } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useStore } from '../context/StoreContext';

export default function CartToast() {
  const { cartToast } = useStore();
  if (typeof document === 'undefined') return null;
  return createPortal(<div
    className={`pointer-events-none fixed left-1/2 z-[10050] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2.5 rounded-full border border-[#8eae91] bg-[#35694c] px-5 py-3 text-sm font-semibold text-white shadow-xl transition-all duration-300 ${cartToast ? 'translate-y-0 opacity-100' : '-translate-y-3 opacity-0'}`}
    style={{top:'max(1rem, env(safe-area-inset-top))'}}
    role="status"
    aria-live="polite"
    aria-atomic="true"
    aria-hidden={!cartToast}
    data-testid="toast-cart-success"
  >
    {cartToast && <><Check size={17} strokeWidth={2.5} aria-hidden="true" /><span>{cartToast.message}</span></>}
  </div>, document.body);
}
