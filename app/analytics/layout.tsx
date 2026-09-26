import VehicleShell from '../vehicles/vehicle-shell';
import '../vehicles/vehicles.css';
import './analytics.css';

export default function AnalyticsLayout({children}:{children:React.ReactNode}){return <VehicleShell activePage="analytics">{children}</VehicleShell>;}
