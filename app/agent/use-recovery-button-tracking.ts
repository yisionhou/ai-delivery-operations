'use client';

import { useLayoutEffect, type RefObject } from 'react';

/** Follow the enclosed transparent opening, rather than a separate animation clock. */
export function useRecoveryButtonTracking(button: RefObject<HTMLButtonElement | null>, active: boolean) {
  useLayoutEffect(() => {
    const target = button.current;
    const core = target?.closest<HTMLElement>('.pw-core');
    const video = target?.closest('main')?.querySelector<HTMLVideoElement>('.pe-hero video');
    if (!active || !target || !core || !video) return;
    const canvas = document.createElement('canvas');
    const width = 128, height = 72;
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return;
    let frame = 0, last = -Infinity, stopped = false;
    let opening: { x: number; y: number } | undefined;
    let smoothOpening: { x: number; y: number } | undefined;
    let previousFrame = 0;
    const update = (time: number) => {
      if (stopped) return;
      frame = requestAnimationFrame(update);
      if (document.hidden || video.readyState < 2) return;
      try {
        if (time - last >= 100) {
          last = time;
          context.clearRect(0, 0, width, height);
          context.drawImage(video, 0, 0, width, height);
          const pixels = context.getImageData(0, 0, width, height).data;
          const seen = new Uint8Array(width * height);
          let bestSize = 0, centerX = 0, centerY = 0;
          // Transparent components touching the frame are the outside, not the opening.
          for (let start = 0; start < seen.length; start++) {
            if (seen[start] || pixels[start * 4 + 3] > 48) continue;
            const queue = [start]; seen[start] = 1;
            let sumX = 0, sumY = 0, edge = false;
            for (let index = 0; index < queue.length; index++) {
              const p = queue[index], x = p % width, y = Math.floor(p / width);
              sumX += x + .5; sumY += y + .5;
              if (!x || !y || x === width - 1 || y === height - 1) edge = true;
              for (const next of [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1,
                y > 0 ? p - width : -1, y < height - 1 ? p + width : -1]) {
                if (next < 0 || seen[next] || pixels[next * 4 + 3] > 48) continue;
                seen[next] = 1; queue.push(next);
              }
            }
            const x = sumX / queue.length / width, y = sumY / queue.length / height;
            if (!edge && queue.length > Math.max(bestSize, 12) && x > .2 && x < .8 && y > .15 && y < .85) {
              bestSize = queue.length; centerX = x; centerY = y;
            }
          }
          if (bestSize) opening = { x: centerX, y: centerY };
        }
        // Sample the opening cheaply, but project it through the moving scene every frame.
        // Keep the last opening during edge-on frames without freezing the screen position.
        if (!opening) return;
        const blend = 1 - Math.exp(-Math.min(100, time - previousFrame) / 80);
        previousFrame = time;
        smoothOpening = smoothOpening ? {
          x: smoothOpening.x + (opening.x - smoothOpening.x) * blend,
          y: smoothOpening.y + (opening.y - smoothOpening.y) * blend,
        } : opening;
        const media = video.getBoundingClientRect(), slot = core.getBoundingClientRect();
        target.style.setProperty('--recovery-drift-x', `${media.left + smoothOpening.x * media.width - slot.left - slot.width / 2}px`);
        target.style.setProperty('--recovery-drift-y', `${media.top + smoothOpening.y * media.height - slot.top - slot.height / 2}px`);
      } catch {
        // Cross-origin/custom media can be unreadable; keep the centered entry usable.
        stopped = true; cancelAnimationFrame(frame);
      }
    };
    // Resolve the first pose before paint, then keep it alive across recovery views.
    update(performance.now());
    return () => {
      stopped = true; cancelAnimationFrame(frame);
      target.style.removeProperty('--recovery-drift-x');
      target.style.removeProperty('--recovery-drift-y');
    };
  }, [button, active]);
}
