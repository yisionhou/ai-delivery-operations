'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, TriangleAlert, Truck, X } from 'lucide-react';
import PanelSurface from './panel-surface';
import { briefingDemo as demo } from './briefing-demo';
import {askAgent,describeAgentFailure,type AgentBriefing} from './live-agent-api';
import type { PenroseSceneState } from './use-entrance-transition';

type Detail = 'incident' | 'orders';
const initialSummary = "I've reviewed the demo situation. The main issue is V03 being unavailable. Start by reviewing the affected orders and recovery options.";

export default function SituationBriefing({ phase, active = true, onEnterRecovery, onIncidentSelect, onRefresh, children, hero, briefing, error='', demo:demoMode=false }: { phase: PenroseSceneState; active?: boolean; onEnterRecovery: () => void; onIncidentSelect?: (id:string) => void; onRefresh?: () => void; children?: ReactNode; hero?: ReactNode; briefing?:AgentBriefing; error?:string; demo?:boolean }) {
  const ready = phase === 'workspace-ready' && active;
  const recovery = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [detail, setDetail] = useState<Detail>('incident');
  const [reply, setReply] = useState<string|null>(null);
  const [question,setQuestion]=useState('');
  const [asking,setAsking]=useState(false);
  const [answerSource,setAnswerSource]=useState('');
  const [askError,setAskError]=useState('');
  const [failedAsk,setFailedAsk]=useState<{message:string;selected?:{alert_id?:string;order_id?:string}}|null>(null);
  const contextToken=useRef<string|undefined>(undefined);
  const live=briefing;
  useEffect(()=>{contextToken.current=undefined;},[live?.businessDate,live?.incident?.id,live?.recoveryPlanId]);
  const answer=reply??(demoMode?initialSummary:live?.incident?`Incident ${live.incident.incident_code} affects ${live.affectedOrderIds.length} order(s). Review the recovery candidate before approving any plan change.`:live?`Current Plan ${live.planCode} is available. No Incident exists for ${live.businessDate}; ask about operations or resources, or choose an Incident when one appears.`:error?'Live briefing could not be loaded.':'Loading live operations and Incident facts...');
  const incidentTitle=live?.incident?.incident_type==='MERCHANT_DELAY'?'Merchant delay':`Vehicle ${live?.vehicleCode??'—'} unavailable`;
  const canRecover=demoMode||Boolean(live?.incident?.requires_replanning&&live.incident.status!=='RESOLVED'&&live.incident.base_delivery_plan_id===live.currentPlanId);
  const prompts=demoMode?demo.prompts.map(item=>({label:item.label,message:item.label,answer:item.answer})):[
    {label:'Current delivery status',message:'Summarize current delivery status.'},
    {label:'Available vehicles and drivers',message:'Show available vehicle and driver resources.'},
    ...(live?.recoveryPlanId?[{label:'Recovery proposal',message:'Show the recovery proposal and its verified facts.'}]:[]),
    {label:'Current risk status',message:'Summarize current delivery risks.'},
  ];
  const ask=async(message:string,preset?:string,selected?:{alert_id?:string;order_id?:string}):Promise<boolean>=>{
    if(demoMode){setReply(preset??initialSummary);return true;}
    if(!live||asking||!message.trim())return false;
    const previousReply=reply;
    setAsking(true);setAskError('');setFailedAsk(null);setReply('Penrose is checking the current operational facts...');
    try{const result=await askAgent(message.trim(),{business_date:live.businessDate,...(live.incident?{incident_id:live.incident.id}:{}),...(live.recoveryPlanId?{recovery_plan_id:live.recoveryPlanId}:{}),...selected},contextToken.current);contextToken.current=result.contextToken;setReply(result.message);setAnswerSource(result.source);return true;}
    catch(reason){contextToken.current=undefined;setReply(previousReply);setAskError(describeAgentFailure(reason,'question'));setFailedAsk({message:message.trim(),selected});return false;}
    finally{setAsking(false);}
  };
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
              <h2 id="pw-briefing-title">Good afternoon, <br />{demoMode?'Emily':'Dispatcher'}.</h2>
              <p className="pw-briefing-description">{demoMode?'Operations are mostly stable.':live?.incident?`Incident ${live.incident.incident_code} is selected.`:live?`No Incident for ${live.businessDate}.`:error?'Live briefing is unavailable.':'Loading current operations...'}<br />{demoMode?'One vehicle incident requires a recovery plan. Three orders are affected, and two delivery windows are currently at risk.':live?`${live.affectedOrderIds.length} orders affected; ${live.atRiskOrders} orders at risk in the current plan.`:''}</p>
              <dl className="pw-briefing-stats">
                <div><dt>Selected incident</dt><dd>{demoMode?1:live?Number(Boolean(live.incident)):'—'}</dd></div>
                <div><dt>Affected orders</dt><dd>{demoMode?3:live?.affectedOrderIds.length??'—'}</dd></div>
                <div><dt>At-risk orders</dt><dd>{demoMode?2:live?.atRiskOrders??'—'}</dd></div>
              </dl>
            </div>
            <div className="pw-core">
              <div className="pw-hero-destination" aria-hidden="true" />
              <div className="pw-recovery-reveal">
                <button ref={recovery} className="pw-recovery" onClick={onEnterRecovery} disabled={!ready||!canRecover}>Enter Recovery <ArrowRight aria-hidden="true" /></button>
              </div>
              <p className="pw-core-caption pw-copy-reveal">SITUATION BRIEFING</p>
            </div>
            <div className="pw-agent pw-copy-reveal">
              <div className="pw-agent-meta"><span className="pw-demo-badge">{demoMode?'DEMO SNAPSHOT':'LIVE BACKEND'}</span><time dateTime={demoMode?'2026-09-26T10:24:00+08:00':live?.incident?.detected_at}>{demoMode?demo.timestamp:live?.businessDate??'—'}</time></div>
              <p className="pw-agent-answer" role="status" tabIndex={0} aria-label="Penrose response">{answer}</p>
              {!demoMode&&error&&<div className="pw-action-error" role="alert"><TriangleAlert aria-hidden="true"/><div><strong>Live briefing failed</strong><p>{error}</p><button type="button" onClick={onRefresh}>Retry loading</button></div></div>}
              {askError&&<div className="pw-action-error" role="alert"><TriangleAlert aria-hidden="true"/><div><strong>Agent request failed</strong><p>{askError}</p><button type="button" disabled={asking||!failedAsk} onClick={()=>{if(failedAsk)void ask(failedAsk.message,undefined,failedAsk.selected);}}>Retry question</button></div></div>}
              <div className="pw-prompts" aria-label={demoMode?'Demo quick prompts':'Agent quick prompts'}>{prompts.map(prompt =>
                <button key={prompt.label} disabled={!demoMode&&(!live||asking)} onClick={() => void ask(prompt.message,'answer' in prompt?prompt.answer:undefined)}>{prompt.label}<ArrowRight aria-hidden="true" /></button>)}</div>
              <form className="pw-ask" onSubmit={event=>{event.preventDefault();void ask(question).then(succeeded=>{if(succeeded)setQuestion('');});}}><span aria-hidden="true">✧</span><input disabled={demoMode||!live||asking} value={question} onChange={event=>setQuestion(event.target.value)} aria-label={demoMode?'Ask Penrose — demo only':'Ask Penrose'} placeholder="Ask Penrose..." /><button type="submit" disabled={demoMode||!live||asking||!question.trim()} aria-label="Send question"><ArrowRight aria-hidden="true" /></button></form>
              <p className="pw-demo-note">{demoMode?'Demo prompts · Free-text assistant not connected':answerSource==='model'?'Model explanation · verified facts only':answerSource?`${answerSource} explanation · verified facts only`:'Read-only Agent answer · Decisions require dispatcher approval'}</p>
            </div>
          </div>
        </section>

        <div className="pw-lower-row">
          <article className="pw-card pw-operations" aria-labelledby="pw-operations-title">
            <PanelSurface />
            <div className="pw-card-content">
              <h3 id="pw-operations-title">CURRENT OPERATIONS<span className="pw-tiny-label">{demoMode?'DEMO':'LIVE'}</span></h3>
              <dl className="pw-operations-list">
                <div><dt>Current Plan</dt><dd>{demoMode?demo.plan:live?.planCode??'—'}</dd></div>
                <div><dt>Vehicles</dt><dd>{demoMode?demo.activeVehicles:live?.activeVehicles??'—'}<span> / {demoMode?demo.totalVehicles:live?.totalVehicles??'—'}</span></dd></div>
                <div><dt>Total Orders</dt><dd>{demoMode?demo.totalOrders:live?.totalOrders??'—'}</dd></div>
                <div><dt>At Risk</dt><dd className="pw-amber">{demoMode?demo.risks.length:live?.atRiskOrders??'—'}</dd></div>
              </dl>
              <div className="pw-performance"><span>On-time performance</span><b>{demoMode?`${demo.onTime}%`:live?.onTimeRate===null||!live?'—':`${Math.round(live.onTimeRate*100)}%`}</b><i><span style={{ width: `${demoMode?demo.onTime:Math.round((live?.onTimeRate??0)*100)}%` }} /></i></div>
            </div>
          </article>
          <article className="pw-card pw-incident" aria-labelledby="pw-incident-title">
            <PanelSurface />
            <div className="pw-card-content">
              <h3 id="pw-incident-title"><span className="pw-heading-group"><TriangleAlert />SELECTED INCIDENT</span><span className="pw-coral">{demoMode?demo.incident.id:live?.incident?.incident_code??'NONE'}</span></h3>
              {!demoMode&&live&&live.incidentOptions.length>0&&<label className="pw-incident-picker">Switch Incident<select aria-label="Switch Incident" value={live.incident?.id??''} onChange={event=>onIncidentSelect?.(event.target.value)}>{live.incidentOptions.map(item=><option key={item.id} value={item.id}>{item.incident_code} · {item.status}</option>)}</select></label>}
              <div className="pw-incident-summary"><Truck /><div><h4>{demoMode?'Vehicle V03 unavailable':live?.incident?incidentTitle:'No Incident for this plan'}</h4><p>{demoMode?`Since ${demo.incident.since}`:live?.incident?`Detected ${new Date(live.incident.detected_at).toLocaleString('en-SG',{timeZone:'Asia/Singapore'})}`:live?'Operational questions remain available.':'Loading Incident data...'}</p></div></div>
              {live&&!live.incident&&<p className="pw-demo-note">There is no Incident to recover. A new Incident will appear here after it is recorded; no placeholder Incident is used.</p>}
              {live?.incident&&live.incident.base_delivery_plan_id!==live.currentPlanId&&<p className="pw-demo-note">Historical Incident: its Base Plan is no longer Current. Recovery is unavailable here.</p>}
              <dl className="pw-incident-stats"><div><dt>Affected orders</dt><dd>{demoMode?3:live?.affectedOrderIds.length??'—'}</dd></div><div><dt>Handover orders</dt><dd>{demoMode?'—':live?.incident?.handover_order_count??0}</dd></div><div><dt>Status</dt><dd className="pw-review">{demoMode?'Review':live?.incident?.status??'NONE'}</dd></div></dl>
              {live&&!live.incident?<button className="pw-card-link" onClick={onRefresh}>Refresh incidents <ArrowRight /></button>:<button className="pw-card-link" disabled={!demoMode&&!live?.incident} onClick={() => show('incident')}>View incident details <ArrowRight /></button>}
            </div>
          </article>
          <article className="pw-card pw-risks" aria-labelledby="pw-risks-title">
            <PanelSurface />
            <div className="pw-card-content">
              <h3 id="pw-risks-title"><span className="pw-heading-group"><TriangleAlert />{demoMode?'RISK ALERTS':live?.incident?'AFFECTED ORDER ALERTS':'CURRENT PLAN ALERTS'}</span><span className="pw-count">{demoMode?2:live?.risks.length??'—'}</span></h3>
              <div className="pw-risk-list">{(demoMode?demo.risks.map(r=>({id:r.id,description:r.description,detail:r.detail,level:r.level,alertId:null})):live?.risks.map(r=>({id:r.orderCode,description:r.description,detail:r.detail,level:'AT RISK',alertId:r.alertId}))??[]).map(risk => <button key={risk.id} disabled={asking} onClick={() => risk.alertId?void ask('Explain this risk alert.',undefined,{alert_id:risk.alertId}):show('orders')} aria-label={risk.alertId?`Explain alert for ${risk.id}`:`View ${risk.id}`}>
                <strong>{risk.id}</strong><span>{risk.description}<small>{risk.detail}</small></span><em>{risk.level}</em>
              </button>)}</div>
               {!demoMode&&live&&live.risks.length===0&&<p className="pw-demo-note">{live.incident?'No active alert is linked to this Incident.':'No active alerts for the Current Plan.'}</p>}
              <button className="pw-card-link" disabled={!demoMode&&!live} onClick={() => show('orders')}>View {live?.incident?'affected':'alerted'} orders <ArrowRight /></button>
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
      <p className="pw-eyebrow">{demoMode?'DEMO SCENARIO':live?.incident?'INCIDENT SNAPSHOT':'CURRENT PLAN ALERTS'} · {demoMode?demo.incident.id:live?.incident?.incident_code??live?.planCode}</p>
      <h2 id="pw-dialog-title">{detail === 'incident' ? demoMode?'Vehicle V03 unavailable':incidentTitle : 'Affected orders'}</h2>
      <p>{demoMode?'V03 became unavailable at 10:18 AM. One route and three orders are affected.':live?.incident?`${live.incident.incident_code} affects ${live.affectedOrderIds.length} order(s). Status: ${live.incident.status}.`:live?'No Incident exists for this plan. These orders have active risk alerts.':error}</p>
      <div className="pw-detail-orders">{(demoMode?demo.incident.affectedOrders:live?.incident?live.affectedOrderCodes:live?.risks.map(risk=>risk.orderCode)??[]).map((id,index) => <div key={id}><b>{id}</b><span>{demoMode?(index < 2 ? 'Delivery window risk' : 'Affected · review required'):live?.incident?'Detection-time affected order':'Active risk alert'}</span></div>)}</div>
      <p className="pw-detail-note">{demoMode?'This is a demo briefing. Recovery generation and plan application are not connected.':'Incident impact comes from persisted backend facts; the dispatcher controls approval.'}</p>
      <button className="pw-dialog-done" onClick={() => dialog.current?.close()}>Back to briefing <ArrowRight /></button>
    </dialog>
  </>;
}
