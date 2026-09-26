import {z} from 'zod';
import {apiRead,VehicleApiError} from '../vehicles/vehicle-api';
import {executions,operationalClock,risks,type Filters,type Order,type Snapshot} from './order-data';
// Verified against PenroseRoute/backend/app/schemas/{resources,operations,common}.py, 2026-09-27.
const fact={order_code:z.string(),merchant_id:z.string(),execution_status:z.enum(executions),risk_status:z.enum(risks)};
const resource=z.object({...fact,id:z.string(),delivery_window_start_at:z.string().nullable(),delivery_window_end_at:z.string().nullable()});
const operation=z.object({...fact,order_id:z.string(),merchant_name:z.string(),assignment_status:z.string(),vehicle_id:z.string().nullable(),delivery_eta:z.string().nullable()});
const vehicle=z.object({vehicle_id:z.string(),vehicle_code:z.string()});
const pagination=<T extends z.ZodTypeAny>(schema:T)=>z.object({items:z.array(schema),page:z.number().int().positive(),page_size:z.number().int().positive(),total:z.number().int().nonnegative(),total_pages:z.number().int().nonnegative()});
async function all<T>(path:string,schema:z.ZodType<T>,signal:AbortSignal){
  const first=await apiRead(path+'&page=1&page_size=100',pagination(schema),signal),items=[...first.items];
  for(let p=2;p<=first.total_pages;p++){const batch=await apiRead(path+`&page=${p}&page_size=100`,pagination(schema),signal);items.push(...batch.items);}
  return items;
}
export async function loadOrders(filters:Filters,signal:AbortSignal):Promise<Snapshot>{
  const query=new URLSearchParams({business_date:filters.date});
  if(filters.execution!=='All')query.set('execution_status',filters.execution);
  if(filters.risk!=='All')query.set('risk_status',filters.risk);
  let ops:z.infer<typeof operation>[];
  try{ops=await all('/operations/orders?'+query,operation,signal);}
  catch(e){
    if(!(e instanceof VehicleApiError)||e.code!=='CURRENT_PLAN_NOT_FOUND')throw e;
    const rows=await all('/orders?'+query,resource,signal);
    return {source:'API',hasCurrentPlan:false,warnings:[],orders:rows.map(r=>({id:r.id,code:r.order_code,merchant:`Merchant ${r.merchant_id}`,execution:r.execution_status,risk:r.risk_status,assignment:null,vehicle:null,eta:null,windowStart:r.delivery_window_start_at,windowEnd:r.delivery_window_end_at}))};
  }
  const clockStarted=performance.now();
  const [resources,vehicles]=await Promise.allSettled([all('/orders?'+query,resource,signal),all('/operations/vehicles?business_date='+encodeURIComponent(filters.date),vehicle,signal),
    apiRead('/operations/dashboard?business_date='+encodeURIComponent(filters.date),z.object({calculated_at:z.string().datetime({offset:true})}),signal).then(d=>{if(!signal.aborted)operationalClock.synchronize(d.calculated_at,clockStarted);}),
  ]);
  if(signal.aborted)throw new DOMException('Aborted','AbortError');
  const windows=new Map(resources.status==='fulfilled'?resources.value.map(r=>[r.id,r]):[]);
  const codes=new Map(vehicles.status==='fulfilled'?vehicles.value.map(v=>[v.vehicle_id,v.vehicle_code]):[]);
  return {source:'API',hasCurrentPlan:true,warnings:[...(resources.status==='rejected'?['Delivery windows could not be loaded. Time critical orders are unavailable.']:[]),...(vehicles.status==='rejected'?['Vehicle codes could not be loaded. Assigned vehicle IDs remain available.']:[])],orders:ops.map(o=>({id:o.order_id,code:o.order_code,merchant:o.merchant_name,execution:o.execution_status,risk:o.risk_status,assignment:o.assignment_status,vehicle:o.vehicle_id?(codes.get(o.vehicle_id)??`Vehicle ${o.vehicle_id}`):null,eta:o.delivery_eta,windowStart:windows.get(o.order_id)?.delivery_window_start_at??null,windowEnd:windows.get(o.order_id)?.delivery_window_end_at??null}))};
}
// Explicit separate fixtures, never an automatic fallback after API errors.
let demoStart:number|undefined;
export async function loadDemo(filters:Filters,signal:AbortSignal):Promise<Snapshot>{
  await new Promise<void>((resolve,reject)=>{const t=setTimeout(resolve,250);signal.addEventListener('abort',()=>{clearTimeout(t);reject(new DOMException('Aborted','AbortError'));},{once:true});});
  demoStart??=Date.now();
  const hasCurrentPlan=filters.date===new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Singapore',year:'numeric',month:'2-digit',day:'2-digit'}).format(demoStart);
  const anchor=hasCurrentPlan?demoStart:Date.parse(filters.date+'T14:00:00+08:00');
  const names=['Fresh Kitchen','River Bento','The Daily Grind','Maple & Co.','Luna Patisserie','Green Market'];
  const orders:Order[]=Array.from({length:32},(_,i)=>{const end=new Date(anchor+(i<8?-2+i:i<16?i-7:20+i)*60000).toISOString();return {id:`O-${String(i+21).padStart(3,'0')}`,code:`O-${String(i+21).padStart(3,'0')}`,merchant:names[i%names.length],execution:executions[i%executions.length],risk:i<8?'AT_RISK':'NORMAL',assignment:hasCurrentPlan?'ASSIGNED':null,vehicle:hasCurrentPlan?`V0${i%7+1}`:null,eta:hasCurrentPlan?new Date(anchor+(i+1)*60000).toISOString():null,windowStart:new Date(Date.parse(end)-1800000).toISOString(),windowEnd:end};});
  return {source:'DEMO',hasCurrentPlan,warnings:[],orders:orders.filter(o=>(filters.execution==='All'||o.execution===filters.execution)&&(filters.risk==='All'||o.risk===filters.risk))};
}
