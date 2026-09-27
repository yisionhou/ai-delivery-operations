import { briefingDemo } from './briefing-demo';
import { recoveryReviewSnapshots } from './recovery-review-demo';
import type { RecoveryCandidate, RecoveryLoader, RecoveryOptionsData, RoutePoint } from './recovery-types';

// Isolated illustrative data, not optimizer output or production telemetry.
const orders: RoutePoint[] = [{ id:'O18',x:30,y:28 },{ id:'O25',x:68,y:43 },{ id:'O31',x:46,y:74 }];
const originalRoute = [{ id:'V03',x:14,y:55 },...orders];
function candidate(id: string, title: string, description: string, assignments: string[], completion: number, distance: number, probability: number, reason: string): RecoveryCandidate {
  // O18 is on V03; O25/O31 have downstream timing exposure on otherwise available resources.
  const originalResources = ['V03','V06','V08'];
  const orderReassignments = orders.map((o,i) => ({
    orderId:o.id,fromResource:originalResources[i],toResource:assignments[i],
    ...(assignments[i] !== originalResources[i] ? {pickupMinutes:14+i*10,arrival:i === 0 ? '12:06' : '12:14'} : {}),
    impact:assignments[i] === originalResources[i] ? 'Original assignment' : 'Low impact',
  }));
  const resources = [...new Set(orderReassignments.filter(o=>o.toResource!==o.fromResource).map(o=>o.toResource))];
  return {id,label:id,title,description,reassignedOrdersCount:orderReassignments.filter(o=>o.toResource!==o.fromResource).length,
    completionImpactMinutes:completion,distanceImpactKm:distance,successProbability:probability,orderReassignments,
    routeImpact:{orders,originalRoute,recoveryRoutes:resources.map((id,i)=>({resource:{id,x:82-i*55,y:84-i*68},stops:orderReassignments.filter(o=>o.toResource===id).map(o=>o.orderId)}))},
    recommendationReason:reason,reviewSnapshot:recoveryReviewSnapshots[id]};
}
const candidates = [
  candidate('A','Minimum disruption','Keep most of the current plan unchanged.',['V05','V06','V08'],2,1.5,.95,'Reassigns the most time-sensitive order to V05 while preserving the remaining assignments. Review feasibility and delivery windows before approval.'),
  candidate('B','Faster recovery','Bring affected deliveries forward.',['V05','V07','V08'],-4,4.2,.91,'Uses two nearby resources to bring estimated completion forward. The trade-off is more reassignment and additional travel.'),
  candidate('C','Shorter distance','Reduce remaining travel distance.',['V02','V06','V08'],1,-6.8,.89,'Uses a nearby resource to shorten the remaining route. Check the small completion delay against the affected delivery windows.'),
];
export function createRecoveryDemo(count: number): RecoveryOptionsData {
  if (!Number.isInteger(count) || count < 0 || count > 3) throw new Error('Choose a demo outcome from zero to three candidates.');
  return structuredClone({
    source:'demo',incidentId:briefingDemo.incident.id,resourceId:briefingDemo.incident.vehicle,
    currentPlanId:briefingDemo.plan,totalOrdersCount:briefingDemo.totalOrders,
    affectedOrdersCount:briefingDemo.incident.affectedOrders.length,affectedOrderIds:briefingDemo.incident.affectedOrders,nearbyAvailableResourcesCount:8,
    candidates:candidates.slice(0,count),recommendedCandidateId:count ? 'A' : undefined,
    blockedReason:count ? undefined : 'No available resource meets the delivery-window and capacity constraints.',
  });
}
export const loadRecoveryDemo: RecoveryLoader = ({demoCandidateCount,signal}) => new Promise((resolve,reject) => {
  const abort = () => { clearTimeout(timer);reject(new DOMException('Planning cancelled','AbortError')); };
  const timer = setTimeout(() => {
    signal.removeEventListener('abort',abort);
    try { resolve(createRecoveryDemo(demoCandidateCount)); } catch (error) { reject(error); }
  },2300);
  if(signal.aborted) abort(); else signal.addEventListener('abort',abort,{once:true});
});
