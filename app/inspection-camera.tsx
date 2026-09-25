"use client";
/* eslint-disable react-hooks/immutability -- Three.js controls and shared interaction refs are intentionally imperative inside effects/frame callbacks. */

import { useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export type CameraCommand = { id: number; kind: 'reset' | 'in' | 'out' };
export type InspectionGate = { locked: boolean; moved: boolean };
export type RegionLayout = { center: THREE.Vector3; width: number; depth: number; translation: THREE.Vector3 };
const PRESENTATION = new THREE.Vector3(-4, 0, 10);

export function canonicalCamera(layout: RegionLayout | undefined, aspect: number) {
  if (!layout) return { position: new THREE.Vector3(2.7,27.5,19.6), target: new THREE.Vector3(.7,0,0), pivot: new THREE.Vector3(.7,0,0) };
  const tangent=Math.tan(THREE.MathUtils.degToRad(15));
  const distance=Math.max(layout.width/(2*tangent*aspect*.56),(layout.depth*.81+2.5)/(2*tangent*.8),20);
  const halfWidth=distance*tangent*aspect;
  const pivot=PRESENTATION.clone().add(new THREE.Vector3(0,1.15,0));
  const target=pivot.clone().add(new THREE.Vector3(halfWidth*.32,0,-halfWidth*.024));
  return {pivot,target,position:target.clone().add(new THREE.Vector3(.075,.81,.58).normalize().multiplyScalar(distance))};
}

export default function InspectionCamera({selectedRegion,layouts,command,gate,onMotionChange}:{
  selectedRegion:string|null; layouts:Record<string,RegionLayout>; command:CameraCommand;
  gate:MutableRefObject<InspectionGate>; onMotionChange:(busy:boolean)=>void;
}) {
  const {camera,gl,size,scene}=useThree();
  // Controls orbit the physical pivot. A screen-right camera offset preserves the left composition.
  const proxy=useMemo(()=>new THREE.PerspectiveCamera(30,1,.1,120),[]);
  const controls=useRef<OrbitControls|null>(null);
  const lookAt=useRef(new THREE.Vector3(.7,0,0));
  const motion=useRef({elapsed:0,automatic:true,selection:true});
  const previousRegion=useRef<string|null>(null);
  const zoomGoal=useRef<{position:THREE.Vector3;target:THREE.Vector3}|null>(null);
  const layout=selectedRegion?layouts[selectedRegion]:undefined;
  const canonical=useMemo(()=>canonicalCamera(layout,size.width/size.height),[layout,size.width,size.height]);

  useLayoutEffect(()=>{
    const selection=previousRegion.current!==selectedRegion;
    previousRegion.current=selectedRegion;
    const old=controls.current;
    zoomGoal.current=null;
    if(!selection&&command.kind!=='reset'&&old){
      const distance=old.getDistance();
      const radius=THREE.MathUtils.clamp(distance*(command.kind==='in'?.93:1.07),old.minDistance,old.maxDistance);
      const right=new THREE.Vector3().setFromMatrixColumn(proxy.matrix,0).normalize();
      const shift=selectedRegion?radius*Math.tan(Math.PI/12)*(size.width/size.height)*.32:0;
      const target=canonical.pivot.clone().add(right.multiplyScalar(shift));
      zoomGoal.current={position:target.clone().add(proxy.position.clone().sub(old.target).normalize().multiplyScalar(radius)),target};
    }
    old?.dispose();
    const orbit=new OrbitControls(proxy,gl.domElement);
    orbit.enabled=false; orbit.enablePan=false; orbit.enableDamping=true; orbit.dampingFactor=.085;
    orbit.rotateSpeed=.4; orbit.zoomSpeed=.35; orbit.zoomToCursor=false;
    orbit.minPolarAngle=.46; orbit.maxPolarAngle=selectedRegion?.84:.91;
    const azimuth=selectedRegion?Math.atan2(.075,.58):Math.atan2(2.,19.6);
    orbit.minAzimuthAngle=azimuth-(selectedRegion?.16:.32);
    orbit.maxAzimuthAngle=azimuth+(selectedRegion?.16:.32);
    const radius=canonical.position.distanceTo(canonical.target);
    orbit.minDistance=radius*(selectedRegion?.94:.93); orbit.maxDistance=radius*1.15;
    orbit.touches={ONE:THREE.TOUCH.ROTATE,TWO:THREE.TOUCH.DOLLY_ROTATE};
    controls.current=orbit;
    gate.current.locked=true; gate.current.moved=false;
    gl.domElement.dataset.inspection='locked';
    motion.current={elapsed:0,automatic:true,selection};
    onMotionChange(true);
    const origin=new THREE.Vector2();
    const down=(e:PointerEvent)=>{origin.set(e.clientX,e.clientY);gate.current.moved=false;};
    const move=(e:PointerEvent)=>{if(e.buttons&&origin.distanceTo(new THREE.Vector2(e.clientX,e.clientY))>5)gate.current.moved=true;};
    gl.domElement.addEventListener('pointerdown',down,true);
    gl.domElement.addEventListener('pointermove',move,true);
    return ()=>{orbit.dispose();gl.domElement.removeEventListener('pointerdown',down,true);gl.domElement.removeEventListener('pointermove',move,true);};
  },[selectedRegion,canonical,command,proxy,gl,camera,gate,onMotionChange,size.width,size.height]);

  useFrame((_,delta)=>{
    const orbit=controls.current;if(!orbit)return;
    const dt=Math.min(delta,.05),status=motion.current;
    if(status.automatic){
      orbit.enabled=false; status.elapsed+=dt*1000;
      if(status.selection&&selectedRegion&&status.elapsed<220)return;
      const goal=zoomGoal.current??canonical;
      const position=goal.position.clone(),target=goal.target.clone();
      if(status.selection&&layout){
        const progress=1-Math.exp(-Math.max(0,status.elapsed-450)/240);
        const offset=layout.center.clone().sub(PRESENTATION).multiplyScalar(1-progress);
        position.add(offset);target.add(offset);
      }
      camera.position.lerp(position,1-Math.exp(-2.9*dt));
      lookAt.current.lerp(target,1-Math.exp(-2.8*dt));camera.lookAt(lookAt.current);
      const settledTerrain=Object.entries(layouts).every(([key,value])=>{
        const group=scene.getObjectByName(`region-${key.toLowerCase().replaceAll(' ','-')}`);
        const expected=key===selectedRegion?value.translation.clone().setY(.76):new THREE.Vector3();
        return !group||group.position.distanceTo(expected)<.02;
      });
      if(status.elapsed>700&&camera.position.distanceTo(goal.position)<.012&&lookAt.current.distanceTo(goal.target)<.012&&settledTerrain){
        const offset=goal.target.clone().sub(canonical.pivot);
        proxy.position.copy(camera.position).sub(offset);orbit.target.copy(canonical.pivot);
        proxy.lookAt(orbit.target);orbit.update();
        status.automatic=false;orbit.enabled=true;gate.current.locked=false;onMotionChange(false);
      }
    }else{
      orbit.update(dt);
      const distance=proxy.position.distanceTo(orbit.target);
      const right=new THREE.Vector3().setFromMatrixColumn(proxy.matrix,0).normalize();
      const shift=selectedRegion?distance*Math.tan(Math.PI/12)*(size.width/size.height)*.32:0;
      const offset=right.multiplyScalar(shift);
      camera.position.copy(proxy.position).add(offset);
      lookAt.current.copy(orbit.target).add(offset);camera.lookAt(lookAt.current);
    }
    // Readable browser diagnostics for regression checks, without exposing internal scene objects.
    gl.domElement.dataset.inspection=gate.current.locked?'locked':'ready';
    gl.domElement.dataset.cameraPosition=camera.position.toArray().map(n=>n.toFixed(3)).join(',');
    gl.domElement.dataset.orbitPivot=orbit.target.toArray().map(n=>n.toFixed(3)).join(',');
  });
  return null;
}
