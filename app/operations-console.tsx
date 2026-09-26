"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle, ArrowLeft, BarChart3, Bell, Box, Boxes, Check, ChevronRight,
  Clock3, CloudRain, LayoutDashboard, Minus, Package, Play, Plus, Search,
  Settings, Sparkles, Truck, UserRound, Waypoints, RotateCcw,
} from "lucide-react";
import SingaporeScene, { RegionCollection, RegionKey } from "./singapore-scene";
import type { CameraCommand } from './inspection-camera';
import IncidentFocusPage from './incidents/incident-focus-page';
import {incident,incidentWorkspaces} from './incidents/incident-mock';

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

function BrandMark() {
  return <span className="nexus-mark"><span/><span/><span/></span>;
}

function Sidebar({ onIncident, onOverview, incidentActive }: { onIncident: () => void; onOverview: () => void; incidentActive: boolean }) {
  const nav = [
    ["Overview", LayoutDashboard], ["Operations", Boxes], ["Incidents", AlertTriangle],
    ["AI Agent", Sparkles], ["Vehicles", Truck], ["Orders", Package], ["Analytics", BarChart3],
  ] as const;
  return <aside className="nexus-sidebar">
    <div className="nexus-brand"><BrandMark/><span><b>NEXUS</b><small>Delivery Operations</small></span></div>
    <nav>{nav.map(([label, Icon]) => <button key={label} className={(incidentActive ? label === "Incidents" : label === "Overview") ? "active" : ""} aria-current={(incidentActive ? label === "Incidents" : label === "Overview") ? "page" : undefined} onClick={label === "Incidents" ? onIncident : label === "Overview" ? onOverview : undefined}>
      <Icon/><span>{label}</span>{label === "Incidents" && <em>{Object.keys(incidentWorkspaces).length}</em>}
    </button>)}</nav>
    <button className="settings-link"><Settings/><span>Settings</span></button>
  </aside>;
}

function KpiCard({ item }: { item: typeof KPI[number] }) {
  const Icon = item.icon;
  return <article className={`nexus-kpi ${item.accent}`}>
    <span className="kpi-icon"><Icon/></span>
    <div><small>{item.label}</small><strong>{item.value}</strong></div>
    <em>{item.note}</em>
    {item.label === "Orders" && <svg viewBox="0 0 70 28" aria-hidden="true"><polyline points="0,25 12,15 23,18 34,7 46,10 55,1 69,0"/></svg>}
    {item.label === "Exceptions" && <span className="mini-bars">{[10, 22, 35, 19, 28, 14, 8].map((height, i) => <i key={i} style={{height}}/>)}</span>}
  </article>;
}

function MapOverlay({ state, selectedRegion, hoveredRegion, onReset, onViewCommand, cameraBusy }: { state: AppState; selectedRegion:RegionKey|null; hoveredRegion:RegionKey|null; onReset: () => void; onViewCommand:(kind:CameraCommand['kind'])=>void;cameraBusy:boolean }) {
  const focused = !!selectedRegion;
  const info = selectedRegion ? REGION_STATS[selectedRegion] : null;
  return <>
    <div className="map-heading"><span>SINGAPORE</span><small>{focused ? `${info!.label.toUpperCase()} · ${state === "INCIDENT_FOCUS" ? "VEHICLE INCIDENT" : "LIVE OPERATIONS"}` : "LIVE DELIVERY NETWORK"}</small></div>
    {hoveredRegion && !focused && <div className="hover-prompt">{REGION_STATS[hoveredRegion].label} · click to focus</div>}
    {focused && <button className="back-singapore" onClick={onReset}><ArrowLeft/> Back to Singapore</button>}
    <div className="map-mode"><button>2D</button><button className="active">3D</button></div>
    <div className="compass"><small>N</small><span>⌁</span></div>
    <div className="zoom-control"><button aria-label="Zoom in" disabled={cameraBusy} onClick={()=>onViewCommand('in')}><Plus/></button><button aria-label="Zoom out" disabled={cameraBusy} onClick={()=>onViewCommand('out')}><Minus/></button></div>
    <div className="inspection-toolbar"><button onClick={()=>onViewCommand('reset')} disabled={cameraBusy} aria-label="Reset View"><RotateCcw/>Reset View</button><span aria-live="polite">{cameraBusy?'Adjusting view…':'Drag to inspect · Scroll to zoom'}</span></div>
    <div className="live-card"><div><span>Live Operation</span><b>18 vehicles on route</b></div><button><Play/></button></div>
    {focused && <aside className="west-focus-panel" key={selectedRegion} aria-label="Region situation">
      <div className="focus-kicker"><span/> {state === "INCIDENT_FOCUS" ? "INCIDENT RESPONSE" : "REGION FOCUS"}<small>LIVE · MOCK</small></div>
      <h3>{info!.label}</h3><p>{info!.districts}</p>
      <div className={`focus-health ${state === "INCIDENT_FOCUS" ? "incident" : ""}`}><i/>{state === "INCIDENT_FOCUS" ? "Vehicle unavailable · V03" : "Operations running normally"}</div>
      <div className="focus-stats"><span><small>Active orders</small><b>{info!.orders}</b></span><span><small>Vehicles</small><b>{info!.vehicles}</b></span><span><small>Active routes</small><b>{info!.routes}</b></span><span><small>At risk</small><b className="risk-value">{state === "INCIDENT_FOCUS" ? 12 : info!.atRisk}</b></span></div>
      <div className="focus-section-title">{state === "INCIDENT_FOCUS" ? "IMPACT ASSESSMENT" : "REGIONAL OUTLOOK"}</div>
      <div className="focus-summary">{state === "INCIDENT_FOCUS" ? "12 orders on ER-041 need reassignment. A replacement vehicle is being evaluated near Tampines." : "Delivery capacity is available across the region. Priority orders and pickup points are highlighted on the terrain."}</div>
      <div className="focus-performance"><span>On-time delivery</span><b>{selectedRegion === "WEST REGION" ? "94.8" : "97.2"}%</b><i><em style={{width:selectedRegion === "WEST REGION" ? "94.8%" : "97.2%"}}/></i></div>
      <div className="route-summary"><Waypoints/><span><b>{state === "INCIDENT_FOCUS" ? "Recovery agent · analyzing" : `${info!.routes} routes in this region`}</b><small>{state === "INCIDENT_FOCUS" ? "Checking capacity and delivery windows" : "Vehicles · pickup points · deliveries"}</small></span></div>
      <div className="focus-note"><Clock3/>Updated just now<span>Simulated operations</span></div>
    </aside>}
    <div className="scene-caption"><span className="scene-dot"/> SLA + URA 2025 · SINGAPORE DELIVERY NETWORK</div>
  </>;
}

function VehiclePanel() {
  return <section className="bottom-panel vehicle-panel">
    <header><h2>Active Vehicles <small>16 / 18 online</small></h2><button>View all <ChevronRight/></button></header>
    <div className="vehicle-grid">{VEHICLES.map((vehicle) => <article key={vehicle.id}>
      <div className="vehicle-name"><Truck/><b>{vehicle.id}</b></div>
      <span className={`vehicle-status ${vehicle.ok ? "ok" : "delay"}`}><i/>{vehicle.status}</span>
      <div className="vehicle-load"><small>▣ ◉</small><b>{vehicle.pct}%</b></div><p>{vehicle.route}</p>
      <div className="vehicle-progress"><i style={{width: `${vehicle.pct}%`}}/></div>
    </article>)}</div>
  </section>;
}

function IncidentPanel({ onIncident }: { onIncident: () => void }) {
  return <section className="bottom-panel incident-panel">
    <header><h2>Incidents &amp; Alerts <em>{Object.keys(incidentWorkspaces).length}</em></h2><button>View all <ChevronRight/></button></header>
    <button className="incident-row" onClick={onIncident}><span className="incident-icon red"><AlertTriangle/></span><span><b>{incident.typeLabel}</b><small>{incident.subject.id} · {incident.area}</small></span><time>{incident.detectedAt}</time></button>
    <div className="incident-row"><span className="incident-icon amber"><AlertTriangle/></span><span><b>Traffic risk · AT_RISK</b><small>PIE (Tuas → Jurong) · alert only</small></span><time>24 min ago</time></div>
    <div className="incident-row"><span className="incident-icon amber"><CloudRain/></span><span><b>Weather risk · AT_RISK</b><small>Heavy rain expected · alert only</small></span><time>1 hour ago</time></div>
  </section>;
}

function AgentPanel({ state }: { state: AppState }) {
  const recovery = state === "INCIDENT_FOCUS" || state === "RECOVERY";
  return <section className="bottom-panel agent-panel">
    <header><h2>AI Agent</h2></header>
    <div className="agent-main"><div className="agent-copy">
      <div className="agent-status"><span>»</span><p><b>{recovery ? "Recovery staged" : "Recovery review ready"}</b><small>{incident.id} · {incident.affectedOrders} affected orders</small></p></div>
      {["Impact assessed", "Single candidate generated", "Base comparison ready", "Review in Incidents"].map((label, index) => <div className={`agent-step ${index < 2 ? "done" : ""}`} key={label}>{index < 2 ? <Check/> : <span/>}{label}</div>)}
    </div><div className="agent-sculpture"><i/><i/><i/><i/></div></div>
  </section>;
}

export default function OperationsConsole() {
  const [geo, setGeo] = useState<RegionCollection | null>(null);
  const [state, setState] = useState<AppState>("SINGAPORE_OVERVIEW");
  const [incidentActive, setIncidentActive] = useState(false);
  const [selectedIncidentId,setSelectedIncidentId]=useState(incident.id);
  const [selectedRegion, setSelectedRegion] = useState<RegionKey | null>(null);
  const [hoveredRegion, setHoveredRegion] = useState<RegionKey|null>(null);
  const [cameraBusy,setCameraBusy]=useState(true);
  const [command,setCommand]=useState<CameraCommand>({id:0,kind:'reset'});
  const viewCommand=(kind:CameraCommand['kind'])=>setCommand(value=>({id:value.id+1,kind}));

  useEffect(() => {
    Promise.all([
      fetch('/data/singapore-regions.geojson').then(r=>r.json() as Promise<RegionCollection>),
      fetch('/data/singapore-coastlines.json').then(r=>r.json() as Promise<Record<RegionKey,[number,number][][]>>),
    ]).then(([regions,coastlines])=>setGeo({...regions,features:regions.features.map(feature=>({...feature,properties:{...feature.properties,COASTLINES:coastlines[feature.properties.REGION_N]}}))}));
  }, []);

  const selectRegion = (key:RegionKey) => { setSelectedRegion(key); setState("REGION_FOCUS"); setHoveredRegion(null); };
  const reset = () => { setSelectedRegion(null); setState("SINGAPORE_OVERVIEW"); setHoveredRegion(null); };
  const stageIncident = (id=incident.id) => {setSelectedIncidentId(id);setIncidentActive(true);};

  return <main className="nexus-app">
    <Sidebar onIncident={()=>stageIncident()} onOverview={() => setIncidentActive(false)} incidentActive={incidentActive}/>
    <div className="nexus-main" style={incidentActive ? {display:'none'} : undefined} aria-hidden={incidentActive || undefined}>
      <header className="nexus-header"><div><h1>Good morning, Alex.</h1><p>Everything in motion. We&apos;ll help you keep it that way.</p></div>
        <div className="header-tools"><label><Search/><input aria-label="Search" placeholder="Search order, vehicle, location..."/></label><button aria-label="Notifications"><Bell/></button><span className="user-avatar"><UserRound/></span></div>
      </header>
      <section className="kpi-row">{KPI.map((item) => <KpiCard key={item.label} item={item}/>)}<div className="clock-card"><small>Tue, 27 Aug 2024</small><strong>10:24 AM</strong></div></section>
      <section className={`hero-map ${selectedRegion ? "has-region-focus" : ""}`}>
        {geo ? <SingaporeScene geo={geo} selectedRegion={selectedRegion} onSelectRegion={selectRegion} onHoverRegion={setHoveredRegion} command={command} onMotionChange={setCameraBusy} onIncident={stageIncident}/> : <div className="map-loading"><Box/><span>Building Singapore model…</span></div>}
        <div className="map-vignette"/><MapOverlay state={state} selectedRegion={selectedRegion} hoveredRegion={hoveredRegion} onReset={reset} onViewCommand={viewCommand} cameraBusy={cameraBusy}/>
      </section>
      <section className="bottom-grid"><VehiclePanel/><IncidentPanel onIncident={()=>stageIncident()}/><AgentPanel state={state}/></section>
      <div className="sr-only" aria-live="polite">{state}. {selectedRegion ?? "Singapore overview"}.</div>
    </div>
    <div style={{display:incidentActive ? 'contents' : 'none'}}><IncidentFocusPage active={incidentActive} data={incidentWorkspaces[selectedIncidentId]}/></div>
  </main>;
}

