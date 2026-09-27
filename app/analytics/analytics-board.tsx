"use client";
import {useEffect,useRef,useState} from 'react';
import type {RefObject} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';
import {AlertTriangle,ArrowLeftRight,CheckCircle2,CircleDashed,Clock3,Coins,FileText,Info,Package,Route,ShieldCheck,Truck,Users} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';
import {DEMO_ANALYTICS_DATE,demoAnalyticsSnapshots} from './analytics-demo';
import {barWidths,buildAnalytics} from './analytics-model';
import {easeOutCubic,ringFrame} from './analytics-motion';

type Option={id:string;code:string};
type AttemptOption={id:string;number:number;status:string};
type Filter='All'|'Changed'|'Handover'|'Unassigned'|'Frozen';
const signed=(value:number|null,digits=1)=>value===null?'—':`${value>0?'+':''}${value.toFixed(digits)}`;
const price=(value:number|null)=>value===null?'—':`SGD ${value.toFixed(2)}`;
const vehicle=(id:string|null)=>id===null?'—':/^V(?:EH-)?\d/.test(id)?id:`Vehicle ${id.slice(0,8)}…`;
const readable=(value:string)=>value.replaceAll('_',' ').toLowerCase().replace(/\b\w/g,letter=>letter.toUpperCase());
const eta=(seconds:number|null)=>seconds===null?'—':`${seconds>0?'+':''}${Number.isInteger(seconds/60)?seconds/60:(seconds/60).toFixed(1)} min`;

function useVisible<T extends HTMLElement>():[RefObject<T|null>,boolean]{
  const ref=useRef<T>(null),[visible,setVisible]=useState(false);
  useEffect(()=>{
    const element=ref.current;if(!element)return;
    if(!('IntersectionObserver'in window)){const frame=requestAnimationFrame(()=>setVisible(true));return()=>cancelAnimationFrame(frame);}
    const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){setVisible(true);observer.disconnect();}},{threshold:.15});
    observer.observe(element);return()=>observer.disconnect();
  },[]);
  return [ref,visible];
}

function CoverageRing({ratio,label,affected,recovered}:{ratio:number|null;label:string;affected:number;recovered:number|null}){
  const [ref,visible]=useVisible<HTMLDivElement>();
  const [display,setDisplay]=useState(0),current=useRef(0);
  useEffect(()=>{
    if(!visible||ratio===null)return;
    const target=ratio,start=current.current;
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){const frame=requestAnimationFrame(()=>{current.current=target;setDisplay(target);});return()=>cancelAnimationFrame(frame);}
    const begun=performance.now();let frame=0;
    const tick=(time:number)=>{const progress=Math.min(1,(time-begun)/1200);const value=start+(target-start)*easeOutCubic(progress);current.current=value;setDisplay(value);if(progress<1)frame=requestAnimationFrame(tick);};
    frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
  },[ratio,visible]);
  const radius=62,circumference=2*Math.PI*radius;
  const shown=ratio===null?null:ringFrame(1,display,radius);
  return <div className="an-coverage" ref={ref} aria-label={`Recoverable coverage: ${label}`}>
    <div className="an-ring"><svg viewBox="0 0 160 160" aria-hidden="true"><circle className="an-ring-track" cx="80" cy="80" r={radius}/><circle className="an-ring-progress" cx="80" cy="80" r={radius} strokeDasharray={circumference} strokeDashoffset={shown?.dashOffset??circumference}/></svg><strong>{shown?shown.label:label}</strong></div>
    <b>Recoverable Coverage</b><small>{recovered===null?'Candidate data unavailable':`${recovered} of ${affected} affected unfinished orders`}</small>
  </div>;
}

function MetricCard({icon:Icon,label,value,detail,reason}:{icon:LucideIcon;label:string;value:string;detail:string;reason?:string|null}){
  return <article className="an-metric" title={reason??undefined}><span className="an-icon"><Icon/></span><div><small>{label}</small><strong>{value}</strong><p>{reason??detail}</p></div><i aria-hidden="true"/></article>;
}

function ComparisonPanel({view}:{view:ReturnType<typeof buildAnalytics>}){
  const [ref,visible]=useVisible<HTMLElement>();
  const rows=[
    {label:'Assigned Orders',icon:FileText,base:view.assigned.base,candidate:view.assigned.candidate,format:(n:number)=>String(n),reason:null},
    {label:'Unassigned Orders',icon:CircleDashed,base:view.unassigned.base,candidate:view.unassigned.candidate,format:(n:number)=>String(n),reason:null},
    {label:'Remaining Distance',icon:Route,base:view.distance.base,candidate:view.distance.candidate,format:(n:number)=>`${n.toFixed(1)} km`,reason:view.distanceReason},
    {label:'Remaining Travel Time',icon:Clock3,base:view.duration.base,candidate:view.duration.candidate,format:(n:number)=>`${n.toFixed(1)} h`,reason:view.durationReason},
    {label:'Estimated Mileage Cost',icon:Coins,base:view.baseCost,candidate:view.candidateCost,format:(n:number)=>price(n),reason:view.costReason},
  ];
  return <section className="an-panel an-comparison" ref={ref}><header><h2>Planning &amp; Recovery Comparison</h2><div className="an-legend"><span><i/>Base Plan</span><span><i/>Recovery Candidate</span></div></header>
    <div className="an-comparison-rows">{rows.map(({label,icon:Icon,base,candidate,format,reason},index)=>{const [baseWidth,candidateWidth]=barWidths(base,candidate);return <div className="an-comparison-row" key={label} title={reason??undefined}><div className="an-row-label"><Icon/><span>{label}</span></div><div className="an-bars"><div className="an-track">{baseWidth!==null&&<span className="an-fill base" style={{transform:`scaleX(${visible?baseWidth:0})`,transitionDelay:`${index*80}ms`}}/>}</div><div className="an-track">{candidateWidth!==null&&<span className="an-fill candidate" style={{transform:`scaleX(${visible?candidateWidth:0})`,transitionDelay:`${index*80}ms`}}/>}</div></div><div className="an-values"><span>{base===null?'—':format(base)}</span><span>{candidate===null?'—':format(candidate)}</span></div></div>;})}</div>
    <p className="an-comparison-note"><Info/>{view.distanceReason??'Assignment counts cover the whole plan; coverage counts affected unfinished orders only.'}</p>
  </section>;
}

function ImpactPanel({view}:{view:ReturnType<typeof buildAnalytics>}){
  const {snapshot}=view;
  const cards=[
    {label:'Completed Orders Frozen',value:String(snapshot.incident.frozenOrderIds.length),icon:CheckCircle2},
    {label:'Handover Required',value:String(snapshot.incident.handoverOrderIds.length),icon:Users},
    {label:'Vehicle Assignment Changes',value:view.reassigned===null?'—':String(view.reassigned),icon:Truck},
    {label:'Current Candidate Status',value:snapshot.candidatePlan?(snapshot.attempt.decision??readable(snapshot.attempt.status)):'No Candidate',icon:FileText},
  ];
  return <section className="an-panel an-impact"><header><h2>Recovery Impact Summary</h2></header><div className="an-impact-body"><div className="an-impact-cards">{cards.map(({label,value,icon:Icon})=><article key={label}><span className="an-small-icon"><Icon/></span><div><small>{label}</small><strong>{value}</strong></div></article>)}</div><CoverageRing {...view.coverage} affected={view.affected} recovered={view.recovered}/></div><p className="an-impact-note">Planned candidate coverage · not actual delivery completion</p></section>;
}

function OrdersPanel({view}:{view:ReturnType<typeof buildAnalytics>}){
  const [filter,setFilter]=useState<Filter>('All');
  const rows=view.rows.filter(row=>filter==='All'||filter==='Changed'&&['Reassigned','Handover','Unassigned','Newly Assigned'].includes(row.result)||row.result===filter);
  return <section className="an-panel an-orders"><header><h2>Incident-Related Orders</h2><div className="an-order-tools"><span>{rows.length} of {view.rows.length} related orders{view.snapshot.assignmentTotals?` · ${view.assigned.base} plan orders`:''}</span><label>Show <select value={filter} onChange={event=>setFilter(event.target.value as Filter)}>{(['All','Changed','Handover','Unassigned','Frozen'] as const).map(value=><option key={value}>{value}</option>)}</select></label></div></header><div className="an-table-wrap"><table><thead><tr><th>Order</th><th>Base Assignment</th><th>Recovery Assignment</th><th>ETA Change</th><th>Result</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td title={row.id}>{row.code}</td><td title={row.baseVehicle??undefined}>{vehicle(row.baseVehicle)}</td><td title={row.candidateVehicle??undefined}>{vehicle(row.candidateVehicle)}</td><td className={row.etaDeltaSeconds===null?'':row.etaDeltaSeconds>0?'late':row.etaDeltaSeconds<0?'early':''}>{eta(row.etaDeltaSeconds)}</td><td><span className={`an-result ${row.result.toLowerCase().replace(' ','-')}`}>{row.result}</span></td></tr>)}</tbody></table>{rows.length===0&&<p className="an-table-empty">No orders match this view.</p>}</div></section>;
}

function EvidencePanel({view,attempts}:{view:ReturnType<typeof buildAnalytics>;attempts:AttemptOption[]}){
  const {snapshot}=view;
  const entries=[['Incident Type',snapshot.incident.type,AlertTriangle],['Recovery Attempt',`#${snapshot.attempt.number}`,Route],['Scope',snapshot.attempt.scope?readable(snapshot.attempt.scope):'—',Users],['Solver Result',snapshot.attempt.solverStatus?readable(snapshot.attempt.solverStatus):'—',CheckCircle2],['Validation',snapshot.attempt.validationStatus?readable(snapshot.attempt.validationStatus):'Not run',ShieldCheck],['Decision',snapshot.attempt.decision??(snapshot.candidatePlan?'Pending dispatcher review':'No candidate'),FileText],['Candidate Version',snapshot.attempt.candidateVersion??'—',Package]] as const;
  return <section className="an-panel an-evidence"><header><h2>Decision &amp; Execution Evidence</h2><a href={`/incidents?${new URLSearchParams({source:'api',business_date:snapshot.businessDate,incident_id:snapshot.incident.id,attempt_id:snapshot.attempt.id})}`}>Open Incident ↗</a></header><div className="an-evidence-grid">{entries.map(([label,value,Icon])=><div key={label}><Icon/><span>{label}</span><strong>{value}</strong></div>)}</div>{attempts.length>1&&<details className="an-history"><summary>Attempt history · {attempts.length} attempts</summary>{attempts.map(attempt=><p key={attempt.id}>#{attempt.number} · {readable(attempt.status)}</p>)}</details>}</section>;
}

function AssumptionsPanel({view}:{view:ReturnType<typeof buildAnalytics>}){
  const {snapshot}=view;
  return <section className="an-panel an-assumptions"><header><h2>Cost Assumptions</h2></header><dl><div><dt><Coins/>Mileage rate</dt><dd>{snapshot.ratePerKm===null?'Not configured':`SGD ${snapshot.ratePerKm.toFixed(2)} / km`}</dd></div><div><dt><Route/>Distance source</dt><dd>{snapshot.distanceSource}</dd></div><div><dt><FileText/>Cost model</dt><dd>{snapshot.ratePerKm===null?'Not calculated':'Mileage only'}</dd></div><div><dt><Info/>Data source</dt><dd>Test database snapshot · {snapshot.businessDate}</dd></div></dl><p><Info/>No comparable remaining distance or actual cost data is available.</p></section>;
}

export default function AnalyticsBoard(){
  const router=useRouter(),params=useSearchParams();
  const date=params.get('source')==='api'?DEMO_ANALYTICS_DATE:params.get('business_date')??DEMO_ANALYTICS_DATE;
  const incidentId=params.get('incident_id'),attemptId=params.get('attempt_id');
  useEffect(()=>{
    if(!params.has('source'))return;
    const next=new URLSearchParams(params.toString());
    if(next.get('source')==='api'){next.delete('business_date');next.delete('incident_id');next.delete('attempt_id');}
    next.delete('source');
    router.replace(`/analytics${next.toString()?`?${next}`:''}`,{scroll:false});
  },[params,router]);
  const available=demoAnalyticsSnapshots.filter(item=>item.businessDate===date);
  const incidents:Option[]=[...new Map(available.map(item=>[item.incident.id,{id:item.incident.id,code:item.incident.code}])).values()];
  const selectedIncident=incidents.find(item=>item.id===incidentId)??incidents[0];
  const choices=available.filter(item=>item.incident.id===selectedIncident?.id).sort((a,b)=>b.attempt.number-a.attempt.number);
  const attempts:AttemptOption[]=choices.map(item=>({id:item.attempt.id,number:item.attempt.number,status:item.attempt.status}));
  const snapshot=choices.find(item=>item.attempt.id===attemptId)??choices[0]??null;
  const data={incidents,attempts,snapshot};
  const update=(change:{date?:string;incidentId?:string|null;attemptId?:string|null})=>{
    const next=new URLSearchParams(params.toString());
    next.delete('source');
    if(change.date){next.set('business_date',change.date);next.delete('incident_id');next.delete('attempt_id');}
    if(change.incidentId!==undefined){if(change.incidentId)next.set('incident_id',change.incidentId);else next.delete('incident_id');next.delete('attempt_id');}
    if(change.attemptId!==undefined){if(change.attemptId)next.set('attempt_id',change.attemptId);else next.delete('attempt_id');}
    router.replace(`/analytics?${next}`,{scroll:false});
  };
  const view=snapshot?buildAnalytics(snapshot):null;
  const chartKey=view?`${date}:${view.snapshot.incident.id}:${view.snapshot.attempt.id}`:'';
  return <div className="vf-page an-page">
    <header className="vf-page-header an-header"><div><span className="vf-eyebrow">FLEET / ANALYTICS</span><h1>Analytics</h1><p>Planning and recovery impact for the current operating day.</p></div></header>
    <div className="vf-toolbar an-toolbar"><label className="vf-date"><span>Business Date</span><input type="date" value={date} aria-label="Business Date" onChange={event=>event.target.value&&update({date:event.target.value})}/></label></div>
    {data.incidents.length>0&&<div className="an-context"><label>Incident <select value={data.snapshot?.incident.id??data.incidents[0].id} onChange={event=>update({incidentId:event.target.value})}>{data.incidents.map(item=><option key={item.id} value={item.id}>{item.code}</option>)}</select></label><label>Recovery Attempt <select value={data.snapshot?.attempt.id??''} onChange={event=>update({attemptId:event.target.value})}>{data.attempts.length?data.attempts.map(item=><option value={item.id} key={item.id}>#{item.number} · {item.status}</option>):<option value="">No attempts</option>}</select></label><span>Base Plan <b>{data.snapshot?.basePlan??'—'}</b> → Candidate <b>{data.snapshot?.candidatePlan??'—'}</b></span><span className="an-context-status">{data.snapshot?.attempt.decision??(data.snapshot?.candidatePlan?'Pending Review':'No Candidate')}</span></div>}
    {!view?<div className="an-state"><h2>No analytics snapshot for this business date</h2><p>Choose 2026/09/27 to view the test database snapshot.</p></div>:<>
      {!view.snapshot.candidatePlan&&<div className="an-notice"><Info/><span>This attempt produced no Candidate. Recovery metrics and charts remain unavailable.</span></div>}
      <section className="an-kpis" aria-label="Recovery metrics"><MetricCard icon={Package} label="Recovered Orders" value={view.recovered===null?'—':`${view.recovered} / ${view.affected}`} detail="Affected unfinished orders with a feasible plan · not delivered" reason={!view.snapshot.candidatePlan?'No Candidate plan':null}/><MetricCard icon={ArrowLeftRight} label="Reassigned Orders" value={view.reassigned===null?'—':String(view.reassigned)} detail="Assigned orders moved to another vehicle" reason={!view.snapshot.candidatePlan?'No Candidate plan':null}/><MetricCard icon={Route} label="Remaining Distance Change" value={view.distanceChangeKm===null?'—':`${signed(view.distanceChangeKm)} km`} detail="Candidate minus Base · comparable remaining route" reason={view.distanceReason}/><MetricCard icon={Coins} label="Estimated Mileage Cost Change" value={view.costChange===null?'—':`${view.costChange>0?'+':''}${price(view.costChange)}`} detail="Distance change × mileage assumption" reason={view.costReason}/></section>
      <div className="an-main-grid" key={chartKey}><ComparisonPanel view={view}/><ImpactPanel view={view}/></div>
      <OrdersPanel view={view}/>
      <div className="an-bottom-grid"><EvidencePanel view={view} attempts={data.attempts}/><AssumptionsPanel view={view}/></div>
    </>}
  </div>;
}
