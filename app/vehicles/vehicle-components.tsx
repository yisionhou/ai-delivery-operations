"use client";
import {AlertTriangle,Check} from 'lucide-react';
import type {Vehicle,VehicleStop} from './vehicle-data';
import {progress} from './vehicle-data';

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
