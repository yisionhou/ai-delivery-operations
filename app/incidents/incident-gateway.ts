import {canApproveCandidate} from './incident-types';
import type {IncidentGateway,IncidentWorkspace} from './incident-types';

// API seam: each action returns an authoritative workspace snapshot. The real
// service must validate base revision/eligibility atomically before dispatch.
// Demo adapter only; no real solver, vehicle mutation, GPS or automatic approval.
function withStatus(data:IncidentWorkspace,status:'APPLIED'|'REJECTED',reason:string):IncidentWorkspace{
  return {...data,incident:{...data.incident,status},candidatePlan:{...data.candidatePlan,status},comparison:{...data.comparison,candidateStatus:status,approvalEligible:false,staleReason:reason}};
}
export const mockIncidentGateway:IncidentGateway={
  async approve(data){
    if(!canApproveCandidate(data))throw new Error(data.comparison.staleReason??'Candidate is not eligible for approval.');
    return withStatus(data,'APPLIED','Candidate already applied. Monitoring the recovery.');
  },
  async reject(data,reason){
    if(data.candidatePlan.status==='APPLIED')throw new Error('An applied candidate cannot be rejected.');
    if(!reason.trim())throw new Error('Enter a rejection reason.');
    return withStatus(data,'REJECTED',`Dispatcher rejected: ${reason.trim()}`);
  },
  async modify(data,request){
    if(data.candidatePlan.status==='APPLIED')throw new Error('An applied candidate cannot be modified.');
    if(!data.comparison.baseIsCurrent)throw new Error('Refresh the current base plan before requesting a replan.');
    if(request.preserveCompletedWork!==true||request.recoveryVehicles!=='KEEP_PROPOSED'||![12,15].includes(request.maxAdditionalDelayMinutes))throw new Error('Unsupported P0 modification constraint.');
    // Predefined deterministic fixture: the same feasible route remains valid
    // under either supported cap. Return a NEW revision for human review.
    const revision=data.candidatePlan.revision+1,id=`${data.basePlan.id.replace('BASE','REC')}-R${revision}`;
    return {...data,incident:{...data.incident,status:'AWAITING_REVIEW'},candidatePlan:{...data.candidatePlan,id,revision,status:'READY'},comparison:{...data.comparison,candidatePlanId:id,candidateStatus:'READY',approvalEligible:true,staleReason:null}};
  },
};
