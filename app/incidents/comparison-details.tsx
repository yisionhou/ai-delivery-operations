"use client";
import {ArrowRight,ArrowUpRight,Check,Clock3,GitCompareArrows,HandCoins,Package,Route,ShieldCheck,Truck,Info} from 'lucide-react';
import type {ReactNode} from 'react';
import FocusedCardDeck from './focused-card-deck';
import type {AffectedOrder,Comparison,RemainingMetric} from './incident-types';

export function RemainingTravel({label,metric}:{label:string;metric:RemainingMetric}){
  return <div className="if-metric"><b>{label}</b>{metric.comparable&&metric.base!==null&&metric.candidate!==null?<><span>{metric.base} → {metric.candidate}{metric.delta&&` (${metric.delta})`}</span><small>{metric.baseline}</small></>:<><span className="if-unavailable">Unavailable</span><small>{metric.reason??'Comparable remaining-travel data was not supplied.'}</small></>}</div>;
}
type ReviewCard={id:string;kind:string;title:string;icon:ReactNode;tone?:string;content:ReactNode;footer:ReactNode;orderId?:string};

function ReviewCardView({card,onOrder}:{card:ReviewCard;onOrder:(id:string)=>void}){
  return <article className={`if-review-card ${card.tone??''}`} data-card-id={card.id}>
    <div className="if-review-card-top"><span>{card.icon}</span><small>{card.kind==='ORDER REASSIGNMENT'?'ORDER':'REVIEW'}</small></div>
    <span className="if-review-card-kind">{card.kind}</span>
    <h3>{card.orderId?<button onClick={()=>onOrder(card.orderId!)} aria-label={`Inspect ${card.title}`}>{card.title}</button>:card.title}</h3>
    <div className="if-review-card-body">{card.content}</div><div className="if-review-card-footer">{card.footer}</div>
  </article>;
}
function ReviewGroup({title,description,cards,onOrder,focused=false}:{title:string;description:string;cards:ReviewCard[];onOrder:(id:string)=>void;focused?:boolean}){
  if(focused)return <FocusedCardDeck title={title} description={description} items={cards.map(card=>({id:card.id,label:card.title,content:<ReviewCardView card={card} onOrder={onOrder}/>}))}/>;
  return <section className="if-review-group" aria-label={title}><div className="if-review-toolbar"><div><h3>{title}</h3><p>{description}</p></div></div><div className="if-static-review-grid">{cards.map(card=><ReviewCardView key={card.id} card={card} onOrder={onOrder}/>)}</div></section>;
}

export default function ComparisonDetails({comparison:c,orders,cause,onOrder}:{comparison:Comparison;orders:AffectedOrder[];cause:string;onOrder:(id:string)=>void}){
  const eligible=c.approvalEligible&&c.baseIsCurrent&&c.candidateStatus==='READY';
  const applied=c.candidateStatus==='APPLIED';
  const orderAction=(id:string)=><button className="if-card-map-link" onClick={()=>onOrder(id)}>Locate {id}<ArrowUpRight/></button>;
  // Cards format the supplied comparison. No raw plans, ETA calculations, or risk inference.
  const cards:ReviewCard[]=[{
    id:'summary',kind:'RECOVERY AT A GLANCE',title:applied?'Recovery applied':'Recovery change summary',icon:<GitCompareArrows/>,tone:'gold',
    content:<><div className="if-review-stats"><span><b>{c.disturbanceSummary.reassignedOrders}</b>orders reassigned</span><span><b>{c.disturbanceSummary.affectedVehicles}</b>vehicles involved</span><span><b>{c.disturbanceSummary.routeTasksChanged}</b>route tasks changed</span><span><b>{c.comparable?'Yes':'No'}</b>comparable</span></div><p className="if-card-lead">{c.disturbanceSummary.etaSummary}</p><div className="if-preserved"><ShieldCheck/><span>{c.disturbanceSummary.protectedWork}</span></div></>,
    footer:<><span className={`if-review-chip ${applied?'safe':''}`}>{applied?<Check/>:eligible?<ShieldCheck/>:<Info/>}{applied?'Applied':eligible?'Ready for your review':'Approval unavailable'}</span>{!eligible&&!applied&&<p>{c.staleReason??'This candidate is not eligible for approval.'}</p>}</>,
  },...c.assignmentChanges.map(change=>{
    const eta=c.etaChanges.find(item=>item.orderId===change.orderId);
    return {id:`assignment-${change.orderId}`,kind:'ORDER REASSIGNMENT',title:change.orderId,orderId:change.orderId,icon:<Package/>,content:<><p className="if-card-location">{orders.find(order=>order.id===change.orderId)?.location??'Location unavailable'}</p><div className="if-vehicle-transfer"><span><small>Base vehicle</small><b>{change.baseVehicle??'Unassigned'}</b></span><ArrowRight/><span><small>Candidate vehicle</small><b>{change.candidateVehicle??'Unassigned'}</b></span></div><div className="if-order-eta-pair"><span><small>Base ETA</small>{eta?.oldEta??'Unavailable'}</span><ArrowRight/><span><small>Candidate ETA</small>{eta?.newEta??'Unavailable'}</span></div><div className="if-card-eta"><span>ETA impact</span><b>{eta?.unavailableReason?'Unavailable':eta?.delta??'Unavailable'}</b></div>{eta?.unavailableReason&&<p>{eta.unavailableReason}</p>}{change.reason!==cause&&<small>{change.reason}</small>}<span className="if-review-chip">{change.change}</span>{applied&&<span className="if-applied-confirmation"><Check/>Applied</span>}</>,footer:orderAction(change.orderId)};
  }),...c.stopChanges.map((change,index)=>({
    id:`task-${index}`,kind:change.action==='Handover'?'ORDER HANDOVER':'ROUTE TASK UPDATE',title:change.action==='Handover'?`${change.change==='Added'?'Handover to':change.change==='Removed'?'Handover removed from':'Handover reordered for'} ${change.vehicle}`:`${change.change==='Removed'?'Removed from':change.change==='Added'?'Added to':'Reordered for'} ${change.vehicle}`,
    icon:change.action==='Handover'?<HandCoins/>:<Route/>,tone:change.change==='Removed'?'coral':undefined,
    content:<><div className="if-task-hero"><b>{change.orders.length}</b><span>{change.action==='Handover'?'orders to transfer':change.action==='Delivery'?'delivery tasks':'pickup tasks'}</span></div><p className="if-card-lead">{change.location}</p><div className="if-order-pills">{change.orders.map(id=><button key={id} onClick={()=>onOrder(id)}>{id}<ArrowUpRight/></button>)}</div><span className="if-review-chip">{change.change} · {change.action}</span></>,
    footer:<p className="if-task-explanation">{change.reason}</p>,
  })),{
    id:'eta',kind:'CUSTOMER IMPACT',title:'Delivery time changes',icon:<Clock3/>,tone:'coral',
    content:<div className="if-eta-card-rows">{c.etaChanges.map(eta=><div key={eta.orderId}><button onClick={()=>onOrder(eta.orderId)}>{eta.orderId}<ArrowUpRight/></button><b>{eta.unavailableReason?'Unavailable':eta.delta??'Unavailable'}</b><small>{eta.unavailableReason??`${eta.oldEta??'Unavailable'} → ${eta.newEta??'Unavailable'}`}</small></div>)}</div>,
    footer:<details><summary>ETA baseline</summary>{c.etaChanges.map(eta=><p key={eta.orderId}>{eta.orderId} · {eta.baseline}</p>)}</details>,
  },{
    id:'travel',kind:'REMAINING TRAVEL',title:'Distance & duration',icon:<Truck/>,
    content:<><RemainingTravel label="Distance" metric={c.remainingMetrics.distance}/><RemainingTravel label="Duration" metric={c.remainingMetrics.duration}/></>,
    footer:<details><summary>Missing metrics · {c.missingMetrics.length}</summary>{c.missingMetrics.length?c.missingMetrics.map(metric=><p key={metric.metric}><b>{metric.metric}</b> · {metric.reason}</p>):<p>No missing metrics reported.</p>}</details>,
  },{
    id:'context',kind:'PLAN CONTEXT',title:'Work that stays protected',icon:<ShieldCheck/>,
    content:<><div className="if-preserved"><ShieldCheck/><span>{c.disturbanceSummary.protectedWork}</span></div><div className="if-task-hero"><b>{c.disturbanceSummary.routeTasksChanged}</b><span>route tasks changed</span></div><p className="if-card-lead">{c.disturbanceSummary.routeSummary}</p></>,
    footer:<details><summary>Assignment coverage</summary>{c.unassignedChanges.length?c.unassignedChanges.map(change=><p key={change.orderId}>{change.orderId} · {change.from==='UNASSIGNED'?'Previously unassigned':'Previously assigned'} → {change.to==='UNASSIGNED'?'Now unassigned':'Now assigned'}. {change.reason}</p>):<p>No orders moved between assigned and unassigned states.</p>}</details>,
  }];
  return <div className="if-comparison-details">
    <div className="if-comparison-context"><div><span className="if-comparison-kicker">BASE PLAN → RECOVERY CANDIDATE</span><p>{c.basePlanId}<ArrowRight/><b>{c.candidatePlanId}</b></p></div><span className="if-review-chip">{c.comparable?'Comparable':'Comparison unavailable'}</span><small>{c.businessDate} · {c.comparisonTime}</small></div>
    <p className="if-review-cause"><Info/><span>Incident cause <b>{cause}</b></span></p>
    <ReviewGroup key={`${c.candidatePlanId}-overview`} title="Change overview" description="The scope of this recovery, with completed work protected." cards={cards.filter(card=>['summary','context'].includes(card.id))} onOrder={onOrder}/>
    <ReviewGroup key={`${c.candidatePlanId}-orders`} focused title="Order reassignments" description="Review each reassignment. Inspect the focused order on the map." cards={cards.filter(card=>card.id.startsWith('assignment-'))} onOrder={onOrder}/>
    <ReviewGroup key={`${c.candidatePlanId}-tasks`} focused title="Route task changes" description="Deliveries and handovers, grouped by vehicle and change type." cards={cards.filter(card=>card.id.startsWith('task-'))} onOrder={onOrder}/>
    <ReviewGroup key={`${c.candidatePlanId}-impact`} title="Timing & operational impact" description="Delivery-time changes and the metrics available for this comparison." cards={cards.filter(card=>['eta','travel'].includes(card.id))} onOrder={onOrder}/>
    <div className="if-review-footnote"><ShieldCheck/><span>Completed work stays protected. {applied?'Recovery applied after dispatcher approval.':'Dispatch changes only after approval.'}</span></div>
  </div>;
}
