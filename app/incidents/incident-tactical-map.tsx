"use client";


import {useEffect,useRef,useState} from 'react';
import {Crosshair, Minus, Plus} from 'lucide-react';
import type {Map as MapLibreMap, Marker, GeoJSONSource, VectorTileSource, ExpressionSpecification} from 'maplibre-gl';
import type {FeatureCollection} from 'geojson';
import type {IncidentWorkspace,RouteMode,Coordinate} from './incident-mock';
import {incidentFocusBounds,incidentOverlayData} from './incident-map-data';
import {createOperationalMapStyle,OPERATIONAL_TILEJSON,roadAccentData,operationalRouteStyle} from './operational-map-style';

type Props = {data: IncidentWorkspace; mode: RouteMode; selected: string|null; selectedVehicle: string|null; onSelect:(id:string)=>void; onHover:(id:string|null)=>void; onVehicle:(id:string)=>void; onIncident:()=>void; onEmptyMap:()=>void; incidentCardOpen:boolean; applied:boolean};
const empty: FeatureCollection = {type:'FeatureCollection',features:[]};
function focusIncident(map:MapLibreMap,data:IncidentWorkspace){
  const camera=map.cameraForBounds(incidentFocusBounds(data),{padding:{top:170,bottom:100,left:80,right:80},maxZoom:14});
  map.easeTo({center:[data.incident.location.lng,data.incident.location.lat],zoom:camera?.zoom??12,duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:650});
}

export default function IncidentTacticalMap(props: Props) {
  const {data,mode,selected,selectedVehicle,applied,incidentCardOpen}=props;
  const container=useRef<HTMLDivElement>(null), mapRef=useRef<MapLibreMap|null>(null);
  const markers=useRef<{marker: Marker; element:HTMLElement; id:string; kind:string; vehicle?:string}[]>([]);
  const handlers=useRef(props);
  const markerClass=useRef<typeof import('maplibre-gl').Marker|null>(null);
  const lastFocus=useRef('');
  const [ready,setReady]=useState(false),[mapError,setMapError]=useState<string|null>(null);
  useEffect(()=>{handlers.current=props;},[props]);

  useEffect(()=>{
    let cancelled=false,observer:ResizeObserver|undefined;
    const root=container.current!;
    const {incident}=handlers.current.data;
    void import('maplibre-gl').then(({default:maplibregl})=>{
      if(cancelled)return;
      const map=new maplibregl.Map({container:root,center:[incident.location.lng,incident.location.lat],zoom:12,minZoom:10.5,maxZoom:17,
        maxBounds:[[103.50,1.15],[104.12,1.57]],pitch:0,dragRotate:false,touchPitch:false,attributionControl:false,cooperativeGestures:true,
        style:createOperationalMapStyle()});
      mapRef.current=map;markerClass.current=maplibregl.Marker;
      map.touchZoomRotate.disableRotation();
      map.on('click',event=>{if(!(event.originalEvent.target as HTMLElement).closest('.if-geo-marker'))handlers.current.onEmptyMap();});
      const diagnostics=()=>{root.dataset.center=JSON.stringify(map.getCenter().toArray());root.dataset.zoom=String(map.getZoom());};
      map.on('move',diagnostics);diagnostics();
      map.on('error',()=>setMapError('Map detail is temporarily unavailable. Retry the basemap.'));
      let accentKey='';
      map.on('idle',()=>{
        if(!map.getLayer('nexus-roads-major'))return;
        const accents=roadAccentData(map),key=JSON.stringify(accents);
        if(key!==accentKey){accentKey=key;(map.getSource('nexus-road-lights') as GeoJSONSource).setData(accents);}
        root.dataset.roadAccents=String(accents.features.length);
      });
      map.on('sourcedata',event=>{if(event.sourceId==='nexus-base' && event.isSourceLoaded){setMapError(null);root.dataset.basemapLoaded='true';}});
      map.on('load',()=>{
        if(cancelled)return;
        map.addSource('routes',{type:'geojson',data:empty});
        map.addSource('selected-routes',{type:'geojson',data:empty});
        const addLine=(id:string,kind:string,color:string,width:number,opacity:number,source='routes',dash?:number[],blur=0)=>map.addLayer({id,type:'line',source,filter:['==',['get','kind'],kind],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':color,'line-width':width,'line-opacity':opacity,'line-blur':blur,...(dash ? {'line-dasharray':dash} : {})}});
        const palette=operationalRouteStyle;
        addLine('completed','completed',palette.completed.color,palette.completed.width,palette.completed.opacity);
        addLine('original','original',palette.base.color,palette.base.width,palette.base.opacity);
        for(const [kind,style] of [['recovery',palette.candidate],['affected',palette.affected]] as const){
          addLine(`${kind}-outer`,kind,style.color,style.outerWidth,style.outerOpacity,'routes',undefined,style.outerBlur);
          addLine(`${kind}-glow`,kind,style.color,style.glowWidth,style.glowOpacity,'routes',undefined,style.glowBlur);
          addLine(kind,kind,style.color,style.width,style.opacity,'routes',kind==='affected'?[1.5,1.1]:undefined);
        }
        // A small screen-space offset keeps coincident real-road proposals legible.
        for(const id of ['recovery-outer','recovery-glow','recovery'])map.setPaintProperty(id,'line-offset',4);
        addLine('selected-old','old','#ffad95',4,.95,'selected-routes',[2,1]);
        addLine('selected-new','recovery','#fff1cc',4.5,.98,'selected-routes');
        map.setPaintProperty('selected-new','line-offset',4);
        root.dataset.mapReady='true';setReady(true);

      });
      observer=new ResizeObserver(()=>map.resize());observer.observe(root);
    }).catch(()=>{if(!cancelled)setMapError('The interactive map could not start. Reload to retry.');});
    return ()=>{cancelled=true;observer?.disconnect();markers.current.forEach(item=>item.marker.remove());markers.current=[];mapRef.current?.remove();mapRef.current=null;};
  },[]);

  useEffect(()=>{
    const map=mapRef.current,MarkerType=markerClass.current;
    if(!ready||!map||!MarkerType)return;
    const {incident,affectedOrders,recoveryVehicles,completedStops}=data;
    markers.current.forEach(item=>item.marker.remove());markers.current=[];
        const addMarker=(id:string,coordinate:Coordinate,kind:string,label:string,onClick?:()=>void,vehicle?:string)=>{
          const element=document.createElement(onClick?'button':'div');element.className=`if-geo-marker if-geo-${kind}`;element.dataset.entity=id;
          element.setAttribute('aria-label',label);element.title=label;
          if(onClick){element.setAttribute('type','button');element.onclick=event=>{event.stopPropagation();onClick();};}
          const dot=document.createElement('span');dot.className='if-geo-dot';dot.textContent=kind==='incident'?'!':kind==='completed'?'✓':'';element.appendChild(dot);
          if(kind==='vehicle'){
            const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.6');svg.setAttribute('aria-hidden','true');
            const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d','M3 5h12v12H3z M15 9h4l3 4v4h-7 M7 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4 M18 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4');svg.appendChild(path);dot.appendChild(svg);
          }

          if(kind!=='completed'){const text=document.createElement('b');text.textContent=id;const detail=document.createElement('small');detail.textContent=kind==='incident'?incident.typeLabel:kind==='vehicle'?recoveryVehicles.find(item=>item.id===id)?.detail??'':data.comparison.etaChanges.find(item=>item.orderId===id)?.oldEta??'';text.appendChild(detail);element.appendChild(text);}
          if(kind==='order'){element.onmouseenter=()=>handlers.current.onHover(id);element.onmouseleave=()=>handlers.current.onHover(null);element.onfocus=()=>handlers.current.onHover(id);element.onblur=()=>handlers.current.onHover(null);}
          const marker=new MarkerType({element,anchor:'center'}).setLngLat(coordinate).addTo(map);markers.current.push({marker,element,id,kind,vehicle});
        };
        completedStops.forEach((coordinate,i)=>addMarker(`completed-${i}`,coordinate,'completed',`Completed stop ${i+1} · protected`));
        affectedOrders.forEach((order,index)=>{addMarker(order.id,order.coordinate,'order',`${order.id} · ${order.location} → ${order.assignedTo}`,()=>handlers.current.onSelect(order.id),order.assignedTo);markers.current.at(-1)?.element.classList.add(index%2?'label-below':'label-above');});
        recoveryVehicles.forEach(vehicle=>addMarker(vehicle.id,vehicle.coordinate,'vehicle',`${vehicle.id} · ${vehicle.detail}`,()=>handlers.current.onVehicle(vehicle.id)));
        addMarker(incident.subject.id,[incident.location.lng,incident.location.lat],'incident',`${incident.subject.id} · ${incident.typeLabel} · ${incident.area}`,()=>handlers.current.onIncident());

    const focusKey=incident.id+':'+incident.location.lng+':'+incident.location.lat;
    if(lastFocus.current!==focusKey){focusIncident(map,data);lastFocus.current=focusKey;}
  },[data,ready]);

  useEffect(()=>{
    const map=mapRef.current;if(!ready || !map?.getSource('routes'))return;
    const assignment=data.comparison.assignmentChanges.find(change=>change.orderId===selected);
    const focusedVehicle=selected ? (mode==='current'?assignment?.baseVehicle:assignment?.candidateVehicle) : selectedVehicle;
    (map.getSource('routes') as GeoJSONSource).setData(incidentOverlayData(data,mode==='changes'));
    const oldLine=selected ? data.routeGeometry.orders[selected]?.old : null;
    const newLine=selected ? data.routeGeometry.orders[selected]?.recovery : selectedVehicle ? data.routeGeometry.recovery[selectedVehicle] : null;
    const features=[...(oldLine?[{type:'Feature' as const,geometry:oldLine,properties:{kind:'old'}}]:[]),...(newLine?[{type:'Feature' as const,geometry:newLine,properties:{kind:'recovery'}}]:[])];
    (map.getSource('selected-routes') as GeoJSONSource).setData({type:'FeatureCollection',features});
    map.setPaintProperty('nexus-context-dimmer','background-opacity',mode==='changes'?.58:0);
    map.setPaintProperty('original','line-opacity',selected?.17:mode==='current'?.95:.36);
    map.setPaintProperty('completed','line-opacity',mode==='changes'?0:.5);
    for(const id of ['recovery','recovery-glow','recovery-outer','selected-new'])map.setLayoutProperty(id,'visibility',mode==='current'?'none':'visible');
    const opacity: ExpressionSpecification=['case',['==',['get','vehicle'],focusedVehicle??''],.95,focusedVehicle?.22:.9];
    map.setPaintProperty('recovery','line-opacity',opacity);
    for(const item of markers.current){
      const highlighted=item.id===selected || item.kind==='vehicle'&&item.id===focusedVehicle;
      item.element.classList.toggle('selected',!!highlighted);
      item.element.classList.toggle('dimmed',!!(focusedVehicle && item.kind==='vehicle'&&item.id!==focusedVehicle));
      item.element.classList.toggle('hidden-completed',mode==='changes'&&(item.kind==='completed'||item.kind==='order'&&!data.comparison.mapChanges.orderIds.includes(item.id)||item.kind==='vehicle'&&!data.comparison.mapChanges.vehicleIds.includes(item.id)));
      item.element.classList.toggle('incident-selected',item.kind==='incident'&&incidentCardOpen);
      if(item.element.tagName==='BUTTON')item.element.setAttribute('aria-pressed',String(item.kind==='incident'?incidentCardOpen:!!highlighted));
    }
    if(container.current){container.current.dataset.mode=mode;container.current.dataset.selectedOrder=selected??'';container.current.dataset.selectedVehicle=focusedVehicle??'';}
  },[ready,data,mode,selected,selectedVehicle,incidentCardOpen]);

  function recenter(){if(mapRef.current)focusIncident(mapRef.current,data);}
  return <section className={`if-map if-mode-${mode}`} aria-label={`${data.incident.region} tactical incident map`}>
    <div ref={container} className="if-maplibre" aria-label="Interactive Singapore map"/>
    <div className="if-map-caption"><span>{data.incident.region}</span><small>{data.incident.area} · Live recovery area</small></div>
    <div className="if-map-controls"><button aria-label="Recenter Incident" onClick={recenter} title="Recenter Incident"><Crosshair/>Recenter Incident</button><div><button aria-label="Zoom in map" onClick={()=>mapRef.current?.zoomIn()}><Plus/></button><button aria-label="Zoom out map" onClick={()=>mapRef.current?.zoomOut()}><Minus/></button></div></div>
    {(!ready || mapError) && <div className="if-map-message" role="status">{mapError??'Loading Singapore · NEXUS night map'}{mapError && <button onClick={()=>{setMapError(null);(mapRef.current?.getSource('nexus-base') as VectorTileSource|undefined)?.setUrl(OPERATIONAL_TILEJSON);}}>Retry basemap</button>}</div>}
    <div className="if-map-legend"><span><i className="affected"/>Affected route</span><span><i className="new"/>{applied?'Applied recovery':'Candidate route'}</span><span><i className="old"/>Base route</span><span><i className="stop"/>Completed / protected</span></div>
    <div className="if-map-attribution"><span>NEXUS · NOCTURNE</span><a href="https://openfreemap.org/" target="_blank" rel="noreferrer">OpenFreeMap</a> · © <a href="https://openmaptiles.org/" target="_blank" rel="noreferrer">OpenMapTiles</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a></div>
    {(selected||selectedVehicle)&&<div className="if-map-selection">{selected??selectedVehicle}<span>{selected ? `${applied?'Assigned':'Candidate'} vehicle · ${data.affectedOrders.find(order=>order.id===selected)?.assignedTo}`:'Recovery assignments highlighted'}</span></div>}
  </section>;
}
