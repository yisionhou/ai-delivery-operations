"use client";
import {AlertTriangle,BarChart3,Boxes,LayoutDashboard,Package,Sparkles,Truck} from "lucide-react";
import {useRouter} from 'next/navigation';
import PenroseMark from './penrose-mark';

export default function Sidebar({ onIncident, onOverview, onOperations, activePage, onVehicles, onOrders, onAnalytics, showIncidentCount=true,incidentCount }: { onIncident: () => void; onOverview: () => void; onOperations: () => void; activePage: 'overview'|'operations'|'incidents'|'vehicles'|'orders'|'analytics';onVehicles?:()=>void;onOrders?:()=>void;onAnalytics?:()=>void;showIncidentCount?:boolean;incidentCount?:number }) {
  const router=useRouter();
  const nav = [
    ["Overview", LayoutDashboard], ["Operations", Boxes], ["Incidents", AlertTriangle],
    ["AI Agent", Sparkles], ["Vehicles", Truck], ["Orders", Package], ["Analytics", BarChart3],
  ] as const;
  return <aside className="nexus-sidebar">
    <div className="nexus-brand"><PenroseMark className="penrose-mark"/><span className="penrose-wordmark"><b>PENROSE</b><small>Recovery Workspace</small><span className="penrose-team">Zero Shot</span></span></div>
    <nav>{nav.map(([label, Icon]) => label === "AI Agent" ? <a key={label} href="/agent"><Icon/><span>{label}</span></a> : <button key={label} disabled={!['Overview','Operations','Incidents','Vehicles','Orders','Analytics'].includes(label)} className={label.toLowerCase()===activePage ? "active" : ""} aria-current={label.toLowerCase()===activePage ? "page" : undefined} onClick={label === "Incidents" ? onIncident : label === "Operations" ? onOperations : label === "Overview" ? onOverview : label === "Vehicles" ? onVehicles??(()=>router.push("/vehicles?source=api")) : label === "Orders" ? onOrders??(()=>router.push("/orders?source=api")) : label === "Analytics" ? onAnalytics??(()=>router.push("/analytics")) : undefined}>
      <Icon/><span>{label}</span>{label === "Incidents" && showIncidentCount && incidentCount!==undefined && <em>{incidentCount}</em>}
    </button>)}</nav>
  </aside>;
}

