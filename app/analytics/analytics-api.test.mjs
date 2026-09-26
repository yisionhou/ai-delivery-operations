import assert from 'node:assert/strict';
import {test} from 'node:test';
import {loadBackendAttempts,loadBackendIncidents,loadBackendSnapshot} from './analytics-api.ts';
import {buildAnalytics} from './analytics-model.ts';

test('backend errors stay errors and analytics only sends GET',async()=>{
  const original=globalThis.fetch;
  const calls=[];
  globalThis.fetch=async(url,options={})=>{
    calls.push({url,method:options.method??'GET'});
    return {ok:false,status:503,json:async()=>({success:false,code:'BACKEND_DOWN',message:'Service unavailable',data:null,request_id:'test'})};
  };
  try{
    await assert.rejects(loadBackendIncidents('2026-09-27'),/Service unavailable/);
    assert.equal(calls.length,1);
    assert.equal(calls[0].method,'GET');
    assert.match(calls[0].url,/^\/api\/incidents\?/);
  }finally{globalThis.fetch=original;}
});

test('incident list accepts the real list contract without detail-only counts',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async()=>({ok:true,status:200,json:async()=>({success:true,code:'OK',message:'Incidents retrieved',request_id:'test',data:{items:[{id:'I1',incident_code:'INC-1',incident_type:'VEHICLE_UNAVAILABLE',status:'REVIEW',business_date:'2026-09-27',base_delivery_plan_id:'P1',vehicle_route_id:null,vehicle_id:null,merchant_id:null,detected_at:'2026-09-27T10:00:00Z'}],page:1,page_size:100,total:1,total_pages:1}})});
  try{const incidents=await loadBackendIncidents('2026-09-27');assert.equal(incidents[0].incident_code,'INC-1');}
  finally{globalThis.fetch=original;}
});

test('recovery endpoints produce a comparable backend view without demo prices',async()=>{
  const original=globalThis.fetch;
  const attempt={recovery_plan_id:'R1',attempt_no:1,status:'READY',solver_status:'FEASIBLE',validation_status:'PASSED',replanning_scope:'AFFECTED',dispatcher_decision:null,candidate_delivery_plan_id:'C1',base_plan_code:'BASE',candidate_plan_code:'CAND'};
  const responses={
    '/api/incidents/I1/recovery-plans':[attempt],
    '/api/incidents/I1':{id:'I1',incident_code:'INC-1',incident_type:'VEHICLE_UNAVAILABLE',business_date:'2026-09-27',affected_order_count:1},
    '/api/incidents/I1/affected-orders':[{order_id:'O1',requires_replanning:true,was_completed:false,handover_required:false}],
    '/api/recovery-plans/R1/comparison':{base_plan_id:'B1',candidate_plan_id:'C1',candidate_plan_status:'READY',business_date:'2026-09-27',reassigned_order_count:1,frozen_completed_order_ids:[],orders:[{order_id:'O1',base_vehicle_id:'V1',candidate_vehicle_id:'V2',eta_delta_seconds:-300}],remaining_metrics:{base_distance_meters:10000,candidate_distance_meters:9000,base_duration_seconds:3600,candidate_duration_seconds:3300,reason:null}},
  };
  const calls=[];
  globalThis.fetch=async(url,options={})=>{calls.push({url,method:options.method??'GET'});const data=responses[url];assert.notEqual(data,undefined,`Unexpected ${url}`);return {ok:true,status:200,json:async()=>({success:true,code:'OK',message:'Success',request_id:'test',data})};};
  try{
    const [selected]=await loadBackendAttempts('I1');
    const view=buildAnalytics(await loadBackendSnapshot('I1',selected));
    assert.equal(view.recovered,1);
    assert.equal(view.distanceChangeKm,-1);
    assert.equal(view.costChange,null);
    assert.deepEqual(calls.map(call=>call.method),['GET','GET','GET','GET']);
  }finally{globalThis.fetch=original;}
});
