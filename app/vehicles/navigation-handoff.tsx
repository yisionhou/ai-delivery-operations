"use client";
import {useEffect,useState} from 'react';
import {useSearchParams} from 'next/navigation';
import {ArrowLeft,Package} from 'lucide-react';
import VehicleShell from './vehicle-shell';
import {contextQuery,readContext} from './vehicle-data';
import {apiRead,incidentContextSchema,orderContextSchema} from './vehicle-api';
import {StateMessage} from './vehicles-board';
import dynamic from 'next/dynamic';
const IncidentFocusPage=dynamic(()=>import('../incidents/incident-focus-page'),{ssr:false,loading:()=> <div className="vf-state">Loading Incident workspace…</div>});
import {incidentWorkspaces} from '../incidents/incident-mock';
import BackendIncidentPage from '../incidents/backend-incident-page';
import type {z} from 'zod';
type Context={kind:'incident';data:z.infer<typeof incidentContextSchema>}|{kind:'order';data:z.infer<typeof orderContextSchema>};
export default function NavigationHandoff({kind}:{kind:'incident'|'order'}){
  const params=useSearchParams(),{date,filter,page,source}=readContext(new URLSearchParams(params.toString()));
  const query=contextQuery(date,filter,page,source),vehicleId=params.get('vehicle_id'),id=params.get(kind==='incident'?'incident_id':'selected_order');
  const back=kind==='order'&&vehicleId?`/vehicles?${query}&selected_vehicle=${encodeURIComponent(vehicleId)}`:`/vehicles?${query}`;
  const [context,setContext]=useState<Context|null>(null),[error,setError]=useState<string|null>(null),[revision,setRevision]=useState(0);
  useEffect(()=>{
    if(kind==='incident'||source==='demo'||!id)return;
    const controller=new AbortController();
    async function load(){
      try{
        const context:Context=kind==='incident'?{kind:'incident',data:await apiRead('/incidents/'+encodeURIComponent(id!),incidentContextSchema,controller.signal)}:{kind:'order',data:await apiRead('/orders/'+encodeURIComponent(id!),orderContextSchema,controller.signal)};
        if(!controller.signal.aborted){setContext(context);setError(null);}
      }catch(reason){if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:'Context could not be loaded.');}
    }
    void load();return()=>controller.abort();
  },[source,id,kind,revision]);
  const demoIncident=source==='demo'&&kind==='incident'&&id?incidentWorkspaces[id]:null;
  return <VehicleShell activePage={kind==='incident'?'incidents':'orders'}>
    {kind==='incident'&&source==='api'?<BackendIncidentPage id={id} date={date}/>:demoIncident?<div className="vf-demo-incident"><a href={back} className="vf-handoff-back"><ArrowLeft/>Back to Vehicles · Demo</a><IncidentFocusPage active data={demoIncident}/></div>:<div className="vf-page vf-handoff">
      <div className="vf-detail-top"><a className="vf-back" href={back}><ArrowLeft/>{kind==='order'&&vehicleId?'Back to Vehicle':'Back to Vehicles'}</a><span className="vf-demo">{source==='demo'?'DEMO DATA':'BACKEND DATA'}</span></div>
      <header className="vf-page-header"><div><span className="vf-eyebrow">{kind==='incident'?'INCIDENT WORKFLOW':'ORDER CONTEXT'}</span><h1>{kind==='incident'?'Incidents':'Orders'}</h1><p>{id?`Selected ${kind} · ${id}`:`Vehicle ${vehicleId??'—'}`}</p></div>{kind!=='incident'&&<Package/>}</header>
      {!id?<StateMessage title={kind==='incident'?'No linked Incident':'No order selected'} detail={kind==='incident'?'No unique active Incident was supplied for this vehicle. Confirm the vehicle and incident location in the Incident reporting workflow. No Incident has been created.':'Open an order from the Vehicle Inspector to retain its selected context.'}/>:source==='demo'?<section className="vf-card"><h2>Selected order: {id}</h2><p className="vf-muted">Vehicle {vehicleId??'—'} · Business date {date}</p><p className="vf-handoff-note">Order context is preserved in this URL. The full Orders module is not implemented in this demo.</p></section>:error?<StateMessage title="Context unavailable" detail={error} retry={()=>setRevision(v=>v+1)}/>:!context?<StateMessage title="Loading selected context…"/>:<section className="vf-card vf-context-card">
        <h2>{context.kind==='incident'?context.data.incident_code:context.data.order_code}</h2>
        <dl className="vf-resource">
          <div><dt>Business date</dt><dd>{context.data.business_date}</dd></div>
          {context.kind==='incident'?<><div><dt>Status</dt><dd>{context.data.status}</dd></div><div><dt>Vehicle ID</dt><dd>{context.data.vehicle_id??'—'}</dd></div><div><dt>Base plan</dt><dd>{context.data.base_plan_code}</dd></div><div><dt>Affected orders</dt><dd>{context.data.affected_order_count}</dd></div></>:<><div><dt>Execution status</dt><dd>{context.data.execution_status}</dd></div><div><dt>Risk status</dt><dd>{context.data.risk_status}</dd></div><div><dt>Pickup</dt><dd>{context.data.pickup_location.display_name}</dd></div><div><dt>Delivery</dt><dd>{context.data.delivery_location.display_name}</dd></div></>}
        </dl><p className="vf-handoff-note">{context.kind==='incident'?'This is the persisted Incident context. The existing recovery review is demo-only; production recovery actions are not connected.':'Selected order context is loaded. The full Orders workspace is not implemented yet.'}</p>
      </section>}
    </div>}
  </VehicleShell>;
}
