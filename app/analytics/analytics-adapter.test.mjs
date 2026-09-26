import assert from 'node:assert/strict';
import {test} from 'node:test';
import {adaptBackendSnapshot} from './analytics-adapter.ts';
import {buildAnalytics} from './analytics-model.ts';

test('official comparison maps to one read-only snapshot with no invented cost rate',()=>{
  const incident={id:'I1',incident_code:'INC-1',incident_type:'VEHICLE_UNAVAILABLE',business_date:'2026-09-27',affected_order_count:2};
  const attempt={recovery_plan_id:'R1',attempt_no:2,status:'READY',solver_status:'FEASIBLE',validation_status:'PASSED',replanning_scope:'AFFECTED',dispatcher_decision:null,candidate_delivery_plan_id:'C1',base_plan_code:'BASE',candidate_plan_code:'CAND'};
  const affected=[{order_id:'O1',requires_replanning:true,was_completed:false,handover_required:true},{order_id:'O2',requires_replanning:true,was_completed:false,handover_required:false}];
  const comparison={base_plan_id:'B1',candidate_plan_id:'C1',candidate_plan_status:'READY',business_date:'2026-09-27',reassigned_order_count:1,frozen_completed_order_ids:['O3'],orders:[
    {order_id:'O1',base_vehicle_id:'V1',candidate_vehicle_id:'V2',eta_delta_seconds:600},
    {order_id:'O2',base_vehicle_id:'V2',candidate_vehicle_id:null,eta_delta_seconds:null},
  ],remaining_metrics:{base_distance_meters:10000,candidate_distance_meters:12000,base_duration_seconds:3600,candidate_duration_seconds:4200,reason:null}};
  const snapshot=adaptBackendSnapshot(incident,attempt,affected,comparison);
  const view=buildAnalytics(snapshot);
  assert.equal(snapshot.ratePerKm,null);
  assert.deepEqual([view.recovered,view.affected,view.reassigned],[1,2,1]);
  assert.equal(view.costChange,null);
  assert.equal(view.rows[0].result,'Handover');
  assert.equal(view.rows[0].etaDeltaSeconds,600);
});
