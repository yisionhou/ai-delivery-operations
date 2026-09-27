'use client';

import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react';

export type HeroState = 'entrance' | 'transitioning' | 'workspace' | 'transitioning-to-recovery' | 'recovery-options' | 'transitioning-to-briefing';
export type PenroseHeroProps = {
  src?: string;
  poster?: string;
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
  playsInline?: boolean;
  heroState?: HeroState;
  /** Video supports MP4, WebM and alpha video; renderer supports sequences/canvas. */
  mediaType?: 'video' | 'image' | 'custom';
  renderMedia?: (state: HeroState) => ReactNode;
  objectFit?: 'contain' | 'cover';
  objectPosition?: string;
  /** Preserve the render's full camera frame; transparent margins may extend beyond the hero slot. */
  frameAspectRatio?: number;
};

export default function PenroseHero({
  src, poster, autoplay = true, loop = true, muted = true, playsInline = true,
  heroState = 'entrance', mediaType = 'video', renderMedia,
  objectFit = 'contain', objectPosition = 'center', frameAspectRatio,
}: PenroseHeroProps) {
  const video = useRef<HTMLVideoElement>(null);
  const [failedSource, setFailedSource] = useState<string>();
  const failed = failedSource === src && !!src;
  // Autoplay is suppressed for reduced motion, including preference changes.
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => {
      if (!video.current) return;
      // A cached/early media error can occur before hydration attaches onError.
      if (video.current.error) { setFailedSource(src); return; }
      if (preference.matches || !autoplay) video.current.pause();
      else void video.current.play().catch((error: DOMException) => {
        if (error.name === 'NotSupportedError') setFailedSource(src);
        // Blocked autoplay retains the matching poster.
      });
    };
    sync();
    preference.addEventListener('change', sync);
    return () => preference.removeEventListener('change', sync);
  }, [src, autoplay, mediaType, failed]);

  const style: CSSProperties = { objectFit, objectPosition, ...(frameAspectRatio ? {
    position:'absolute',left:'50%',top:'50%',width:'auto',height:'100%',maxWidth:'none',
    aspectRatio:frameAspectRatio,transform:'translate(-50%, -50%)',
  } : {}) };
  return (
    <div className="pe-hero" data-hero-state={heroState} data-media-state={src || renderMedia ? (failed ? 'fallback' : 'ready') : 'empty'} aria-hidden="true">
      {mediaType === 'custom' ? renderMedia?.(heroState) :
        mediaType === 'image' ? (src || poster ? <img src={src || poster} alt="" style={style} /> : null) :
        src && !failed ? <video key={src} ref={video} src={src} poster={poster} loop={loop}
          muted={muted} playsInline={playsInline} preload="auto" style={style}
          onError={() => setFailedSource(src)} /> :
        poster ? <img src={poster} alt="" style={style} /> : null}
    </div>
  );
}
