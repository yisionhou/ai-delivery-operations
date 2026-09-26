import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {supportAnchors,supportPoint,SupportState,SupportResiduals,RESIDUAL_CAPACITY} from '../app/support-field.ts';
import {createSupportMist,MIST_CAPACITY,LOCAL_MIST_SITES} from '../app/support-mist.ts';

const geo=JSON.parse(readFileSync('public/data/singapore-regions.geojson','utf8'));
for(const feature of geo.features){
  const anchors=supportAnchors(feature);
  assert.equal(anchors.length,6);
  for(const a of anchors){
    assert.ok(Object.values(a).every(Number.isFinite));
    assert.ok(Math.abs(Math.hypot(a.tx,a.tz)-1)<1e-6);
    for(let u=0;u<=1;u+=.05){
      const p=supportPoint(a,0,u,1,new THREE.Vector3());
      const q=supportPoint(a,0,u,1.016,new THREE.Vector3());
      assert.ok(p.y<0,'strand stays beneath terrain base');
      assert.ok(Math.hypot(p.x-a.x,p.z-a.z)<1.6,'localized, not an origin-to-destination rail');
      assert.ok(p.distanceTo(q)<.005,'temporal continuity');
    }
  }
}
const anchors=supportAnchors(geo.features[0]),state=new SupportState(),matrix=new THREE.Matrix4();
const b=state.begin('A',matrix,anchors);matrix.makeTranslation(99,99,99);
assert.equal(b.matrix.elements[12],0,'bank owns copied transform');
state.tick(.3);assert.equal(state.opacity(b),1);state.release();
state.tick(.4);assert.equal(state.phase(b),'settle');assert.equal(state.opacity(b),1);
state.tick(1);assert.ok(state.opacity(b)>0&&state.opacity(b)<1);
state.tick(2);assert.equal(state.banks.length,0);
for(let i=0;i<20;i++){state.begin(String(i),matrix,anchors);assert.ok(state.banks.length<=3);}
state.release(true);state.tick(1.16);assert.equal(state.banks.length,0);
const dust=new SupportResiduals(),point=new THREE.Vector3(1,2,3);
dust.spawn(point,new THREE.Vector3(1,0,0));point.set(99,99,99);dust.tick(.3);
assert.equal(dust.origins[0],1);assert.ok(dust.positions[0]<1.1,'released dust not pulled by land');
for(let i=0;i<1000;i++)dust.spawn(point,new THREE.Vector3());dust.tick(.01);
assert.equal(dust.active,RESIDUAL_CAPACITY);dust.tick(3.4);assert.equal(dust.active,0);
const source=readFileSync('app/lift-dust.tsx','utf8');
assert.ok(!source.includes('WakeHistory'));assert.ok(source.includes('depthTest:true,depthWrite:false'));
assert.ok(source.includes('raycast={noDecorationRaycast}'));
assert.ok(!source.includes('levitation-support-currents'),'obsolete support-line renderer removed');
assert.ok(!source.includes('aTangent'),'no hidden line buffers/shader');
const mist=createSupportMist(),cloudState=new SupportState();
cloudState.begin('A',new THREE.Matrix4(),supportAnchors(geo.features[0],LOCAL_MIST_SITES));cloudState.tick(.3);mist.update(cloudState,true);
assert.equal(mist.geometry.instanceCount,180);assert.ok(mist.geometry.instanceCount<=MIST_CAPACITY);
const params=mist.geometry.getAttribute('aMist');
for(let i=0;i<180;i++){assert.ok(params.getX(i)>=2.25);assert.ok(params.getY(i)>=1.1);assert.ok(params.getZ(i)<.18);}
assert.ok([...mist.geometry.getAttribute('aCenter').array].every(Number.isFinite));
const gold=mist.material.uniforms.uGold.value as THREE.Color;
assert.ok(gold.r>gold.g&&gold.g>gold.b*2,'gold instead of white/grey');
assert.equal(mist.material.depthTest,true);assert.equal(mist.material.depthWrite,false);
mist.update(cloudState,false);assert.equal(mist.geometry.instanceCount,0);
cloudState.release();cloudState.tick(3.1);mist.update(cloudState,true);assert.equal(mist.geometry.instanceCount,0);
mist.dispose();
console.log('PASS: all five anchors, local scale, continuity, copied transforms, settle/fade/cancel, bounded resources, depth and picking');
