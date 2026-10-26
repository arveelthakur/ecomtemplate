import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useBodyScrollLock } from '../hooks/use-body-scroll-lock';

export default function AdminModalPortal({children}:{children:ReactNode}){
  const portalRef=useRef<HTMLDivElement>(null);
  useBodyScrollLock(true);

  useEffect(()=>{
    const portal=portalRef.current;
    if(!portal)return;
    let frame=0;
    const syncVisualViewport=()=>{
      const viewport=window.visualViewport;
      portal.style.setProperty('--ad-visual-viewport-top',`${viewport?.offsetTop??0}px`);
      portal.style.setProperty('--ad-visual-viewport-left',`${viewport?.offsetLeft??0}px`);
      portal.style.setProperty('--ad-visual-viewport-width',`${viewport?.width??window.innerWidth}px`);
      portal.style.setProperty('--ad-visual-viewport-height',`${viewport?.height??window.innerHeight}px`);
      cancelAnimationFrame(frame);
      frame=requestAnimationFrame(()=>requestAnimationFrame(()=>{
        const focused=document.activeElement;
        if(!(focused instanceof HTMLElement)||!focused.matches('input, textarea, select, [contenteditable="true"]'))return;
        const scrollSurface=focused.closest<HTMLElement>('.ad-modal-body, .ad-side-drawer');
        if(!scrollSurface||!portal.contains(scrollSurface))return;
        const bodyBounds=scrollSurface.getBoundingClientRect();
        const fieldBounds=focused.getBoundingClientRect();
        const margin=12;
        const scrollDelta=fieldBounds.bottom>bodyBounds.bottom-margin
          ?fieldBounds.bottom-bodyBounds.bottom+margin
          :fieldBounds.top<bodyBounds.top+margin
            ?fieldBounds.top-bodyBounds.top-margin
            :0;
        if(scrollDelta)scrollSurface.scrollTop+=scrollDelta;
      }));
    };
    const viewport=window.visualViewport;
    syncVisualViewport();
    viewport?.addEventListener('resize',syncVisualViewport);
    viewport?.addEventListener('scroll',syncVisualViewport);
    window.addEventListener('resize',syncVisualViewport);
    return()=>{
      cancelAnimationFrame(frame);
      viewport?.removeEventListener('resize',syncVisualViewport);
      viewport?.removeEventListener('scroll',syncVisualViewport);
      window.removeEventListener('resize',syncVisualViewport);
    };
  },[]);

  return createPortal(<div ref={portalRef} className="nura-admin ad-modal-portal">{children}</div>,document.documentElement);
}
