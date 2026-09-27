import test from 'node:test';
import assert from 'node:assert/strict';
import * as incidentApi from './incident-read-api.ts';

const {loadIncidentIndex,loadIncidentReview}=incidentApi;

const incident={id:'i-1',incident_code:'INC-1',incident_type:'VEHICLE_UNAVAILABLE',status:'REVIEW',business_date:'2026-09-27',base_delivery_plan_id:'p-1',base_plan_code:'PLAN-1',vehicle_route_id:'route-1',vehicle_id:'v-1',merchant_id:null,incident_location_id:'loc-1',incident_location:{latitude:1.3039,longitude:103.7596,address_text:'Breakdown point'},detected_at:'2026-09-27T02:00:00Z',detected_by:'dispatcher',affected_order_count:2,handover_order_count:1,impact_summary:{COMPLETED_FROZEN:1,HANDOVER_REQUIRED:1},requires_replanning:true};
const affected=[{id:'a-1',incident_id:'i-1',order_id:'o-1',original_vehicle_route_id:'route-1',execution_status_snapshot:'COMPLETED',risk_status_snapshot:'NORMAL',was_picked_up:true,was_completed:true,requires_replanning:false,handover_required:false,impact_type:'COMPLETED_FROZEN',impact_reason:'Already delivered',assessed_at:'2026-09-27T02:01:00Z',created_at:'2026-09-27T02:01:00Z'}];
const failed={recovery_plan_id:'r-1',attempt_no:1,replanning_scope:'AFFECTED_ROUTE',status:'FAILED',solver_status:'INFEASIBLE',validation_status:null,candidate_delivery_plan_id:null,recovery_code:'REC-1',incident_id:'i-1',previous_recovery_plan_id:null,base_delivery_plan_id:'p-1',base_plan_code:'PLAN-1',candidate_plan_code:null,scope_description:'Route only',agent_explanation:null,solver_validation_summary:null,dispatcher_decision:null,decision_reason:null,reviewed_by:null,reviewed_at:null,created_at:'2026-09-27T02:02:00Z',updated_at:'2026-09-27T02:02:00Z'};
const ready={...failed,recovery_plan_id:'r-2',attempt_no:2,replanning_scope:'CROSS_ROUTE',status:'PENDING_REVIEW',solver_status:'FEASIBLE',validation_status:'VALID',candidate_delivery_plan_id:'p-2',candidate_plan_code:'PLAN-2',previous_recovery_plan_id:'r-1'};
const comparison={recovery_plan_id:'r-2',base_plan_id:'p-1',candidate_plan_id:'p-2',business_date:'2026-09-27',comparison_at:'2026-09-27T02:02:00Z',comparison_time_basis:'RECOVERY_ATTEMPT_CREATED_AT',base_plan_status:'CURRENT',candidate_plan_status:'CANDIDATE',reviewable:true,reassigned_order_count:1,affected_vehicle_ids:['v-1','v-2'],frozen_completed_order_ids:['o-1'],orders:[{order_id:'o-2',base_assignment_status:'ASSIGNED',candidate_assignment_status:'ASSIGNED',base_vehicle_id:'v-1',candidate_vehicle_id:'v-2',base_delivery_eta:'2026-09-27T03:00:00Z',candidate_delivery_eta:'2026-09-27T03:10:00Z',eta_delta_seconds:600,eta_basis:'PLAN',eta_unavailable_reason:null}],stop_changes:[{order_id:'o-2',stop_type:'HANDOVER',change_type:'ADDED',candidate_vehicle_id:'v-2'}],route_changes:[],remaining_metrics:{base_distance_meters:null,candidate_distance_meters:null,delta_distance_meters:null,base_duration_seconds:null,candidate_duration_seconds:null,delta_duration_seconds:null,reason:'Historical progress not recorded'}};
const page=(items,totalPages=1)=>({items,page:1,page_size:100,total:items.length,total_pages:totalPages});
const route=(id,plan,vehicle,geometry)=>({id,delivery_plan_id:plan,route_no:1,vehicle_id:vehicle,driver_id:'driver-1',vehicle_driver_assignment_id:'pair-1',start_location_id:'loc-start',end_location_id:'loc-end',status:'ACTIVE',planned_start_at:'2026-09-27T01:00:00Z',planned_end_at:'2026-09-27T04:00:00Z',actual_start_at:null,actual_end_at:null,distance_meters:1000,duration_seconds:600,vehicle_capacity_load_units_snapshot:4,route_geometry:geometry,route_metrics:{}});

test('incident index follows backend pagination and preserves status',async()=>{
  const original=globalThis.fetch,calls=[];
  globalThis.fetch=async url=>{
    calls.push(String(url));
    const number=Number(new URL(url,'http://localhost').searchParams.get('page'));
    return Response.json({success:true,code:'SUCCESS',message:'ok',data:page(number===1?[{id:'i-1',incident_code:'INC-1',incident_type:'VEHICLE_UNAVAILABLE',status:'REVIEW',business_date:'2026-09-27',detected_at:'2026-09-27T02:00:00Z'}]:[{id:'i-2',incident_code:'INC-2',incident_type:'MERCHANT_DELAY',status:'RESOLVED',business_date:'2026-09-27',detected_at:'2026-09-27T02:05:00Z'}],2)});
  };
  try{
    const result=await loadIncidentIndex('2026-09-27');
    assert.deepEqual(result.map(item=>[item.id,item.status]),[['i-1','REVIEW'],['i-2','RESOLVED']]);
    assert.deepEqual(calls.map(url=>new URL(url,'http://localhost').searchParams.get('page')),['1','2']);
    assert.ok(calls.every(url=>new URL(url,'http://localhost').searchParams.get('business_date')==='2026-09-27'));
  }finally{globalThis.fetch=original;}
});

test('affected-order map slices saved OSRM legs from pickup or handover to delivery',()=>{
  assert.equal(typeof incidentApi.buildAffectedOrderRoutes,'function');
  const base={type:'Feature',properties:{plan:'base',route_id:'base-route',vehicle_id:'v-1',route_no:1,road_aligned:true,road_leg_end_indices:[1,1,2,3,4]},geometry:{type:'LineString',coordinates:[[103.70,1.30],[103.71,1.30],[103.72,1.30],[103.73,1.30],[103.74,1.30]]}};
  const candidate={type:'Feature',properties:{...base.properties,plan:'candidate',route_id:'candidate-route',vehicle_id:'v-2',road_leg_end_indices:[1,2]},geometry:{type:'LineString',coordinates:[[103.75,1.31],[103.76,1.31],[103.77,1.31]]}};
  const review={incident:{id:'i-1'},affectedOrders:[
    {order_id:'o-1',original_vehicle_route_id:'base-route',was_completed:true},
    {order_id:'o-2',original_vehicle_route_id:'base-route',was_completed:false},
  ],mapOverlay:{features:[base,candidate]}};
  const stops={
    'base-route':[
      {order_id:'o-1',stop_type:'PICKUP',sequence_no:1},{order_id:'o-2',stop_type:'PICKUP',sequence_no:2},
      {order_id:'o-1',stop_type:'DELIVERY',sequence_no:3},{order_id:'o-2',stop_type:'DELIVERY',sequence_no:4},
    ],
    'candidate-route':[
      {order_id:'o-2',stop_type:'HANDOVER',sequence_no:1},{order_id:'o-2',stop_type:'DELIVERY',sequence_no:2},
    ],
  };
  const result=incidentApi.buildAffectedOrderRoutes(review,stops);
  assert.deepEqual(result.map(item=>[item.properties.plan,item.properties.order_id,item.properties.completed,item.properties.origin,item.geometry.coordinates]),[
    ['base','o-1',true,'PICKUP',[[103.71,1.30],[103.72,1.30]]],
    ['base','o-2',false,'PICKUP',[[103.71,1.30],[103.72,1.30],[103.73,1.30]]],
    ['candidate','o-2',false,'HANDOVER',[[103.76,1.31],[103.77,1.31]]],
  ]);
});

test('affected-order map omits routes without trustworthy stop leg indices',()=>{
  assert.equal(typeof incidentApi.buildAffectedOrderRoutes,'function');
  const review={incident:{id:'i-1'},affectedOrders:[{order_id:'o-1',original_vehicle_route_id:'base-route',was_completed:false}],mapOverlay:{features:[{type:'Feature',properties:{plan:'base',route_id:'base-route',vehicle_id:'v-1',route_no:1,road_aligned:true,road_leg_end_indices:null},geometry:{type:'LineString',coordinates:[[103.70,1.30],[103.71,1.31]]}}]}};
  const stops={'base-route':[{order_id:'o-1',stop_type:'PICKUP',sequence_no:1},{order_id:'o-1',stop_type:'DELIVERY',sequence_no:2}]};
  assert.deepEqual(incidentApi.buildAffectedOrderRoutes(review,stops),[]);
});

test('Incident detail focuses affected paths, stop nodes and the replacement approach',()=>{
  assert.equal(typeof incidentApi.buildIncidentFocusMap,'function');
  const base={type:'Feature',properties:{plan:'base',route_id:'base-route',vehicle_id:'v-1',route_no:1,road_aligned:true,road_leg_end_indices:[1,1,2,3,4]},geometry:{type:'LineString',coordinates:[[103.70,1.30],[103.71,1.30],[103.72,1.30],[103.73,1.30],[103.74,1.30]]}};
  const replacement={type:'Feature',properties:{...base.properties,plan:'candidate',route_id:'replacement',vehicle_id:'v-2',road_leg_end_indices:[1,2]},geometry:{type:'LineString',coordinates:[[103.75,1.31],[103.76,1.31],[103.77,1.31]]}};
  const unrelated={type:'Feature',properties:{...replacement.properties,route_id:'unrelated'},geometry:replacement.geometry};
  const review={incident:{id:'i-1'},affectedOrders:[
    {order_id:'o-1',original_vehicle_route_id:'base-route',was_completed:true},
    {order_id:'o-2',original_vehicle_route_id:'base-route',was_completed:false},
  ],mapOverlay:{features:[base,replacement,unrelated],incidentPoint:[103.76,1.31],hasCandidate:true}};
  const stops={
    'base-route':[{order_id:'o-1',stop_type:'PICKUP',sequence_no:1},{order_id:'o-2',stop_type:'PICKUP',sequence_no:2},{order_id:'o-1',stop_type:'DELIVERY',sequence_no:3},{order_id:'o-2',stop_type:'DELIVERY',sequence_no:4}],
    replacement:[{order_id:'o-2',stop_type:'HANDOVER',sequence_no:1},{order_id:'o-2',stop_type:'DELIVERY',sequence_no:2}],
    unrelated:[{order_id:'other',stop_type:'PICKUP',sequence_no:1},{order_id:'other',stop_type:'DELIVERY',sequence_no:2}],
  };
  const map=incidentApi.buildIncidentFocusMap(review,stops);
  assert.deepEqual(map.features.map(feature=>[feature.properties.order_id,feature.properties.plan,feature.properties.completed]),[['o-1','base',true],['o-2','base',false],['o-2','candidate',false]]);
  assert.deepEqual(map.approaches.map(feature=>feature.geometry.coordinates),[[[103.75,1.31],[103.76,1.31]]]);
  assert.deepEqual(map.nodes.map(node=>[node.order_id,node.kind,node.plan]),[['o-1','PICKUP','base'],['o-1','DELIVERY','base'],['o-2','PICKUP','base'],['o-2','DELIVERY','base'],['o-2','HANDOVER','candidate'],['o-2','DELIVERY','candidate'],['o-2','START','candidate']]);
  assert.deepEqual(map.incidentPoint,[103.76,1.31]);
});

test('Incident detail loads stops for the affected Base route and Candidate routes only',async()=>{
  assert.equal(typeof incidentApi.loadIncidentFocusMap,'function');
  const original=globalThis.fetch,calls=[];
  const feature=(id,plan)=>({type:'Feature',properties:{plan,route_id:id,vehicle_id:id,route_no:1,road_aligned:true,road_leg_end_indices:[1,2]},geometry:{type:'LineString',coordinates:[[103.70,1.30],[103.71,1.30],[103.72,1.30]]}});
  const review={incident:{id:'i-1'},affectedOrders:[{order_id:'o-1',original_vehicle_route_id:'base-route',was_completed:false}],mapOverlay:{features:[feature('base-route','base'),feature('other-base','base'),feature('candidate-route','candidate')],incidentPoint:null,hasCandidate:true}};
  const data={'/api/vehicle-routes/base-route/stops':[{order_id:'o-1',stop_type:'PICKUP',sequence_no:1},{order_id:'o-1',stop_type:'DELIVERY',sequence_no:2}],'/api/vehicle-routes/candidate-route/stops':[{order_id:'o-1',stop_type:'HANDOVER',sequence_no:1},{order_id:'o-1',stop_type:'DELIVERY',sequence_no:2}]};
  globalThis.fetch=async url=>{const path=new URL(url,'http://localhost').pathname;calls.push(path);assert.ok(path in data,`Unexpected ${path}`);return Response.json({success:true,code:'SUCCESS',message:'ok',data:data[path]});};
  try{
    const map=await incidentApi.loadIncidentFocusMap(review);
    assert.deepEqual(calls.toSorted(),Object.keys(data).toSorted());
    assert.deepEqual(map.features.map(item=>item.properties.plan),['base','candidate']);
    assert.equal(map.nodes.some(node=>node.kind==='HANDOVER'),true);
  }finally{globalThis.fetch=original;}
});

test('Incident list map fetches only routes containing affected orders',async()=>{
  assert.equal(typeof incidentApi.loadIncidentIndexMap,'function');
  const original=globalThis.fetch,calls=[];
  const line={type:'LineString',coordinates:[[103.70,1.30],[103.71,1.30],[103.72,1.30]]};
  const base={...route('base-route','p-1','v-1',line),route_metrics:{geometry_provider:'OSRM',road_leg_end_indices:[1,2]}};
  const unrelated={...route('unrelated','p-1','v-3',line),route_metrics:{geometry_provider:'OSRM',road_leg_end_indices:[1,2]}};
  const data={'/api/incidents/i-1':incident,'/api/incidents/i-1/affected-orders':[{...affected[0],original_vehicle_route_id:'base-route'}],'/api/incidents/i-1/recovery-plans':[failed],'/api/delivery-plans/p-1/routes':[base,unrelated],'/api/vehicle-routes/base-route/stops':[{order_id:'o-1',stop_type:'PICKUP',sequence_no:1},{order_id:'o-1',stop_type:'DELIVERY',sequence_no:2}]};
  globalThis.fetch=async url=>{const path=new URL(url,'http://localhost').pathname;calls.push(path);assert.ok(path in data,`Unexpected ${path}`);return Response.json({success:true,code:'SUCCESS',message:'ok',data:data[path]});};
  try{
    const result=await incidentApi.loadIncidentIndexMap([{id:'i-1',incident_code:'INC-1'}]);
    assert.deepEqual(result.features.map(item=>[item.properties.incident_id,item.properties.order_id,item.properties.plan]),[['i-1','o-1','base']]);
    assert.deepEqual(result.incidents.map(item=>item.point),[[103.7596,1.3039]]);
    assert.ok(calls.includes('/api/vehicle-routes/base-route/stops'));
    assert.ok(!calls.includes('/api/vehicle-routes/unrelated/stops'));
  }finally{globalThis.fetch=original;}
});

test('incident review keeps detection snapshots and sorts failed and successful attempts',async()=>{
  const original=globalThis.fetch,calls=[];
  const data={'/api/incidents/i-1':incident,'/api/incidents/i-1/affected-orders':affected,'/api/incidents/i-1/recovery-plans':[ready,failed],'/api/recovery-plans/r-2/comparison':comparison};
  globalThis.fetch=async url=>{const path=new URL(url,'http://localhost').pathname;calls.push(path);return Response.json({success:true,code:'SUCCESS',message:'ok',data:data[path]});};
  try{
    const result=await loadIncidentReview('i-1');
    assert.equal(result.incident.incident_code,'INC-1');
    assert.equal(result.affectedOrders[0].execution_status_snapshot,'COMPLETED');
    assert.deepEqual(result.attempts.map(item=>item.recovery_plan_id),['r-1','r-2']);
    assert.equal(result.selectedAttempt?.recovery_plan_id,'r-2');
    assert.equal(result.comparison?.reviewable,true);
    assert.equal(result.comparison?.remaining_metrics.reason,'Historical progress not recorded');
    assert.ok(calls.includes('/api/recovery-plans/r-2/comparison'));
  }finally{globalThis.fetch=original;}
});

test('failed attempt has no candidate and never requests a comparison',async()=>{
  const original=globalThis.fetch,calls=[];
  const data={'/api/incidents/i-1':incident,'/api/incidents/i-1/affected-orders':affected,'/api/incidents/i-1/recovery-plans':[ready,failed]};
  globalThis.fetch=async url=>{const path=new URL(url,'http://localhost').pathname;calls.push(path);return Response.json({success:true,code:'SUCCESS',message:'ok',data:data[path]});};
  try{
    const result=await loadIncidentReview('i-1','r-1');
    assert.equal(result.selectedAttempt?.solver_status,'INFEASIBLE');
    assert.equal(result.selectedAttempt?.candidate_delivery_plan_id,null);
    assert.equal(result.comparison,null);
    assert.equal(result.mapOverlay.hasCandidate,false);
    assert.ok(!calls.some(path=>path.includes('comparison')));
  }finally{globalThis.fetch=original;}
});

test('backend failure remains an error instead of loading demo data',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async()=>Response.json({success:false,code:'INCIDENT_NOT_FOUND',message:'Incident missing',data:null},{status:404});
  try{await assert.rejects(loadIncidentReview('i-missing'),error=>error.code==='INCIDENT_NOT_FOUND');}
  finally{globalThis.fetch=original;}
});

test('comparison map loads exact Base and Candidate plan routes without mixing them',async()=>{
  const original=globalThis.fetch,calls=[];
  const line={type:'LineString',coordinates:[[103.70,1.30],[103.71,1.31]]};
  const data={'/api/incidents/i-1':incident,'/api/incidents/i-1/affected-orders':affected,'/api/incidents/i-1/recovery-plans':[ready],'/api/recovery-plans/r-2/comparison':comparison,'/api/delivery-plans/p-1/routes':[route('base-route','p-1','v-1',line)],'/api/delivery-plans/p-2/routes':[route('candidate-route','p-2','v-2',line)]};
  globalThis.fetch=async url=>{const path=new URL(url,'http://localhost').pathname;calls.push(path);return Response.json({success:true,code:'SUCCESS',message:'ok',data:data[path]});};
  try{
    const review=await loadIncidentReview('i-1');
    const overlay=review.mapOverlay;
    assert.deepEqual(calls.filter(path=>path.endsWith('/routes')),['/api/delivery-plans/p-1/routes','/api/delivery-plans/p-2/routes']);
    assert.deepEqual(overlay.features.map(item=>[item.properties.plan,item.properties.route_id]),[['base','base-route'],['candidate','candidate-route']]);
    assert.deepEqual(overlay.incidentPoint,[103.7596,1.3039]);
  }finally{globalThis.fetch=original;}
});

test('invalid or absent route geometry leaves comparison reviewable without invented order segments',async()=>{
  const original=globalThis.fetch;
  const data={'/api/incidents/i-1':{...incident,incident_location:null},'/api/incidents/i-1/affected-orders':affected,'/api/incidents/i-1/recovery-plans':[ready],'/api/recovery-plans/r-2/comparison':comparison,'/api/delivery-plans/p-1/routes':[route('base-route','p-1','v-1',null)],'/api/delivery-plans/p-2/routes':[route('candidate-route','p-2','v-2',{type:'LineString',coordinates:[[200,1],[103.71,1.31]]})]};
  globalThis.fetch=async url=>Response.json({success:true,code:'SUCCESS',message:'ok',data:data[new URL(url,'http://localhost').pathname]});
  try{
    const review=await loadIncidentReview('i-1');
    const overlay=review.mapOverlay;
    assert.equal(review.comparison?.reviewable,true);
    assert.deepEqual(overlay.features,[]);
    assert.equal(overlay.incidentPoint,null);
    assert.deepEqual(overlay.missingPlans,['base','candidate']);
    assert.equal(overlay.orderSegmentsAvailable,false);
  }finally{globalThis.fetch=original;}
});

test('route returned under the wrong plan cannot be presented as Candidate geometry',async()=>{
  const original=globalThis.fetch;
  const data={'/api/incidents/i-1':incident,'/api/incidents/i-1/affected-orders':affected,'/api/incidents/i-1/recovery-plans':[ready],'/api/recovery-plans/r-2/comparison':comparison,'/api/delivery-plans/p-1/routes':[],'/api/delivery-plans/p-2/routes':[route('wrong','p-1','v-2',{type:'LineString',coordinates:[[103.70,1.30],[103.71,1.31]]})]};
  globalThis.fetch=async url=>Response.json({success:true,code:'SUCCESS',message:'ok',data:data[new URL(url,'http://localhost').pathname]});
  try{await assert.rejects(loadIncidentReview('i-1'),/Route does not belong to its requested plan/);}
  finally{globalThis.fetch=original;}
});
