"use client";
import {AlertTriangle,BarChart3,Boxes,LayoutDashboard,Package,Settings,Sparkles,Truck} from "lucide-react";
import {incidentWorkspaces} from "./incidents/incident-mock";
import {useRouter} from 'next/navigation';

function BrandMark() {
  return <span className="nexus-mark"><span/><span/><span/></span>;
}

export default function Sidebar({ onIncident, onOverview, onOperations, activePage, onVehicles, onOrders, showIncidentCount=true }: { onIncident: () => void; onOverview: () => void; onOperations: () => void; activePage: 'overview'|'operations'|'incidents'|'vehicles'|'orders';onVehicles?:()=>void;onOrders?:()=>void;showIncidentCount?:boolean }) {
  const router=useRouter();
  const nav = [
    ["Overview", LayoutDashboard], ["Operations", Boxes], ["Incidents", AlertTriangle],
    ["AI Agent", Sparkles], ["Vehicles", Truck], ["Orders", Package], ["Analytics", BarChart3],
  ] as const;
  return <aside className="nexus-sidebar">
    <div className="nexus-brand"><BrandMark/><span><b>NEXUS</b><small>Delivery Operations</small></span></div>
    <nav>{nav.map(([label, Icon]) => <button key={label} disabled={!['Overview','Operations','Incidents','Vehicles','Orders'].includes(label)} className={label.toLowerCase()===activePage ? "active" : ""} aria-current={label.toLowerCase()===activePage ? "page" : undefined} onClick={label === "Incidents" ? onIncident : label === "Operations" ? onOperations : label === "Overview" ? onOverview : label === "Vehicles" ? onVehicles??(()=>router.push("/vehicles?source=demo")) : label === "Orders" ? onOrders??(()=>router.push("/orders?source=demo")) : undefined}>
      <Icon/><span>{label}</span>{label === "Incidents" && showIncidentCount && <em>{Object.keys(incidentWorkspaces).length}</em>}
    </button>)}</nav>
    <button className="settings-link"><Settings/><span>Settings</span></button>
  </aside>;
}

