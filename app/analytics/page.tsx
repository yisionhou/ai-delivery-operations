import {Suspense} from 'react';
import AnalyticsBoard from './analytics-board';

export default function AnalyticsPage(){return <Suspense fallback={<div className="an-page">Loading analytics…</div>}><AnalyticsBoard/></Suspense>;}
