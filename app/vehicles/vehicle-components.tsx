"use client";
import {useId,useLayoutEffect,useRef} from 'react';
import {AlertTriangle,Check,ChevronRight,MapPin,Package,UserRound,Waypoints} from 'lucide-react';
import type {Vehicle,VehicleStop} from './vehicle-data';
import {currentStop,displayTime,progress} from './vehicle-data';

function MotorbikeArtwork(){return <>
    <ellipse cx="36" cy="49" rx="31" ry="3" fill="currentColor" opacity=".1"/>
    <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="17" cy="41" r="9" fill="#111110"/><circle cx="57" cy="41" r="9" fill="#111110"/>
      <circle cx="17" cy="41" r="4" opacity=".65"/><circle cx="57" cy="41" r="4" opacity=".65"/>
      <path d="M9 32Q18 24 28 32L35 40H45L50 27L57 41M19 41H38Q40 35 36 32L31 28H20M43 27L47 20H55M48 25L52 31" fill="currentColor" fillOpacity=".18"/>
      <path d="M22 26H34M7 23H20V12H7ZM9 15H18M49 20L50 15H56"/>
      <path d="M27 14L23 25L36 29L32 39H41M29 14L39 21H48" strokeWidth="4"/>
      <path d="M27 6A6 6 0 0 1 39 8L36 13H29Z" fill="currentColor" fillOpacity=".8"/>
      <path d="M34 7H39" stroke="#111110"/><path d="M8 29H19M50 19H55" strokeWidth="3"/>
    </g>
</>; }
export function MotorbikeProgressMarker({className=''}:{className?:string}){return <svg className={`vf-motorbike ${className}`} viewBox="0 0 72 54" width="72" height="54" fill="none" aria-hidden="true"><MotorbikeArtwork/></svg>;}
export function VehicleStatus({vehicle,finished=false}:{vehicle:Vehicle;finished?:boolean}){
  return <span className={`vf-status ${vehicle.status.toLowerCase()}`}>{vehicle.status==='UNAVAILABLE'?<AlertTriangle/>:<i/>}{vehicle.status==='UNAVAILABLE'?'Unavailable':finished?'Completed':vehicle.status==='AVAILABLE'?'Available':vehicle.routeId?'On route':'Active'}</span>;
}
export function RouteProgressTrack({stops,available=false,exception=false,loading=false,error=false}:{stops:VehicleStop[];available?:boolean;exception?:boolean;loading?:boolean;error?:boolean}){
  const {percent}=progress(stops);
  const selected=stops.length<=5?stops:stops.filter((_,index)=>[0,Math.round((stops.length-1)/4),Math.round((stops.length-1)/2),Math.round((stops.length-1)*3/4),stops.length-1].includes(index));
  return <div className={`vf-track ${available?'available':''} ${exception?'exception':''}`} aria-label={available?'No current route assigned':loading?'Stops loading':error?'Progress unavailable':percent===null?'No stops provided':`Route progress ${percent}% by completed stops`}>
    <div className="vf-track-lane">
      <div className="vf-track-remaining"/>
      {!available&&!loading&&!error&&percent!==null&&<div className="vf-track-complete" style={{width:`${percent}%`}}/>}
      {(available||loading||error||stops.length===0)?<>
        <span className="vf-track-message">{loading?'Loading stops…':error?'Progress unavailable':available?'No current route assigned':'No stops provided'}</span>
        {[0,25,50,75,100].map(left=><span key={left} className="vf-node empty" style={{left:`${left}%`}}/>)}
      </>:<>
        <span className="vf-node origin" style={{left:0}}/>
        {selected.map(stop=>{const left=(stops.indexOf(stop)+1)/stops.length*100;return <span key={stop.id} className={`vf-stop-anchor ${left===100?'last':''}`} style={{left:`${left}%`}}><span className="vf-node-label" title={stop.location}>{stop.location}</span><span className={`vf-node ${stop.status==='COMPLETED'?'done':''}`}>{stop.status==='COMPLETED'&&<Check/>}</span></span>;})}
        <span className="vf-marker" style={{left:`${percent??0}%`}}><MotorbikeProgressMarker/></span>
      </>}
    </div>
  </div>;
}
export function RouteVisualization({stops,exception=false}:{stops:VehicleStop[];exception?:boolean}){
  const id=useId().replaceAll(':',''),path=useRef<SVGPathElement>(null),marker=useRef<SVGGElement>(null);
  const {percent}=progress(stops);
  const d='M 300 48 C 290 98 150 60 147 116 S 244 166 217 213 S 94 220 115 273 S 267 300 218 364';
  useLayoutEffect(()=>{if(path.current&&marker.current){const p=path.current.getPointAtLength(path.current.getTotalLength()*(percent??0)/100);marker.current.setAttribute('transform',`translate(${p.x-28} ${p.y-38}) scale(.8)`);}},[percent]);
  const labels=stops.length<=5?stops:stops.filter((_,i)=>[0,Math.round((stops.length-1)/4),Math.round((stops.length-1)/2),Math.round((stops.length-1)*3/4),stops.length-1].includes(i));
  return <section className={`vf-route-visual ${exception?'exception':''}`} aria-label="Stylized operational route visualization">
    <div className="vf-visual-heading"><Waypoints/><span>ROUTE VISUALIZATION</span></div>
    {stops.length?<svg viewBox="0 0 440 408" role="img" aria-label={`Stylized route sequence; ${percent}% of stops completed. Not road navigation.`}>
      <defs><pattern id={`grid-${id}`} width="38" height="38" patternUnits="userSpaceOnUse" patternTransform="rotate(-18)"><path d="M 38 0 L 0 0 0 38" fill="none" stroke="#bba16d" strokeOpacity=".065" strokeWidth=".7"/></pattern><filter id={`glow-${id}`}><feGaussianBlur stdDeviation="5"/></filter></defs>
      <rect width="440" height="408" fill={`url(#grid-${id})`}/>
      <path d="M-20 150Q80 60 150 160T470 100M-20 290Q80 210 180 310T470 200M10 0Q160 150 70 420M350 0Q240 180 370 420" fill="none" stroke="#a88e56" strokeOpacity=".11"/>
      <path d={d} pathLength="100" className="vf-visual-glow" strokeDasharray={`${percent??0} 100`} filter={`url(#glow-${id})`}/>
      <path ref={path} d={d} pathLength="100" className="vf-visual-remaining"/>
      <path d={d} pathLength="100" className="vf-visual-completed" strokeDasharray={`${percent??0} 100`}/>
      <RouteVisualNodes path={path} stops={stops} labels={labels}/>
      <g ref={marker} className="vf-visual-bike" fill="none"><MotorbikeArtwork/></g>
    </svg>:<div className="vf-visual-empty"><Waypoints/><p>No current route assigned</p></div>}
    <p className="vf-visual-caption">Stylized stop sequence · Not road navigation</p>
  </section>;
}
function RouteVisualNodes({path,stops,labels}:{path:React.RefObject<SVGPathElement|null>;stops:VehicleStop[];labels:VehicleStop[]}){
  const nodes=useRef<SVGGElement>(null);
  useLayoutEffect(()=>{if(!path.current||!nodes.current)return;Array.from(nodes.current.children).forEach((node,i)=>{const ratio=(stops.indexOf(labels[i])+1)/stops.length;const p=path.current!.getPointAtLength(path.current!.getTotalLength()*ratio);node.setAttribute('transform',`translate(${p.x} ${p.y})`);});},[path,stops,labels]);
  return <g ref={nodes} className="vf-route-nodes">{labels.map(stop=><g key={stop.id}><circle r="7" className={stop.status==='COMPLETED'?'done':''}/><circle r="2"/><text x="15" y="-11">{stop.location.length>23?stop.location.slice(0,21)+'…':stop.location}</text></g>)}</g>;
}
export function CurrentStopCard({stops,onOrder}:{stops:VehicleStop[];onOrder:(id:string)=>void}){
  const stop=currentStop(stops);
  return <section className="vf-card vf-current"><h2>Current Stop</h2>{stop?<><div className="vf-current-place"><MapPin/><div><strong>{stop.location}</strong><small>{stop.kind} {stop.orderId&&`· ${stop.orderId}`}</small></div><span className="vf-stop-status">{stop.status.replaceAll('_',' ')}</span></div><dl><div><dt>Planned arrival</dt><dd>{displayTime(stop.plannedArrival)}</dd></div><div><dt>Actual arrival</dt><dd>{displayTime(stop.actualArrival)}</dd></div></dl>{stop.orderId&&<button className="vf-text-action" onClick={()=>onOrder(stop.orderId!)}>Order context <ChevronRight/></button>}</>:<p className="vf-muted">{progress(stops).finished?'All stops completed.':'No current stop.'}</p>}</section>;
}
export function VehicleRiderCard({vehicle}:{vehicle:Vehicle}){
  return <section className="vf-card"><h2>Vehicle &amp; Rider</h2><dl className="vf-resource"><div><dt><Waypoints/>Resource status</dt><dd>{vehicle.status}</dd></div><div><dt><UserRound/>Rider / driver</dt><dd>{vehicle.driver??'Unassigned'}</dd></div><div><dt><Package/>Capacity</dt><dd>{vehicle.capacity===null?'—':`${vehicle.capacity} load units`}</dd></div></dl><div className="vf-location"><small>LAST RECORDED LOCATION · NOT LIVE GPS</small><p>{vehicle.recordedLocation??'No recorded location supplied'}</p><time>{vehicle.recordedAt??'Recording time unavailable'}</time></div></section>;
}
export function RouteStopsList({stops,onOrder}:{stops:VehicleStop[];onOrder:(id:string)=>void}){
  return <div className="vf-stops-table"><table><thead><tr><th>Stop / Location</th><th>Task / Order</th><th>Status</th><th>Planned<br/><small>Arrival / departure</small></th><th>Actual<br/><small>Arrival / departure</small></th></tr></thead><tbody>{stops.map(stop=><tr key={stop.id} className={['IN_PROGRESS','ARRIVED','IN_SERVICE'].includes(stop.status)?'current':''}><td><span className={`vf-stop-index ${stop.status==='COMPLETED'?'done':''}`}>{stop.status==='COMPLETED'?<Check/>:String(stop.sequence).padStart(2,'0')}</span><span>{stop.location}</span></td><td><small>{stop.kind}</small>{stop.orderId?<button className="vf-order-link" onClick={()=>onOrder(stop.orderId!)}>{stop.orderCode??stop.orderId}<ChevronRight/></button>:'—'}</td><td><span className="vf-stop-status">{stop.status.replaceAll('_',' ')}</span></td><td>{displayTime(stop.plannedArrival)}<small>{displayTime(stop.plannedDeparture)}</small></td><td>{displayTime(stop.actualArrival)}<small>{displayTime(stop.actualDeparture)}</small></td></tr>)}</tbody></table></div>;
}
