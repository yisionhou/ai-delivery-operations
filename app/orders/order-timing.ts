export type TimeKind='unavailable'|'completed'|'before'|'remaining'|'closing'|'now'|'overdue';
type TimedOrder={execution:string;windowStart:string|null;windowEnd:string|null;deliveredAt?:string|null};
export type OrderTiming={kind:TimeKind;label:string;progress:number|null};

const duration=(seconds:number)=>`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
export function orderTiming(order:TimedOrder,now:number):OrderTiming{
  const start=order.windowStart?Date.parse(order.windowStart):NaN;
  const end=order.windowEnd?Date.parse(order.windowEnd):NaN;
  const delivered=order.deliveredAt?Date.parse(order.deliveredAt):NaN;
  const completed=order.execution==='COMPLETED'||Number.isFinite(delivered);
  const observed=Number.isFinite(delivered)?delivered:now;
  if(!Number.isFinite(start)||!Number.isFinite(end)||!Number.isFinite(observed)||end<=start)return completed?{kind:'completed',label:'Completed',progress:null}:{kind:'unavailable',label:'—',progress:null};
  const progress=Math.max(0,Math.min(100,(observed-start)/(end-start)*100));
  if(completed)return {kind:'completed',label:'Completed',progress};
  if(now<start)return {kind:'before',label:'Window not started',progress:0};
  if(now===end)return {kind:'now',label:'Window closes now',progress:100};
  if(now>end)return {kind:'overdue',label:duration(Math.floor((now-end)/1000)),progress:100};
  const remaining=Math.ceil((end-now)/1000);
  return {kind:end-now<300000?'closing':'remaining',label:duration(remaining),progress};
}
