'use client';
import { useLayoutEffect, useRef, type RefObject } from 'react';
import type { RecoveryScene } from './recovery-types';

/** Transform a nested flight wrapper, never the media: playback survives both directions. */
export function useRecoveryHeroTravel(rootRef: RefObject<HTMLElement | null>, scene: RecoveryScene, reduced: boolean) {
  const pose = useRef({x:0,y:0,scale:1});
  useLayoutEffect(() => {
    const root=rootRef.current;
    const flight=root?.querySelector<HTMLElement>('.pe-hero-flight');
    const carrier=root?.querySelector<HTMLElement>('.pe-recovery-flight');
    const target=root?.querySelector<HTMLElement>('.pr-hero-destination');
    if(!flight || !carrier || !target) return;
    const destination=()=>{
      if(scene === 'briefing' || scene === 'transitioning-out') return {x:0,y:0,scale:1};
      const a=flight.getBoundingClientRect(),b=target.getBoundingClientRect();
      // Parent is already scaled by the entrance flight. Convert screen offsets to local units.
      const parentScale=a.width/flight.offsetWidth;
      return {x:(b.x+b.width/2-a.x-a.width/2)/parentScale,y:(b.y+b.height/2-a.y-a.height/2)/parentScale,
        scale:Math.min(.88,b.width*.9/a.width,b.height*.9/a.height)};
    };
    const apply=(p:typeof pose.current)=>{
      pose.current=p;carrier.style.transform=`translate(${p.x}px,${p.y}px) scale(${p.scale})`;
    };
    let frame=0;
    if(scene === 'transitioning-in' || scene === 'transitioning-out'){
      const start={...pose.current},began=performance.now(),duration=reduced?160:1800;
      const tick=(now:number)=>{
        const t=Math.min(1,(now-began)/duration),e=t*t*(3-2*t),end=destination();
        // Quadratic arc with a small lateral/upward retreat and continuous scale.
        const arc=reduced?0:4*e*(1-e);
        apply({x:start.x+(end.x-start.x)*e+arc*24,y:start.y+(end.y-start.y)*e-arc*64,
          scale:start.scale+(end.scale-start.scale)*e-arc*.035});
        if(t<1)frame=requestAnimationFrame(tick);
      };
      frame=requestAnimationFrame(tick);
    } else apply(destination());
    const align=()=>{if(scene==='options'||scene==='briefing')apply(destination());};
    const observer=new ResizeObserver(align);observer.observe(flight);observer.observe(target);
    return ()=>{cancelAnimationFrame(frame);observer.disconnect();};
  },[rootRef,scene,reduced]);
}
