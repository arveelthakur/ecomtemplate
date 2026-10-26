import { useEffect } from 'react';

type SavedScrollStyles = {
  overflow: string;
  overscrollBehavior: string;
  position: string;
  top: string;
  left: string;
  right: string;
  width: string;
  scrollX: number;
  scrollY: number;
  locationKey: string;
};

const activeLocks = new Set<symbol>();
let savedStyles: SavedScrollStyles | null = null;

function acquireBodyScrollLock() {
  if (typeof document === 'undefined') return () => {};

  const token = Symbol('body-scroll-lock');
  if (activeLocks.size === 0) {
    savedStyles = {
      overflow: document.body.style.overflow,
      overscrollBehavior: document.body.style.overscrollBehavior,
      position: document.body.style.position,
      top: document.body.style.top,
      left: document.body.style.left,
      right: document.body.style.right,
      width: document.body.style.width,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      locationKey: `${window.location.pathname}${window.location.search}${window.location.hash}`,
    };
    document.body.style.position = 'fixed';
    document.body.style.top = `-${savedStyles.scrollY}px`;
    document.body.style.left = `-${savedStyles.scrollX}px`;
    document.body.style.right = '0';
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
  }
  activeLocks.add(token);

  return () => {
    activeLocks.delete(token);
    if (activeLocks.size !== 0 || !savedStyles) return;
    document.body.style.overflow = savedStyles.overflow;
    document.body.style.overscrollBehavior = savedStyles.overscrollBehavior;
    document.body.style.position = savedStyles.position;
    document.body.style.top = savedStyles.top;
    document.body.style.left = savedStyles.left;
    document.body.style.right = savedStyles.right;
    document.body.style.width = savedStyles.width;
    const locationKey = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (locationKey === savedStyles.locationKey) window.scrollTo(savedStyles.scrollX, savedStyles.scrollY);
    savedStyles = null;
  };
}

export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    return acquireBodyScrollLock();
  }, [active]);
}
