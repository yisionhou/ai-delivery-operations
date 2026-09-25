import * as THREE from "three";
export type GeographicPoint=[number,number];
export type LandFeature={geometry:{type:"Polygon"|"MultiPolygon";coordinates:GeographicPoint[][]|GeographicPoint[][][]}};
type Box=[number,number,number,number];
type Edge={a:GeographicPoint;b:GeographicPoint};
type Ring={points:GeographicPoint[];box:Box};
const cellSize=.005;
const cache=new WeakMap<LandFeature,{polygons:Ring[][];grid:Map<string,Edge[]>}>();
const inBox=(p:GeographicPoint,b:Box)=>p[0]>=b[0]&&p[0]<=b[2]&&p[1]>=b[1]&&p[1]<=b[3];
function compiled(feature:LandFeature){
  const existing=cache.get(feature);if(existing)return existing;
  const raw=feature.geometry.type==="Polygon"?[feature.geometry.coordinates as GeographicPoint[][]]:feature.geometry.coordinates as GeographicPoint[][][];
  const grid=new Map<string,Edge[]>();
  const polygons=raw.map(polygon=>polygon.map(points=>{
    const box:Box=[Infinity,Infinity,-Infinity,-Infinity];
    points.forEach((p,i)=>{
      box[0]=Math.min(box[0],p[0]);box[1]=Math.min(box[1],p[1]);box[2]=Math.max(box[2],p[0]);box[3]=Math.max(box[3],p[1]);
      if(!i)return;const a=points[i-1],b=p,edge={a,b};
      for(let x=Math.floor(Math.min(a[0],b[0])/cellSize);x<=Math.floor(Math.max(a[0],b[0])/cellSize);x++)
        for(let y=Math.floor(Math.min(a[1],b[1])/cellSize);y<=Math.floor(Math.max(a[1],b[1])/cellSize);y++){
          const key=`${x}:${y}`,edges=grid.get(key)??[];edges.push(edge);grid.set(key,edges);
        }
    });return {points,box};
  }));
  const result={polygons,grid};cache.set(feature,result);return result;
}
function inRing(p:GeographicPoint,ring:Ring){
  if(!inBox(p,ring.box))return false;let inside=false;
  for(let i=0,j=ring.points.length-1;i<ring.points.length;j=i++){
    const a=ring.points[i],b=ring.points[j];
    if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }return inside;
}
export function containsLand(p:GeographicPoint,feature:LandFeature){
  return compiled(feature).polygons.some(rings=>inRing(p,rings[0])&&!rings.slice(1).some(hole=>inRing(p,hole)));
}
function nearbyEdges(box:Box,feature:LandFeature){
  const edges=new Set<Edge>(),grid=compiled(feature).grid;
  for(let x=Math.floor(box[0]/cellSize);x<=Math.floor(box[2]/cellSize);x++)for(let y=Math.floor(box[1]/cellSize);y<=Math.floor(box[3]/cellSize);y++)
    grid.get(`${x}:${y}`)?.forEach(edge=>edges.add(edge));
  return edges;
}
const pointDistance=(p:GeographicPoint,{a,b}:Edge)=>{
  const dx=b[0]-a[0],dy=b[1]-a[1],denominator=dx*dx+dy*dy;
  const t=denominator?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/denominator)):0;
  return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);
};
export function containsRouteCorridor(p:GeographicPoint,feature:LandFeature,margin=.00022){
  if(!containsLand(p,feature))return false;
  return ![...nearbyEdges([p[0]-margin,p[1]-margin,p[0]+margin,p[1]+margin],feature)].some(edge=>pointDistance(p,edge)<margin);
}
const cross=(a:GeographicPoint,b:GeographicPoint,c:GeographicPoint)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
export function landSegment(a:GeographicPoint,b:GeographicPoint,feature:LandFeature){
  if(!containsLand([(a[0]+b[0])/2,(a[1]+b[1])/2],feature))return false;
  const edges=nearbyEdges([Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[0],b[0]),Math.max(a[1],b[1])],feature);
  for(const edge of edges){
    if(cross(a,b,edge.a)*cross(a,b,edge.b)<0&&cross(edge.a,edge.b,a)*cross(edge.a,edge.b,b)<0)return false;
  }return true;
}
export function constrainedRoute(path:GeographicPoint[],feature:LandFeature){
  const curve=new THREE.CatmullRomCurve3(path.map(p=>new THREE.Vector3(p[0],p[1],0)),false,"centripetal");
  const steps=Math.max(180,Math.ceil(curve.getLength()/.00015));
  const sections:GeographicPoint[][]=[];let current:GeographicPoint[]=[];
  const flush=()=>{if(current.length>2)sections.push(current);current=[];};
  for(let i=0;i<=steps;i++){
    const sample=curve.getPoint(i/steps),p:GeographicPoint=[sample.x,sample.y];
    if(!containsRouteCorridor(p,feature)){flush();continue;}
    if(current.length&&!landSegment(current.at(-1)!,p,feature))flush();
    current.push(p);
  }
  flush();return sections;
}
