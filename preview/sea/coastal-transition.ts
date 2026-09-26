import * as THREE from 'three';
import type {P} from './sea-model';
export type CoastSegment=P[];
export function inOuterLand(p:P,rings:P[][]){
 return rings.some(r=>{let inside=false;for(let i=0,j=r.length-1;i<r.length;j=i++){
  const a=r[i],b=r[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }return inside;});
}
export const COAST_STEPS=24;
// C2-continuous descent, tangent to both the original top and submerged shelf.
// No intermediate ledges. The full-thickness body remains inside this skin.
export function coastHeight(t:number){const s=t*t*t*(t*(t*6-15)+10);return .52-.94*s;}
export function coastalTransition(segments:CoastSegment[],rings:P[][]){
 const bounded=rings.map(r=>({r,minX:Math.min(...r.map(p=>p[0])),maxX:Math.max(...r.map(p=>p[0])),minZ:Math.min(...r.map(p=>p[1])),maxZ:Math.max(...r.map(p=>p[1]))}));
 const contains=(p:P)=>bounded.some(b=>p[0]>=b.minX&&p[0]<=b.maxX&&p[1]>=b.minZ&&p[1]<=b.maxZ&&inOuterLand(p,[b.r]));
 const edges=segments.flatMap(([a,b])=>{
  const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(len<1e-6)return [];
  let nx=-dz/len,nz=dx/len;const mid:P=[(a[0]+b[0])/2,(a[1]+b[1])/2];
  const left=contains([mid[0]+nx*.002,mid[1]+nz*.002]),right=contains([mid[0]-nx*.002,mid[1]-nz*.002]);
  // Exclude internal water-hole boundaries and ambiguous narrow artifacts.
  if(left===right)return [];
  if(left){nx=-nx;nz=-nz;}return [{a,b,nx,nz,len}];
 });
 const normals=new Map<string,P>(),key=(p:P)=>p.map(v=>v.toFixed(6)).join(':');
 for(const e of edges)for(const p of [e.a,e.b]){const n=normals.get(key(p))??[0,0];n[0]+=e.nx;n[1]+=e.nz;normals.set(key(p),n);}
 const positions:number[]=[],colors:number[]=[],indices:number[]=[];
 const smooth=(a:number,b:number,x:number)=>{const t=THREE.MathUtils.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
 const cache=new Map<string,number>(),widths=new Map<string,number>();
 const vertex=(p:P,level:number)=>{
  const id=key(p),cached=cache.get(`${id}:${level}`);if(cached!==undefined)return cached;
  const v=normals.get(id)!,length=Math.hypot(...v)||1,n:P=[v[0]/length,v[1]/length];
  let width=widths.get(id);
  if(width===undefined){
   const part=bounded.find(b=>p[0]>=b.minX-1e-5&&p[0]<=b.maxX+1e-5&&p[1]>=b.minZ-1e-5&&p[1]<=b.maxZ+1e-5);
   width=part?Math.min(1,Math.max(.13,Math.min(part.maxX-part.minX,part.maxZ-part.minZ)*.32)):1;
   width*=.83+.17*Math.sin(p[0]*1.2+p[1]*.6)**2;
   for(let d=.035;d<=1;d+=.035)if(contains([p[0]+n[0]*d,p[1]+n[1]*d])){width=Math.min(width,Math.max(.035,d*.45/.95));break;}
   widths.set(id,width);
  }
  const t=level/COAST_STEPS,distance=(t*.95-.008)*width,y=coastHeight(t)+.0005;
  const index=positions.length/3;
  positions.push(p[0]+n[0]*distance,y,p[1]+n[1]*distance);
  // Graphite stone, not sand. A broad wetting gradient avoids a painted stripe.
  const col=new THREE.Color('#252525').multiplyScalar(.62+.38*smooth(-.12,.40,y));
  colors.push(col.r,col.g,col.b);cache.set(`${id}:${level}`,index);return index;
 };
 const push=(a:number,b:number,c:number)=>{
  const cross=(positions[b*3+2]-positions[a*3+2])*(positions[c*3]-positions[a*3])-(positions[b*3]-positions[a*3])*(positions[c*3+2]-positions[a*3+2]);
  if(cross<0)[b,c]=[c,b];indices.push(a,b,c);
 };
 for(const e of edges)for(let j=0;j<COAST_STEPS;j++){const a=vertex(e.a,j),b=vertex(e.b,j),c=vertex(e.b,j+1),d=vertex(e.a,j+1);push(a,b,c);push(a,c,d);}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
 return {geometry,segments:edges.map(e=>[e.a,e.b]),stats:{marineSegments:edges.length,triangles:indices.length/3}};
}

// Rasterize the actual curved apron into the water's bathymetry channels.
// The water's shallow-zone shading therefore follows the geometry, not a second ring.
export function bakeShelf(geometry:THREE.BufferGeometry,size:number,extent:readonly[number,number]){
 const heights=new Float32Array(size*size).fill(-1),p=geometry.getAttribute('position'),index=geometry.index!;
 for(let i=0;i<index.count;i+=3){
  const vertices=[0,1,2].map(j=>{const id=index.getX(i+j);return {x:(p.getX(id)/extent[0]+.5)*size,z:(p.getZ(id)/extent[1]+.5)*size,y:p.getY(id)};});
  const [a,b,c]=vertices,den=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);if(Math.abs(den)<1e-9)continue;
  const minX=Math.max(0,Math.floor(Math.min(a.x,b.x,c.x))),maxX=Math.min(size-1,Math.ceil(Math.max(a.x,b.x,c.x)));
  const minZ=Math.max(0,Math.floor(Math.min(a.z,b.z,c.z))),maxZ=Math.min(size-1,Math.ceil(Math.max(a.z,b.z,c.z)));
  for(let z=minZ;z<=maxZ;z++)for(let x=minX;x<=maxX;x++){
   const u=((b.z-c.z)*(x+.5-c.x)+(c.x-b.x)*(z+.5-c.z))/den,v=((c.z-a.z)*(x+.5-c.x)+(a.x-c.x)*(z+.5-c.z))/den,w=1-u-v;
   if(u>=0&&v>=0&&w>=0)heights[z*size+x]=Math.max(heights[z*size+x],u*a.y+v*b.y+w*c.y);
  }
 }
 return heights;
}
