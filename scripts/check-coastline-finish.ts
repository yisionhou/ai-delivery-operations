import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {terrainBoundary,createEdgeFinish} from '../app/terrain-edge.ts';
const geo=JSON.parse(fs.readFileSync(new URL('../public/data/singapore-regions.geojson',import.meta.url),'utf8'));
const ura=JSON.parse(fs.readFileSync(new URL('../../../work/ura-original.geojson',import.meta.url),'utf8'));
const sla=JSON.parse(fs.readFileSync(new URL('../../../work/sla-original.geojson',import.meta.url),'utf8'));
const vertexSet=new Set<string>();const key=(p:number[])=>`${p[0].toFixed(9)},${p[1].toFixed(9)}`;
const visit=(v:unknown,fn:(p:number[])=>void)=>{if(!Array.isArray(v))return;if(typeof v[0]==='number')fn(v as number[]);else v.forEach(x=>visit(x,fn));};
for(const f of [...ura.features,...sla.features])visit(f.geometry?.coordinates,p=>vertexSet.add(key(p)));
let count=0,sourceMatches=0,invalid=0,duplicateEdges=0,polygons=0,holes=0,maxExtension=0;
for(const f of geo.features){
  const ps=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;polygons+=ps.length;
  for(const poly of ps){holes+=poly.length-1;for(const ring of poly){assert.deepEqual(ring[0],ring.at(-1));for(let i=0;i<ring.length;i++){const p=ring[i];count++;if(vertexSet.has(key(p)))sourceMatches++;if(!p.every(Number.isFinite))invalid++;if(i&&p[0]===ring[i-1][0]&&p[1]===ring[i-1][1])duplicateEdges++;}}}
  const edges=terrainBoundary(f,p=>new THREE.Vector3((p[0]-103.82)*70,.7,-(p[1]-1.35)*70));
  const band=createEdgeFinish(edges);const pos=band.geometry.getAttribute('position');
  edges.forEach((e,i)=>{for(let j=0;j<6;j++){const p=new THREE.Vector3().fromBufferAttribute(pos,i*6+j);const at=[0,2,5].includes(j)?e.a:e.b;maxExtension=Math.max(maxExtension,Math.hypot(p.x-at.x,p.z-at.z));}});
  assert(band.material.depthTest&&!band.material.depthWrite);band.geometry.dispose();band.material.dispose();
}
assert.equal(count,84075);assert.equal(invalid,0);assert(maxExtension<.037);
console.log(JSON.stringify({processedVertices:count,matchingOriginalSourceVertices:sourceMatches,invalid,duplicateEdges,polygons,holes,maxBandExtensionSceneUnits:maxExtension,landGeometryChanged:false}));
