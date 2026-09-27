import type { Comparison } from '../incidents/incident-types';
export type RecoveryReviewState = 'review' | 'dispatch-ready' | 'preview-applied';
export type CandidateComparison = {
  comparison: Comparison;
  orders: {id:string;location:string;monitorLabel?:string;monitorReason?:string}[];
};
export type OrderReassignment = {
  orderId: string; fromResource: string; toResource: string;
  pickupMinutes?: number; arrival?: string; impact: string;
};
export type RoutePoint = { id: string; x: number; y: number };
export type RouteImpact = {
  orders: RoutePoint[]; originalRoute: RoutePoint[];
  recoveryRoutes: { resource: RoutePoint; stops: string[] }[];
};
export type RecoveryCandidate = {
  id: string; label: string; title: string; description: string;
  reassignedOrdersCount: number; completionImpactMinutes: number|null; distanceImpactKm: number|null;
  successProbability?: number; orderReassignments: OrderReassignment[];
  validationStatus?: string;
  routeImpact: RouteImpact; recommendationReason: string;
  explanationSource?: string;
  reviewSnapshot?: CandidateComparison;
};
export type RecoveryOptionsData = {
  source: 'demo' | 'live'; incidentId: string; resourceId: string; currentPlanId: string;
  totalOrdersCount: number; affectedOrdersCount: number; affectedOrderIds: string[]; nearbyAvailableResourcesCount: number|null;
  candidates: RecoveryCandidate[]; recommendedCandidateId?: string; blockedReason?: string;
};
export type RecoveryRequest = { incidentId: string; demoCandidateCount: number; signal: AbortSignal };
/** Adapter boundary. Returning zero candidates is a valid result, never a transport error. */
export type RecoveryLoader = (request: RecoveryRequest) => Promise<RecoveryOptionsData>;
export type RecoveryScene = 'briefing' | 'transitioning-in' | 'options' | 'transitioning-out';
export type RecoveryUIState = 'transitioning-in' | 'generating' | 'options-ready' | 'candidate-detail' | 'manual-intervention' | 'candidate-selected' | 'error';

export function validateRecoveryResult(data: RecoveryOptionsData): RecoveryOptionsData {
  if (data.affectedOrdersCount !== data.affectedOrderIds.length) throw new Error('Affected order totals do not match.');
  if (data.candidates.length > 3) throw new Error('Recovery supports a maximum of three candidates.');
  if (new Set(data.candidates.map(c => c.id)).size !== data.candidates.length) throw new Error('Candidate IDs must be unique.');
  if (data.recommendedCandidateId && !data.candidates.some(c => c.id === data.recommendedCandidateId)) throw new Error('Recommended candidate was not returned.');
  for (const c of data.candidates) {
    if (c.reassignedOrdersCount !== c.orderReassignments.filter(o => o.fromResource !== o.toResource).length) throw new Error('Candidate reassignment totals do not match.');
    if (c.successProbability !== undefined && (c.successProbability < 0 || c.successProbability > 1)) throw new Error('Invalid feasibility estimate.');
    if(c.reviewSnapshot){
      const comparison=c.reviewSnapshot.comparison;
      if(comparison.basePlanId!==data.currentPlanId||comparison.disturbanceSummary.reassignedOrders!==c.reassignedOrdersCount)throw new Error('Candidate comparison does not match the selected plan.');
      for(const change of comparison.assignmentChanges){
        const order=c.orderReassignments.find(item=>item.orderId===change.orderId);
        if(!order||order.fromResource!==change.baseVehicle||order.toResource!==change.candidateVehicle)throw new Error('Candidate comparison assignment mismatch.');
      }
    }
  }
  return data;
}
