"use client";

import { useEffect, useState } from "react";
import {useRouter} from 'next/navigation';
import {
  AlertTriangle, ArrowLeft, Box, Check, ChevronRight,
  Clock3, CloudRain, Minus, Package, Play, Plus, RefreshCw,
  Truck, UserRound, Waypoints, RotateCcw,
} from "lucide-react";
import SingaporeScene, { RegionCollection, RegionKey } from "./singapore-scene";
import type { CameraCommand } from './inspection-camera';
import IncidentFocusPage from './incidents/incident-focus-page';
import {incident,incidentWorkspaces} from './incidents/incident-mock';
import Sidebar from "./nexus-sidebar";
import OperationsPage from './operations/operations-page';
import {loadOverview,loadPositions,type OverviewSnapshot} from './overview/overview-api';
import {overviewMetrics,overviewVehicles} from './overview/overview-model';

type AppState = "SINGAPORE_OVERVIEW" | "REGION_FOCUS" | "INCIDENT_FOCUS" | "RECOVERY";

const KPI = [
  { label: "Orders", value: "128", note: "↑ 12%", icon: Package, accent: "gold" },
  { label: "Vehicles", value: "18", note: "Online 16", icon: Truck, accent: "gold" },
  { label: "On-time Rate", value: "96%", note: "↑ 2%", icon: Clock3, accent: "green" },
  { label: "Exceptions", value: "3", note: "↓ 4", icon: AlertTriangle, accent: "red" },
];

const VEHICLES = [
  { id: "V01", status: "On route", pct: 88, route: "Sembawang → City", ok: true },
  { id: "V02", status: "On route", pct: 76, route: "Jurong → Queenstown", ok: true },
  { id: incident.subject.id, status: "Unavailable", pct: 42, route: "Jurong East → West Coast", ok: false },
  { id: "V04", status: "On route", pct: 91, route: "Changi → City", ok: true },
];

const REGION_STATS: Record<RegionKey,{label:string;districts:string;orders:number;vehicles:number;atRisk:number;routes:number}> = {
  "WEST REGION": {label:"West Region",districts:"Jurong · Tuas · Clementi",orders:367,vehicles:69,atRisk:12,routes:6},
  "CENTRAL REGION": {label:"Central Region",districts:"Marina Bay · Orchard · City",orders:428,vehicles:82,atRisk:7,routes:6},
  "EAST REGION": {label:"East Region",districts:"Tampines · Bedok · Changi",orders:312,vehicles:61,atRisk:4,routes:5},
  "NORTH REGION": {label:"North Region",districts:"Woodlands · Sembawang · Yishun",orders:236,vehicles:44,atRisk:3,routes:4},
  "NORTH-EAST REGION": {label:"North-East Region",districts:"Punggol · Sengkang · Hougang",orders:291,vehicles:56,atRisk:5,routes:4},
};

type KpiItem={label:string;value:string|number;note:string;icon:typeof Package;accent:string};
const trendLabel=(delta:number|null|undefined,date:string|null|undefined,unit='')=>
  date&&delta!==null&&delta!==undefined?`${delta>0?'↑':delta<0?'↓':'↔'}${Math.abs(delta).toFixed(unit==='pp'?1:0)}${unit} vs ${date.slice(5).replace('-','/')}`:null;
function KpiCard({ item, demo }: { item: KpiItem;demo:boolean }) {
  const Icon = item.icon;
  return <article className={`nexus-kpi ${item.accent}`}>
    <span className="kpi-icon"><Icon/></span>
    <div><small>{item.label}</small><strong>{item.value}</strong></div>
    <em>{item.note}</em>
    {demo&&item.label === "Orders" && <svg viewBox="0 0 70 28" aria-hidden="true"><polyline points="0,25 12,15 23,18 34,7 46,10 55,1 69,0"/></svg>}
    {demo&&item.label === "Exceptions" && <span className="mini-bars">{[10, 22, 35, 19, 28, 14, 8].map((height, i) => <i key={i} style={{height}}/>)}</span>}
  </article>;
}

function MapOverlay({ state, selectedRegion, hoveredRegion, onReset, onViewCommand, cameraBusy, source, snapshot }: { state: AppState; selectedRegion:RegionKey|null; hoveredRegion:RegionKey|null; onReset: () => void; onViewCommand:(kind:CameraCommand['kind'])=>void;cameraBusy:boolean;source:'api'|'demo';snapshot:OverviewSnapshot|null }) {
  const focused = !!selectedRegion;
  const info = selectedRegion ? REGION_STATS[selectedRegion] : null;
  const backend=source==='api';
  const regional=selectedRegion?snapshot?.dashboard.regions?.find(item=>item.region===selectedRegion):null;
  return <>
    <div className="map-heading"><span>SINGAPORE</span><small>{backend?'MAIN ROUTE NETWORK · SIMULATED VEHICLES':focused ? `${info!.label.toUpperCase()} · ${state === "INCIDENT_FOCUS" ? "VEHICLE INCIDENT" : "LIVE OPERATIONS"}` : "LIVE DELIVERY NETWORK"}</small></div>
    {hoveredRegion && !focused && <div className="hover-prompt">{REGION_STATS[hoveredRegion].label} · click to focus</div>}
    {focused && <button className="back-singapore" onClick={onReset}><ArrowLeft/> Back to Singapore</button>}
    <div className="map-mode"><button>2D</button><button className="active">3D</button></div>
    <div className="compass"><small>N</small><span>⌁</span></div>
    <div className="zoom-control"><button aria-label="Zoom in" disabled={cameraBusy} onClick={()=>onViewCommand('in')}><Plus/></button><button aria-label="Zoom out" disabled={cameraBusy} onClick={()=>onViewCommand('out')}><Minus/></button></div>
    <div className="inspection-toolbar"><button onClick={()=>onViewCommand('reset')} disabled={cameraBusy} aria-label="Reset View"><RotateCcw/>Reset View</button><span aria-live="polite">{cameraBusy?'Adjusting view…':'Drag to inspect · Scroll to zoom'}</span></div>
    <div className="live-card"><div><span>{backend?'Simulated positions':'Live Operation'}</span><b>{backend?snapshot?.positions?`${snapshot.positions.vehicles.length} ${snapshot.positions.vehicles.length===1?'vehicle':'vehicles'} in snapshot`:'Positions unavailable':'18 vehicles on route'}</b></div><button aria-label="Vehicle positions" disabled={backend}><Play/></button></div>
    {focused && <aside className="west-focus-panel" key={selectedRegion} aria-label="Region situation">
      <div className="focus-kicker"><span/> {backend?'REGION FOCUS':state === "INCIDENT_FOCUS" ? "INCIDENT RESPONSE" : "REGION FOCUS"}<small>{backend?'BACKEND · DESTINATION COUNTS':'LIVE · MOCK'}</small></div>
      <h3>{info!.label}</h3><p>{info!.districts}</p>
      {backend?<>{snapshot?.dashboard.regions?<><div className="focus-stats"><span><small>Orders</small><b>{regional?.orders??0}</b></span><span><small>Vehicles</small><b>{regional?.vehicles??0}</b></span><span><small>Routes</small><b>{regional?.routes??0}</b></span><span><small>At risk</small><b className="risk-value">{regional?.at_risk??0}</b></span></div><div className="focus-summary">{regional?`${regional.completed} completed · grouped by delivery destination`:'No delivery destinations in this region.'}</div><div className="focus-performance"><span>On-time delivery</span><b>{regional?.on_time_rate===null||regional?.on_time_rate===undefined?'—':`${regional.on_time_rate.toFixed(1)}%`}</b><i><em style={{width:`${regional?.on_time_rate??0}%`}}/></i></div></>:<div className="focus-summary">Regional counts unavailable.</div>}<div className="focus-note"><Clock3/>Plan {snapshot?.dashboard.current_plan.plan_code??'unavailable'}<span>Simulated GPS</span></div></>:<>
      <div className={`focus-health ${state === "INCIDENT_FOCUS" ? "incident" : ""}`}><i/>{state === "INCIDENT_FOCUS" ? "Vehicle unavailable · V03" : "Operations running normally"}</div>
      <div className="focus-stats"><span><small>Active orders</small><b>{info!.orders}</b></span><span><small>Vehicles</small><b>{info!.vehicles}</b></span><span><small>Active routes</small><b>{info!.routes}</b></span><span><small>At risk</small><b className="risk-value">{state === "INCIDENT_FOCUS" ? 12 : info!.atRisk}</b></span></div>
      <div className="focus-section-title">{state === "INCIDENT_FOCUS" ? "IMPACT ASSESSMENT" : "REGIONAL OUTLOOK"}</div>
      <div className="focus-summary">{state === "INCIDENT_FOCUS" ? "12 orders on ER-041 need reassignment. A replacement vehicle is being evaluated near Tampines." : "Delivery capacity is available across the region. Priority orders and pickup points are highlighted on the terrain."}</div>
      <div className="focus-performance"><span>On-time delivery</span><b>{selectedRegion === "WEST REGION" ? "94.8" : "97.2"}%</b><i><em style={{width:selectedRegion === "WEST REGION" ? "94.8%" : "97.2%"}}/></i></div>
      <div className="route-summary"><Waypoints/><span><b>{state === "INCIDENT_FOCUS" ? "Recovery agent · analyzing" : `${info!.routes} routes in this region`}</b><small>{state === "INCIDENT_FOCUS" ? "Checking capacity and delivery windows" : "Vehicles · pickup points · deliveries"}</small></span></div>
      <div className="focus-note"><Clock3/>Updated just now<span>Simulated operations</span></div>
      </>}
    </aside>}
    <div className="scene-caption"><span className="scene-dot"/> {backend?'REFERENCE ROUTE NETWORK · SIMULATED GPS':'SLA + URA 2025 · SINGAPORE DELIVERY NETWORK'}</div>
  </>;
}

function VehiclePanel({source,snapshot,businessDate}:{source:'api'|'demo';snapshot:OverviewSnapshot|null;businessDate:string}) {
  const router=useRouter();
  const backend=source==='api',vehicles=backend&&snapshot?overviewVehicles(snapshot).slice(0,4):[];
  return <section className="bottom-panel vehicle-panel">
    <header><h2>{backend?'Fleet Vehicles':'Active Vehicles'} <small>{backend?snapshot?`${snapshot.dashboard.vehicles.active} / ${overviewMetrics(snapshot).vehicles} active`:'—': '16 / 18 online'}</small></h2><button onClick={()=>router.push(`/vehicles?source=${source}&business_date=${encodeURIComponent(businessDate)}`)}>View all <ChevronRight/></button></header>
    {backend&&!snapshot?.vehicles?<p className="overview-unavailable">Vehicle list unavailable</p>:backend&&vehicles.length===0?<p className="overview-unavailable">No vehicles in the current plan</p>:backend?<div className="vehicle-grid">{vehicles.map(vehicle=><article key={vehicle.vehicle_id}>
      <div className="vehicle-name"><Truck/><b>{vehicle.vehicle_code}</b></div>
      <span className={`vehicle-status ${vehicle.vehicle_status==='UNAVAILABLE'?'delay':'ok'}`}><i/>{vehicle.vehicle_status.replaceAll('_',' ')}</span>
      <div className="vehicle-load"><small>Stops completed</small><b>{vehicle.route?`${vehicle.route.completed_stops} / ${vehicle.route.total_stops}`:'—'}</b></div><p>{vehicle.driver_code} · Route {vehicle.route?.route_no??'—'}</p>
      <div className="vehicle-progress"><i style={{width:vehicle.progress===null?'0%':`${vehicle.progress*100}%`}}/></div>
    </article>)}</div>:<div className="vehicle-grid">{VEHICLES.map((vehicle) => <article key={vehicle.id}>
      <div className="vehicle-name"><Truck/><b>{vehicle.id}</b></div>
      <span className={`vehicle-status ${vehicle.ok ? "ok" : "delay"}`}><i/>{vehicle.status}</span>
      <div className="vehicle-load"><small>▣ ◉</small><b>{vehicle.pct}%</b></div><p>{vehicle.route}</p>
      <div className="vehicle-progress"><i style={{width: `${vehicle.pct}%`}}/></div>
    </article>)}</div>}
  </section>;
}

function IncidentPanel({ onIncident,source,snapshot }: { onIncident: () => void;source:'api'|'demo';snapshot:OverviewSnapshot|null }) {
  const backend=source==='api',incidents=snapshot?.incidents?.filter(item=>item.status!=='RESOLVED').sort((a,b)=>b.detected_at.localeCompare(a.detected_at)).slice(0,3)??[];
  return <section className="bottom-panel incident-panel">
    <header><h2>Incidents &amp; Alerts <em>{backend?snapshot?.dashboard.open_incidents??'—':Object.keys(incidentWorkspaces).length}</em></h2><button disabled={backend} title={backend?'Backend incident workspace is not connected':undefined} onClick={onIncident}>View all <ChevronRight/></button></header>
    {backend?incidents.length?incidents.map(item=><div className="incident-row" key={item.id}><span className="incident-icon red"><AlertTriangle/></span><span><b>{item.incident_type.replaceAll('_',' ')}</b><small>{item.incident_code} · {item.status.replaceAll('_',' ')}</small></span><time>{new Intl.DateTimeFormat('en-SG',{timeZone:'Asia/Singapore',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(item.detected_at))}</time></div>):<p className="overview-unavailable">{snapshot?.incidents?'No open incidents':'Incident list unavailable'}</p>:<>
    <button className="incident-row" onClick={onIncident}><span className="incident-icon red"><AlertTriangle/></span><span><b>{incident.typeLabel}</b><small>{incident.subject.id} · {incident.area}</small></span><time>{incident.detectedAt}</time></button>
    <div className="incident-row"><span className="incident-icon amber"><AlertTriangle/></span><span><b>Traffic risk · AT_RISK</b><small>PIE (Tuas → Jurong) · alert only</small></span><time>24 min ago</time></div>
    <div className="incident-row"><span className="incident-icon amber"><CloudRain/></span><span><b>Weather risk · AT_RISK</b><small>Heavy rain expected · alert only</small></span><time>1 hour ago</time></div>
    </>}
  </section>;
}

function AgentPanel({ state,source,snapshot }: { state: AppState;source:'api'|'demo';snapshot:OverviewSnapshot|null }) {
  const recovery = state === "INCIDENT_FOCUS" || state === "RECOVERY";
  return <section className="bottom-panel agent-panel">
    <header><h2>AI Agent</h2></header>
    {source==='api'?<div className="agent-main"><div className="agent-copy"><div className="agent-status"><span>»</span><p><b>{snapshot?`${snapshot.dashboard.pending_recovery_reviews} pending recovery reviews`:'Backend data unavailable'}</b><small>Current plan · {snapshot?.dashboard.current_plan.plan_code??'—'}</small></p></div><div className="agent-step">{snapshot?`${snapshot.dashboard.open_incidents} open incidents`:'No agent workflow data loaded'}</div><div className="agent-step">Workflow steps are not supplied by this endpoint.</div></div><div className="agent-sculpture"><i/><i/><i/><i/></div></div>:<>
    <div className="agent-main"><div className="agent-copy">
      <div className="agent-status"><span>»</span><p><b>{recovery ? "Recovery staged" : "Recovery review ready"}</b><small>{incident.id} · {incident.affectedOrders} affected orders</small></p></div>
      {["Impact assessed", "Single candidate generated", "Base comparison ready", "Review in Incidents"].map((label, index) => <div className={`agent-step ${index < 2 ? "done" : ""}`} key={label}>{index < 2 ? <Check/> : <span/>}{label}</div>)}
    </div><div className="agent-sculpture"><i/><i/><i/><i/></div></div>
    </>}
  </section>;
}

export default function OperationsConsole({initialPage='overview'}:{initialPage?:'overview'|'operations'}) {
  const router=useRouter();
  const [source,setSource]=useState<'api'|'demo'>('api');
  const [businessDate,setBusinessDate]=useState('');
  const [snapshot,setSnapshot]=useState<OverviewSnapshot|null>(null);
  const planId=snapshot?.dashboard.current_plan.delivery_plan_id;
  const [backendError,setBackendError]=useState<string|null>(null);
  const [backendBusy,setBackendBusy]=useState(false);
  const [overviewRevision,setOverviewRevision]=useState(0);
  const [clock,setClock]=useState<number|null>(null);
  const [geo, setGeo] = useState<RegionCollection | null>(null);
  const [state, setState] = useState<AppState>("SINGAPORE_OVERVIEW");
  const [activePage,setActivePage]=useState<'overview'|'operations'|'incidents'>(initialPage);
  const [visitedOperations,setVisitedOperations]=useState(initialPage==='operations');
  const [visitedIncidents,setVisitedIncidents]=useState(false);
  const [documentVisible,setDocumentVisible]=useState(true);
  const [recoveryRevision,setRecoveryRevision]=useState(0);
  const [operationsRevision,setOperationsRevision]=useState(0);
  const [selectedIncidentId,setSelectedIncidentId]=useState(incident.id);
  const [selectedRegion, setSelectedRegion] = useState<RegionKey | null>(null);
  const [hoveredRegion, setHoveredRegion] = useState<RegionKey|null>(null);
  const [cameraBusy,setCameraBusy]=useState(true);
  const [command,setCommand]=useState<CameraCommand>({id:0,kind:'reset'});
  const viewCommand=(kind:CameraCommand['kind'])=>setCommand(value=>({id:value.id+1,kind}));

  useEffect(()=>{
    const start=setTimeout(()=>{
      setBusinessDate(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Singapore',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()));
      setClock(Date.now());
    },0);
    const timer=setInterval(()=>setClock(Date.now()),1000);
    return()=>{clearTimeout(start);clearInterval(timer);};
  },[]);

  useEffect(()=>{
    if(source!=='api'||activePage!=='overview'||!businessDate)return;
    const controller=new AbortController();let pending=false;
    const refresh=async()=>{
      if(pending)return;pending=true;setBackendBusy(true);
      try{const data=await loadOverview(businessDate,controller.signal);if(!controller.signal.aborted){setSnapshot(data);setBackendError(null);}}
      catch(error){if(!controller.signal.aborted){setSnapshot(null);setBackendError(error instanceof Error?error.message:'Overview data could not be loaded.');}}
      finally{pending=false;if(!controller.signal.aborted)setBackendBusy(false);}
    };
    void refresh();const timer=setInterval(()=>void refresh(),15000);
    return()=>{controller.abort();clearInterval(timer);};
  },[source,businessDate,overviewRevision,activePage]);

  useEffect(()=>{
    if(source!=='api'||activePage!=='overview'||!planId)return;
    const controller=new AbortController();let pending=false;
    const timer=setInterval(async()=>{
      if(pending)return;pending=true;
      try{const data=await loadPositions(businessDate,controller.signal);if(!controller.signal.aborted)setSnapshot(current=>current&&current.dashboard.current_plan.delivery_plan_id===data.delivery_plan_id?{...current,positions:data}:current);}
      catch{if(!controller.signal.aborted)setSnapshot(current=>current?{...current,positions:null}:current);}
      finally{pending=false;}
    },1000);
    return()=>{controller.abort();clearInterval(timer);};
  },[source,businessDate,activePage,planId]);

  useEffect(() => {
    Promise.all([
      fetch('/data/singapore-regions.geojson').then(r=>r.json() as Promise<RegionCollection>),
      fetch('/data/singapore-coastlines.json').then(r=>r.json() as Promise<Record<RegionKey,[number,number][][]>>),
    ]).then(([regions,coastlines])=>setGeo({...regions,features:regions.features.map(feature=>({...feature,properties:{...feature.properties,COASTLINES:coastlines[feature.properties.REGION_N]}}))}));
  }, []);

  useEffect(()=>{
    const update=()=>setDocumentVisible(!document.hidden);
    document.addEventListener('visibilitychange',update);
    return()=>document.removeEventListener('visibilitychange',update);
  },[]);

  const selectRegion = (key:RegionKey) => { setSelectedRegion(key); setState("REGION_FOCUS"); setHoveredRegion(null); };
  const reset = () => { setSelectedRegion(null); setState("SINGAPORE_OVERVIEW"); setHoveredRegion(null); };
  const stageIncident = (id=incident.id) => {if(!incidentWorkspaces[id])return;setSelectedIncidentId(id);setVisitedIncidents(true);setActivePage('incidents');};
  const openOperations=()=>{setOperationsRevision(recoveryRevision);setVisitedOperations(true);setActivePage('operations');};
  const metrics=snapshot?overviewMetrics(snapshot):null;
  const trends=snapshot?.dashboard.trends,compareDate=trends?.comparison_business_date;
  const backendKpi:KpiItem[]=[
    {label:'Orders',value:metrics?.orders??'—',note:trendLabel(trends?.orders_delta,compareDate)??(trends?'No prior plan':'Current plan'),icon:Package,accent:'gold'},
    {label:'Vehicles',value:metrics?.vehicles??'—',note:trendLabel(trends?.vehicles_delta,compareDate)??(metrics?`${metrics.activeVehicles} active`:'Unavailable'),icon:Truck,accent:'gold'},
    {label:'On-time Rate',value:metrics?.onTimeRate===null||metrics?.onTimeRate===undefined?'—':`${metrics.onTimeRate.toFixed(1)}%`,note:metrics?.onTimeRate===null||metrics?.onTimeRate===undefined?'No measured deliveries':trendLabel(trends?.on_time_rate_delta_points,compareDate,'pp')??`${snapshot?.dashboard.on_time?.measured_deliveries??0} measured`,icon:Clock3,accent:'gold'},
    {label:'Open Incidents',value:metrics?.exceptions??'—',note:trendLabel(trends?.open_incidents_delta,compareDate)??(metrics?`${metrics.atRisk} orders at risk`:'Unavailable'),icon:AlertTriangle,accent:'red'},
  ];

  return <main className={`nexus-app page-${activePage}`}>
    <Sidebar onIncident={()=>stageIncident()} onOverview={() => setActivePage('overview')} onOperations={openOperations} activePage={activePage}/>
    <div className="nexus-main" style={activePage!=='overview' ? {display:'none'} : undefined} aria-hidden={activePage!=='overview' || undefined}>
      <header className="nexus-header"><div><h1>Good morning, Alex.</h1><p>{source==='api'?'Current-plan operational snapshot from PenroseRoute.':"Everything in motion. We'll help you keep it that way."}</p></div>
        <div className="header-tools overview-controls"><div className="overview-source"><button aria-pressed={source==='api'} onClick={()=>{setSnapshot(null);setBackendError(null);setSource('api');}}>Backend</button><button aria-pressed={source==='demo'} onClick={()=>setSource('demo')}>Demo</button></div><input aria-label="Business Date" type="date" value={businessDate} onChange={event=>{if(event.target.value){setSnapshot(null);setBackendError(null);setBusinessDate(event.target.value);}}}/><button aria-label="Refresh Overview" disabled={backendBusy||source==='demo'} onClick={()=>setOverviewRevision(value=>value+1)}><RefreshCw/></button><span className="user-avatar"><UserRound/></span></div>
      </header>
      <section className="kpi-row">{(source==='api'?backendKpi:KPI).map((item) => <KpiCard key={item.label} item={item} demo={source==='demo'}/>)}<div className="clock-card"><small>{clock===null?'—':new Intl.DateTimeFormat('en-SG',{timeZone:'Asia/Singapore',weekday:'short',day:'2-digit',month:'short',year:'numeric'}).format(clock)}</small><strong>{clock===null?'—':new Intl.DateTimeFormat('en-SG',{timeZone:'Asia/Singapore',hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(clock)}</strong></div></section>
      {source==='api'&&(backendError||snapshot?.warnings.length)?<div className="overview-data-status" role="status">{backendError?`Overview data unavailable: ${backendError}`:snapshot?.warnings.join(' · ')}</div>:null}
      <section className={`hero-map ${selectedRegion ? "has-region-focus" : ""}`}>
        {geo ? <SingaporeScene active={activePage==='overview'&&documentVisible} geo={geo} selectedRegion={selectedRegion} onSelectRegion={selectRegion} onHoverRegion={setHoveredRegion} command={command} onMotionChange={setCameraBusy} onIncident={stageIncident} source={source} positions={source==='api'?snapshot?.positions??null:null}/> : <div className="map-loading"><Box/><span>Building Singapore model…</span></div>}
        <div className="map-vignette"/><MapOverlay state={state} selectedRegion={selectedRegion} hoveredRegion={hoveredRegion} onReset={reset} onViewCommand={viewCommand} cameraBusy={cameraBusy} source={source} snapshot={snapshot}/>
      </section>
      <section className="bottom-grid"><VehiclePanel source={source} snapshot={snapshot} businessDate={businessDate}/><IncidentPanel source={source} snapshot={snapshot} onIncident={()=>stageIncident()}/><AgentPanel source={source} snapshot={snapshot} state={state}/></section>
      <div className="sr-only" aria-live="polite">{state}. {selectedRegion ?? "Singapore overview"}.</div>
    </div>
    {visitedOperations&&<div style={{display:activePage==='operations' ? 'contents' : 'none'}}><OperationsPage key={operationsRevision} active={activePage==='operations'&&documentVisible} source={source} businessDate={businessDate} onSourceChange={setSource} onBusinessDateChange={setBusinessDate} onOpenIncident={id=>{if(source==='api')router.push(`/incidents?source=api&business_date=${encodeURIComponent(businessDate)}&incident_id=${encodeURIComponent(id)}`);else stageIncident(id);}} recoveryRevision={recoveryRevision}/></div>}
    {visitedIncidents&&<div style={{display:activePage==='incidents' ? 'contents' : 'none'}}><IncidentFocusPage active={activePage==='incidents'} data={incidentWorkspaces[selectedIncidentId]} onRecoveryApplied={()=>setRecoveryRevision(value=>value+1)}/></div>}
  </main>;
}

