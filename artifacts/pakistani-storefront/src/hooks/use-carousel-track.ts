import { useCallback, useRef, type FocusEvent, type PointerEvent as ReactPointerEvent } from 'react';

type Options = {
  enabled: boolean;
  autoScroll: boolean;
};

function findAnimatedTrack(track: HTMLDivElement) {
  return track.querySelector<HTMLElement>('[data-carousel-animation-track],.nura-category-marquee-track');
}

export function useCarouselTrack({ enabled, autoScroll }: Options) {
  const trackRef = useRef<HTMLDivElement>(null);
  const resumeTimer = useRef<number | null>(null);
  const drag = useRef<{ pointerId: number; x: number; y: number; scrollLeft: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const suppressTimer = useRef<number | null>(null);

  const pause = useCallback(() => {
    if (resumeTimer.current !== null) window.clearTimeout(resumeTimer.current);
    resumeTimer.current = null;
    const track = trackRef.current;
    const animated = track && findAnimatedTrack(track);
    animated?.getAnimations().forEach(animation => animation.pause());
  }, []);

  const resumeAfterIdle = useCallback(() => {
    if (resumeTimer.current !== null) window.clearTimeout(resumeTimer.current);
    resumeTimer.current = window.setTimeout(() => {
      const track = trackRef.current;
      const animated = track && findAnimatedTrack(track);
      const animations = animated?.getAnimations() ?? [];
      if (autoScroll && track && animated && track.scrollLeft) {
        const unit = animated.querySelector<HTMLElement>('[data-carousel-loop-unit]')?.offsetWidth;
        const durationSeconds = Number.parseFloat(getComputedStyle(animated).animationDuration);
        const animation = animations[0];
        if (unit && durationSeconds > 0 && animation && Number.isFinite(Number(animation.currentTime))) {
          const durationMs = durationSeconds * 1000;
          animation.currentTime = (Number(animation.currentTime) + track.scrollLeft / unit * durationMs) % durationMs;
          track.scrollLeft = 0;
        }
      }
      animations.forEach(animation => animation.play());
      resumeTimer.current = null;
    }, 900);
  }, [autoScroll]);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!enabled) return;
    pause();
    if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
    if ((event.target as HTMLElement).closest('button,input,select,textarea,[contenteditable="true"]')) return;
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, scrollLeft: event.currentTarget.scrollLeft, moved: false };
  }, [enabled, pause]);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const activeDrag = drag.current;
    if (!activeDrag || activeDrag.pointerId !== event.pointerId) return;
    const delta = event.clientX - activeDrag.x;
    const deltaY = event.clientY - activeDrag.y;
    if (!activeDrag.moved && Math.abs(deltaY) >= 8 && Math.abs(deltaY) >= Math.abs(delta)) {
      drag.current = null;
      return;
    }
    if (!activeDrag.moved && Math.abs(delta) < 8) return;
    if (!activeDrag.moved) {
      activeDrag.moved = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      suppressClick.current = true;
      if (suppressTimer.current !== null) window.clearTimeout(suppressTimer.current);
      suppressTimer.current = window.setTimeout(() => { suppressClick.current = false; }, 1000);
    }
    event.currentTarget.scrollLeft = activeDrag.scrollLeft - delta;
  }, []);

  const finishPointer = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const activeDrag = drag.current;
    if (activeDrag?.pointerId === event.pointerId) drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    resumeAfterIdle();
  }, [resumeAfterIdle]);

  const onClickCapture = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!suppressClick.current) return;
    suppressClick.current = false;
    if (suppressTimer.current !== null) window.clearTimeout(suppressTimer.current);
    suppressTimer.current = null;
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const onBlurCapture = useCallback((event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget;
    if (!next || !event.currentTarget.contains(next as Node)) resumeAfterIdle();
  }, [resumeAfterIdle]);

  const scrollBy = useCallback((distance: number) => {
    const track = trackRef.current;
    if (!track) return;
    pause();
    track.scrollBy({ left: distance, behavior: 'smooth' });
    resumeAfterIdle();
  }, [pause, resumeAfterIdle]);

  return {
    trackRef,
    onPointerDown,
    onPointerEnter: pause,
    onPointerLeave: resumeAfterIdle,
    onPointerMove,
    onPointerUp: finishPointer,
    onPointerCancel: finishPointer,
    onClickCapture,
    onFocusCapture: pause,
    onBlurCapture,
    scrollBy,
    onTouchStart: pause,
    onTouchEnd: resumeAfterIdle,
    onTouchCancel: resumeAfterIdle,
  };
}
