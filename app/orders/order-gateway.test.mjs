import test from 'node:test';
import assert from 'node:assert/strict';
import {loadOrderDetail} from './order-gateway.ts';

const id='00000000-0000-4000-8000-000000000001';
const route='00000000-0000-4000-8000-000000000002';
const merchant='00000000-0000-4000-8000-000000000003';
const vehicle='00000000-0000-4000-8000-000000000004';
const location=(id,name)=>({id,display_name:name,address_text:null,latitude:1.3,longitude:103.8});
const resource={id,order_code:'O-021',business_date:'2026-09-27',merchant_id:merchant,customer_id:id,pickup_location:location('pickup','Fresh Kitchen'),delivery_location:location('delivery','Queenstown'),pickup_ready_at:'2026-09-27T04:10:00+08:00',pickup_service_seconds:120,delivery_window_start_at:'2026-09-27T04:10:00+08:00',delivery_window_end_at:'2026-09-27T04:42:00+08:00',delivery_service_seconds:120,demand_load_units:1,execution_status:'DELIVERING',risk_status:'AT_RISK',current_plan:{delivery_plan_id:id,plan_code:'PLAN-1',assignment_status:'ACTIVE',vehicle_route_id:route,route_no:1,vehicle_id:vehicle,driver_id:id}};
const stops=[{id:'pickup-stop',order_id:id,location_id:'pickup',stop_type:'PICKUP',sequence_no:1,status:'COMPLETED',planned_arrival_at:'2026-09-27T04:12:00+08:00',actual_arrival_at:'2026-09-27T04:12:00+08:00'},{id:'other-order',order_id:'other',location_id:'delivery',stop_type:'DELIVERY',sequence_no:2,status:'PLANNED',planned_arrival_at:'2026-09-27T04:30:00+08:00',actual_arrival_at:null},{id:'handover-stop',order_id:id,location_id:'pickup',stop_type:'HANDOVER',sequence_no:3,status:'PLANNED',planned_arrival_at:'2026-09-27T04:32:00+08:00',actual_arrival_at:null},{id:'delivery-stop',order_id:id,location_id:'delivery',stop_type:'DELIVERY',sequence_no:4,status:'PLANNED',planned_arrival_at:'2026-09-27T04:47:00+08:00',actual_arrival_at:null}];

test('detail reads verified resources and shows only selected order stops',async()=>{
  const original=globalThis.fetch,calls=[];
  let operationVehicles=[{vehicle_id:vehicle,vehicle_code:'V01',driver_code:'D-01',route_id:route}];
  globalThis.fetch=async(url,options={})=>{
    calls.push({url,method:options.method??'GET'});
    const data=url===`/api/orders/${id}`?resource:url===`/api/merchants/${merchant}`?{name:'Fresh Kitchen'}:url.startsWith('/api/operations/vehicles?')?{items:operationVehicles,page:1,page_size:100,total:operationVehicles.length,total_pages:1}:url===`/api/vehicle-routes/${route}/stops`?stops:undefined;
    assert.notEqual(data,undefined,`Unexpected request ${url}`);
    return {ok:true,status:200,json:async()=>({success:true,code:'OK',message:'ok',data})};
  };
  try{
    const detail=await loadOrderDetail(id,'2026-09-27',null,new AbortController().signal);
    assert.equal(detail.order.code,'O-021');
    assert.equal(detail.driverCode,'D-01');
    assert.equal(detail.planCode,'PLAN-1');
    assert.deepEqual(detail.stops.map(stop=>stop.kind),['PICKUP','HANDOVER','DELIVERY']);
    assert.equal(detail.stops[1].location,'Handover location not supplied');
    assert.equal(detail.stops[2].actual,null);
    assert.deepEqual(calls.map(call=>call.method),['GET','GET','GET','GET']);
    operationVehicles=[];
    const withoutCode=await loadOrderDetail(id,'2026-09-27',null,new AbortController().signal);
    assert.match(withoutCode.order.vehicle,new RegExp(vehicle));
  }finally{globalThis.fetch=original;}
});
