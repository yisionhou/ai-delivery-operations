// Reproducible offline geometry preparation. No coastline simplification or densification.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import clipping from 'polygon-clipping';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const input = path.resolve(root, process.argv[2] || '.cache/geography');
const ids = {sla:'d_29f066d67df3eae91df8a42f443863c8',ura:'d_4ce0038f7ac689652350bb91b7fb92ed'};
await fs.mkdir(input,{recursive:true});
async function load(name) {
  const file=path.join(input,`${name}-original.geojson`);
  try { return JSON.parse(await fs.readFile(file,'utf8')); } catch {}
  const response=await fetch(`https://api-open.data.gov.sg/v1/public/api/datasets/${ids[name]}/poll-download`);
  const result=await response.json();
  if(!result.data?.url)throw new Error(`Download unavailable: ${name}`);
  const data=await (await fetch(result.data.url)).text();
  const json=JSON.parse(data); await fs.writeFile(file,data); return json;
}
const [sla,ura]=await Promise.all([load('sla'),load('ura')]);
const polygons=f=>f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;
const xy=polys=>polys.map(poly=>poly.map(ring=>ring.map(p=>[(p[0]-103.82)*111289,(p[1]-1.35)*110574])));
const geographic=polys=>polys.map(poly=>poly.map(ring=>ring.map(p=>[p[0]/111289+103.82,p[1]/110574+1.35])));
const count=a=>typeof a[0]==='number'?1:a.reduce((n,b)=>n+count(b),0);
const ringArea=r=>Math.abs(r.reduce((a,p,i)=>{const q=r[(i+1)%r.length];return a+p[0]*q[1]-q[0]*p[1]},0)/2);
const area=ps=>ps.reduce((sum,rs)=>sum+ringArea(rs[0])-rs.slice(1).reduce((n,r)=>n+ringArea(r),0),0);
const coastal=sla.features.filter(f=>f.geometry && f.properties.FOLDERPATH==='Layers/Coastal_Outlines' && !/MALAYSIA|JOHOR/i.test(f.properties.NAME||''));
const water=sla.features.filter(f=>f.geometry && f.properties.FOLDERPATH==='Layers/Hydrographic');
const coast=clipping.union(...coastal.map(f=>xy(polygons(f))));
// Inland reservoirs, rivers and ponds are holes, never separate terrain pieces.
const land=clipping.difference(coast,...water.map(f=>xy(polygons(f))));
const features=[];
let assigned=[];
for(const f of ura.features){
  let coordinates=clipping.intersection(xy(polygons(f)),land);
  // Canonical ownership removes microscopic source overlaps along shared seams.
  if(assigned.length)coordinates=clipping.difference(coordinates,assigned);
  features.push({type:'Feature',properties:{REGION_N:f.properties.REGION_N},geometry:{type:'MultiPolygon',coordinates}});
  assigned=clipping.union(assigned,coordinates);
}
const combined=clipping.union(...features.map(f=>f.geometry.coordinates));
const expected=clipping.intersection(clipping.union(...ura.features.map(f=>xy(polygons(f)))),land);
let overlap=0;
for(let i=0;i<features.length;i++)for(let j=i+1;j<features.length;j++)overlap+=area(clipping.intersection(features[i].geometry.coordinates,features[j].geometry.coordinates));
const coverageError=area(clipping.xor(combined,expected));
if(overlap>.01||coverageError>.01)throw new Error(`Topology check failed: overlap=${overlap}, coverage error=${coverageError}`);
features.forEach(f=>{f.geometry.coordinates=geographic(f.geometry.coordinates)});
const result={type:'FeatureCollection',features};
const output=path.join(root,'public/data');
await fs.writeFile(path.join(output,'singapore-regions.geojson'),JSON.stringify(result));
const report={
  generatedAt:new Date().toISOString(),
  sources:Object.entries(ids).map(([agency,id])=>({agency:agency.toUpperCase(),datasetId:id,url:`https://data.gov.sg/datasets/${id}/view`})),
  method:'URA regions intersected with the union of SLA Coastal_Outlines, minus SLA Hydrographic polygons. Malaysia/Johor excluded. No simplification, smoothing, densification or coordinate rounding.',
  slaFeatureClasses:Object.fromEntries([...new Set(sla.features.map(f=>f.properties.FOLDERPATH))].map(key=>[key,sla.features.filter(f=>f.properties.FOLDERPATH===key).length])),
  coastalFeatures:coastal.length,waterFeatures:water.length,
  originalUraVertices:ura.features.reduce((n,f)=>n+count(f.geometry.coordinates),0),
  finalVertices:features.reduce((n,f)=>n+count(f.geometry.coordinates),0),
  overlapAreaM2:overlap,coverageErrorM2:coverageError,
  regions:features.map(f=>({name:f.properties.REGION_N,vertices:count(f.geometry.coordinates),polygons:f.geometry.coordinates.length})),
};
await fs.writeFile(path.join(output,'geography-provenance.json'),JSON.stringify(report,null,2));
const colors=['#aa9470','#849b9c','#9d9b88','#8b8d9a','#b7a887'];
const project=p=>[(p[0]-103.59)*2400,650-(p[1]-1.16)*2000];
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720"><rect width="1200" height="720" fill="#10191d"/>${features.map((f,i)=>`<path fill="${colors[i]}" fill-rule="evenodd" stroke="#ded5ba" stroke-width="0.3" d="${f.geometry.coordinates.flatMap(poly=>poly.map(ring=>ring.map((p,i)=>{const q=project(p);return `${i?'L':'M'}${q[0]},${q[1]}`}).join(' ')+' Z')).join(' ')}"/>`).join('')}<text x="20" y="30" fill="#ded5ba" font-size="16" font-family="Arial">SLA coastal land − water ∩ URA 2025 regions · original geographic vertices</text></svg>`;
await fs.writeFile(path.join(input,'geography-review.svg'),svg);
console.log(JSON.stringify(report,null,2));
