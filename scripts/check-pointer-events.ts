import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createEvents, type ThreeEvent } from '@react-three/fiber';
import { createRegionHoverOwner, createRegionPointerHandlers } from '../app/region-interaction.ts';

const changes:Array<string|null>=[],selected:string[]=[];
const hover=createRegionHoverOwner<string>(key=>changes.push(key));
const gate={current:{locked:false,moved:false}};
const a=createRegionPointerHandlers('A',gate,hover,key=>selected.push(key));
const b=createRegionPointerHandlers('B',gate,hover,key=>selected.push(key));
const object=new THREE.Group();
let stops=0;
const event={eventObject:object,intersections:[],delta:0,type:'pointermove',stopPropagation(){stops++;}} as unknown as ThreeEvent<PointerEvent>;
a.onPointerOver(event);a.onPointerOver(event);b.onPointerOver(event);
a.onPointerOut(event); // A's delayed exit must not clear B.
assert.deepEqual(changes,['A','B']);
b.onPointerOut({...event,intersections:[{eventObject:object,object,distance:1,point:new THREE.Vector3()}]});
assert.deepEqual(changes,['A','B'],'same-region child crossing retains hover');
const enterStops=stops;
b.onPointerOut(event);b.onPointerOut(event);
assert.equal(stops,enterStops,'exit never calls stopPropagation, even with stored pointermove type');
assert.deepEqual(changes,['A','B',null]);
gate.current.moved=true;a.onClick(event);assert.equal(selected.length,0);
gate.current.moved=false;gate.current.locked=true;a.onClick(event);a.onPointerOver(event);
assert.equal(selected.length,0);assert.equal(changes.length,3);
gate.current.locked=false;a.onClick(event);a.onPointerOut(event);
assert.deepEqual(selected,['A'],'exit never deselects or resets');
a.onClick({...event,delta:6});assert.deepEqual(selected,['A']);

// Exercise the installed R3F event manager, not a reproduction of its internals.
// During locked motion many line-segment hits can accumulate in one RegionGroup.
function runR3F(legacyExit:boolean){
  const group=new THREE.Group(),line=new THREE.LineSegments();group.add(line);
  const camera=new THREE.PerspectiveCamera(),pointer=new THREE.Vector2();
  const locked={current:{locked:true,moved:false}};
  let exits=0;
  const handlers=createRegionPointerHandlers('REGION',locked,()=>{},()=>{});
  const wrapped={...handlers,onPointerOut(event:ThreeEvent<PointerEvent>){
    exits++;
    if(legacyExit)event.stopPropagation();else handlers.onPointerOut(event);
  }};
  let hits=Array.from({length:12000},(_,index)=>({object:line,index,distance:index+1,point:new THREE.Vector3()}));
  const raycaster={camera:camera as THREE.Camera|undefined,ray:new THREE.Ray(),intersectObject:()=>hits};
  const state={camera,pointer,raycaster,events:{enabled:true,priority:1,compute(){raycaster.camera=camera;}},
    internal:{interaction:[group],hovered:new Map(),capturedMap:new Map(),lastEvent:{current:null},initialClick:[0,0],initialHits:[]}};
  const store={getState:()=>state};
  Object.assign(group,{__r3f:{root:store,eventCount:3,handlers:wrapped}});
  Object.assign(line,{__r3f:{root:store,eventCount:0,handlers:{}}});
  const manager=createEvents(store as unknown as Parameters<typeof createEvents>[0]);
  const move=manager.handlePointer('onPointerMove');
  const pointerEvent={type:'pointermove',offsetX:0,offsetY:0,pointerId:1} as PointerEvent;
  move(pointerEvent);
  assert.equal(state.internal.hovered.size,12000);
  hits=[];locked.current.locked=false;
  move(pointerEvent);
  assert.equal(state.internal.hovered.size,0);
  assert.equal(exits,12000);
}
assert.throws(()=>runR3F(true),/Maximum call stack size exceeded/,'legacy exit reproduces overflow');
runR3F(false);
console.log('PASS: installed R3F legacy overflow reproduced; 12,000 safe exits; stale/duplicate/same-region hover; drag/lock/click guards.');
