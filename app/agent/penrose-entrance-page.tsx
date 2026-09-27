'use client';

import { useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import PenroseHero, { type PenroseHeroProps } from './penrose-hero';
import SpaceBackground, { OrbitTrails } from './space-background';
import { useEntranceTransition } from './use-entrance-transition';
import { useHeroTravel } from './use-hero-travel';
import SituationBriefing from './situation-briefing';
import RecoveryOptions from './recovery-options';
import { useRecoveryWorkspace } from './use-recovery-workspace';
import { useRecoveryHeroTravel } from './use-recovery-hero-travel';
import type { RecoveryCandidate, RecoveryLoader } from './recovery-types';

function BrandSignature() {
  return <div className="pe-brand">
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <defs><linearGradient id="pe-mark-gold"><stop stopColor="#f4e4c4" /><stop offset="1" stopColor="#82715a" /></linearGradient></defs>
      <path d="M9 5 43 24 9 43Z M16 17 16 31 29 24Z" fill="url(#pe-mark-gold)" fillRule="evenodd" />
      <path d="M9 5 12 10 35 24 12 38 9 43M12 10V38" fill="none" stroke="#ead9b9" strokeWidth=".7" />
    </svg>
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
  hero, onHandoff, recoveryLoader, onCandidateSelected,
}: { hero?: Omit<PenroseHeroProps, 'heroState'>; onHandoff?: () => void; recoveryLoader?: RecoveryLoader; onCandidateSelected?: (candidate: RecoveryCandidate) => void }) {
  const router = useRouter();
  const { phase, enter, heroState, entered, timingStyle, reducedMotion } = useEntranceTransition(onHandoff);
  const scene = useRef<HTMLElement>(null);
  const recovery = useRecoveryWorkspace(reducedMotion, recoveryLoader, onCandidateSelected);
  useHeroTravel(scene);
  useRecoveryHeroTravel(scene, recovery.scene, reducedMotion);
  const recoveryBusy = recovery.scene === 'transitioning-in' || recovery.scene === 'transitioning-out';
  const enterRecovery = () => {
    scene.current?.querySelector<HTMLElement>('.pw-workspace')?.scrollTo({top:0,behavior:'instant'});
    recovery.enter();
  };
  const back = () => {
    if(recovery.review){
      if(recovery.dispatchPreviewApplied)recovery.resetPreview();
      else recovery.closeDetail();
      scene.current?.querySelector<HTMLElement>('.pw-workspace')?.scrollTo({top:0,behavior:'instant'});
      return;
    }
    if(recovery.scene === 'options') {
      scene.current?.querySelector<HTMLElement>('.pw-workspace')?.scrollTo({top:0,behavior:'instant'});
      recovery.back();
    } else router.push('/incidents?source=demo&incident_id=INC-007');
  };
  const sharedHeroState = recovery.scene === 'briefing' ? heroState : recovery.scene === 'transitioning-in' ? 'transitioning-to-recovery' : recovery.scene === 'transitioning-out' ? 'transitioning-to-briefing' : 'recovery-options';
  return <main ref={scene} className="pe-entrance" data-phase={phase} data-entered={entered} data-recovery-scene={recovery.scene} style={timingStyle}>
    <SpaceBackground />
    <div className="pe-frame" aria-hidden="true" />
    <header className="pe-header">
      <div className="pe-header-brand">
        <BrandSignature />
        {entered && <button className="pw-back" onClick={back} disabled={phase !== 'workspace-ready' || recoveryBusy}><ArrowLeft aria-hidden="true" />{recovery.dispatchPreviewApplied?'Reset preview':'Back'}</button>}
      </div>
      <p className="pe-top-copy">PEOPLE <i>/</i> GOODS <i>/</i> PROGRESS <span aria-hidden="true">⟶</span></p>
      {entered && <div className="pw-user-bar"><span className="pw-avatar">E</span><span>Hello, Emily<small>Operations Manager</small></span></div>}
    </header>
    <div className="pe-entrance-content" aria-hidden={entered} inert={entered}>
      <HeroTypography />
      <EditorialCopy />
      <EnterWorkspaceButton onEnter={enter} disabled={entered} />
      <div className="pe-footer"><span>GLOBAL LOGISTICS RECOVERY SYSTEM</span><div><span>v1.0.0</span><i /><span>INTELLIGENCE KEEPS THINGS MOVING</span></div></div>
    </div>
    <SituationBriefing phase={phase} active={recovery.scene === 'briefing'} onEnterRecovery={enterRecovery} hero={<div className="pe-hero-stage"><div className="pe-hero-anchor"><div className="pe-hero-flight"><div className="pe-recovery-flight">
      <div className="pe-shared-orbits pe-orbits-back"><OrbitTrails layer="back"/></div>
      <PenroseHero {...hero} heroState={sharedHeroState} />
      <div className="pe-shared-orbits pe-orbits-front"><OrbitTrails layer="front"/></div>
    </div></div></div></div>}>
      <RecoveryOptions controller={recovery} demo={!recoveryLoader}/>
    </SituationBriefing>
    <p className="pe-sr-only" role="status">{phase === 'workspace-ready' ? 'Situation Briefing ready. Demo snapshot.' : entered ? 'Entering Recovery Workspace' : ''}</p>
  </main>;
}
