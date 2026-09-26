"use client";

import {useState} from 'react';
import {AlertTriangle, ArrowUpRight, Check, ChevronRight, Clock3, ShieldCheck, Truck, Waypoints} from 'lucide-react';
import {affectedOrders, candidateSet, completedStops, incident, mockDispatchGateway, recoveryVehicles, timeline} from './incident-mock';
import type {AffectedOrder, RecoveryState, RouteMode} from './incident-mock';

type BottomTab = 'orders' | 'timeline' | 'vehicle';
const modes: {id: RouteMode; label: string}[] = [{id:'current',label:'Current Route'},{id:'recovery',label:'Recovery Preview'},{id:'changes',label:'Changes Only'}];
const tabs: {id: BottomTab; label: string}[] = [{id:'orders',label:'Affected Orders'},{id:'timeline',label:'Recovery Timeline'},{id:'vehicle',label:'Vehicle Detail'}];

function IncidentHeader({applied}: {applied: boolean}) {
  return <header className="if-header"><div><div className="if-eyebrow">OPERATIONS / INCIDENTS / {incident.id}</div><h1>Incident Focus <span>V1</span></h1><p>Live Recovery Workspace <i/> {incident.region}</p></div><div className="if-live"><span/>{applied ? 'MONITORING' : 'AWAITING APPROVAL'}<small>MOCK OPERATIONS · 10:42 AM</small></div></header>;
}
function RouteModeToggle({mode,onChange}: {mode: RouteMode; onChange: (mode: RouteMode)=>void}) {
  return <div className="if-modes" role="group" aria-label="Map route view">{modes.map(item=><button key={item.id} aria-pressed={mode===item.id} onClick={()=>onChange(item.id)}>{item.label}</button>)}</div>;
}
function IncidentTacticalMap({mode,selected,onSelect,applied}: {mode: RouteMode; selected: string|null; onSelect: (id: string)=>void; applied: boolean}) {
  return <section className={`if-map if-mode-${mode}`} aria-label="West Region tactical incident map">
    <div className="if-map-caption"><span>WEST REGION</span><small>JURONG EAST / CLEMENTI / WEST COAST</small></div>
    <div className="if-map-north">N <span>↑</span><small>2D</small></div>
    <svg className="if-tactical-svg" viewBox="0 0 960 610" preserveAspectRatio="none" role="img" aria-label="V03 incident, three completed stops, four affected orders and V05 / V02 recovery routes">
      <defs><pattern id="if-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0 H0 V40" fill="none" stroke="#d8cbb0" strokeOpacity=".045"/></pattern><filter id="if-glow"><feGaussianBlur stdDeviation="3"/></filter></defs>
      <rect width="960" height="610" fill="url(#if-grid)"/>
      <g className="if-map-context">
        <path d="M0 530 Q170 475 270 555 T600 575 T960 530 V610 H0Z" fill="#141e20"/>
        <path d="M65 60 H205 V140 H65Z M365 50 H495 V145 H365Z M560 70 H730 V180 H560Z M95 205 H185 V300 H95Z M700 240 H850 V375 H700Z M55 425 H230 V490 H55Z" fill="#151d1e" stroke="#29302e"/>
        {Array.from({length: 36},(_,i)=><rect key={i} x={80+(i%9)*91} y={95+Math.floor(i/9)*113} width={26+(i%3)*9} height={24+(i%4)*6} rx="2" fill="#1c2325" stroke="#343831" strokeWidth=".5"/>)}
        <g fill="none" stroke="#363b37" strokeWidth="8"><path d="M0 170 H960 M0 290 H960 M0 430 H960 M0 500 H960 M230 0 V550 M340 0 V550 M430 0 V560 M540 0 V570 M650 0 V570 M710 0 V560 M790 0 V550 M0 210 H960 M0 370 H960"/></g>
        <g fill="none" stroke="#515348" strokeOpacity=".25"><path d="M0 170 H960 M0 290 H960 M0 430 H960 M0 500 H960 M230 0 V550 M340 0 V550 M430 0 V560 M540 0 V570 M650 0 V570 M710 0 V560 M790 0 V550 M0 210 H960 M0 370 H960"/></g>
        <g className="if-districts"><text x="100" y="90">JURONG WEST</text><text x="430" y="110">JURONG EAST</text><text x="720" y="330">CLEMENTI</text><text x="275" y="555">WEST COAST</text></g>
        <g className="if-road-labels"><text x="50" y="281">BOON LAY WAY</text><text x="690" y="202">JURONG EAST AVE</text><text x="720" y="420">COMMONWEALTH AVE</text></g>
      </g>
      <g className="if-completed"><path d="M160 370 H270 V290 H380" fill="none" stroke="#c8c4b8" strokeWidth="2" strokeDasharray="3 6"/>{completedStops.map(([x,y],i)=><g key={i} transform={`translate(${x} ${y})`}><circle r="7" fill="#242d29" stroke="#c8c4b8"/><path d="M-3 0 L-1 3 L4 -3" fill="none" stroke="#e5e0d5"/></g>)}</g>
      {affectedOrders.map(order=><g key={order.id} className={`if-route ${selected && selected!==order.id ? 'muted' : ''} ${selected===order.id ? 'selected' : ''}`} data-order-route={order.id}>
        <path className="if-old-route" d={order.oldRoute} fill="none" strokeWidth="2" strokeDasharray="7 6"/>
        <path className="if-new-route if-route-glow" d={order.newRoute} fill="none" strokeWidth="7" filter="url(#if-glow)"/>
        <path className="if-new-route" d={order.newRoute} fill="none" strokeWidth="2.5"/>
      </g>)}
      <circle cx="380" cy="290" r="45" fill="#ff654f" fillOpacity=".035" stroke="#ff654f" strokeOpacity=".2" strokeDasharray="3 7"/>
      <circle cx="380" cy="290" r="24" fill="#ff654f" fillOpacity=".07" stroke="#ff654f" strokeOpacity=".4"/>
      <g transform="translate(380 290)"><rect x="-12" y="-12" width="24" height="24" rx="6" fill="#452422" stroke="#ff7865"/><path d="M0 -6 V2 M0 5 V6" stroke="#ffb3a7" strokeWidth="2"/><text className="if-incident-label" x="-62" y="-37">V03 · UNAVAILABLE</text></g>
      {recoveryVehicles.map(vehicle=><g className="if-replacement" key={vehicle.id} transform={`translate(${vehicle.point[0]} ${vehicle.point[1]})`}><rect x="-15" y="-11" width="30" height="22" rx="5" fill="#383226" stroke="#e1c68d"/><path d="M-8 -4 H3 V4 H-8Z M3 0 H8 V4 H3 M-5 4 V7 M6 4 V7" fill="none" stroke="#f0dfb8"/><text x="-16" y="-22">{vehicle.id}</text></g>)}
    </svg>
    {affectedOrders.map(order=><button key={order.id} className={`if-order-pin ${selected===order.id ? 'selected' : ''}`} style={{left:`${order.point[0]/960*100}%`,top:`${order.point[1]/610*100}%`}} onClick={()=>onSelect(order.id)} aria-label={`Select ${order.id}`} aria-pressed={selected===order.id}><span/><b>{order.id}</b><small>{order.assignedTo}</small></button>)}
    <div className="if-map-legend"><span><i className="old"/>Original route</span><span><i className="new"/>{applied ? 'Applied recovery' : 'Recovery preview'}</span><span><i className="stop"/>Completed / protected</span></div>
    <div className="if-map-scale"><span/>SCHEMATIC · MOCK DATA</div>
    {selected && <div className="if-map-selection">{selected} <ChevronRight/> {affectedOrders.find(order=>order.id===selected)?.assignedTo} <span>Old / new route highlighted</span></div>}
  </section>;
}
function IncidentSummaryCard() {
  return <section className="if-card if-summary"><div className="if-eyebrow"><AlertTriangle/>INCIDENT · {incident.id}</div><h2>{incident.type}</h2><p>{incident.vehicle} · {incident.region}</p><dl><div><dt>Detected time</dt><dd>{incident.detectedAt}</dd></div><div><dt>Affected Orders</dt><dd>{incident.affectedOrders} <small>pending</small></dd></div><div><dt>Completed Stops Protected</dt><dd><ShieldCheck/>{incident.completedStopsProtected}</dd></div><div><dt>Delivery Risk</dt><dd className="if-risk">{incident.deliveryRisk}</dd></div><div><dt>Current Delay Estimate</dt><dd>{incident.currentDelayEstimate}</dd></div></dl></section>;
}
function RecoveryProgress({applied}: {applied: boolean}) {
  return <div className="if-progress"><h3>Recovery Progress</h3>{['Assessing impact','Generating route','Validating constraints',applied ? 'Applied / Monitoring' : 'Ready for approval'].map((step,i)=><div key={step} className={i===3 ? 'current' : ''}>{i<3 || applied ? <Check/> : <span/>}{step}</div>)}</div>;
}
function RecoveryPlanCard({applied,pending,error,onApprove,onWorkspace}: {applied: boolean; pending: boolean; error: string|null; onApprove: ()=>void; onWorkspace: ()=>void}) {
  const candidate = candidateSet.candidates[0];
  return <section className="if-card if-recovery"><div className="if-card-heading"><h2><Waypoints/>Recovery Plan</h2><span>{applied ? 'APPLIED' : 'PREVIEW'}</span></div><p className="if-candidate">{candidate.id} · Revision {candidate.revision} · Single candidate</p>{candidate.assignments.map(assignment=><div className="if-assignment" key={assignment.vehicle}><span className="if-truck"><Truck/></span><div><b>{assignment.orders.join(', ')}</b><small>{assignment.note}</small></div><strong>{assignment.vehicle}</strong></div>)}<div className="if-protected"><ShieldCheck/>3 completed stops preserved<span>{candidate.unassigned} unassigned</span></div><RecoveryProgress applied={applied}/><button className="if-approve" onClick={onApprove} disabled={pending || applied || candidate.status!=='ready'}>{applied ? <Check/> : <ArrowUpRight/>}{applied ? 'Applied / Monitoring' : pending ? 'Applying mock dispatch…' : 'Approve Dispatch'}</button><p className="if-approval-note" role="status">{error ?? (applied ? 'Mock dispatch applied. Recovery is being monitored.' : 'Human approval required · Simulated dispatch only')}</p><button className="if-workspace-link" onClick={onWorkspace}>View Full Incident Workspace<ArrowUpRight/></button></section>;
}
function AffectedOrdersTable({selected,onSelect,onHover,applied}: {selected: string|null; onSelect: (id: string)=>void; onHover: (id: string|null)=>void; applied: boolean}) {
  return <table className="if-orders"><thead><tr>{['Order ID','Customer / Location','Original ETA','New ETA','Assigned To','Status'].map(label=><th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{affectedOrders.map((order: AffectedOrder)=><tr key={order.id} className={selected===order.id ? 'selected' : ''} onMouseEnter={()=>onHover(order.id)} onMouseLeave={()=>onHover(null)} onFocus={()=>onHover(order.id)} onBlur={()=>onHover(null)}><td><button onClick={()=>onSelect(order.id)} aria-pressed={selected===order.id}>{order.id}<ArrowUpRight/></button></td><td>{order.customer}<small>{order.location}</small></td><td className="if-original-eta">{order.originalEta}</td><td>{order.newEta}</td><td><Truck/>{order.assignedTo}</td><td><span className="if-order-status">{applied ? 'Monitoring' : 'Pending approval'}</span></td></tr>)}</tbody></table>;
}
function IncidentBottomTabs({tab,onChange,selected,onSelect,onHover,applied}: {tab: BottomTab; onChange: (tab: BottomTab)=>void; selected: string|null; onSelect: (id: string)=>void; onHover: (id: string|null)=>void; applied: boolean}) {
  return <section className="if-bottom"><header><div role="tablist" aria-label="Incident details">{tabs.map(item=><button key={item.id} id={`if-tab-${item.id}`} role="tab" aria-selected={tab===item.id} aria-controls="if-detail-panel" onClick={()=>onChange(item.id)}>{item.label}{item.id==='orders' && <span>4</span>}</button>)}</div><small><ShieldCheck/>Completed deliveries protected</small></header><div id="if-detail-panel" role="tabpanel" aria-labelledby={`if-tab-${tab}`}>
    {tab==='orders' && <AffectedOrdersTable selected={selected} onSelect={onSelect} onHover={onHover} applied={applied}/>}
    {tab==='timeline' && <ol className="if-timeline">{timeline.map(event=><li key={event.time}><time>{event.time}</time><div><b>{event.title}</b><p>{event.detail}</p></div><Check/></li>)}{applied && <li><time>DEMO</time><div><b>Dispatch applied / Monitoring</b><p>Operator approved C-007-A. Four orders reassigned in mock state.</p></div><Check/></li>}</ol>}
    {tab==='vehicle' && <div className="if-vehicle-detail"><article><AlertTriangle/><h3>V03 · Unavailable</h3><p>West Region · Jurong East</p><span>3 stops completed · 4 pending</span><small>Current route paused. Completed deliveries remain protected.</small></article>{recoveryVehicles.map(vehicle=><article key={vehicle.id}><Truck/><h3>{vehicle.id} · {applied ? 'Recovery assigned' : 'Recovery available'}</h3><p>{vehicle.detail}</p><span>{candidateSet.candidates[0].assignments.find(item=>item.vehicle===vehicle.id)?.orders.join(' · ')}</span><small>{applied ? 'Mock assignment applied' : 'Assignment awaits human approval'}</small></article>)}</div>}
  </div></section>;
}
export default function IncidentFocusPage() {
  const [mode,setMode] = useState<RouteMode>('recovery');
  const [selected,setSelected] = useState<string|null>(null);
  const [hovered,setHovered] = useState<string|null>(null);
  const [tab,setTab] = useState<BottomTab>('orders');
  const [recoveryState,setRecoveryState] = useState<RecoveryState>('ready');
  const [pending,setPending] = useState(false);
  const [error,setError] = useState<string|null>(null);
  const applied = recoveryState==='applied';
  const selectOrder = (id: string)=>setSelected(current=>current===id ? null : id);
  async function approveDispatch() {
    const candidate = candidateSet.candidates[0];
    if(pending || applied || candidate.status!=='ready') return;
    setPending(true); setError(null);
    try { await mockDispatchGateway.approve(incident.id,candidate.id,candidate.revision); setRecoveryState('applied'); }
    catch { setError('Dispatch could not be applied. Please try again.'); }
    finally {setPending(false);}
  }
  return <div className="incident-focus-page"><IncidentHeader applied={applied}/><div className="if-top-strip"><span><AlertTriangle/>V03 unavailable <small>4 orders require recovery</small></span><span><Clock3/>{applied ? 'Recovery applied · Monitoring' : 'Recovery ready for your approval'}</span></div><div className="if-work-area"><div className="if-map-area"><header><div><Waypoints/><h2>Tactical Incident Map</h2><span>2D FOCUS</span></div><RouteModeToggle mode={mode} onChange={setMode}/></header><IncidentTacticalMap mode={mode} selected={hovered ?? selected} onSelect={selectOrder} applied={applied}/></div><aside className="if-decision" aria-label="Incident and recovery decisions"><IncidentSummaryCard/><RecoveryPlanCard applied={applied} pending={pending} error={error} onApprove={approveDispatch} onWorkspace={()=>{setTab('timeline'); document.getElementById('if-detail-panel')?.scrollIntoView({block:'nearest',behavior:'smooth'});}}/></aside></div><IncidentBottomTabs tab={tab} onChange={setTab} selected={selected} onSelect={selectOrder} onHover={setHovered} applied={applied}/></div>;
}
