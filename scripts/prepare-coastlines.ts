import fs from 'node:fs/promises';
import { containsLand } from '../app/geographic-constraints.ts';
import type { RegionCollection } from '../app/singapore-scene';

// Preserve exact edges; discard edges whose other side is another region, not water.
const geo=JSON.parse(await fs.readFile(new URL('../public/data/singapore-regions.geojson',import.meta.url),'utf8')) as RegionCollection;
const coastlines:Record<string,number[][][]>={};
for(const feature of geo.features){
  const edges:number[][][]=[];
  const polygons=(feature.geometry.type==='Polygon'?[feature.geometry.coordinates]:feature.geometry.coordinates) as [number,number][][][];
  for(const polygon of polygons)for(const ring of polygon){
    for(let i=1;i<ring.length;i++){
      const a=ring[i-1],b=ring[i],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
      if(length<1e-12)continue;
      const mid=[(a[0]+b[0])/2,(a[1]+b[1])/2],epsilon=1e-7;
      const sides:[[number,number],[number,number]]=[
        [mid[0]-dy/length*epsilon,mid[1]+dx/length*epsilon],
        [mid[0]+dy/length*epsilon,mid[1]-dx/length*epsilon],
      ];
      const shared=geo.features.some(other=>other!==feature&&sides.some(p=>containsLand(p,other)));
      if(!shared)edges.push([a,b]);
    }
  }
  coastlines[feature.properties.REGION_N]=edges;
}
await fs.writeFile(new URL('../public/data/singapore-coastlines.json',import.meta.url),JSON.stringify(coastlines));
console.log(Object.fromEntries(Object.entries(coastlines).map(([key,lines])=>[key,lines.length])));
