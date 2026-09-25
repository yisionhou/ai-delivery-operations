import * as THREE from 'three';
import type { RegionCollection } from './singapore-scene';

type Point=[number,number];
export type BoundarySegment={a:THREE.Vector3;b:THREE.Vector3;length:number;coast:boolean;outward:THREE.Vector3};
const pointKey=(p:Point)=>`${p[0].toFixed(10)},${p[1].toFixed(10)}`;
const edgeKey=(a:Point,b:Point)=>[pointKey(a),pointKey(b)].sort().join('|');

export function terrainBoundary(feature:RegionCollection['features'][number],surface:(p:Point)=>THREE.Vector3){
  const coasts=new Set((feature.properties.COASTLINES??[]).map(([a,b])=>edgeKey(a,b)));
  const polygons=(feature.geometry.type==='Polygon'?[feature.geometry.coordinates]:feature.geometry.coordinates) as Point[][][];
  const segments:BoundarySegment[]=[];
  for(const polygon of polygons)polygon.forEach((ring,ringIndex)=>{
    const points=ring.map(point=>surface(point));
    const area=points.reduce((sum,a,i)=>{const b=points[(i+1)%points.length];return sum+a.x*b.z-b.x*a.z;},0);
    const side=(area>=0?1:-1)*(ringIndex===0?1:-1);
    for(let i=1;i<ring.length;i++){
      const a=points[i-1],b=points[i],length=a.distanceTo(b);
      const outward=new THREE.Vector3(b.z-a.z,0,a.x-b.x).normalize().multiplyScalar(side);
      if(length>1e-8)segments.push({a,b,length,coast:coasts.has(edgeKey(ring[i-1],ring[i])),outward});
    }
  });
  return segments;
}

// One shallow edge ribbon: narrow core at the exact boundary plus analytic falloff.
// This does not displace the land or bevel shared geography. Resting internal seams are masked out.
export function createEdgeFinish(segments:BoundarySegment[]){
  const positions:number[]=[],uvs:number[]=[],coastal:number[]=[];
  for(const {a,b,coast,outward} of segments){
    for(const [point,t] of [[a,0],[b,0],[a,1],[b,0],[b,1],[a,1]] as const){
      const distance=-.085+t*.12;
      // Upper physical lip, not floating sprites. Smaller extension avoids bright slivers at intricate inlets.
      positions.push(point.x+outward.x*distance,point.y+.005-Math.max(0,distance)*1.35,point.z+outward.z*distance);
      uvs.push(point.x+point.z,distance);coastal.push(coast?1:0);
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setAttribute('aCoast',new THREE.Float32BufferAttribute(coastal,1));geometry.computeVertexNormals();
  const focus={value:0},hover={value:0};
  const visibility={value:1};
  const halo={value:1};
  const material=new THREE.MeshStandardMaterial({color:'#79776e',roughness:.62,metalness:.12,emissive:'#f4f0e6',emissiveIntensity:2.25,
    transparent:true,opacity:1,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  material.onBeforeCompile=shader=>{
    shader.uniforms.uEdgeFocus=focus;shader.uniforms.uEdgeHover=hover;
    shader.uniforms.uEdgeVisibility=visibility;
    shader.uniforms.uEdgeHalo=halo;
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float aCoast; varying vec3 vEdgePosition; varying vec2 vEdgeMask;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvEdgePosition=position; vEdgeMask=vec2(uv.y,aCoast);');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
      varying vec3 vEdgePosition; varying vec2 vEdgeMask; uniform float uEdgeFocus; uniform float uEdgeHover; uniform float uEdgeVisibility; uniform float uEdgeHalo;`)
      .replace('#include <alphamap_fragment>',`#include <alphamap_fragment>
        float width=max(.027,fwidth(vEdgeMask.x)*.7);
        float core=exp(-pow((vEdgeMask.x+.019)/width,2.));
        float halo=exp(-pow((vEdgeMask.x+.015)/.052,2.))*.26*uEdgeHalo;
        float profile=(core+halo)*(1.-smoothstep(.05,.085,abs(vEdgeMask.x)));
        // Smooth embedded concentrations in one shaded band; no separate discs, hard dashes or uniform outline.
        float wave=.5+.5*sin(vEdgePosition.x*2.3+vEdgePosition.z*1.9);
        float broad=.5+.5*cos(vEdgePosition.x*.73-vEdgePosition.z*1.21);
        float hotspot=pow(wave,1.6)*pow(broad,1.1);
        vec2 cells=vEdgePosition.xz*16.;vec2 cell=floor(cells);
        vec2 seed=fract(sin(vec2(dot(cell,vec2(127.1,311.7)),dot(cell,vec2(269.5,183.3))))*43758.5453);
        vec2 q=fract(cells)-(.15+.7*seed);
        float filterWidth=max(.055,length(fwidth(cells))*.12);
        float grain=exp(-dot(q,q)/filterWidth)*smoothstep(.18,.75,seed.x);
        // Night-light reference: dense local specks separated by dark shoreline runs, embedded in the lip.
        float patches=.008+2.8*hotspot*grain;
        float strength=mix(vEdgeMask.y*.72,.84,uEdgeFocus)+uEdgeHover*.025;
        diffuseColor.a*=clamp(profile*patches*strength*uEdgeVisibility*1.4,0.,1.);`);
  };
  material.customProgramCacheKey=()=> 'nexus-clustered-edge-v5';
  return {geometry,material,focus,hover,visibility,halo};
}

const edgeHash=(n:number)=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};

// Arc-length samples, not vertex-density samples. Fixed terrain-local points travel with the block.
export function createEdgeAccents(segments:BoundarySegment[],edge:ReturnType<typeof createEdgeFinish>){
  const sample=boundarySampler(segments),length=segments.reduce((n,s)=>n+s.length,0);
  const count=Math.min(1800,Math.ceil(length/.15));
  const positions:number[]=[],sizes:number[]=[],coasts:number[]=[],strengths:number[]=[];
  for(let i=0;i<count;i++){
    const distance=(i+.15+.7*edgeHash(i+41))/count*length;
    // Irregular bright clusters separated by genuinely dark runs, never a dotted uniform GIS line.
    if(edgeHash(Math.floor(distance/.8)+73)<.43)continue;
    const {segment,t}=sample(distance/length),p=segment.a.clone().lerp(segment.b,t).addScaledVector(segment.outward,.025);
    positions.push(p.x,p.y+.026,p.z);coasts.push(segment.coast?1:0);
    sizes.push(.85+edgeHash(i+91)*.8);strengths.push(.42+.52*edgeHash(i+19));
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('aSize',new THREE.Float32BufferAttribute(sizes,1));
  geometry.setAttribute('aCoast',new THREE.Float32BufferAttribute(coasts,1));
  geometry.setAttribute('aStrength',new THREE.Float32BufferAttribute(strengths,1));
  const recession={value:1},dpr={value:1};
  const material=new THREE.ShaderMaterial({transparent:true,depthTest:true,depthWrite:false,
    uniforms:{uFocus:edge.focus,uVisible:edge.visibility,uHalo:edge.halo,uRecession:recession,uDpr:dpr,uIvory:{value:new THREE.Color('#eeeade')}},
    vertexShader:`attribute float aSize;attribute float aCoast;attribute float aStrength;
      uniform float uDpr;uniform float uFocus;uniform float uVisible;uniform float uRecession;varying float vAlpha;
      void main(){vec4 world=modelMatrix*vec4(position,1.);float foreground=.8+.2*smoothstep(-4.,8.,position.z);
        vAlpha=aStrength*mix(aCoast,.28+.72*aCoast,uFocus)*(1.+uFocus*.2)*uVisible*uRecession*foreground;
        gl_Position=projectionMatrix*viewMatrix*world;gl_PointSize=aSize*3.6*uDpr;}`,
    fragmentShader:`uniform vec3 uIvory;uniform float uHalo;varying float vAlpha;
      void main(){float r=length(gl_PointCoord-.5);float core=exp(-r*r*38.);float halo=exp(-r*r*9.)*.12*uHalo;
        gl_FragColor=vec4(uIvory,(core+halo)*(1.-smoothstep(.38,.5,r))*vAlpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  return {geometry,material,recession,dpr};
}

export function boundarySampler(segments:BoundarySegment[]){
  const cumulative:number[]=[];let total=0;
  segments.forEach(s=>{total+=s.length;cumulative.push(total);});
  return (fraction:number)=>{
    const distance=THREE.MathUtils.clamp(fraction,0,1-Number.EPSILON)*total;
    let low=0,high=segments.length-1;
    while(low<high){const mid=(low+high)>>>1;if(cumulative[mid]<distance)low=mid+1;else high=mid;}
    const segment=segments[low],previous=low?cumulative[low-1]:0;
    return {segment,t:(distance-previous)/segment.length};
  };
}
