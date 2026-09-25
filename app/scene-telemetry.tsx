import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

// Read-only DOM diagnostics for same-viewport browser regression checks.
export default function SceneTelemetry(){
  const sample=useRef({seconds:0,frames:0});
  useFrame(({gl,scene},dt)=>{
    sample.current.seconds+=dt;sample.current.frames++;
    if(sample.current.seconds<1)return;
    gl.domElement.setAttribute('data-frame-ms',(sample.current.seconds*1000/sample.current.frames).toFixed(2));
    // ContactShadows resets per-pass render counters; report memory only, not misleading draw totals.
    gl.domElement.setAttribute('data-resources',JSON.stringify({...gl.info.memory}));
    const regions:Record<string,unknown>={};scene.traverse(o=>{if(o.userData.visibility)regions[o.name]={...o.userData.visibility,position:o.position.toArray()};});
    gl.domElement.setAttribute('data-region-lighting',JSON.stringify(regions));
    sample.current={seconds:0,frames:0};
  });
  return null;
}
