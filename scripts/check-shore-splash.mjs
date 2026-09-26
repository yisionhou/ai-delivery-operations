import assert from 'node:assert/strict';
import fs from 'node:fs';
import clipping from 'polygon-clipping';
import * as THREE from 'three';
import {coastalTransition,bakeShelf} from '../preview/sea/coastal-transition.ts';
import {createShoreSplash,splashSites,SplashContactState,splashParticle,SPLASH_LIMITS} from '../preview/sea/shore-splash.ts';
import {waterHeight,washHeight} from '../preview/sea/shore-wash.ts';

const geo=JSON.parse(fs.readFileSync('public/data/singapore-regions.geojson','utf8'));
const coast=JSON.parse(fs.readFileSync('public/data/singapore-coastlines.json','utf8'));
const west=geo.features.find(f=>f.properties.REGION_N==='WEST REGION'),local=([x,y])=>[(x-103.73)*70,-(y-1.267)*70];
const [w,s,e,n]=[103.65,1.202,103.80,1.327];
const polygons=clipping.intersection(west.geometry.coordinates,[[[w,s],[e,s],[e,n],[w,n],[w,s]]]);
const segments=coast['WEST REGION'].filter(r=>r.length===2&&r.every(p=>p[0]>=w&&p[0]<=e&&p[1]>=s&&p[1]<=n)).map(r=>r.map(local));
const model=coastalTransition(segments,polygons.map(p=>p[0].map(local)));
// DOM-free test mask: actual rasterized shelf, exact nearest-coast distance.
// The browser uses a raster distance transform, so this is not a GPU playback test.
const size=512,depth=bakeShelf(model.geometry,size,[48,38]),bytes=new Uint8Array(size*size*4);
for(let i=0;i<depth.length;i++){
 const x=((i%size+.5)/size-.5)*48,z=((Math.floor(i/size)+.5)/size-.5)*38;
 let distance=2;
 if(depth[i]>-.5){for(const [a,b] of model.segments){const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));distance=Math.min(distance,Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz));}}
 bytes[i*4+1]=Math.round(Math.min(1,distance/2)*255);bytes[i*4+2]=Math.round((depth[i]+1)*.5*255);bytes[i*4+3]=255;
}
const mask=new THREE.DataTexture(bytes,size,size,THREE.RGBAFormat),sites=splashSites(model.geometry,mask);
assert(sites.length>=3&&sites.length<=SPLASH_LIMITS.sites,'sparse real-slope contact sites');
for(const site of sites){assert(Math.abs(site.y+.085)<1e-7);assert(site.distance>.05&&site.distance<.95);}
const state=new SplashContactState(sites),events=[];
for(let frame=0;frame<180*60;frame++){
 const t=frame/60,old=state.emitted;state.update(t,3,0);
 if(state.emitted>old){
  const event={...state.event},site=sites[event.site],before=waterHeight(site.x,site.z,site.distance,site.bed,t-1/60),now=waterHeight(site.x,site.z,site.distance,site.bed,t);
  assert(before<site.y&&now>=site.y);assert(washHeight(site.x,site.z,site.distance,t)>.004);
  if(events.length)assert(t-events.at(-1).born>=SPLASH_LIMITS.gap);
  events.push(event);
 }
}
assert(events.length>=3&&events.length<60,'occasional contacts rather than continuous emission');
assert(new Set(events.map(e=>e.site)).size>1,'not a single synchronized contact source');
for(const event of events)for(let j=0;j<8;j++)for(let age=0;age<=.80;age+=.02){
 const site=sites[event.site],p=splashParticle(event,site,j,age);if(!p)continue;
 assert(Object.values(p).every(v=>typeof v!=='number'||Number.isFinite(v)));
 assert(p.y-site.y<SPLASH_LIMITS.maxHeight);assert(p.opacity<=.23);assert(Math.hypot(p.x-site.x,p.z-site.z)<.14);
}
for(let j=0;j<8;j++)assert.equal(splashParticle(events[0],sites[events[0].site],j,.8),null);
for(const [mode,lift,enabled] of [[1,0,true],[2,0,true],[3,.05,true],[3,0,false]]){
 state.reset();for(let i=0;i<1200;i++)state.update(i/60,mode,lift,enabled);assert.equal(state.emitted,0);assert.equal(state.event,null);
}
state.reset();state.update(0,3,0);state.update(20,3,0);assert.equal(state.emitted,0,'no resume catch-up explosion');
const renderer=createShoreSplash(model.geometry,mask);
assert.equal(renderer.points.material.depthTest,true);assert.equal(renderer.points.material.depthWrite,false);assert.equal(renderer.points.material.blending,THREE.NormalBlending);
const intersections=[];renderer.points.raycast({},intersections);assert.equal(intersections.length,0);
for(let i=0;i<6000;i++)renderer.update(i/60,3,0,754,30,1);
assert.equal(renderer.points.geometry.getAttribute('position').count,8,'fixed resource capacity');
renderer.update(0,3,0,754,30,1);assert.equal(renderer.points.geometry.drawRange.count,0,'reset removes stale particles');
renderer.dispose();model.geometry.dispose();mask.dispose();
console.log(JSON.stringify({result:'PASS',contactSites:sites.length,eventsIn180Seconds:events.length,distinctSites:new Set(events.map(e=>e.site)).size,maxParticles:8,tests:['real-slope rising contact','spacing','brief bounded spray','no foam/lines','lift/mode/off suppression','reset/resume','non-pickable','fixed GPU resources']}));
