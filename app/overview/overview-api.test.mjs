import assert from 'node:assert/strict';
import {test} from 'node:test';
import {loadOverview,loadPositions,overviewErrorMessage} from './overview-api.ts';
import {overviewMetrics,overviewVehicles} from './overview-model.ts';
import {GET} from '../api/[...path]/route.ts';

const dashboard={current_plan:{delivery_plan_id:'P1',plan_code:'PLAN-1',version_no:2},orders:{total:8,completed:3,in_progress:4,at_risk:2},vehicles:{available:1,active:2,unavailable:1},drivers:{available:1,active:2,unavailable:1},merchants:{ready:2,preparing:1,delayed:0},open_incidents:1,pending_recovery_reviews:1,calculated_at:'2026-09-27T02:00:00Z',on_time:{on_time_deliveries:2,measured_deliveries:3,rate:66.7},regions:[{region:'WEST REGION',orders:5,completed:2,at_risk:1,vehicles:2,routes:2,on_time_rate:50}],trends:{comparison_business_date:'2026-09-26',orders_delta:2,vehicles_delta:1,on_time_rate_delta_points:16.7,open_incidents_delta:-1}};
const vehicle={vehicle_id:'V1',vehicle_code:'V01',vehicle_status:'ACTIVE',current_location_id:'L1',driver_id:'D1',driver_code:'D-01',driver_status:'ACTIVE',route_id:'R1',route_status:'ACTIVE'};
const route={route_id:'R1',route_no:1,vehicle_id:'V1',driver_id:'D1',status:'ACTIVE',completed_stops:1,total_stops:3,current_stop_id:'S1',current_stop_type:'PICKUP',next_stop_id:'S2',next_stop_type:'DELIVERY',next_stop_eta:'2026-09-27T10:20:00+08:00',eta_deviation_seconds:0,at_risk_orders:0};
const incident={id:'I1',incident_code:'INC-1',incident_type:'VEHICLE_UNAVAILABLE',status:'REVIEW',business_date:'2026-09-27',base_delivery_plan_id:'P1',vehicle_route_id:'R1',vehicle_id:'V1',merchant_id:null,detected_at:'2026-09-27T01:59:00Z'};
const position={delivery_plan_id:'P1',business_date:'2026-09-27',generated_at:'2026-09-27T02:00:00Z',simulated_at:'2026-09-27T02:00:00Z',cycle_seconds:120,vehicles:[{vehicle_id:'V1',vehicle_code:'V01',route_id:'R1',route_no:1,latitude:1.31,longitude:103.81,motion:'MOVING',next_stop_id:'S2',path:[[103.80,1.30],[103.82,1.32]],source:'SIMULATED'}]};
const page=items=>({items,page:1,page_size:100,total:items.length,total_pages:1});
test('overview reads verified backend contracts without demo substitutions',async()=>{
  const original=globalThis.fetch,calls=[];
  const responses={'/api/operations/dashboard?business_date=2026-09-27':dashboard,'/api/operations/vehicles?business_date=2026-09-27&page=1&page_size=100':page([vehicle]),'/api/operations/routes?business_date=2026-09-27&page=1&page_size=100':page([route]),'/api/incidents?business_date=2026-09-27&page=1&page_size=100':page([incident,{...incident,id:'I2',base_delivery_plan_id:'OLD'}]),'/api/operations/simulated-positions?business_date=2026-09-27':position};
  globalThis.fetch=async(url,options={})=>{calls.push([url,options.method??'GET']);assert.ok(url in responses,`Unexpected ${url}`);return {ok:true,status:200,json:async()=>({success:true,code:'OK',message:'OK',data:responses[url]})};};
  try{
    const snapshot=await loadOverview('2026-09-27');
    assert.equal(snapshot.dashboard.orders.total,8);
    assert.equal(snapshot.vehicles?.[0].vehicle_code,'V01');
    assert.equal(snapshot.incidents?.[0].incident_code,'INC-1');
    assert.equal(snapshot.incidents?.length,1);
    assert.equal(snapshot.positions?.vehicles[0].source,'SIMULATED');
    assert.equal(overviewMetrics(snapshot).onTimeRate,66.7);
    assert.equal(snapshot.dashboard.regions?.[0].orders,5);
    assert.equal(snapshot.dashboard.trends?.on_time_rate_delta_points,16.7);
    assert.deepEqual(overviewMetrics(snapshot).exceptions,1);
    assert.equal(overviewVehicles(snapshot)[0].progress,1/3);
    assert.ok(calls.every(([,method])=>method==='GET'));
  }finally{globalThis.fetch=original;}
});

test('a failed optional feed stays unavailable and cannot become a demo number',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async(url)=>url.includes('/dashboard?')?{ok:true,status:200,json:async()=>({success:true,code:'OK',message:'OK',data:dashboard})}:{ok:false,status:503,json:async()=>({success:false,code:'BACKEND_DOWN',message:'Unavailable',data:null})};
  try{const snapshot=await loadOverview('2026-09-27');assert.equal(snapshot.dashboard.orders.total,8);assert.equal(snapshot.vehicles,null);assert.equal(snapshot.positions,null);assert.ok(snapshot.warnings.length>0);await assert.rejects(loadPositions('2026-09-27'),/Unavailable/);}
  finally{globalThis.fetch=original;}
});

test('older dashboard without KPI fields stays explicitly unavailable',()=>{
  const legacy={...dashboard,on_time:undefined,regions:undefined,trends:undefined};
  assert.equal(overviewMetrics({dashboard:legacy}).onTimeRate,null);
});

test('a selected date without a Current plan explains why Operations has no data',async()=>{
  const original=globalThis.fetch,calls=[];
  globalThis.fetch=async url=>{calls.push(String(url));return {ok:false,status:404,json:async()=>({success:false,code:'CURRENT_PLAN_NOT_FOUND',message:'No current delivery plan for 2026-09-25',data:null})};};
  try{
    let failure;
    try{await loadOverview('2026-09-25');assert.fail('expected no-plan response');}catch(error){failure=error;}
    assert.deepEqual(calls,['/api/operations/dashboard?business_date=2026-09-25']);
    assert.equal(overviewErrorMessage(failure,'2026-09-25'),'No Current delivery plan for 2026-09-25. Orders may exist, but the Operations dashboard requires a Current plan.');
  }finally{globalThis.fetch=original;}
});

test('same-origin bridge permits route and simulated-position reads',async()=>{
  const original=globalThis.fetch,seen=[];
  globalThis.fetch=async (target,options)=>{seen.push({url:String(target),redirect:options.redirect});return new Response(JSON.stringify({success:true,code:'OK',message:'OK',data:{}}),{status:200,headers:{'Content-Type':'application/json'}});};
  try{
    for(const name of ['routes','simulated-positions']){
      const response=await GET(new Request(`http://localhost/api/operations/${name}?business_date=2026-09-27`),{params:Promise.resolve({path:['operations',name]})});
      assert.equal(response.status,200);
    }
    assert.ok(seen.every(call=>call.url.includes('business_date=2026-09-27')));
    assert.ok(seen.every(call=>call.redirect==='manual'));
  }finally{globalThis.fetch=original;}
});
