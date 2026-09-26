"use client";
import {useEffect,useRef,useState} from 'react';
import {Check,ChevronRight,Clock3,Package,RefreshCw,Route,UserRound,X} from 'lucide-react';
import {displayTime,progress} from './vehicle-data';
import type {StopResult,Vehicle,VehicleGateway,VehicleStop} from './vehicle-data';
import {buildStopTimeline} from './vehicle-timeline';
import {VehicleStatus} from './vehicle-components';
import VehicleTimeGauge from './vehicle-time-gauge';

type Props={selectedId:string;vehicle:Vehicle|null;boardStops?:StopResult;gateway:VehicleGateway;date:string;query:string;onClose:()=>void};
const active=(status:VehicleStop['status'])=>['IN_PROGRESS','ARRIVED','IN_SERVICE'].includes(status);
const statusLabel=(status:VehicleStop['status'])=>status==='ARRIVED'||status==='IN_SERVICE'?'IN PROGRESS':status==='PLANNED'?'WAITING':status.replaceAll('_',' ');

export default function VehicleInspector({selectedId,vehicle:boardVehicle,boardStops,gateway,date,query,onClose}:Props){
  const closeButton=useRef<HTMLButtonElement>(null);
  const [detail,setDetail]=useState<{id:string;vehicle:Vehicle|null;error:string|null}|null>(null);
  const [localStops,setLocalStops]=useState<{routeId:string;result:StopResult;loading:boolean}|null>(null);
  const [now,setNow]=useState<Date|null>(null);
  const vehicle=boardVehicle??(detail?.id===selectedId?detail.vehicle:null);
  const missingVehicle=!boardVehicle&&detail?.id!==selectedId;
  const vehicleError=!boardVehicle&&detail?.id===selectedId?detail.error:null;

  useEffect(()=>{closeButton.current?.focus();const tick=()=>setNow(new Date());const first=window.setTimeout(tick,0),timer=window.setInterval(tick,1000);return()=>{window.clearTimeout(first);window.clearInterval(timer);};},[]);
  useEffect(()=>{
    if(boardVehicle)return;
    const controller=new AbortController();
    gateway.loadVehicle(selectedId,date,controller.signal).then(value=>{if(!controller.signal.aborted)setDetail({id:selectedId,vehicle:value,error:null});}).catch(reason=>{if(!controller.signal.aborted)setDetail({id:selectedId,vehicle:null,error:reason instanceof Error?reason.message:'Vehicle could not be loaded.'});});
    return()=>controller.abort();
  },[boardVehicle,selectedId,date,gateway]);
  useEffect(()=>{
    if(!vehicle?.routeId||boardStops)return;
    const controller=new AbortController();
    const routeId=vehicle.routeId;
    gateway.loadStops(routeId,controller.signal).then(stops=>{if(!controller.signal.aborted)setLocalStops({routeId,result:{stops},loading:false});}).catch(reason=>{if(!controller.signal.aborted)setLocalStops({routeId,result:{stops:[],error:reason instanceof Error?reason.message:'Stops could not be loaded.'},loading:false});});
    return()=>controller.abort();
  },[vehicle?.routeId,boardStops,gateway]);
  const retryStops=()=>{
    if(!vehicle?.routeId)return;
    const routeId=vehicle.routeId;
    setLocalStops({routeId,result:{stops:[]},loading:true});
    void gateway.loadStops(routeId).then(stops=>setLocalStops({routeId,result:{stops},loading:false})).catch(reason=>setLocalStops({routeId,result:{stops:[],error:reason instanceof Error?reason.message:'Stops could not be loaded.'},loading:false}));
  };
  const local=localStops?.routeId===vehicle?.routeId?localStops:null;
  const result=boardStops&&!boardStops.error?boardStops:local?local.loading?undefined:local.result:boardStops;
  const loadingStops=!!vehicle?.routeId&&!result&&(local?.loading??true);
  const stops=result?.error?[]:result?.stops??[];
  const reliable=!!vehicle?.routeId&&!!result&&!result.error;
  const stats=progress(stops);
  const timeline=now?buildStopTimeline(stops,date,now):null;
  const orders=[...new Map(stops.filter(stop=>stop.orderId).map(stop=>[stop.orderId!,stop])).values()];
  const orderUrl=(id:string)=>`/orders?selected_order=${encodeURIComponent(id)}&vehicle_id=${encodeURIComponent(selectedId)}&${query}`;
  const route=stops.length?`${stops[0].location} → ${stops[stops.length-1].location}`:vehicle?.associationError?'Route association unavailable':vehicle?.routeId??'No current route assigned';
  return <aside id="vehicle-inspector" className="vf-inspector" aria-label="Vehicle inspector">
    <div className="vf-inspector-scroll">
      <header className="vf-inspector-header"><div className="vf-inspector-title"><h2>{vehicle?.code??selectedId}</h2>{vehicle&&<VehicleStatus vehicle={vehicle} finished={reliable&&stats.finished}/>}</div><button ref={closeButton} className="vf-inspector-close" type="button" onClick={onClose} aria-label="Close vehicle inspector"><X/></button></header>
      {missingVehicle?<p className="vf-inspector-state">Loading vehicle…</p>:vehicleError?<p className="vf-inspector-state" role="alert">{vehicleError}</p>:!vehicle?<p className="vf-inspector-state">Vehicle not found for this data source.</p>:<div className="vf-inspector-content" key={selectedId}>
        <dl className="vf-inspector-facts"><div><dt>Rider</dt><dd>{vehicle.associationError?'Unavailable':vehicle.driver??'Unassigned'}</dd></div><div><dt>Route</dt><dd>{route}</dd></div></dl>
        <div className="vf-inspector-metrics"><article><strong>{reliable?`${stats.completed} / ${stats.total}`:vehicle.routeId?'—':'0 / 0'}</strong><span>Stops completed</span></article><article><strong>{reliable?stats.remaining:vehicle.routeId?'—':'0'}</strong><span>Remaining stops</span></article><article><strong>{reliable&&stats.percent!==null?`${stats.percent}%`:'—'}</strong><span>Route Progress</span></article></div>
        <section className="vf-inspector-section vf-time-section" aria-labelledby="vf-time-title"><div className="vf-inspector-section-title"><h3 id="vf-time-title"><Clock3/>Stop Timeline</h3><small>All times in SGT</small></div>
          {!vehicle.routeId?<p className="vf-inspector-empty">No active execution window</p>:result?.error?<div className="vf-inspector-local-error" role="alert"><span>Timeline unavailable. {result.error}</span><button type="button" onClick={retryStops}><RefreshCw/>Retry stops</button></div>:loadingStops?<p className="vf-inspector-empty">Loading timing data…</p>:!now?<p className="vf-inspector-empty">Syncing browser clock…</p>:timeline?.startLabel&&timeline.endLabel?<VehicleTimeGauge start={timeline.startLabel} current={timeline.currentLabel!} end={timeline.endLabel} percent={timeline.currentPercent!} leftCaption="Execution start" middleCaption={timeline.remainingLabel==='Ended'?'Ended':`Remaining ${timeline.remainingLabel}`} rightCaption="Planned end" indicatorLabel={timeline.remainingLabel==='Ended'?'Current time is past the planned end':`Current time at ${Math.round(timeline.currentPercent!)}% of planned time window`}/>:<p className="vf-inspector-empty">Timeline unavailable · Insufficient timing data</p>}
        </section>
        <section className="vf-inspector-section" aria-labelledby="vf-route-title"><div className="vf-inspector-section-title"><h3 id="vf-route-title"><Route/>Route Execution</h3>{vehicle.routeId&&<button className="vf-inspector-refresh" type="button" onClick={retryStops} disabled={local?.loading} aria-label="Refresh route stops"><RefreshCw/></button>}</div>
          {!vehicle.routeId?<p className="vf-inspector-empty">No active route execution</p>:result?.error?<div className="vf-inspector-local-error" role="alert"><span>Route Execution unavailable. {result.error}</span><button type="button" onClick={retryStops}><RefreshCw/>Retry stops</button></div>:loadingStops?<p className="vf-inspector-empty">Loading route stops…</p>:stops.length?<ol className="vf-execution-list">{stops.map(stop=><li key={stop.id} className={stop.status==='COMPLETED'?'done':active(stop.status)?'current':''}><span className="vf-execution-node">{stop.status==='COMPLETED'&&<Check/>}</span><div className="vf-execution-place"><strong>{stop.location}</strong><small>{stop.kind}{stop.orderId&&` · ${stop.orderCode??stop.orderId}`}</small></div><span className="vf-execution-status">{statusLabel(stop.status)}</span><time>{displayTime(stop.actualArrival??stop.plannedArrival)}</time></li>)}</ol>:<p className="vf-inspector-empty">No route stops supplied</p>}
        </section>
        <section className="vf-inspector-section" aria-labelledby="vf-resource-title"><div className="vf-inspector-section-title"><h3 id="vf-resource-title"><UserRound/>Vehicle &amp; Rider</h3></div><dl className="vf-inspector-resource"><div><dt>Resource status</dt><dd>{vehicle.status}</dd></div><div><dt>Rider / driver</dt><dd>{vehicle.driver??'Unassigned'}</dd></div><div><dt>Capacity</dt><dd>{vehicle.capacity===null?'—':`${vehicle.capacity} load units`}</dd></div><div><dt>Last Recorded Location</dt><dd>{vehicle.recordedLocation??'No recorded location supplied'}</dd></div><div><dt>Last Recorded At</dt><dd>{vehicle.recordedAt??'Recording time unavailable'}</dd></div></dl></section>
        <section className="vf-inspector-section vf-orders-section" aria-labelledby="vf-orders-title"><div className="vf-inspector-section-title"><h3 id="vf-orders-title">Related Orders ({orders.length})</h3></div>{orders.length?<div className="vf-inspector-orders">{orders.map(stop=><a key={stop.orderId} href={orderUrl(stop.orderId!)}><Package/><span><strong>{stop.orderCode??stop.orderId}</strong><small>{stop.kind} · {statusLabel(stop.status)}</small></span><ChevronRight/></a>)}</div>:<p className="vf-inspector-empty">{vehicle.routeId&&(!result||result.error)?'Related orders unavailable until stops load':'No related orders'}</p>}</section>
      </div>}
    </div>
  </aside>;
}
