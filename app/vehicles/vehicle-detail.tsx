"use client";
import {useEffect,useState} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';
import {ArrowLeft,ArrowUpRight,RefreshCw} from 'lucide-react';
import {contextQuery,demoVehicleGateway,progress,readContext} from './vehicle-data';
import type {Vehicle,VehicleGateway,VehicleStop} from './vehicle-data';
import {CurrentStopCard,RouteProgressTrack,RouteStopsList,RouteVisualization,VehicleRiderCard,VehicleStatus} from './vehicle-components';
import {apiVehicleGateway} from './vehicle-api';
import {StateMessage} from './vehicles-board';

function VehicleDetailContent({vehicleId,gateway:providedGateway}:{vehicleId:string;gateway?:VehicleGateway}){
  const params=useSearchParams(),{date,filter,page,source}=readContext(new URLSearchParams(params.toString())),query=contextQuery(date,filter,page,source);
  const router=useRouter();
  const gateway=providedGateway??(source==='demo'?demoVehicleGateway:apiVehicleGateway);
  const [vehicle,setVehicle]=useState<Vehicle|null>(null),[stopSnapshot,setStopSnapshot]=useState<{routeId:string;stops:VehicleStop[]}|null>(null),[loaded,setLoaded]=useState(false),[error,setError]=useState<string|null>(null),[stopsError,setStopsError]=useState<string|null>(null),[stopsLoading,setStopsLoading]=useState(false),[revision,setRevision]=useState(0),[stopRevision,setStopRevision]=useState(0);
  const stops=stopSnapshot?.routeId===vehicle?.routeId?stopSnapshot?.stops??[]:[];
  useEffect(()=>{
    const controller=new AbortController();
    const load=()=>gateway.loadVehicle(vehicleId,date,controller.signal).then(value=>{if(!controller.signal.aborted){setVehicle(value);setLoaded(true);setError(null);}}).catch(reason=>{if(!controller.signal.aborted){setError(reason instanceof Error?reason.message:'Vehicle could not be loaded.');setLoaded(true);}});
    void load();const interval=window.setInterval(()=>{if(!document.hidden)void load();},30000);
    return()=>{controller.abort();window.clearInterval(interval);};
  },[vehicleId,date,gateway,revision]);
  useEffect(()=>{
    if(!vehicle?.routeId)return;
    const controller=new AbortController();let inFlight=false;
    async function load(){
      if(inFlight||document.hidden)return;inFlight=true;setStopsLoading(true);setStopsError(null);
      try{const values=await gateway.loadStops(vehicle!.routeId!,controller.signal);if(!controller.signal.aborted){setStopSnapshot({routeId:vehicle!.routeId!,stops:values});setStopsError(null);}}
      catch(reason){if(!controller.signal.aborted)setStopsError(reason instanceof Error?reason.message:'Stops could not be loaded.');}
      finally{inFlight=false;if(!controller.signal.aborted)setStopsLoading(false);}
    }
    void load();const interval=window.setInterval(load,15000);return()=>{controller.abort();window.clearInterval(interval);};
  },[vehicle,gateway,stopRevision]);
  const stats=progress(stops),reliable=!!vehicle?.routeId&&stopSnapshot?.routeId===vehicle.routeId&&!stopsError&&(!stopsLoading||stops.length>0);
  const orderIds=[...new Set(stops.flatMap(stop=>stop.orderId?[stop.orderId]:[]))];
  const orderUrl=(id:string)=>`/orders?selected_order=${encodeURIComponent(id)}&vehicle_id=${encodeURIComponent(vehicleId)}&${query}`;
  const onOrder=(id:string)=>router.push(orderUrl(id));
  return <div className="vf-page vf-detail">
    <div className="vf-detail-top"><a className="vf-back" href={`/vehicles?${query}`}><ArrowLeft/>Back to Vehicles</a><div><span className="vf-demo">{source==='demo'?'DEMO DATA':'BACKEND DATA'}</span><time>{date}</time></div></div>
    {!loaded?<StateMessage title="Loading vehicle…"/>:error?<StateMessage title="Vehicle unavailable" detail={error} retry={()=>{setLoaded(false);setRevision(v=>v+1);}}/>:!vehicle?<StateMessage title="Vehicle not found" detail="This vehicle is not present in the current data source."/>:<>
      {vehicle.planAvailable===false&&<div className="vf-notice">No Current Plan for {date}. Vehicle resources remain available.</div>}
      <div className="vf-detail-hero"><div className="vf-detail-intro"><div className="vf-detail-title"><h1>{vehicle.code}</h1><VehicleStatus vehicle={vehicle} finished={reliable&&stats.finished}/></div><dl className="vf-header-facts"><div><dt>Rider</dt><dd>{vehicle.associationError?'Unavailable':vehicle.driver??'Unassigned'}</dd></div><div><dt>Route</dt><dd>{vehicle.routeId?<>{vehicle.routeId}<span>{vehicle.routeStatus?.replaceAll('_',' ')}</span></>:vehicle.associationError?'Route association unavailable':'No current route assigned'}</dd></div></dl>
        <div className="vf-detail-metrics"><article><strong>{reliable?`${stats.completed} / ${stats.total}`:vehicle.routeId||vehicle.associationError?'—':'0 / 0'}</strong><small>Stops completed</small></article><article><strong>{reliable?stats.remaining:vehicle.routeId?'—':'—'}</strong><small>Remaining stops</small></article><article><strong>{reliable&&stats.percent!==null?`${stats.percent}%`:'—'}</strong><small>Route Progress</small></article></div>
        <section className="vf-detail-progress"><div className="vf-section-heading"><h2>Route Progress</h2><small>Completed stops / total stops</small></div><RouteProgressTrack stops={reliable?stops:[]} available={!vehicle.routeId&&!vehicle.associationError} exception={vehicle.status==='UNAVAILABLE'} loading={stopsLoading&&stops.length===0} error={!!stopsError||vehicle.associationError}/></section>
      </div><RouteVisualization stops={reliable?stops:[]} exception={vehicle.status==='UNAVAILABLE'}/></div>
      <div className="vf-detail-columns"><section className="vf-stops-section"><div className="vf-section-heading"><h2>Stops {reliable&&`(${stats.total})`}</h2>{vehicle.routeId&&<button className="vf-text-action" disabled={stopsLoading} onClick={()=>setStopRevision(v=>v+1)}><RefreshCw/>Refresh stops</button>}</div>
        {vehicle.associationError?<StateMessage title="Route association unavailable" detail="Current-plan information could not be loaded." retry={()=>setRevision(v=>v+1)}/>:!vehicle.routeId?<StateMessage title="No current route assigned" detail="Vehicle resource information remains available. No route progress is inferred."/>:stopsError?<StateMessage title="Stops unavailable" detail={stopsError} retry={()=>setStopRevision(v=>v+1)}/>:stopsLoading&&stops.length===0?<StateMessage title="Loading stops…"/>:stops.length?<RouteStopsList stops={stops} onOrder={onOrder}/>:<StateMessage title="No route stops" detail="No stops were supplied for this route."/>}
      </section><aside className="vf-detail-aside">{reliable?<CurrentStopCard stops={stops} onOrder={onOrder}/>:<section className="vf-card"><h2>Current Stop</h2><p className="vf-muted">{vehicle.associationError?'Route association unavailable.':vehicle.routeId?'Stop information unavailable.':'No current route assigned'}</p></section>}<VehicleRiderCard vehicle={vehicle}/><section className="vf-card"><h2>Related Orders {reliable&&`(${orderIds.length})`}</h2><div className="vf-order-chips">{reliable&&orderIds.map(id=><a key={id} href={orderUrl(id)}>{stops.find(stop=>stop.orderId===id)?.orderCode??id}<ArrowUpRight/></a>)}</div>{(!reliable||!orderIds.length)&&<p className="vf-muted">{stopsError?'Orders unavailable until stops reload.':'No related orders.'}</p>}</section>{vehicle.status==='UNAVAILABLE'&&<a className="vf-incident-action" href={`/incidents?${query}&vehicle_id=${encodeURIComponent(vehicle.id)}${vehicle.incidentId?`&incident_id=${encodeURIComponent(vehicle.incidentId)}`:''}`}>Open Incident context<ArrowUpRight/></a>}</aside></div>
    </>}
  </div>;
}

export default function VehicleDetail(props:{vehicleId:string;gateway?:VehicleGateway}){const params=useSearchParams();const {date,source}=readContext(new URLSearchParams(params.toString()));return <VehicleDetailContent key={`${props.vehicleId}:${date}:${source}`} {...props}/>;}
