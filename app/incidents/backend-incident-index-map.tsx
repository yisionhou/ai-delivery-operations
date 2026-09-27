"use client";

import {useEffect,useRef,useState} from 'react';
import type {Map as MapLibreMap} from 'maplibre-gl';
import type {FeatureCollection,LineString,Point} from 'geojson';
import {createOperationalMapStyle} from './operational-map-style';
import type {IncidentIndexMap as MapData} from './incident-read-api';

const empty:MapData={features:[],incidents:[],warnings:[]};

export default function BackendIncidentIndexMap({data,loading,date}:{data:MapData|null;loading:boolean;date:string}){
  const root=useRef<HTMLDivElement>(null),mapRef=useRef<MapLibreMap|null>(null);
  const [error,setError]=useState<string|null>(null);
  const shown=data??empty,hasMapData=shown.features.length>0||shown.incidents.length>0;

  useEffect(()=>{
    if(!data||!hasMapData||!root.current)return;
    let cancelled=false;let observer:ResizeObserver|undefined;
    void import('maplibre-gl').then(({default:maplibregl})=>{
      if(cancelled||!root.current)return;
      const map=new maplibregl.Map({container:root.current,style:createOperationalMapStyle(),center:[103.84,1.32],zoom:11,pitch:0,dragRotate:false,attributionControl:false,cooperativeGestures:true});
      mapRef.current=map;
      map.on('error',()=>{if(!cancelled)setError('Basemap detail is unavailable; stored Incident routes may still be shown.');});
      map.on('load',()=>{
        if(cancelled)return;
        const lines:FeatureCollection<LineString>={type:'FeatureCollection',features:data.features};
        const endpoints:FeatureCollection<Point>={type:'FeatureCollection',features:data.features.map(feature=>({type:'Feature',properties:feature.properties,geometry:{type:'Point',coordinates:feature.geometry.coordinates.at(-1)!}}))};
        const incidents:FeatureCollection<Point>={type:'FeatureCollection',features:data.incidents.map(item=>({type:'Feature',properties:{incident_id:item.id,incident_code:item.code},geometry:{type:'Point',coordinates:item.point}}))};
        map.addSource('affected-orders',{type:'geojson',data:lines});
        map.addLayer({id:'affected-base',type:'line',source:'affected-orders',filter:['all',['==',['get','plan'],'base'],['!', ['get','completed']]],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#ff7965','line-width':3.5,'line-opacity':.92}});
        map.addLayer({id:'affected-completed',type:'line',source:'affected-orders',filter:['all',['==',['get','plan'],'base'],['get','completed']],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#91d6b2','line-width':3,'line-opacity':.85}});
        map.addLayer({id:'affected-candidate',type:'line',source:'affected-orders',filter:['==',['get','plan'],'candidate'],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#ffe5ad','line-width':4,'line-opacity':.98}});
        map.addSource('affected-deliveries',{type:'geojson',data:endpoints});
        map.addLayer({id:'affected-delivery-points',type:'circle',source:'affected-deliveries',paint:{'circle-color':['match',['get','plan'],'candidate','#ffe5ad','#ff7965'],'circle-radius':5,'circle-stroke-color':'#102027','circle-stroke-width':2}});
        map.addSource('incident-locations',{type:'geojson',data:incidents});
        map.addLayer({id:'incident-locations',type:'circle',source:'incident-locations',paint:{'circle-color':'#ff7965','circle-radius':9,'circle-stroke-color':'#fff2d6','circle-stroke-width':2}});
        for(const layer of ['affected-base','affected-completed','affected-candidate','affected-delivery-points','incident-locations']){
          map.on('mouseenter',layer,()=>{map.getCanvas().style.cursor='pointer';});
          map.on('mouseleave',layer,()=>{map.getCanvas().style.cursor='';});
          map.on('click',layer,event=>{
            const feature=event.features?.[0];if(!feature)return;
            const container=document.createElement('div');
            const title=document.createElement('strong');title.textContent=feature.properties?.incident_code??`Incident ${feature.properties?.incident_id??''}`;container.appendChild(title);
            if(feature.properties?.order_id){const detail=document.createElement('div');detail.textContent=`Affected order ${feature.properties.order_id} · ${feature.properties.plan} route`;container.appendChild(detail);}
            const id=feature.properties?.incident_id;
            if(id){const link=document.createElement('a');link.href=`/incidents?${new URLSearchParams({source:'api',business_date:date,incident_id:id})}`;link.textContent='Open Incident';container.appendChild(link);}
            const point=feature.geometry.type==='Point'?feature.geometry.coordinates:event.lngLat.toArray();
            new maplibregl.Popup({closeButton:false,offset:12}).setLngLat(point as [number,number]).setDOMContent(container).addTo(map);
          });
        }
        const points=[...data.features.flatMap(feature=>feature.geometry.coordinates),...data.incidents.map(item=>item.point)];
        if(points.length>1){const bounds=new maplibregl.LngLatBounds();points.forEach(point=>bounds.extend(point));map.fitBounds(bounds,{padding:60,maxZoom:14,duration:0});}
        else if(points.length===1)map.jumpTo({center:points[0],zoom:13});
      });
      observer=new ResizeObserver(()=>map.resize());observer.observe(root.current!);
    }).catch(()=>{if(!cancelled)setError('Map could not start; the Incident list remains available below.');});
    return()=>{cancelled=true;observer?.disconnect();mapRef.current?.remove();mapRef.current=null;};
  },[data,hasMapData,date]);

  return <section className="bi-index-hero" aria-label="Incident affected-order routes">
    <div className="bi-index-map-title"><span>OPERATIONS / INCIDENTS</span><h2>Incident Focus</h2><p>Road paths for Incident-affected orders on this business date.</p></div>
    {hasMapData?<div className="bi-index-map" ref={root} role="img" aria-label="Road paths from pickup or handover to delivery for Incident-affected orders, with Incident locations"/>:<div className="bi-index-map bi-index-map-empty" role="status">{loading?'Loading affected-order routes…':'No affected-order road paths are available for these Incidents.'}</div>}
    <div className="bi-index-map-footer"><div className="bi-map-legend"><span><i className="affected"/>Affected Base path</span><span><i className="candidate"/>Candidate path</span><span><i className="protected"/>Completed / protected</span><span><i className="incident"/>Incident location</span></div><p>{shown.features.length} affected-order path{shown.features.length===1?'':'s'} · {shown.incidents.length} Incident location{shown.incidents.length===1?'':'s'}</p></div>
    {shown.warnings.map(warning=><p className="bi-map-warning" key={warning} role="status">{warning}</p>)}
    {error&&<p className="bi-map-warning" role="status">{error}</p>}
    <p className="bi-map-attribution"><a href="https://openfreemap.org/" target="_blank" rel="noreferrer">OpenFreeMap</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a></p>
  </section>;
}
