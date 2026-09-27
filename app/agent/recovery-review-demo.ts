import type { CandidateComparison } from './recovery-types';
import type { TaskChange } from '../incidents/incident-types';

// Candidate-specific demo snapshots, authored at the fixture boundary.
// No historical ETA, distance, or protected-work count is fabricated from current UI data.
const missingDistance='Historical base-plan remaining-distance snapshot unavailable.';
const missingDuration='Historical base-plan remaining-duration snapshot unavailable.';
const missingEta='Historical base-plan ETA snapshot unavailable.';
const protectedReason='Completed-stop and unchanged-task counts were not supplied in this candidate snapshot.';
const baseline='PLAN-023 snapshot · 26 Sep 2026, 10:24 AM';
const pendingTasks=(order:string,from:string,to:string):TaskChange[]=>[
  {action:'Pickup',change:'Removed',vehicle:from,orders:[order],location:'Merchant location unavailable',reason:'Remove the pending merchant pickup from the original route.'},
  {action:'Delivery',change:'Removed',vehicle:from,orders:[order],location:'Delivery location unavailable',reason:'Remove the unfinished delivery from the original route.'},
  {action:'Pickup',change:'Added',vehicle:to,orders:[order],location:'Merchant location unavailable',reason:'One pending merchant pickup is assigned to the candidate vehicle. This fixture contains no loaded-order handover.'},
  {action:'Delivery',change:'Added',vehicle:to,orders:[order],location:'Delivery location unavailable',reason:'Deliver after the pending pickup. Completed work is excluded from this change set.'},
];
function snapshot(id:string,targets:[string,string,string],reassigned:number,vehicles:number,tasks:TaskChange[],taskCount:number,routeSummary:string,etaSummary:string):CandidateComparison{
  return {
    orders:[
      {id:'O18',location:'Location unavailable in candidate snapshot',monitorLabel:'REASSIGNMENT MONITOR',monitorReason:'Monitor pickup and delivery after moving this time-sensitive order off unavailable V03.'},
      {id:'O25',location:'Location unavailable in candidate snapshot',monitorLabel:'DELIVERY WINDOW MONITOR',monitorReason:id==='B'?'Monitor the changed pickup sequence on V07 and the affected delivery window.':'Assignment remains on V06. Monitor the affected delivery window in this recovery scenario.'},
      {id:'O31',location:'Location unavailable in candidate snapshot',monitorLabel:'UNCHANGED · AFFECTED WORK',monitorReason:'Assignment remains on V08. Monitor downstream exposure in the same incident; no reassignment is proposed.'},
    ],
    comparison:{
      businessDate:'2026-09-26',comparisonTime:'10:24 AM',basePlanId:'PLAN-023',candidatePlanId:`PLAN-023-REC-${id}`,
      candidateStatus:'READY',baseIsCurrent:true,comparable:true,approvalEligible:true,staleReason:null,
      assignmentChanges:[
        {orderId:'O18',baseVehicle:'V03',candidateVehicle:targets[0],baseState:'ASSIGNED',candidateState:'ASSIGNED',change:'Reassigned',reassigned:true,reason:'Vehicle V03 unavailable'},
        {orderId:'O25',baseVehicle:'V06',candidateVehicle:targets[1],baseState:'ASSIGNED',candidateState:'ASSIGNED',change:id==='B'?'Reassigned':'Unchanged',reassigned:id==='B',reason:id==='B'?'Bring the affected delivery forward.':'Preserve the original assignment.'},
        {orderId:'O31',baseVehicle:'V08',candidateVehicle:targets[2],baseState:'ASSIGNED',candidateState:'ASSIGNED',change:'Unchanged',reassigned:false,reason:'Preserve the original assignment.'},
      ],
      stopChanges:tasks,
      etaChanges:[
        {orderId:'O18',oldEta:null,newEta:'12:06',delta:null,baseline,unavailableReason:missingEta},
        {orderId:'O25',oldEta:null,newEta:id==='B'?'12:14':null,delta:null,baseline,unavailableReason:id==='B'?missingEta:'Base and candidate ETA snapshots unavailable for this unchanged assignment.'},
        {orderId:'O31',oldEta:null,newEta:null,delta:null,baseline,unavailableReason:'Base and candidate ETA snapshots unavailable for this unchanged assignment.'},
      ],
      unassignedChanges:[],
      disturbanceSummary:{reassignedOrders:reassigned,affectedVehicles:vehicles,routeTasksChanged:taskCount,routeSummary,etaSummary,
        protectedWork:'Completed and frozen work are excluded from the proposed task changes.',
        completedStopsProtected:null,routeTasksUnchanged:null,protectedCountsUnavailableReason:protectedReason},
      remainingMetrics:{
        distance:{comparable:false,base:null,candidate:null,delta:null,reason:missingDistance,baseline},
        duration:{comparable:false,base:null,candidate:null,delta:null,reason:missingDuration,baseline},
      },
      missingMetrics:[{metric:'Remaining distance',reason:missingDistance},{metric:'Remaining duration',reason:missingDuration},{metric:'Order ETA changes',reason:missingEta},{metric:'Protected execution counts',reason:protectedReason}],
      mapChanges:{base:{type:'LineString',coordinates:[]},candidate:{},orderIds:[],vehicleIds:[]},
    },
  };
}
export const recoveryReviewSnapshots:Record<string,CandidateComparison>={
  A:snapshot('A',['V05','V06','V08'],1,2,pendingTasks('O18','V03','V05'),4,'One pending pickup and delivery move from V03 to V05. O25 and O31 retain their assignments.','Candidate completion impact: +2 min. Per-order historical ETA comparison is unavailable.'),
  B:snapshot('B',['V05','V07','V08'],2,4,[...pendingTasks('O18','V03','V05'),...pendingTasks('O25','V06','V07')],8,'Pending pickup and delivery tasks move from V03 to V05 and from V06 to V07. O31 remains on V08.','Candidate completion impact: −4 min. Per-order historical ETA comparison is unavailable.'),
  C:snapshot('C',['V02','V06','V08'],1,2,pendingTasks('O18','V03','V02'),4,'One pending pickup and delivery move from V03 to V02. O25 and O31 retain their assignments.','Candidate completion impact: +1 min. Per-order historical ETA comparison is unavailable.'),
};
