import assert from 'node:assert/strict';
import test from 'node:test';
import {snapshotFromReview,isCurrentAnalyticsContext} from './analytics-api.ts';

const incident={id:'incident-1',incident_code:'INC-1',incident_type:'MERCHANT_DELAY',business_date:'2026-09-28',base_plan_code:'PLAN-1'};
const affectedOrders=[
  {order_id:'order-1',requires_replanning:true,handover_required:false,was_completed:false},
  {order_id:'order-2',requires_replanning:false,handover_required:false,was_completed:true},
];
const attempt={recovery_plan_id:'attempt-1',attempt_no:2,status:'PENDING_REVIEW',solver_status:'FEASIBLE',validation_status:'VALID',replanning_scope:'CROSS_ROUTE',dispatcher_decision:null,base_plan_code:'PLAN-1',candidate_plan_code:'PLAN-2',candidate_delivery_plan_id:'candidate-1'};
const comparison={reassigned_order_count:1,frozen_completed_order_ids:['order-2'],remaining_metrics:{base_distance_meters:null,candidate_distance_meters:null,base_duration_seconds:null,candidate_duration_seconds:null,reason:'NO_COMPARABLE_REMAINDER_SNAPSHOT'},orders:[
  {order_id:'order-1',base_vehicle_id:'vehicle-1',candidate_vehicle_id:'vehicle-2',eta_delta_seconds:120},
  {order_id:'order-2',base_vehicle_id:'vehicle-1',candidate_vehicle_id:'vehicle-1',eta_delta_seconds:null},
]};

test('maps official recovery comparison without inventing remaining distance',()=>{
  const snapshot=snapshotFromReview({incident,affectedOrders,selectedAttempt:attempt,comparison},{base:{assigned_order_count:2,unassigned_order_count:0},candidate:{version_no:2,assigned_order_count:2,unassigned_order_count:0},orderCodes:{'order-1':'ORD-001','order-2':'ORD-002'},vehicleCodes:{'vehicle-1':'VEH-001','vehicle-2':'VEH-002'}});
  assert.equal(snapshot?.source,'api');
  assert.deepEqual(snapshot?.incident.affectedOrderIds,['order-1']);
  assert.deepEqual(snapshot?.incident.frozenOrderIds,['order-2']);
  assert.equal(snapshot?.orders[0].candidateVehicle,'VEH-002');
  assert.equal(snapshot?.orders[0].etaDeltaSeconds,120);
  assert.equal(snapshot?.officialReassignedCount,1);
  assert.equal(snapshot?.remaining.baseDistanceMeters,null);
  assert.equal(snapshot?.remaining.reason,'No comparable remaining-route snapshot is available.');
  assert.equal(snapshot?.ratePerKm,null);
});

test('preserves a failed attempt with no candidate and no fabricated order comparison',()=>{
  const failed={...attempt,status:'DRAFT',solver_status:'INFEASIBLE',validation_status:null,candidate_delivery_plan_id:null,candidate_plan_code:null};
  const snapshot=snapshotFromReview({incident,affectedOrders,selectedAttempt:failed,comparison:null},{base:null,candidate:null,orderCodes:{},vehicleCodes:{}});
  assert.equal(snapshot?.candidatePlan,null);
  assert.deepEqual(snapshot?.orders,[]);
  assert.equal(snapshot?.assignmentTotals,undefined);
});

test('incident without a recovery attempt has no comparison snapshot',()=>{
  assert.equal(snapshotFromReview({incident,affectedOrders,selectedAttempt:null,comparison:null},{base:null,candidate:null,orderCodes:{},vehicleCodes:{}}),null);
});

test('a previous date or missing incident cannot display stale analytics',()=>{
  assert.equal(isCurrentAnalyticsContext('2026-09-27:0:incident-1:','2026-09-28:0::',null),false);
  assert.equal(isCurrentAnalyticsContext('2026-09-28:0:incident-1:','2026-09-28:0:incident-1:','incident-1'),true);
});
