import {z} from 'zod';
import {apiRead,VehicleApiError} from '../vehicles/vehicle-api.ts';

const counts=z.object({total:z.number(),completed:z.number(),in_progress:z.number(),at_risk:z.number()});
const resources=z.object({available:z.number(),active:z.number(),unavailable:z.number()});
const region=z.object({region:z.string(),orders:z.number(),completed:z.number(),at_risk:z.number(),vehicles:z.number(),routes:z.number(),on_time_rate:z.number().nullable()});
const dashboardSchema=z.object({current_plan:z.object({delivery_plan_id:z.string(),plan_code:z.string(),version_no:z.number()}),orders:counts,vehicles:resources,drivers:resources,merchants:z.object({ready:z.number(),preparing:z.number(),delayed:z.number()}),open_incidents:z.number(),pending_recovery_reviews:z.number(),calculated_at:z.string(),on_time:z.object({on_time_deliveries:z.number(),measured_deliveries:z.number(),rate:z.number().nullable()}).optional(),regions:z.array(region).optional(),trends:z.object({comparison_business_date:z.string().nullable(),orders_delta:z.number().nullable(),vehicles_delta:z.number().nullable(),on_time_rate_delta_points:z.number().nullable(),open_incidents_delta:z.number().nullable()}).optional()});
const vehicleSchema=z.object({vehicle_id:z.string(),vehicle_code:z.string(),vehicle_status:z.string(),driver_code:z.string(),route_id:z.string(),route_status:z.string()});
const routeSchema=z.object({route_id:z.string(),route_no:z.number(),vehicle_id:z.string(),status:z.string(),completed_stops:z.number(),total_stops:z.number(),at_risk_orders:z.number()});
const incidentSchema=z.object({id:z.string(),incident_code:z.string(),incident_type:z.string(),status:z.string(),base_delivery_plan_id:z.string(),vehicle_id:z.string().nullable(),merchant_id:z.string().nullable(),detected_at:z.string(),business_date:z.string()});
const positionSchema=z.object({delivery_plan_id:z.string(),business_date:z.string(),generated_at:z.string(),cycle_seconds:z.number(),vehicles:z.array(z.object({vehicle_id:z.string(),vehicle_code:z.string(),route_id:z.string(),latitude:z.number(),longitude:z.number(),motion:z.string(),source:z.literal('SIMULATED')}))});
const page=<T extends z.ZodTypeAny>(item:T)=>z.object({items:z.array(item),total_pages:z.number()});

export type OverviewDashboard=z.infer<typeof dashboardSchema>;
export type OverviewVehicle=z.infer<typeof vehicleSchema>;
export type OverviewRoute=z.infer<typeof routeSchema>;
export type OverviewIncident=z.infer<typeof incidentSchema>;
export type OverviewPositions=z.infer<typeof positionSchema>;
export type OverviewSnapshot={dashboard:OverviewDashboard;vehicles:OverviewVehicle[]|null;routes:OverviewRoute[]|null;incidents:OverviewIncident[]|null;positions:OverviewPositions|null;warnings:string[]};

async function allPages<T extends z.ZodTypeAny>(path:string,schema:T,signal?:AbortSignal):Promise<z.infer<T>[]>{
  const result:z.infer<T>[]=[];
  for(let index=1;;index++){
    const data=await apiRead(`${path}&page=${index}&page_size=100`,page(schema),signal);
    result.push(...data.items);
    if(index>=data.total_pages)break;
  }
  return result;
}

export function loadPositions(date:string,signal?:AbortSignal){return apiRead(`/operations/simulated-positions?business_date=${encodeURIComponent(date)}`,positionSchema,signal);}

export function overviewErrorMessage(error:unknown,date:string):string{
  if(error instanceof VehicleApiError&&error.code==='CURRENT_PLAN_NOT_FOUND')
    return `No Current delivery plan for ${date}. Orders may exist, but the Operations dashboard requires a Current plan.`;
  return error instanceof Error?error.message:'Overview data could not be loaded.';
}

export async function loadOverview(date:string,signal?:AbortSignal):Promise<OverviewSnapshot>{
  const query=`business_date=${encodeURIComponent(date)}`;
  const dashboard=await apiRead(`/operations/dashboard?${query}`,dashboardSchema,signal);
  const [vehicles,routes,incidents,positions]=await Promise.allSettled([
    allPages(`/operations/vehicles?${query}`,vehicleSchema,signal),
    allPages(`/operations/routes?${query}`,routeSchema,signal),
    allPages(`/incidents?${query}`,incidentSchema,signal),
    loadPositions(date,signal),
  ]);
  if(signal?.aborted)throw signal.reason;
  const warnings=[vehicles,routes,incidents,positions].flatMap((result,index)=>result.status==='rejected'?[`${['Vehicle list','Route progress','Incident list','Simulated positions'][index]} unavailable: ${result.reason instanceof Error?result.reason.message:'Request failed'}`]:[]);
  return {dashboard,vehicles:vehicles.status==='fulfilled'?vehicles.value:null,routes:routes.status==='fulfilled'?routes.value:null,incidents:incidents.status==='fulfilled'?incidents.value.filter(item=>item.base_delivery_plan_id===dashboard.current_plan.delivery_plan_id):null,positions:positions.status==='fulfilled'&&positions.value.delivery_plan_id===dashboard.current_plan.delivery_plan_id?positions.value:null,warnings};
}
