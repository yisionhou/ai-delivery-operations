import {Suspense} from 'react';
import VehicleDetail from '../vehicle-detail';
export default async function VehicleDetailPage({params}:{params:Promise<{vehicleId:string}>}){const {vehicleId}=await params;return <Suspense fallback={<div className="vf-page">Loading vehicle…</div>}><VehicleDetail key={vehicleId} vehicleId={vehicleId}/></Suspense>;}
