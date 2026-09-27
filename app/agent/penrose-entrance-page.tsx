'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import PenroseMark from '../penrose-mark';
import PenroseHero, { type PenroseHeroProps } from './penrose-hero';
import SpaceBackground, { OrbitTrails } from './space-background';
import { useEntranceTransition } from './use-entrance-transition';
import { useHeroTravel } from './use-hero-travel';
import SituationBriefing from './situation-briefing';
import RecoveryOptions from './recovery-options';
import { useRecoveryWorkspace } from './use-recovery-workspace';
import { useRecoveryHeroTravel } from './use-recovery-hero-travel';
import type { RecoveryCandidate, RecoveryLoader } from './recovery-types';
import {describeAgentFailure,loadAgentBriefing,loadLiveRecovery,type AgentBriefing} from './live-agent-api';
import {loadRecoveryDemo} from './recovery-demo';
import {incidentPageHref} from '../incidents/incident-navigation';

function BrandSignature() {
  return <div className="pe-brand">
    <PenroseMark />
    <div><b>PENROSE</b><span>Recovery Workspace</span></div>
  </div>;
}

function HeroTypography() {
  return <div className="pe-type-exit"><section className="pe-typography" aria-labelledby="pe-title">
    <h1 id="pe-title">PENROSE</h1>
    <h2>Recovery Workspace</h2>
    <div className="pe-tagline"><span className="pe-rule" /><p>From disruption to recovery.</p></div>
    <ul className="pe-keywords">{['DETECT', 'ANALYZE', 'REPLAN', 'RESTORE'].map((word, i) =>
      <li key={word} style={{ animationDelay: `${1200 + i * 150}ms` }}>{word}</li>)}</ul>
    <span className="pe-small-rule" />
  </section></div>;
}

function EditorialCopy() {
  return <aside className="pe-editorial" aria-label="Our purpose">
    <p>RESILIENT<br />SUPPLY CHAINS</p><p>BRIGHTER<br />TOMORROWS</p><span className="pe-rule" />
  </aside>;
}

function EnterWorkspaceButton({ onEnter, disabled }: { onEnter: () => void; disabled: boolean }) {
  return <div className="pe-button-enter"><div className="pe-button-exit">
    <button className="pe-enter" onClick={onEnter} disabled={disabled}>
      <span>Enter Workspace</span><svg viewBox="0 0 28 18" aria-hidden="true"><path d="M1 9H25M18 2L25 9 18 16" /></svg>
    </button>
  </div></div>;
}

export default function PenroseEntrancePage({
  hero, onHandoff, recoveryLoader, onCandidateSelected, demo=false, incidentId,
}: { hero?: Omit<PenroseHeroProps, 'heroState'>; onHandoff?: () => void; recoveryLoader?: RecoveryLoader; onCandidateSelected?: (candidate: RecoveryCandidate) => void; demo?:boolean; incidentId?:string }) {
  const router = useRouter();
  const [selectedIncidentId,setSelectedIncidentId]=useState(incidentId);
  const [refreshRevision,setRefreshRevision]=useState(0);
  const [briefing,setBriefing]=useState<AgentBriefing>();
  const [briefingError,setBriefingError]=useState('');
  useEffect(()=>{
    if(demo)return;
    const controller=new AbortController();
    loadAgentBriefing(selectedIncidentId,controller.signal).then(data=>{setBriefing(data);setBriefingError('');}).catch(error=>{
      if(!controller.signal.aborted)setBriefingError(describeAgentFailure(error,'briefing'));
    });
    return ()=>controller.abort();
  },[demo,selectedIncidentId,refreshRevision]);
  const selectIncident=(id:string)=>{
    setBriefing(undefined);setBriefingError('');setSelectedIncidentId(id);
    const url=new URL(window.location.href);
    url.searchParams.set('incident_id',id);
    window.history.replaceState(null,'',url);
  };
  const { phase, enter, heroState, entered, timingStyle, reducedMotion } = useEntranceTransition(onHandoff);
  const scene = useRef<HTMLElement>(null);
  const recovery = useRecoveryWorkspace(reducedMotion, recoveryLoader??(demo?loadRecoveryDemo:loadLiveRecovery), onCandidateSelected, demo?'INC-014':briefing?.incident?.id??'');
  useHeroTravel(scene);
  useRecoveryHeroTravel(scene, recovery.scene, reducedMotion);
  const recoveryBusy = recovery.scene === 'transitioning-in' || recovery.scene === 'transitioning-out';
  const enterRecovery = () => {
    if(!demo&&(!briefing?.incident||!briefing.incident.requires_replanning||briefing.incident.status==='RESOLVED'||briefing.incident.base_delivery_plan_id!==briefing.currentPlanId))return;
    scene.current?.querySelector<HTMLElement>('.pw-workspace')?.scrollTo({top:0,behavior:'instant'});
    recovery.enter();
  };
  const back = () => {
    if(recovery.review){
      if(recovery.dispatchPreviewApplied){
        if(recovery.result?.source==='live'){router.push('/?page=operations');return;}
        recovery.resetPreview();
      }
      else recovery.closeDetail();
      scene.current?.querySelector<HTMLElement>('.pw-workspace')?.scrollTo({top:0,behavior:'instant'});
      return;
    }
    if(recovery.scene === 'options') {
      scene.current?.querySelector<HTMLElement>('.pw-workspace')?.scrollTo({top:0,behavior:'instant'});
      recovery.back();
    } else router.push(demo?'/incidents?source=demo&incident_id=INC-007':briefing?.incident?incidentPageHref(briefing.businessDate,briefing.incident.id):'/?page=operations');
  };
  const sharedHeroState = recovery.scene === 'briefing' ? heroState : recovery.scene === 'transitioning-in' ? 'transitioning-to-recovery' : recovery.scene === 'transitioning-out' ? 'transitioning-to-briefing' : 'recovery-options';
  return <main ref={scene} className="pe-entrance" data-phase={phase} data-entered={entered} data-recovery-scene={recovery.scene} style={timingStyle}>
    <SpaceBackground />
    <div className="pe-frame" aria-hidden="true" />
    <header className="pe-header">
      <div className="pe-header-brand">
        <BrandSignature />
        {entered && <button className="pw-back" onClick={back} disabled={phase !== 'workspace-ready' || recoveryBusy}><ArrowLeft aria-hidden="true" />{recovery.dispatchPreviewApplied?(recovery.result?.source==='live'?'Back to Operations':'Reset preview'):'Back'}</button>}
      </div>
      <p className="pe-top-copy">PEOPLE <i>/</i> GOODS <i>/</i> PROGRESS <span aria-hidden="true">⟶</span></p>
      {entered && <div className="pw-user-bar"><span className="pw-avatar">{demo?'E':'A'}</span><span>Hello, {demo?'Emily':'Alex'}<small>Operations Manager</small></span></div>}
    </header>
    <div className="pe-entrance-content" aria-hidden={entered} inert={entered}>
      <HeroTypography />
      <EditorialCopy />
      <EnterWorkspaceButton onEnter={enter} disabled={entered} />
      <div className="pe-footer"><span>GLOBAL LOGISTICS RECOVERY SYSTEM</span><div><span>v1.0.0</span><i /><span>INTELLIGENCE KEEPS THINGS MOVING</span></div></div>
    </div>
    <SituationBriefing key={demo?'demo':briefing?.incident?.id??selectedIncidentId??'no-incident'} phase={phase} active={recovery.scene === 'briefing'} onEnterRecovery={enterRecovery} onIncidentSelect={selectIncident} onRefresh={()=>{setBriefingError('');setRefreshRevision(n=>n+1);}} demo={demo} briefing={briefing} error={briefingError} hero={<div className="pe-hero-stage"><div className="pe-hero-anchor"><div className="pe-hero-flight"><div className="pe-recovery-flight">
      <div className="pe-shared-orbits pe-orbits-back"><OrbitTrails layer="back"/></div>
      <PenroseHero {...hero} heroState={sharedHeroState} />
      <div className="pe-shared-orbits pe-orbits-front"><OrbitTrails layer="front"/></div>
    </div></div></div></div>}>
      <RecoveryOptions controller={recovery} demo={demo}/>
    </SituationBriefing>
    <p className="pe-sr-only" role="status">{phase === 'workspace-ready' ? (demo?'Situation Briefing ready. Demo snapshot.':'Live Situation Briefing ready.') : entered ? 'Entering Recovery Workspace' : ''}</p>
  </main>;
}
