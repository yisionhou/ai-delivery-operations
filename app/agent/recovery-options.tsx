'use client';
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowRight, Check, ClipboardList, Clock3, GitBranch, Package, Phone, RefreshCw, Route, SlidersHorizontal, TriangleAlert, UserRound, X } from 'lucide-react';
import PanelSurface from './panel-surface';
import {CandidateReviewWorkspace} from './selected-candidate-review';
import {taperedBranch} from './tapered-branch';
import { briefingDemo } from './briefing-demo';
import {incidentPageHref} from '../incidents/incident-navigation';
import type { RecoveryCandidate, RecoveryOptionsData } from './recovery-types';
import type { RecoveryController } from './use-recovery-workspace';

const signed = (value: number|null, unit: string) => value===null?'Unavailable':`${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value)} ${unit}`;
const endpointY = (index:number,count:number) => count===1?50:count===2?28+index*44:17+index*33;

function CandidateMetrics({candidate, detail=false}:{candidate:RecoveryCandidate;detail?:boolean}){
  return <dl className={detail?'pr-detail-metrics':'pr-metrics'}>
    <div><GitBranch aria-hidden="true"/><dd>{candidate.reassignedOrdersCount}</dd><dt>{detail?'Reassigned':'Reassigned orders'}</dt></div>
    <div><Clock3 aria-hidden="true"/><dd>{signed(candidate.completionImpactMinutes,'min')}</dd><dt>Completion impact</dt></div>
    <div><Route aria-hidden="true"/><dd>{signed(candidate.distanceImpactKm,'km')}</dd><dt>Distance impact</dt></div>
    {detail&&<div><Check aria-hidden="true"/><dd>{candidate.successProbability===undefined?'—':`${Math.round(candidate.successProbability*100)}%`}</dd><dt>Feasibility estimate</dt></div>}
  </dl>;
}

function RouteImpactMap({candidate,source,incidentId}:{candidate:RecoveryCandidate;source:'demo'|'live';incidentId:string}){
  if(source==='live')return <figure className="pr-route-map"><figcaption>Route impact <span>Persisted plan comparison</span></figcaption>
    <p>Route changes are based on saved Plan and Stop snapshots. View the Incident map for verified road geometry and pickup, handover and delivery nodes.</p>
    <a className="pr-pill" href={incidentPageHref(candidate.reviewSnapshot?.comparison.businessDate??'',incidentId)}>View Incident route map <ArrowRight/></a>
  </figure>;
  const route=candidate.routeImpact;
  const reassigned=new Set(candidate.orderReassignments.filter(o=>o.toResource!==o.fromResource).map(o=>o.orderId));
  const points=(ps:{x:number;y:number}[])=>ps.map(p=>`${p.x},${p.y}`).join(' ');
  return <figure className="pr-route-map">
    <figcaption>Route impact <span>Demo schematic</span></figcaption>
    <svg viewBox="0 0 100 104" role="img" aria-label={`Route impact for Candidate ${candidate.label}: ${[...reassigned].join(', ')} reassigned; dashed original route and gold recovery routes.`}>
      <path className="pr-map-land" d="M3 5 88 4 98 29 90 51 98 74 77 99 41 95 25 79 3 73Z"/>
      <g className="pr-map-streets" fill="none"><path d="M7 19 35 27 67 9M6 39 41 45 96 18M4 67 24 57 62 62 91 49M18 89 49 77 90 85M19 8 27 36 19 70M45 4 49 35 62 62 64 95M74 12 71 43 82 76"/></g>
      <polyline className="pr-map-original" points={points(route.originalRoute)}/>
      {route.recoveryRoutes.map(r=><g key={r.resource.id}>
        <polyline className="pr-map-recovery" points={points([r.resource,...r.stops.map(id=>route.orders.find(o=>o.id===id)!).filter(Boolean)])}/>
        <circle cx={r.resource.x} cy={r.resource.y} r="4" className="pr-map-vehicle"/>
        <text x={r.resource.x} y={r.resource.y+9} textAnchor="middle">{r.resource.id}</text>
      </g>)}
      {route.orders.map(o=><g key={o.id}>
        <circle cx={o.x} cy={o.y} r="4" className="pr-map-affected"/>
        <circle cx={o.x} cy={o.y} r="1.7" fill={reassigned.has(o.id)?'#d8bd86':'#c2c7c3'}/>
        <text x={o.x+4} y={o.y-5}>{o.id}</text>
      </g>)}
      <text x="7" y="53" className="pr-map-origin">V03</text>
    </svg>
    <ul className="pr-map-legend"><li><i className="original"/>Original route</li><li><i className="recovery"/>Recovery route</li><li><i className="affected"/>Affected order</li><li><i className="resource"/>Reassigned resource</li><li><i className="unchanged"/>Unchanged assignment</li></ul>
    <small>Illustrative positions · not live navigation</small>
  </figure>;
}

function BranchVisual({controller:c}:{controller:RecoveryController}){
  const candidates=c.loading?[]:c.result?.candidates??[];
  const ready=c.scene==='options'&&!c.loading&&!c.error;
  const noOptions=ready&&candidates.length===0;
  const visual=useRef<HTMLDivElement>(null);
  const materialId=useId().replace(/:/g,'');
  const [geometry,setGeometry]=useState({width:800,height:344,edge:582.88});
  useLayoutEffect(()=>{
    const element=visual.current;
    if(!element)return;
    const measure=()=>{
      const node=element.querySelector<HTMLElement>('.pr-branch-node');
      // Use local layout coordinates, unaffected by the scene/Hero flight or node arrival.
      const edge=node?node.offsetLeft+new DOMMatrixReadOnly(getComputedStyle(node).transform).m41:element.clientWidth*.7286;
      const next={width:element.clientWidth,height:element.clientHeight,edge};
      if(next.width&&next.height)setGeometry(old=>old.width===next.width&&old.height===next.height&&old.edge===next.edge?old:next);
    };
    measure();
    const observer=new ResizeObserver(measure);
    observer.observe(element);
    element.querySelectorAll('.pr-branch-node').forEach(node=>observer.observe(node));
    return ()=>observer.disconnect();
  },[ready,candidates.length]);
  const {width:w,height:h,edge}=geometry;
  const priority=c.selectedCandidateId??c.highlight;
  const dimmed=(id:string)=>!!(priority||c.highlight)&&id!==priority&&id!==c.highlight;
  return <div ref={visual} className="pr-branch-visual" data-highlight={c.highlight??''} data-ready={ready}>
    <svg className="pr-branches" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <filter id={`${materialId}-inner`} filterUnits="userSpaceOnUse" x="0" y="-24" width={w} height={h+48}><feGaussianBlur stdDeviation="2"/></filter>
        <filter id={`${materialId}-halo`} filterUnits="userSpaceOnUse" x="0" y="-24" width={w} height={h+48}><feGaussianBlur stdDeviation="5"/></filter>
        <radialGradient id={`${materialId}-source`}><stop stopColor="#FFF0C2" stopOpacity=".55"/><stop offset=".3" stopColor="#F1D99A" stopOpacity=".18"/><stop offset="1" stopColor="#E8C97A" stopOpacity="0"/></radialGradient>
        <clipPath id={`${materialId}-edge`}><rect x="0" y="-24" width={edge} height={h+48}/></clipPath>
      </defs>
      <path className="pr-current-path" d={`M${w*.08} ${h*.52} H${w*.23}`}/>
      <path className="pr-incident-path" d={`M${w*.23} ${h*.52} C${w*.32} ${h*.65} ${w*.34} ${h*.46} ${w*.44} ${h*.50}`}/>
      {ready&&candidates.length>0&&<g className="pr-branch-source">
        <ellipse cx={w*.575} cy={h*.5} rx="20" ry="13" fill={`url(#${materialId}-source)`}/>
      </g>}
      {ready&&candidates.map((candidate,i)=>{
        const y=h*endpointY(i,candidates.length)/100;
        const branch=taperedBranch({x:w*.57,y:h*.5},{x:w*.592,y:h*.5},
          {x:w*(i===2?.616:.63),y:h*.5},{x:edge-w*(i===0?.055:.075),y},{x:edge,y});
        return <svg key={candidate.id} className="pr-candidate-path"
          x={w*.57-24} y="-24" width={edge-w*.57+48} height={h+48}
          viewBox={`${w*.57-24} -24 ${edge-w*.57+48} ${h+48}`}
          data-candidate-id={candidate.id}
          data-origin-width="9" data-tip-width="3"
          data-recommended={candidate.id===c.result?.recommendedCandidateId}
          data-selected={candidate.id===c.selectedCandidateId}
          data-active={candidate.id===c.highlight}
          data-dimmed={dimmed(candidate.id)}
          style={{'--branch-delay':`${i*140}ms`} as CSSProperties}>
          <g clipPath={`url(#${materialId}-edge)`}>
            <path className="pr-branch-halo" d={branch.halo} filter={`url(#${materialId}-halo)`}/>
            <path className="pr-branch-glow" d={branch.glow} filter={`url(#${materialId}-inner)`}/>
            <path className="pr-branch-core" d={branch.core}/>
            <path className="pr-branch-guide" d={branch.centerline} fill="none" stroke="none"/>
          </g>
        </svg>;
      })}
      {noOptions&&<path className="pr-inactive-path" d={`M${w*.57} ${h*.5} H${w*.77}`}/>}
    </svg>
    <div className="pr-plan-node"><span className="pr-node-disc"><ClipboardList/><span>Current<br/>Plan</span></span><small>{c.result?.currentPlanId??(c.demo?briefingDemo.plan:'—')}</small></div>
    <div className="pr-incident-node"><span className="pr-node-disc"><TriangleAlert/></span><strong>{c.result?.resourceId??(c.demo?briefingDemo.incident.vehicle:'—')}</strong><small>Incident</small></div>
    <div className="pr-hero-destination" aria-hidden="true"/>
    <span className="pr-core-label">PENROSE CORE</span>
    <div className="pr-candidate-nodes">
      {ready&&candidates.map((candidate,i)=><button key={candidate.id} className="pr-branch-node"
        data-recommended={candidate.id===c.result?.recommendedCandidateId}
        data-selected={candidate.id===c.selectedCandidateId}
        data-active={candidate.id===c.highlight}
        data-dimmed={dimmed(candidate.id)}
        style={{top:`${endpointY(i,candidates.length)}%`,'--branch-delay':`${i*140+260}ms`} as CSSProperties}
        aria-label={`View Candidate ${candidate.label}: ${candidate.title}`}
        onMouseEnter={()=>c.setHighlight(candidate.id)} onMouseLeave={()=>c.setHighlight(c.detailId)}
        onFocus={()=>c.setHighlight(candidate.id)} onBlur={()=>c.setHighlight(c.detailId)}
        onClick={()=>c.openDetail(candidate.id)}>
        <span className="pr-node-disc">{candidate.label}</span>
        <span>{candidate.title}{candidate.id===c.result?.recommendedCandidateId&&<em>Recommended</em>}</span>
      </button>)}
      {noOptions&&<div className="pr-no-option"><span className="pr-node-disc"><X/></span><span>No viable<br/>option</span></div>}
    </div>
  </div>;
}

function ManualIntervention({data,controller:c}:{data:RecoveryOptionsData;controller:RecoveryController}){
  return <div className="pr-manual">
    <p className="pr-eyebrow"><UserRound/>MANUAL INTERVENTION REQUIRED</p>
    <h3>{c.manualReview?'Dispatcher review checklist':'Next steps for dispatcher'}</h3>
    <p>No automated recovery plan is feasible under the current constraints. Human judgment is required.</p>
    {c.manualReview?<div className="pr-manual-checklist">
      <p className="pr-local-note">{data.source==='demo'?'Local demo checklist · no changes are sent':'Manual review checklist · no automatic assignment is made'}</p>
      <h4>Affected orders</h4>
      {data.affectedOrderIds.map(id=><label key={id}><input type="checkbox"/>Reviewed {id} and its delivery window</label>)}
      <label><input type="checkbox"/>Reviewed resource capacity and availability</label>
      <label><input type="checkbox"/>Identified a dispatcher to coordinate next steps</label>
      <p>Contacting merchants, changing constraints and assigning resources are not connected in this preview.</p>
      <button className="pr-pill" onClick={()=>c.setManualReview(false)}>Back to next steps</button>
    </div>:<ol className="pr-manual-steps">
      <li><ClipboardList/><span>Review affected orders<small>Check order details and impact</small></span></li>
      <li><Phone/><span>Contact merchant / rider<small>External action · not connected</small></span></li>
      <li><SlidersHorizontal/><span>Review constraints<small>Review delivery windows and capacity</small></span></li>
      <li><RefreshCw/><span>Retry planning<small>{data.source==='demo'?'Re-run the selected demo outcome':'Request another formal Recovery attempt'}</small></span></li>
      <li><UserRound/><span>Assign manually<small>Demo placeholder · no assignment sent</small></span></li>
    </ol>}
    <dl className="pr-manual-context"><div><dt>Incident</dt><dd>{data.incidentId} · {data.resourceId}</dd></div><div><dt>Affected orders</dt><dd>{data.affectedOrdersCount}</dd></div><div><dt>Blocked reason</dt><dd>{data.blockedReason??'Current constraints cannot be met.'}</dd></div><div><dt>Status</dt><dd>Requires manual review</dd></div></dl>
    {!c.manualReview&&<button className="pr-pill pr-primary" onClick={()=>c.setManualReview(true)}>Start Manual Intervention <ArrowRight/></button>}
    <button className="pr-pill" onClick={()=>c.generate(c.demoCount)}><RefreshCw/>Retry Planning</button>
  </div>;
}

function CandidateDetail({candidate,recommended,controller:c,close}:{candidate:RecoveryCandidate;recommended:boolean;controller:RecoveryController;close:()=>void}){
  const panel=useRef<HTMLDivElement>(null);
  useEffect(()=>{panel.current?.focus({preventScroll:true});},[candidate.id,c.review]);
  return <div ref={panel} className="pr-detail" role="dialog" aria-modal="false" aria-labelledby="pr-detail-title" tabIndex={-1}>
    <button className="pr-close" aria-label="Close candidate details" onClick={close}><X/></button>
    <header className="pr-detail-header"><span className="pr-letter">{candidate.label}</span><div><h3 id="pr-detail-title">Candidate {candidate.label} {recommended&&<span className="pr-badge">Recommended</span>}</h3><p>{candidate.title}</p></div></header>
    <>
      <p className="pr-detail-description">{candidate.description}</p>
      <CandidateMetrics candidate={candidate} detail/>
      <div className="pr-detail-scroll" tabIndex={0} aria-label="Candidate analysis details">
      <div className="pr-detail-body">
        <section className="pr-reassignments"><h4>Order reassignment</h4>{candidate.orderReassignments.map(order=><div key={order.orderId}>
          <Package/><div><strong>{order.orderId}</strong><p>{order.fromResource===order.toResource?'Unchanged':`Reassign to ${order.toResource}`}</p>
          <small>{order.fromResource===order.toResource?'Keep original assignment':order.arrival?`Planned delivery arrival ${order.arrival}`:'Delivery ETA unavailable'}</small></div>
          <span>{order.fromResource===order.toResource?'—':order.impact}</span>
        </div>)}</section>
        <RouteImpactMap candidate={candidate} source={c.result?.source??'demo'} incidentId={c.result?.incidentId??''}/>
      </div>
      </div>
      <section className="pr-reason"><h4>{candidate.explanationSource&&candidate.explanationSource!=='agent'?`${candidate.explanationSource.replaceAll('_',' ')} explanation · verified facts`:recommended?'Why Penrose recommends this':'Why consider this option'}</h4><p>{candidate.recommendationReason}</p></section>

      <div className="pr-detail-actions"><button className="pr-pill" onClick={close}>Compare options</button><button className="pr-pill pr-primary" onClick={()=>c.select(candidate)}>Select this option <ArrowRight/></button></div>
    </>
  </div>;
}

export default function RecoveryOptions({controller:c,demo=true}:{controller:RecoveryController;demo?:boolean}){
  const workspace=useRef<HTMLElement>(null);
  const heading=useRef<HTMLHeadingElement>(null);
  const comparison=useRef<HTMLDivElement>(null);
  const opener=useRef<HTMLElement | null>(null);
  const detail=c.result?.candidates.find(candidate=>candidate.id===c.detailId);
  const ready=c.scene==='options';
  const generating=c.loading||c.scene==='transitioning-in'||(!c.result&&!c.error);
  const candidates=c.result?.candidates??[];
  useEffect(()=>{if(ready)heading.current?.focus({preventScroll:true});},[ready]);
  useEffect(()=>{
    if(!c.detailId)return;
    opener.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
  },[c.detailId]);
  useLayoutEffect(()=>{
    const element=workspace.current,root=element?.closest<HTMLElement>('.pe-entrance');
    if(!element||!root)return;
    let frame=0;
    const measure=()=>{
      const height=element.offsetHeight+'px';
      if(root.style.getPropertyValue('--pr-content-height')!==height)root.style.setProperty('--pr-content-height',height);
    };
    const observer=new ResizeObserver(()=>{
      cancelAnimationFrame(frame);
      frame=requestAnimationFrame(measure);
    });
    observer.observe(element);measure();
    return ()=>{observer.disconnect();cancelAnimationFrame(frame);root.style.removeProperty('--pr-content-height');};
  },[]);
  const close=()=>{
    workspace.current?.closest('.pw-workspace')?.scrollTo({top:0,behavior:'instant'});
    if(c.dispatchPreviewApplied)return;
    c.closeDetail();
    // Wait for the comparison controls to become visible again.
    requestAnimationFrame(()=>{
      const preferred=comparison.current?.querySelector<HTMLButtonElement>(`[data-candidate-id="${c.detailId}"]`);
      (preferred??opener.current)?.focus({preventScroll:true});
    });
  };
  const title=generating?(demo?'Generating recovery options…':'Preparing recovery candidate…'):c.error?'Planning is temporarily unavailable':
    candidates.length===0?'0 candidate plans returned':`${candidates.length} recovery candidate${candidates.length===1?'':'s'} found`;
  return <section ref={workspace} className="pr-workspace" data-review-open={c.review} aria-label="Recovery Options Workspace" data-ui-state={c.uiState} aria-hidden={!ready} inert={!ready}
    onKeyDown={event=>{if(event.key==='Escape'&&c.detailId&&!(event.target as HTMLElement).closest('dialog')){event.preventDefault();close();}}}>
    <section className="pr-main-panel pr-panel" inert={c.review} aria-hidden={c.review} aria-labelledby="pr-title">
      <PanelSurface main/>
      <div className="pr-main-heading"><p className="pr-eyebrow"><ClipboardList/>RECOVERY OPTIONS</p>
        <h2 ref={heading} id="pr-title" tabIndex={-1}>{title}</h2>
        <p>{generating?'Analyzing resources, routes, and constraints.':c.error?'The request could not be completed. Retry planning to continue.':candidates.length?'Compare the validated candidates. The dispatcher decides whether to apply one.':'No feasible recovery plan could be generated under the current constraints. Manual intervention is required.'}</p>
      </div>
      <BranchVisual controller={c}/>
      <dl className="pr-main-metrics"><div><dd>{c.result?.affectedOrdersCount??(demo?briefingDemo.incident.affectedOrders.length:'—')}</dd><dt>Affected orders</dt></div><div><dd>{c.result?.nearbyAvailableResourcesCount??'—'}</dd><dt>Nearby available resources</dt></div><div><dd>{generating?'—':c.error?'—':candidates.length}</dd><dt>Recovery candidates</dt></div></dl>
    </section>
    <section className="pr-comparison-panel pr-panel" inert={c.review} aria-hidden={c.review} aria-label="Recovery options comparison">
      <PanelSurface/>
      <div className="pr-comparison-content" ref={comparison} hidden={!!detail}>
        {generating?<div className="pr-generating" role="status"><p className="pr-eyebrow"><GitBranch/>RECOVERY OPTIONS COMPARISON</p><h3>Evaluating recovery paths</h3><p>Checking resource availability, delivery windows and route impact.</p><div className="pr-generation-track"/><small>{demo?'Demo planning · illustrative outcomes':'Waiting for planning results'}</small></div>:
          c.error?<div className="pr-error" role="alert"><TriangleAlert/><h3>Unable to load recovery options</h3><p>{c.error}</p><button className="pr-pill" onClick={()=>c.generate(c.demoCount)}>Retry Planning <RefreshCw/></button></div>:
          c.result&&candidates.length===0?<ManualIntervention data={c.result} controller={c}/>:
          <><header className="pr-comparison-heading"><p className="pr-eyebrow"><GitBranch/>RECOVERY OPTIONS COMPARISON</p><p>Compare validated candidates against the Current Plan snapshot</p></header>
            <div className="pr-candidate-grid" style={{'--candidate-count':Math.max(1,candidates.length)} as CSSProperties}>
              {candidates.map(candidate=><button key={candidate.id} className="pr-candidate-card" data-candidate-id={candidate.id}
                data-recommended={candidate.id===c.result?.recommendedCandidateId} data-selected={candidate.id===c.selectedCandidateId}
                aria-label={`View details for Candidate ${candidate.label}: ${candidate.title}`}
                onClick={()=>c.openDetail(candidate.id)} onMouseEnter={()=>c.setHighlight(candidate.id)} onMouseLeave={()=>c.setHighlight(c.detailId)}
                onFocus={()=>c.setHighlight(candidate.id)} onBlur={()=>c.setHighlight(c.detailId)}>
                <span className="pr-candidate-top"><span className="pr-letter">{candidate.label}</span>{candidate.id===c.result?.recommendedCandidateId&&<span className="pr-badge">Recommended</span>}</span>
                <h3>{candidate.title}</h3>{candidate.id===c.selectedCandidateId&&<span className="rr-selected-label">Selected · {c.reviewState==='dispatch-ready'?'Ready to dispatch':'Review'}</span>}<p>{candidate.description}</p><CandidateMetrics candidate={candidate}/>
                <span className="pr-card-action">View details <ArrowRight/></span>
              </button>)}
            </div>
          </>}
      </div>
      {detail&&!c.review&&<CandidateDetail candidate={detail} recommended={detail.id===c.result?.recommendedCandidateId} controller={c} close={close}/>}
    </section>
    {detail&&c.review&&<CandidateReviewWorkspace key={detail.id} candidate={detail} controller={c} compare={close}/>}
    <p className="pe-sr-only" role="status">{ready?title:''}</p>
  </section>;
}
