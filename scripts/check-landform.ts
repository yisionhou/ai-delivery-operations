import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createLandform} from '../app/terrain-landform.ts';
import {architectureFoundations,createArchitecture} from '../app/maquette-architecture.ts';
import {containsLand} from '../app/geographic-constraints.ts';
import type {RegionCollection} from '../app/singapore-scene';
const geo=JSON.parse(readFileSync('public/data/singapore-regions.geojson','utf8')) as RegionCollection;
const coasts=JSON.parse(readFileSync('public/data/singapore-coastlines.json','utf8'));
for(const f of geo.features)f.properties.COASTLINES=coasts[f.properties.REGION_N];
const untouched=JSON.stringify(geo),foundations=geo.features.flatMap(f=>architectureFoundations(f.properties.REGION_N,p=>containsLand(p,f)));
const start=performance.now(),terrain=createLandform(geo,foundations);
let min=Infinity,max=-Infinity,samples=0;
for(let x=-15;x<18;x+=.18)for(let z=-10;z<13;z+=.18){const h=terrain.height(x,z);assert(Number.isFinite(h));min=Math.min(min,h);max=Math.max(max,h);samples++;}
assert(min>=0&&max<1.6);assert(max>1,'overview-readable geometric relief, not the former 0.53-unit field');
const hill=terrain.rawHeight((103.776-103.82)*70,-(1.354-1.35)*70);
const airport=terrain.rawHeight((103.99-103.82)*70,-(1.35-1.35)*70);assert(hill>airport+.7);
let maxCoast=0;
for(const f of geo.features)for(const [a] of (f.properties.COASTLINES??[]).filter((_,i)=>i%29===0)){
  const x=(a[0]-103.82)*70,z=-(a[1]-1.35)*70;
  if(terrain.seaDistance(x,z)<.045)maxCoast=Math.max(maxCoast,terrain.rawHeight(x,z));
}
assert(maxCoast<.019,'marine coastline stays low; inland reservoirs retain their geographic elevations');
let vertices=0,groundSpread=0;
for(const p of terrain.pads){for(const u of [-1,0,1])for(const v of [-1,0,1]){
 const dx=u*p.halfX,dz=v*p.halfZ;
 groundSpread=Math.max(groundSpread,Math.abs(terrain.height(p.x+dx*p.cos+dz*p.sin,p.z-dx*p.sin+dz*p.cos)-terrain.height(p.x,p.z)));
}}
for(const f of geo.features){
 const valid=(p:[number,number])=>containsLand(p,f);
 const flat=createArchitecture(f.properties.REGION_N,valid,p=>new THREE.Vector3((p[0]-103.82)*70,.7,-(p[1]-1.35)*70));
 const grounded=createArchitecture(f.properties.REGION_N,valid,terrain.surface);
 for(let b=0;b<flat.length;b++){
  const a=flat[b].geometry.getAttribute('position'),c=grounded[b].geometry.getAttribute('position');assert.equal(a.count,c.count);
  for(let i=0;i<a.count;i++){assert.equal(a.getX(i),c.getX(i));assert.equal(a.getZ(i),c.getZ(i));assert(Number.isFinite(c.getY(i)));vertices++;}
  flat[b].geometry.dispose();grounded[b].geometry.dispose();
 }
}
assert.equal(JSON.stringify(geo),untouched,'geography and water geometry are not mutated');
assert(groundSpread<.09,'graded building footprints avoid new large height penetration');
console.log(JSON.stringify({samples,min,max,hill,airport,maxCoast,foundations:foundations.length,groundSpread,unchangedArchitectureXZVertices:vertices,elapsedMs:Math.round(performance.now()-start)}));
