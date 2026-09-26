"use client";
/* eslint-disable @next/next/no-img-element -- OneMap attribution includes its provider logo. */
import {useEffect,useRef,useState} from 'react';
import {Crosshair,Minus,Plus} from 'lucide-react';
import type {Map as MapLibreMap,Marker,GeoJSONSource} from 'maplibre-gl';
import type {FeatureCollection,Feature} from 'geojson';
import type {OperationsSnapshot,Route,Coordinate} from './operations-data';
import {singaporeBasemapStyle,singaporeBounds} from './singapore-basemap';

type Props={snapshot:OperationsSnapshot;mode:'planning'|'live';selectedRoute:string|null;onSelectRoute:(id:string)=>void;onOpenIncident:(id:string)=>void};
const center:Coordinate=[103.842,1.323];
function lines(routes:Route[],mode:Props['mode']):FeatureCollection{
  const features:Feature[]=[];
  for(const route of routes){
    const split=Math.max(1,Math.floor(route.path.length/2));
    const parts=mode==='planning'?[{points:route.path,kind:'planned'}]:[{points:route.path.slice(0,split+1),kind:'pickup'},{points:route.path.slice(split),kind:'delivery'}];
    for(const part of parts)if(part.points.length>1)features.push({type:'Feature',properties:{route:route.id,kind:part.kind,selected:false},geometry:{type:'LineString',coordinates:part.points}});
  }
  return {type:'FeatureCollection',features};
}
function pointAlong(path:Coordinate[],fraction:number):Coordinate{
  const at=Math.min(path.length-1.00001,Math.max(0,fraction*(path.length-1)));
  const index=Math.floor(at),progress=at-index;
  return [path[index][0]+(path[index+1][0]-path[index][0])*progress,path[index][1]+(path[index+1][1]-path[index][1])*progress];
}
export default function OperationsMap({snapshot,mode,selectedRoute,onSelectRoute,onOpenIncident}:Props){
  const root=useRef<HTMLDivElement>(null),mapRef=useRef<MapLibreMap|null>(null),markerRef=useRef<Marker[]>([]),markerType=useRef<typeof import('maplibre-gl').Marker|null>(null),handlers=useRef({onSelectRoute,onOpenIncident});
  const [ready,setReady]=useState(false),[error,setError]=useState<string|null>(null),[tick,setTick]=useState(0);
  useEffect(()=>{handlers.current={onSelectRoute,onOpenIncident};},[onSelectRoute,onOpenIncident]);
  useEffect(()=>{if(mode!=='live')return;const timer=window.setInterval(()=>setTick(value=>value+1),1000);return()=>window.clearInterval(timer);},[mode]);
  useEffect(()=>{
    let cancelled=false;const element=root.current!;let observer:ResizeObserver|undefined;
    void import('maplibre-gl').then(({default:maplibregl})=>{
      if(cancelled)return;
      const map=new maplibregl.Map({container:element,center,zoom:10.9,minZoom:10,maxZoom:17,maxBounds:singaporeBounds,pitch:0,dragRotate:false,touchPitch:false,attributionControl:false,cooperativeGestures:true,style:singaporeBasemapStyle()});
      mapRef.current=map;markerType.current=maplibregl.Marker;map.touchZoomRotate.disableRotation();
      map.on('error',()=>setError('OneMap tiles are unavailable. Check the network connection.'));
      map.on('sourcedata',event=>{if(event.sourceId==='onemap'&&event.isSourceLoaded)setError(null);});
      map.on('load',()=>{
        if(cancelled)return;
        map.addSource('operation-routes',{type:'geojson',data:lines([],mode)});
        map.addLayer({id:'operation-route-glow',type:'line',source:'operation-routes',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':['match',['get','kind'],'pickup','#e9e6da','delivery','#a7ddb0','#d8bb79'],'line-width':11,'line-opacity':.17,'line-blur':6}});
        map.addLayer({id:'operation-route-planned',type:'line',source:'operation-routes',filter:['==',['get','kind'],'planned'],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#e1be7c','line-width':3,'line-opacity':.85}});
        map.addLayer({id:'operation-route-pickup',type:'line',source:'operation-routes',filter:['==',['get','kind'],'pickup'],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#f0efe8','line-width':3,'line-opacity':.95,'line-dasharray':[2,1.5]}});
        map.addLayer({id:'operation-route-delivery',type:'line',source:'operation-routes',filter:['==',['get','kind'],'delivery'],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#a9dfb6','line-width':3.2,'line-opacity':.96}});
        for(const layer of ['operation-route-planned','operation-route-pickup','operation-route-delivery'])map.on('click',layer,event=>{const id=event.features?.[0]?.properties?.route;if(typeof id==='string')handlers.current.onSelectRoute(id);});
        setReady(true);
      });
      observer=new ResizeObserver(()=>map.resize());observer.observe(element);
    }).catch(()=>{if(!cancelled)setError('The map could not start. Reload to retry.');});
    return()=>{cancelled=true;observer?.disconnect();markerRef.current.forEach(marker=>marker.remove());markerRef.current=[];mapRef.current?.remove();mapRef.current=null;};
  },[mode]);
  useEffect(()=>{
    const map=mapRef.current;if(!ready||!map)return;
    (map.getSource('operation-routes') as GeoJSONSource).setData(lines(mode==='planning'&&!snapshot.plan?[]:snapshot.routes,mode));
    markerRef.current.forEach(marker=>marker.remove());markerRef.current=[];
    const MapMarker=markerType.current;if(!MapMarker)return;
      const add=(coordinate:Coordinate,className:string,label:string,onClick?:()=>void)=>{
        const element=document.createElement(onClick?'button':'div');element.className=`ops-marker ${className}`;element.title=label;element.setAttribute('aria-label',label);
        if(onClick){element.setAttribute('type','button');element.onclick=event=>{event.stopPropagation();onClick();};}
        const marker=new MapMarker({element,anchor:'center'}).setLngLat(coordinate).addTo(map);markerRef.current.push(marker);
      };
      snapshot.routes.forEach(route=>{
        route.stops.forEach(stop=>add(stop.point,`ops-marker-${stop.kind.toLowerCase()} ${stop.risk==='AT_RISK'&&mode==='live'?'risk':''}`,`${stop.kind} ${stop.order} · ${stop.place}`,()=>handlers.current.onSelectRoute(route.id)));
        if(mode==='live'){
          // Demo animation is intentionally visual only; ETA/risk come from the fixture.
          const phase=route.status==='UNAVAILABLE'?.63:((tick/120+snapshot.routes.indexOf(route)*.19)%1);
          add(pointAlong(route.path,phase),`ops-marker-vehicle ${route.status==='UNAVAILABLE'?'incident':route.status==='AT_RISK'?'risk':''} ${selectedRoute===route.id?'selected':''}`,`${route.vehicle} · simulated position`,()=>handlers.current.onSelectRoute(route.id));
        }
      });
      if(mode==='live'){
        const incident=snapshot.alerts.find(alert=>alert.incidentId);
        const route=snapshot.routes.find(item=>item.vehicle===incident?.vehicle);
        if(incident?.incidentId&&route)add(pointAlong(route.path,.63),'ops-marker-incident',`${incident.title} · ${incident.incidentId}`,()=>handlers.current.onOpenIncident(incident.incidentId!));
      }
  },[ready,snapshot,mode,selectedRoute,tick]);
  return <div className="ops-map-wrap">
    <div ref={root} className="ops-map-canvas" aria-label="Interactive Singapore operations map"/>
    <div className="ops-map-shade"/>
    <div className="ops-map-heading"><span>SINGAPORE</span><small>{mode==='planning'?'PLANNING NETWORK':'SIMULATED LIVE VIEW'}</small></div>
    <div className="ops-map-controls"><button aria-label="Recenter map" onClick={()=>mapRef.current?.flyTo({center,zoom:10.9})}><Crosshair/></button><button aria-label="Zoom in map" onClick={()=>mapRef.current?.zoomIn()}><Plus/></button><button aria-label="Zoom out map" onClick={()=>mapRef.current?.zoomOut()}><Minus/></button></div>
    <div className="ops-map-legend"><span><i className="pickup"/>Pickup {mode==='live'?'route':'point'}</span><span><i className="delivery"/>Delivery {mode==='live'?'route':'point'}</span>{mode==='live'&&<><span><i className="risk"/>At risk</span><span><i className="incident"/>Incident</span></>}</div>
    {(!ready||error)&&<div className="ops-map-message" role="status">{error??'Loading Singapore · OneMap'}</div>}
    <div className="ops-map-attribution"><a href="https://www.onemap.gov.sg/" target="_blank" rel="noreferrer"><img src="https://www.onemap.gov.sg/web-assets/images/logo/om_logo.png" alt=""/>OneMap</a> © contributors · <a href="https://www.sla.gov.sg/" target="_blank" rel="noreferrer">Singapore Land Authority</a></div>
  </div>;
}
