import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { DustPool,DUST_CAPACITY } from '../app/dust-pool.ts';
import { boundarySampler,createEdgeFinish,terrainBoundary } from '../app/terrain-edge.ts';
import { createTerrainMaterial } from '../app/terrain-material.ts';
import { createArchitecture } from '../app/maquette-architecture.ts';

const geo=fs.readFileSync(new URL('../public/data/singapore-regions.geojson',import.meta.url));
assert.equal(createHash('sha256').update(geo).digest('hex'),'656a2f6587f41abfa1f4c43448fa34568ea544bdb145dd8e584d6a9a0d9812bd','validated geography unchanged');
const segments=[{a:new THREE.Vector3(),b:new THREE.Vector3(1,0,0),length:1,coast:true,outward:new THREE.Vector3(0,0,1)},
  {a:new THREE.Vector3(1,0,0),b:new THREE.Vector3(10,0,0),length:9,coast:false,outward:new THREE.Vector3(0,0,1)}];
const sample=boundarySampler(segments);
assert.equal(Array.from({length:1000},(_,i)=>sample((i+.5)/1000).segment).filter(s=>s===segments[0]).length,100,'length weighted, not vertex weighted');
const edge=createEdgeFinish(segments);
assert.equal(edge.geometry.getAttribute('position').count,12);
const y=edge.geometry.getAttribute('position');for(let i=0;i<y.count;i++)assert.ok(y.getY(i)<=.018001&&y.getY(i)>=-.009,'shallow rim ribbon, not a displaced landmass');
edge.geometry.dispose();edge.material.dispose();
const ring=terrainBoundary({type:'Feature',properties:{REGION_N:'CENTRAL REGION'},geometry:{type:'Polygon',coordinates:[[[0,0],[10,0],[10,10],[0,10],[0,0]],[[2,2],[2,4],[4,4],[4,2],[2,2]]]}},([x,z],clearance=0)=>new THREE.Vector3(x,.8+clearance,z));
for(const s of ring)assert.equal(s.a.y,.8,'array index must not leak into optional surface clearance');
assert.ok(ring[0].outward.z<0,'outer ring points outside land');
assert.ok(ring[4].outward.x>0,'hole edge points into water');
const materialA=createTerrainMaterial('CENTRAL REGION'),materialB=createTerrainMaterial('WEST REGION');
assert.notEqual(materialA,materialB);assert.notEqual(materialA.userData.shimmerStrength,materialB.userData.shimmerStrength);
materialA.userData.shimmerStrength.value=.04;assert.equal(materialB.userData.shimmerStrength.value,1);
materialA.dispose();materialB.dispose();

const pool=new DustPool(),positions=pool.positions;
const birth=()=>({x:10,y:1,z:20,dx:1,dz:0});
pool.start();for(let i=0;i<27;i++)pool.update(1/60,birth);
assert.ok(pool.emitted>0&&pool.emitted<144,'emission continues into approved extraction after 450ms');
for(let i=0;i<33;i++)pool.update(1/60,birth);
assert.equal(pool.emitted,144);assert.equal(pool.active,144);
const origins=pool.origins.slice();
for(let i=0;i<120;i++)pool.update(1/60,()=>({x:1000,y:100,z:2000,dx:1,dz:0}));
assert.deepEqual(pool.origins,origins,'released dust ignores subsequent emitter translation');
assert.ok(pool.active>0,'delicate tail still alive after 3s');
for(let i=0;i<DUST_CAPACITY;i++)if(pool.opacities[i]>0){
  assert.ok(Math.abs(pool.positions[i*3]-10)<.1,'stays close to birthplace');
  assert.ok(pool.opacities[i]<.3,'tail does not hold full brightness');
  assert.ok(pool.sizes[i]>=1&&pool.sizes[i]<=1.4);
}
for(let i=0;i<100;i++){pool.start();pool.update(.05,birth);assert.ok(pool.active<=DUST_CAPACITY);}
pool.stop();for(let i=0;i<220;i++)pool.update(1/60);
assert.equal(pool.active,0);assert.equal(pool.positions,positions,'pool buffer reused');

const expected={
  'CENTRAL REGION':[[102.79452514648438,.9710059762001038,.7447401285171509],[105.11603546142578,3.6088790893554688,2.0057990550994873]],
  'EAST REGION':[[102.87591552734375,.9710059762001038,.6354029178619385],[105.08808135986328,2.099839925765991,2.158094644546509]],
  'WEST REGION':[[102.92415618896484,.9717199802398682,.8205841183662415],[104.44184112548828,2.164252996444702,1.967454195022583]],
  'NORTH REGION':[[103.29362487792969,.9738619923591614,1.0761405229568481],[104.33808898925781,2.164252996444702,1.8046075105667114]],
  'NORTH-EAST REGION':[[103.36119842529297,.973147988319397,1.0437369346618652],[104.43080139160156,2.2335619926452637,1.815055012702942]],
};
for(const [region,bounds] of Object.entries(expected)){
  const box=new THREE.Box3();
  for(const {geometry} of createArchitecture(region,()=>true,([x,z])=>new THREE.Vector3(x,1,z))){geometry.computeBoundingBox();box.union(geometry.boundingBox!);geometry.dispose();}
  assert.deepEqual([box.min.toArray(),box.max.toArray()],bounds,`${region} approved envelope`);
}
console.log('PASS: geography SHA unchanged; physical rim; length sampling; independent 2.3–3.2s dust; bounded reusable pool; all five building envelopes unchanged.');
