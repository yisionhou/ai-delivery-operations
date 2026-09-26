import assert from 'node:assert/strict';
import {test} from 'node:test';
import {buildAnalytics,barWidths,coverageRatio} from './analytics-model.ts';
import {demoAnalyticsSnapshots} from './analytics-demo.ts';

const sample={
  source:'demo',businessDate:'2026-09-27',incident:{id:'I1',code:'INC-1',type:'Vehicle Unavailable',affectedOrderIds:['1','2','3','4','5','6'],handoverOrderIds:['5'],frozenOrderIds:['7']},
  attempt:{id:'A2',number:2,status:'READY',solverStatus:'FEASIBLE',validationStatus:'PASSED',scope:'Affected orders',decision:null,candidateVersion:'V2'},
  basePlan:'BASE',candidatePlan:'CAND',ratePerKm:0.25,distanceSource:'demo routing estimate',
  orders:[
    {id:'1',code:'O-1',baseVehicle:'V1',candidateVehicle:'V3',etaDeltaSeconds:-1080},
    {id:'2',code:'O-2',baseVehicle:'V2',candidateVehicle:'V2',etaDeltaSeconds:0},
    {id:'3',code:'O-3',baseVehicle:'V4',candidateVehicle:'V1',etaDeltaSeconds:720},
    {id:'4',code:'O-4',baseVehicle:'V3',candidateVehicle:null,etaDeltaSeconds:null},
    {id:'5',code:'O-5',baseVehicle:'V1',candidateVehicle:'V4',etaDeltaSeconds:480},
    {id:'6',code:'O-6',baseVehicle:null,candidateVehicle:null,etaDeltaSeconds:null},
    {id:'7',code:'O-7',baseVehicle:'V2',candidateVehicle:'V2',etaDeltaSeconds:0},
  ],
  remaining:{baseDistanceMeters:186200,candidateDistanceMeters:198600,baseDurationSeconds:102240,candidateDurationSeconds:108360,reason:null},
};

test('one snapshot drives recovery coverage, reassignment and cost consistently',()=>{
  const view=buildAnalytics(sample);
  assert.equal(view.recovered,4);
  assert.equal(view.affected,6);
  assert.equal(view.reassigned,3);
  assert.equal(view.distanceChangeKm,12.4);
  assert.equal(view.baseCost,46.55);
  assert.equal(view.candidateCost,49.65);
  assert.equal(view.costChange,3.10);
  assert.equal(view.rows.find(row=>row.id==='5').result,'Handover');
  assert.equal(view.rows.find(row=>row.id==='3').etaDeltaSeconds,720);
  assert.equal(view.assigned.base,6);
  assert.equal(view.assigned.candidate,5);
});

test('coverage preserves the actual fraction and handles invalid denominators',()=>{
  assert.deepEqual(coverageRatio(4,6),{ratio:4/6,label:'67%'});
  assert.deepEqual(coverageRatio(0,6),{ratio:0,label:'0%'});
  assert.deepEqual(coverageRatio(6,6),{ratio:1,label:'100%'});
  assert.deepEqual(coverageRatio(0,0),{ratio:null,label:'N/A'});
  assert.deepEqual(coverageRatio(7,6),{ratio:null,label:'Unavailable'});
});

test('each bar pair uses one scale and missing values stay missing',()=>{
  assert.deepEqual(barWidths(24,23),[1,23/24]);
  assert.deepEqual(barWidths(0,0),[0,0]);
  assert.deepEqual(barWidths(null,23),[null,1]);
});

test('backend mileage costs require an explicit rate',()=>{
  const view=buildAnalytics({...sample,source:'api',ratePerKm:null,remaining:{...sample.remaining,baseDistanceMeters:null,reason:'Base snapshot unavailable'}});
  assert.equal(view.baseCost,null);
  assert.equal(view.costChange,null);
  assert.equal(view.distanceChangeKm,null);
  assert.equal(view.distanceReason,'Base snapshot unavailable');
});

test('official backend reassignment count takes precedence over local inference',()=>{
  assert.equal(buildAnalytics({...sample,officialReassignedCount:2}).reassigned,2);
});

test('an attempt without a candidate does not invent recovery metrics',()=>{
  const view=buildAnalytics({...sample,candidatePlan:null,orders:[],remaining:{baseDistanceMeters:null,candidateDistanceMeters:null,baseDurationSeconds:null,candidateDurationSeconds:null,reason:'No candidate plan'}});
  assert.equal(view.recovered,null);
  assert.equal(view.reassigned,null);
  assert.equal(view.assigned.candidate,null);
  assert.equal(view.coverage.ratio,null);
});

test('the demo fixture is internally consistent across attempts',()=>{
  const ready=demoAnalyticsSnapshots.find(item=>item.attempt.id==='REC-007-2');
  const failed=demoAnalyticsSnapshots.find(item=>item.attempt.id==='REC-007-1');
  assert.ok(ready);
  assert.ok(failed);
  const view=buildAnalytics(ready);
  assert.deepEqual([view.recovered,view.affected,view.reassigned,view.distanceChangeKm,view.costChange],[4,6,3,12.4,3.1]);
  assert.equal(view.rows.filter(row=>row.result==='Frozen').length,1);
  assert.equal(buildAnalytics(failed).coverage.ratio,null);
});
