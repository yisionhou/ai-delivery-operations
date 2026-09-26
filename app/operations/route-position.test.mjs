import assert from 'node:assert/strict';
import {test} from 'node:test';
import roads from './operations-road-routes.json' with {type:'json'};
import {pointAlongRoute} from './route-position.ts';

test('vehicle progress follows travelled distance along the road path',()=>{
  const path=[[0,0],[1,0],[1,3]];
  assert.deepEqual(pointAlongRoute(path,0),[0,0]);
  assert.deepEqual(pointAlongRoute(path,.5),[1,1]);
  assert.deepEqual(pointAlongRoute(path,1),[1,3]);
});

test('demo route geometry passes through every snapped stop in order',()=>{
  for(const [id,route] of Object.entries(roads.routes)){
    assert.ok(route.path.length>100,`${id} has road detail`);
    assert.deepEqual(route.path[0],route.waypoints[0]);
    assert.deepEqual(route.path[route.firstDeliveryPathIndex],route.waypoints[1]);
    assert.deepEqual(route.path.at(-1),route.waypoints.at(-1));
    let index=0;
    for(const waypoint of route.waypoints){
      index=route.path.findIndex((point,at)=>at>=index&&point[0]===waypoint[0]&&point[1]===waypoint[1]);
      assert.ok(index>=0,`${id} visits each stop`);
    }
  }
});
