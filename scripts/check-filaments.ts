import assert from 'node:assert/strict';
import * as THREE from 'three';
import {FilamentPool,FILAMENT_CAPACITY} from '../app/filament-pool.ts';
import {createEdgeAccents,createEdgeFinish,type BoundarySegment} from '../app/terrain-edge.ts';

const pool=new FilamentPool(),buffer=pool.positions;
const birth={x:2,y:1,z:3,dx:1,dz:0};
for(let i=0;i<12;i++)pool.spawn(birth);
pool.update(.6);
assert.equal(pool.active,12);
assert.ok(pool.opacities.some(v=>v>.1),'perceptible middle of tapered short strands');
const origins=pool.origins.slice();birth.x=999;pool.update(.1);
assert.deepEqual(pool.origins,origins,'world birthplaces do not track changed emitter');
for(let i=0;i<pool.positions.length/3;i++)if(pool.opacities[i]>0){
  assert.ok(Math.abs(pool.positions[i*3]-2)<.9,'not a cinematic long ribbon');
  assert.ok(Math.abs(pool.positions[i*3+2]-3)<.2,'gentle narrow curve');
  assert.ok(pool.positions[i*3+1]>1&&pool.positions[i*3+1]<1.3,'slow suspended upward arc');
}
pool.update(2.1);assert.ok(pool.active>0,'tail remains after solid block settlement');
pool.update(1);assert.equal(pool.active,0);assert.ok(pool.opacities.every(v=>v===0));
for(let i=0;i<100;i++)pool.spawn({x:0,y:1,z:0,dx:0,dz:1});
pool.update(.1);assert.equal(pool.active,FILAMENT_CAPACITY);assert.equal(pool.positions,buffer);
pool.update(4);assert.equal(pool.active,0);

const segments:BoundarySegment[]=[{a:new THREE.Vector3(0,1,0),b:new THREE.Vector3(30,1,0),length:30,coast:true,outward:new THREE.Vector3(0,0,1)}];
const edge=createEdgeFinish(segments),a=createEdgeAccents(segments,edge),b=createEdgeAccents(segments,edge);
assert.deepEqual(a.geometry.getAttribute('position').array,b.geometry.getAttribute('position').array,'fixed seed, no blinking regeneration');
const points=a.geometry.getAttribute('position');assert.ok(points.count>30&&points.count<190,'clusters have dark gaps');
for(let i=0;i<points.count;i++)assert.ok(Math.abs(points.getZ(i))<.05&&Math.abs(points.getY(i)-1.026)<1e-5,'points stay at real rim');
assert.equal(a.material.depthTest,true);assert.equal(a.material.depthWrite,false);
for(const item of [a,b,edge]){item.geometry.dispose();item.material.dispose();}
console.log('PASS: short curved filaments, independent world space, gradual expiry, fixed pools; deterministic non-continuous edge clusters.');
