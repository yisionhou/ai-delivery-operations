import {z} from 'zod';

// View-domain contract, NOT an assumed PenroseRoute wire format.
const vehicleSchema=z.object({id:z.string(),code:z.string(),name:z.string().nullable(),status:z.enum(['ACTIVE','AVAILABLE','UNAVAILABLE']),capacity:z.number().nullable(),recordedLocation:z.string().nullable(),recordedAt:z.string().nullable(),incidentId:z.string().nullable(),driver:z.string().nullable(),routeId:z.string().nullable(),routeStatus:z.string().nullable(),associationError:z.boolean().optional(),planAvailable:z.boolean().nullable().optional()});
const stopSchema=z.object({id:z.string(),sequence:z.number(),location:z.string(),kind:z.enum(['PICKUP','DELIVERY','HANDOVER']),orderId:z.string().nullable(),orderCode:z.string().optional(),status:z.enum(['WAITING','IN_PROGRESS','PLANNED','ARRIVED','IN_SERVICE','COMPLETED']),plannedArrival:z.string().nullable(),plannedDeparture:z.string().nullable(),actualArrival:z.string().nullable(),actualDeparture:z.string().nullable()});
const fleetSchema=z.object({source:z.literal('DEMO'),businessDate:z.string(),hasCurrentPlan:z.boolean(),vehicles:z.array(vehicleSchema)});
const DEMO_LIVE_ROUTE='R-01-LIVE';
const demoClockStart=Date.now();
export const DEMO_DATE=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Singapore',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(demoClockStart));
export type Vehicle=z.infer<typeof vehicleSchema>;
export type VehicleStop=z.infer<typeof stopSchema>;
export type Fleet={source:'DEMO'|'API';businessDate:string;hasCurrentPlan:boolean|null;vehicles:Vehicle[];warnings?:string[];pagination?:{page:number;pageSize:number;total:number;counts:{total:number;active:number;available:number;exception:number}}};
export type Filter='all'|'active'|'available'|'exception';
export type StopResult={stops:VehicleStop[];error?:string};
export interface VehicleGateway {
  loadFleet(date:string,signal?:AbortSignal,request?:{filter:Filter;page:number;pageSize:number}):Promise<Fleet>;
  loadVehicle(id:string,date:string,signal?:AbortSignal):Promise<Vehicle|null>;
  loadStops(routeId:string,signal?:AbortSignal):Promise<VehicleStop[]>;
}
async function readFixture(path:string,signal?:AbortSignal){
  const response=await fetch(path,{signal,cache:'no-store'});
  if(!response.ok)throw new Error(`Demo data could not be loaded (${response.status}).`);
  return response.json();
}
// Explicit local demo adapter; the separate vehicle-api adapter uses verified backend contracts.
export const demoVehicleGateway:VehicleGateway={
  async loadFleet(date,signal){
    const fleet=fleetSchema.parse(await readFixture('/data/vehicles-demo.json',signal));
    const hasCurrentPlan=fleet.hasCurrentPlan&&(date===DEMO_DATE||date===fleet.businessDate);
    return {...fleet,businessDate:date,hasCurrentPlan,vehicles:fleet.vehicles.map(vehicle=>hasCurrentPlan?{...vehicle,routeId:date===DEMO_DATE&&vehicle.id==='V01'?DEMO_LIVE_ROUTE:vehicle.routeId,planAvailable:true}:{...vehicle,planAvailable:false,driver:null,routeId:null,routeStatus:null})};
  },
  async loadVehicle(id,date,signal){return (await this.loadFleet(date,signal)).vehicles.find(vehicle=>vehicle.id===id)??null;},
  async loadStops(routeId,signal){
    const routes=z.record(z.array(stopSchema)).parse(await readFixture('/data/vehicle-stops-demo.json',signal));
    const stops=routes[routeId===DEMO_LIVE_ROUTE?'R-01':routeId];
    if(!stops)throw new Error('Route stops are unavailable.');
    if(routeId===DEMO_LIVE_ROUTE&&stops.length!==3)throw new Error('Live demo route requires three stops.');
    return [...stops].sort((a,b)=>a.sequence-b.sequence).map((stop,index)=>routeId===DEMO_LIVE_ROUTE?{...stop,plannedArrival:new Date(demoClockStart+[-60000,-15000,120000][index]).toISOString()}:stop);
  },
};
export const groupOf=(vehicle:Vehicle):Exclude<Filter,'all'>=>vehicle.status==='UNAVAILABLE'?'exception':vehicle.status==='AVAILABLE'?'available':'active';
export function progress(stops:VehicleStop[]){const completed=stops.filter(stop=>stop.status==='COMPLETED').length;return {completed,total:stops.length,remaining:stops.length-completed,percent:stops.length?Math.round(completed/stops.length*100):null,finished:stops.length>0&&completed===stops.length};}
export const currentStop=(stops:VehicleStop[])=>stops.find(stop=>['IN_PROGRESS','ARRIVED','IN_SERVICE'].includes(stop.status))??stops.find(stop=>stop.status!=='COMPLETED')??null;
export const stableVehicles=(vehicles:Vehicle[])=>[...vehicles].sort((a,b)=>a.code.localeCompare(b.code,undefined,{numeric:true})||a.id.localeCompare(b.id));
export function incidentDestination(vehicle:Vehicle,query:string){return `/incidents?${query}&vehicle_id=${encodeURIComponent(vehicle.id)}${vehicle.incidentId?`&incident_id=${encodeURIComponent(vehicle.incidentId)}`:''}`;}
export function contextQuery(date:string,filter:Filter,page:number,source='api'){return new URLSearchParams({business_date:date,filter,page:String(page),source}).toString();}
export function readContext(params:URLSearchParams){const source=params.get('source')==='demo'?'demo':'api';const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Singapore',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());const date=params.get('business_date')??(source==='demo'?DEMO_DATE:today);const filter=params.get('filter')??'all';const page=Number(params.get('page')??1);return {source,date:/^\d{4}-\d{2}-\d{2}$/.test(date)?date:DEMO_DATE,filter:(['all','active','available','exception'].includes(filter)?filter:'all') as Filter,page:Number.isSafeInteger(page)&&page>0?page:1};}

export function displayTime(value:string|null){if(!value)return "—";if(!value.includes("T"))return value;const date=new Date(value);return Number.isNaN(date.getTime())?"—":new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Singapore",hour:"2-digit",minute:"2-digit",hour12:false}).format(date);}

