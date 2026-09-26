"use client";
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {countdown,label,time,type Order} from './order-data';
export default function PriorityRail({kind,orders,now,loading,selected,onSelect}:{kind:'risk'|'critical';orders:Order[];now:number;loading:boolean;selected:string|null;onSelect:(id:string)=>void}){
  const track=useRef<HTMLDivElement>(null),previous=useRef<string[]>([]),anchor=useRef<{id:string;x:number}|null>(null);
  const [left,setLeft]=useState(false),[right,setRight]=useState(false),[newIds,setNewIds]=useState<string[]>([]);
  const signature=orders.map(o=>o.id).join('|');
  function inspect(){const el=track.current;if(!el)return;setLeft(el.scrollLeft>2);setRight(el.scrollLeft+el.clientWidth<el.scrollWidth-2);const visible=Array.from(el.querySelectorAll<HTMLElement>('[data-rail-order]')).find(n=>n.offsetLeft+n.offsetWidth>el.scrollLeft);anchor.current=visible?{id:visible.dataset.railOrder!,x:visible.offsetLeft-el.scrollLeft}:null;}
  useLayoutEffect(()=>{
    const el=track.current;if(!el)return;
    if(el.scrollLeft>2){const added=orders.map(o=>o.id).filter(id=>!previous.current.includes(id));if(added.length)setNewIds(ids=>[...new Set([...ids,...added])]);
      const n=Array.from(el.querySelectorAll<HTMLElement>('[data-rail-order]')).find(n=>n.dataset.railOrder===anchor.current?.id);if(n&&anchor.current)el.scrollLeft=n.offsetLeft-anchor.current.x;
    }
    previous.current=orders.map(o=>o.id);inspect();
    // This effect observes membership, not the once-per-second countdown render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[signature,loading]);
  useEffect(()=>{const el=track.current;if(!el)return;const observer=new ResizeObserver(inspect);observer.observe(el);const wheel=(e:WheelEvent)=>{if(el.scrollWidth<=el.clientWidth||Math.abs(e.deltaX)>=Math.abs(e.deltaY))return;e.preventDefault();el.scrollBy({left:e.deltaY,behavior:'auto'});};el.addEventListener('wheel',wheel,{passive:false});return()=>{observer.disconnect();el.removeEventListener('wheel',wheel);};},[]);
  return <section className={`or-rail or-${kind}`} aria-label={kind==='risk'?'At risk orders':'Time critical orders'}>
    <header><h2>{kind==='risk'?'AT RISK':'TIME CRITICAL'} <span>{loading?'—':orders.length}</span></h2><div>{newIds.filter(id=>orders.some(o=>o.id===id)).length>0&&<button onClick={()=>{track.current?.scrollTo({left:0,behavior:'smooth'});setNewIds([]);}}>+{newIds.filter(id=>orders.some(o=>o.id===id)).length} NEW</button>}{left&&<button aria-label={`Previous ${kind} orders`} onClick={()=>track.current?.scrollBy({left:-600,behavior:'smooth'})}>‹</button>}{right&&<button aria-label={`Next ${kind} orders`} onClick={()=>track.current?.scrollBy({left:600,behavior:'smooth'})}>›</button>}</div></header>
    <div className={`or-rail-window ${right?'has-more':''}`}><div ref={track} className="or-track" onScroll={inspect} tabIndex={0} aria-label="Scrollable priority orders">
      {loading?Array.from({length:4},(_,i)=><div className="or-card or-skeleton" key={i}/>):orders.length?orders.map(o=><button className="or-card" key={o.id} data-rail-order={o.id} data-kind={kind} aria-pressed={selected===o.id} onClick={()=>onSelect(o.id)}><strong>{o.code}</strong><span className="or-merchant">{o.merchant}</span><small>{label(o.execution)}{o.vehicle?` · ${o.vehicle}`:''}</small>{kind==='critical'?<><span className="or-count-label">WINDOW CLOSES IN</span><b className="or-countdown">{countdown(o,now)}</b><span className="or-due">Window ends {time(o.windowEnd)}</span></>:<><b className="or-eta">{o.eta?`ETA ${time(o.eta)}`:'ETA unavailable'}</b><span className="or-due">Window ends {time(o.windowEnd)}</span></>}<span className="or-edge-light" aria-hidden="true"/></button>):<p className="or-rail-empty">{kind==='risk'?'No at risk orders':'No deadlines within 5 minutes'}</p>}
    </div></div>
  </section>;
}
