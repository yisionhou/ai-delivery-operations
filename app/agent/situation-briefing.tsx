'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, TriangleAlert, Truck, X } from 'lucide-react';
import PanelSurface from './panel-surface';
import { briefingDemo as demo } from './briefing-demo';
import type { PenroseSceneState } from './use-entrance-transition';

type Detail = 'incident' | 'orders';
const initialSummary = "I've reviewed the demo situation. The main issue is V03 being unavailable. Start by reviewing the affected orders and recovery options.";

export default function SituationBriefing({ phase, active = true, onEnterRecovery, children, hero }: { phase: PenroseSceneState; active?: boolean; onEnterRecovery: () => void; children?: ReactNode; hero?: ReactNode }) {
  const ready = phase === 'workspace-ready' && active;
  const recovery = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [detail, setDetail] = useState<Detail>('incident');
  const [answer, setAnswer] = useState(initialSummary);
  useEffect(() => {
    if (ready) recovery.current?.focus({ preventScroll: true });
  }, [ready]);
  const show = (kind: Detail) => { setDetail(kind); dialog.current?.showModal(); };
  return <>
    <div className="pw-workspace" aria-label="Penrose Recovery Workspace" aria-hidden={phase !== 'workspace-ready'} inert={phase !== 'workspace-ready'}>
      <div className="pw-scroll-content">
        {hero}
        <div className="pe-workspace-backdrop" aria-hidden="true"><img src="/media/penrose/workspace-background.png" alt="" /></div>
        <div className="pw-briefing-scene" aria-hidden={!ready} inert={!ready}>
        <section className="pw-main" aria-labelledby="pw-briefing-title">
          <div className="pw-main-surface"><PanelSurface main /></div>
          <div className="pw-main-grid">
            <div className="pw-briefing pw-copy-reveal">
              <p className="pw-eyebrow"><span />PENROSE AGENT</p>
              <h2 id="pw-briefing-title">Good afternoon, <br />Emily.</h2>
              <p className="pw-briefing-description">Operations are mostly stable.<br />One vehicle incident requires a recovery plan. Three orders are affected, and two delivery windows are currently at risk.</p>
              <dl className="pw-briefing-stats">
                <div><dt>Active incident</dt><dd>1</dd></div>
                <div><dt>Affected orders</dt><dd>3</dd></div>
                <div><dt>At-risk orders</dt><dd>2</dd></div>
              </dl>
            </div>
            <div className="pw-core">
              <div className="pw-hero-destination" aria-hidden="true" />
              <div className="pw-recovery-reveal">
                <button ref={recovery} className="pw-recovery" onClick={onEnterRecovery} disabled={!ready}>Enter Recovery <ArrowRight aria-hidden="true" /></button>
              </div>
              <p className="pw-core-caption pw-copy-reveal">SITUATION BRIEFING</p>
            </div>
            <div className="pw-agent pw-copy-reveal">
              <div className="pw-agent-meta"><span className="pw-demo-badge">DEMO SNAPSHOT</span><time dateTime="2026-09-26T10:24:00+08:00">{demo.timestamp}</time></div>
              <p className="pw-agent-answer" role="status" tabIndex={0} aria-label="Penrose response">{answer}</p>
              <div className="pw-prompts" aria-label="Demo quick prompts">{demo.prompts.map(prompt =>
                <button key={prompt.label} onClick={() => setAnswer(prompt.answer)}>{prompt.label}<ArrowRight aria-hidden="true" /></button>)}</div>
              <div className="pw-ask"><span aria-hidden="true">✧</span><input disabled aria-label="Ask Penrose — not connected" placeholder="Ask Penrose..." /><ArrowRight aria-hidden="true" /></div>
              <p className="pw-demo-note">Demo prompts · Free-text assistant not connected</p>
            </div>
          </div>
        </section>

        <div className="pw-lower-row">
          <article className="pw-card pw-operations" aria-labelledby="pw-operations-title">
            <PanelSurface />
            <div className="pw-card-content">
              <h3 id="pw-operations-title">CURRENT OPERATIONS<span className="pw-tiny-label">DEMO</span></h3>
              <dl className="pw-operations-list">
                <div><dt>Current Plan</dt><dd>{demo.plan}</dd></div>
                <div><dt>Vehicles</dt><dd>{demo.activeVehicles}<span> / {demo.totalVehicles}</span></dd></div>
                <div><dt>Total Orders</dt><dd>{demo.totalOrders}</dd></div>
                <div><dt>At Risk</dt><dd className="pw-amber">{demo.risks.length}</dd></div>
              </dl>
              <div className="pw-performance"><span>On-time performance</span><b>{demo.onTime}%</b><i><span style={{ width: `${demo.onTime}%` }} /></i></div>
            </div>
          </article>
          <article className="pw-card pw-incident" aria-labelledby="pw-incident-title">
            <PanelSurface />
            <div className="pw-card-content">
              <h3 id="pw-incident-title"><span className="pw-heading-group"><TriangleAlert />LATEST INCIDENT</span><span className="pw-coral">{demo.incident.id}</span></h3>
              <div className="pw-incident-summary"><Truck /><div><h4>Vehicle V03 unavailable</h4><p>Since {demo.incident.since}</p></div></div>
              <dl className="pw-incident-stats"><div><dt>Affected orders</dt><dd>3</dd></div><div><dt>Route affected</dt><dd>1</dd></div><div><dt>Status</dt><dd className="pw-review">Review</dd></div></dl>
              <button className="pw-card-link" onClick={() => show('incident')}>View incident details <ArrowRight /></button>
            </div>
          </article>
          <article className="pw-card pw-risks" aria-labelledby="pw-risks-title">
            <PanelSurface />
            <div className="pw-card-content">
              <h3 id="pw-risks-title"><span className="pw-heading-group"><TriangleAlert />RISK ALERTS</span><span className="pw-count">2</span></h3>
              <div className="pw-risk-list">{demo.risks.map(risk => <button key={risk.id} onClick={() => show('orders')}>
                <strong>{risk.id}</strong><span>{risk.description}<small>{risk.detail}</small></span><em>{risk.level}</em>
              </button>)}</div>
              <button className="pw-card-link" onClick={() => show('orders')}>View all orders <ArrowRight /></button>
            </div>
          </article>
        </div>
        </div>
        {children}
        <div className="pw-workspace-footer pw-secondary"><span>GLOBAL LOGISTICS RECOVERY SYSTEM<small>From disruption to recovery.</small></span><span>v1.0.0 <i /> SINGAPORE (SGT)</span></div>
      </div>
    </div>
    <dialog ref={dialog} className="pw-dialog" aria-labelledby="pw-dialog-title" onClick={event => { if (event.target === dialog.current) dialog.current?.close(); }}>
      <button className="pw-dialog-close" aria-label="Close details" onClick={() => dialog.current?.close()}><X /></button>
      <p className="pw-eyebrow">DEMO SCENARIO · {demo.incident.id}</p>
      <h2 id="pw-dialog-title">{detail === 'incident' ? 'Vehicle V03 unavailable' : 'Affected orders'}</h2>
      <p>V03 became unavailable at 10:18 AM. One route and three orders are affected.</p>
      <div className="pw-detail-orders">{demo.incident.affectedOrders.map((id, index) => <div key={id}><b>{id}</b><span>{index < 2 ? 'Delivery window risk' : 'Affected · review required'}</span></div>)}</div>
      <p className="pw-detail-note">This is a demo briefing. Recovery generation and plan application are not connected.</p>
      <button className="pw-dialog-done" onClick={() => dialog.current?.close()}>Back to briefing <ArrowRight /></button>
    </dialog>
  </>;
}
