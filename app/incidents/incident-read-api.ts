import {z} from 'zod';
import {apiRead} from '../vehicles/vehicle-api.ts';

const incidentItem=z.object({id:z.string(),incident_code:z.string(),incident_type:z.string(),status:z.string(),business_date:z.string(),detected_at:z.string()});
const incidentDetail=incidentItem.extend({base_delivery_plan_id:z.string(),base_plan_code:z.string(),vehicle_route_id:z.string().nullable(),vehicle_id:z.string().nullable(),merchant_id:z.string().nullable(),incident_location_id:z.string().nullable().optional(),incident_location:z.object({latitude:z.number(),longitude:z.number(),address_text:z.string().nullable()}).nullable().optional(),detected_by:z.string(),affected_order_count:z.number(),handover_order_count:z.number(),impact_summary:z.record(z.string(),z.number()),requires_replanning:z.boolean()});
const affectedOrder=z.object({order_id:z.string(),original_vehicle_route_id:z.string().nullable(),execution_status_snapshot:z.string(),risk_status_snapshot:z.string(),was_picked_up:z.boolean(),was_completed:z.boolean(),requires_replanning:z.boolean(),handover_required:z.boolean(),impact_type:z.string(),impact_reason:z.string(),assessed_at:z.string()});
const attempt=z.object({recovery_plan_id:z.string(),attempt_no:z.number(),replanning_scope:z.string(),status:z.string(),solver_status:z.string().nullable(),validation_status:z.string().nullable(),candidate_delivery_plan_id:z.string().nullable(),recovery_code:z.string(),incident_id:z.string(),previous_recovery_plan_id:z.string().nullable(),base_delivery_plan_id:z.string(),base_plan_code:z.string(),candidate_plan_code:z.string().nullable(),scope_description:z.string(),agent_explanation:z.string().nullable(),solver_validation_summary:z.record(z.string(),z.unknown()).nullable(),dispatcher_decision:z.string().nullable(),decision_reason:z.string().nullable(),reviewed_by:z.string().nullable(),reviewed_at:z.string().nullable(),created_at:z.string(),updated_at:z.string()});
const orderChange=z.object({order_id:z.string(),base_assignment_status:z.string().nullable(),candidate_assignment_status:z.string().nullable(),base_vehicle_id:z.string().nullable(),candidate_vehicle_id:z.string().nullable(),base_delivery_eta:z.string().nullable(),candidate_delivery_eta:z.string().nullable(),eta_delta_seconds:z.number().nullable(),eta_basis:z.string().nullable(),eta_unavailable_reason:z.string().nullable()});
const stopChange=z.object({order_id:z.string(),stop_type:z.string(),change_type:z.string(),base_vehicle_id:z.string().nullable().optional(),candidate_vehicle_id:z.string().nullable()});
const comparison=z.object({recovery_plan_id:z.string(),base_plan_id:z.string(),candidate_plan_id:z.string(),business_date:z.string(),comparison_at:z.string(),comparison_time_basis:z.string(),base_plan_status:z.string(),candidate_plan_status:z.string(),reviewable:z.boolean(),orders:z.array(orderChange),stop_changes:z.array(stopChange),reassigned_order_count:z.number(),affected_vehicle_ids:z.array(z.string()),frozen_completed_order_ids:z.array(z.string()),remaining_metrics:z.object({base_distance_meters:z.number().nullable(),candidate_distance_meters:z.number().nullable(),base_duration_seconds:z.number().nullable(),candidate_duration_seconds:z.number().nullable(),reason:z.string().nullable()})});
const planRoute=z.object({id:z.string(),delivery_plan_id:z.string(),vehicle_id:z.string(),route_no:z.number(),route_geometry:z.unknown().nullable(),route_metrics:z.record(z.string(),z.unknown()).nullable()});
const page=z.object({items:z.array(incidentItem),total_pages:z.number()});

export type IncidentMapFeature={type:'Feature';properties:{plan:'base'|'candidate';route_id:string;vehicle_id:string;route_no:number;road_aligned:boolean;road_leg_end_indices:number[]|null};geometry:{type:'LineString';coordinates:[number,number][]}};
export type IncidentMapOverlay={features:IncidentMapFeature[];incidentPoint:[number,number]|null;missingPlans:('base'|'candidate')[];hasCandidate:boolean;orderSegmentsAvailable:false};
export type IncidentReview={incident:z.infer<typeof incidentDetail>;affectedOrders:z.infer<typeof affectedOrder>[];attempts:z.infer<typeof attempt>[];selectedAttempt:z.infer<typeof attempt>|null;comparison:z.infer<typeof comparison>|null;mapOverlay:IncidentMapOverlay};
export type IncidentIndexItem=z.infer<typeof incidentItem>;
export type IncidentOrderRouteFeature={type:'Feature';properties:{incident_id:string;order_id:string;plan:'base'|'candidate';vehicle_id:string;completed:boolean;origin:'PICKUP'|'HANDOVER'};geometry:{type:'LineString';coordinates:[number,number][]}};
export type IncidentIndexMap={features:IncidentOrderRouteFeature[];incidents:{id:string;code:string;point:[number,number]}[];warnings:string[]};
export type IncidentFocusNode={order_id:string;vehicle_id:string;plan:'base'|'candidate';kind:'START'|'PICKUP'|'HANDOVER'|'DELIVERY';completed:boolean;point:[number,number]};
export type IncidentFocusMap={features:IncidentOrderRouteFeature[];approaches:{type:'Feature';properties:{vehicle_id:string;order_id:string};geometry:{type:'LineString';coordinates:[number,number][]}}[];nodes:IncidentFocusNode[];incidentPoint:[number,number]|null;hasCandidate:boolean;warnings:string[]};
type MapStop={order_id:string;stop_type:string;sequence_no:number};
const mapStops=z.array(z.object({order_id:z.string(),stop_type:z.string(),sequence_no:z.number()}));

function validPoint(raw:unknown):raw is [number,number]{
  return Array.isArray(raw)&&raw.length===2&&raw.every(value=>typeof value==='number'&&Number.isFinite(value))&&raw[0]>=-180&&raw[0]<=180&&raw[1]>=-90&&raw[1]<=90;
}

function routeFeature(route:z.infer<typeof planRoute>,plan:'base'|'candidate'):IncidentMapFeature|null{
  const geometry=route.route_geometry;
  if(!geometry||typeof geometry!=='object'||!('type'in geometry)||!('coordinates'in geometry)||geometry.type!=='LineString'||!Array.isArray(geometry.coordinates)||geometry.coordinates.length<2||!geometry.coordinates.every(validPoint))return null;
  return {type:'Feature',properties:{plan,route_id:route.id,vehicle_id:route.vehicle_id,route_no:route.route_no,road_aligned:route.route_metrics?.geometry_provider==='OSRM',road_leg_end_indices:Array.isArray(route.route_metrics?.road_leg_end_indices)?route.route_metrics.road_leg_end_indices:null},geometry:{type:'LineString',coordinates:geometry.coordinates}};
}

export function buildAffectedOrderRoutes(review:Pick<IncidentReview,'incident'|'affectedOrders'|'mapOverlay'>,stopsByRoute:Record<string,MapStop[]>):IncidentOrderRouteFeature[]{
  const result:IncidentOrderRouteFeature[]=[];
  for(const route of review.mapOverlay.features){
    const stops=stopsByRoute[route.properties.route_id]?.toSorted((a,b)=>a.sequence_no-b.sequence_no);
    const ends=route.properties.road_leg_end_indices,points=route.geometry.coordinates;
    if(!route.properties.road_aligned||!stops||!ends||![stops.length,stops.length+1].includes(ends.length)||ends.at(-1)!==points.length-1||
      ends.some((value,index)=>!Number.isInteger(value)||value<0||value>=points.length||(index>0&&value<ends[index-1])))continue;
    for(const order of review.affectedOrders){
      if(route.properties.plan==='base'&&route.properties.route_id!==order.original_vehicle_route_id)continue;
      if(route.properties.plan==='candidate'&&order.was_completed)continue;
      const start=stops.findIndex(stop=>stop.order_id===order.order_id&&(stop.stop_type==='PICKUP'||stop.stop_type==='HANDOVER'));
      const end=stops.findIndex((stop,index)=>index>start&&stop.order_id===order.order_id&&stop.stop_type==='DELIVERY');
      if(start<0||end<0)continue;
      const segment=points.slice(ends[start],ends[end]+1);
      if(segment.length<2||segment.every(point=>point[0]===segment[0][0]&&point[1]===segment[0][1]))continue;
      result.push({type:'Feature',properties:{incident_id:review.incident.id,order_id:order.order_id,plan:route.properties.plan,vehicle_id:route.properties.vehicle_id,completed:order.was_completed,origin:stops[start].stop_type as 'PICKUP'|'HANDOVER'},geometry:{type:'LineString',coordinates:segment}});
    }
  }
  return result;
}

export function buildIncidentFocusMap(review:Pick<IncidentReview,'incident'|'affectedOrders'|'mapOverlay'>,stopsByRoute:Record<string,MapStop[]>):IncidentFocusMap{
  const features=buildAffectedOrderRoutes(review,stopsByRoute);
  const nodes:IncidentFocusNode[]=features.flatMap(feature=>[
    {order_id:feature.properties.order_id,vehicle_id:feature.properties.vehicle_id,plan:feature.properties.plan,kind:feature.properties.origin,completed:feature.properties.completed,point:feature.geometry.coordinates[0]},
    {order_id:feature.properties.order_id,vehicle_id:feature.properties.vehicle_id,plan:feature.properties.plan,kind:'DELIVERY' as const,completed:feature.properties.completed,point:feature.geometry.coordinates.at(-1)!},
  ]);
  const approaches:IncidentFocusMap['approaches']=[];
  for(const route of review.mapOverlay.features){
    if(route.properties.plan!=='candidate'||!features.some(feature=>feature.properties.plan==='candidate'&&feature.properties.vehicle_id===route.properties.vehicle_id))continue;
    const stops=stopsByRoute[route.properties.route_id]?.toSorted((a,b)=>a.sequence_no-b.sequence_no);
    const index=stops?.findIndex(stop=>stop.stop_type==='HANDOVER'&&features.some(feature=>feature.properties.plan==='candidate'&&feature.properties.order_id===stop.order_id&&feature.properties.vehicle_id===route.properties.vehicle_id))??-1;
    if(index<0)continue;
    const end=route.properties.road_leg_end_indices?.[index];
    if(end===undefined)continue;
    const coordinates=route.geometry.coordinates.slice(0,end+1);
    if(coordinates.length<2)continue;
    const order_id=stops![index].order_id;
    approaches.push({type:'Feature',properties:{vehicle_id:route.properties.vehicle_id,order_id},geometry:{type:'LineString',coordinates}});
    nodes.push({order_id,vehicle_id:route.properties.vehicle_id,plan:'candidate',kind:'START',completed:false,point:coordinates[0]});
  }
  return {features,approaches,nodes,incidentPoint:review.mapOverlay.incidentPoint,hasCandidate:review.mapOverlay.hasCandidate,warnings:[]};
}

export async function loadIncidentFocusMap(review:IncidentReview,signal?:AbortSignal):Promise<IncidentFocusMap>{
  const originalRoutes=new Set(review.affectedOrders.map(order=>order.original_vehicle_route_id));
  const routes=review.mapOverlay.features.filter(route=>route.properties.plan==='candidate'||originalRoutes.has(route.properties.route_id));
  const responses=await Promise.allSettled(routes.map(route=>apiRead(`/vehicle-routes/${encodeURIComponent(route.properties.route_id)}/stops`,mapStops,signal)));
  if(signal?.aborted)throw new Error('Incident map loading was cancelled');
  const stopsByRoute:Record<string,MapStop[]>={};
  responses.forEach((response,index)=>{if(response.status==='fulfilled')stopsByRoute[routes[index].properties.route_id]=response.value;});
  const map=buildIncidentFocusMap({...review,mapOverlay:{...review.mapOverlay,features:routes}},stopsByRoute);
  const failed=responses.filter(response=>response.status==='rejected').length;
  if(failed)map.warnings.push(`${failed} route stop snapshots could not be loaded.`);
  if(review.affectedOrders.length&&!map.features.length)map.warnings.push('No verifiable OSRM path is available for the affected orders. No route is invented.');
  return map;
}

function makeMapOverlay(incident:z.infer<typeof incidentDetail>,baseRoutes:z.infer<typeof planRoute>[]|null,candidateRoutes:z.infer<typeof planRoute>[]|null,hasCandidate:boolean):IncidentMapOverlay{
  const features:IncidentMapFeature[]=[],missingPlans:('base'|'candidate')[]=[];
  for(const [plan,routes] of [['base',baseRoutes],...(hasCandidate?[['candidate',candidateRoutes]]:[])] as ['base'|'candidate',z.infer<typeof planRoute>[]|null][]){
    const valid=routes?.map(route=>routeFeature(route,plan)).filter((item):item is IncidentMapFeature=>item!==null)??[];
    features.push(...valid);
    if(!valid.length||valid.length!==(routes?.length??0))missingPlans.push(plan);
  }
  const location=incident.incident_location;
  const point=location&&validPoint([location.longitude,location.latitude])?[location.longitude,location.latitude] as [number,number]:null;
  return {features,incidentPoint:point,missingPlans,hasCandidate,orderSegmentsAvailable:false};
}

async function loadPlanRoutes(planId:string,signal?:AbortSignal):Promise<z.infer<typeof planRoute>[]|null>{
  try{
    const routes=await apiRead(`/delivery-plans/${encodeURIComponent(planId)}/routes`,z.array(planRoute),signal);
    if(routes.some(route=>route.delivery_plan_id!==planId))throw new Error('Route does not belong to its requested plan');
    return routes;
  }catch(error){
    if(error instanceof Error&&error.message==='Route does not belong to its requested plan')throw error;
    if(signal?.aborted)throw error;
    return null;
  }
}

export async function loadIncidentIndex(date:string,signal?:AbortSignal):Promise<IncidentIndexItem[]>{
  const path=`/incidents?business_date=${encodeURIComponent(date)}&page_size=100`;
  const first=await apiRead(`${path}&page=1`,page,signal),items=[...first.items];
  for(let number=2;number<=first.total_pages;number++)items.push(...(await apiRead(`${path}&page=${number}`,page,signal)).items);
  return items;
}

export async function loadIncidentIndexMap(items:Pick<IncidentIndexItem,'id'|'incident_code'>[],signal?:AbortSignal):Promise<IncidentIndexMap>{
  const result:IncidentIndexMap={features:[],incidents:[],warnings:[]};
  // Bound concurrent detail and stop requests when a business date has many Incidents.
  for(let offset=0;offset<items.length;offset+=4){
    const batch=await Promise.allSettled(items.slice(offset,offset+4).map(async item=>{
      const review=await loadIncidentReview(item.id,null,signal);
      const originalRoutes=new Set(review.affectedOrders.map(order=>order.original_vehicle_route_id));
      const routes=review.mapOverlay.features.filter(route=>route.properties.plan==='candidate'||originalRoutes.has(route.properties.route_id));
      const stopResults=await Promise.allSettled(routes.map(route=>apiRead(`/vehicle-routes/${encodeURIComponent(route.properties.route_id)}/stops`,mapStops,signal)));
      const stopsByRoute:Record<string,MapStop[]>={};
      stopResults.forEach((response,index)=>{
        if(response.status==='fulfilled')stopsByRoute[routes[index].properties.route_id]=response.value;
      });
      return {review,routes,stopsByRoute,failedStops:stopResults.filter(response=>response.status==='rejected').length};
    }));
    batch.forEach((response,index)=>{
      const item=items[offset+index];
      if(response.status==='rejected'){
        if(signal?.aborted)return;
        result.warnings.push(`${item.incident_code}: route context could not be loaded.`);
        return;
      }
      const {review,routes,stopsByRoute,failedStops}=response.value;
      if(review.mapOverlay.incidentPoint)result.incidents.push({id:item.id,code:item.incident_code,point:review.mapOverlay.incidentPoint});
      result.features.push(...buildAffectedOrderRoutes({...review,mapOverlay:{...review.mapOverlay,features:routes}},stopsByRoute));
      if(failedStops)result.warnings.push(`${item.incident_code}: ${failedStops} route stop snapshots could not be loaded.`);
    });
    if(signal?.aborted)break;
  }
  return result;
}

export async function loadIncidentReview(id:string,selectedAttemptId?:string|null,signal?:AbortSignal):Promise<IncidentReview>{
  const path=`/incidents/${encodeURIComponent(id)}`;
  const [incident,affectedOrders,attempts]=await Promise.all([
    apiRead(path,incidentDetail,signal),
    apiRead(`${path}/affected-orders`,z.array(affectedOrder),signal),
    apiRead(`${path}/recovery-plans`,z.array(attempt),signal),
  ]);
  attempts.sort((left,right)=>left.attempt_no-right.attempt_no);
  const selectedAttempt=attempts.find(item=>item.recovery_plan_id===selectedAttemptId)??attempts.at(-1)??null;
  const officialComparison=selectedAttempt?.candidate_delivery_plan_id
    ?await apiRead(`/recovery-plans/${encodeURIComponent(selectedAttempt.recovery_plan_id)}/comparison`,comparison,signal)
    :null;
  if(officialComparison&&(officialComparison.base_plan_id!==incident.base_delivery_plan_id||officialComparison.candidate_plan_id!==selectedAttempt?.candidate_delivery_plan_id||officialComparison.recovery_plan_id!==selectedAttempt?.recovery_plan_id))throw new Error('Recovery comparison does not match the selected Incident and Attempt');
  const [baseRoutes,candidateRoutes]=await Promise.all([
    loadPlanRoutes(incident.base_delivery_plan_id,signal),
    officialComparison?loadPlanRoutes(officialComparison.candidate_plan_id,signal):Promise.resolve(null),
  ]);
  return {incident,affectedOrders,attempts,selectedAttempt,comparison:officialComparison,mapOverlay:makeMapOverlay(incident,baseRoutes,candidateRoutes,Boolean(officialComparison))};
}
