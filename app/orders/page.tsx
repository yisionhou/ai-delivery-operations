import {Suspense} from 'react';
import NavigationHandoff from '../vehicles/navigation-handoff';
import '../vehicles/vehicles.css';
export default function OrdersPage(){return <Suspense fallback={<div>Loading order…</div>}><NavigationHandoff kind="order"/></Suspense>;}
