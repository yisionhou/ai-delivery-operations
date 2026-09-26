import {Suspense} from 'react';
import VehiclesBoard from './vehicles-board';
export default function VehiclesPage(){return <Suspense fallback={<div className="vf-page">Loading fleet…</div>}><VehiclesBoard/></Suspense>;}
