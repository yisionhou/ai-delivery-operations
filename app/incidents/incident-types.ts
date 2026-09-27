import type {LineString} from 'geojson';
export type Coordinate=[number,number];
export type RouteMode='current'|'recovery'|'changes';
export type IncidentType='VEHICLE_UNAVAILABLE'|'MERCHANT_DELAY';
export type CandidateStatus='READY'|'STALE'|'REPLANNING'|'REJECTED'|'APPLIED'|'FAILED';
export interface IncidentRecord {
  id:string;type:IncidentType;typeLabel:string;subject:{id:string;kind:'vehicle'|'merchant'};
  region:string;regionKey:string;area:string;detectedAt:string;location:{lng:number;lat:number};
  affectedOrders:number;affectedOrderIds:string[];completedStopsProtected:number;status:'AWAITING_REVIEW'|'APPLIED'|'REJECTED';
}
export interface AffectedOrder {id:string;customer:string;location:string;coordinate:Coordinate;assignedTo:string}
export interface AssignmentChange {
  orderId:string;baseVehicle:string|null;candidateVehicle:string|null;baseState:'ASSIGNED'|'UNASSIGNED';candidateState:'ASSIGNED'|'UNASSIGNED';
  change:string;reassigned:boolean;reason:string;
}
export interface EtaChange {orderId:string;oldEta:string|null;newEta:string|null;delta:string|null;baseline:string;unavailableReason:string|null}
export interface TaskChange {action:'Pickup'|'Delivery'|'Handover';change:'Added'|'Removed'|'Reordered'|'Modified';vehicle:string;orders:string[];location:string;reason:string}
export interface RemainingMetric {comparable:boolean;base:string|null;candidate:string|null;delta:string|null;reason:string|null;baseline:string}
export interface Comparison {
  businessDate:string;comparisonTime:string;basePlanId:string;candidatePlanId:string;candidateStatus:CandidateStatus;
  baseIsCurrent:boolean;comparable:boolean;approvalEligible:boolean;staleReason:string|null;
  assignmentChanges:AssignmentChange[];stopChanges:TaskChange[];etaChanges:EtaChange[];
  unassignedChanges:{orderId:string;from:'ASSIGNED'|'UNASSIGNED';to:'ASSIGNED'|'UNASSIGNED';reason:string}[];
  disturbanceSummary:{reassignedOrders:number;affectedVehicles:number;routeTasksChanged:number;routeSummary:string;etaSummary:string;protectedWork:string;completedStopsProtected?:number|null;routeTasksUnchanged?:number|null;protectedCountsUnavailableReason?:string};
  remainingMetrics:{distance:RemainingMetric;duration:RemainingMetric};missingMetrics:{metric:string;reason:string}[];
  // Explicit comparison overlay geometry supplied by the mock/backend; UI does not diff plans.
  mapChanges:{base:LineString;candidate:Record<string,LineString>;orderIds:string[];vehicleIds:string[]};
}
export interface CandidatePlan {id:string;revision:number;status:CandidateStatus;unassigned:number;assignments:{vehicle:string;orders:string[];note:string}[]}
export interface IncidentWorkspace {
  incident:IncidentRecord;basePlan:{id:string;businessDate:string;snapshotTime:string};candidatePlan:CandidatePlan;comparison:Comparison;
  affectedOrders:AffectedOrder[];recoveryVehicles:{id:string;coordinate:Coordinate;detail:string}[];completedStops:Coordinate[];
  affectedSegmentGeometry:LineString;
  routeGeometry:{completed:LineString;affected:LineString;original:LineString;recovery:Record<string,LineString>;orders:Record<string,{old:LineString;recovery:LineString}>};
}
export interface ModifyRequest {preserveCompletedWork:true;recoveryVehicles:'KEEP_PROPOSED';maxAdditionalDelayMinutes:12|15}
export interface IncidentGateway {
  approve:(data:IncidentWorkspace)=>Promise<IncidentWorkspace>;
  reject:(data:IncidentWorkspace,reason:string)=>Promise<IncidentWorkspace>;
  modify:(data:IncidentWorkspace,request:ModifyRequest)=>Promise<IncidentWorkspace>;
}
export function canApproveCandidate(data:IncidentWorkspace){
  return data.comparison.approvalEligible===true&&data.comparison.baseIsCurrent&&data.candidatePlan.status==='READY';
}
