import fs from 'node:fs';
import * as THREE from 'three';
import { ROUTES } from '../app/delivery-routes.ts';
import { containsLand, constrainedRoute, landSegment } from '../app/geographic-constraints.ts';
const geo=JSON.parse(fs.readFileSync(new URL('../public/data/singapore-regions.geojson',import.meta.url),'utf8'));
let routeCount=0,vertices=0,failures=0;
for(const feature of geo.features){
  for(const route of ROUTES[feature.properties.REGION_N]){
    const sections=constrainedRoute(route.path,feature);
    if(!sections.length){console.error('No land route:',route.id);failures++;}
    for(const section of sections){
      const curve=new THREE.CurvePath<THREE.Vector3>();
      for(let i=1;i<section.length;i++){
        if(!landSegment(section[i-1],section[i],feature)){console.error('Water crossing',route.id);failures++;}
        const a=section[i-1],b=section[i];
        curve.add(new THREE.LineCurve3(new THREE.Vector3((a[0]-103.82)*70,0,-(a[1]-1.35)*70),new THREE.Vector3((b[0]-103.82)*70,0,-(b[1]-1.35)*70)));
      }
      // Check the rendered tube's footprint, not only its centerline.
      const tube=new THREE.TubeGeometry(curve,Math.max(8,section.length*2),.012,5,false),positions=tube.getAttribute('position');
      for(let i=0;i<positions.count;i++){
        const point:[number,number]=[positions.getX(i)/70+103.82,-positions.getZ(i)/70+1.35];
        if(!containsLand(point,feature)){failures++;if(failures<10)console.error('Tube outside land:',route.id,point);}
      }
      vertices+=positions.count;tube.dispose();
    }
    routeCount++;
  }
}
console.log(JSON.stringify({routes:routeCount,renderedRouteVertices:vertices,violations:failures}));
if(failures)process.exitCode=1;
