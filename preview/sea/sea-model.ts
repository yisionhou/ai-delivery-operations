import * as THREE from 'three';
import clipping from 'polygon-clipping';
import {coastalTransition,bakeShelf} from './coastal-transition';
export type P=[number,number];
export type Feature={properties:{REGION_N:string;COASTLINES?:P[][]};geometry:{type:string;coordinates:P[][][]}};
export const EXTENT=[48,38] as const;
export const SEA_LEVEL=-.10;
export const location=(p:P):P=>[(p[0]-103.73)*70,-(p[1]-1.267)*70];
export const coastBounds=[103.65,1.202,103.80,1.327];
export function buildCoast(features:Feature[]){
  const [w,s,e,n]=coastBounds;
  const box:P[][]=[[[w,s],[e,s],[e,n],[w,n],[w,s]]];
  const west=features.find(f=>f.properties.REGION_N==='WEST REGION')!;
  const polygons=clipping.intersection(west.geometry.coordinates,box);
  const shapes=polygons.map(poly=>{
    const shape=new THREE.Shape(poly[0].map(p=>{const [x,z]=location(p);return new THREE.Vector2(x,-z);}));
    shape.holes=poly.slice(1).map(r=>new THREE.Path(r.map(p=>{const [x,z]=location(p);return new THREE.Vector2(x,-z);})));return shape;
  });
  const geometry=new THREE.ExtrudeGeometry(shapes,{depth:.72,bevelEnabled:false,steps:1,curveSegments:1});
  geometry.rotateX(-Math.PI/2);geometry.translate(0,-.2,0);
  const segs=(west.properties.COASTLINES??[]).filter(r=>r.length===2&&r.every(p=>p[0]>=w&&p[0]<=e&&p[1]>=s&&p[1]<=n)).map(r=>r.map(location));
  const transition=coastalTransition(segs,polygons.map(poly=>poly[0].map(location)));
  const size=1024,canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  const ctx=canvas.getContext('2d')!;
  const pixel=([x,z]:P):P=>[(x/EXTENT[0]+.5)*size,(z/EXTENT[1]+.5)*size];
  ctx.fillStyle='black';ctx.fillRect(0,0,size,size);ctx.fillStyle='white';
  // Reserve internal holes for a future water pass; sea cannot fill them or a lifted footprint.
  for(const poly of polygons){ctx.beginPath();poly[0].forEach((p,i)=>{const q=pixel(location(p));if(i)ctx.lineTo(...q);else ctx.moveTo(...q);});ctx.closePath();ctx.fill();}
  const land=ctx.getImageData(0,0,size,size).data;
  ctx.fillStyle='black';ctx.fillRect(0,0,size,size);ctx.strokeStyle='white';ctx.lineWidth=1.6;
  for(const [a,b] of transition.segments){ctx.beginPath();ctx.moveTo(...pixel(a));ctx.lineTo(...pixel(b));ctx.stroke();}
  const coast=ctx.getImageData(0,0,size,size).data,dist=new Float32Array(size*size).fill(999);
  for(let i=0;i<dist.length;i++)if(coast[i*4]>32)dist[i]=0;
  const dx=EXTENT[0]/size,dz=EXTENT[1]/size,diag=Math.hypot(dx,dz);
  for(let y=1;y<size;y++)for(let x=1;x<size-1;x++){const i=y*size+x;dist[i]=Math.min(dist[i],dist[i-1]+dx,dist[i-size]+dz,dist[i-size-1]+diag,dist[i-size+1]+diag);}
  for(let y=size-2;y>=0;y--)for(let x=size-2;x>0;x--){const i=y*size+x;dist[i]=Math.min(dist[i],dist[i+1]+dx,dist[i+size]+dz,dist[i+size+1]+diag,dist[i+size-1]+diag);}
  const shelf=bakeShelf(transition.geometry,size,EXTENT),data=new Uint8Array(size*size*4);
  for(let i=0;i<dist.length;i++){data[i*4]=land[i*4];data[i*4+1]=Math.min(255,Math.round(dist[i]/2*255));data[i*4+2]=Math.round((shelf[i]+1)*.5*255);data[i*4+3]=255;}
  const mask=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);mask.minFilter=mask.magFilter=THREE.LinearFilter;mask.needsUpdate=true;
  return {geometry,apron:transition.geometry,mask,polygons:polygons.length,segments:transition.stats.marineSegments};
}
