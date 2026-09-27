import type {AnalyticsSnapshot} from './analytics-model';

// Static snapshot of penrose_route_demo_rebuilt, 2026-09-27. The other two
// resolved merchant-delay incidents have no recovery attempt to compare.
export const DEMO_ANALYTICS_DATE='2026-09-27';

const orderId=(n:number)=>`40000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const incident={
  id:'9debda7f-2aaa-4eed-b817-68725da6dd9d',
  code:'INC-20260927-F5677A5FC22B',
  type:'Vehicle Unavailable',
  affectedOrderIds:[2,18,22].map(orderId),
  handoverOrderIds:[2,18,22].map(orderId),
  frozenOrderIds:[orderId(14)],
};

const order=(n:number,candidateVehicle:string,etaDeltaSeconds:number|null)=>({
  id:orderId(n),code:`ORD-20260927-${String(n).padStart(3,'0')}`,
  baseVehicle:'VEH-001',candidateVehicle,etaDeltaSeconds,
});

const shared={
  source:'demo',businessDate:DEMO_ANALYTICS_DATE,incident,
  basePlan:'PLAN-20260927-V1',ratePerKm:null,
  distanceSource:'No comparable remaining-route snapshot',
  // API reason: NO_COMPARABLE_REMAINDER_SNAPSHOT.
  remaining:{baseDistanceMeters:null,candidateDistanceMeters:null,baseDurationSeconds:null,candidateDurationSeconds:null,reason:'No comparable remaining-route snapshot is available for this recovery attempt.'},
} as const;

export const demoAnalyticsSnapshots:AnalyticsSnapshot[]=[
  {
    ...shared,
    attempt:{id:'0c0d9777-ae0a-4c84-91e5-6bf79a391001',number:1,status:'DRAFT',solverStatus:'INFEASIBLE',validationStatus:null,scope:'AFFECTED_ROUTE',decision:null,candidateVersion:null},
    candidatePlan:null,orders:[],
  },
  {
    ...shared,
    attempt:{id:'21ba8ed2-a18a-4005-bcb1-c7c7a845b5d1',number:2,status:'PENDING_REVIEW',solverStatus:'FEASIBLE',validationStatus:'VALID',scope:'CROSS_ROUTE',decision:null,candidateVersion:'V2'},
    candidatePlan:'PLAN-20260927-V2',
    orders:[order(2,'VEH-002',1271),order(14,'VEH-001',null),order(18,'VEH-002',-229),order(22,'VEH-003',0)],
    officialReassignedCount:3,
    assignmentTotals:{baseAssigned:74,candidateAssigned:74,baseUnassigned:0,candidateUnassigned:0},
  },
];
