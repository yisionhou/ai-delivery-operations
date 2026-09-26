import {z} from 'zod';
import type {Filter,Fleet,Vehicle,VehicleGateway,VehicleStop} from './vehicle-data';

// Verified against PenroseRoute/backend/app/{api/routes,schemas} on 2026-09-27.
export class VehicleApiError extends Error{constructor(public code:string,message:string,public status:number){super(message);}}
const envelope=z.object({success:z.boolean(),code:z.string(),message:z.string(),data:z.unknown()});
const pagination=<T extends z.ZodTypeAny>(item:T)=>z.object({items:z.array(item),page:z.number(),page_size:z.number(),total:z.number(),total_pages:z.number()});
const location=z.object({id:z.string(),display_name:z.string(),address_text:z.string().nullable(),latitude:z.number(),longitude:z.number()});
const resource=z.object({id:z.string(),vehicle_code:z.string(),name:z.string(),capacity_load_units:z.number(),status:z.enum(['AVAILABLE','ACTIVE','UNAVAILABLE']),current_location:location,current_location_recorded_at:z.string()});
const operation=z.object({vehicle_id:z.string(),driver_code:z.string(),route_id:z.string(),route_status:z.string()});
const incident=z.object({id:z.string(),incident_code:z.string(),vehicle_id:z.string().nullable(),vehicle_route_id:z.string().nullable(),business_date:z.string(),status:z.string(),detected_at:z.string()});
const order=z.object({id:z.string(),order_code:z.string(),pickup_location:location,delivery_location:location,execution_status:z.string(),risk_status:z.string(),business_date:z.string()});
const stop=z.object({id:z.string(),order_id:z.string(),location_id:z.string(),stop_type:z.enum(['PICKUP','DELIVERY','HANDOVER']),sequence_no:z.number(),status:z.enum(['PLANNED','ARRIVED','IN_SERVICE','COMPLETED']),planned_arrival_at:z.string(),planned_departure_at:z.string(),actual_arrival_at:z.string().nullable(),actual_departure_at:z.string().nullable()});
export async function apiRead<T>(path:string,schema:z.ZodType<T>,signal?:AbortSignal):Promise<T>{
  const response=await fetch('/api'+path,{signal,cache:'no-store'});
  const payload=envelope.safeParse(await response.json().catch(()=>null));
  if(!payload.success)throw new VehicleApiError('INVALID_RESPONSE','The service returned an unexpected response.',response.status);
  if(!response.ok||!payload.data.success)throw new VehicleApiError(payload.data.code,payload.data.message,response.status);
  const parsed=schema.safeParse(payload.data.data);
  if(!parsed.success)throw new VehicleApiError('CONTRACT_MISMATCH','The service response does not match the verified contract.',response.status);
  return parsed.data;
}
async function allPages<T>(path:string,schema:z.ZodType<T>,signal?:AbortSignal){
  const join=path.includes('?')?'&':'?';
  const first=await apiRead(path+join+'page=1&page_size=100',pagination(schema),signal);
  const items=[...first.items];
  for(let page=2;page<=first.total_pages;page++){const batch=await apiRead(path+join+`page=${page}&page_size=100`,pagination(schema),signal);items.push(...batch.items);}
  return items;
}
async function associations(date:string,signal?:AbortSignal){
  const [op,inc]=await Promise.allSettled([
    allPages('/operations/vehicles?business_date='+encodeURIComponent(date),operation,signal),
    allPages('/incidents?business_date='+encodeURIComponent(date)+'&incident_type=VEHICLE_UNAVAILABLE',incident,signal),
  ]);
  const noPlan=op.status==='rejected'&&op.reason instanceof VehicleApiError&&op.reason.code==='CURRENT_PLAN_NOT_FOUND';
  return {operations:op.status==='fulfilled'?op.value:[],incidents:inc.status==='fulfilled'?inc.value:[],hasCurrentPlan:op.status==='fulfilled'?true:noPlan?false:null,
    warnings:[...(op.status==='rejected'&&!noPlan?['Current-plan associations could not be loaded. Route assignments are unknown.']:[]),...(inc.status==='rejected'?['Incident links could not be loaded. Unavailable vehicles still open Incident context.']:[])]};
}
type Associations=Awaited<ReturnType<typeof associations>>;
function mapVehicle(v:z.infer<typeof resource>,a:Associations):Vehicle{
  const route=a.operations.find(r=>r.vehicle_id===v.id);
  // Do not bind a stale/resolved incident, an unrelated vehicle, or a previous route.
  const candidates=a.incidents.filter(i=>i.vehicle_id===v.id&&i.status!=='RESOLVED'&&(!route||i.vehicle_route_id===route.route_id));
  const linked=candidates.length===1?candidates[0]:null;
  return {id:v.id,code:v.vehicle_code,name:v.name,status:v.status,capacity:v.capacity_load_units,
    recordedLocation:[v.current_location.display_name,v.current_location.address_text,`${v.current_location.latitude}, ${v.current_location.longitude}`].filter(Boolean).join(' · '),
    recordedAt:v.current_location_recorded_at,driver:route?.driver_code??null,routeId:route?.route_id??null,routeStatus:route?.route_status??null,incidentId:linked?.id??null,associationError:a.hasCurrentPlan===null,planAvailable:a.hasCurrentPlan};
}
const statusFor={exception:'UNAVAILABLE',active:'ACTIVE',available:'AVAILABLE'} as const;
export const apiVehicleGateway:VehicleGateway={
  async loadFleet(date,signal,request={filter:'all',page:1,pageSize:8}){
    const statuses=['UNAVAILABLE','ACTIVE','AVAILABLE'] as const;
    const [totals,a]=await Promise.all([
      Promise.all(statuses.map(status=>apiRead(`/vehicles?status=${status}&page=1&page_size=1`,pagination(resource),signal))),
      associations(date,signal),
    ]);
    const counts={total:totals.reduce((n,r)=>n+r.total,0),exception:totals[0].total,active:totals[1].total,available:totals[2].total};
    const total=request.filter==='all'?counts.total:counts[request.filter];
    const page=Math.min(request.page,Math.max(1,Math.ceil(total/request.pageSize)));
    let skip=(page-1)*request.pageSize,remaining=request.pageSize;
    const selected:Vehicle[]=[];
    // Compose an exception-first logical page from real status-filtered server pages.
    // This does not download the resource collection or sort by changing percentages.
    const groups=request.filter==='all'?(['exception','active','available'] as const):[request.filter as Exclude<Filter,'all'>];
    for(const group of groups){
      const count=counts[group];if(skip>=count){skip-=count;continue;}
      const take=Math.min(remaining,count-skip),firstPage=Math.floor(skip/request.pageSize)+1;
      const batch=await apiRead(`/vehicles?status=${statusFor[group]}&page=${firstPage}&page_size=${request.pageSize}`,pagination(resource),signal);
      let rows=batch.items.slice(skip%request.pageSize,skip%request.pageSize+take);
      if(rows.length<take){const next=await apiRead(`/vehicles?status=${statusFor[group]}&page=${firstPage+1}&page_size=${request.pageSize}`,pagination(resource),signal);rows=[...rows,...next.items.slice(0,take-rows.length)];}
      selected.push(...rows.map(v=>mapVehicle(v,a)));remaining-=take;skip=0;if(remaining<=0)break;
    }
    return {source:'API',businessDate:date,hasCurrentPlan:a.hasCurrentPlan,vehicles:selected,warnings:a.warnings,pagination:{page,pageSize:request.pageSize,total,counts}} satisfies Fleet;
  },
  async loadVehicle(id,date,signal){
    try{const [v,a]=await Promise.all([apiRead('/vehicles/'+encodeURIComponent(id),resource,signal),associations(date,signal)]);return mapVehicle(v,a);}
    catch(error){if(error instanceof VehicleApiError&&error.status===404)return null;throw error;}
  },
  async loadStops(routeId,signal){
    const stops=await apiRead('/vehicle-routes/'+encodeURIComponent(routeId)+'/stops',z.array(stop),signal);
    const ids=[...new Set(stops.map(s=>s.order_id))];
    const orders=await Promise.allSettled(ids.map(id=>apiRead('/orders/'+encodeURIComponent(id),order,signal)));
    const locations=new Map<string,string>(),codes=new Map<string,string>();
    orders.forEach(result=>{if(result.status==='fulfilled'){const o=result.value;locations.set(o.pickup_location.id,o.pickup_location.display_name);locations.set(o.delivery_location.id,o.delivery_location.display_name);codes.set(o.id,o.order_code);}});
    return stops.sort((a,b)=>a.sequence_no-b.sequence_no).map(s=>({id:s.id,sequence:s.sequence_no,
      location:locations.get(s.location_id)??`Location ${s.location_id}`,kind:s.stop_type,orderId:s.order_id,orderCode:codes.get(s.order_id),status:s.status,
      plannedArrival:s.planned_arrival_at,plannedDeparture:s.planned_departure_at,actualArrival:s.actual_arrival_at,actualDeparture:s.actual_departure_at})) satisfies VehicleStop[];
  },
};
export const incidentContextSchema=incident.extend({base_plan_code:z.string(),affected_order_count:z.number(),requires_replanning:z.boolean()});
export const orderContextSchema=order;
