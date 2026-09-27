import test from 'node:test';
import assert from 'node:assert/strict';
import {loadAgentBriefing, loadLiveRecovery, askAgent, approveCandidate, describeAgentFailure} from './live-agent-api.ts';

const incident={id:'11111111-1111-4111-8111-111111111111',incident_code:'INC-LIVE',incident_type:'VEHICLE_UNAVAILABLE',status:'REVIEW',business_date:'2026-09-27',base_delivery_plan_id:'22222222-2222-4222-8222-222222222222',base_plan_code:'PLAN-BASE',vehicle_id:'33333333-3333-4333-8333-333333333333',merchant_id:null,detected_at:'2026-09-27T02:00:00Z',affected_order_count:1,handover_order_count:1,impact_summary:{HANDOVER_REQUIRED:1},requires_replanning:true,recovery_attempts:[{recovery_plan_id:'55555555-5555-4555-8555-555555555555',attempt_no:1,status:'PENDING_REVIEW',candidate_delivery_plan_id:'66666666-6666-4666-8666-666666666666'}]};
const affected=[{order_id:'44444444-4444-4444-8444-444444444444',original_vehicle_route_id:'route-1',execution_status_snapshot:'PICKED_UP',risk_status_snapshot:'AT_RISK',was_picked_up:true,was_completed:false,requires_replanning:true,handover_required:true,impact_type:'HANDOVER_REQUIRED',impact_reason:'Cargo on failed vehicle',assessed_at:'2026-09-27T02:01:00Z'}];
const recovery={recovery_plan_id:'55555555-5555-4555-8555-555555555555',attempt_no:1,replanning_scope:'AFFECTED_ROUTE',status:'PENDING_REVIEW',solver_status:'FEASIBLE',validation_status:'VALID',candidate_delivery_plan_id:'66666666-6666-4666-8666-666666666666',candidate_plan_code:'PLAN-REC',agent_explanation:'Handover and reassign the order.',solver_validation_summary:{explanation_source:'template_fallback'},scope_description:'Affected route',base_delivery_plan_id:incident.base_delivery_plan_id};
const comparison={recovery_plan_id:recovery.recovery_plan_id,base_plan_id:incident.base_delivery_plan_id,candidate_plan_id:recovery.candidate_delivery_plan_id,business_date:incident.business_date,comparison_at:'2026-09-27T02:02:00Z',comparison_time_basis:'ATTEMPT_RECORDED_AT',base_plan_status:'CURRENT',candidate_plan_status:'CANDIDATE',reviewable:true,reassigned_order_count:1,affected_vehicle_ids:[incident.vehicle_id,'77777777-7777-4777-8777-777777777777'],frozen_completed_order_ids:[],orders:[{order_id:affected[0].order_id,base_assignment_status:'ASSIGNED',candidate_assignment_status:'ASSIGNED',base_vehicle_id:incident.vehicle_id,candidate_vehicle_id:'77777777-7777-4777-8777-777777777777',assignment_changed:true,route_task_changed:true,base_delivery_eta:null,candidate_delivery_eta:'2026-09-27T03:00:00Z',eta_delta_seconds:null,eta_basis:'PLANNED_DELIVERY_ARRIVAL',eta_unavailable_reason:'DELIVERY_STOP_NOT_AVAILABLE'}],stop_changes:[{order_id:affected[0].order_id,stop_type:'HANDOVER',change_type:'ADDED',base_vehicle_id:null,candidate_vehicle_id:'77777777-7777-4777-8777-777777777777',base_location_id:null,candidate_location_id:'loc-1'}],route_changes:[],remaining_metrics:{base_distance_meters:null,candidate_distance_meters:null,delta_distance_meters:null,base_duration_seconds:null,candidate_duration_seconds:null,delta_duration_seconds:null,reason:'NO_COMPARABLE_REMAINDER_SNAPSHOT'}};
const page=items=>({items,page:1,page_size:100,total:items.length,total_pages:1});
const envelope=data=>Response.json({success:true,code:'SUCCESS',message:'ok',data,request_id:'req-test'});
const currentPlan={id:incident.base_delivery_plan_id,plan_code:'PLAN-BASE',business_date:incident.business_date,status:'CURRENT'};

function withFetch(routes,fn){
  const original=globalThis.fetch,calls=[];
  globalThis.fetch=async (input,init={})=>{
    const url=new URL(String(input),'http://localhost');const key=`${init.method??'GET'} ${url.pathname}`;
    calls.push({key,body:init.body?JSON.parse(init.body):null});
    if(!(key in routes))throw Error(`Unexpected request ${key}`);
    const value=typeof routes[key]==='function'?routes[key](url,init):routes[key];
    return value instanceof Response?value:envelope(value);
  };
  return Promise.resolve().then(()=>fn(calls)).finally(()=>{globalThis.fetch=original;});
}

test('live briefing uses persisted incident, operations and alerts rather than demo numbers',()=>withFetch({
  'GET /api/delivery-plans':page([currentPlan]),
  'GET /api/incidents':page([{...incident,id:'88888888-8888-4888-8888-888888888888',base_delivery_plan_id:'77777777-7777-4777-8777-777777777777',detected_at:'2026-09-27T04:00:00Z'},{...incident,status:'RESOLVED',id:'99999999-9999-4999-8999-999999999999',detected_at:'2026-09-27T03:00:00Z'},incident]),
  [`GET /api/incidents/${incident.id}`]:incident,
  [`GET /api/incidents/${incident.id}/affected-orders`]:affected,
  [`GET /api/incidents/${incident.id}/recovery-plans`]:[recovery],
  'GET /api/operations/dashboard':{current_plan:{delivery_plan_id:incident.base_delivery_plan_id,plan_code:'PLAN-BASE',version_no:1},orders:{total:9,completed:1,in_progress:8,at_risk:1},vehicles:{available:2,active:1,unavailable:1},on_time:{on_time_deliveries:1,measured_deliveries:1,rate:1}},
  'GET /api/operations/alerts':page([{id:'alert-1',order_id:affected[0].order_id,risk_type:'DELIVERY_WINDOW',status:'ACTIVE',reason_category:'ETA_LATE',evidence:{},detected_at:'2026-09-27T02:01:00Z'}]),
  [`GET /api/vehicles/${incident.vehicle_id}`]:{vehicle_code:'VEH-LIVE'},
  [`GET /api/orders/${affected[0].order_id}`]:{order_code:'ORD-LIVE',delivery_location:{display_name:'Customer A'}},
},async calls=>{
  const result=await loadAgentBriefing();
  assert.equal(result.incident.id,incident.id);
  assert.equal(result.incidentOptions.length,3);
  assert.equal(result.currentPlanId,currentPlan.id);
  assert.equal(result.totalOrders,9);
  assert.equal(result.vehicleCode,'VEH-LIVE');
  assert.deepEqual(result.affectedOrderCodes,['ORD-LIVE']);
  assert.equal(result.recoveryPlanId,recovery.recovery_plan_id);
  assert.equal(result.risks[0].orderCode,'ORD-LIVE');
  assert.ok(calls.every(call=>call.key.startsWith('GET ')));
}));

test('direct Agent entry can brief the latest Current Plan without an Incident ID',()=>withFetch({
  'GET /api/incidents':page([]),
  'GET /api/delivery-plans':page([currentPlan]),
  'GET /api/operations/dashboard':{current_plan:{delivery_plan_id:currentPlan.id,plan_code:currentPlan.plan_code},orders:{total:12,at_risk:2},vehicles:{available:2,active:1,unavailable:0},on_time:{rate:null}},
  'GET /api/operations/alerts':page([]),
},async calls=>{
  const result=await loadAgentBriefing();
  assert.equal(result.incident,null);
  assert.equal(result.businessDate,'2026-09-27');
  assert.equal(result.planCode,'PLAN-BASE');
  assert.equal(result.totalOrders,12);
  assert.ok(calls.some(call=>call.key==='GET /api/delivery-plans'));
}));

test('switching to an explicit Incident loads that ID instead of the automatic selection',()=>withFetch({
  'GET /api/delivery-plans':page([currentPlan]),
  'GET /api/incidents':page([incident,{...incident,id:'99999999-9999-4999-8999-999999999999',incident_code:'INC-HISTORY',status:'RESOLVED'}]),
  'GET /api/incidents/99999999-9999-4999-8999-999999999999':{...incident,id:'99999999-9999-4999-8999-999999999999',incident_code:'INC-HISTORY',status:'RESOLVED',recovery_attempts:[]},
  'GET /api/incidents/99999999-9999-4999-8999-999999999999/affected-orders':[],
  'GET /api/operations/dashboard':{current_plan:{delivery_plan_id:currentPlan.id,plan_code:currentPlan.plan_code},orders:{total:12,at_risk:0},vehicles:{available:2,active:1,unavailable:0},on_time:{rate:null}},
  'GET /api/operations/alerts':page([]),
  [`GET /api/vehicles/${incident.vehicle_id}`]:{vehicle_code:'VEH-LIVE'},
},async()=>{
  const result=await loadAgentBriefing('99999999-9999-4999-8999-999999999999');
  assert.equal(result.incident.incident_code,'INC-HISTORY');
  assert.equal(result.recoveryPlanId,null);
  assert.equal(result.incidentOptions.length,2);
}));

test('live recovery reuses a pending candidate and preserves unavailable comparison metrics',()=>withFetch({
  [`GET /api/incidents/${incident.id}`]:incident,
  [`GET /api/incidents/${incident.id}/affected-orders`]:affected,
  [`GET /api/incidents/${incident.id}/recovery-plans`]:[recovery],
  [`GET /api/recovery-plans/${recovery.recovery_plan_id}/comparison`]:comparison,
  [`GET /api/orders/${affected[0].order_id}`]:{order_code:'ORD-LIVE',delivery_location:{display_name:'Customer A'}},
  [`GET /api/vehicles/${incident.vehicle_id}`]:{vehicle_code:'VEH-LIVE'},
  'GET /api/vehicles/77777777-7777-4777-8777-777777777777':{vehicle_code:'VEH-NEW'},
},async calls=>{
  const result=await loadLiveRecovery({incidentId:incident.id,signal:new AbortController().signal});
  assert.equal(result.source,'live');
  assert.equal(result.candidates.length,1);
  assert.equal(result.candidates[0].reassignedOrdersCount,1);
  assert.equal(result.candidates[0].distanceImpactKm,null);
  assert.equal(result.candidates[0].successProbability,undefined);
  assert.equal(result.candidates[0].explanationSource,'template_fallback');
  assert.equal(result.recommendedCandidateId,undefined);
  assert.equal(result.candidates[0].reviewSnapshot.comparison.approvalEligible,true);
  assert.ok(calls.every(call=>call.key.startsWith('GET ')));
}));

test('historical Chinese Candidate text is shown as an English verified summary',()=>withFetch({
  [`GET /api/incidents/${incident.id}`]:incident,
  [`GET /api/incidents/${incident.id}/affected-orders`]:affected,
  [`GET /api/incidents/${incident.id}/recovery-plans`]:[{...recovery,scope_description:'改派方案',agent_explanation:'该方案需要人工批准。'}],
  [`GET /api/recovery-plans/${recovery.recovery_plan_id}/comparison`]:comparison,
  [`GET /api/orders/${affected[0].order_id}`]:{order_code:'ORD-LIVE',delivery_location:{display_name:'Customer A'}},
  [`GET /api/vehicles/${incident.vehicle_id}`]:{vehicle_code:'VEH-LIVE'},
  'GET /api/vehicles/77777777-7777-4777-8777-777777777777':{vehicle_code:'VEH-NEW'},
},async()=>{
  const result=await loadLiveRecovery({incidentId:incident.id,signal:new AbortController().signal});
  const candidate=result.candidates[0];
  assert.equal(candidate.explanationSource,'verified_comparison_summary');
  assert.match(candidate.description,/dispatcher approval/i);
  assert.doesNotMatch(candidate.title+candidate.description,/[\u3400-\u9fff]/u);
}));

test('live recovery starts the official recovery command once when no candidate exists',()=>withFetch({
  [`GET /api/incidents/${incident.id}`]:incident,
  [`GET /api/incidents/${incident.id}/affected-orders`]:affected,
  [`GET /api/incidents/${incident.id}/recovery-plans`]:[],
  [`POST /api/incidents/${incident.id}/recovery`]:{incident_id:incident.id,outcome:'PENDING_REVIEW',attempts_created:[],reviewable_recovery_plan_id:recovery.recovery_plan_id,candidate_delivery_plan_id:recovery.candidate_delivery_plan_id,agent_explanation:'Handover and reassign the order.'},
  [`GET /api/recovery-plans/${recovery.recovery_plan_id}`]:recovery,
  [`GET /api/recovery-plans/${recovery.recovery_plan_id}/comparison`]:comparison,
  [`GET /api/orders/${affected[0].order_id}`]:{order_code:'ORD-LIVE',delivery_location:{display_name:'Customer A'}},
  [`GET /api/vehicles/${incident.vehicle_id}`]:{vehicle_code:'VEH-LIVE'},
  'GET /api/vehicles/77777777-7777-4777-8777-777777777777':{vehicle_code:'VEH-NEW'},
},async calls=>{
  const result=await loadLiveRecovery({incidentId:incident.id,signal:new AbortController().signal});
  assert.equal(result.candidates.length,1);
  assert.equal(calls.filter(call=>call.key===`POST /api/incidents/${incident.id}/recovery`).length,1);
  assert.ok(!calls.some(call=>call.key.includes('recovery-options')));
}));

test('agent question sends exact selected Recovery and Alert IDs; approval requires a reason',()=>withFetch({
  'POST /api/agent/dispatch':{status:'COMPLETED',message:'The vehicle is unavailable.',planner_source:'fallback',explanation_source:'template',context:{incident_id:incident.id}},
  [`POST /api/recovery-plans/${recovery.recovery_plan_id}/approve`]:{current_delivery_plan_id:recovery.candidate_delivery_plan_id,candidate_status:'CURRENT',incident_status:'RESOLVED'},
},async calls=>{
  assert.deepEqual(await askAgent('Explain this candidate',{business_date:incident.business_date,incident_id:incident.id,recovery_plan_id:recovery.recovery_plan_id,alert_id:'88888888-8888-4888-8888-888888888888'}),{message:'The vehicle is unavailable.',source:'template'});
  await assert.rejects(()=>approveCandidate(recovery.recovery_plan_id,'  ',recovery.candidate_delivery_plan_id),/reason/i);
  await approveCandidate(recovery.recovery_plan_id,'Reviewed route changes',recovery.candidate_delivery_plan_id);
  assert.equal(calls[0].body.context.incident_id,incident.id);
  assert.equal(calls[0].body.context.recovery_plan_id,recovery.recovery_plan_id);
  assert.equal(calls[0].body.context.alert_id,'88888888-8888-4888-8888-888888888888');
  assert.equal(calls[1].body.decision_reason,'Reviewed route changes');
}));

test('Agent can ask a date-scoped operations question without an Incident ID',()=>withFetch({
  'POST /api/agent/dispatch':{status:'COMPLETED',message:'The Current Plan has twelve orders.',explanation_source:'template'},
},async calls=>{
  const reply=await askAgent('Summarize current delivery status.',{business_date:'2026-09-27'});
  assert.match(reply.message,/twelve orders/i);
  assert.deepEqual(calls[0].body.context,{business_date:'2026-09-27'});
}));

test('Agent clarification token carries a pending query into the follow-up',()=>withFetch({
  'POST /api/agent/dispatch':(_url,init)=>JSON.parse(init.body).context_token
    ?{status:'COMPLETED',message:'The recovery plan is ready for review.',explanation_source:'template',context_token:'next-token'}
    :{status:'NEEDS_INPUT',message:'Please select a recovery option first.',explanation_source:'template',context_token:'pending-token'},
},async calls=>{
  const context={business_date:'2026-09-27',incident_id:incident.id};
  const first=await askAgent('Compare the recovery proposal.',context);
  assert.equal(first.contextToken,'pending-token');
  const second=await askAgent(`recovery_plan_id: ${recovery.recovery_plan_id}`,context,first.contextToken);
  assert.match(second.message,/ready for review/i);
  assert.equal(calls[1].body.context_token,'pending-token');
}));

test('approval conflict gives a clear English failure with its backend code',()=>withFetch({
  [`POST /api/recovery-plans/${recovery.recovery_plan_id}/approve`]:Response.json({success:false,code:'CANDIDATE_SCHEDULE_STALE',message:'候选计划时间已过期',data:null,request_id:'req-test'},{status:409}),
},async()=>{
  await assert.rejects(()=>approveCandidate(recovery.recovery_plan_id,'Reviewed route changes',recovery.candidate_delivery_plan_id),error=>{
    assert.equal(error.code,'CANDIDATE_SCHEDULE_STALE');
    assert.match(describeAgentFailure(error,'approval'),/candidate.*out of date/i);
    assert.match(describeAgentFailure(error,'approval'),/CANDIDATE_SCHEDULE_STALE/);
    assert.doesNotMatch(describeAgentFailure(error,'approval'),/[\u3400-\u9fff]/u);
    return true;
  });
}));

test('Agent and backend failures have actionable prompts without presenting them as answers',()=>{
  assert.match(describeAgentFailure(new Error('Failed to fetch'),'question'),/try again/i);
  assert.match(describeAgentFailure({code:'AGENT_NOT_CONFIGURED',message:'未配置',status:503},'question'),/not configured/i);
  assert.match(describeAgentFailure({code:'BACKEND_UNAVAILABLE',message:'connection failed',status:503},'recovery'),/backend.*unavailable/i);
  assert.match(describeAgentFailure({code:'RECOVERY_SOLVER_ERROR',message:'求解失败',status:500},'recovery'),/Current Plan has not changed/i);
  assert.match(describeAgentFailure(new TypeError('Failed to fetch'),'approval'),/could not be confirmed/i);
  assert.doesNotMatch(describeAgentFailure(new TypeError('Failed to fetch'),'approval'),/has not changed/i);
  assert.match(describeAgentFailure(new TypeError('Network request failed'),'approval'),/could not be confirmed/i);
});
