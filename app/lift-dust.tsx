import {useEffect,useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import * as THREE from 'three';
import {noDecorationRaycast} from './region-interaction';
import type {VisibilitySettings} from './visibility-diagnostics';
import type {RegionLayout} from './inspection-camera';
import type {RegionCollection} from './singapore-scene';
import {supportAnchors,supportPoint,SupportState,SupportResiduals} from './support-field';
import {createSupportMist,LOCAL_MIST_SITES} from './support-mist';
/* eslint-disable react-hooks/immutability -- Imperative GPU buffers and object transforms are updated only in the frame loop. */

export default function LiftDust({selectedRegion,geo,visibility,layouts}:{selectedRegion:string|null;geo:RegionCollection;visibility:VisibilitySettings;layouts:Record<string,RegionLayout>}){
  const state=useMemo(()=>new SupportState(),[]),dust=useMemo(()=>new SupportResiduals(),[]);
  const mist=useMemo(()=>createSupportMist(),[]);
  const anchors=useMemo(()=>Object.fromEntries(geo.features.map(f=>[f.properties.REGION_N,supportAnchors(f,LOCAL_MIST_SITES)])),[geo]);
  const cueAnchors=useMemo(()=>Object.fromEntries(geo.features.map(f=>[f.properties.REGION_N,supportAnchors(f)])),[geo]);
  const previous=useRef<string|null>(null),source=useRef<THREE.Object3D|null>(null),emission=useRef(0),telemetry=useRef(0);
  const cues=useRef<Array<THREE.PointLight|null>>([]);
  const direction=useMemo(()=>new THREE.Vector3(),[]),point=useMemo(()=>new THREE.Vector3(),[]);
  const dustGeometry=useMemo(()=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(dust.positions,3).setUsage(THREE.DynamicDrawUsage));g.setAttribute('aAlpha',new THREE.BufferAttribute(dust.alpha,1).setUsage(THREE.DynamicDrawUsage));return g;},[dust]);
  const dustMaterial=useMemo(()=>new THREE.ShaderMaterial({transparent:true,depthTest:true,depthWrite:false,uniforms:{uDpr:{value:1},uIvory:{value:new THREE.Color('#E5BA61')}},
    vertexShader:`attribute float aAlpha;uniform float uDpr;varying float vAlpha;void main(){vAlpha=aAlpha;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=2.4*uDpr;}`,
    fragmentShader:`uniform vec3 uIvory;varying float vAlpha;void main(){float r=length(gl_PointCoord-.5);gl_FragColor=vec4(uIvory,exp(-r*r*18.)*(1.-smoothstep(.35,.5,r))*vAlpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
  }),[]);
  useEffect(()=>()=>{dustGeometry.dispose();dustMaterial.dispose();mist.dispose();},[dustGeometry,dustMaterial,mist]);
  useFrame(({scene,gl},dt)=>{
    state.tick(dt);dust.tick(dt);
    if(previous.current!==selectedRegion){
      previous.current=selectedRegion;state.release(true);emission.current=0;
      source.current=selectedRegion?scene.getObjectByName(`region-${selectedRegion.toLowerCase().replaceAll(' ','-')}`)??null:null;
      if(source.current&&selectedRegion){source.current.updateWorldMatrix(true,false);state.begin(selectedRegion,source.current.matrixWorld,anchors[selectedRegion]);}
    }
    const active=state.current;
    if(active&&source.current&&selectedRegion){
      source.current.updateWorldMatrix(true,false);active.matrix.copy(source.current.matrixWorld);
      emission.current+=Math.min(dt,.15);
      if(emission.current>.12){emission.current-=.12;const a=active.anchors[dust.cursor%active.anchors.length];
        supportPoint(a,1,.3+.4*Math.sin(dust.cursor*.73)**2,state.time,point).applyMatrix4(active.matrix);
        direction.set(a.nx,0,a.nz).transformDirection(active.matrix);dust.spawn(point,direction);
      }
      const goal=layouts[selectedRegion].translation.clone().setY(.76);
      if(source.current.position.distanceTo(goal)<.02)state.release();
    }
    dustGeometry.setDrawRange(0,visibility.support?dust.alpha.length:0);dustGeometry.attributes.position.needsUpdate=true;dustGeometry.attributes.aAlpha.needsUpdate=true;dustGeometry.computeBoundingSphere();
    dustMaterial.uniforms.uDpr.value=gl.getPixelRatio();
    mist.update(state,visibility.support);
    gl.domElement.dataset.mist=String(mist.geometry.instanceCount);
    // Deliberate, economical underside bounce approximation; not glow pretending to illuminate geometry.
    const latest=state.banks.at(-1);
    cues.current.forEach((light,i)=>{if(!light)return;light.intensity=latest&&visibility.support?state.opacity(latest)*.65:0;
      if(latest){const a=cueAnchors[latest.region][i?4:1];light.position.set(a.x+a.nx*.15,-.12,a.z+a.nz*.15).applyMatrix4(latest.matrix);}
    });
    telemetry.current+=dt;if(telemetry.current>.1){telemetry.current=0;gl.domElement.dataset.support=JSON.stringify({enabled:visibility.support,transitions:state.serial,emitting:state.current?.id??null,lineVertices:0,mistInstances:mist.geometry.instanceCount,residuals:dust.active,residualBirths:dust.cursor,banks:state.banks.map(b=>({id:b.id,region:b.region,phase:state.phase(b),alpha:state.opacity(b),matrixPosition:[b.matrix.elements[12],b.matrix.elements[13],b.matrix.elements[14]],anchor:point.set(b.anchors[0].x,-.14,b.anchors[0].z).applyMatrix4(b.matrix).toArray()}))});}
  });
  return <><mesh name="levitation-support-mist" geometry={mist.geometry} material={mist.material} raycast={noDecorationRaycast} frustumCulled={false}/><points name="released-support-dust" geometry={dustGeometry} material={dustMaterial} raycast={noDecorationRaycast}/>
    {[0,1].map(i=><pointLight key={i} ref={light=>{cues.current[i]=light;}} color="#E8DDC3" intensity={0} distance={3.2} decay={2}/>)}</>;
}
