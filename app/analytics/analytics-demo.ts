import type {AnalyticsSnapshot} from './analytics-model';

export const DEMO_ANALYTICS_DATE='2026-09-27';

const incident={id:'INC-007',code:'INC-007',type:'Vehicle Unavailable',affectedOrderIds:['O-1001','O-1002','O-1003','O-1004','O-1005','O-1006'],handoverOrderIds:['O-1005'],frozenOrderIds:['O-1007']};
const orders=[
  {id:'O-1001',code:'ORD-1001',baseVehicle:'V01',candidateVehicle:'V03',etaDeltaSeconds:-1080},
  {id:'O-1002',code:'ORD-1002',baseVehicle:'V02',candidateVehicle:'V02',etaDeltaSeconds:0},
  {id:'O-1003',code:'ORD-1003',baseVehicle:'V04',candidateVehicle:'V01',etaDeltaSeconds:720},
  {id:'O-1004',code:'ORD-1004',baseVehicle:'V03',candidateVehicle:null,etaDeltaSeconds:null},
  {id:'O-1005',code:'ORD-1005',baseVehicle:'V01',candidateVehicle:'V04',etaDeltaSeconds:480},
  {id:'O-1006',code:'ORD-1006',baseVehicle:null,candidateVehicle:null,etaDeltaSeconds:null},
  {id:'O-1007',code:'ORD-1007',baseVehicle:'V02',candidateVehicle:'V02',etaDeltaSeconds:0},
];

const shared={source:'demo',businessDate:DEMO_ANALYTICS_DATE,incident,basePlan:'PLAN-BASE-007',ratePerKm:0.25,distanceSource:'Demo routing estimate · fixed assumption'} as const;

export const demoAnalyticsSnapshots:AnalyticsSnapshot[]=[
  {
    ...shared,attempt:{id:'REC-007-1',number:1,status:'FAILED',solverStatus:'INFEASIBLE',validationStatus:'NOT_RUN',scope:'Affected vehicle only',decision:null,candidateVersion:null},
    candidatePlan:null,orders:[],remaining:{baseDistanceMeters:null,candidateDistanceMeters:null,baseDurationSeconds:null,candidateDurationSeconds:null,reason:'No feasible Candidate was produced by this attempt.'},
  },
  {
    ...shared,attempt:{id:'REC-007-2',number:2,status:'READY',solverStatus:'FEASIBLE',validationStatus:'PASSED',scope:'Affected orders and recovery vehicles',decision:null,candidateVersion:'V5'},
    candidatePlan:'PLAN-REC-007-V5',orders,
    remaining:{baseDistanceMeters:186200,candidateDistanceMeters:198600,baseDurationSeconds:102240,candidateDurationSeconds:108360,reason:null},
  },
  {
    source:'demo',businessDate:DEMO_ANALYTICS_DATE,
    incident:{id:'INC-009',code:'INC-009',type:'Merchant Delay',affectedOrderIds:['O-2001','O-2002'],handoverOrderIds:[],frozenOrderIds:[]},
    attempt:{id:'REC-009-1',number:1,status:'READY',solverStatus:'FEASIBLE',validationStatus:'PASSED',scope:'Delayed merchant orders',decision:null,candidateVersion:'V2'},
    basePlan:'PLAN-BASE-009',candidatePlan:'PLAN-REC-009-V2',ratePerKm:0.25,distanceSource:'Demo routing estimate · fixed assumption',
    orders:[
      {id:'O-2001',code:'ORD-2001',baseVehicle:'V06',candidateVehicle:'V07',etaDeltaSeconds:-300},
      {id:'O-2002',code:'ORD-2002',baseVehicle:'V07',candidateVehicle:null,etaDeltaSeconds:null},
    ],
    remaining:{baseDistanceMeters:50000,candidateDistanceMeters:54500,baseDurationSeconds:28800,candidateDurationSeconds:30000,reason:null},
  },
];
