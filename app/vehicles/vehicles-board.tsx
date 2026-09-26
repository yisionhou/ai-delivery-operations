"use client";
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';
import {AlertTriangle,CheckCircle2,ChevronLeft,ChevronRight,Play,RefreshCw,Truck} from 'lucide-react';
import {contextQuery,currentStop,demoVehicleGateway,groupOf,progress,readContext,stableVehicles,vehicleDestination} from './vehicle-data';
import {apiVehicleGateway} from './vehicle-api';
import type {Filter,Fleet,StopResult,Vehicle,VehicleGateway} from './vehicle-data';
import {RouteProgressTrack,VehicleStatus} from './vehicle-components';

export function StateMessage({title,detail,retry}:{title:string;detail?:string;retry?:()=>void}){
  return <div className="vf-state" role="status"><Truck/><h2>{title}</h2>{detail&&<p>{detail}</p>}{retry&&<button className="vf-button" onClick={retry}><RefreshCw/>Retry</button>}</div>;
}
type Loaded={key:string;fleet:Fleet;routes:Record<string,StopResult>};
export default function VehiclesBoard({gateway:providedGateway}:{gateway?:VehicleGateway}){
  const params=useSearchParams(),router=useRouter(),{date,filter,page,source}=readContext(new URLSearchParams(params.toString()));
  const gateway=providedGateway??(source==='demo'?demoVehicleGateway:apiVehicleGateway),key=`${source}:${date}:${filter}:${page}`;
  const [loaded,setLoaded]=useState<Loaded|null>(null),[error,setError]=useState<string|null>(null),[busy,setBusy]=useState(true),[refresh,setRefresh]=useState(0);
  const [dismissed,setDismissed]=useState<Set<string>>(()=>new Set());
  const root=useRef<HTMLDivElement>(null),positions=useRef(new Map<string,number>());
  const data=loaded?.key===key?loaded:null;
  useEffect(()=>{
    const controller=new AbortController();let inFlight=false;
    async function load(){
      if(inFlight||document.hidden)return;inFlight=true;
      try{
        const fleet=await gateway.loadFleet(date,controller.signal,{filter,page,pageSize:8});
        const routeIds=[...new Set(fleet.vehicles.flatMap(v=>v.routeId?[v.routeId]:[]))];
        const results=await Promise.allSettled(routeIds.map(id=>gateway.loadStops(id,controller.signal)));
        if(controller.signal.aborted)return;
        const routes=Object.fromEntries(routeIds.map((id,i)=>[id,results[i].status==='fulfilled'?{stops:results[i].value}:{stops:[],error:'Stops unavailable'}]));
        setLoaded({key,fleet,routes});setError(null);
      }catch(reason){if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:'Fleet could not be loaded.');}
      finally{inFlight=false;if(!controller.signal.aborted)setBusy(false);}
    }
    void load();const interval=window.setInterval(load,15000);
    return()=>{controller.abort();window.clearInterval(interval);};
  },[date,filter,page,key,gateway,refresh]);
  const completedKeys=data?.fleet.vehicles.filter(v=>v.status!=='UNAVAILABLE'&&v.routeId&&progress(data.routes[v.routeId]?.stops??[]).finished).map(v=>`${source}:${date}:${v.id}:${v.routeId}`).sort().join('|')??'';
  useEffect(()=>{
    if(!completedKeys)return;
    const timer=window.setTimeout(()=>setDismissed(previous=>new Set([...previous,...completedKeys.split('|')])),1100);
    return()=>window.clearTimeout(timer);
  },[completedKeys]);
  useLayoutEffect(()=>{
    if(!root.current)return;const next=new Map<string,number>();
    root.current.querySelectorAll<HTMLElement>('[data-vehicle-id]').forEach(element=>{
      const id=element.dataset.vehicleId!,top=element.getBoundingClientRect().top,old=positions.current.get(id);
      next.set(id,top);
      if(old!==undefined&&Math.abs(old-top)>1&&!matchMedia('(prefers-reduced-motion: reduce)').matches)element.animate([{transform:`translateY(${old-top}px)`},{transform:'translateY(0)'}],{duration:500,easing:'cubic-bezier(.22,1,.36,1)'});
    });positions.current=next;
  },[data,filter,page,dismissed]);
  const update=(next:{date?:string;filter?:Filter;page?:number;source?:string})=>{if((next.date??date)===date&&(next.filter??filter)===filter&&(next.page??1)===page&&(next.source??source)===source){setBusy(true);setRefresh(v=>v+1);return;}setBusy(true);setLoaded(null);setError(null);router.replace(`/vehicles?${contextQuery(next.date??date,next.filter??filter,next.page??1,next.source??source)}`,{scroll:false});};
  const retry=()=>{setBusy(true);setRefresh(value=>value+1);};
  const vehicles=data?stableVehicles(data.fleet.vehicles):[];
  const selected=vehicles.filter(v=>filter==='all'||groupOf(v)===filter);
  const visible=selected.filter(v=>v.status==='UNAVAILABLE'||!dismissed.has(`${source}:${date}:${v.id}:${v.routeId}`));
  const server=data?.fleet.pagination,total=server?.total??visible.length;
  const pageSize=8,pageCount=Math.max(1,Math.ceil(total/pageSize)),safePage=server?.page??Math.min(page,pageCount);
  const paged=server?visible:visible.slice((safePage-1)*pageSize,safePage*pageSize);
  const query=contextQuery(date,filter,safePage,source);
  const counts=[{label:'Total Vehicles',value:server?.counts.total??vehicles.length,icon:Truck,tone:'total'},{label:'Active',value:server?.counts.active??vehicles.filter(v=>groupOf(v)==='active').length,icon:Play,tone:'active'},{label:'Available',value:server?.counts.available??vehicles.filter(v=>groupOf(v)==='available').length,icon:CheckCircle2,tone:'available'},{label:'Exceptions',value:server?.counts.exception??vehicles.filter(v=>groupOf(v)==='exception').length,icon:AlertTriangle,tone:'exception'}];
  const partial=data&&Object.values(data.routes).some(r=>r.error);
  return <div className="vf-page" ref={root}>
    <header className="vf-page-header"><div><span className="vf-eyebrow">FLEET / EXECUTION</span><h1>Vehicles</h1><p>Fleet execution progress by vehicle.</p></div><div className="vf-header-meta"><span className="vf-demo">{source==='demo'?'DEMO DATA':'BACKEND DATA'}</span><small>Operational snapshot · Not live GPS</small></div></header>
    <div className="vf-toolbar"><div className="vf-source"><button aria-pressed={source==='api'} onClick={()=>update({source:'api'})}>Backend</button><button aria-pressed={source==='demo'} onClick={()=>update({source:'demo',date:'2026-09-26'})}>Demo</button></div><label className="vf-date"><span>Business Date</span><input type="date" value={date} aria-label="Business Date" onChange={e=>{if(e.target.value)update({date:e.target.value});}}/></label><div className="vf-filters" aria-label="Vehicle status filters">{(['all','active','available','exception'] as const).map(value=><button key={value} aria-pressed={filter===value} className={filter===value?'selected':''} onClick={()=>update({filter:value})}>{value[0].toUpperCase()+value.slice(1)}</button>)}</div><button className="vf-refresh" aria-label="Refresh vehicles" disabled={busy} onClick={retry}><RefreshCw className={busy?'spinning':''}/></button></div>
    <section className="vf-summaries" aria-label="Fleet summary">{counts.map(({label,value,icon:Icon,tone})=><article className={tone} key={label}><span className="vf-summary-icon"><Icon/></span><div><small>{label}</small><strong>{data?value:'—'}</strong></div><span className="vf-summary-decoration" aria-hidden="true"/></article>)}</section>
    {error&&<div className="vf-notice error" role="alert"><AlertTriangle/><span>{data?'Refresh failed. Showing the previous snapshot. ':''}{error}</span><button onClick={retry}>Retry</button></div>}
    {partial&&<div className="vf-notice" role="status"><AlertTriangle/><span>Some route stops could not be loaded. Vehicle records are still available.</span><button onClick={retry}>Retry stops</button></div>}
    {data?.fleet.warnings?.map(warning=><div className="vf-notice" key={warning}><AlertTriangle/><span>{warning}</span><button onClick={retry}>Retry</button></div>)}
    {data&&data.fleet.hasCurrentPlan===false&&<div className="vf-notice"><AlertTriangle/><span>No Current Plan for {date}. Vehicle resources remain available; route assignments are not shown.</span></div>}
    {!data?(error?<StateMessage title="Fleet unavailable" detail="Please retry loading the vehicle records." retry={retry}/>:<StateMessage title="Loading fleet…" detail="Loading vehicle resources and route stops."/>):vehicles.length===0?<StateMessage title="Empty fleet" detail="No vehicle records were returned."/>:visible.length===0?<StateMessage title={selected.length?'All routes in this view completed':'No vehicles match this filter'} detail={selected.length?'Completed vehicles have left the board. Their records remain available in Vehicle Detail.':'Choose another status to view the fleet.'}/>:<div className="vf-board">
      {(['exception','active','available'] as const).map(group=>{const rows=paged.filter(vehicle=>groupOf(vehicle)===group);return rows.length?<section className={`vf-group ${group}`} key={group} aria-label={`${group} vehicles`}><div className="vf-group-heading"><h2>{group.toUpperCase()} <span>({server?.counts[group]??visible.filter(v=>groupOf(v)===group).length})</span></h2><span>Rider / Route</span><span>Route Progress</span><span>Stops</span><span>Current / Next Stop</span><span/></div>{rows.map(vehicle=><VehicleProgressRow key={vehicle.id} vehicle={vehicle} result={vehicle.routeId?data.routes[vehicle.routeId]:undefined} query={query}/>)}</section>:null;})}
    </div>}
    {data&&<div className="vf-board-footer"><span><i/>Progress is based on completed stops{selected.length-visible.length>0?` · ${selected.length-visible.length} completed route(s) left the board`:''}</span><div><span>{total?((safePage-1)*pageSize+1):0}–{Math.min(safePage*pageSize,total)} of {total}</span><button aria-label="Previous page" disabled={safePage===1} onClick={()=>update({page:safePage-1})}><ChevronLeft/></button><button aria-label="Next page" disabled={safePage===pageCount} onClick={()=>update({page:safePage+1})}><ChevronRight/></button></div></div>}
  </div>;
}
function VehicleProgressRow({vehicle,result,query}:{vehicle:Vehicle;result?:StopResult;query:string}){
  const stops=result?.stops??[],stats=progress(stops),stop=currentStop(stops),exception=vehicle.status==='UNAVAILABLE';
  const complete=stats.finished&&!exception;
  const summary=stops.length?`${stops[0].location} → ${stops[stops.length-1].location}`:vehicle.associationError?'Route association unavailable':vehicle.routeId??'No route assigned';
  return <a className={`vf-row ${groupOf(vehicle)} ${complete?'completing':''}`} data-vehicle-id={vehicle.id} href={vehicleDestination(vehicle,query)} aria-label={exception?`Open incident for ${vehicle.code}`:`View ${vehicle.code} details`}>
    <div className="vf-identity"><strong>{vehicle.code}</strong><VehicleStatus vehicle={vehicle} finished={complete}/></div>
    <div className="vf-rider"><b>{vehicle.associationError?'Unavailable':vehicle.driver??'—'}</b><small title={summary}>{summary}</small></div>
    <RouteProgressTrack stops={stops} available={!vehicle.routeId&&!vehicle.associationError} exception={exception} error={!!result?.error||vehicle.associationError}/>
    <div className="vf-count"><b>{result?.error||vehicle.associationError?'—':`${stats.completed} / ${stats.total}`}</b><small>stops</small></div>
    <div className="vf-next">{exception?<AlertTriangle/>:complete?<CheckCircle2/>:<span className="vf-next-dot"/>}<div><b>{exception?'Vehicle unavailable':complete?'Completed':vehicle.associationError?'Route association unavailable':!vehicle.routeId?'No current route assigned':result?.error?'Stops unavailable':stop?stop.location:'No remaining stops'}</b><small>{exception?(vehicle.incidentId?'Open related Incident':'No linked Incident'):!vehicle.routeId?'No route for this business date':complete?'Leaving the board…':stop&&['IN_PROGRESS','ARRIVED','IN_SERVICE'].includes(stop.status)?'Current stop':'Next stop'}</small></div></div><span className="vf-chevron"><ChevronRight/></span>
  </a>;
}
