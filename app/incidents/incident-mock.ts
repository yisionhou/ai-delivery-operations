// Presentation-ready API contract. Risk, assignments and route changes are supplied,
// never inferred in the UI from raw plans. Candidate comparison can consume this
// same candidate-set shape later without creating another approval workspace.
export type RouteMode = 'current' | 'recovery' | 'changes';
export type RecoveryState = 'ready' | 'applied';
export type CandidateStatus = 'ready' | 'stale' | 'applied';
export interface AffectedOrder {
  id: string; customer: string; location: string; originalEta: string; newEta: string;
  assignedTo: 'V02' | 'V05'; point: [number, number]; oldRoute: string; newRoute: string;
}
export interface RecoveryCandidate {
  id: string; status: CandidateStatus; revision: number; unassigned: number;
  assignments: { vehicle: string; orders: string[]; note: string }[];
}
export const incident = {
  id: 'INC-007', type: 'Vehicle Unavailable', vehicle: 'V03', region: 'West Region',
  detectedAt: '10:42 AM', affectedOrders: 4, completedStopsProtected: 3,
  deliveryRisk: 'Medium', currentDelayEstimate: '+8–12 min', position: [380, 290] as [number, number],
};
export const affectedOrders: AffectedOrder[] = [
  { id: 'O-021', customer: 'Maya Tan', location: 'Jurong East · Gateway', originalEta: '10:50 AM', newEta: '10:58 AM', assignedTo: 'V05', point: [490, 210], oldRoute: 'M380 290 H430 V210 H490', newRoute: 'M230 170 H340 V210 H490' },
  { id: 'O-024', customer: 'Daniel Lim', location: 'Jurong East · IMM', originalEta: '10:56 AM', newEta: '11:04 AM', assignedTo: 'V05', point: [610, 310], oldRoute: 'M380 290 H430 V210 H540 V310 H610', newRoute: 'M230 170 H340 V210 H540 V310 H610' },
  { id: 'O-028', customer: 'Sofia Lee', location: 'Clementi · Avenue 3', originalEta: '11:04 AM', newEta: '11:14 AM', assignedTo: 'V02', point: [590, 430], oldRoute: 'M380 290 H430 V210 H540 V310 H650 V430 H590', newRoute: 'M790 470 H710 V430 H590' },
  { id: 'O-031', customer: 'Amir Rahman', location: 'West Coast · Plaza', originalEta: '11:12 AM', newEta: '11:24 AM', assignedTo: 'V02', point: [420, 500], oldRoute: 'M380 290 H430 V210 H540 V310 H650 V430 H540 V500 H420', newRoute: 'M790 470 H710 V430 H540 V500 H420' },
];
export const candidateSet: {id: string; selectedCandidateId: string; candidates: RecoveryCandidate[]} = {
  id: 'CS-007', selectedCandidateId: 'C-007-A', candidates: [{
    id: 'C-007-A', status: 'ready', revision: 1, unassigned: 0,
    assignments: [
      { vehicle: 'V05', orders: ['O-021', 'O-024'], note: 'Jurong East · 2 stops' },
      { vehicle: 'V02', orders: ['O-028', 'O-031'], note: 'Clementi / West Coast · 2 stops' },
    ],
  }],
};
export const recoveryVehicles = [
  {id: 'V05', point: [230, 170], detail: 'Available capacity · 2 orders'},
  {id: 'V02', point: [790, 470], detail: 'Available capacity · 2 orders'},
] as const;
export const completedStops = [[160, 370], [270, 370], [320, 290]] as const;
export const timeline = [
  {time: '10:42:00', title: 'Vehicle unavailable detected', detail: 'V03 stopped near Jurong East. Incident INC-007 opened.'},
  {time: '10:42:04', title: 'Assessing impact', detail: '4 pending orders affected; 3 completed stops protected.'},
  {time: '10:42:09', title: 'Generating route', detail: 'Candidate C-007-A assigns remaining stops to V05 and V02.'},
  {time: '10:42:12', title: 'Validating constraints', detail: 'Mock validation complete: capacity and delivery windows checked.'},
  {time: '10:42:15', title: 'Ready for approval', detail: 'Dispatch remains unchanged until an operator approves.'},
];
export interface DispatchGateway {
  approve: (incidentId: string, candidateId: string, revision: number) => Promise<{status: 'applied'}>;
}
// Replace this adapter with the API; the server must validate candidate freshness
// and constraints at approval. This mock never dispatches to real vehicles.
export const mockDispatchGateway: DispatchGateway = {
  async approve() { return {status: 'applied'}; },
};
