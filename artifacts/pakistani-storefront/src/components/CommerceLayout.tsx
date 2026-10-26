import { type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import AnnouncementBar from './AnnouncementBar';
import StoreFooter from './StoreFooter';
import MobileBottomNav from './MobileBottomNav';
import StorefrontHeader from './StorefrontHeader';
import MarqueeBars from './MarqueeBars';

export function CommerceLayout({ children, eyebrow, title, intro }: { children: ReactNode; eyebrow?: string; title?: string; intro?: string }) {
  return <div className="nura-commerce min-h-[100dvh] bg-[#FDFBF7] text-[#352b2b]">
    <AnnouncementBar/>
    <MarqueeBars placement="top"/>
    <StorefrontHeader/>
    <MarqueeBars placement="below-header"/>
    <main className="mx-auto w-[min(1120px,_calc(100%_-_36px))] pb-16 pt-8 sm:pt-12">
      {(eyebrow || title) && <div className="mb-8 max-w-2xl"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#74816c]">{eyebrow}</p><h1 className="mt-2 text-[32px] font-semibold leading-tight tracking-[-.045em] text-[#3c3032] sm:text-[42px]" data-testid="text-page-title">{title}</h1>{intro && <p className="mt-3 max-w-xl text-sm leading-6 text-[#766d64]">{intro}</p>}</div>}
      {children}
    </main>
    <MarqueeBars placement="footer"/>
    <MarqueeBars placement="floating"/>
    <StoreFooter/>
    <MobileBottomNav/>
  </div>;
}

export function ActionButton({ children, onClick, type = 'button', disabled = false, testId, variant = 'primary' }: { children: ReactNode; onClick?: () => void; type?: 'button' | 'submit'; disabled?: boolean; testId: string; variant?: 'primary' | 'quiet' }) {
  const style = variant === 'primary' ? 'bg-[#6B2447] text-white hover:bg-[#55203a] disabled:opacity-45' : 'border border-[#d8cec2] bg-transparent text-[#5f514c] hover:bg-[#f2ede5]';
  return <button type={type} onClick={onClick} disabled={disabled} data-testid={testId} className={`inline-flex min-h-11 items-center justify-center gap-2 px-5 text-xs font-semibold transition-colors disabled:cursor-not-allowed ${style}`}>{children}</button>;
}

export function QuantityControl({ value, onChange, testId, max }: { value: number; onChange: (value: number) => void; testId: string; max?: number }) {
  return <div className="inline-flex h-10 items-center border border-[#dfd6ca]" data-testid={`${testId}-control`}>
    <button type="button" aria-label="Decrease quantity" onClick={() => onChange(Math.max(1, value - 1))} className="h-full w-10 text-lg text-[#6B2447]" data-testid={`${testId}-decrease`}>−</button>
    <span className="w-8 text-center text-xs tabular-nums" data-testid={`${testId}-value`}>{value}</span>
    <button type="button" aria-label="Increase quantity" disabled={max!==undefined&&value>=max} onClick={() => onChange(value + 1)} className="h-full w-10 text-lg text-[#6B2447] disabled:cursor-not-allowed disabled:opacity-40" data-testid={`${testId}-increase`}>+</button>
  </div>;
}

export function formatMoney(value: number) {
  return `Rs ${Math.round(value).toLocaleString('en-PK')}`;
}

export function useCommerceNavigate() {
  return useNavigate();
}