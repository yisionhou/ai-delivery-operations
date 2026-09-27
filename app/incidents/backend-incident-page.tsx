"use client";
import {useEffect,useState} from 'react';
import {useSearchParams} from 'next/navigation';
import {ArrowLeft,AlertTriangle} from 'lucide-react';
import {StateMessage} from '../vehicles/vehicles-board';
import {loadIncidentIndex,loadIncidentIndexMap,loadIncidentReview,loadIncidentFocusMap,type IncidentIndexItem,type IncidentIndexMap,type IncidentFocusMap,type IncidentReview} from './incident-read-api';
import BackendIncidentMap from './backend-incident-map';
import BackendIncidentIndexMap from './backend-incident-index-map';
import IncidentIndexTable from './incident-index-table';
import {incidentBackLink} from './incident-navigation';
import './backend-incident.css';

const readable=(value:string|null|undefined)=>value?.replaceAll('_',' ')??'—';
const timestamp=(value:string)=>new Intl.DateTimeFormat('en-SG',{timeZone:'Asia/Singapore',dateStyle:'medium',timeStyle:'short'}).format(new Date(value));

function IncidentIndex({items,date}:{items:IncidentIndexItem[];date:string}){
  const [mapData,setMapData]=useState<IncidentIndexMap|null>(null);
  useEffect(()=>{
    if(!items.length)return;
    const controller=new AbortController();
    loadIncidentIndexMap(items,controller.signal).then(data=>{if(!controller.signal.aborted)setMapData(data);}).catch(error=>{
      if(!controller.signal.aborted)setMapData({features:[],incidents:[],warnings:[error instanceof Error?error.message:'Incident routes could not be loaded.']});
    });
    return()=>controller.abort();
  },[items]);
  return <div className="bi-index"><BackendIncidentIndexMap data={mapData} loading={Boolean(items.length)&&mapData===null} date={date}/><IncidentIndexTable items={items} date={date}/></div>;
}

function IncidentReviewView({data,date}:{data:IncidentReview;date:string}){
  const {incident,affectedOrders,attempts,selectedAttempt,comparison}=data;
  const [focusMap,setFocusMap]=useState<IncidentFocusMap|null>(null);
  useEffect(()=>{
    const controller=new AbortController();
    loadIncidentFocusMap(data,controller.signal).then(map=>{if(!controller.signal.aborted)setFocusMap(map);}).catch(error=>{
      if(!controller.signal.aborted)setFocusMap({features:[],approaches:[],nodes:[],incidentPoint:data.mapOverlay.incidentPoint,hasCandidate:data.mapOverlay.hasCandidate,warnings:[error instanceof Error?error.message:'Affected route context could not be loaded.']});
    });
    return()=>controller.abort();
  },[data]);
  return <div className="bi-review">
    <section className="vf-card bi-card"><h2>{incident.incident_code} · {readable(incident.incident_type)}</h2><dl className="vf-resource">
      <div><dt>Status</dt><dd>{readable(incident.status)}</dd></div>
      <div><dt>Detected</dt><dd>{timestamp(incident.detected_at)} · {incident.detected_by}</dd></div>
      <div><dt>Base Plan</dt><dd>{incident.base_plan_code}</dd></div>
      <div><dt>{incident.vehicle_id?'Vehicle':incident.merchant_id?'Merchant':'Subject'}</dt><dd>{incident.vehicle_id??incident.merchant_id??'—'}</dd></div>
      <div><dt>Affected / Handover</dt><dd>{incident.affected_order_count} / {incident.handover_order_count}</dd></div>
    </dl><p className="vf-handoff-note">Impact at detection: {Object.entries(incident.impact_summary).map(([kind,count])=>`${readable(kind)} ${count}`).join(' · ')||'No affected-order impact recorded.'}</p></section>

    <BackendIncidentMap map={focusMap} loading={focusMap===null}/>

    <section className="vf-card bi-card"><h2>Affected Orders · detection snapshot</h2>{affectedOrders.length?<div className="vf-stops-table"><table><thead><tr><th>Order ID</th><th>Execution</th><th>Risk</th><th>Impact</th><th>Replanning</th></tr></thead><tbody>{affectedOrders.map(order=><tr key={order.order_id}><td>{order.order_id}</td><td>{readable(order.execution_status_snapshot)}</td><td>{readable(order.risk_status_snapshot)}</td><td>{readable(order.impact_type)}{order.handover_required&&<small>Handover required</small>}</td><td>{order.was_completed?'Frozen':order.requires_replanning?'Required':'No'}</td></tr>)}</tbody></table></div>:<p className="vf-muted">No affected-order snapshots recorded.</p>}</section>

    <section className="vf-card bi-card"><h2>Recovery Attempts · {attempts.length}</h2>{attempts.length?<div className="bi-list">{attempts.map(attempt=><a key={attempt.recovery_plan_id} aria-current={attempt.recovery_plan_id===selectedAttempt?.recovery_plan_id?'true':undefined} href={`/incidents?${new URLSearchParams({source:'api',business_date:date,incident_id:incident.id,attempt_id:attempt.recovery_plan_id})}`}><strong>#{attempt.attempt_no} · {attempt.recovery_code}</strong><span>{readable(attempt.status)} · {readable(attempt.replanning_scope)} · Solver {readable(attempt.solver_status)} / Validation {readable(attempt.validation_status)}</span><small>Candidate: {attempt.candidate_plan_code??'None'}{attempt.dispatcher_decision?` · ${readable(attempt.dispatcher_decision)}`:''}</small></a>)}</div>:<p className="vf-muted">No Recovery Attempt has been created for this Incident.</p>}</section>

    {selectedAttempt&&<section className="vf-card bi-card"><h2>Attempt #{selectedAttempt.attempt_no} · {readable(selectedAttempt.status)}</h2><p className="vf-muted">{selectedAttempt.scope_description}</p>{selectedAttempt.agent_explanation&&<p className="vf-handoff-note">{selectedAttempt.agent_explanation}</p>}{!selectedAttempt.candidate_delivery_plan_id?<p className="vf-handoff-note">No Candidate Plan was created. Solver: {readable(selectedAttempt.solver_status)} · Validation: {readable(selectedAttempt.validation_status)}.</p>:comparison?<>
      <dl className="vf-resource bi-comparison"><div><dt>Base → Candidate</dt><dd>{comparison.base_plan_id} ({readable(comparison.base_plan_status)}) → {comparison.candidate_plan_id} ({readable(comparison.candidate_plan_status)})</dd></div><div><dt>Reassigned / Frozen</dt><dd>{comparison.reassigned_order_count} / {comparison.frozen_completed_order_ids.length}</dd></div><div><dt>Reviewable now</dt><dd>{comparison.reviewable?'Yes, subject to final approval checks':'No'}</dd></div><div><dt>Remaining travel</dt><dd>{comparison.remaining_metrics.reason??(comparison.remaining_metrics.candidate_distance_meters===null?'Unavailable':`${comparison.remaining_metrics.base_distance_meters??'—'} → ${comparison.remaining_metrics.candidate_distance_meters} meters`)}</dd></div></dl>
      {comparison.orders.length>0&&<div className="vf-stops-table"><table><thead><tr><th>Order ID</th><th>Base Vehicle</th><th>Candidate Vehicle</th><th>ETA Change</th></tr></thead><tbody>{comparison.orders.map(order=><tr key={order.order_id}><td>{order.order_id}</td><td>{order.base_vehicle_id??'Unassigned'}</td><td>{order.candidate_vehicle_id??'Unassigned'}</td><td>{order.eta_unavailable_reason??(order.eta_delta_seconds===null?'Unavailable':`${order.eta_delta_seconds>0?'+':''}${order.eta_delta_seconds} seconds`)}</td></tr>)}</tbody></table></div>}
      <p className="vf-handoff-note">Route-stop changes: {comparison.stop_changes.length}. Comparison time basis: {readable(comparison.comparison_time_basis)}.</p>
      <p className="vf-muted">Frozen completed orders: {comparison.frozen_completed_order_ids.length}. Their completed work is not reinterpreted as a newly driven map segment.</p>
    </>:null}</section>}
    <p className="vf-handoff-note">This Incident view is read-only. Recovery actions and dispatcher decisions are not available here.</p>
  </div>;
}

export default function BackendIncidentPage({id,date}:{id:string|null;date:string}){
  const params=useSearchParams(),attemptId=params.get('attempt_id');
  const backLink=incidentBackLink(id,date);
  const [loaded,setLoaded]=useState<{key:string;data:IncidentReview|IncidentIndexItem[]}|null>(null);
  const [failure,setFailure]=useState<{key:string;message:string}|null>(null),[revision,setRevision]=useState(0);
  const key=id?`review:${id}:${attemptId??''}`:`index:${date}`;
  useEffect(()=>{
    const controller=new AbortController();
    const request=id?loadIncidentReview(id,attemptId,controller.signal):loadIncidentIndex(date,controller.signal);
    request.then(data=>{if(!controller.signal.aborted){setLoaded({key,data});setFailure(null);}}).catch(reason=>{if(!controller.signal.aborted)setFailure({key,message:reason instanceof Error?reason.message:'Incident data could not be loaded.'});});
    return()=>controller.abort();
  },[id,date,attemptId,key,revision]);
  const data=loaded?.key===key?loaded.data:null,error=failure?.key===key?failure.message:null;
  return <div className="vf-page vf-handoff bi-page"><div className="vf-detail-top">{backLink&&<a className="vf-back" href={backLink.href}><ArrowLeft/>{backLink.label}</a>}<span className="vf-demo">BACKEND DATA · READ ONLY</span></div><header className="vf-page-header"><div><span className="vf-eyebrow">INCIDENT WORKFLOW</span><h1>Incidents</h1><p>{id?`Selected Incident · ${id}`:`Business date · ${date}`}</p></div><AlertTriangle/></header>{error?<StateMessage title="Incident context unavailable" detail={error} retry={()=>setRevision(value=>value+1)}/>:!data?<StateMessage title="Loading Incident context…"/>:Array.isArray(data)?<IncidentIndex key={key} items={data} date={date}/>:<IncidentReviewView data={data} date={date}/>}</div>;
}
