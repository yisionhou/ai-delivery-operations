'use client';

import { useLayoutEffect, type RefObject } from 'react';

/** Measure unanimated anchors; transform only the persistent media wrapper. */
export function useHeroTravel(scene: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const root = scene.current;
    if (!root) return;
    const origin = root.querySelector<HTMLElement>('.pe-hero-anchor');
    const destination = root.querySelector<HTMLElement>('.pw-hero-destination');
    if (!origin || !destination) return;
    const measure = () => {
      const a = origin.getBoundingClientRect(), b = destination.getBoundingClientRect();
      const x = b.x + b.width / 2 - a.x - a.width / 2;
      const y = b.y + b.height / 2 - a.y - a.height / 2;
      const scale = Math.min(.48, b.width * .88 / a.width, b.height * .94 / a.height);
      origin.style.setProperty('--hero-x', `${x}px`);
      origin.style.setProperty('--hero-y', `${y}px`);
      origin.style.setProperty('--hero-mid-x', `${x * .5 + 24}px`);
      origin.style.setProperty('--hero-mid-y', `${y * .75 - 38}px`);
      origin.style.setProperty('--hero-scale', String(scale * (1490 / 1400)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root); observer.observe(origin); observer.observe(destination);
    // Hero and destination share native scroll coordinates; no scroll-time correction.
    return () => observer.disconnect();
  }, [scene]);
}
