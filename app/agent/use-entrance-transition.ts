'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';

export type PenroseSceneState = 'entrance' | 'leaving-entrance' | 'transitioning' | 'workspace-entering' | 'workspace-ready';
export const SCENE_TIMING = {
  typography: 200, camera: 350, hero: 450, recovery: 1500,
  main: 1780, operations: 1960, incident: 2080, risk: 2200,
  copy: 2250, navigation: 2450, breathing: 2800, ready: 3000,
} as const;
const preference = '(prefers-reduced-motion: reduce)';
const subscribe = (callback: () => void) => {
  const media = window.matchMedia(preference);
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
};

/** One clock owns scene phases. CSS delays derive from this same timeline. */
export function useEntranceTransition(onHandoff?: () => void) {
  const [phase, setPhase] = useState<PenroseSceneState>('entrance');
  const reducedMotion = useSyncExternalStore(subscribe, () => window.matchMedia(preference).matches, () => false);
  const callback = useRef(onHandoff);
  const active = phase !== 'entrance' && phase !== 'workspace-ready';
  const entered = phase !== 'entrance';
  useEffect(() => { callback.current = onHandoff; }, [onHandoff]);
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const started = performance.now(), speed = reducedMotion ? .16 : 1;
    const tick = (now: number) => {
      const elapsed = (now - started) / speed;
      if (elapsed >= SCENE_TIMING.ready) {
        setPhase('workspace-ready');
        callback.current?.();
        window.dispatchEvent(new CustomEvent('penrose:entrance-complete'));
        return;
      }
      setPhase(elapsed >= SCENE_TIMING.recovery ? 'workspace-entering' : elapsed >= SCENE_TIMING.camera ? 'transitioning' : 'leaving-entrance');
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, reducedMotion]);
  const enter = useCallback(() => setPhase(p => p === 'entrance' ? 'leaving-entrance' : p), []);
  const reset = useCallback(() => setPhase('entrance'), []);
  const speed = reducedMotion ? .16 : 1;
  const timingStyle = Object.fromEntries([
    ...Object.entries(SCENE_TIMING).map(([key, value]) => [`--scene-${key}`, `${value * speed}ms`]),
    ['--scene-speed', speed],
  ]) as CSSProperties;
  return {
    phase, enter, reset, entered, reducedMotion, timingStyle,
    heroState: phase === 'entrance' ? 'entrance' as const : phase === 'workspace-ready' ? 'workspace' as const : 'transitioning' as const,
  };
}
