'use client';
import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {ArrowRight,Check,ShieldCheck,X,RotateCcw,TriangleAlert} from 'lucide-react';
import Link from 'next/link';
import ChangeResultCarousels from '../recovery-review/change-result-carousels';
import type {RecoveryCandidate,RecoveryReviewState} from './recovery-types';
import type {RecoveryController} from './use-recovery-workspace';

const stages=['Selected','Review','Confirm','Dispatch / Apply'];
const signed=(value:number|null,unit:string)=>value===null?'Unavailable':`${value>0?'+':value<0?'−':''}${Math.abs(value)} ${unit}`;
export function ReviewProgressRail({state}:{state:RecoveryReviewState}){
  const index=state==='review'?1:3;
  const applied=state==='preview-applied';
  return <div className="rr-progress" data-stage={state} style={{'--review-progress':index/3} as CSSProperties}>
    <div className="rr-rail" aria-hidden="true"><span/></div>
    {!applied&&<span key={state} className={`rr-energy ${state==='dispatch-ready'?'rr-energy-confirm':''}`} aria-hidden="true"/>}
    <ol aria-label="Recovery review progress">{stages.map((stage,i)=>{
      const complete=applied||i<index;
      return <li key={stage} data-status={complete?'complete':i===index?'active':'inactive'} aria-current={i===index&&!applied?'step':undefined}>
        <span className="rr-marker">{complete?<Check/>:<i/>}</span><span>{stage}</span>
      </li>;
    })}</ol>
  </div>;
}

function ChangeOverview({candidate,controller:c,compare}:{candidate:RecoveryCandidate;controller:RecoveryController;compare:()=>void}){
  const comparison=candidate.reviewSnapshot?.comparison;
  const summary=comparison?.disturbanceSummary;
  const eligible=comparison?.approvalEligible&&comparison.baseIsCurrent&&comparison.candidateStatus==='READY';
  const ready=c.reviewState==='dispatch-ready';
  const preview=c.dispatchPreviewApplied;
  const live=c.result?.source==='live';
  const metrics=[
    [candidate.reassignedOrdersCount,'Orders reassigned'],[summary?.affectedVehicles??'Unavailable','Vehicles affected'],
    [summary?.routeTasksChanged??'Unavailable','Route tasks changed'],[signed(candidate.completionImpactMinutes,'min'),'Completion impact'],
    [signed(candidate.distanceImpactKm,'km'),'Distance impact'],[candidate.successProbability===undefined?'Unavailable':`${Math.round(candidate.successProbability*100)}%`,'Feasibility estimate'],
  ];
  return <section className="rr-overview" aria-labelledby="rr-overview-title">
    <header><div><p className="pr-eyebrow">CHANGE OVERVIEW</p><h3 id="rr-overview-title">Candidate {candidate.label} · {candidate.title}</h3></div>
      <span className="rr-overview-status">{preview?(live?'PLAN APPLIED':'LOCAL RESULT PREVIEW'):ready?'CHANGES CONFIRMED':'HUMAN REVIEW'}</span></header>
    <p className="rr-change-summary">{summary?.routeSummary??'Comparison unavailable. A historical candidate snapshot is required before confirmation.'}</p>
    <dl className="rr-impact">{metrics.map(([value,label])=><div key={label}><dd>{value}</dd><dt>{label}</dt></div>)}</dl>
    <div className="rr-protected"><ShieldCheck/><div><h4>Protected execution facts</h4>
      <p>{summary?.protectedWork??'Protected execution snapshot unavailable.'}</p>
      <span>Completed stops: <b>{summary?.completedStopsProtected??'Unavailable'}</b><i/>Unchanged tasks: <b>{summary?.routeTasksUnchanged??'Unavailable'}</b></span>
      {summary?.protectedCountsUnavailableReason&&<small>{summary.protectedCountsUnavailableReason}</small>}
    </div></div>
    {ready&&live&&!preview&&<label className="rr-decision-reason">Approval reason <textarea value={c.decisionReason} onChange={event=>c.setDecisionReason(event.target.value)} maxLength={2000} placeholder="Why is this candidate safe to apply?" /></label>}
    {c.decisionError&&<div className="rr-action-error" role="alert"><TriangleAlert aria-hidden="true"/><div><strong>Dispatch / Apply was not confirmed</strong><p>{c.decisionError}</p><small>Check the Incident and Current Plan status before retrying.</small></div></div>}
    <footer className="rr-overview-actions"><div>
      <p>{preview?(live?'The backend confirmed this Candidate as Current and resolved the Incident.':'Local demo preview only · No operational plan or backend record has changed.'):ready?(live?'Approval will atomically activate this Candidate after backend validation.':'Changes confirmed. Continue to the local dispatch preview.'):'Review the proposed impact. Selecting this candidate has not changed the current plan.'}</p>
      {!eligible&&<small>{comparison?.staleReason??'A current, eligible READY comparison is required.'}</small>}
    </div><div>
      {preview?(live?<Link className="pr-pill rr-reset-preview" href="/?page=operations">Back to Operations <ArrowRight/></Link>:<button className="pr-pill rr-reset-preview" onClick={c.resetPreview}><RotateCcw/>Reset preview &amp; review</button>):<>
        <button className="pr-pill" onClick={compare}>Compare options</button>
        <button className="pr-pill pr-primary" disabled={!eligible||c.decisionBusy} onClick={ready?()=>void c.applyDispatchPreview():c.confirmChanges}>{ready?(c.decisionBusy?'Approving...':'Dispatch / Apply'):'Confirm Changes'}<ArrowRight/></button>
      </>}
    </div></footer>
    <details className="rr-baseline"><summary>Timing &amp; comparison baseline</summary>
      <p>{summary?.etaSummary??'Historical timing comparison unavailable.'}</p>
      <p>{comparison?.remainingMetrics.distance.reason??comparison?.remainingMetrics.distance.baseline}</p>
      <p>{comparison?.remainingMetrics.duration.reason??comparison?.remainingMetrics.duration.baseline}</p>
    </details>
  </section>;
}

export function CandidateReviewWorkspace({candidate,controller:c,compare}:{candidate:RecoveryCandidate;controller:RecoveryController;compare:()=>void}){
  const heading=useRef<HTMLHeadingElement>(null);
  const dialog=useRef<HTMLDialogElement>(null);
  const [orderId,setOrderId]=useState<string>();
  const snapshot=candidate.reviewSnapshot;
  const recommended=c.result?.recommendedCandidateId===candidate.id;
  useEffect(()=>{
    heading.current?.closest('.pw-workspace')?.scrollTo({top:0,behavior:'instant'});
    heading.current?.focus({preventScroll:true});
  },[candidate.id]);
  useEffect(()=>{
    if(!c.dispatchPreviewApplied){
      heading.current?.closest('.pw-workspace')?.scrollTo({top:0,behavior:'instant'});
      return;
    }
    const frame=requestAnimationFrame(()=>heading.current?.closest('.rr-workspace')?.querySelector('.rr-results')?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}));
    return ()=>cancelAnimationFrame(frame);
  },[c.dispatchPreviewApplied]);
  const showOrder=(id:string)=>{setOrderId(id);dialog.current?.showModal();};
  const order=snapshot?.comparison.assignmentChanges.find(o=>o.orderId===orderId);
  const eta=snapshot?.comparison.etaChanges.find(o=>o.orderId===orderId);
  return <section className="rr-workspace recovery-review-theme" aria-labelledby="rr-title" data-review-state={c.reviewState}>
    <header className="rr-heading"><div className="rr-candidate-identity"><span className="pr-letter">{candidate.label}</span><div><p>Candidate {candidate.label} {recommended&&<span className="pr-badge">Recommended</span>}</p><small>{candidate.title}</small></div></div>
      <div><p className="pr-eyebrow">{c.dispatchPreviewApplied?(c.result?.source==='live'?'RECOVERY PLAN APPLIED':'RECOVERY CHANGE APPLIED — DEMO PREVIEW'):'READY FOR HUMAN REVIEW'}</p>
        <h2 id="rr-title" ref={heading} tabIndex={-1}>Candidate {candidate.label} {c.dispatchPreviewApplied?'result preview':'selected'}</h2></div>
    </header>
    <div className="rr-context-rail"><p>Candidate {candidate.label}<span>{candidate.title} · {c.result?.incidentId}{c.dispatchPreviewApplied&&c.result?.source==='demo'?' · DEMO PREVIEW':''}</span></p><ReviewProgressRail state={c.reviewState}/></div>
    <ChangeOverview candidate={candidate} controller={c} compare={compare}/>
    {c.dispatchPreviewApplied&&snapshot&&<ChangeResultCarousels key={`${candidate.id}-${c.previewRevision}`} snapshot={snapshot} onOrder={showOrder} live={c.result?.source==='live'}/>}
    <dialog ref={dialog} className="rr-order-dialog"><button className="pr-close" aria-label="Close order snapshot" onClick={()=>dialog.current?.close()}><X/></button>
      <p className="pr-eyebrow">CANDIDATE {candidate.label} · ORDER SNAPSHOT</p><h3>{orderId}</h3>
      <p>{snapshot?.orders.find(o=>o.id===orderId)?.location??'Location unavailable in candidate snapshot'}</p>
      <dl><div><dt>Previous vehicle</dt><dd>{order?.baseVehicle??'Unavailable'}</dd></div><div><dt>Preview vehicle</dt><dd>{order?.candidateVehicle??'Unavailable'}</dd></div>
        <div><dt>Previous ETA</dt><dd>{eta?.oldEta??'Unavailable'}</dd></div><div><dt>Updated ETA</dt><dd>{eta?.newEta??'Unavailable'}</dd></div></dl><p>{eta?.unavailableReason??eta?.baseline}</p>
    </dialog>
  </section>;
}
