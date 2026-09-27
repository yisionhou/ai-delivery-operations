import {z} from 'zod';
import {apiRead, VehicleApiError} from '../vehicles/vehicle-api.ts';
import type {Comparison, TaskChange} from '../incidents/incident-types';
import type {CandidateComparison, RecoveryCandidate, RecoveryOptionsData} from './recovery-types';

const page=<T extends z.ZodTypeAny>(item:T)=>z.object({items:z.array(item),total_pages:z.number()});
const incidentItem=z.object({id:z.string(),incident_code:z.string(),incident_type:z.string(),status:z.string(),business_date:z.string(),base_delivery_plan_id:z.string(),detected_at:z.string()});
const incident=incidentItem.extend({base_plan_code:z.string(),vehicle_id:z.string().nullable(),merchant_id:z.string().nullable(),affected_order_count:z.number(),handover_order_count:z.number(),requires_replanning:z.boolean(),recovery_attempts:z.array(z.object({recovery_plan_id:z.string(),attempt_no:z.number(),status:z.string(),candidate_delivery_plan_id:z.string().nullable()}))});
const currentPlan=z.object({id:z.string(),plan_code:z.string(),business_date:z.string(),status:z.string()});
const affected=z.object({order_id:z.string(),was_completed:z.boolean(),was_picked_up:z.boolean(),handover_required:z.boolean(),impact_type:z.string(),impact_reason:z.string()});
const attempt=z.object({recovery_plan_id:z.string(),attempt_no:z.number(),status:z.string(),solver_status:z.string().nullable(),validation_status:z.string().nullable(),candidate_delivery_plan_id:z.string().nullable(),candidate_plan_code:z.string().nullable().optional(),scope_description:z.string().optional(),base_delivery_plan_id:z.string(),agent_explanation:z.string().nullable().optional(),solver_validation_summary:z.object({explanation_source:z.string().optional()}).nullable().optional()});
const orderChange=z.object({order_id:z.string(),base_assignment_status:z.string().nullable(),candidate_assignment_status:z.string().nullable(),base_vehicle_id:z.string().nullable(),candidate_vehicle_id:z.string().nullable(),assignment_changed:z.boolean(),route_task_changed:z.boolean(),base_delivery_eta:z.string().nullable(),candidate_delivery_eta:z.string().nullable(),eta_delta_seconds:z.number().nullable(),eta_unavailable_reason:z.string().nullable()});
const stopChange=z.object({order_id:z.string(),stop_type:z.string(),change_type:z.string(),base_vehicle_id:z.string().nullable(),candidate_vehicle_id:z.string().nullable(),base_location_id:z.string().nullable(),candidate_location_id:z.string().nullable()});
const comparison=z.object({recovery_plan_id:z.string(),base_plan_id:z.string(),candidate_plan_id:z.string(),business_date:z.string(),comparison_at:z.string(),base_plan_status:z.string(),candidate_plan_status:z.string(),reviewable:z.boolean(),reassigned_order_count:z.number(),affected_vehicle_ids:z.array(z.string()),frozen_completed_order_ids:z.array(z.string()),orders:z.array(orderChange),stop_changes:z.array(stopChange),remaining_metrics:z.object({base_distance_meters:z.number().nullable(),candidate_distance_meters:z.number().nullable(),delta_distance_meters:z.number().nullable(),base_duration_seconds:z.number().nullable(),candidate_duration_seconds:z.number().nullable(),delta_duration_seconds:z.number().nullable(),reason:z.string().nullable()})});
const dashboard=z.object({current_plan:z.object({delivery_plan_id:z.string(),plan_code:z.string()}),orders:z.object({total:z.number(),at_risk:z.number()}),vehicles:z.object({available:z.number(),active:z.number(),unavailable:z.number()}),on_time:z.object({rate:z.number().nullable()})});
const alert=z.object({id:z.string(),order_id:z.string(),risk_type:z.string(),reason_category:z.string().nullable(),evidence:z.record(z.unknown()),detected_at:z.string()});
const order=z.object({order_code:z.string(),delivery_location:z.object({display_name:z.string()})});
const vehicle=z.object({vehicle_code:z.string()});
const envelope=z.object({success:z.boolean(),code:z.string(),message:z.string(),data:z.unknown()});

export function describeAgentFailure(reason:unknown,action:'briefing'|'question'|'recovery'|'approval'):string{
  const code=reason instanceof VehicleApiError?reason.code:reason&&typeof reason==='object'&&'code' in reason&&typeof reason.code==='string'?reason.code:null;
  const known:Record<string,string>={
    BACKEND_UNAVAILABLE:'The backend is unavailable. Check the connection and try again.',
    AGENT_NOT_CONFIGURED:'Agent access is not configured. Contact an administrator.',
    DISPATCH_FORBIDDEN:'Dispatcher access is required for this action.',
    UNAUTHORIZED:'Sign in with an authorized account and try again.',
    CANDIDATE_SCHEDULE_STALE:'This candidate is out of date. Refresh the Incident and generate a new recovery proposal.',
    RECOVERY_SNAPSHOT_STALE:'This candidate is out of date. Refresh the Incident and generate a new recovery proposal.',
    RECOVERY_CONTEXT_CHANGED:'This candidate is out of date. Refresh the Incident and generate a new recovery proposal.',
    RECOVERY_ALREADY_DECIDED:'This candidate has already been decided. Refresh the Incident before taking another action.',
    RECOVERY_NOT_REVIEWABLE:'This candidate is no longer available for approval. Refresh the Incident.',
    CANDIDATE_PLAN_INVALID:'This candidate is no longer valid. Refresh the Incident.',
    RECOVERY_SOLVER_ERROR:'Recovery planning failed. The Current Plan has not changed. Manual intervention may be needed.',
    RECOVERY_VALIDATION_FAILED:'Recovery validation failed. The Current Plan has not changed. Manual intervention may be needed.',
  };
  if(code==='BACKEND_UNAVAILABLE'&&action==='approval')return 'Approval could not be confirmed because the backend is unavailable. Refresh the Incident and Current Plan before trying again. (Error code: BACKEND_UNAVAILABLE)';
  if(code&&known[code])return `${known[code]} (Error code: ${code})`;
  if(action==='approval'&&reason instanceof TypeError)return 'Dispatch / Apply could not be confirmed. Refresh the Incident and Current Plan before trying again.';
  const message=reason instanceof Error?reason.message:reason&&typeof reason==='object'&&'message' in reason&&typeof reason.message==='string'?reason.message:'';
  if(message&&!/[\u3400-\u9fff]/u.test(message)&&message!=='Failed to fetch')return code?`${message} (Error code: ${code})`:message;
  const fallback={briefing:'Live operations could not be loaded.',question:'Penrose could not answer this question. Please try again.',recovery:'Recovery options could not be loaded. Please try again.',approval:'Dispatch / Apply could not be confirmed. Refresh the Incident and Current Plan before trying again.'}[action];
  return code?`${fallback} (Error code: ${code})`:fallback;
}

async function apiCommand<T>(path:string,body:object,schema:z.ZodType<T>,signal?:AbortSignal):Promise<T>{
  const response=await fetch('/api'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal,cache:'no-store'});
  const parsed=envelope.safeParse(await response.json().catch(()=>null));
  if(!parsed.success)throw new VehicleApiError('INVALID_RESPONSE','The service returned an unexpected response.',response.status);
  if(!response.ok||!parsed.data.success)throw new VehicleApiError(parsed.data.code,parsed.data.message,response.status);
  const data=schema.safeParse(parsed.data.data);
  if(!data.success)throw new VehicleApiError('CONTRACT_MISMATCH','The service response does not match the verified contract.',response.status);
  return data.data;
}

export type AgentBriefing={
  businessDate:string;
  currentPlanId:string;
  incident:z.infer<typeof incident>|null;
  incidentOptions:z.infer<typeof incidentItem>[];
  recoveryPlanId:string|null;
  affectedOrderIds:string[];
  affectedOrderCodes:string[];
  vehicleCode:string;
  totalOrders:number;
  activeVehicles:number;
  totalVehicles:number;
  atRiskOrders:number;
  onTimeRate:number|null;
  planCode:string;
  risks:{alertId:string;orderId:string;orderCode:string;description:string;detail:string}[];
};

export async function loadAgentBriefing(incidentId?:string,signal?:AbortSignal):Promise<AgentBriefing>{
  const explicit=incidentId?await apiRead(`/incidents/${encodeURIComponent(incidentId)}`,incident,signal):null;
  const current=(await apiRead(`/delivery-plans?status=CURRENT&page=1&page_size=1${explicit?`&business_date=${explicit.business_date}`:''}`,page(currentPlan),signal)).items[0];
  const businessDate=explicit?.business_date??current?.business_date;
  if(!businessDate)throw new Error('No Current Plan is available. Select a business date or generate a plan before using live operations.');
  const first=await apiRead(`/incidents?business_date=${businessDate}&page=1&page_size=100`,page(incidentItem),signal);
  const incidentOptions=[...first.items];
  for(let pageNo=2;pageNo<=first.total_pages;pageNo++){
    const next=await apiRead(`/incidents?business_date=${businessDate}&page=${pageNo}&page_size=100`,page(incidentItem),signal);
    incidentOptions.push(...next.items);
  }
  if(explicit&&!incidentOptions.some(item=>item.id===explicit.id))incidentOptions.unshift(explicit);
  const selected=explicit??(incidentOptions.find(item=>item.status!=='RESOLVED'&&item.base_delivery_plan_id===current?.id)??incidentOptions.find(item=>item.status!=='RESOLVED')??incidentOptions[0]??null);
  const context=explicit??(selected?await apiRead(`/incidents/${encodeURIComponent(selected.id)}`,incident,signal):null);
  const [affectedOrders,operations,alerts,resource]=await Promise.all([
    context?apiRead(`/incidents/${context.id}/affected-orders`,z.array(affected),signal):Promise.resolve([]),
    apiRead(`/operations/dashboard?business_date=${businessDate}`,dashboard,signal),
    apiRead(`/operations/alerts?business_date=${businessDate}&status=ACTIVE&page=1&page_size=100`,page(alert),signal),
    context?.vehicle_id?apiRead(`/vehicles/${context.vehicle_id}`,vehicle,signal):Promise.resolve(null),
  ]);
  const affectedIds=new Set(affectedOrders.map(item=>item.order_id));
  const visibleAlerts=context?alerts.items.filter(item=>affectedIds.has(item.order_id)):alerts.items;
  const orderIds=[...new Set([...affectedIds,...visibleAlerts.map(item=>item.order_id)])];
  const orderDetails=await Promise.all(orderIds.map(id=>apiRead(`/orders/${id}`,order,signal)));
  const codes=new Map(orderIds.map((id,index)=>[id,orderDetails[index].order_code]));
  const pending=context?.recovery_attempts.filter(item=>item.status==='PENDING_REVIEW'&&item.candidate_delivery_plan_id).sort((a,b)=>b.attempt_no-a.attempt_no)[0];
  return {businessDate,currentPlanId:operations.current_plan.delivery_plan_id,incident:context,incidentOptions,recoveryPlanId:pending?.recovery_plan_id??null,affectedOrderIds:affectedOrders.map(item=>item.order_id),affectedOrderCodes:affectedOrders.map(item=>codes.get(item.order_id)??codeFallback(item.order_id)),vehicleCode:resource?.vehicle_code??'Merchant',
    totalOrders:operations.orders.total,activeVehicles:operations.vehicles.active,totalVehicles:Object.values(operations.vehicles).reduce((n,v)=>n+v,0),
    atRiskOrders:operations.orders.at_risk,onTimeRate:operations.on_time.rate,planCode:operations.current_plan.plan_code,
    risks:visibleAlerts.map(item=>({alertId:item.id,orderId:item.order_id,orderCode:codes.get(item.order_id)??codeFallback(item.order_id),description:'Delivery window risk',detail:item.reason_category??'Review deterministic risk evidence'}))};
}

const codeFallback=(id:string)=>id.slice(0,8);
const clock=(value:string|null)=>value?new Date(value).toLocaleString('en-SG',{timeZone:'Asia/Singapore',hour:'2-digit',minute:'2-digit'}):null;
const textMetric=(value:number|null,unit:string)=>value===null?null:`${value>0?'+':''}${value} ${unit}`;

function reviewSnapshot(raw:z.infer<typeof comparison>,rows:z.infer<typeof affected>[],orderCodes:Map<string,string>,vehicleCodes:Map<string,string>,locations:Map<string,string>):CandidateComparison{
  const label=(id:string|null)=>id?vehicleCodes.get(id)??codeFallback(id):'Unassigned';
  const relevant=new Set(rows.map(item=>item.order_id));
  const changed=raw.orders.filter(item=>item.assignment_changed||item.route_task_changed||relevant.has(item.order_id));
  const assigned=changed.filter(item=>item.base_vehicle_id&&item.candidate_vehicle_id);
  const assignmentChanges=assigned.map(item=>({orderId:orderCodes.get(item.order_id)??codeFallback(item.order_id),baseVehicle:label(item.base_vehicle_id),candidateVehicle:label(item.candidate_vehicle_id),baseState:'ASSIGNED' as const,candidateState:'ASSIGNED' as const,change:item.base_vehicle_id===item.candidate_vehicle_id?'Unchanged':'Reassigned',reassigned:item.base_vehicle_id!==item.candidate_vehicle_id,reason:item.assignment_changed?'Vehicle assignment changed by recovery.':'Assignment preserved.'}));
  const stopChanges:TaskChange[]=raw.stop_changes.map(item=>({action:(item.stop_type==='HANDOVER'?'Handover':item.stop_type==='PICKUP'?'Pickup':'Delivery'),change:(item.change_type==='ADDED'?'Added':item.change_type==='REMOVED'?'Removed':'Modified'),vehicle:label(item.candidate_vehicle_id??item.base_vehicle_id),orders:[orderCodes.get(item.order_id)??codeFallback(item.order_id)],location:'Location snapshot unavailable in comparison',reason:`${item.stop_type.toLowerCase()} task ${item.change_type.toLowerCase()}.`}));
  const etaChanges=changed.map(item=>({orderId:orderCodes.get(item.order_id)??codeFallback(item.order_id),oldEta:clock(item.base_delivery_eta),newEta:clock(item.candidate_delivery_eta),delta:item.eta_delta_seconds===null?null:textMetric(Math.round(item.eta_delta_seconds/60),'min'),baseline:raw.comparison_at,unavailableReason:item.eta_unavailable_reason}));
  const reason=raw.remaining_metrics.reason??'Comparable remaining-distance and duration snapshots are unavailable.';
  const metric=(base:number|null,candidate:number|null,delta:number|null,unit:string)=>({comparable:base!==null&&candidate!==null&&delta!==null,base:base===null?null:`${base} ${unit}`,candidate:candidate===null?null:`${candidate} ${unit}`,delta:delta===null?null:textMetric(delta,unit),reason:delta===null?reason:null,baseline:raw.comparison_at});
  const comparableEta=etaChanges.filter(item=>item.delta!==null).length;
  const mapped:Comparison={businessDate:raw.business_date,comparisonTime:clock(raw.comparison_at)??raw.comparison_at,basePlanId:raw.base_plan_id,candidatePlanId:raw.candidate_plan_id,
    candidateStatus:raw.candidate_plan_status==='CURRENT'?'APPLIED':raw.reviewable?'READY':'STALE',baseIsCurrent:raw.base_plan_status==='CURRENT',comparable:true,approvalEligible:raw.reviewable,staleReason:raw.reviewable?null:'Candidate is no longer eligible for approval.',
    assignmentChanges,stopChanges,etaChanges,
    unassignedChanges:changed.filter(item=>item.base_assignment_status!==item.candidate_assignment_status).map(item=>({orderId:orderCodes.get(item.order_id)??codeFallback(item.order_id),from:item.base_assignment_status==='ASSIGNED'?'ASSIGNED' as const:'UNASSIGNED' as const,to:item.candidate_assignment_status==='ASSIGNED'?'ASSIGNED' as const:'UNASSIGNED' as const,reason:'Plan membership changed.'})),
    disturbanceSummary:{reassignedOrders:raw.reassigned_order_count,affectedVehicles:raw.affected_vehicle_ids.length,routeTasksChanged:raw.stop_changes.length,routeSummary:`${raw.reassigned_order_count} order(s) reassigned; ${raw.stop_changes.length} route task(s) changed.`,etaSummary:comparableEta?`${comparableEta} order ETA difference(s) available.`:'Historical ETA differences unavailable.',protectedWork:`${raw.frozen_completed_order_ids.length} completed order(s) frozen and protected.`,completedStopsProtected:null,routeTasksUnchanged:null,protectedCountsUnavailableReason:'Completed-stop and unchanged-task counts are not provided by this comparison.'},
    remainingMetrics:{distance:metric(raw.remaining_metrics.base_distance_meters,raw.remaining_metrics.candidate_distance_meters,raw.remaining_metrics.delta_distance_meters,'m'),duration:metric(raw.remaining_metrics.base_duration_seconds,raw.remaining_metrics.candidate_duration_seconds,raw.remaining_metrics.delta_duration_seconds,'s')},
    missingMetrics:raw.remaining_metrics.reason?[{metric:'Remaining distance and duration',reason}]:[],mapChanges:{base:{type:'LineString',coordinates:[]},candidate:{},orderIds:[],vehicleIds:[]}};
  return {comparison:mapped,orders:changed.map(item=>({id:orderCodes.get(item.order_id)??codeFallback(item.order_id),location:locations.get(item.order_id)??'Location unavailable in order snapshot'}))};
}

export async function loadLiveRecovery({incidentId,signal}:{incidentId:string;signal:AbortSignal}):Promise<RecoveryOptionsData>{
  const [context,affectedOrders,attempts]=await Promise.all([
    apiRead(`/incidents/${encodeURIComponent(incidentId)}`,incident,signal),
    apiRead(`/incidents/${encodeURIComponent(incidentId)}/affected-orders`,z.array(affected),signal),
    apiRead(`/incidents/${encodeURIComponent(incidentId)}/recovery-plans`,z.array(attempt),signal),
  ]);
  let reviewable=attempts.filter(item=>item.status==='PENDING_REVIEW'&&item.validation_status==='VALID'&&item.candidate_delivery_plan_id);
  if(!reviewable.length&&context.status!=='RESOLVED'&&context.requires_replanning){
    const started=await apiCommand(`/incidents/${encodeURIComponent(incidentId)}/recovery`,{},z.object({reviewable_recovery_plan_id:z.string().nullable()}),signal);
    if(started.reviewable_recovery_plan_id)reviewable=[await apiRead(`/recovery-plans/${started.reviewable_recovery_plan_id}`,attempt,signal)];
  }
  const chosen=reviewable.at(-1);
  if(!chosen)return {source:'live',incidentId,resourceId:context.vehicle_id??context.merchant_id??'Merchant',currentPlanId:context.base_delivery_plan_id,totalOrdersCount:0,affectedOrdersCount:affectedOrders.length,affectedOrderIds:affectedOrders.map(row=>codeFallback(row.order_id)),nearbyAvailableResourcesCount:null,candidates:[],blockedReason:'No feasible reviewable Recovery candidate is available.'};
  const raw=await apiRead(`/recovery-plans/${chosen.recovery_plan_id}/comparison`,comparison,signal);
  if(raw.base_plan_id!==context.base_delivery_plan_id||raw.candidate_plan_id!==chosen.candidate_delivery_plan_id||raw.recovery_plan_id!==chosen.recovery_plan_id)throw new Error('Recovery comparison does not match this Incident.');
  const selected=raw.orders.filter(row=>row.assignment_changed||row.route_task_changed||affectedOrders.some(a=>a.order_id===row.order_id));
  const vehicleIds=[...new Set(selected.flatMap(row=>[row.base_vehicle_id,row.candidate_vehicle_id]).filter((id):id is string=>Boolean(id)))];
  const [orderEntries,vehicleEntries]=await Promise.all([
    Promise.all(selected.map(async item=>[item.order_id,await apiRead(`/orders/${item.order_id}`,order,signal)] as const)),
    Promise.all(vehicleIds.map(async id=>[id,await apiRead(`/vehicles/${id}`,vehicle,signal)] as const)),
  ]);
  const orderCodes=new Map(orderEntries.map(([id,item])=>[id,item.order_code]));
  const locations=new Map(orderEntries.map(([id,item])=>[id,item.delivery_location.display_name]));
  const vehicleCodes=new Map(vehicleEntries.map(([id,item])=>[id,item.vehicle_code]));
  const snapshot=reviewSnapshot(raw,affectedOrders,orderCodes,vehicleCodes,locations);
  const assigned=snapshot.comparison.assignmentChanges;
  const orderReassignments=assigned.map(row=>({orderId:row.orderId,fromResource:row.baseVehicle!,toResource:row.candidateVehicle!,arrival:clock(selected.find(item=>orderCodes.get(item.order_id)===row.orderId)?.candidate_delivery_eta??null)??undefined,impact:row.reassigned?'Reassigned':'Original assignment'}));
  const resourceId=context.vehicle_id?vehicleCodes.get(context.vehicle_id)??codeFallback(context.vehicle_id):context.merchant_id?codeFallback(context.merchant_id):'Merchant';
  const historicalChinese=/[\u3400-\u9fff]/u.test(chosen.agent_explanation??'');
  const verifiedSummary=`${raw.reassigned_order_count} order(s) reassigned; ${affectedOrders.filter(row=>row.handover_required).length} handover order(s). The validated Candidate requires dispatcher approval before becoming Current.`;
  const explanation=historicalChinese?verifiedSummary:chosen.agent_explanation??'Feasible Candidate ready for dispatcher review.';
  const candidate:RecoveryCandidate={id:chosen.recovery_plan_id,label:'A',title:/[\u3400-\u9fff]/u.test(chosen.scope_description??'')?`Recovery Candidate · Attempt ${chosen.attempt_no}`:chosen.scope_description??'Recovery Candidate',description:explanation,reassignedOrdersCount:raw.reassigned_order_count,completionImpactMinutes:null,distanceImpactKm:raw.remaining_metrics.delta_distance_meters===null?null:raw.remaining_metrics.delta_distance_meters/1000,orderReassignments,routeImpact:{orders:[],originalRoute:[],recoveryRoutes:[]},recommendationReason:explanation,explanationSource:historicalChinese?'verified_comparison_summary':chosen.solver_validation_summary?.explanation_source??'unknown',reviewSnapshot:snapshot};
  return {source:'live',incidentId,resourceId,currentPlanId:context.base_delivery_plan_id,totalOrdersCount:raw.orders.length,affectedOrdersCount:affectedOrders.length,affectedOrderIds:affectedOrders.map(row=>orderCodes.get(row.order_id)??codeFallback(row.order_id)),nearbyAvailableResourcesCount:null,candidates:[candidate]};
}

export type AgentQuestionContext={business_date:string;incident_id?:string;recovery_plan_id?:string;order_id?:string;alert_id?:string};
export async function askAgent(message:string,context:AgentQuestionContext,contextToken?:string,signal?:AbortSignal):Promise<{message:string;source:string;contextToken?:string}>{
  const result=await apiCommand('/agent/dispatch',{message,context,...(contextToken?{context_token:contextToken}:{})},z.object({status:z.enum(['COMPLETED','NEEDS_INPUT','FAILED']),message:z.string(),explanation_source:z.string(),context_token:z.string().nullable().optional()}),signal);
  if(result.status==='FAILED')throw new Error(result.message);
  return {message:result.message,source:result.explanation_source,...(result.context_token?{contextToken:result.context_token}:{})};
}

export async function approveCandidate(recoveryPlanId:string,reason:string,expectedCandidatePlanId:string):Promise<void>{
  if(!reason.trim())throw new Error('A decision reason is required.');
  const result=await apiCommand(`/recovery-plans/${encodeURIComponent(recoveryPlanId)}/approve`,{decision_reason:reason.trim()},z.object({current_delivery_plan_id:z.string(),candidate_status:z.string(),incident_status:z.string()}));
  if(result.current_delivery_plan_id!==expectedCandidatePlanId||result.candidate_status!=='CURRENT'||result.incident_status!=='RESOLVED')throw new Error('Approval response did not confirm the expected Current Plan. Refresh the Incident before taking another action.');
}
