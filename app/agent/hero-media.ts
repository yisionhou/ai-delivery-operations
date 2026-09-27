import type { PenroseHeroProps } from './penrose-hero';

/** Approved Blender delivery: full 90-second VP9 alpha loop, with its original camera. */
export const entranceHeroMedia = {
  src: '/media/penrose/hero-penrose-alpha.webm',
  poster: '/media/penrose/hero-penrose-poster.png',
  mediaType: 'video',
  frameAspectRatio: 16 / 9,
  autoplay: true,
  loop: true,
  muted: true,
  playsInline: true,
  objectFit: 'contain',
  objectPosition: 'center',
} satisfies Omit<PenroseHeroProps, 'heroState'>;
