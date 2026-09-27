import {z} from 'zod';
import {loadIncidentReview} from '../incidents/incident-read-api.ts';
import type {IncidentReview} from '../incidents/incident-read-api.ts';
import {apiRead} from '../vehicles/vehicle-api.ts';
import type {AnalyticsSnapshot} from './analytics-model.ts';

const plan=z.object({version_no:z.number(),assigned_order_count:z.number(),unassigned_order_count:z.number()});
const membershipPage=z.object({items:z.array(z.object({order_id:z.string(),order_code:z.string()})),total_pages:z.number()});
const vehicle=z.object({vehicle_code:z.string()});
type Plan=z.infer<typeof plan>;
type Metadata={base:Plan|null;candidate:Plan|null;orderCodes:Record<string,string>;vehicleCodes:Record<string,string>};

export function isCurrentAnalyticsContext(stateKey:string,requestedKey:string,incidentId:string|null){
  return incidentId!==null&&stateKey===requestedKey;
}

export function snapshotFromReview(
  review:Pick<IncidentReview,'incident'|'affectedOrders'|'selectedAttempt'|'comparison'>,
  metadata:Metadata,
):AnalyticsSnapshot|null{
  const attempt=review.selectedAttempt;
  if(!attempt)return null;
  const comparison=review.comparison;
  const relevant=new Set(review.affectedOrders.map(item=>item.order_id));
  const frozen=new Set(review.affectedOrders.filter(item=>item.was_completed).map(item=>item.order_id));
  const rows=comparison?.orders.filter(item=>relevant.has(item.order_id))??[];
  return {
    source:'api',businessDate:review.incident.business_date,
    incident:{
      id:review.incident.id,code:review.incident.incident_code,type:review.incident.incident_type,
      affectedOrderIds:review.affectedOrders.filter(item=>item.requires_replanning&&!item.was_completed).map(item=>item.order_id),
      handoverOrderIds:review.affectedOrders.filter(item=>item.handover_required).map(item=>item.order_id),
      frozenOrderIds:[...frozen],
    },
    attempt:{id:attempt.recovery_plan_id,number:attempt.attempt_no,status:attempt.status,solverStatus:attempt.solver_status,validationStatus:attempt.validation_status,scope:attempt.replanning_scope,decision:attempt.dispatcher_decision,candidateVersion:metadata.candidate?`V${metadata.candidate.version_no}`:null},
    basePlan:attempt.base_plan_code,candidatePlan:attempt.candidate_plan_code,
    ratePerKm:null,distanceSource:'Backend recovery comparison',
    orders:rows.map(item=>({
      id:item.order_id,code:metadata.orderCodes[item.order_id]??item.order_id,
      baseVehicle:item.base_vehicle_id?(metadata.vehicleCodes[item.base_vehicle_id]??item.base_vehicle_id):null,
      candidateVehicle:item.candidate_vehicle_id?(metadata.vehicleCodes[item.candidate_vehicle_id]??item.candidate_vehicle_id):null,
      etaDeltaSeconds:item.eta_delta_seconds,
    })),
    officialReassignedCount:comparison?.reassigned_order_count,
    assignmentTotals:metadata.base&&metadata.candidate?{
      baseAssigned:metadata.base.assigned_order_count,candidateAssigned:metadata.candidate.assigned_order_count,
      baseUnassigned:metadata.base.unassigned_order_count,candidateUnassigned:metadata.candidate.unassigned_order_count,
    }:undefined,
    remaining:{
      baseDistanceMeters:comparison?.remaining_metrics.base_distance_meters??null,
      candidateDistanceMeters:comparison?.remaining_metrics.candidate_distance_meters??null,
      baseDurationSeconds:comparison?.remaining_metrics.base_duration_seconds??null,
      candidateDurationSeconds:comparison?.remaining_metrics.candidate_duration_seconds??null,
      reason:comparison?.remaining_metrics.reason==='NO_COMPARABLE_REMAINDER_SNAPSHOT'
        ?'No comparable remaining-route snapshot is available.'
        :comparison?.remaining_metrics.reason??'No comparable remaining-route snapshot is available.',
    },
  };
}

async function orderCodesForPlan(id:string,signal?:AbortSignal){
  const root=`/delivery-plans/${encodeURIComponent(id)}/orders?page_size=100&page=`;
  const first=await apiRead(`${root}1`,membershipPage,signal),codes:Record<string,string>={};
  for(const item of first.items)codes[item.order_id]=item.order_code;
  for(let page=2;page<=first.total_pages;page++){
    for(const item of (await apiRead(`${root}${page}`,membershipPage,signal)).items)codes[item.order_id]=item.order_code;
  }
  return codes;
}

export async function loadAnalyticsIncident(id:string,attemptId?:string|null,signal?:AbortSignal){
  const review=await loadIncidentReview(id,attemptId,signal);
  const comparison=review.comparison;
  if(!comparison)return {review,snapshot:snapshotFromReview(review,{base:null,candidate:null,orderCodes:{},vehicleCodes:{}})};
  const [base,candidate,orderCodes]=await Promise.all([
    apiRead(`/delivery-plans/${encodeURIComponent(comparison.base_plan_id)}`,plan,signal),
    apiRead(`/delivery-plans/${encodeURIComponent(comparison.candidate_plan_id)}`,plan,signal),
    orderCodesForPlan(comparison.base_plan_id,signal),
  ]);
  const ids=[...new Set(comparison.orders.flatMap(item=>[item.base_vehicle_id,item.candidate_vehicle_id]).filter((value):value is string=>value!==null))];
  const vehicles=await Promise.allSettled(ids.map(vehicleId=>apiRead(`/vehicles/${encodeURIComponent(vehicleId)}`,vehicle,signal)));
  if(signal?.aborted)throw new Error('Analytics loading was cancelled');
  const vehicleCodes:Record<string,string>={};
  vehicles.forEach((result,index)=>{if(result.status==='fulfilled')vehicleCodes[ids[index]]=result.value.vehicle_code;});
  return {review,snapshot:snapshotFromReview(review,{base,candidate,orderCodes,vehicleCodes})};
}
