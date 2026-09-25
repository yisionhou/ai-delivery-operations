import * as THREE from 'three';
import type {RegionCollection} from './singapore-scene';
export type SupportAnchor={x:number;z:number;tx:number;tz:number;nx:number;nz:number;phase:number};
export const SUPPORT_SITES=6,STRANDS_PER_SITE=2,SUPPORT_SEGMENTS=36,RESIDUAL_CAPACITY=192;
const hash=(x:number)=>{const v=Math.sin(x*127.1+311.7)*43758.5453;return v-Math.floor(v);};

// Anchor to the dominant connected polygon, never the bounding rectangle of distant islands.
export function supportAnchors(feature:RegionCollection['features'][number]):SupportAnchor[]{
  const polygons=(feature.geometry.type==='Polygon'?[feature.geometry.coordinates]:feature.geometry.coordinates) as [number,number][][][];
  const area=(r:[number,number][])=>Math.abs(r.reduce((a,p,i)=>{const q=r[(i+1)%r.length];return a+p[0]*q[1]-p[1]*q[0];},0));
  const main=polygons.reduce((a,b)=>area(a[0])>=area(b[0])?a:b);
  const ring=main[0].map(p=>({x:(p[0]-103.82)*70,z:-(p[1]-1.35)*70}));
  const minZ=Math.min(...ring.map(p=>p.z)),maxZ=Math.max(...ring.map(p=>p.z));
  const signed=ring.reduce((a,p,i)=>{const q=ring[(i+1)%ring.length];return a+p.x*q.z-p.z*q.x;},0);
  const edges=ring.slice(1).map((b,i)=>{const a=ring[i],len=Math.hypot(b.x-a.x,b.z-a.z),s=signed>=0?1:-1;return {a,b,len,tx:(b.x-a.x)/len,tz:(b.z-a.z)/len,nx:(b.z-a.z)/len*s,nz:-(b.x-a.x)/len*s};}).filter(e=>e.len>1e-7);
  const forward=edges.filter(e=>(e.a.z+e.b.z)*.5>minZ+(maxZ-minZ)*.5&&e.nz>-.35);
  const chosen=forward.length?forward:edges,total=chosen.reduce((n,e)=>n+e.len,0);
  return Array.from({length:SUPPORT_SITES},(_,i)=>{
    let d=total*(i+.4)/SUPPORT_SITES;let e=chosen[chosen.length-1];
    for(const candidate of chosen){e=candidate;if(d<=e.len)break;d-=e.len;}
    const t=Math.min(1,d/e.len);return {x:e.a.x+(e.b.x-e.a.x)*t,z:e.a.z+(e.b.z-e.a.z)*t,tx:e.tx,tz:e.tz,nx:e.nx,nz:e.nz,phase:hash(i+main[0].length)*Math.PI*2};
  });
}

// Stable strands deform in the local underside frame; no trajectory history or origin/destination bridge.
export function supportPoint(a:SupportAnchor,strand:number,u:number,time:number,out:THREE.Vector3){
  const p=a.phase+strand*2.19,len=1.05+hash(p+3)*1.25;
  const along=(u-.5)*len+.08*Math.sin(time*.43+p);
  const curl=Math.sin(u*Math.PI)*(.24+.12*Math.sin(time*.47+p))+.13*Math.sin(u*5.8+p-time*.56);
  const outward=.16+strand*.12+curl;
  return out.set(a.x+a.tx*along+a.nx*outward,-.14+.075*Math.sin(u*4.5+p+time*.52)+.04*Math.cos(u*7.3-p-time*.37),a.z+a.tz*along+a.nz*outward);
}

export type SupportBank={id:number;region:string;born:number;arrival:number|null;cancelled:boolean;matrix:THREE.Matrix4;anchors:SupportAnchor[];};
export class SupportState{
  time=0;serial=0;banks:SupportBank[]=[];current:SupportBank|null=null;
  begin(region:string,matrix:THREE.Matrix4,anchors:SupportAnchor[]){
    this.release(true);const b:SupportBank={id:++this.serial,region,born:this.time,arrival:null,cancelled:false,matrix:matrix.clone(),anchors};
    this.banks.push(b);if(this.banks.length>3)this.banks.shift();this.current=b;return b;
  }
  release(cancelled=false){if(this.current){this.current.arrival=this.time;this.current.cancelled=cancelled;this.current=null;}}
  tick(dt:number){this.time+=Math.max(0,dt);this.banks=this.banks.filter(b=>b.arrival===null||this.time-b.arrival<(b.cancelled?1.15:3.05));}
  opacity(b:SupportBank){const gather=Math.min(1,(this.time-b.born)/.26);const age=b.arrival===null?0:Math.max(0,this.time-b.arrival-(b.cancelled?0:.45));return gather*Math.pow(Math.max(0,1-age/(b.cancelled?1.15:2.6)),1.35);}
  phase(b:SupportBank){return b.arrival===null?'carry':this.time-b.arrival<.45&&!b.cancelled?'settle':'dissipate';}
}

export class SupportResiduals{
  positions=new Float32Array(RESIDUAL_CAPACITY*3);origins=new Float32Array(RESIDUAL_CAPACITY*3);velocities=new Float32Array(RESIDUAL_CAPACITY*3);
  alpha=new Float32Array(RESIDUAL_CAPACITY);ages=new Float32Array(RESIDUAL_CAPACITY).fill(10);life=new Float32Array(RESIDUAL_CAPACITY);cursor=0;active=0;
  spawn(at:THREE.Vector3,direction:THREE.Vector3){const n=this.cursor++,i=n%RESIDUAL_CAPACITY;at.toArray(this.origins,i*3);direction.clone().multiplyScalar(.045).toArray(this.velocities,i*3);this.ages[i]=0;this.life[i]=2.65+hash(n)*.7;}
  tick(dt:number){this.active=0;for(let i=0;i<RESIDUAL_CAPACITY;i++){const age=this.ages[i]+=dt,life=this.life[i];if(age>=life){this.alpha[i]=0;continue;}this.active++;const j=i*3,t=(1-Math.exp(-age*1.8))/1.8,p=i*1.17;this.positions[j]=this.origins[j]+this.velocities[j]*t+.018*Math.sin(age+p);this.positions[j+1]=this.origins[j+1]+age*.055;this.positions[j+2]=this.origins[j+2]+this.velocities[j+2]*t+.018*Math.cos(age+p);this.alpha[i]=.52*Math.min(1,age/.12)*Math.pow(1-age/life,1.2);}}
}
