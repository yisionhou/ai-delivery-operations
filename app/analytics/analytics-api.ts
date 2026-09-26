import {z} from 'zod';
import {apiRead} from '../vehicles/vehicle-api.ts';
import {adaptBackendSnapshot} from './analytics-adapter.ts';
import type {BackendAttempt,BackendIncident} from './analytics-adapter';

const incidentList=z.object({id:z.string(),incident_code:z.string()});
const incident=incidentList.extend({incident_type:z.string(),business_date:z.string(),affected_order_count:z.number()});
const attempt=z.object({recovery_plan_id:z.string(),attempt_no:z.number(),status:z.string(),solver_status:z.string().nullable(),validation_status:z.string().nullable(),replanning_scope:z.string(),dispatcher_decision:z.string().nullable(),candidate_delivery_plan_id:z.string().nullable(),base_plan_code:z.string(),candidate_plan_code:z.string().nullable()});
const affected=z.object({order_id:z.string(),requires_replanning:z.boolean(),was_completed:z.boolean(),handover_required:z.boolean()});
const comparison=z.object({base_plan_id:z.string(),candidate_plan_id:z.string(),candidate_plan_status:z.string(),business_date:z.string(),reassigned_order_count:z.number(),frozen_completed_order_ids:z.array(z.string()),orders:z.array(z.object({order_id:z.string(),base_vehicle_id:z.string().nullable(),candidate_vehicle_id:z.string().nullable(),eta_delta_seconds:z.number().nullable()})),remaining_metrics:z.object({base_distance_meters:z.number().nullable(),candidate_distance_meters:z.number().nullable(),base_duration_seconds:z.number().nullable(),candidate_duration_seconds:z.number().nullable(),reason:z.string().nullable()})});
const page=z.object({items:z.array(incidentList),total_pages:z.number()});

export async function loadBackendIncidents(date:string,signal?:AbortSignal):Promise<Pick<BackendIncident,'id'|'incident_code'>[]>{
  const path=`/incidents?business_date=${encodeURIComponent(date)}&page_size=100`;
  const first=await apiRead(`${path}&page=1`,page,signal);
  const items=[...first.items];
  for(let index=2;index<=first.total_pages;index++)items.push(...(await apiRead(`${path}&page=${index}`,page,signal)).items);
  return items;
}

export function loadBackendAttempts(incidentId:string,signal?:AbortSignal):Promise<BackendAttempt[]>{
  return apiRead(`/incidents/${encodeURIComponent(incidentId)}/recovery-plans`,z.array(attempt),signal);
}

export async function loadBackendSnapshot(incidentId:string,selectedAttempt:BackendAttempt,signal?:AbortSignal){
  const base=`/incidents/${encodeURIComponent(incidentId)}`;
  const [detail,affectedOrders,planComparison]=await Promise.all([
    apiRead(base,incident,signal),
    apiRead(`${base}/affected-orders`,z.array(affected),signal),
    selectedAttempt.candidate_delivery_plan_id?apiRead(`/recovery-plans/${encodeURIComponent(selectedAttempt.recovery_plan_id)}/comparison`,comparison,signal):Promise.resolve(null),
  ]);
  return adaptBackendSnapshot(detail,selectedAttempt,affectedOrders,planComparison);
}
