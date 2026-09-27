"use client";
import {createContext,useContext,useEffect,useRef,useState} from 'react';
import {AlertTriangle,ArrowUpRight,Check,Package,ShieldCheck,Truck,Waypoints,X,SlidersHorizontal,ChartNoAxesCombined} from 'lucide-react';
import {incidentWorkspace} from './incident-mock';
import type {IncidentWorkspace,RouteMode} from './incident-types';
import IncidentTacticalMap from './incident-tactical-map';
import ComparisonDetails,{RemainingTravel} from './comparison-details';

const WorkspaceContext=createContext(incidentWorkspace);
const useWorkspace=()=>useContext(WorkspaceContext);
type CardContext='incident'|'order'|'vehicle';
const modes:{id:RouteMode;label:string}[]=[{id:'current',label:'Current Route'},{id:'recovery',label:'Recovery Preview'},{id:'changes',label:'Changes Only'}];

function IncidentHeader(){
  const {incident,candidatePlan}=useWorkspace();
  return <header className="if-header"><div><div className="if-eyebrow">OPERATIONS / INCIDENTS / {incident.id}</div><h1>Incident Focus</h1><p>Incident evidence and route comparison. Decisions are handled outside this view.</p></div><div className="if-live"><span/>{candidatePlan.status==='APPLIED'?'APPLIED / MONITORING':candidatePlan.status==='READY'?'DISPATCHER REVIEW':candidatePlan.status}<small>DEMO WORKSPACE · SINGLE CANDIDATE</small></div></header>;
}
function RouteModeToggle({mode,onChange}:{mode:RouteMode;onChange:(mode:RouteMode)=>void}){
  return <div className="if-modes" role="group" aria-label="Map route view">{modes.map(item=><button key={item.id} aria-pressed={mode===item.id} onClick={()=>onChange(item.id)}><Waypoints/>{item.label}</button>)}</div>;
}
function IncidentSummaryCard(){
  const {incident}=useWorkspace();
  return <section className="if-summary"><div className="if-incident-heading"><span className="if-alert-icon"><AlertTriangle/></span><div><span className="if-eyebrow">{incident.id}</span><h2>{incident.typeLabel}</h2><p>{incident.subject.id} · {incident.region}</p><small>Detected at {incident.detectedAt}</small></div></div><dl><div><dt>Affected Orders</dt><dd className="if-coral">{incident.affectedOrders}</dd></div><div><dt>Completed Stops Protected</dt><dd className="if-safe"><ShieldCheck/>{incident.completedStopsProtected}</dd></div></dl></section>;
}
function RecoveryPlanCard({onWorkspace}:{onWorkspace:()=>void}){
  const data=useWorkspace();const {candidatePlan:candidate,comparison}=data;
  const applied=candidate.status==='APPLIED';
  return <section className="if-recovery"><div className="if-review-content"><div className="if-card-heading"><h2>{applied?'Applied Recovery':'Recovery Candidate'}</h2><span className={applied?'applied':candidate.status==='STALE'?'stale':''}>{applied&&<Check/>}{candidate.status}</span><button className="if-card-detail-link" aria-label="View comparison details" title="View comparison details" onClick={onWorkspace}><ArrowUpRight/></button></div><div className="if-baseline"><span>Candidate <b>{comparison.candidatePlanId}</b></span></div><div className="if-eligibility"><span>Comparison <b>{comparison.comparable?'Comparable':'Unavailable'}</b></span></div><div className="if-change-summary"><div><span>Reassigned<b>{comparison.disturbanceSummary.reassignedOrders}</b></span><span>Vehicles affected<b>{comparison.disturbanceSummary.affectedVehicles}</b></span><span>ETA impact<b>{comparison.disturbanceSummary.etaSummary.split(' across ')[0]}</b></span></div></div></div><p className="if-approval-note">Read-only comparison. Recovery actions and decisions are outside Incidents.</p></section>;
}
type SelectionProps={selected:string|null;onSelect:(id:string)=>void;onHover:(id:string|null)=>void};
function AffectedOrdersTable({selected,onSelect,onHover}:SelectionProps){
  const {affectedOrders,comparison,candidatePlan}=useWorkspace();
  return <div className="if-table-scroll"><table className="if-orders"><thead><tr>{['Order','Location','Base Vehicle','Candidate Vehicle','Old ETA','New ETA','Delta','Change','Action'].map(label=><th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{affectedOrders.map(order=>{
    const assignment=comparison.assignmentChanges.find(change=>change.orderId===order.id),eta=comparison.etaChanges.find(change=>change.orderId===order.id);
    return <tr key={order.id} className={selected===order.id?'selected':''} onClick={()=>onSelect(order.id)} onMouseEnter={()=>onHover(order.id)} onMouseLeave={()=>onHover(null)}><td><Package/>{order.id}</td><td>{order.location}</td><td>{assignment?(assignment.baseVehicle??'Unassigned'):'Unavailable'}</td><td>{assignment?(assignment.candidateVehicle??'Unassigned'):'Unavailable'}</td><td className="if-original-eta">{eta?.oldEta??'Unavailable'}</td><td>{eta?.newEta??'Unavailable'}</td><td className="if-coral">{eta?.delta??'Unavailable'}{eta?.unavailableReason&&<small className="if-eta-reason">{eta.unavailableReason}</small>}</td><td><span className={`if-order-status ${candidatePlan.status==='APPLIED'?'applied':''}`}>{assignment?.change??'Unavailable'}<small>{candidatePlan.status==='APPLIED'?<><Check/>Applied</>:'Candidate'}</small></span></td><td><button aria-label={`View order ${order.id}`} aria-pressed={selected===order.id} onClick={event=>{event.stopPropagation();onSelect(order.id);}}>View<ArrowUpRight/></button></td></tr>;
  })}</tbody></table></div>;
}
function EntityContext({context,orderId,vehicleId,onIncident}:{context:CardContext;orderId:string|null;vehicleId:string|null;onIncident:()=>void}){
  const {incident,affectedOrders,comparison,recoveryVehicles,candidatePlan}=useWorkspace();
  const order=affectedOrders.find(item=>item.id===orderId),assignment=comparison.assignmentChanges.find(item=>item.orderId===orderId),eta=comparison.etaChanges.find(item=>item.orderId===orderId);
  const vehicle=recoveryVehicles.find(item=>item.id===vehicleId);
  return <section className="if-entity-context"><div className="if-eyebrow">{context==='order'?'AFFECTED ORDER':'RECOVERY VEHICLE'} · {incident.id}</div><h2>{context==='order'?orderId:vehicleId}</h2><p>{context==='order'?order?.location:vehicle?.detail}</p>{context==='order'?<dl><div><dt>Customer</dt><dd>{order?.customer}</dd></div><div><dt>Base vehicle</dt><dd>{assignment?.baseVehicle??'Unassigned'}</dd></div><div><dt>{candidatePlan.status==='APPLIED'?'Assigned vehicle':'Candidate vehicle'}</dt><dd>{assignment?.candidateVehicle??'Unassigned'}</dd></div><div><dt>Original ETA</dt><dd>{eta?.oldEta??'Unavailable'}</dd></div><div><dt>New ETA</dt><dd>{eta?.newEta??'Unavailable'}</dd></div><div><dt>ETA change</dt><dd className="if-coral">{eta?.delta??'Unavailable'}</dd></div></dl>:<><p className="if-protected-note">{candidatePlan.assignments.find(item=>item.vehicle===vehicleId)?.note}</p><div className="if-context-orders">{candidatePlan.assignments.find(item=>item.vehicle===vehicleId)?.orders.join(' · ')}</div></>}<p className="if-comparison-note">{candidatePlan.status==='APPLIED'?'Mock dispatch applied.':'Proposed recovery · dispatcher approval required.'}</p><button className="if-comparison-link" onClick={onIncident}>Review incident & candidate<ArrowUpRight/></button></section>;
}
function VehicleDetail({onVehicle}:{onVehicle:(id:string)=>void}){
  const {incident,recoveryVehicles,candidatePlan}=useWorkspace();
  return <div className="if-vehicle-detail"><article><AlertTriangle/><h3>{incident.subject.id} · {incident.typeLabel}</h3><p>{incident.region} · {incident.area}</p><span>{incident.completedStopsProtected} stops protected · {incident.affectedOrders} affected</span><small>Completed / frozen work stays unchanged.</small></article>{recoveryVehicles.map(vehicle=><article key={vehicle.id}><Truck/><h3>{vehicle.id} · {candidatePlan.status==='APPLIED'?'Recovery assigned':'Candidate vehicle'}</h3><p>{vehicle.detail}</p><span>{candidatePlan.assignments.find(item=>item.vehicle===vehicle.id)?.orders.join(' · ')}</span><small>{candidatePlan.status==='APPLIED'?'Mock dispatch applied':'Proposed assignment · review required'}</small><button className="if-comparison-link" onClick={()=>onVehicle(vehicle.id)}>Locate on map<ArrowUpRight/></button></article>)}</div>;
}
function PlanImpactSummary(){
  const {comparison,candidatePlan}=useWorkspace();const impact=comparison.disturbanceSummary;
  return <><div className="if-impact-grid"><div><Package/><span>Orders reassigned<b>{impact.reassignedOrders}</b></span></div><div><Truck/><span>Vehicles affected<b>{impact.affectedVehicles}</b></span></div><div><Waypoints/><span>Route tasks changed<b>{impact.routeTasksChanged}</b></span></div><div><ChartNoAxesCombined/><span>ETA impact<b className="if-coral">{impact.etaSummary.split(' across ')[0]}</b></span></div></div><div className="if-impact-metrics"><RemainingTravel label="Remaining distance" metric={comparison.remainingMetrics.distance}/><RemainingTravel label="Remaining duration" metric={comparison.remainingMetrics.duration}/></div><p className="if-protected-note"><ShieldCheck/>{impact.protectedWork}</p><div className="if-workflow-status"><span className="if-status-dot"/>{candidatePlan.status==='APPLIED'?'Mock dispatch applied · Monitoring':candidatePlan.status==='READY'?'Awaiting dispatcher approval':`Candidate ${candidatePlan.status.toLowerCase()}`}<small>Execution telemetry is not connected.</small></div></>;
}
function IncidentFocusContent({initialData,active}:{initialData:IncidentWorkspace;active:boolean}){
  const data=initialData;const [mode,setMode]=useState<RouteMode>('recovery');
  const [selected,setSelected]=useState<string|null>(null),[hovered,setHovered]=useState<string|null>(null),[selectedVehicle,setSelectedVehicle]=useState<string|null>(null);
  const [incidentCardOpen,setIncidentCardOpen]=useState(false),[cardContext,setCardContext]=useState<CardContext>('incident');
  const pageRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(!active)return;const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape')setIncidentCardOpen(false);};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);},[active]);
  const revealMap=()=>{const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;pageRef.current?.scrollTo({top:0,behavior:reduced?'instant':'smooth'});};
  const selectOrder=(id:string)=>{setSelected(id);setHovered(null);setSelectedVehicle(null);setCardContext('order');setIncidentCardOpen(true);revealMap();};
  const selectVehicle=(id:string)=>{setSelectedVehicle(id);setSelected(null);setHovered(null);setCardContext('vehicle');setIncidentCardOpen(true);revealMap();};
  const toggleIncident=()=>{setIncidentCardOpen(current=>cardContext==='incident'?!current:true);setCardContext('incident');setSelected(null);setSelectedVehicle(null);setHovered(null);};
  return <WorkspaceContext.Provider value={data}><div ref={pageRef} className="incident-focus-page" data-incident-id={data.incident.id} data-candidate-status={data.candidatePlan.status}>
    <section className="if-map-hero" aria-label="Incident map workspace"><div className="if-hero-heading"><IncidentHeader/><RouteModeToggle mode={mode} onChange={setMode}/></div>
      {active&&<IncidentTacticalMap data={data} mode={mode} selected={hovered??selected} selectedVehicle={selectedVehicle} onSelect={selectOrder} onHover={setHovered} onVehicle={selectVehicle} onIncident={toggleIncident} onEmptyMap={()=>setIncidentCardOpen(false)} incidentCardOpen={incidentCardOpen&&cardContext==='incident'} applied={data.candidatePlan.status==='APPLIED'}/>}
      <aside className="if-floating-card" hidden={!incidentCardOpen} aria-label={cardContext==='incident'?'Incident and recovery snapshot':`${cardContext} context`} data-context={cardContext}>
        <button className="if-card-close" aria-label="Close incident card" onClick={()=>setIncidentCardOpen(false)}><X/></button>
        {cardContext==='incident'?<><IncidentSummaryCard/><RecoveryPlanCard onWorkspace={()=>document.getElementById('if-comparison')?.scrollIntoView({behavior:'smooth',block:'start'})}/></>:<EntityContext context={cardContext} orderId={selected} vehicleId={selectedVehicle} onIncident={()=>setCardContext('incident')}/>}
      </aside>
    </section>
    <div className="if-map-plan-caption"><span>{mode==='current'?`Base Plan · ${data.basePlan.id}`:mode==='recovery'?`${data.candidatePlan.status==='APPLIED'?'Applied Recovery':'Recovery Candidate'} · ${data.candidatePlan.id}`:'Structured Base → Candidate changes'}</span><span>Mock operational data · Ctrl / ⌘ + scroll to zoom</span></div>
    <div className="if-detail-sections">
      <section className="if-detail-section" id="if-orders"><header><Package/><div><h2>Affected Orders <span>{data.affectedOrders.length}</span></h2><p>Orders impacted by this incident and their {data.candidatePlan.status==='APPLIED'?'applied':'proposed'} recovery assignments.</p></div><a href="#if-comparison" onClick={event=>{event.preventDefault();document.getElementById('if-comparison')?.scrollIntoView({behavior:'smooth'});}}>Comparison details<ArrowUpRight/></a></header><AffectedOrdersTable selected={hovered??selected} onSelect={selectOrder} onHover={setHovered}/></section>
      <section className="if-detail-section" id="if-comparison"><header><SlidersHorizontal/><div><h2>What Changes</h2><p>See who takes over, what changes and when orders arrive.</p></div></header><ComparisonDetails comparison={data.comparison} orders={data.affectedOrders} cause={data.incident.type==='VEHICLE_UNAVAILABLE'?`Vehicle ${data.incident.subject.id} unavailable`:`${data.incident.subject.id} · ${data.incident.typeLabel}`} onOrder={id=>{setMode('recovery');selectOrder(id);}}/></section>
      <section className="if-detail-section" id="if-vehicles"><header><Truck/><div><h2>Vehicle Detail</h2><p>Current incident context and recovery assignments.</p></div></header><VehicleDetail onVehicle={selectVehicle}/></section>
      <section className="if-detail-section" id="if-impact"><header><ChartNoAxesCombined/><div><h2>Plan Impact Summary</h2><p>Operational impact of the {data.candidatePlan.status==='APPLIED'?'applied plan':'proposed recovery'}.</p></div></header><PlanImpactSummary/></section>
    </div>
    <footer className="if-page-footer">NEXUS / INCIDENT WORKSPACE<span>Read-only mock evidence · No dispatcher actions here</span></footer>
  </div></WorkspaceContext.Provider>;
}
export default function IncidentFocusPage({data=incidentWorkspace,active=true}:{data?:IncidentWorkspace;active?:boolean}){return <IncidentFocusContent key={data.incident.id} initialData={data} active={active}/>;}



