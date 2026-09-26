// Derived scalar distance field only. Does not modify any existing geographic geometry.
import fs from 'node:fs';
import clipping from 'polygon-clipping';
const source=JSON.parse(fs.readFileSync(new URL('../../../work/sla-original.geojson',import.meta.url),'utf8'));
const coastal=source.features.filter(f=>f.geometry&&f.properties.FOLDERPATH==='Layers/Coastal_Outlines'&&!/MALAYSIA|JOHOR/i.test(f.properties.NAME||''));
const union=clipping.union(...coastal.map(f=>f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates));
const reach=1.35,grid=new Map();
for(const polygon of union)for(const ring of polygon)for(let i=1;i<ring.length;i++){
 const [a,b]=[ring[i-1],ring[i]].map(p=>[(p[0]-103.82)*70,-(p[1]-1.35)*70]);
 for(let x=Math.floor(Math.min(a[0],b[0])-reach);x<=Math.floor(Math.max(a[0],b[0])+reach);x++)
  for(let z=Math.floor(Math.min(a[1],b[1])-reach);z<=Math.floor(Math.max(a[1],b[1])+reach);z++){
   const key=`${x}:${z}`,list=grid.get(key)??[];list.push([a,b]);grid.set(key,list);
  }
}
const x0=-18,z0=-13,step=.12,width=351,height=276,values=[];
for(let j=0;j<height;j++)for(let i=0;i<width;i++){
 const x=x0+i*step,z=z0+j*step;let distance=reach;
 for(const [a,b] of grid.get(`${Math.floor(x)}:${Math.floor(z)}`)??[]){
  const dx=b[0]-a[0],dz=b[1]-a[1],den=dx*dx+dz*dz,t=den?Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/den)):0;
  distance=Math.min(distance,Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t));
 }values.push(Math.round(distance*1000));
}
const output={source:'SLA Coastal_Outlines (existing official source snapshot), union before water subtraction',units:'scene distance × 1000',x0,z0,step,width,height,values};
fs.writeFileSync(new URL('../public/data/terrain-coast-distance.json',import.meta.url),JSON.stringify(output));
console.log(`Coast-only distance field: ${width} × ${height}, ${coastal.length} source features; all original geography files untouched.`);
