'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { loadRecoveryDemo } from './recovery-demo';
import { validateRecoveryResult, type RecoveryCandidate, type RecoveryLoader, type RecoveryOptionsData, type RecoveryScene, type RecoveryUIState, type RecoveryReviewState } from './recovery-types';
import { briefingDemo } from './briefing-demo';
import {approveCandidate,describeAgentFailure} from './live-agent-api';

export function useRecoveryWorkspace(reducedMotion: boolean, loader: RecoveryLoader = loadRecoveryDemo, onSelect?: (candidate: RecoveryCandidate) => void, incidentId=briefingDemo.incident.id) {
  const [scene,setScene] = useState<RecoveryScene>('briefing');
  const [request,setRequest] = useState({revision:0,count:3,incidentId});
  const [result,setResult] = useState<RecoveryOptionsData>();
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState('');
  const [detailId,setDetailId] = useState<string>();
  const [selectedCandidateId,setSelectedCandidateId] = useState<string>();
  const [review,setReview] = useState(false);
  const [reviewState,setReviewState] = useState<RecoveryReviewState>('review');
  const [previewRevision,setPreviewRevision] = useState(0);
  const [decisionReason,setDecisionReason] = useState('');
  const [decisionError,setDecisionError] = useState('');
  const [decisionBusy,setDecisionBusy] = useState(false);
  const dispatchPreviewApplied=reviewState==='preview-applied';
  const [manualReview,setManualReview] = useState(false);
  const [highlight,setHighlight] = useState<string>();
  const abort = useRef<AbortController | null>(null);
  useEffect(() => {
    if(scene !== 'transitioning-in' && scene !== 'transitioning-out') return;
    const timer = setTimeout(()=>setScene(scene === 'transitioning-in' ? 'options' : 'briefing'),reducedMotion ? 180 : 1800);
    return ()=>clearTimeout(timer);
  },[scene,reducedMotion]);
  useEffect(() => {
    if(!request.revision) return;
    const controller = new AbortController();
    abort.current = controller;
    Promise.resolve().then(()=>loader({incidentId:request.incidentId,demoCandidateCount:request.count,signal:controller.signal}))
      .then(data=>{
        if(controller.signal.aborted) return;
        setResult(validateRecoveryResult(data));setLoading(false);
      })
      .catch(reason=>{
        if(controller.signal.aborted) return;
        setError(describeAgentFailure(reason,'recovery'));setLoading(false);
      });
    return ()=>controller.abort();
  },[request,loader]);
  const generate = useCallback((count: number) => {
    abort.current?.abort();setLoading(true);setError('');setResult(undefined);
    setDetailId(undefined);setSelectedCandidateId(undefined);setReview(false);setManualReview(false);setHighlight(undefined);
    setReviewState('review');
    setDecisionReason('');setDecisionError('');
    setRequest(r=>({count,revision:r.revision+1,incidentId}));
  },[incidentId]);
  const enter = () => {
    if(scene !== 'briefing') return;
    setScene('transitioning-in');
    if(!result||result.incidentId!==incidentId) generate(request.count);
  };
  const back = () => {
    if(scene !== 'options'||dispatchPreviewApplied) return;
    abort.current?.abort();setLoading(false);setDetailId(undefined);setReview(false);setHighlight(undefined);
    setScene('transitioning-out');
  };
  const openDetail = (id: string) => {if(dispatchPreviewApplied)return;setDetailId(id);setReview(id===selectedCandidateId);setHighlight(id);};
  const closeDetail = () => {if(dispatchPreviewApplied)return;setDetailId(undefined);setReview(false);setHighlight(undefined);};
  const select = (candidate: RecoveryCandidate) => {
    if(dispatchPreviewApplied)return;
    if(candidate.id!==selectedCandidateId)setReviewState('review');
    setSelectedCandidateId(candidate.id);setDecisionError('');setReview(true);onSelect?.(candidate);
  };
  const eligible=()=>{
    const snapshot=result?.candidates.find(candidate=>candidate.id===selectedCandidateId)?.reviewSnapshot?.comparison;
    return snapshot?.approvalEligible&&snapshot.baseIsCurrent&&snapshot.candidateStatus==='READY';
  };
  const confirmChanges=()=>{if(review&&reviewState==='review'&&eligible())setReviewState('dispatch-ready');};
  const applyDispatchPreview=async()=>{
    if(reviewState!=='dispatch-ready'||!eligible()||!result||decisionBusy)return;
    if(result.source==='demo'){setPreviewRevision(n=>n+1);setReviewState('preview-applied');return;}
    const candidate=result.candidates.find(item=>item.id===selectedCandidateId);
    const planId=candidate?.reviewSnapshot?.comparison.candidatePlanId;
    if(!candidate||!planId)return;
    setDecisionBusy(true);setDecisionError('');
    try{
      await approveCandidate(candidate.id,decisionReason,planId);
      setPreviewRevision(n=>n+1);setReviewState('preview-applied');
    }catch(reason){setDecisionError(describeAgentFailure(reason,'approval'));}
    finally{setDecisionBusy(false);}
  };
  const resetPreview=()=>{if(result?.source==='live')return;setReviewState('review');setReview(true);};
  const uiState: RecoveryUIState = scene === 'transitioning-in' ? 'transitioning-in' :
    loading ? 'generating' : error ? 'error' : review ? 'candidate-selected' : detailId ? 'candidate-detail' :
      result?.candidates.length === 0 ? 'manual-intervention' : 'options-ready';
  return {scene,uiState,result,loading,error,detailId,selectedCandidateId,highlight,manualReview,review,demo:loader===loadRecoveryDemo,
    reviewState,dispatchPreviewApplied,previewRevision,decisionReason,setDecisionReason,decisionError,decisionBusy,confirmChanges,applyDispatchPreview,resetPreview,
    demoCount:request.count,enter,back,generate,openDetail,closeDetail,select,setHighlight,setManualReview};
}
export type RecoveryController = ReturnType<typeof useRecoveryWorkspace>;
