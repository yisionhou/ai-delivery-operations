"use client";

import {useEffect,useRef,useState} from 'react';
import type {Map as MapLibreMap} from 'maplibre-gl';
import type {FeatureCollection,LineString,Point} from 'geojson';
import {createOperationalMapStyle} from './operational-map-style';
import type {IncidentFocusMap} from './incident-read-api';

const BASE='#52b9ea',CANDIDATE='#ffd166',PROTECTED='#7ed8a7';

export default function BackendIncidentMap({map:focus,loading}:{map:IncidentFocusMap|null;loading:boolean}){
  const root=useRef<HTMLDivElement>(null),mapRef=useRef<MapLibreMap|null>(null);
  const [error,setError]=useState<string|null>(null);
  const hasMapData=Boolean(focus&&(focus.features.length||focus.approaches.length||focus.incidentPoint));

  useEffect(()=>{
    if(!focus||!hasMapData||!root.current)return;
    let cancelled=false;let observer:ResizeObserver|undefined;
    void import('maplibre-gl').then(({default:maplibregl})=>{
      if(cancelled||!root.current)return;
      const map=new maplibregl.Map({container:root.current,style:createOperationalMapStyle(),center:focus.incidentPoint??[103.84,1.32],zoom:11,pitch:0,dragRotate:false,attributionControl:false,cooperativeGestures:true});
      mapRef.current=map;
      map.on('error',()=>{if(!cancelled)setError('Basemap detail is unavailable; stored order paths may still be shown.');});
      map.on('load',()=>{
        if(cancelled)return;
        const paths:FeatureCollection<LineString>={type:'FeatureCollection',features:focus.features};
        const approaches:FeatureCollection<LineString>={type:'FeatureCollection',features:focus.approaches};
        const nodes:FeatureCollection<Point>={type:'FeatureCollection',features:focus.nodes.map(node=>({type:'Feature',properties:{order_id:node.order_id,vehicle_id:node.vehicle_id,plan:node.plan,kind:node.kind,completed:node.completed,label:node.kind[0]},geometry:{type:'Point',coordinates:node.point}}))};
        const incident:FeatureCollection<Point>={type:'FeatureCollection',features:focus.incidentPoint?[{type:'Feature',properties:{},geometry:{type:'Point',coordinates:focus.incidentPoint}}]:[]};
        map.addSource('incident-approach',{type:'geojson',data:approaches});
        map.addLayer({id:'incident-approach-line',type:'line',source:'incident-approach',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':CANDIDATE,'line-width':2.5,'line-opacity':.72,'line-dasharray':[2,2]}});
        map.addSource('incident-order-paths',{type:'geojson',data:paths});
        map.addLayer({id:'incident-affected-base',type:'line',source:'incident-order-paths',filter:['all',['==',['get','plan'],'base'],['!', ['get','completed']]],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':BASE,'line-width':4,'line-opacity':.95}});
        map.addLayer({id:'incident-protected-base',type:'line',source:'incident-order-paths',filter:['all',['==',['get','plan'],'base'],['get','completed']],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':PROTECTED,'line-width':4,'line-opacity':.95}});
        map.addLayer({id:'incident-candidate-delivery',type:'line',source:'incident-order-paths',filter:['==',['get','plan'],'candidate'],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':CANDIDATE,'line-width':4.5,'line-opacity':1}});
        map.addSource('incident-route-nodes',{type:'geojson',data:nodes});
        map.addLayer({id:'incident-route-node-circles',type:'circle',source:'incident-route-nodes',paint:{'circle-color':['case',['get','completed'],PROTECTED,['match',['get','kind'],'START','#fff0bf','PICKUP',BASE,'HANDOVER','#ff927e','DELIVERY',CANDIDATE,'#ffffff']],'circle-radius':8,'circle-stroke-color':'#09202a','circle-stroke-width':2}});
        map.addLayer({id:'incident-route-node-labels',type:'symbol',source:'incident-route-nodes',layout:{'text-field':['get','label'],'text-font':['Noto Sans Regular'],'text-size':10,'text-allow-overlap':true},paint:{'text-color':'#09202a'}});
        map.addSource('incident-detection-point',{type:'geojson',data:incident});
        map.addLayer({id:'incident-detection-circle',type:'circle',source:'incident-detection-point',paint:{'circle-color':'#ff635b','circle-opacity':.12,'circle-radius':17,'circle-stroke-color':'#ff635b','circle-stroke-width':3}});
        map.on('mouseenter','incident-route-node-circles',()=>{map.getCanvas().style.cursor='pointer';});
        map.on('mouseleave','incident-route-node-circles',()=>{map.getCanvas().style.cursor='';});
        map.on('click','incident-route-node-circles',event=>{
          const node=event.features?.[0];if(!node||node.geometry.type!=='Point')return;
          const content=document.createElement('div');
          const title=document.createElement('strong');title.textContent=`${node.properties?.kind??'Stop'} · ${node.properties?.plan??'Plan'}`;content.appendChild(title);
          const detail=document.createElement('div');detail.textContent=`Order ${node.properties?.order_id??'unknown'} · Vehicle ${node.properties?.vehicle_id??'unknown'}`;content.appendChild(detail);
          new maplibregl.Popup({closeButton:false,offset:12}).setLngLat(node.geometry.coordinates as [number,number]).setDOMContent(content).addTo(map);
        });
        const points=[...focus.features.flatMap(feature=>feature.geometry.coordinates),...focus.approaches.flatMap(feature=>feature.geometry.coordinates),...(focus.incidentPoint?[focus.incidentPoint]:[])];
        if(points.length>1){const bounds=new maplibregl.LngLatBounds();points.forEach(point=>bounds.extend(point));map.fitBounds(bounds,{padding:48,maxZoom:14,duration:0});}
        else if(points.length===1)map.jumpTo({center:points[0],zoom:13});
      });
      observer=new ResizeObserver(()=>map.resize());observer.observe(root.current!);
    }).catch(()=>{if(!cancelled)setError('Map could not start; affected-order details remain available below.');});
    return()=>{cancelled=true;observer?.disconnect();mapRef.current?.remove();mapRef.current=null;};
  },[focus,hasMapData]);

  return <section className="vf-card bi-card"><h2>Affected order routes</h2>
    {hasMapData?<div className="bi-map" ref={root} role="img" aria-label="Affected Base and Candidate road paths with pickup, handover, delivery and Incident nodes"/>:<p className="vf-muted">{loading?'Loading affected-order route snapshots…':'No verifiable affected-order road path or Incident location is available.'}</p>}
    <div className="bi-map-legend"><span><i className="base-affected"/>Base affected</span>{focus?.hasCandidate&&<span><i className="candidate"/>Candidate delivery</span>}<span><i className="protected"/>Completed protected</span>{Boolean(focus?.approaches.length)&&<span><i className="approach"/>Replacement approach</span>}<span><i className="node"/>Start / Pickup / Handover / Delivery</span>{focus?.incidentPoint&&<span><i className="incident"/>Incident at detection</span>}</div>
    <p className="vf-muted">{focus?.features.length??0} affected-order paths · {focus?.nodes.length??0} route nodes. Only saved OSRM legs for affected orders and the replacement approach are shown; unrelated vehicle routes are omitted.</p>
    {focus?.warnings.map(warning=><p className="vf-handoff-note" role="status" key={warning}>{warning}</p>)}
    {error&&<p className="vf-handoff-note" role="status">{error}</p>}
    {hasMapData&&<p className="bi-map-attribution"><a href="https://openfreemap.org/" target="_blank" rel="noreferrer">OpenFreeMap</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a></p>}
  </section>;
}
