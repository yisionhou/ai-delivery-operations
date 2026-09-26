import {useEffect,useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import * as THREE from 'three';
import {createSupportMist} from './support-mist';
import {supportAnchors} from './support-field';
import {noDecorationRaycast} from './region-interaction';
import type {RegionCollection} from './singapore-scene';
/* eslint-disable react-hooks/immutability -- Three.js GPU attributes and uniforms are intentionally updated in the frame loop. */

// Separate world-space cloud bed. It never follows a lifted region or stores a path.
export default function BaseMist({geo,focused,enabled}:{geo:RegionCollection;focused:boolean;enabled:boolean}){
  const cloud=useMemo(()=>{
    const bed=createSupportMist();
    // Global-only shaping: the approved local renderer is untouched.
    // A shallow world-space stack stays below the island. Camera-facing global
    // billboards otherwise rise over the map and get sliced into rails by its floor.
    bed.material.vertexShader=`attribute vec3 aCenter;attribute vec4 aMist;varying vec2 vUv;varying vec2 vMist;
      void main(){vUv=uv;vMist=aMist.zw;float angle=aMist.w;
        mat2 turn=mat2(cos(angle),-sin(angle),sin(angle),cos(angle));
        vec2 q=turn*(position.xy*aMist.xy);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(aCenter+vec3(q.x,0.,q.y),1.);}`;
    bed.material.fragmentShader=bed.material.fragmentShader.replace('dot(warp,warp)*2.8','dot(warp,warp)*1.9');
    return bed;
  },[]),time=useRef(0),strength=useRef(1);
  const sites=useMemo(()=>geo.features.flatMap(f=>supportAnchors(f,12)),[geo]);
  useEffect(()=>()=>cloud.dispose(),[cloud]);
  useFrame(({gl},dt)=>{
    time.current+=dt;strength.current=THREE.MathUtils.damp(strength.current,focused?.30:1,2,dt);
    const centers=cloud.geometry.getAttribute('aCenter') as THREE.InstancedBufferAttribute;
    const params=cloud.geometry.getAttribute('aMist') as THREE.InstancedBufferAttribute;
    sites.forEach((a,i)=>{
      const t=time.current*.075+a.phase;
      centers.setXYZ(i,a.x+a.nx*1.1+Math.sin(t)*.16,-.42+(i%3)*.07+Math.sin(t*.7)*.008,a.z+a.nz*1.1+Math.cos(t)*.12);
      params.setXYZW(i,8.0+(i%5)*.65,5.0+(i%3)*.65,(.17+(i%4)*.012)*strength.current,a.phase);
    });
    cloud.material.uniforms.uTime.value=time.current*.23;
    cloud.geometry.instanceCount=enabled?sites.length:0;centers.needsUpdate=true;params.needsUpdate=true;
    gl.domElement.dataset.baseMist=JSON.stringify({instances:cloud.geometry.instanceCount,strength:strength.current,worldSpace:true});
  });
  return <mesh name="global-gold-cloud-foundation" geometry={cloud.geometry} material={cloud.material} raycast={noDecorationRaycast} frustumCulled={false}/>;
}
