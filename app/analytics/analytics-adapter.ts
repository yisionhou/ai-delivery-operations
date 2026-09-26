import type {AnalyticsSnapshot} from './analytics-model';

export type BackendIncident={id:string;incident_code:string;incident_type:string;business_date:string;affected_order_count:number};
export type BackendAttempt={recovery_plan_id:string;attempt_no:number;status:string;solver_status:string|null;validation_status:string|null;replanning_scope:string;dispatcher_decision:string|null;candidate_delivery_plan_id:string|null;base_plan_code:string;candidate_plan_code:string|null};
export type BackendAffectedOrder={order_id:string;requires_replanning:boolean;was_completed:boolean;handover_required:boolean};
export type BackendComparison={base_plan_id:string;candidate_plan_id:string;candidate_plan_status:string;business_date:string;reassigned_order_count:number;frozen_completed_order_ids:string[];orders:{order_id:string;base_vehicle_id:string|null;candidate_vehicle_id:string|null;eta_delta_seconds:number|null}[];remaining_metrics:{base_distance_meters:number|null;candidate_distance_meters:number|null;base_duration_seconds:number|null;candidate_duration_seconds:number|null;reason:string|null}};

export function adaptBackendSnapshot(incident:BackendIncident,attempt:BackendAttempt,affected:BackendAffectedOrder[],comparison:BackendComparison|null):AnalyticsSnapshot{
  return {
    source:'api',businessDate:incident.business_date,
    incident:{id:incident.id,code:incident.incident_code,type:incident.incident_type.replaceAll('_',' '),
      affectedOrderIds:affected.filter(order=>order.requires_replanning&&!order.was_completed).map(order=>order.order_id),
      handoverOrderIds:affected.filter(order=>order.handover_required&&!order.was_completed).map(order=>order.order_id),
      frozenOrderIds:comparison?.frozen_completed_order_ids??[]},
    attempt:{id:attempt.recovery_plan_id,number:attempt.attempt_no,status:comparison?.candidate_plan_status??attempt.status,
      solverStatus:attempt.solver_status,validationStatus:attempt.validation_status,scope:attempt.replanning_scope,
      decision:attempt.dispatcher_decision,candidateVersion:attempt.candidate_plan_code},
    basePlan:attempt.base_plan_code,candidatePlan:comparison?(attempt.candidate_plan_code??comparison.candidate_plan_id):null,
    ratePerKm:null,distanceSource:'Backend plan routing estimate',
    officialReassignedCount:comparison?.reassigned_order_count,
    orders:comparison?.orders.map(order=>({id:order.order_id,code:order.order_id,baseVehicle:order.base_vehicle_id,candidateVehicle:order.candidate_vehicle_id,etaDeltaSeconds:order.eta_delta_seconds}))??[],
    remaining:comparison?{baseDistanceMeters:comparison.remaining_metrics.base_distance_meters,candidateDistanceMeters:comparison.remaining_metrics.candidate_distance_meters,
      baseDurationSeconds:comparison.remaining_metrics.base_duration_seconds,candidateDurationSeconds:comparison.remaining_metrics.candidate_duration_seconds,reason:comparison.remaining_metrics.reason}:
      {baseDistanceMeters:null,candidateDistanceMeters:null,baseDurationSeconds:null,candidateDurationSeconds:null,reason:'No Candidate comparison is available for this attempt.'},
  };
}
