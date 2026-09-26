"use client";

import {useEffect,useId,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight} from 'lucide-react';
import type {CSSProperties,ReactNode} from 'react';

export type FocusDeckItem={id:string;label:string;content:ReactNode};

/** Presentation only: each deck owns its focus; inspecting an item stays in its content. */
export default function FocusedCardDeck({title,description,items}:{title:string;description:string;items:FocusDeckItem[]}){
  const [activeIndex,setActiveIndex]=useState(0);
  const stage=useRef<HTMLDivElement>(null);
  const pointer=useRef<{id:number;x:number;y:number}|null>(null);
  const titleId=useId(),hintId=useId();
  const count=items.length;
  const active=count?activeIndex%count:0;

  function navigate(index:number){
    if(!count)return;
    // Do not leave keyboard focus inside a card that is about to become inert.
    if(stage.current?.contains(document.activeElement)&&document.activeElement!==stage.current)stage.current.focus({preventScroll:true});
    setActiveIndex((index%count+count)%count);
  }

  useEffect(()=>{
    const node=stage.current;if(!node||count<2)return;
    let lastEvent=0,total=0,gestureConsumed=false;
    const wheel=(event:WheelEvent)=>{
      if(event.ctrlKey||event.metaKey)return; // Keep browser / trackpad pinch zoom available.
      const delta=Math.abs(event.deltaX)>Math.abs(event.deltaY)?event.deltaX:event.deltaY;
      if(!delta)return;
      event.preventDefault();
      const now=performance.now();
      if(now-lastEvent>180){total=0;gestureConsumed=false;}
      lastEvent=now;
      if(gestureConsumed)return;
      total+=delta*(event.deltaMode===1?16:event.deltaMode===2?node.clientHeight:1);
      if(Math.abs(total)<40)return;
      gestureConsumed=true;
      if(node.contains(document.activeElement)&&document.activeElement!==node)node.focus({preventScroll:true});
      setActiveIndex(current=>(current+(total>0?1:-1)+count)%count);
    };
    node.addEventListener('wheel',wheel,{passive:false});
    return()=>node.removeEventListener('wheel',wheel);
  },[count]);

  if(!count)return <section className="if-review-group"><h3>{title}</h3><p>No changes reported.</p></section>;
  return <section className="if-review-group if-focus-deck" aria-labelledby={titleId} aria-roledescription="carousel" data-active-index={active}>
    <div className="if-review-toolbar">
      <div><h3 id={titleId}>{title}</h3><p>{description}</p></div>
      <div><small className="if-deck-counter" aria-live="polite" aria-atomic="true"><b>{String(active+1).padStart(2,'0')}</b> / {String(count).padStart(2,'0')}<span className="if-sr-only"> · {items[active].label}</span></small>
        <button type="button" aria-label={`Previous ${title} card`} disabled={count<2} onClick={()=>navigate(active-1)}><ArrowLeft/></button>
        <button type="button" aria-label={`Next ${title} card`} disabled={count<2} onClick={()=>navigate(active+1)}><ArrowRight/></button>
      </div>
    </div>
    <div ref={stage} className="if-deck-stage" tabIndex={0} role="group" aria-label={`${title} focused cards`} aria-describedby={hintId}
      onKeyDown={event=>{
        if((event.target as HTMLElement).closest('input,textarea,select,[contenteditable=true]'))return;
        const next=event.key==='ArrowRight'?active+1:event.key==='ArrowLeft'?active-1:event.key==='Home'?0:event.key==='End'?count-1:null;
        if(next!==null){event.preventDefault();navigate(next);}
      }}
      onPointerDown={event=>{
        if(!event.isPrimary||event.button!==0||(event.target as HTMLElement).closest('button,a,summary,input,select,textarea'))return;
        pointer.current={id:event.pointerId,x:event.clientX,y:event.clientY};
      }}
      onPointerMove={event=>{
        const start=pointer.current;if(!start||start.id!==event.pointerId)return;
        if(Math.abs(event.clientX-start.x)>15&&Math.abs(event.clientX-start.x)>Math.abs(event.clientY-start.y))event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerUp={event=>{
        const start=pointer.current;pointer.current=null;if(!start||start.id!==event.pointerId)return;
        const dx=event.clientX-start.x,dy=event.clientY-start.y;
        if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.2){event.preventDefault();navigate(active+(dx<0?1:-1));}
      }}
      onPointerCancel={()=>{pointer.current=null;}}
    >
      {items.map((item,index)=>{
        // Circular staging keeps neighbors on both sides, including the first card.
        let offset=(index-active+count)%count;if(offset>count/2)offset-=count;
        const distance=Math.abs(offset),focused=distance===0;
        const style={'--deck-offset':offset,'--deck-scale':focused?1:distance===1?.84:.69,'--deck-opacity':focused?1:distance===1?.48:.19,'--deck-blur':`${focused?0:distance===1?.65:1.4}px`,'--deck-angle':`${offset===0?0:offset>0?-5:5}deg`,zIndex:count-distance} as CSSProperties;
        return <div key={item.id} className={`if-deck-card ${focused?'is-focused':''}`} style={style} data-deck-item={item.id} data-offset={offset}>
          <div className="if-deck-content" inert={!focused} aria-hidden={!focused} role="group" aria-roledescription="slide" aria-label={`${index+1} of ${count}: ${item.label}`}>{item.content}</div>
          {!focused&&<button type="button" className="if-deck-focus-target" tabIndex={-1} aria-label={`Focus ${item.label}`} onClick={()=>navigate(index)}/>}
        </div>;
      })}
    </div>
    <div className="if-deck-guidance"><span id={hintId}>Scroll over cards · swipe · use ← →</span><div aria-hidden="true">{items.map((item,index)=><i key={item.id} className={index===active?'active':''}/>)}</div><span>Click a side card to focus</span></div>
  </section>;
}
