import {orderTiming} from './order-timing.ts';
export const executions=['PLANNED','PICKUP_IN_PROGRESS','PICKED_UP','DELIVERING','COMPLETED'] as const;
export const risks=['NORMAL','AT_RISK'] as const;
export type Order={id:string;code:string;merchant:string;execution:string;risk:string;assignment:string|null;vehicle:string|null;eta:string|null;windowStart:string|null;windowEnd:string|null};
export type Snapshot={orders:Order[];hasCurrentPlan:boolean;warnings:string[];source:'API'|'DEMO'};
export type Filters={date:string;execution:string;risk:string};
export function mergeOrderPage(page:Order[],snapshot:Order[]):Order[]{
  const byId=new Map(snapshot.map(order=>[order.id,order]));
  return page.map(order=>{
    const detail=byId.get(order.id);
    return detail?{...order,merchant:detail.merchant,assignment:detail.assignment,vehicle:detail.vehicle,eta:detail.eta}:order;
  });
}
// Dashboard calculated_at is the backend's UTC calculation time, never simulated time.
let baseline:{server:number;monotonic:number;mode:'api'|'demo'}|null=null;
export const operationalClock={
  now:()=>baseline?baseline.server+performance.now()-baseline.monotonic:Date.now(),
  reset:()=>{baseline=null;},
  synchronize:(value:string,requestStarted:number)=>{const server=timestamp(value);if(server!==null){const received=performance.now();baseline={server:server+(received-requestStarted)/2,monotonic:received,mode:'api'};}},
  demo:(value:string)=>{const server=timestamp(value);if(server!==null&&(baseline?.mode!=='demo'||baseline.server!==server))baseline={server,monotonic:performance.now(),mode:'demo'};},
};
export function timestamp(value:string|null){if(!value)return null;const n=Date.parse(value);return Number.isFinite(n)?n:null;}
export function riskGroup(o:Order){return o.execution!=='COMPLETED'&&o.risk==='AT_RISK';}
export function critical(o:Order,now:number){return !riskGroup(o)&&orderTiming(o,now).kind==='closing';}
export function standard(o:Order,now:number,executionFilter:string){return !riskGroup(o)&&!critical(o,now)&&(o.execution!=='COMPLETED'||executionFilter==='COMPLETED');}
export function deadlineSort(a:Order,b:Order){return (timestamp(a.windowEnd)??Infinity)-(timestamp(b.windowEnd)??Infinity)||a.code.localeCompare(b.code)||a.id.localeCompare(b.id);}
export function countdown(o:Order,now:number){return orderTiming(o,now).label;}
export function time(value:string|null){const n=timestamp(value);return n===null?'Unavailable':new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Singapore',hour:'2-digit',minute:'2-digit'}).format(n);}
export function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Singapore',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
export const label=(value:string)=>value.replaceAll('_',' ');
