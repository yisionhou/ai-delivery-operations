import {z} from 'zod';
import type {Coordinate,OperationsAdapter,OperationsSnapshot,Stop} from './operations-data';
import {apiRead,VehicleApiError} from '../vehicles/vehicle-api.ts';

const point=z.tuple([z.number(),z.number()]);
const stop=z.object({id:z.string(),kind:z.enum(['PICKUP','DELIVERY','HANDOVER']),order:z.string(),place:z.string(),at:z.string(),point,execution:z.enum(['PLANNED','ARRIVED','IN_SERVICE','COMPLETED']),risk:z.enum(['NORMAL','AT_RISK'])});
const route=z.object({id:z.string(),route_no:z.number(),vehicle:z.string(),driver:z.string(),vehicle_status:z.enum(['AVAILABLE','ACTIVE','UNAVAILABLE']),route_execution_status:z.enum(['PLANNED','ACTIVE','COMPLETED','CANCELLED']),distance_km:z.number(),duration_min:z.number(),utilization:z.number(),status:z.enum(['PLANNED','ON_ROUTE','AT_RISK','UNAVAILABLE','COMPLETED','CANCELLED']),stops:z.array(stop),path:z.array(point),geometry_source:z.enum(['STORED_GEOMETRY','STOP_CONNECTORS'])});
const workspace=z.object({business_date:z.string(),readiness:z.object({orders:z.number(),merchants_ready:z.number(),merchants_preparing:z.number(),merchants_delayed:z.number(),vehicles:z.number(),drivers:z.number()}),plan:z.object({id:z.string(),code:z.string(),version:z.number(),status:z.enum(['DRAFT','CURRENT'])}).nullable(),routes:z.array(route),alerts:z.array(z.object({id:z.string(),title:z.string(),detail:z.string(),level:z.enum(['risk','incident']),incident_id:z.string().nullable(),vehicle:z.string()})),unassigned:z.array(z.object({order:z.string(),reason:z.string()})),on_time_rate:z.number().nullable(),constraint_summary:z.array(z.string())});
const position=z.object({route_id:z.string(),longitude:z.number(),latitude:z.number()});
const positions=z.object({vehicles:z.array(position)});
const envelope=z.object({success:z.boolean(),code:z.string(),message:z.string(),data:z.unknown()});

function firstDeliveryIndex(path:Coordinate[],stops:z.infer<typeof stop>[]):number{
  const first=stops.find(item=>item.kind==='DELIVERY');
  if(!first)return Math.max(0,path.length-1);
  let nearest=0,distance=Infinity;
  path.forEach((point,index)=>{const next=(point[0]-first.point[0])**2+(point[1]-first.point[1])**2;if(next<distance){distance=next;nearest=index;}});
  return nearest;
}
export function mapWorkspace(data:z.infer<typeof workspace>):OperationsSnapshot{
  return {source:'API',businessDate:data.business_date,plan:data.plan,routes:data.routes.map(item=>({
    id:item.id,vehicle:item.vehicle,driver:item.driver,distanceKm:item.distance_km,durationMin:item.duration_min,utilization:item.utilization,status:item.status,vehicleStatus:item.vehicle_status,routeExecutionStatus:item.route_execution_status,
    path:item.path,geometrySource:item.geometry_source,firstDeliveryPathIndex:firstDeliveryIndex(item.path,item.stops),
    stops:item.stops.map(s=>({id:s.id,kind:s.kind,order:s.order,place:s.place,at:new Intl.DateTimeFormat('en-SG',{timeZone:'Asia/Singapore',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(s.at)),point:s.point,execution:s.execution==='COMPLETED'?'COMPLETED':s.execution==='ARRIVED'||s.execution==='IN_SERVICE'?'IN_PROGRESS':'WAITING',risk:s.risk} satisfies Stop)),
  })),alerts:data.alerts.map(item=>({id:item.id,title:item.title,detail:item.detail,level:item.level,incidentId:item.incident_id??undefined,vehicle:item.vehicle})),
  readiness:{orders:data.readiness.orders,merchantsReady:data.readiness.merchants_ready,merchantsPreparing:data.readiness.merchants_preparing,merchantsDelayed:data.readiness.merchants_delayed,vehicles:data.readiness.vehicles,drivers:data.readiness.drivers},
  unassigned:data.unassigned,constraintSummary:data.constraint_summary,onTimeRate:data.on_time_rate};
}

async function post(path:string,body?:object){
  const response=await fetch('/api'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body??{}),cache:'no-store'});
  const parsed=envelope.safeParse(await response.json().catch(()=>null));
  if(!parsed.success)throw new VehicleApiError('INVALID_RESPONSE','The service returned an unexpected response.',response.status);
  if(!response.ok||!parsed.data.success)throw new VehicleApiError(parsed.data.code,parsed.data.message,response.status);
  return parsed.data.data;
}
export async function loadOperations(date:string,signal?:AbortSignal):Promise<OperationsSnapshot>{
  const data=await apiRead(`/operations/workspace?business_date=${encodeURIComponent(date)}`,workspace,signal);
  return mapWorkspace(data);
}
export async function loadOperationsPositions(date:string,signal?:AbortSignal):Promise<Record<string,Coordinate>>{
  const data=await apiRead(`/operations/simulated-positions?business_date=${encodeURIComponent(date)}`,positions,signal);
  return Object.fromEntries(data.vehicles.map(item=>[item.route_id,[item.longitude,item.latitude] as Coordinate]));
}
export const apiOperationsAdapter:OperationsAdapter={
  load:(date,signal)=>{if(!date)throw new Error('A business date is required for backend Operations.');return loadOperations(date,signal);},
  async generate(snapshot){await post('/planning/drafts',{business_date:snapshot.businessDate});return loadOperations(snapshot.businessDate);},
  async confirm(snapshot){if(!snapshot.plan||snapshot.plan.status!=='DRAFT')throw new Error('Generate and review a draft first.');await post(`/planning/drafts/${encodeURIComponent(snapshot.plan.id)}/confirm`);return loadOperations(snapshot.businessDate);},
};
