import roadGeometry from './operations-road-routes.json';

export type Coordinate = [number, number];
export type StopKind = 'PICKUP' | 'DELIVERY' | 'HANDOVER';
export type Stop = {id:string; kind:StopKind; order:string; place:string; at:string; point:Coordinate; execution:'WAITING'|'IN_PROGRESS'|'COMPLETED'; risk:'NORMAL'|'AT_RISK'};
export type Route = {id:string; vehicle:string; driver:string; distanceKm:number; durationMin:number; utilization:number; status:'PLANNED'|'ON_ROUTE'|'AT_RISK'|'UNAVAILABLE'|'COMPLETED'|'CANCELLED'; vehicleStatus?:'AVAILABLE'|'ACTIVE'|'UNAVAILABLE'; routeExecutionStatus?:'PLANNED'|'ACTIVE'|'COMPLETED'|'CANCELLED'; stops:Stop[]; path:Coordinate[]; firstDeliveryPathIndex:number;geometrySource?:'STORED_GEOMETRY'|'STOP_CONNECTORS'};
export type Alert = {id:string; title:string; detail:string; level:'risk'|'incident'; incidentId?:string; vehicle:string};
export type OperationsSnapshot = {source:'DEMO'|'API'; businessDate:string; plan:{id:string;code?:string;version:number;status:'DRAFT'|'CURRENT'}|null; routes:Route[]; alerts:Alert[]; readiness:{orders:number;merchantsReady:number;merchantsPreparing:number;merchantsDelayed:number;vehicles:number;drivers:number}; unassigned:{order:string;reason:string}[]; constraintSummary:string[];onTimeRate?:number|null;positions?:Record<string,Coordinate>};
export const DEMO_BUSINESS_DATE='2026-09-26';

// Explicit frontend fixture. These are not responses from PenroseRoute APIs.
const routeRows:Omit<Route,'path'|'firstDeliveryPathIndex'|'distanceKm'>[]=[
  {id:'R-01',vehicle:'V01',driver:'D-01',durationMin:84,utilization:76,status:'ON_ROUTE',stops:[
    {id:'S-01',kind:'PICKUP',order:'O-012',place:'Jurong East Merchant',at:'10:20',point:[103.785,1.307],execution:'COMPLETED',risk:'NORMAL'},
    {id:'S-02',kind:'DELIVERY',order:'O-012',place:'Queenstown',at:'10:48',point:[103.814,1.296],execution:'IN_PROGRESS',risk:'NORMAL'},
    {id:'S-03',kind:'DELIVERY',order:'O-018',place:'Marina Bay',at:'11:16',point:[103.864,1.285],execution:'WAITING',risk:'NORMAL'}]},
  {id:'R-02',vehicle:'V02',driver:'D-02',durationMin:96,utilization:82,status:'AT_RISK',stops:[
    {id:'S-04',kind:'PICKUP',order:'O-020',place:'Bukit Batok Merchant',at:'10:24',point:[103.747,1.334],execution:'COMPLETED',risk:'NORMAL'},
    {id:'S-05',kind:'DELIVERY',order:'O-020',place:'Clementi',at:'10:56',point:[103.801,1.311],execution:'IN_PROGRESS',risk:'AT_RISK'},
    {id:'S-06',kind:'DELIVERY',order:'O-022',place:'Buona Vista',at:'11:22',point:[103.836,1.301],execution:'WAITING',risk:'AT_RISK'}]},
  {id:'R-03',vehicle:'V03',driver:'D-03',durationMin:67,utilization:68,status:'UNAVAILABLE',stops:[
    {id:'S-07',kind:'PICKUP',order:'O-021',place:'Jurong Merchant',at:'10:28',point:[103.740,1.324],execution:'COMPLETED',risk:'NORMAL'},
    {id:'S-08',kind:'DELIVERY',order:'O-021',place:'Jurong East',at:'10:52',point:[103.756,1.322],execution:'IN_PROGRESS',risk:'AT_RISK'},
    {id:'S-09',kind:'DELIVERY',order:'O-024',place:'IMM',at:'10:58',point:[103.765,1.320],execution:'WAITING',risk:'AT_RISK'},
    {id:'S-13',kind:'DELIVERY',order:'O-028',place:'Clementi',at:'11:07',point:[103.778,1.314],execution:'WAITING',risk:'AT_RISK'},
    {id:'S-14',kind:'DELIVERY',order:'O-031',place:'West Coast',at:'11:14',point:[103.788,1.309],execution:'WAITING',risk:'AT_RISK'}]},
  {id:'R-04',vehicle:'V04',driver:'D-04',durationMin:101,utilization:71,status:'ON_ROUTE',stops:[
    {id:'S-10',kind:'PICKUP',order:'O-037',place:'Tampines Merchant',at:'10:30',point:[103.942,1.351],execution:'COMPLETED',risk:'NORMAL'},
    {id:'S-11',kind:'DELIVERY',order:'O-037',place:'Paya Lebar',at:'11:02',point:[103.890,1.334],execution:'IN_PROGRESS',risk:'NORMAL'},
    {id:'S-12',kind:'DELIVERY',order:'O-041',place:'Kallang',at:'11:28',point:[103.852,1.305],execution:'WAITING',risk:'NORMAL'}]},
];
const roads=roadGeometry.routes as unknown as Record<string,{path:Coordinate[];firstDeliveryPathIndex:number;waypoints:Coordinate[];distanceKm:number}>;
const routes:Route[]=routeRows.map(route=>{
  const road=roads[route.id];
  if(!road||road.waypoints.length!==route.stops.length)throw new Error(`Missing road geometry for ${route.id}`);
  return {...route,distanceKm:road.distanceKm,path:road.path,firstDeliveryPathIndex:road.firstDeliveryPathIndex,stops:route.stops.map((stop,index)=>({...stop,point:road.waypoints[index]}))};
});

const fixture:OperationsSnapshot={source:'DEMO',businessDate:DEMO_BUSINESS_DATE,plan:null,routes,alerts:[
  {id:'A-01',title:'Delivery window at risk',detail:'O-020 and O-022 · Route R-02',level:'risk',vehicle:'V02'},
  {id:'INC-007',title:'Vehicle unavailable',detail:'V03 · Jurong East · recovery review',level:'incident',incidentId:'INC-007',vehicle:'V03'},
],readiness:{orders:10,merchantsReady:4,merchantsPreparing:0,merchantsDelayed:0,vehicles:4,drivers:4},unassigned:[],constraintSummary:['Pickup before delivery','Vehicle load capacity','Merchant ready times','Delivery time windows']};

export interface OperationsAdapter {
  load(date?:string,signal?:AbortSignal):Promise<OperationsSnapshot>;
  generate(snapshot:OperationsSnapshot):Promise<OperationsSnapshot>;
  confirm(snapshot:OperationsSnapshot):Promise<OperationsSnapshot>;
}

const pause=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
export const demoOperationsAdapter:OperationsAdapter={
  async load(){return structuredClone(fixture);},
  async generate(snapshot){await pause(700);return {...snapshot,plan:{id:'PLAN-BASE-007',version:4,status:'DRAFT'}};},
  async confirm(snapshot){await pause(350);if(!snapshot.plan||snapshot.plan.status!=='DRAFT')throw new Error('Generate and review a plan first.');return {...snapshot,plan:{...snapshot.plan,status:'CURRENT'}};},
};
