'use client';

import {useId,type CSSProperties} from 'react';

const paths=[
 'M42 228 C-10 150 355 82 377 160 C414 254 90 302 42 228 Z',
 'M130 38 C226 -14 365 284 272 350 C183 414 24 107 130 38 Z',
 'M301 60 C386 154 114 373 59 301 C-22 213 224 -20 301 60 Z',
];
export function OrbitTrails({layer='back'}:{layer?:'back'|'front'}){
 const id=useId().replace(/:/g,'');
 return <svg className="pe-orbits" viewBox="0 0 400 400" role="presentation" data-layer={layer}>
  <defs>
   <filter id={id+'-glow'} x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="1.6"/></filter>
   <clipPath id={id+'-front'}><path d="M0 245 Q200 190 400 245 V400 H0Z"/></clipPath>
   {paths.map((d,i)=><path key={i} id={id+'-path-'+i} d={d}/>)}
  </defs>
  <g clipPath={layer==='front'?'url(#'+id+'-front)':undefined}>
   {paths.map((d,i)=><g key={i} className="pe-orbit-plane" style={{'--orbit-period':(68+i*17)+'s','--orbit-delay':(-i*19)+'s'} as CSSProperties}>
    <path d={d} className="pe-orbit-line"/>
    <path d={d} className="pe-orbit-flow" pathLength="100"/>
    <g className="pe-orbit-particle">
     <circle r="4" fill="#e8ce9d" opacity=".38" filter={'url(#'+id+'-glow)'}/>
     <circle r="1.1" fill="#fff0c2"/>
     <animateMotion dur={(68+i*17)+'s'} repeatCount="indefinite" begin={(-i*19)+'s'}><mpath href={'#'+id+'-path-'+i}/></animateMotion>
    </g>
   </g>)}
  </g>
 </svg>;
}

function AmbientStars() {
  return <div className="pe-stars" aria-hidden="true">
    {[[26, 22], [68, 18], [77, 75], [52, 84]].map(([x, y], i) =>
      <i key={i} style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${i * -4}s` }} />)}
  </div>;
}

export default function SpaceBackground() {
  return <><div className="pe-space" aria-hidden="true">
    <div className="pe-background-art">
      <img className="pe-background-image" src="/media/penrose/entrance-background.png" alt="" fetchPriority="high" />
    </div>
    <AmbientStars />
  </div></>;
}
