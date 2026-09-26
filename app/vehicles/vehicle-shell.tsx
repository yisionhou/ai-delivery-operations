"use client";
import {contextQuery,readContext} from './vehicle-data';
import Sidebar from '../nexus-sidebar';
import {useRouter} from 'next/navigation';
export default function VehicleShell({children,activePage='vehicles'}:{children:React.ReactNode;activePage?:'vehicles'|'orders'|'incidents'|'analytics'}){
  const router=useRouter();
  const query=()=>{const {date,filter,page,source}=readContext(new URLSearchParams(window.location.search));return contextQuery(date,filter,page,source);};
  return <main className={`nexus-app page-vehicles vf-shell page-${activePage}-handoff`}><Sidebar activePage={activePage} showIncidentCount={false} onVehicles={()=>router.push(`/vehicles?${query()}`)} onOrders={()=>router.push(`/orders?${query()}`)} onAnalytics={()=>{const params=new URLSearchParams(window.location.search);router.push(`/analytics?${new URLSearchParams({source:params.get('source')==='demo'?'demo':'api',business_date:params.get('business_date')??new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Singapore',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())})}`);}} onOverview={()=>router.push('/')} onOperations={()=>router.push('/?page=operations')} onIncident={()=>{const params=new URLSearchParams(window.location.search);router.push(params.get('source')==='demo'?'/incidents?source=demo&incident_id=INC-007':`/incidents?${params}`);}}/>{children}</main>;
}
