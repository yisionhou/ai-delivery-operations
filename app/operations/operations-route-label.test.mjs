import test from 'node:test';
import assert from 'node:assert/strict';
import {roadAlignmentLabel} from './operations-route-label.ts';

const routes=[{id:'road',roadAligned:true},{id:'legacy',roadAligned:false}];

test('mixed routes are labeled separately when a route is selected',()=>{
  assert.equal(roadAlignmentLabel(routes,null),'MIXED ROAD ALIGNMENT · SELECT A ROUTE');
  assert.equal(roadAlignmentLabel(routes,'road'),'ROAD-ALIGNED ROUTE · OSRM');
  assert.equal(roadAlignmentLabel(routes,'legacy'),'UNVERIFIED ROUTE · NOT ROAD-ALIGNED');
});

test('uniform sources get a group label',()=>{
  assert.equal(roadAlignmentLabel([{id:'road',roadAligned:true}],null),'ROAD-ALIGNED ROUTES · OSRM');
  assert.equal(roadAlignmentLabel([{id:'legacy',roadAligned:false}],null),'UNVERIFIED ROUTES · NOT ROAD-ALIGNED');
});
