"use client";
import {useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {useSearchParams} from 'next/navigation';
import VehicleShell from '../vehicles/vehicle-shell';
import PriorityRail from './priority-rail';
import OrderInspector from './order-inspector';
import {loadDemo,loadOrderPage,loadOrders} from './order-gateway';
import {critical,deadlineSort,executions,label,mergeOrderPage,operationalClock,riskGroup,risks,time,today,type Order,type Snapshot} from './order-data';
import {DEMO_DATE} from './order-demo';
import {orderTiming} from './order-timing';

const pageSize=8;
export default function OrdersWorkspace(){
  const params=useSearchParams();
  const source=params.get('source')==='demo'?'demo':'api',date=params.get('business_date')||(source==='demo'?DEMO_DATE:today()),execution=executions.includes(params.get('execution') as typeof executions[number])?params.get('execution')!:'All',risk=risks.includes(params.get('risk') as typeof risks[number])?params.get('risk')!:'All';
  const page=Math.max(1,Math.floor(Number(params.get('page'))||1)),selected=params.get('selected_order');
  const [snapshot,setSnapshot]=useState<Snapshot|null>(null),[error,setError]=useState<string|null>(null),[busy,setBusy]=useState(true),[revision,setRevision]=useState(0),[now,setNow]=useState(0),[updated,setUpdated]=useState<number|null>(null);
  const loadedKey=useRef(''),requestKey=`${date}|${execution}|${risk}|${source}`,root=useRef<HTMLDivElement>(null);
  const pageKey=`${requestKey}|${page}`;
  const [pageSnapshot,setPageSnapshot]=useState<{key:string;data:Awaited<ReturnType<typeof loadOrderPage>>}|null>(null),[pageError,setPageError]=useState<string|null>(null),[pageBusy,setPageBusy]=useState(true);
  const [draft,setDraft]=useState({key:requestKey,date,execution,risk});
  const currentDraft=draft.key===requestKey?draft:{key:requestKey,date,execution,risk};
  const clockKey=useRef('');
  const previousRects=useRef(new Map<string,{rect:DOMRect;kind:string}>());
  const previousRows=useRef(new Map<string,{rect:DOMRect;clone:HTMLElement}>()),motionContext=useRef('');
  const navigate=useCallback((changes:Record<string,string|null>,reset=false)=>{const p=new URLSearchParams(window.location.search);if(reset){p.set('page','1');p.delete('selected_order');}for(const [key,value]of Object.entries(changes)){if(value===null)p.delete(key);else p.set(key,value);}window.history.replaceState(null,'',`/orders?${p}`);},[]);
  const submitQuery=()=>{if(currentDraft.date===date&&currentDraft.execution===execution&&currentDraft.risk===risk&&page===1){setRevision(value=>value+1);return;}navigate({business_date:currentDraft.date,execution:currentDraft.execution,risk:currentDraft.risk},true);};
  useEffect(()=>{const tick=()=>setNow(operationalClock.now());tick();const id=setInterval(tick,1000);return()=>clearInterval(id);},[]);
  useEffect(()=>{const id=setInterval(()=>{if(document.visibilityState==='visible')setRevision(r=>r+1);},15000);return()=>clearInterval(id);},[]);
  useEffect(()=>{
    const controller=new AbortController(),changed=loadedKey.current!==requestKey;
    Promise.resolve().then(()=>{if(controller.signal.aborted)return null;if(changed){if(clockKey.current!==`${source}|${date}`){operationalClock.reset();clockKey.current=`${source}|${date}`;}setSnapshot(null);setUpdated(null);setError(null);}setBusy(true);return (source==='demo'?loadDemo:loadOrders)({date,execution,risk},controller.signal);}).then(data=>{if(data&&!controller.signal.aborted){setSnapshot(data);setError(null);setNow(operationalClock.now());setUpdated(operationalClock.now());loadedKey.current=requestKey;}}).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Orders could not be loaded.');}).finally(()=>{if(!controller.signal.aborted)setBusy(false);});
    return()=>controller.abort();
  },[date,execution,risk,source,revision,requestKey]);
  useEffect(()=>{
    const controller=new AbortController();
    Promise.resolve().then(()=>{if(controller.signal.aborted)return null;setPageBusy(true);setPageError(null);return loadOrderPage({date,execution,risk},page,pageSize,source,controller.signal);}).then(data=>{if(data&&!controller.signal.aborted)setPageSnapshot({key:pageKey,data});}).catch(reason=>{if(!controller.signal.aborted)setPageError(reason instanceof Error?reason.message:'Order page could not be loaded.');}).finally(()=>{if(!controller.signal.aborted)setPageBusy(false);});
    return()=>controller.abort();
  },[date,execution,risk,source,page,pageKey,revision]);
  const orders=useMemo(()=>[...(snapshot?.orders??[])].sort((a,b)=>a.code.localeCompare(b.code)||a.id.localeCompare(b.id)),[snapshot]);
  const historical=source==='api'&&now>0&&date!==new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Singapore',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const activeNow=historical?NaN:now;
  const rowStatus=(order:Order)=>order.execution==='COMPLETED'?'Completed':historical?'Historical snapshot':orderTiming(order,activeNow).kind==='unavailable'?'Timing unavailable':'Normal status';
  const atRisk=orders.filter(riskGroup).sort(deadlineSort),urgent=orders.filter(o=>critical(o,activeNow)).sort(deadlineSort);
  const pageData=pageSnapshot?.key===pageKey?pageSnapshot.data:null;
  const rows=mergeOrderPage(pageData?.items??[],orders),currentPage=pageData?.page??page,pages=pageData?.totalPages??1,total=pageData?.total??0;
  const initial=pageBusy&&!pageData,railLoading=busy&&!snapshot;
  const signature=atRisk.map(o=>o.id).join('|')+' / '+urgent.map(o=>o.id).join('|')+' / '+rows.map(o=>o.id).join('|');
  const context=`${requestKey}|${currentPage}`;
  useLayoutEffect(()=>{
    const nodes=root.current?.querySelectorAll<HTMLElement>('[data-rail-order]');if(!nodes)return;
    const animations:Animation[]=[],ghosts:HTMLElement[]=[],hidden:HTMLElement[]=[];
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches||motionContext.current!==context;
    const next=new Map<string,{rect:DOMRect;kind:string}>();
    nodes.forEach(node=>{const id=node.dataset.railOrder!,rect=node.getBoundingClientRect(),kind=node.dataset.kind!,prev=previousRects.current.get(id);next.set(id,{rect,kind});if(reduced)return;
      if(prev?.kind==='critical'&&kind==='risk'){
        const ghost=node.cloneNode(true) as HTMLElement;ghost.removeAttribute('data-rail-order');ghost.removeAttribute('data-kind');ghost.setAttribute('aria-hidden','true');ghost.tabIndex=-1;ghost.classList.add('or-promotion');Object.assign(ghost.style,{position:'fixed',left:`${rect.left}px`,top:`${rect.top}px`,width:`${rect.width}px`,height:`${rect.height}px`,zIndex:'80',pointerEvents:'none'});document.body.appendChild(ghost);ghosts.push(ghost);node.style.visibility='hidden';hidden.push(node);
        const animation=ghost.animate([{transform:`translate(${prev.rect.left-rect.left}px,${prev.rect.top-rect.top}px)`,'--rail':'#edbf85','--edge':'#d1a374','--glow':'#dfac6229','--inner':'#ae713115',borderColor:'#d1a374',opacity:1},{transform:'translate(0,0)','--rail':'#e66c5c','--edge':'#cf6252','--glow':'#d6534328','--inner':'#7e292815',borderColor:'#cf6252',opacity:1}],{duration:400,easing:'cubic-bezier(.2,.7,.2,1)'});animations.push(animation);animation.onfinish=()=>{ghost.remove();node.style.visibility='';};
      }else if(prev&&(prev.rect.left!==rect.left||prev.rect.top!==rect.top)){animations.push(node.animate([{transform:`translate(${prev.rect.left-rect.left}px,${prev.rect.top-rect.top}px)`},{transform:'translate(0,0)'}],{duration:400,easing:'ease-out'}));}
    });previousRects.current=next;
    const nextRows=new Map<string,{rect:DOMRect;clone:HTMLElement}>();
    root.current?.querySelectorAll<HTMLElement>('[data-order-id]').forEach(node=>{const id=node.dataset.orderId!,rect=node.getBoundingClientRect(),prev=previousRows.current.get(id);nextRows.set(id,{rect,clone:node.cloneNode(true) as HTMLElement});if(!reduced&&prev&&prev.rect.top!==rect.top)animations.push(node.animate([{transform:`translateY(${prev.rect.top-rect.top}px)`},{transform:'translateY(0)'}],{duration:400,easing:'cubic-bezier(.2,.7,.2,1)'}));});
    if(!reduced){previousRows.current.forEach((prev,id)=>{if(nextRows.has(id)||!next.has(id))return;
      // An inert visual exit copy lets the real row leave the queue immediately.
      const ghost=document.createElement('div');ghost.className='or-all or-exit-row';ghost.setAttribute('aria-hidden','true');ghost.inert=true;Object.assign(ghost.style,{position:'fixed',left:`${prev.rect.left}px`,top:`${prev.rect.top}px`,width:`${prev.rect.width}px`,height:`${prev.rect.height}px`,zIndex:'60',pointerEvents:'none'});const table=document.createElement('table'),body=document.createElement('tbody');prev.clone.removeAttribute('data-order-id');body.appendChild(prev.clone);table.appendChild(body);ghost.appendChild(table);document.body.appendChild(ghost);ghosts.push(ghost);const animation=ghost.animate([{opacity:.8,transform:'translateY(0)'},{opacity:0,transform:'translateY(-18px)'}],{duration:400,easing:'ease-out'});animations.push(animation);animation.onfinish=()=>ghost.remove();
    });}
    previousRows.current=nextRows;motionContext.current=context;
    return()=>{animations.forEach(a=>a.cancel());ghosts.forEach(g=>g.remove());hidden.forEach(n=>n.style.visibility='');};
  },[signature,context]);
  const backVehicle=params.get('vehicle_id');
  const closeDrawer=useCallback(()=>{const id=selected;navigate({selected_order:null});window.requestAnimationFrame(()=>{const target=Array.from(root.current?.querySelectorAll<HTMLElement>('[data-rail-order],[data-order-id]')??[]).find(node=>node.dataset.railOrder===id||node.dataset.orderId===id);(target?.matches('button')?target:target?.querySelector('button'))?.focus();});},[selected,navigate]);
  useEffect(()=>{if(!selected)return;const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape')closeDrawer();};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);},[selected,closeDrawer]);
  return <VehicleShell activePage="orders"><div className={`or-page ${selected?'or-inspector-open':''}`} ref={root} onScrollCapture={()=>{root.current?.querySelectorAll<HTMLElement>('[data-rail-order]').forEach(n=>{const previous=previousRects.current.get(n.dataset.railOrder!);if(previous&&previous.kind===n.dataset.kind)previous.rect=n.getBoundingClientRect();});root.current?.querySelectorAll<HTMLElement>('[data-order-id]').forEach(n=>{const previous=previousRows.current.get(n.dataset.orderId!);if(previous)previous.rect=n.getBoundingClientRect();});}}>
    <header className="or-header"><div><h1>Orders</h1><p>Real-time order execution and delivery status</p></div><div className="or-updated"><small>Last updated · SGT</small><time>{updated?new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Singapore',hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(updated):'—'}</time></div></header>
    <div className="or-controls"><label>Business Date<input aria-label="Business Date" type="date" value={currentDraft.date} onChange={e=>setDraft({...currentDraft,date:e.target.value})}/></label><label>Execution<select aria-label="Execution" value={currentDraft.execution} onChange={e=>setDraft({...currentDraft,execution:e.target.value})}>{['All',...executions].map(v=><option key={v} value={v}>{label(v)}</option>)}</select></label><label>Risk<select aria-label="Risk" value={currentDraft.risk} onChange={e=>setDraft({...currentDraft,risk:e.target.value})}>{['All',...risks].map(v=><option key={v} value={v}>{label(v)}</option>)}</select></label><button disabled={busy||pageBusy||!currentDraft.date} onClick={submitQuery}>{busy||pageBusy?'Querying…':'Query'}</button></div>
    {source==='demo'&&<p className="or-notice">DEMO DATA · Separate demonstration fixtures</p>}
    {snapshot&&!snapshot.hasCurrentPlan&&<p className="or-notice"><strong>No active delivery plan</strong> · Assignments and ETA are unavailable until a plan becomes current.</p>}
    {(error||pageError)&&<div className="or-error" role="alert"><strong>Unable to load orders</strong><span>{pageData?'Showing the last successful page. ':''}{pageError??error}</span><button onClick={()=>setRevision(r=>r+1)}>Retry</button></div>}
    {snapshot?.warnings.map(w=><div className="or-notice" key={w}>{w} <button onClick={()=>setRevision(r=>r+1)}>Retry</button></div>)}
    <PriorityRail kind="risk" orders={atRisk} now={activeNow} loading={railLoading} selected={selected} onSelect={id=>navigate({selected_order:id})}/>
    <PriorityRail kind="critical" orders={urgent} now={activeNow} loading={railLoading} selected={selected} onSelect={id=>navigate({selected_order:id})}/>
    <section className="or-all" aria-label="All orders"><header><h2>ALL ORDERS <span>{pageData?total:'—'}</span></h2><small>Full filtered list · priority rails above are highlights · {pageSize} per page</small></header>
      <div className="or-table-wrap" aria-busy={initial}><table><thead><tr>{['','Order','Merchant','Execution','Vehicle / Assignment','Delivery ETA','Delivery Window · SGT',''].map((v,i)=><th key={i} scope="col">{i===0?<span className="sr-only">Status</span>:v}</th>)}</tr></thead><tbody>{initial?Array.from({length:8},(_,i)=><tr key={i}><td colSpan={8}><div className="or-row-skeleton or-skeleton"/></td></tr>):rows.map(o=><tr key={o.id} data-order-id={o.id} aria-selected={selected===o.id} className={selected===o.id?'selected':''} onClick={()=>navigate({selected_order:o.id})}><td className="or-status-cell"><span className="or-status-dot" title={rowStatus(o)} role="img" aria-label={rowStatus(o)}/></td><td><button className="or-select" aria-label={`Select ${o.code}`} onClick={e=>{e.stopPropagation();navigate({selected_order:o.id});}}>{o.code}</button></td><td>{o.merchant}</td><td>{label(o.execution)}</td><td>{o.vehicle??(snapshot?.hasCurrentPlan?'Unassigned':'Unavailable')}<small>{o.assignment?label(o.assignment):'No current plan'}</small></td><td>{o.eta?time(o.eta):'Unavailable'}</td><td>{o.windowStart?`${time(o.windowStart)} – `:''}{time(o.windowEnd)}</td><td aria-hidden="true">›</td></tr>)}</tbody></table>{!initial&&pageData&&rows.length===0&&<div className="or-empty">{orders.length?'No orders in this view.':execution!=='All'||risk!=='All'?'No orders match these filters.':snapshot?.hasCurrentPlan?'No operational orders for this business date.':'No resource orders for this business date.'}</div>}</div>
      <footer><span>{total?`${(currentPage-1)*pageSize+1}–${Math.min(currentPage*pageSize,total)} of ${total} orders`:'0 orders'}</span><div><button aria-label="Previous page" disabled={currentPage<=1||initial||pageBusy} onClick={()=>navigate({page:String(currentPage-1)})}>Previous</button><span className="or-current-page">{currentPage} / {pages}</span><button aria-label="Next page" disabled={currentPage>=pages||initial||pageBusy} onClick={()=>navigate({page:String(currentPage+1)})}>Next</button></div></footer>
    </section>
    {backVehicle&&<a className="or-back-vehicle" href={`/vehicles?source=${source}&business_date=${date}&selected_vehicle=${encodeURIComponent(backVehicle)}`}>Back to Vehicle</a>}
    {selected&&<OrderInspector key={`${source}|${date}|${selected}`} id={selected} date={date} source={source} listOrder={rows.find(order=>order.id===selected)??orders.find(order=>order.id===selected)??null} now={activeNow} historical={historical} onClose={closeDrawer}/>}
  </div></VehicleShell>;
}
