import {Suspense} from 'react';
import NavigationHandoff from '../vehicles/navigation-handoff';
import '../vehicles/vehicles.css';
export default function IncidentPage(){return <Suspense fallback={<div>Loading Incident…</div>}><NavigationHandoff kind="incident"/></Suspense>;}
