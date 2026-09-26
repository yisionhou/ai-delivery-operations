import geometry from './incident-route-geometry.json';
import type {Coordinate,IncidentRecord,IncidentWorkspace,Comparison} from './incident-types';
export type {Coordinate,IncidentWorkspace,RouteMode,AffectedOrder} from './incident-types';

// Static fixtures represent service responses. No comparison is generated in React.
export const incident:IncidentRecord={
  id:'INC-007',type:'VEHICLE_UNAVAILABLE',typeLabel:'Vehicle Unavailable',subject:{id:'V03',kind:'vehicle'},
  region:'West Region',regionKey:'WEST REGION',area:'Jurong East',detectedAt:'10:42 AM',
  location:{lng:geometry.coordinates.incident[0],lat:geometry.coordinates.incident[1]},
  affectedOrders:4,affectedOrderIds:['O-021','O-024','O-028','O-031'],completedStopsProtected:3,status:'AWAITING_REVIEW',
};
const routeGeometry=geometry as unknown as IncidentWorkspace['routeGeometry'];
export const comparison:Comparison={
  businessDate:'2026-09-26',comparisonTime:'10:42:15 AM',basePlanId:'PLAN-BASE-007',candidatePlanId:'PLAN-REC-007-R1',candidateStatus:'READY',baseIsCurrent:true,comparable:true,approvalEligible:true,staleReason:null,
  assignmentChanges:[
    {orderId:'O-021',baseVehicle:'V03',candidateVehicle:'V05',baseState:'ASSIGNED',candidateState:'ASSIGNED',change:'Reassigned',reassigned:true,reason:'Vehicle V03 unavailable'},
    {orderId:'O-024',baseVehicle:'V03',candidateVehicle:'V05',baseState:'ASSIGNED',candidateState:'ASSIGNED',change:'Reassigned',reassigned:true,reason:'Vehicle V03 unavailable'},
    {orderId:'O-028',baseVehicle:'V03',candidateVehicle:'V02',baseState:'ASSIGNED',candidateState:'ASSIGNED',change:'Reassigned',reassigned:true,reason:'Vehicle V03 unavailable'},
    {orderId:'O-031',baseVehicle:'V03',candidateVehicle:'V02',baseState:'ASSIGNED',candidateState:'ASSIGNED',change:'Reassigned',reassigned:true,reason:'Vehicle V03 unavailable'},
  ],
  stopChanges:[
    {action:'Delivery',change:'Removed',vehicle:'V03',orders:['O-021','O-024','O-028','O-031'],location:'Jurong East / Clementi / West Coast',reason:'Four unfinished deliveries move off the unavailable vehicle.'},
    {action:'Handover',change:'Added',vehicle:'V05',orders:['O-021','O-024'],location:'V03 incident location · Jurong East',reason:'Receive loaded orders from V03; this is not a merchant pickup.'},
    {action:'Delivery',change:'Added',vehicle:'V05',orders:['O-021','O-024'],location:'Jurong East · Gateway / IMM',reason:'Two deliveries added after the handover.'},
    {action:'Handover',change:'Added',vehicle:'V02',orders:['O-028','O-031'],location:'V03 incident location · Jurong East',reason:'Receive loaded orders from V03; this is not a merchant pickup.'},
    {action:'Delivery',change:'Added',vehicle:'V02',orders:['O-028','O-031'],location:'Clementi / West Coast',reason:'Two deliveries added after the handover.'},
  ],
  etaChanges:[
    {orderId:'O-021',oldEta:'10:50 AM',newEta:'10:58 AM',delta:'+8 min',baseline:'Base snapshot · 10:42 AM',unavailableReason:null},
    {orderId:'O-024',oldEta:'10:56 AM',newEta:'11:04 AM',delta:'+8 min',baseline:'Base snapshot · 10:42 AM',unavailableReason:null},
    {orderId:'O-028',oldEta:'11:04 AM',newEta:'11:14 AM',delta:'+10 min',baseline:'Base snapshot · 10:42 AM',unavailableReason:null},
    {orderId:'O-031',oldEta:'11:12 AM',newEta:'11:24 AM',delta:'+12 min',baseline:'Base snapshot · 10:42 AM',unavailableReason:null},
  ],
  unassignedChanges:[],
  disturbanceSummary:{reassignedOrders:4,affectedVehicles:3,routeTasksChanged:10,routeSummary:'4 deliveries removed from V03; 4 deliveries and 2 handovers added to V05 / V02.',etaSummary:'+8–12 min across 4 affected orders',protectedWork:'3 completed stops preserved. Completed / frozen work excluded from changes.'},
  remainingMetrics:{
    distance:{comparable:false,base:null,candidate:null,delta:null,baseline:'Remaining travel at 10:42 AM',reason:'Historical base-plan remaining-distance snapshot is unavailable.'},
    duration:{comparable:false,base:null,candidate:null,delta:null,baseline:'Remaining travel at 10:42 AM',reason:'Historical base-plan remaining-duration snapshot is unavailable.'},
  },
  missingMetrics:[{metric:'Remaining distance',reason:'Historical base-plan remaining-distance snapshot is unavailable.'},{metric:'Remaining duration',reason:'Historical base-plan remaining-duration snapshot is unavailable.'}],
  mapChanges:{base:routeGeometry.original,candidate:routeGeometry.recovery,orderIds:['O-021','O-024','O-028','O-031'],vehicleIds:['V03','V05','V02']},
};
export const incidentWorkspace:IncidentWorkspace={
  // Explicit service fixture: all four unfinished V03 delivery legs are affected.
  // Completed geometry is separate. The renderer never derives this from plan diffs.
  affectedSegmentGeometry:routeGeometry.original,
  incident,basePlan:{id:'PLAN-BASE-007',businessDate:'2026-09-26',snapshotTime:'10:42 AM'},
  candidatePlan:{id:'PLAN-REC-007-R1',revision:1,status:'READY',unassigned:0,assignments:[{vehicle:'V05',orders:['O-021','O-024'],note:'Handover → Jurong East deliveries'},{vehicle:'V02',orders:['O-028','O-031'],note:'Handover → Clementi / West Coast'}]},
  comparison,
  affectedOrders:[
    {id:'O-021',customer:'Maya Tan',location:'Jurong East · Gateway',assignedTo:'V05',coordinate:geometry.coordinates.o21 as Coordinate},
    {id:'O-024',customer:'Daniel Lim',location:'Jurong East · IMM',assignedTo:'V05',coordinate:geometry.coordinates.o24 as Coordinate},
    {id:'O-028',customer:'Sofia Lee',location:'Clementi · Avenue 3',assignedTo:'V02',coordinate:geometry.coordinates.o28 as Coordinate},
    {id:'O-031',customer:'Amir Rahman',location:'West Coast · Plaza',assignedTo:'V02',coordinate:geometry.coordinates.o31 as Coordinate},
  ],
  recoveryVehicles:[{id:'V05',coordinate:geometry.coordinates.v05 as Coordinate,detail:'Recovery vehicle · 2 orders'},{id:'V02',coordinate:geometry.coordinates.v02 as Coordinate,detail:'Recovery vehicle · 2 orders'}],
  completedStops:[geometry.coordinates.done1,geometry.coordinates.done2,geometry.coordinates.done3] as Coordinate[],routeGeometry,
};
export const incidentWorkspaces:Record<string,IncidentWorkspace>={[incident.id]:incidentWorkspace};
