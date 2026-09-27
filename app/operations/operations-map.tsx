"use client";
import {useEffect,useRef,useState} from 'react';
import {Crosshair,Minus,Plus} from 'lucide-react';
import type {Map as MapLibreMap,Marker,GeoJSONSource,VectorTileSource} from 'maplibre-gl';
import type {FeatureCollection,Feature} from 'geojson';
import type {OperationsSnapshot,Route,Coordinate} from './operations-data';
import {pointAlongRoute} from './route-position';
import {roadAlignmentLabel} from './operations-route-label';
import {createOperationalMapStyle,OPERATIONAL_TILEJSON,roadAccentData,operationalRouteStyle} from '../incidents/operational-map-style';
import {singaporeBounds} from './singapore-basemap';

type Props={active:boolean;snapshot:OperationsSnapshot;mode:'planning'|'live';selectedRoute:string|null;onSelectRoute:(id:string)=>void;onOpenIncident:(id:string)=>void};
const center:Coordinate=[103.842,1.323];
function lines(routes:Route[],mode:Props['mode']):FeatureCollection{
  const features:Feature[]=[];
  for(const route of routes){
    const split=route.firstDeliveryPathIndex;
    const parts=mode==='planning'?[{points:route.path,kind:'planned'}]:[{points:route.path.slice(0,split+1),kind:'pickup'},{points:route.path.slice(split),kind:'delivery'}];
    for(const part of parts)if(part.points.length>1)features.push({type:'Feature',properties:{route:route.id,kind:part.kind,selected:false},geometry:{type:'LineString',coordinates:part.points}});
  }
  return {type:'FeatureCollection',features};
}
export default function OperationsMap({active,snapshot,mode,selectedRoute,onSelectRoute,onOpenIncident}:Props){
  const root=useRef<HTMLDivElement>(null),mapRef=useRef<MapLibreMap|null>(null),staticMarkers=useRef<Marker[]>([]),vehicleMarkers=useRef(new Map<string,Marker>()),markerType=useRef<typeof import('maplibre-gl').Marker|null>(null),handlers=useRef({onSelectRoute,onOpenIncident}),startedAt=useRef(0);
  const [ready,setReady]=useState(false),[error,setError]=useState<string|null>(null);
  useEffect(()=>{handlers.current={onSelectRoute,onOpenIncident};},[onSelectRoute,onOpenIncident]);
  useEffect(()=>{
    let cancelled=false;const element=root.current!,vehicles=vehicleMarkers.current;let observer:ResizeObserver|undefined;
    startedAt.current=Date.now();
    void import('maplibre-gl').then(({default:maplibregl})=>{
      if(cancelled)return;
      const map=new maplibregl.Map({container:element,center,zoom:10.9,minZoom:10,maxZoom:17,maxBounds:singaporeBounds,pitch:0,dragRotate:false,touchPitch:false,attributionControl:false,cooperativeGestures:true,style:createOperationalMapStyle()});
      mapRef.current=map;markerType.current=maplibregl.Marker;map.touchZoomRotate.disableRotation();
      map.on('error',()=>setError('Map detail is temporarily unavailable. Retry the basemap.'));
      let accentKey='';
      map.on('idle',()=>{if(!map.getLayer('nexus-roads-major'))return;const accents=roadAccentData(map),key=JSON.stringify(accents);if(key!==accentKey){accentKey=key;(map.getSource('nexus-road-lights') as GeoJSONSource).setData(accents);}});
      map.on('sourcedata',event=>{if(event.sourceId==='nexus-base'&&event.isSourceLoaded)setError(null);});
      map.on('load',()=>{
        if(cancelled)return;
        map.addSource('operation-routes',{type:'geojson',data:lines([],'planning')});
        map.addLayer({id:'operation-route-glow',type:'line',source:'operation-routes',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':['match',['get','kind'],'pickup','#e9e6da','delivery','#a7ddb0','#f1d293'],'line-width':operationalRouteStyle.candidate.glowWidth,'line-opacity':operationalRouteStyle.candidate.glowOpacity,'line-blur':operationalRouteStyle.candidate.glowBlur}});
        map.addLayer({id:'operation-route-planned',type:'line',source:'operation-routes',filter:['==',['get','kind'],'planned'],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#f1d293','line-width':operationalRouteStyle.candidate.width,'line-opacity':1}});
        map.addLayer({id:'operation-route-pickup',type:'line',source:'operation-routes',filter:['==',['get','kind'],'pickup'],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#f0efe8','line-width':operationalRouteStyle.base.width,'line-opacity':.95,'line-dasharray':[2,1.5]}});
        map.addLayer({id:'operation-route-delivery',type:'line',source:'operation-routes',filter:['==',['get','kind'],'delivery'],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#a9dfb6','line-width':operationalRouteStyle.completed.width,'line-opacity':.96}});
        for(const layer of ['operation-route-planned','operation-route-pickup','operation-route-delivery'])map.on('click',layer,event=>{const id=event.features?.[0]?.properties?.route;if(typeof id==='string')handlers.current.onSelectRoute(id);});
        setReady(true);
      });
      observer=new ResizeObserver(()=>map.resize());observer.observe(element);
    }).catch(()=>{if(!cancelled)setError('The map could not start. Reload to retry.');});
    return()=>{cancelled=true;observer?.disconnect();staticMarkers.current.forEach(marker=>marker.remove());staticMarkers.current=[];vehicles.forEach(marker=>marker.remove());vehicles.clear();mapRef.current?.remove();mapRef.current=null;};
  },[]);
  useEffect(()=>{
    const map=mapRef.current;if(!ready||!map)return;
    if(!active){map.stop();return;}
    const frame=window.requestAnimationFrame(()=>map.resize());
    return()=>window.cancelAnimationFrame(frame);
  },[active,ready]);
  useEffect(()=>{
    const map=mapRef.current;if(!ready||!map)return;
    (map.getSource('operation-routes') as GeoJSONSource).setData(lines(mode==='planning'&&!snapshot.plan?[]:snapshot.routes,mode));
    staticMarkers.current.forEach(marker=>marker.remove());staticMarkers.current=[];
    vehicleMarkers.current.forEach(marker=>marker.remove());vehicleMarkers.current.clear();
    const MapMarker=markerType.current;if(!MapMarker)return;
      const add=(coordinate:Coordinate,className:string,label:string,onClick?:()=>void)=>{
        const element=document.createElement(onClick?'button':'div');element.className=`ops-marker ${className}`;element.title=label;element.setAttribute('aria-label',label);
        if(onClick){element.setAttribute('type','button');element.onclick=event=>{event.stopPropagation();onClick();};}
        return new MapMarker({element,anchor:'center'}).setLngLat(coordinate).addTo(map);
      };
      snapshot.routes.forEach((route,index)=>{
        route.stops.forEach(stop=>staticMarkers.current.push(add(stop.point,`ops-marker-${stop.kind.toLowerCase()} ${stop.risk==='AT_RISK'&&mode==='live'?'risk':''}`,`${stop.kind} ${stop.order} · ${stop.place}`,()=>handlers.current.onSelectRoute(route.id))));
        if(mode==='live'){
          const phase=route.status==='UNAVAILABLE'?.63:((Math.floor((Date.now()-startedAt.current)/1000)/120+index*.19)%1);
          const position=snapshot.source==='API'?route.path[0]:pointAlongRoute(route.path,phase);
          if(position)vehicleMarkers.current.set(route.id,add(position,`ops-marker-vehicle ${route.status==='UNAVAILABLE'?'incident':route.status==='AT_RISK'?'risk':''}`,`${route.vehicle} · simulated position`,()=>handlers.current.onSelectRoute(route.id)));
        }
      });
      if(mode==='live'&&snapshot.source==='DEMO'){
        const incident=snapshot.alerts.find(alert=>alert.incidentId);
        const route=snapshot.routes.find(item=>item.vehicle===incident?.vehicle);
        if(incident?.incidentId&&route)staticMarkers.current.push(add(pointAlongRoute(route.path,.63),'ops-marker-incident',`${incident.title} · ${incident.incidentId}`,()=>handlers.current.onOpenIncident(incident.incidentId!)));
      }
  },[ready,snapshot.routes,snapshot.alerts,snapshot.source,snapshot.plan,mode]);
  useEffect(()=>{
    if(snapshot.source!=='API'||mode!=='live')return;
    for(const [id,point] of Object.entries(snapshot.positions??{}))vehicleMarkers.current.get(id)?.setLngLat(point);
  },[ready,snapshot.positions,snapshot.source,mode]);
  useEffect(()=>{
    vehicleMarkers.current.forEach((marker,id)=>marker.getElement().classList.toggle('selected',id===selectedRoute));
  },[ready,snapshot,mode,selectedRoute]);
  useEffect(()=>{
    if(!active||!ready||mode!=='live'||snapshot.source==='API')return;
    const update=()=>{
      const tick=Math.floor((Date.now()-startedAt.current)/1000);
      snapshot.routes.forEach((route,index)=>{
        if(route.status==='UNAVAILABLE')return;
        vehicleMarkers.current.get(route.id)?.setLngLat(pointAlongRoute(route.path,(tick/120+index*.19)%1));
      });
    };
    update();
    const timer=window.setInterval(update,1000);
    return()=>window.clearInterval(timer);
  },[active,ready,mode,snapshot.routes,snapshot.source]);
  return <div className="ops-map-wrap">
    <div ref={root} className="ops-map-canvas" aria-label="Interactive Singapore operations map"/>
    <div className="ops-map-shade"/>
    <div className="ops-map-heading"><span>SINGAPORE</span><small>{snapshot.source==='API'&&snapshot.routes.length?roadAlignmentLabel(snapshot.routes,selectedRoute):mode==='planning'?'PLANNING NETWORK':'SIMULATED LIVE VIEW'}</small></div>
    <div className="ops-map-controls"><button aria-label="Recenter map" onClick={()=>mapRef.current?.flyTo({center,zoom:10.9})}><Crosshair/></button><button aria-label="Zoom in map" onClick={()=>mapRef.current?.zoomIn()}><Plus/></button><button aria-label="Zoom out map" onClick={()=>mapRef.current?.zoomOut()}><Minus/></button></div>
    <div className="ops-map-legend"><span><i className="pickup"/>Pickup {mode==='live'?'route':'point'}</span><span><i className="delivery"/>Delivery {mode==='live'?'route':'point'}</span>{mode==='live'&&<><span><i className="risk"/>At risk</span><span><i className="incident"/>Incident</span></>}</div>
    {(!ready||error)&&<div className="ops-map-message" role="status">{error??'Loading Singapore · NEXUS night map'}{error&&<button onClick={()=>{setError(null);(mapRef.current?.getSource('nexus-base') as VectorTileSource|undefined)?.setUrl(OPERATIONAL_TILEJSON);}}>Retry basemap</button>}</div>}
    <div className="ops-map-attribution"><span>NEXUS · NOCTURNE</span> · <a href="https://openfreemap.org/" target="_blank" rel="noreferrer">OpenFreeMap</a> · © <a href="https://openmaptiles.org/" target="_blank" rel="noreferrer">OpenMapTiles</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a></div>
  </div>;
}
