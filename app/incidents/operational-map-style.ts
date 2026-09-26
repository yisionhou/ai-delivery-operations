import type {Map,StyleSpecification,FilterSpecification,ExpressionSpecification} from 'maplibre-gl';
import type {FeatureCollection,Point,Position} from 'geojson';

// Shared 2D visual system. No incident, vehicle, region or business-plan data here.
// OpenFreeMap serves OpenMapTiles / OSM geography without an API key.
export const OPERATIONAL_TILEJSON='https://tiles.openfreemap.org/planet';
export const operationalMapPalette={land:'#0c1e25',water:'#06131a',gold:'#c3a36d',coral:'#ff7965',recovery:'#ffe5ad',protected:'#91d6b2'};
// Operational overlays share colors and glow strengths across future 2D scenes.
export const operationalRouteStyle={
  completed:{color:operationalMapPalette.protected,width:2.6,opacity:.65},
  base:{color:'#c6b798',width:2.4,opacity:.45},
  candidate:{color:operationalMapPalette.recovery,width:3.6,opacity:1,outerWidth:16,outerOpacity:.12,outerBlur:7,glowWidth:9,glowOpacity:.28,glowBlur:4},
  affected:{color:operationalMapPalette.coral,width:4,opacity:.98,outerWidth:28,outerOpacity:.16,outerBlur:10,glowWidth:12,glowOpacity:.3,glowBlur:4},
};
const major:FilterSpecification=['match',['get','class'],['motorway','trunk','primary','secondary'],true,false];
const roadWidth:ExpressionSpecification=['interpolate',['linear'],['zoom'],10,.4,12,.65,15,1.5,18,4];

export function createOperationalMapStyle():StyleSpecification{
  return {version:8,name:'NEXUS · Nocturne',glyphs:'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',sources:{
    'nexus-base':{type:'vector',url:OPERATIONAL_TILEJSON},
    'nexus-road-lights':{type:'geojson',data:{type:'FeatureCollection',features:[]}},
  },layers:[
    {id:'nexus-land',type:'background',paint:{'background-color':operationalMapPalette.land}},
    {id:'nexus-landcover',type:'fill',source:'nexus-base','source-layer':'landcover',paint:{'fill-color':'#10282b','fill-opacity':.65}},
    {id:'nexus-urban',type:'fill',source:'nexus-base','source-layer':'landuse',paint:{'fill-color':['match',['get','class'],'industrial','#15272c','residential','#11252c','commercial','#192c31','#102329'],'fill-opacity':.7}},
    {id:'nexus-water',type:'fill',source:'nexus-base','source-layer':'water',paint:{'fill-color':operationalMapPalette.water}},
    {id:'nexus-coast',type:'line',source:'nexus-base','source-layer':'water',paint:{'line-color':'#665e43','line-width':.7,'line-opacity':.6}},
    {id:'nexus-waterways',type:'line',source:'nexus-base','source-layer':'waterway',paint:{'line-color':'#254048','line-width':1.2,'line-opacity':.7}},
    {id:'nexus-buildings',type:'fill',source:'nexus-base','source-layer':'building',minzoom:12,paint:{'fill-color':'#1d343a','fill-outline-color':'#385051','fill-opacity':.78}},
    {id:'nexus-roads-fine',type:'line',source:'nexus-base','source-layer':'transportation',filter:['match',['get','class'],['street','street_limited','tertiary','service','minor'],true,false],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#9b835b','line-width':['interpolate',['linear'],['zoom'],10,.25,12,.55,15,1.1,18,3],'line-opacity':.54}},
    {id:'nexus-roads-halo',type:'line',source:'nexus-base','source-layer':'transportation',filter:major,layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#d5a759','line-width':['interpolate',['linear'],['zoom'],10,4,12,6,15,9,18,16],'line-opacity':.055,'line-blur':4}},
    {id:'nexus-roads-major',type:'line',source:'nexus-base','source-layer':'transportation',filter:major,layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':operationalMapPalette.gold,'line-width':roadWidth,'line-opacity':.5}},
    {id:'nexus-rail',type:'line',source:'nexus-base','source-layer':'transportation',filter:['==',['get','class'],'rail'],paint:{'line-color':'#6b8486','line-width':.6,'line-opacity':.25,'line-dasharray':[2,3]}},
    {id:'nexus-lights-bloom',type:'circle',source:'nexus-road-lights',paint:{'circle-color':'#f5c878','circle-radius':11,'circle-blur':1,'circle-opacity':.24}},
    {id:'nexus-lights-soft',type:'circle',source:'nexus-road-lights',paint:{'circle-color':'#edc98c','circle-radius':4,'circle-blur':.8,'circle-opacity':.38}},
    {id:'nexus-lights-core',type:'circle',source:'nexus-road-lights',paint:{'circle-color':'#ffe8b8','circle-radius':1.1,'circle-opacity':.85}},
    {id:'nexus-district-labels',type:'symbol',source:'nexus-base','source-layer':'place',filter:['match',['get','class'],['city','town','suburb','quarter','neighbourhood','village'],true,false],layout:{'text-field':['coalesce',['get','name:en'],['get','name:latin'],['get','name']],'text-font':['Noto Sans Regular'],'text-size':['interpolate',['linear'],['zoom'],10,12,14,14],'text-padding':25,'text-max-width':9},paint:{'text-color':'#b6c5c3','text-halo-color':'#07161d','text-halo-width':1.8,'text-opacity':.78}},
    {id:'nexus-street-labels',type:'symbol',source:'nexus-base','source-layer':'transportation_name',minzoom:14,layout:{'symbol-placement':'line','text-field':['coalesce',['get','name:en'],['get','name']],'text-font':['Noto Sans Regular'],'text-size':11,'symbol-spacing':350,'text-padding':10},paint:{'text-color':'#b1a58e','text-halo-color':'#07161d','text-halo-width':1.3}},
    {id:'nexus-context-dimmer',type:'background',paint:{'background-color':'#06131a','background-opacity':0}},
  ]};
}

// Decorative road accents follow actual vector-road endpoints. They are not GPS
// vehicles, business events, or invented streets. De-duplicate tiled geometries
// and thin in screen space so every Singapore scene shares the same density.
export function roadAccentData(map:Map):FeatureCollection<Point>{
  const points=new globalThis.Map<string,{coordinate:Position;roads:Set<string>}>();
  for(const feature of map.queryRenderedFeatures({layers:['nexus-roads-major']})){
    const lines=feature.geometry.type==='LineString'?[feature.geometry.coordinates]:feature.geometry.type==='MultiLineString'?feature.geometry.coordinates:[];
    for(const line of lines){if(line.length<2)continue;const road=String(feature.id??JSON.stringify(line));
      for(const coordinate of [line[0],line[line.length-1]]){const key=coordinate.map(value=>value.toFixed(5)).join(',');const entry=points.get(key)??{coordinate,roads:new Set<string>()};entry.roads.add(road);points.set(key,entry);}
    }
  }
  const cells=new Set<string>(),features:FeatureCollection<Point>['features']=[];
  for(const [key,point] of [...points.entries()].sort(([a],[b])=>a.localeCompare(b))){
    if(point.roads.size<2)continue;
    const screen=map.project(point.coordinate as [number,number]);
    if(screen.x<12||screen.y<12||screen.x>map.getCanvas().clientWidth-12||screen.y>map.getCanvas().clientHeight-12)continue;
    const cell=`${Math.floor(screen.x/60)}:${Math.floor(screen.y/60)}`;
    if(cells.has(cell))continue;cells.add(cell);features.push({type:'Feature',id:key,properties:{},geometry:{type:'Point',coordinates:point.coordinate}});
    if(features.length===120)break;
  }
  return {type:'FeatureCollection',features};
}
