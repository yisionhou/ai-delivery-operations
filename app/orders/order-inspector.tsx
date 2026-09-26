"use client";
import {useEffect,useRef,useState} from 'react';
import {Check,ChevronRight,Clock3,MapPin,Route,Truck,UserRound,X} from 'lucide-react';
import VehicleTimeGauge from '../vehicles/vehicle-time-gauge';
import {loadOrderDetail} from './order-gateway';
import {demoOrderDetail} from './order-demo';
import {label,type Order} from './order-data';
import {mergeListFacts,type OrderDetail} from './order-detail';
import {orderTiming} from './order-timing';

const cache=new Map<string,OrderDetail>();
const sgt=(value:string|null,seconds=false)=>{const n=value?Date.parse(value):NaN;return Number.isFinite(n)?new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Singapore',hour:'2-digit',minute:'2-digit',...(seconds?{second:'2-digit'}:{})}).format(n):'—';};
const duration=(seconds:number|null)=>seconds===null?'Not provided':`${Math.floor(seconds/60)} min${seconds%60?` ${seconds%60} sec`:''}`;
type Props={id:string;date:string;source:'api'|'demo';listOrder:Order|null;now:number;historical:boolean;onClose:()=>void};

export default function OrderInspector({id,date,source,listOrder,now,historical,onClose}:Props){
  const closeButton=useRef<HTMLButtonElement>(null),[detail,setDetail]=useState<OrderDetail|null>(null),[error,setError]=useState<string|null>(null),[retry,setRetry]=useState(0);
  const key=`${source}|${date}|${id}`;
  useEffect(()=>{closeButton.current?.focus();},[]);
  useEffect(()=>{
    const controller=new AbortController(),cached=cache.get(key);
    Promise.resolve().then(()=>cached&&retry===0?cached:source==='demo'?demoOrderDetail(id,date):loadOrderDetail(id,date,listOrder,controller.signal)).then(raw=>{
      if(controller.signal.aborted)return;
      const value=mergeListFacts(raw,listOrder);
      cache.set(key,value);if(cache.size>40)cache.delete(cache.keys().next().value!);
      setDetail(value);setError(null);
    }).catch(reason=>{if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:'Order details could not be loaded.');});
    return()=>controller.abort();
  },[key,id,date,source,listOrder,retry]);
  const actualDelivery=detail?.stops.find(stop=>stop.kind==='DELIVERY'&&stop.status==='COMPLETED')?.actual??null;
  const timing=detail?orderTiming({...detail.order,deliveredAt:actualDelivery},now):null;
  const pressure=timing?.kind==='overdue'?'OVERDUE':timing?.kind==='closing'?'TIME CRITICAL':timing?.kind!=='completed'&&detail?.order.risk==='AT_RISK'?'AT RISK':null;
  const metricTitle=timing?.kind==='overdue'?'Overdue':timing?.kind==='closing'?'Closes In':actualDelivery&&timing?.kind==='completed'?'Delivered At':timing?.kind==='completed'?'Delivery Status':timing?.kind==='before'?'Window Starts':timing?.kind==='unavailable'?'Time Unavailable':'Time Remaining';
  const metricValue=actualDelivery&&timing?.kind==='completed'?sgt(actualDelivery):timing?.kind==='before'?sgt(detail?.order.windowStart??null):timing?.label??'—';
  const middle=timing?.kind==='overdue'?`Overdue by ${timing.label}`:timing?.kind==='closing'?`Closes in ${timing.label}`:timing?.kind==='remaining'?`Time remaining ${timing.label}`:timing?.label??'Timeline unavailable';
  const routeAvailable=!!detail?.planCode&&!!detail?.routeId&&!!detail?.vehicleId;
  return <aside id="order-inspector" className="vf-inspector or-inspector" aria-label="Order details">
    <div className="vf-inspector-scroll"><header className="vf-inspector-header"><div className="vf-inspector-title"><h2>{detail?.order.code??listOrder?.code??id}</h2>{detail&&<><span className="or-detail-badge">{label(detail.order.execution)}</span>{pressure&&<span className={`or-detail-badge ${timing?.kind==='overdue'?'danger':timing?.kind==='closing'?'warning':''}`}>{pressure}</span>}</>}</div><button ref={closeButton} className="vf-inspector-close" type="button" onClick={onClose} aria-label="Close order details"><X/></button></header>
      {!detail&&!error?<div className="or-inspector-loading" aria-label="Loading order details"><div className="or-detail-skeleton or-skeleton"/><div className="or-detail-skeleton or-skeleton"/><div className="or-detail-skeleton or-skeleton"/><div className="or-detail-skeleton or-skeleton"/></div>:error?<div className="or-detail-error" role="alert"><strong>Order details unavailable</strong><p>{error}</p><button onClick={()=>{cache.delete(key);setError(null);setRetry(n=>n+1);}}>Retry</button></div>:detail&&<div className="vf-inspector-content" key={id}>
        <dl className="vf-inspector-facts"><div><dt>Merchant</dt><dd>{detail.order.merchant}</dd></div><div><dt>Route</dt><dd>{detail.order.merchant} → {detail.delivery.name}</dd></div><div><dt>Date</dt><dd>{detail.businessDate}{source==='demo'?' · Demo data':''}</dd></div></dl>
        <div className="vf-inspector-metrics or-detail-metrics"><article><strong>{sgt(detail.order.eta)}</strong><span>Delivery ETA{!detail.order.eta?' · Not supplied':''}</span></article><article><strong>{sgt(detail.order.windowEnd)}</strong><span>Window Ends</span></article><article className={timing?.kind==='overdue'?'danger':timing?.kind==='closing'?'warning':''}><strong>{metricValue}</strong><span>{metricTitle}{timing?.kind==='unavailable'?historical?' · Historical snapshot':' · Window missing':''}</span></article></div>
        <section className="vf-inspector-section" aria-labelledby="or-time-title"><div className="vf-inspector-section-title"><h3 id="or-time-title"><Clock3/>Delivery Timeline</h3><small>All times in SGT</small></div>
          {timing?.kind==='unavailable'?<p className="vf-inspector-empty">Timeline unavailable · {historical?'Historical business date has no live countdown.':'Delivery window timing is missing or invalid.'}</p>:timing?.kind==='completed'&&!actualDelivery?<p className="vf-inspector-empty">Delivery recorded as completed. Actual delivery time was not supplied.</p>:timing&&timing.progress!==null?<VehicleTimeGauge start={sgt(detail.order.windowStart)} current={sgt(actualDelivery&&timing.kind==='completed'?actualDelivery:new Date(now).toISOString(),true)} currentPrefix={actualDelivery&&timing.kind==='completed'?'Recorded arrival':'Current time'} end={sgt(detail.order.windowEnd)} percent={timing.progress} leftCaption="Window start" middleCaption={timing.kind==='completed'?`Delivered ${sgt(actualDelivery)}`:middle} rightCaption="Window end" indicatorLabel={`${timing.kind==='completed'?'Recorded arrival':'Current time'} at ${Math.round(timing.progress)}% of delivery window`}/>:<p className="vf-inspector-empty">Timeline unavailable</p>}
        </section>
        <section className="vf-inspector-section" aria-labelledby="or-journey-title"><div className="vf-inspector-section-title"><h3 id="or-journey-title"><Route/>Order Journey</h3></div>
          {!detail.routeId?<p className="vf-inspector-empty">No current route assigned. Order stop records are unavailable.</p>:detail.stops.length?<><ol className="vf-execution-list or-journey">{detail.stops.map(stop=><li key={stop.id} className={stop.status==='COMPLETED'?'done':['ARRIVED','IN_SERVICE'].includes(stop.status)?'current':''}><span className="vf-execution-node">{stop.status==='COMPLETED'&&<Check/>}</span><div className="vf-execution-place"><strong>{stop.location}</strong><small>{stop.kind} · Planned {sgt(stop.planned)}{stop.actual?` · Actual ${sgt(stop.actual)}`:' · Actual not recorded'}</small></div><span className="vf-execution-status">{stop.kind==='DELIVERY'&&detail.order.execution==='DELIVERING'&&stop.status==='PLANNED'?'ON ROUTE':label(stop.status)}</span></li>)}</ol>{!detail.stops.some(stop=>stop.kind==='PICKUP')&&<p className="vf-inspector-empty">Historical pickup record was not supplied.</p>}</>:<p className="vf-inspector-empty">No stops for this order were supplied.</p>}
        </section>
        <section className="vf-inspector-section" aria-labelledby="or-places-title"><div className="vf-inspector-section-title"><h3 id="or-places-title"><MapPin/>Pickup &amp; Delivery</h3></div><div className="or-place-grid"><article><h4>Pickup · {detail.order.merchant}</h4><p>{detail.pickup.name}</p><address>{detail.pickup.address??'Address not provided'}</address><dl><div><dt>Ready time</dt><dd>{sgt(detail.readyAt)}</dd></div><div><dt>Pickup service time</dt><dd>{duration(detail.pickupServiceSeconds)}</dd></div></dl></article><article><h4>Delivery · {detail.delivery.name}</h4><address>{detail.delivery.address??'Address not provided'}</address><dl><div><dt>Delivery window</dt><dd>{sgt(detail.order.windowStart)} – {sgt(detail.order.windowEnd)}</dd></div><div><dt>Delivery service time</dt><dd>{duration(detail.deliveryServiceSeconds)}</dd></div></dl></article></div></section>
        <section className="vf-inspector-section" aria-labelledby="or-assignment-title"><div className="vf-inspector-section-title"><h3 id="or-assignment-title"><UserRound/>Assignment</h3></div><dl className="or-assignment"><div><dt>Vehicle</dt><dd>{detail.order.vehicle??'Unassigned'}</dd></div><div><dt>Driver</dt><dd>{detail.driverCode??'Not supplied'}</dd></div><div><dt>Demand</dt><dd>{detail.demand===null?'Not supplied':`${detail.demand} load unit${detail.demand===1?'':'s'}`}</dd></div><div><dt>Plan</dt><dd>{detail.planCode??'No Current Plan'}</dd></div><div><dt>Route</dt><dd>{detail.routeNo!==null?`Route ${detail.routeNo}`:detail.routeId??'No current route'}</dd></div></dl>{routeAvailable?<a className="or-vehicle-link" href={`/vehicles?source=${source}&business_date=${date}&selected_vehicle=${encodeURIComponent(detail.vehicleId!)}`}><Truck/>View vehicle details<ChevronRight/></a>:<p className="vf-inspector-empty">Vehicle details unavailable without a Current Plan and route.</p>}</section>
      </div>}
    </div>
  </aside>;
}
