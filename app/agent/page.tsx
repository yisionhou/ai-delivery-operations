import type { Metadata } from 'next';
import PenroseEntrancePage from './penrose-entrance-page';
import { entranceHeroMedia } from './hero-media';
import './entrance.css';
import './workspace.css';
import './recovery.css';
import '../incidents/incident-focus.css';
import './review.css';
import './static-core.css';

export const metadata: Metadata = {
  title: 'PENROSE — Recovery Workspace',
  description: 'From disruption to recovery.',
};

export default async function AgentEntrance({searchParams}:{searchParams:Promise<{source?:string;incident_id?:string}>}) {
  const query=await searchParams;
  return <PenroseEntrancePage hero={entranceHeroMedia} demo={query.source==='demo'} incidentId={query.incident_id} />;
}
