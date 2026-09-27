'use client';
import {ArrowRight,ArrowUpRight,Package,Route,HandCoins} from 'lucide-react';
import Link from 'next/link';
import FocusedCardDeck from './focused-card-deck';
import type {CandidateComparison} from '../agent/recovery-types';

/** The moved Incident decks now present local-preview consequences.
 * Snapshot facts remain immutable; no backend APPLIED status is manufactured.
 */
export default function ChangeResultCarousels({snapshot,onOrder,live=false}:{snapshot:CandidateComparison;onOrder:(id:string)=>void;live?:boolean}){
  const c=snapshot.comparison;
  const assignments=[...c.assignmentChanges.filter(o=>o.reassigned),...c.assignmentChanges.filter(o=>!o.reassigned)];
  const tasks=[...c.stopChanges.filter(t=>t.change==='Added'),...c.stopChanges.filter(t=>t.change!=='Added')];
  return <div className="rr-results" aria-label="Post-dispatch change monitor">
    <div className="rr-result-section">
      <FocusedCardDeck resultEntry title={live?'Applied Order Reassignments':'Order Reassignment Results'} description="New reassignment results, with related affected orders in the same recovery window." items={assignments.map(change=>{
        const eta=c.etaChanges.find(item=>item.orderId===change.orderId);
        const context=snapshot.orders.find(item=>item.id===change.orderId);
        return {id:`result-${change.orderId}`,label:change.orderId,content:<article className="if-review-card" data-card-id={change.orderId}>
          <div className="if-review-card-top"><span><Package/></span><small>{change.reassigned?'NEW RESULT':'RELATED WORK'}</small></div>
          <span className="if-review-card-kind">{change.reassigned?'ORDER REASSIGNED':context?.monitorLabel??'AFFECTED ORDER MONITOR'}</span>
          <h3><button onClick={()=>onOrder(change.orderId)} aria-label={`Inspect ${change.orderId}`}>{change.orderId}</button></h3>
          <div className="if-review-card-body">
            <div className="if-vehicle-transfer"><span><small>Previous vehicle</small><b>{change.baseVehicle??'Unassigned'}</b></span><ArrowRight/><span><small>{change.reassigned?'Reassigned to':'Retained vehicle'}</small><b>{change.candidateVehicle??'Unassigned'}</b></span></div>
            <div className="if-order-eta-pair"><span><small>Previous ETA</small>{eta?.oldEta??'Unavailable'}</span><ArrowRight/><span><small>Updated ETA</small>{eta?.newEta??'Unavailable'}</span></div>
            <div className="if-card-eta"><span>ETA impact</span><b>{eta?.unavailableReason?'Unavailable':eta?.delta??'Unavailable'}</b></div>
            {eta?.unavailableReason&&<p className="if-card-lead">{eta.unavailableReason}</p>}
            <span className="if-review-chip">{change.reassigned?'REASSIGNED':'UNCHANGED · MONITOR'}</span>
            <p className="if-card-lead">{context?.monitorReason??change.reason}</p>
          </div>
          <div className="if-review-card-footer"><button className="if-card-map-link" onClick={()=>onOrder(change.orderId)}>Inspect {change.orderId}<ArrowUpRight/></button></div>
        </article>};
      })}/>
    </div>
    <div className="rr-result-section">
      <FocusedCardDeck resultEntry title={live?'Applied Route / Task Changes':'Route / Task Impact Results'} description="Monitor the changed pickup, delivery and transfer sequence for this candidate." items={tasks.map((change,index)=>({
        id:`task-result-${index}`,label:`${change.change} ${change.action} · ${change.vehicle}`,
        content:<article className={`if-review-card ${change.change==='Removed'?'coral':''}`}>
          <div className="if-review-card-top"><span>{change.action==='Handover'?<HandCoins/>:<Route/>}</span><small>TASK RESULT</small></div>
          <span className="if-review-card-kind">{change.action==='Handover'?'ORDER HANDOVER':`${change.action.toUpperCase()} CHANGE`}</span>
          <h3>{change.action==='Handover'?`Handover ${change.change==='Removed'?'removed from':'to'} ${change.vehicle}`:`${change.change==='Removed'?'Removed from':change.change==='Added'?'Added to':change.change==='Modified'?'Modified for':'Reordered for'} ${change.vehicle}`}</h3>
          <div className="if-review-card-body"><div className="if-task-hero"><b>{change.orders.length}</b><span>{change.action==='Handover'?'orders to transfer':`${change.action.toLowerCase()} tasks`}</span></div>
            <p className="if-card-lead">{change.location}</p><div className="if-order-pills">{change.orders.map(id=><button key={id} onClick={()=>onOrder(id)}>{id}<ArrowUpRight/></button>)}</div>
            <span className="if-review-chip">{change.change} · {change.action}</span>
            <p className="if-card-lead">{change.reason}</p>
            {change.action==='Handover'&&<p className="if-card-lead">Transfer already-picked-up orders. This is not a second merchant pickup.</p>}
          </div>
          <div className="if-review-card-footer"><p className="if-task-explanation">Monitor the affected sequence. Completed and frozen work remain protected.</p></div>
        </article>,
      }))}/>
    </div>
    <div className="rr-results-actions">
      <Link className="pr-pill pr-primary rr-return-operations" href="/?page=operations">Back to Operations<ArrowRight aria-hidden="true"/></Link>
    </div>
  </div>;
}
