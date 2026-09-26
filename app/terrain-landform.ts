import * as THREE from 'three';
import type {RegionCollection} from './singapore-scene';
import coastField from '../public/data/terrain-coast-distance.json' with {type:'json'};
export type Foundation={x:number;z:number;halfX:number;halfZ:number;angle:number};
export const BASE_DEPTH=.66;
const smooth=(a:number,b:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
type Segment={ax:number;az:number;bx:number;bz:number};
// Geographically anchored artistic relief, NOT a measured DEM. NParks' central
// low hills guide macro form. Exact SLA/URA water holes remain in the mesh.
export function createLandform(geo:RegionCollection,foundations:Foundation[]=[]){
  const grid=new Map<string,Segment[]>(),reach=1.35;
  for(const feature of geo.features)for(const [a,b] of feature.properties.COASTLINES??[]){
    const e={ax:(a[0]-103.82)*70,az:-(a[1]-1.35)*70,bx:(b[0]-103.82)*70,bz:-(b[1]-1.35)*70};
    for(let x=Math.floor(Math.min(e.ax,e.bx)-reach);x<=Math.floor(Math.max(e.ax,e.bx)+reach);x++)
      for(let z=Math.floor(Math.min(e.az,e.bz)-reach);z<=Math.floor(Math.max(e.az,e.bz)+reach);z++){
        const key=`${x}:${z}`,bucket=grid.get(key)??[];bucket.push(e);grid.set(key,bucket);
      }
  }
  const shoreDistance=(x:number,z:number)=>{
    let distance=reach;
    for(const e of grid.get(`${Math.floor(x)}:${Math.floor(z)}`)??[]){
      const dx=e.bx-e.ax,dz=e.bz-e.az,d=dx*dx+dz*dz;
      const t=d?Math.max(0,Math.min(1,((x-e.ax)*dx+(z-e.az)*dz)/d)):0;
      distance=Math.min(distance,Math.hypot(x-e.ax-dx*t,z-e.az-dz*t));
    }return distance;
  };
  const hill=(x:number,z:number,lon:number,lat:number,sx:number,sz:number)=>Math.exp(-((x-(lon-103.82)*70)**2/sx**2+(z+(lat-1.35)*70)**2/sz**2));
  const seaDistance=(x:number,z:number)=>{
    const fx=Math.max(0,Math.min(coastField.width-1.001,(x-coastField.x0)/coastField.step)),fz=Math.max(0,Math.min(coastField.height-1.001,(z-coastField.z0)/coastField.step));
    const i=Math.floor(fx),j=Math.floor(fz),u=fx-i,v=fz-j,at=(a:number,b:number)=>coastField.values[b*coastField.width+a]/1000;
    return (at(i,j)*(1-u)+at(i+1,j)*u)*(1-v)+(at(i,j+1)*(1-u)+at(i+1,j+1)*u)*v;
  };
  const heightCache=new Map<string,number>();
  const rawHeight=(x:number,z:number)=>{
    const key=`${x.toFixed(4)}:${z.toFixed(4)}`,cached=heightCache.get(key);if(cached!==undefined)return cached;
    const coast=smooth(.035,reach,seaDistance(x,z)),water=smooth(0,.24,shoreDistance(x,z)),plain=1-.72*smooth(6,12,x);
    // Broad, connected low ridges, vertically exaggerated for the fixed overview
    // camera. This changes actual geometry, not the camera, lighting or buildings.
    const macro=.86*hill(x,z,103.776,1.354,1.5,1.12)+.48*hill(x,z,103.806,1.374,2.8,2.25)
      +.28*hill(x,z,103.755,1.37,1.9,1.4)+.20*hill(x,z,103.795,1.284,2.1,.85);
    const folds=.045*Math.sin(x*.85+z*.30)*Math.cos(z*.96-x*.18)+.009*Math.sin(x*2.72-z*.8)*Math.cos(z*2.3+x*.5);
    const result=.018+coast*(.21+(macro+folds*water)*plain);heightCache.set(key,result);return result;
  };
  const pads=foundations.map(p=>({...p,height:rawHeight(p.x,p.z),cos:Math.cos(p.angle),sin:Math.sin(p.angle)}));
  const height=(x:number,z:number)=>{
    let result=rawHeight(x,z),sum=0,weight=0;
    for(const p of pads){
      const dx=x-p.x,dz=z-p.z,u=Math.abs(dx*p.cos-dz*p.sin),v=Math.abs(dx*p.sin+dz*p.cos);
      const w=1-smooth(0,.32,Math.max(u-p.halfX,v-p.halfZ,0));if(!w)continue;
      sum+=p.height*w;weight+=w;
    }
    if(weight)result=THREE.MathUtils.lerp(result,sum/weight,Math.min(1,weight));
    return result;
  };
  const surface=(p:[number,number],clearance=0)=>{const x=(p[0]-103.82)*70,z=-(p[1]-1.35)*70;return new THREE.Vector3(x,BASE_DEPTH+height(x,z)+clearance,z);};
  return {height,rawHeight,shoreDistance,seaDistance,surface,pads};
}
export type Landform=ReturnType<typeof createLandform>;
