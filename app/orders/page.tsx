import {Suspense} from 'react';
import OrdersWorkspace from './orders-workspace';
import '../vehicles/vehicles.css';
import './orders.css';
export default function OrdersPage(){return <Suspense fallback={<div>Loading orders…</div>}><OrdersWorkspace/></Suspense>;}
