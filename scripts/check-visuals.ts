import assert from 'node:assert/strict';
import * as THREE from 'three';
import { architecturalScale, createArchitecture } from '../app/maquette-architecture.ts';
import { createTerrainMaterial } from '../app/terrain-material.ts';

// User-approved proportions must not regress into category-wide reductions.
assert.deepEqual(architecturalScale().toArray(),[.73,1.02,.73]);
let vertices=0;
for(const region of ['CENTRAL REGION','EAST REGION','WEST REGION','NORTH REGION','NORTH-EAST REGION']){
  const batches=createArchitecture(region,()=>true,([x,z])=>new THREE.Vector3(x,1,z));
  assert.ok(batches.length>0&&batches.length<=7);
  for(const {geometry} of batches){
    const positions=geometry.getAttribute('position');
    assert.ok([...positions.array].every(Number.isFinite),`${region}: finite geometry`);
    vertices+=positions.count;
    geometry.dispose();
  }
  const terrain=createTerrainMaterial(region);
  assert.ok(terrain.color.r>=terrain.color.b,'Terrain has no blue cast');
  assert.equal(terrain.userData.shimmerStrength.value,1);
  terrain.dispose();
}
console.log(JSON.stringify({architectureScale:architecturalScale().toArray(),regions:5,vertices,passed:true}));
