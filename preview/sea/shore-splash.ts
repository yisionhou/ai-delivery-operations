import * as THREE from 'three';
import {washHeight,washLocality,waterHeight} from './shore-wash.ts';

export type ContactSite={x:number;y:number;z:number;nx:number;nz:number;distance:number;bed:number};
export const SPLASH_LIMITS={sites:10,particles:8,gap:2.2,maxLife:.78,maxHeight:.06};
// Same bilinear texel coordinates as the water's clamp-to-edge depth texture.
export function maskSample(mask:THREE.DataTexture,x:number,z:number,channel:number){
 const {width,height,data}=mask.image;
 if(!data)throw new Error('Shore contact requires a populated depth texture');
 const u=(x/48+.5)*width-.5,v=(z/38+.5)*height-.5,x0=Math.floor(u),z0=Math.floor(v),fx=u-x0,fz=v-z0;
 const at=(px:number,pz:number)=>Number(data[(Math.max(0,Math.min(height-1,pz))*width+Math.max(0,Math.min(width-1,px)))*4+channel])/255;
 return (at(x0,z0)*(1-fx)+at(x0+1,z0)*fx)*(1-fz)+(at(x0,z0+1)*(1-fx)+at(x0+1,z0+1)*fx)*fz;
}
const hash=(n:number)=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
export function splashSites(apron:THREE.BufferGeometry,mask:THREE.DataTexture){
 const p=apron.getAttribute('position'),normal=apron.getAttribute('normal'),index=apron.index!,candidates:ContactSite[]=[];
 const contactY=-.085;
 for(let i=0;i<index.count;i+=3){
  const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)],hits:THREE.Vector3[]=[];
  for(let j=0;j<3;j++){const a=ids[j],b=ids[(j+1)%3],ay=p.getY(a),by=p.getY(b);
   if((ay<contactY)===(by<contactY))continue;
   const t=(contactY-ay)/(by-ay);hits.push(new THREE.Vector3().fromBufferAttribute(p,a).lerp(new THREE.Vector3().fromBufferAttribute(p,b),t));
  }
  if(hits.length!==2)continue;
  const mid=hits[0].add(hits[1]).multiplyScalar(.5),distance=maskSample(mask,mid.x,mid.z,1)*2,bed=maskSample(mask,mid.x,mid.z,2)*2-1;
  if(distance<.05||distance>.95||maskSample(mask,mid.x,mid.z,0)>.04||Math.abs(bed-contactY)>.045||washLocality(mid.x,mid.z)<.35)continue;
  const n=new THREE.Vector3();for(const id of ids)n.add(new THREE.Vector3().fromBufferAttribute(normal,id));
  const length=Math.hypot(n.x,n.z);if(length<.1)continue;
  candidates.push({x:mid.x,y:contactY,z:mid.z,nx:n.x/length,nz:n.z/length,distance,bed});
 }
 // Stable sparse sites, not a resampled ring or particles on administrative seams.
 candidates.sort((a,b)=>hash(a.x*13+a.z*7)-hash(b.x*13+b.z*7));
 const selected:ContactSite[]=[];
 for(const c of candidates){if(selected.every(s=>Math.hypot(s.x-c.x,s.z-c.z)>.85))selected.push(c);if(selected.length===SPLASH_LIMITS.sites)break;}
 return selected;
}
export type SplashEvent={site:number;born:number;seed:number};
export class SplashContactState{
 event:SplashEvent|null=null;
 lastTime=-1;
 nextGlobal=0;
 nextSite:number[];
 emitted=0;
 readonly sites:ContactSite[];
 constructor(sites:ContactSite[]){this.sites=sites;this.nextSite=sites.map(()=>0);}
 reset(){this.event=null;this.lastTime=-1;this.nextGlobal=0;this.nextSite.fill(0);this.emitted=0;}
 update(time:number,mode:number,lift:number,enabled=true){
  if(time<this.lastTime)this.reset();
  const dt=time-this.lastTime,previous=this.lastTime;this.lastTime=time;
  if(!enabled||mode!==3||lift>.015){this.event=null;return;}
  if(this.event&&time-this.event.born>SPLASH_LIMITS.maxLife)this.event=null;
  // Never catch up with particle bursts after a paused/background browser frame.
  if(previous<0||dt<=0||dt>.15||time<this.nextGlobal||this.event)return;
  for(let i=0;i<this.sites.length;i++){
   if(time<this.nextSite[i])continue;const s=this.sites[i];
   const before=waterHeight(s.x,s.z,s.distance,s.bed,previous),now=waterHeight(s.x,s.z,s.distance,s.bed,time);
   const wash=washHeight(s.x,s.z,s.distance,time),oldWash=washHeight(s.x,s.z,s.distance,previous);
   // Require rising water crossing the REAL slope, plus an incoming local wash.
   if(before<s.y&&now>=s.y&&(now-before)/dt>.006&&wash>.004&&wash>oldWash){
    const seed=hash(i*31+this.emitted*17);this.event={site:i,born:time,seed};this.emitted++;
    this.nextGlobal=time+SPLASH_LIMITS.gap+seed*1.6;this.nextSite[i]=time+8+seed*6;break;
   }
  }
 }
}
export function splashParticle(event:SplashEvent,site:ContactSite,i:number,age:number){
 const mist=i>=6,r=hash(event.seed*100+i*9),r2=hash(event.seed*71+i*23);
 const life=mist?.60+r*.18:.40+r*.24,u=age/life;
 if(u<0||u>=1)return null;
 const tangent=(r2-.5)*.10,travel=.018+age*(.025+r*.04);
 const rise=mist?Math.sin(Math.PI*u)*.025:Math.max(0,(.16+r*.06)*age-.5*.75*age*age);
 return {x:site.x+site.nx*travel-site.nz*tangent,z:site.z+site.nz*travel+site.nx*tangent,y:site.y+.008+rise,
  size:mist?.06+u*.035:.011+r*.006,opacity:(mist?.055:.23)*Math.min(1,u/.12)*(1-u)**2,mist};
}
export function createShoreSplash(apron:THREE.BufferGeometry,mask:THREE.DataTexture){
 const state=new SplashContactState(splashSites(apron,mask)),geometry=new THREE.BufferGeometry();
 const position=new THREE.Float32BufferAttribute(new Float32Array(24),3),size=new THREE.Float32BufferAttribute(new Float32Array(8),1),opacity=new THREE.Float32BufferAttribute(new Float32Array(8),1);
 geometry.setAttribute('position',position);geometry.setAttribute('aSize',size);geometry.setAttribute('aOpacity',opacity);
 const material=new THREE.ShaderMaterial({transparent:true,depthTest:true,depthWrite:false,blending:THREE.NormalBlending,
  uniforms:{uScale:{value:600},uPixelRatio:{value:1}},
  vertexShader:`attribute float aSize;attribute float aOpacity;uniform float uScale;uniform float uPixelRatio;varying float vOpacity;
  void main(){vOpacity=aOpacity;vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=clamp(aSize*uScale/max(.1,-p.z),.5,7.*uPixelRatio);}`,
  fragmentShader:`varying float vOpacity;void main(){float r=length(gl_PointCoord-.5)*2.;float soft=exp(-r*r*4.)*(1.-smoothstep(.65,1.,r));gl_FragColor=vec4(vec3(.23,.235,.23),vOpacity*soft);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  }`});
 const points=new THREE.Points(geometry,material);points.name='local-shore-contact-spray';points.raycast=()=>{};points.frustumCulled=false;geometry.setDrawRange(0,0);
 return {points,state,update(time:number,mode:number,lift:number,height:number,fov:number,pixelRatio:number,enabled=true){
  state.update(time,mode,lift,enabled);material.uniforms.uScale.value=height/(2*Math.tan(THREE.MathUtils.degToRad(fov)*.5));material.uniforms.uPixelRatio.value=pixelRatio;
  let count=0;if(state.event){const e=state.event,s=state.sites[e.site];for(let i=0;i<SPLASH_LIMITS.particles;i++){const q=splashParticle(e,s,i,time-e.born);if(!q)continue;position.setXYZ(count,q.x,q.y,q.z);size.setX(count,q.size);opacity.setX(count,q.opacity);count++;}}
  geometry.setDrawRange(0,count);position.needsUpdate=true;size.needsUpdate=true;opacity.needsUpdate=true;
 },dispose(){geometry.dispose();material.dispose();}};
}
