import {z} from 'zod';
import {apiRead,VehicleApiError} from '../vehicles/vehicle-api.ts';
import {executions,operationalClock,risks,type Filters,type Order,type Snapshot} from './order-data.ts';
import {DEMO_DATE,demoClock,demoOrders} from './order-demo.ts';
import {onlyOrderStops,type OrderDetail} from './order-detail.ts';
// Verified against PenroseRoute/backend/app/schemas/{resources,operations,common}.py, 2026-09-27.
const fact={order_code:z.string(),merchant_id:z.string(),execution_status:z.enum(executions),risk_status:z.enum(risks)};
const resource=z.object({...fact,id:z.string(),delivery_window_start_at:z.string().nullable(),delivery_window_end_at:z.string().nullable()});
const operation=z.object({...fact,order_id:z.string(),merchant_name:z.string(),assignment_status:z.string(),vehicle_id:z.string().nullable(),delivery_eta:z.string().nullable()});
const vehicle=z.object({vehicle_id:z.string(),vehicle_code:z.string()});
const detailLocation=z.object({id:z.string(),display_name:z.string(),address_text:z.string().nullable()});
const currentPlan=z.object({plan_code:z.string(),assignment_status:z.string(),vehicle_route_id:z.string().nullable(),route_no:z.number().nullable(),vehicle_id:z.string().nullable(),driver_id:z.string().nullable()});
const orderDetail=z.object({...fact,id:z.string(),business_date:z.string(),pickup_location:detailLocation,delivery_location:detailLocation,pickup_ready_at:z.string().nullable(),pickup_service_seconds:z.number(),delivery_window_start_at:z.string().nullable(),delivery_window_end_at:z.string().nullable(),delivery_service_seconds:z.number(),demand_load_units:z.number(),current_plan:currentPlan.nullable()});
const operationVehicle=vehicle.extend({driver_code:z.string(),route_id:z.string()});
const routeStop=z.object({id:z.string(),order_id:z.string(),location_id:z.string(),stop_type:z.enum(['PICKUP','HANDOVER','DELIVERY']),sequence_no:z.number(),status:z.string(),planned_arrival_at:z.string().nullable(),actual_arrival_at:z.string().nullable()});
const pagination=<T extends z.ZodTypeAny>(schema:T)=>z.object({items:z.array(schema),page:z.number().int().positive(),page_size:z.number().int().positive(),total:z.number().int().nonnegative(),total_pages:z.number().int().nonnegative()});
async function all<T>(path:string,schema:z.ZodType<T>,signal:AbortSignal){
  const first=await apiRead(path+'&page=1&page_size=100',pagination(schema),signal),items=[...first.items];
  for(let p=2;p<=first.total_pages;p++){const batch=await apiRead(path+`&page=${p}&page_size=100`,pagination(schema),signal);items.push(...batch.items);}
  return items;
}
export async function loadOrderPage(filters:Filters,page:number,pageSize:number,source:'api'|'demo',signal:AbortSignal):Promise<{items:Order[];page:number;total:number;totalPages:number}>{
  if(source==='demo'){
    const rows=demoOrders(filters.date).filter(o=>(filters.execution==='All'||o.execution===filters.execution)&&(filters.risk==='All'||o.risk===filters.risk)).sort((a,b)=>a.code.localeCompare(b.code));
    const total=rows.length,totalPages=Math.max(1,Math.ceil(total/pageSize)),currentPage=Math.min(page,totalPages);
    return {items:rows.slice((currentPage-1)*pageSize,currentPage*pageSize),page:currentPage,total,totalPages};
  }
  const query=new URLSearchParams({business_date:filters.date});
  if(filters.execution!=='All')query.set('execution_status',filters.execution);
  if(filters.risk!=='All')query.set('risk_status',filters.risk);
  const read=(number:number)=>apiRead(`/orders?${query}&page=${number}&page_size=${pageSize}`,pagination(resource),signal);
  const first=await read(page),totalPages=Math.max(1,first.total_pages);
  const result=page>totalPages&&first.total>0?await read(totalPages):first;
  return {items:result.items.map(r=>({id:r.id,code:r.order_code,merchant:`Merchant ${r.merchant_id}`,execution:r.execution_status,risk:r.risk_status,assignment:null,vehicle:null,eta:null,windowStart:r.delivery_window_start_at,windowEnd:r.delivery_window_end_at})),page:result.total===0?1:result.page,total:result.total,totalPages};
}
export async function loadOrders(filters:Filters,signal:AbortSignal):Promise<Snapshot>{
  const query=new URLSearchParams({business_date:filters.date});
  if(filters.execution!=='All')query.set('execution_status',filters.execution);
  const matchesRisk=(risk:string)=>filters.risk==='All'||risk===filters.risk;
  let ops:z.infer<typeof operation>[];
  try{ops=await all('/operations/orders?'+query,operation,signal);}
  catch(e){
    if(!(e instanceof VehicleApiError)||e.code!=='CURRENT_PLAN_NOT_FOUND')throw e;
    const rows=await all('/orders?'+query,resource,signal);
    return {source:'API',hasCurrentPlan:false,warnings:[],orders:rows.filter(r=>matchesRisk(r.risk_status)).map(r=>({id:r.id,code:r.order_code,merchant:`Merchant ${r.merchant_id}`,execution:r.execution_status,risk:r.risk_status,assignment:null,vehicle:null,eta:null,windowStart:r.delivery_window_start_at,windowEnd:r.delivery_window_end_at}))};
  }
  const clockStarted=performance.now();
  const [resources,vehicles]=await Promise.allSettled([all('/orders?'+query,resource,signal),all('/operations/vehicles?business_date='+encodeURIComponent(filters.date),vehicle,signal),
    apiRead('/operations/dashboard?business_date='+encodeURIComponent(filters.date),z.object({calculated_at:z.string().datetime({offset:true})}),signal).then(d=>{if(!signal.aborted)operationalClock.synchronize(d.calculated_at,clockStarted);}),
  ]);
  if(signal.aborted)throw new DOMException('Aborted','AbortError');
  const windows=new Map(resources.status==='fulfilled'?resources.value.map(r=>[r.id,r]):[]);
  const codes=new Map(vehicles.status==='fulfilled'?vehicles.value.map(v=>[v.vehicle_id,v.vehicle_code]):[]);
  // The risk rail follows persisted order status; operations risk is a time-based ETA projection.
  const orders=ops.map(o=>({id:o.order_id,code:o.order_code,merchant:o.merchant_name,execution:o.execution_status,risk:windows.get(o.order_id)?.risk_status??o.risk_status,assignment:o.assignment_status,vehicle:o.vehicle_id?(codes.get(o.vehicle_id)??`Vehicle ${o.vehicle_id}`):null,eta:o.delivery_eta,windowStart:windows.get(o.order_id)?.delivery_window_start_at??null,windowEnd:windows.get(o.order_id)?.delivery_window_end_at??null}));
  return {source:'API',hasCurrentPlan:true,warnings:[...(resources.status==='rejected'?['Order records could not be loaded. Delivery windows and persisted risk status are unavailable.']:[]),...(vehicles.status==='rejected'?['Vehicle codes could not be loaded. Assigned vehicle IDs remain available.']:[])],orders:orders.filter(o=>matchesRisk(o.risk))};
}
// Explicit separate fixtures, never an automatic fallback after API errors.
export async function loadDemo(filters:Filters,signal:AbortSignal):Promise<Snapshot>{
  await new Promise<void>((resolve,reject)=>{const t=setTimeout(resolve,250);signal.addEventListener('abort',()=>{clearTimeout(t);reject(new DOMException('Aborted','AbortError'));},{once:true});});
  operationalClock.demo(demoClock(filters.date));
  const hasCurrentPlan=filters.date===DEMO_DATE;
  const orders=demoOrders(filters.date);
  return {source:'DEMO',hasCurrentPlan,warnings:[],orders:orders.filter(o=>(filters.execution==='All'||o.execution===filters.execution)&&(filters.risk==='All'||o.risk===filters.risk))};
}

export async function loadOrderDetail(id:string,date:string,listOrder:Order|null,signal:AbortSignal):Promise<OrderDetail>{
  const raw=await apiRead('/orders/'+encodeURIComponent(id),orderDetail,signal);
  const routeId=raw.current_plan?.vehicle_route_id??null;
  const [merchant,vehicles,stops]=await Promise.all([
    apiRead('/merchants/'+encodeURIComponent(raw.merchant_id),z.object({name:z.string()}),signal),
    routeId?all('/operations/vehicles?business_date='+encodeURIComponent(date),operationVehicle,signal):Promise.resolve([]),
    routeId?apiRead('/vehicle-routes/'+encodeURIComponent(routeId)+'/stops',z.array(routeStop),signal):Promise.resolve([]),
  ]);
  const matched=vehicles.find(v=>v.route_id===routeId&&v.vehicle_id===raw.current_plan?.vehicle_id);
  const ordered=onlyOrderStops(stops,id);
  const order:Order={id:raw.id,code:raw.order_code,merchant:merchant.name,execution:raw.execution_status,risk:raw.risk_status,assignment:raw.current_plan?.assignment_status??null,vehicle:matched?.vehicle_code??(listOrder?.id===id?listOrder.vehicle:null)??(raw.current_plan?.vehicle_id?`Vehicle ${raw.current_plan.vehicle_id}`:null),eta:listOrder?.id===id?listOrder.eta:null,windowStart:raw.delivery_window_start_at,windowEnd:raw.delivery_window_end_at};
  return {order,businessDate:raw.business_date,merchantId:raw.merchant_id,
    pickup:{id:raw.pickup_location.id,name:raw.pickup_location.display_name,address:raw.pickup_location.address_text},
    delivery:{id:raw.delivery_location.id,name:raw.delivery_location.display_name,address:raw.delivery_location.address_text},
    readyAt:raw.pickup_ready_at,pickupServiceSeconds:raw.pickup_service_seconds,deliveryServiceSeconds:raw.delivery_service_seconds,demand:raw.demand_load_units,
    planCode:raw.current_plan?.plan_code??null,routeId,routeNo:raw.current_plan?.route_no??null,vehicleId:raw.current_plan?.vehicle_id??null,driverCode:matched?.driver_code??null,
    stops:ordered.map(stop=>({id:stop.id,kind:stop.stop_type,location:stop.stop_type==='HANDOVER'?'Handover location not supplied':stop.location_id===raw.pickup_location.id?raw.pickup_location.display_name:stop.location_id===raw.delivery_location.id?raw.delivery_location.display_name:'Location not supplied',planned:stop.planned_arrival_at,actual:stop.actual_arrival_at,status:stop.status})),
  };
}
