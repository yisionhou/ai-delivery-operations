"use client";

import { ContactShadows, Environment, Lightformer } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import * as THREE from "three";
import { TessellateModifier } from "three/addons/modifiers/TessellateModifier.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { architecturalFinishes, architectureFoundations, createArchitecture } from "./maquette-architecture";
import { containsLand, constrainedRoute } from "./geographic-constraints";
import { ROUTES } from "./delivery-routes";
import { createTerrainMaterial, createCutFaceMaterial } from './terrain-material';
import {createLandform,BASE_DEPTH,type Landform} from './terrain-landform';
import BaseMist from './base-mist';
import InspectionCamera, { type CameraCommand, type InspectionGate } from './inspection-camera';
import { createRegionHoverOwner, createRegionPointerHandlers, noDecorationRaycast } from './region-interaction';
import SceneTelemetry from './scene-telemetry';
import { terrainBoundary, createEdgeFinish, type BoundarySegment } from './terrain-edge';
import LiftDust from './lift-dust';
import {NORMAL_VISIBILITY,VisibilityControls,type VisibilitySettings} from './visibility-diagnostics';
import {incident} from './incidents/incident-mock';

export type RegionKey = "CENTRAL REGION" | "EAST REGION" | "WEST REGION" | "NORTH REGION" | "NORTH-EAST REGION";
type Position = [number, number];
type Route = { id: string; path: Position[] };
type RegionFeature = {
  type: "Feature";
  properties: { REGION_N: RegionKey; COASTLINES?: Position[][] };
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: Position[][] | Position[][][] };
};
export type RegionCollection = { type: "FeatureCollection"; features: RegionFeature[] };

const SCALE = 70;
const toScene = ([lon, lat]: Position): [number, number] => [(lon - 103.82) * SCALE, (lat - 1.35) * SCALE];
const TerrainContext=createContext<Landform|null>(null);
function useTerrain(){const terrain=useContext(TerrainContext);if(!terrain)throw new Error('Missing shared landform');return terrain;}
const PRESENTATION = new THREE.Vector3(-4, 0, 10);
function regionLayout(feature:RegionFeature,surfaceAt:Landform['surface']) {
  const box=new THREE.Box3();
  const polygons=feature.geometry.type==="Polygon"?[feature.geometry.coordinates as Position[][]]:feature.geometry.coordinates as Position[][][];
  polygons.forEach(p=>p[0].forEach(point=>box.expandByPoint(surfaceAt(point))));
  const center=box.getCenter(new THREE.Vector3());center.y=0;
  const size=box.getSize(new THREE.Vector3());
  return {center,width:size.x,depth:size.z,translation:PRESENTATION.clone().sub(center)};
}


const LABELS: Record<RegionKey, Array<{at:Position;text:string}>> = {
  "WEST REGION": [
    {at:[103.63,1.31],text:"Tuas"},{at:[103.68,1.36],text:"Jurong"},
    {at:[103.74,1.31],text:"Clementi"},
  ],
  "CENTRAL REGION": [
    {at:[103.81,1.34],text:"Orchard"},{at:[103.84,1.31],text:"City"},
    {at:[103.86,1.29],text:"Marina Bay"},
  ],
  "EAST REGION": [
    {at:[103.92,1.36],text:"Bedok"},{at:[103.94,1.40],text:"Tampines"},
    {at:[103.99,1.34],text:"Changi"},
  ],
  "NORTH REGION": [
    {at:[103.75,1.42],text:"Woodlands"},{at:[103.79,1.46],text:"Sembawang"},
    {at:[103.82,1.42],text:"Yishun"},
  ],
  "NORTH-EAST REGION": [
    {at:[103.87,1.40],text:"Ang Mo Kio"},{at:[103.92,1.43],text:"Punggol"},
  ],
};

function shapesFromFeature(feature: RegionFeature) {
  const polygons = feature.geometry.type === "Polygon"
    ? [feature.geometry.coordinates as Position[][]]
    : feature.geometry.coordinates as Position[][][];
  return polygons.map((polygon) => {
    const shape = new THREE.Shape();
    polygon[0].map(toScene).forEach(([x,y],i) => i ? shape.lineTo(x,y) : shape.moveTo(x,y));
    shape.closePath();
    polygon.slice(1).forEach((ring) => {
      const hole = new THREE.Path();
      ring.map(toScene).forEach(([x,y],i) => i ? hole.lineTo(x,y) : hole.moveTo(x,y));
      hole.closePath();
      shape.holes.push(hole);
    });
    return shape;
  });
}

const pointInRegion = containsLand;

function regionGeometries(feature: RegionFeature, shapes: THREE.Shape[],terrainHeight:Landform['height']) {
  const rawTop = new THREE.ShapeGeometry(shapes);
  const top = new TessellateModifier(.55, 6).modify(rawTop);
  rawTop.dispose();
  top.rotateX(-Math.PI / 2);
  const topPositions = top.getAttribute("position") as THREE.BufferAttribute;
  const topColors: number[] = [];
  const baseColor = new THREE.Color("#191918");
  for (let i = 0; i < topPositions.count; i++) {
    const x = topPositions.getX(i), z = topPositions.getZ(i);
    topPositions.setY(i, BASE_DEPTH + terrainHeight(x, z));
    const grain = Math.sin(x * 2.9 + z * 1.7) * Math.sin(z * 2.3 - x * 1.1) * .065;
    const color = baseColor.clone().multiplyScalar(1 + grain);
    topColors.push(color.r, color.g, color.b);
  }
  top.setAttribute("color", new THREE.Float32BufferAttribute(topColors, 3));
  top.deleteAttribute("normal");
  const smoothTop=mergeVertices(top,1e-7);smoothTop.computeVertexNormals();top.dispose();

  const wallPositions: number[] = [];
  const wallColors: number[] = [];
  const strata = [
    { y: 0, color: "#202020" },
    { y: .145, color: "#2c2c2b" },
    { y: .32, color: "#3b3b39" },
    { y: .51, color: "#41413e" },
    { y: .61, color: "#353534" },
    { y: BASE_DEPTH, color: "#454542" },
  ];
  const colors = strata.map((level) => new THREE.Color(level.color));
  const polygons = feature.geometry.type === "Polygon"
    ? [feature.geometry.coordinates as Position[][]]
    : feature.geometry.coordinates as Position[][][];
  const vertex = (x: number, z: number, index: number) => {
    const level = strata[index];
    const y = level.y + (level.y / BASE_DEPTH) * terrainHeight(x, z) +
      (index > 0 && index < strata.length - 1 ? Math.sin(x * 1.12 + z * .64) * .012 : 0);
    // Exact XY at every height: centroid insets distorted narrow inlets/concave sides.
    // Strata remain a dark material treatment, not displaced borders or measured geology.
    return [x, y, z] as const;
  };
  const pushVertex = (v: readonly number[], color: THREE.Color) => {
    wallPositions.push(v[0], v[1], v[2]);
    wallColors.push(color.r, color.g, color.b);
  };
  polygons.forEach((rings) => rings.forEach((ring) => {
    if (ring.length < 3) return;
    const sceneRing = ring.map((point) => {
      const [x, north] = toScene(point);
      return [x, -north] as const;
    });
    for (let i = 0; i < sceneRing.length - 1; i++) {
      const a = sceneRing[i], b = sceneRing[i + 1];
      // One repeated source vertex: omit its zero-area wall faces, preserving the exact silhouette.
      if(Math.hypot(a[0]-b[0],a[1]-b[1])<1e-10)continue;
      for (let layer = 0; layer < strata.length - 1; layer++) {
        const a0 = vertex(a[0], a[1], layer);
        const b0 = vertex(b[0], b[1], layer);
        const a1 = vertex(a[0], a[1], layer + 1);
        const b1 = vertex(b[0], b[1], layer + 1);
        pushVertex(a0, colors[layer]); pushVertex(a1, colors[layer + 1]); pushVertex(b0, colors[layer]);
        pushVertex(b0, colors[layer]); pushVertex(a1, colors[layer + 1]); pushVertex(b1, colors[layer + 1]);
      }
    }
  }));
  const walls = new THREE.BufferGeometry();
  walls.setAttribute("position", new THREE.Float32BufferAttribute(wallPositions, 3));
  walls.setAttribute("color", new THREE.Float32BufferAttribute(wallColors, 3));
  const smoothWalls=mergeVertices(walls,1e-7);smoothWalls.computeVertexNormals();walls.dispose();
  const underside = new THREE.ShapeGeometry(shapes);
  underside.rotateX(-Math.PI / 2);
  return { top:smoothTop, walls:smoothWalls, underside };
}

function ArchitecturalDistrict({feature}:{feature:RegionFeature}) {
  const {surface:surfaceAt}=useTerrain();
  const batches=useMemo(()=>createArchitecture(feature.properties.REGION_N,p=>pointInRegion(p,feature),p=>surfaceAt(p)),[feature,surfaceAt]);
  useEffect(()=>()=>batches.forEach(batch=>batch.geometry.dispose()),[batches]);
  return <group name="architectural-maquette">{batches.map(batch=><mesh key={batch.finish} geometry={batch.geometry} castShadow receiveShadow>
    <meshStandardMaterial {...architecturalFinishes[batch.finish]} envMapIntensity={.6} side={THREE.DoubleSide}/>
  </mesh>)}</group>;
}

function PlaceLabel({at,text}:{at:Position;text:string}) {
  const {height:terrainHeight}=useTerrain();
  const [x,z]=toScene(at);
  const texture=useMemo(()=>{
    const canvas=document.createElement("canvas");canvas.width=512;canvas.height=96;
    const ctx=canvas.getContext("2d")!;
    ctx.clearRect(0,0,512,96);
    ctx.font="500 52px Arial";ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.shadowColor="#000000";ctx.shadowBlur=14;ctx.fillStyle="#f2f0eb";ctx.fillText(text,256,49);
    const result=new THREE.CanvasTexture(canvas);result.colorSpace=THREE.SRGBColorSpace;return result;
  },[text]);
  return <sprite raycast={noDecorationRaycast} position={[x,BASE_DEPTH+terrainHeight(x,-z)+.58,-z]} scale={[4.0,.82,1]}>
    <spriteMaterial map={texture} transparent depthWrite={false} opacity={.82}/>
  </sprite>;
}

function IncidentBeacon({onIncident,gate}:{onIncident?:(id:string)=>void;gate:MutableRefObject<InspectionGate>}) {
  const {height:terrainHeight}=useTerrain();
  const [x,z]=toScene([incident.location.lng,incident.location.lat]);
  return <group name={`incident-${incident.id}`} position={[x,BASE_DEPTH+terrainHeight(x,-z)+.12,-z]} onClick={event=>{if(gate.current.locked||gate.current.moved||event.delta>=5)return;event.stopPropagation();onIncident?.(incident.id);}}>
    <mesh rotation={[-Math.PI/2,0,0]}><torusGeometry args={[.27,.035,6,28]}/><meshBasicMaterial color="#ff735b"/></mesh>
    <mesh position={[0,.38,0]}><sphereGeometry args={[.13,12,8]}/><meshBasicMaterial color="#ff765e"/></mesh>
    <mesh position={[0,.17,0]}><cylinderGeometry args={[.02,.07,.34,8]}/><meshBasicMaterial color="#ff765e"/></mesh>
    <pointLight color="#ff654f" intensity={1.8} distance={3.3} decay={2}/>
  </group>;
}

function Hub({point,important=false}:{point:THREE.Vector3;important?:boolean}) {
  return <group position={[point.x,point.y+.025,point.z]}>
    <mesh raycast={noDecorationRaycast} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[important ? .46 : .27,24]}/><meshBasicMaterial color="#d7a75a" transparent opacity={important ? .2 : .105} depthWrite={false}/></mesh>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,.015,0]}><torusGeometry args={[important ? .19 : .11,.018,5,20]}/><meshBasicMaterial color="#e8c680"/></mesh>
    <mesh position={[0,.055,0]}><sphereGeometry args={[important ? .075 : .045,10,8]}/><meshBasicMaterial color="#fff3d4"/></mesh>
    {important&&<pointLight color="#f2c574" intensity={1.6} distance={2.5} decay={2}/>}
  </group>;
}

function RouteGeometry({route,feature,emphasis=false}:{route:Route;feature:RegionFeature;emphasis?:boolean}) {
  const {surface:surfaceAt}=useTerrain();
  const sections=useMemo(()=>constrainedRoute(route.path,feature).map(section=>section.map(point=>surfaceAt(point,.065))),[route,feature,surfaceAt]);
  const geometries=useMemo(()=>sections.map((part)=>{
    const line=new THREE.CurvePath<THREE.Vector3>();
    for(let i=1;i<part.length;i++)line.add(new THREE.LineCurve3(part[i-1],part[i]));
    return new THREE.TubeGeometry(line,Math.max(8,part.length*2),.012,5,false);
  }),[sections]);
  useEffect(()=>()=>geometries.forEach((geometry)=>geometry.dispose()),[geometries]);
  const points=sections.flat();
  if(!points.length)return null;
  const vehicle=points[Math.floor(points.length/2)];
  return <group>
    {geometries.map((geometry,i)=><mesh key={i} geometry={geometry}><meshStandardMaterial color="#f0d295" emissive="#d2a052" emissiveIntensity={1.45} metalness={.25} roughness={.3}/></mesh>)}
    <Hub point={points[0]} important={emphasis}/><Hub point={points.at(-1)!}/>
    <group position={[vehicle.x,vehicle.y+.1,vehicle.z]}>
      <mesh castShadow><boxGeometry args={[.26,.15,.16]}/><meshStandardMaterial color="#d8d0bb" metalness={.55} roughness={.42}/></mesh>
      <mesh position={[-.055,.115,0]}><boxGeometry args={[.12,.09,.13]}/><meshStandardMaterial color="#f4e0ac" emissive="#ab7d3c" emissiveIntensity={.4}/></mesh>
    </group>
  </group>;
}

function RegionGroup({feature,boundary,selected,muted,hovered,onHover,onSelect,gate,visibility,onIncident}:{
  onIncident?:(id:string)=>void;
  visibility:VisibilitySettings;
  boundary:BoundarySegment[];
  feature:RegionFeature;selected:boolean;muted:boolean;hovered:boolean;onHover:(key:RegionKey,active:boolean)=>void;onSelect:(key:RegionKey)=>void;gate:MutableRefObject<InspectionGate>;
}) {
  const key=feature.properties.REGION_N;
  const {surface:surfaceAt,height:terrainHeight}=useTerrain();
  const group=useRef<THREE.Group>(null);
  const shadowMat=useRef<THREE.MeshBasicMaterial>(null);
  const changeTime=useRef(0);
  const prevSelected=useRef(selected);
  const layout=useMemo(()=>regionLayout(feature,surfaceAt),[feature,surfaceAt]);
  const recession=useRef(1);
  const renderMaterials=useRef<Array<{material:THREE.Material & {color?:THREE.Color;emissiveIntensity?:number};color?:THREE.Color;opacity:number;emissive:number;sprite:boolean}>>([]);
  const regionLights=useRef<Array<{light:THREE.Light;intensity:number}>>([]);
  const shapes=useMemo(()=>shapesFromFeature(feature),[feature]);
  const geometry=useMemo(()=>regionGeometries(feature,shapes,terrainHeight),[feature,shapes,terrainHeight]);
  const topMaterial=useMemo(()=>createTerrainMaterial(key),[key]);
  const wallMaterial=useMemo(()=>createCutFaceMaterial(),[]);
  useEffect(()=>()=>wallMaterial.dispose(),[wallMaterial]);
  const edge=useMemo(()=>createEdgeFinish(boundary),[boundary]);
  useEffect(()=>()=>{topMaterial.dispose();edge.geometry.dispose();edge.material.dispose();},[topMaterial,edge]);
  useEffect(()=>()=>{geometry.top.dispose();geometry.walls.dispose();geometry.underside.dispose();},[geometry]);
  const shadowGeometry=useMemo(()=>{
    const value=new THREE.ShapeGeometry(shapes);value.rotateX(-Math.PI/2);return value;
  },[shapes]);
  useEffect(()=>()=>{shadowGeometry.dispose();},[shadowGeometry]);
  useEffect(()=>{
    const seen=new Set<THREE.Material>();
    group.current?.traverse(object=>{
      const mesh=object as THREE.Mesh;
      if(mesh.material){
        for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
          if(seen.has(material))continue;seen.add(material);
          const m=material as THREE.MeshStandardMaterial;
          renderMaterials.current.push({material:m,color:m.color?.clone(),opacity:m.opacity,emissive:m.emissiveIntensity??0,sprite:object instanceof THREE.Sprite});
        }
      }
      if(object instanceof THREE.Light)regionLights.current.push({light:object,intensity:object.intensity});
    });
    return ()=>{
      // Restore bases before a hot-reload/recapture, preventing compounded background dimming.
      renderMaterials.current.forEach(({material,color,opacity,emissive})=>{if(color)material.color?.copy(color);material.opacity=opacity;if(material.emissiveIntensity!==undefined)material.emissiveIntensity=emissive;});
      regionLights.current.forEach(({light,intensity})=>{light.intensity=intensity;});
      renderMaterials.current=[];regionLights.current=[];
    };
  },[geometry,topMaterial,edge.material]);

  /* eslint-disable react-hooks/immutability -- Material uniforms are imperative GPU state, updated alongside the region animation. */
  useFrame((_,delta)=>{
    if(prevSelected.current!==selected){changeTime.current=performance.now();prevSelected.current=selected;}
    const elapsed=performance.now()-changeTime.current;
    if(group.current){
      const position=group.current.position;
      const translationReady=selected&&elapsed>450;
      const goalX=translationReady?layout.translation.x:0;
      const goalZ=translationReady?layout.translation.z:0;
      // Returning pieces travel home while raised, then settle into their exact shared seams.
      const returning=!selected&&Math.hypot(position.x,position.z)>.06;
      const goalY=(selected||returning) ? .76 : hovered&&!gate.current.locked ? .065 : 0;
      position.y=THREE.MathUtils.damp(position.y,goalY,selected?5.3:returning?6:6.2,Math.min(delta,.05));
      if(elapsed>450||!selected){
        position.x=THREE.MathUtils.damp(position.x,goalX,4.6,Math.min(delta,.05));
        position.z=THREE.MathUtils.damp(position.z,goalZ,4.6,Math.min(delta,.05));
      }
    }
    recession.current=THREE.MathUtils.damp(recession.current,muted?.2:1,3.8,delta);
    const intensity=recession.current;
    renderMaterials.current.forEach(({material,color,opacity,emissive,sprite})=>{
      if(color)material.color?.copy(color).multiplyScalar(intensity);
      if(material.emissiveIntensity!==undefined)material.emissiveIntensity=emissive*intensity*intensity;
      if(sprite)material.opacity=opacity*intensity*intensity;
    });
    regionLights.current.forEach(({light,intensity:base})=>{light.intensity=base*intensity*intensity;});
    topMaterial.userData.shimmerStrength.value=visibility.shimmer?intensity*intensity:0;
    topMaterial.userData.visibilityProbe.value=visibility.terrainProbe?1:0;
    edge.visibility.value=visibility.rim==='off'?0:visibility.rim==='probe'?12:1;
    edge.halo.value=visibility.halo?1:0;
    if(group.current)group.current.userData.visibility={dimmed:muted,strength:intensity,top:topMaterial.color.toArray(),shimmer:topMaterial.userData.shimmerStrength.value};
    edge.focus.value=THREE.MathUtils.damp(edge.focus.value,selected?1:0,4,delta);
    edge.hover.value=THREE.MathUtils.damp(edge.hover.value,hovered?1:0,4,delta);
    if(shadowMat.current)shadowMat.current.opacity=THREE.MathUtils.damp(shadowMat.current.opacity,selected ? .34 : .06,3.8,delta);
  });
  /* eslint-enable react-hooks/immutability */
  const pointerHandlers=createRegionPointerHandlers(key,gate,onHover,onSelect);
  return <>
    <mesh raycast={noDecorationRaycast} geometry={shadowGeometry} position={[0,-.285,0]} renderOrder={0}>
      <meshBasicMaterial ref={shadowMat} color="#000000" transparent opacity={.06} depthWrite={false} side={THREE.DoubleSide}/>
    </mesh>
    <group ref={group} name={`region-${key.toLowerCase().replaceAll(" ","-")}`} {...pointerHandlers}>
      <mesh geometry={geometry.underside} receiveShadow><meshStandardMaterial color="#111110" roughness={.9} side={THREE.DoubleSide}/></mesh>
      <mesh geometry={geometry.walls} material={wallMaterial} castShadow receiveShadow/>
      <mesh geometry={geometry.top} material={topMaterial} castShadow receiveShadow/>
      <mesh name="physical-edge-finish" geometry={edge.geometry} material={edge.material} raycast={noDecorationRaycast}/>
      <ArchitecturalDistrict feature={feature}/>
      {ROUTES[key].map((route,i)=><RouteGeometry key={route.id} route={route} feature={feature} emphasis={i===0}/>)}
      {LABELS[key].map((label)=><PlaceLabel key={label.text} {...label}/>)}
      {key===incident.regionKey&&<IncidentBeacon onIncident={onIncident} gate={gate}/>}
    </group>
  </>;
}

// Uniform gain preserves the approved light positions, colors and relative distribution.
const MAP_LIGHT_GAIN=1.3;
function World({geo,selectedRegion,onSelectRegion,onHoverRegion,command,onMotionChange,visibility,onIncident}:{
  onIncident?:(id:string)=>void;
  visibility:VisibilitySettings;
  geo:RegionCollection;selectedRegion:RegionKey|null;onSelectRegion:(key:RegionKey)=>void;onHoverRegion:(key:RegionKey|null)=>void;command:CameraCommand;onMotionChange:(busy:boolean)=>void;
}) {
  const [hovered,setHovered]=useState<RegionKey|null>(null);
  const gate=useRef<InspectionGate>({locked:true,moved:false});
  const terrain=useMemo(()=>createLandform(geo,geo.features.flatMap(f=>architectureFoundations(f.properties.REGION_N,p=>containsLand(p,f)))),[geo]);
  const layouts=useMemo(()=>Object.fromEntries(geo.features.map(f=>[f.properties.REGION_N,regionLayout(f,terrain.surface)])),[geo,terrain]);
  const boundaries=useMemo(()=>Object.fromEntries(geo.features.map(f=>[f.properties.REGION_N,terrainBoundary(f,terrain.surface)])),[geo,terrain]);
  useEffect(()=>{
    document.body.style.cursor=hovered?"pointer":"default";
    return ()=>{document.body.style.cursor="default";};
  },[hovered]);
  const hover=useMemo(()=>createRegionHoverOwner<RegionKey>((key)=>{
    setHovered(key);onHoverRegion(key);
  }),[onHoverRegion]);
  return <TerrainContext.Provider value={terrain}>
    <color attach="background" args={["#090909"]}/>
    <fog attach="fog" args={["#090909",60,115]}/>
    <ambientLight intensity={.45*MAP_LIGHT_GAIN}/>
    <hemisphereLight args={["#dfdcd4","#141412",.8*MAP_LIGHT_GAIN]}/>
    <directionalLight position={[-12,24,14]} intensity={2.7*MAP_LIGHT_GAIN} color="#f1e5d0" castShadow shadow-mapSize={[2048,2048]} shadow-camera-left={-32} shadow-camera-right={32} shadow-camera-top={30} shadow-camera-bottom={-30} shadow-bias={-.00025} shadow-radius={3}/>
    <directionalLight position={[10,11,-10]} intensity={1.05*MAP_LIGHT_GAIN} color="#deddd6"/>
    <directionalLight position={[0,4,22]} intensity={.8*MAP_LIGHT_GAIN} color="#e4e2da"/>
    <pointLight position={[2,6,6]} intensity={19*MAP_LIGHT_GAIN} color="#eac28a" distance={22} decay={2}/>
    <pointLight position={[-5,4,18]} intensity={10*MAP_LIGHT_GAIN} color="#ded8c8" distance={20} decay={2}/>
    <Environment resolution={64}>
      <Lightformer form="rect" intensity={1.8*MAP_LIGHT_GAIN} color="#e6e2d9" position={[-10,8,8]} rotation={[0,Math.PI/4,0]} scale={[12,10,1]}/>
      <Lightformer form="rect" intensity={1.1*MAP_LIGHT_GAIN} color="#cfb78a" position={[8,6,-8]} rotation={[0,-Math.PI*3/4,0]} scale={[8,5,1]}/>
    </Environment>
    <group position={[0,-.2,0]}>
      {geo.features.map((feature)=><RegionGroup key={feature.properties.REGION_N} feature={feature}
        visibility={visibility} onIncident={onIncident}
        boundary={boundaries[feature.properties.REGION_N]}
        selected={feature.properties.REGION_N===selectedRegion}
        muted={!!selectedRegion&&feature.properties.REGION_N!==selectedRegion}
        hovered={feature.properties.REGION_N===hovered}
        onHover={hover} onSelect={onSelectRegion} gate={gate}/>)}
    </group>
    <LiftDust selectedRegion={selectedRegion} geo={geo} visibility={visibility} layouts={layouts}/>
    <BaseMist geo={geo} focused={!!selectedRegion} enabled={visibility.support}/>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.51,0]} receiveShadow>
      <planeGeometry args={[90,65]}/><meshStandardMaterial color="#090909" metalness={.16} roughness={.89}/>
    </mesh>
    <ContactShadows position={[0,-.49,0]} opacity={.38} scale={57} blur={2.8} far={18} color="#000000"/>
    <InspectionCamera selectedRegion={selectedRegion} layouts={layouts} command={command} gate={gate} onMotionChange={onMotionChange}/>
    <SceneTelemetry/>
  </TerrainContext.Provider>;
}

export default function SingaporeScene({active,geo,selectedRegion,onSelectRegion,onHoverRegion,command,onMotionChange,onIncident}:{
  active:boolean;
  onIncident?:(id:string)=>void;
  geo:RegionCollection;selectedRegion:RegionKey|null;onSelectRegion:(key:RegionKey)=>void;onHoverRegion:(key:RegionKey|null)=>void;command:CameraCommand;onMotionChange:(busy:boolean)=>void;
}) {
  const [visibility,setVisibility]=useState(NORMAL_VISIBILITY);
  return <><Canvas className="singapore-canvas" camera={{position:[2.7,27.5,19.6],fov:30,near:.1,far:120}} frameloop={active?'always':'never'}
    dpr={[1,1.45]} shadows="percentage" gl={{antialias:true,alpha:false,toneMapping:THREE.ACESFilmicToneMapping,toneMappingExposure:1.2}}>
    <World geo={geo} selectedRegion={selectedRegion} onSelectRegion={onSelectRegion} onHoverRegion={onHoverRegion} command={command} onMotionChange={onMotionChange} visibility={visibility} onIncident={onIncident}/>
  </Canvas><VisibilityControls value={visibility} onChange={setVisibility}/></>;
}

