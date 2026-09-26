export type AnalyticsOrder={id:string;code:string;baseVehicle:string|null;candidateVehicle:string|null;etaDeltaSeconds:number|null};
export type AnalyticsSnapshot={
  source:'demo'|'api';businessDate:string;
  incident:{id:string;code:string;type:string;affectedOrderIds:string[];handoverOrderIds:string[];frozenOrderIds:string[]};
  attempt:{id:string;number:number;status:string;solverStatus:string|null;validationStatus:string|null;scope:string|null;decision:string|null;candidateVersion:string|null};
  basePlan:string;candidatePlan:string|null;ratePerKm:number|null;distanceSource:string;
  orders:AnalyticsOrder[];
  officialReassignedCount?:number;
  remaining:{baseDistanceMeters:number|null;candidateDistanceMeters:number|null;baseDurationSeconds:number|null;candidateDurationSeconds:number|null;reason:string|null};
};
export type AnalyticsRow=AnalyticsOrder&{result:'Reassigned'|'Frozen'|'Handover'|'Unassigned'|'Newly Assigned'|'Unchanged'};

export function coverageRatio(recovered:number|null,affected:number|null){
  if(recovered===null||affected===null)return {ratio:null,label:'—'};
  if(!Number.isInteger(recovered)||!Number.isInteger(affected)||recovered<0||affected<0||recovered>affected)return {ratio:null,label:'Unavailable'};
  if(affected===0)return {ratio:null,label:'N/A'};
  const ratio=recovered/affected;
  return {ratio,label:`${Math.round(ratio*100)}%`};
}

export function barWidths(base:number|null,candidate:number|null):[number|null,number|null]{
  const valid=(value:number|null)=>value!==null&&Number.isFinite(value)&&value>=0;
  const maximum=Math.max(valid(base)?base!:0,valid(candidate)?candidate!:0);
  return [valid(base)?maximum?base!/maximum:0:null,valid(candidate)?maximum?candidate!/maximum:0:null];
}

const money=(value:number)=>Math.round((value+Number.EPSILON)*100)/100;
export function buildAnalytics(snapshot:AnalyticsSnapshot){
  const hasCandidate=snapshot.candidatePlan!==null;
  const affectedSet=new Set(snapshot.incident.affectedOrderIds);
  const handoverSet=new Set(snapshot.incident.handoverOrderIds);
  const frozenSet=new Set(snapshot.incident.frozenOrderIds);
  const affected=snapshot.incident.affectedOrderIds.length;
  const recovered=hasCandidate?snapshot.orders.filter(order=>affectedSet.has(order.id)&&order.candidateVehicle!==null).length:null;
  const reassigned=hasCandidate?snapshot.officialReassignedCount??snapshot.orders.filter(order=>order.baseVehicle!==null&&order.candidateVehicle!==null&&order.baseVehicle!==order.candidateVehicle).length:null;
  const rows:AnalyticsRow[]=snapshot.orders.map(order=>({...order,result:frozenSet.has(order.id)?'Frozen':order.candidateVehicle===null?'Unassigned':order.baseVehicle===null?'Newly Assigned':handoverSet.has(order.id)?'Handover':order.baseVehicle!==order.candidateVehicle?'Reassigned':'Unchanged'}));
  const {baseDistanceMeters,candidateDistanceMeters,baseDurationSeconds,candidateDurationSeconds,reason}=snapshot.remaining;
  const distanceReady=hasCandidate&&baseDistanceMeters!==null&&candidateDistanceMeters!==null;
  const rate=snapshot.ratePerKm;
  const costReady=distanceReady&&rate!==null&&Number.isFinite(rate)&&rate>=0;
  return {
    snapshot,affected,recovered,reassigned,rows,coverage:coverageRatio(recovered,affected),
    assigned:{base:hasCandidate?snapshot.orders.filter(order=>order.baseVehicle!==null).length:null,candidate:hasCandidate?snapshot.orders.filter(order=>order.candidateVehicle!==null).length:null},
    unassigned:{base:hasCandidate?snapshot.orders.filter(order=>order.baseVehicle===null).length:null,candidate:hasCandidate?snapshot.orders.filter(order=>order.candidateVehicle===null).length:null},
    distance:{base:hasCandidate&&baseDistanceMeters!==null?baseDistanceMeters/1000:null,candidate:hasCandidate&&candidateDistanceMeters!==null?candidateDistanceMeters/1000:null},
    duration:{base:hasCandidate&&baseDurationSeconds!==null?baseDurationSeconds/3600:null,candidate:hasCandidate&&candidateDurationSeconds!==null?candidateDurationSeconds/3600:null},
    distanceChangeKm:distanceReady?(candidateDistanceMeters-baseDistanceMeters)/1000:null,
    distanceReason:distanceReady?null:reason??'Comparable remaining distance is unavailable.',
    durationReason:hasCandidate&&baseDurationSeconds!==null&&candidateDurationSeconds!==null?null:reason??'Comparable remaining travel time is unavailable.',
    baseCost:costReady?money(baseDistanceMeters/1000*rate):null,
    candidateCost:costReady?money(candidateDistanceMeters/1000*rate):null,
    costChange:costReady?money((candidateDistanceMeters-baseDistanceMeters)/1000*rate):null,
    costReason:rate===null?'Rate not configured':distanceReady?null:reason??'Comparable remaining distance is unavailable.',
  };
}
