import { useEffect, useRef, useState } from "react";
import { credentialMonitoringPortfolio } from "./monitoring-portfolio";
import {
  BrowserMonitoringPersistence,
  exportComplianceRecovery,
  parseComplianceRecovery,
  previewComplianceRecovery,
  MonitoringPortfolioRepository,
  queryMonitoringInterface,
  querySupervisorReviewQueue,
  type MonitoringControlRole,
  type ComplianceRecoveryArchive,
} from "./credential-monitoring-domain";

export function CredentialMonitoringControl() {
  const [repository] = useState(
    () =>
      new MonitoringPortfolioRepository(
        new BrowserMonitoringPersistence(localStorage),
      ),
  );
  const [state, setState] = useState(() => repository.read());
  const [role, setRole] = useState<MonitoringControlRole>(
    "Compliance Reviewer",
  );
  const [monitoringId, setMonitoringId] = useState('MON-AR-18');
  const [inputByRecord, setInputByRecord] = useState<Record<string, { evidence: string; rationale: string }>>(() => { try { const saved: unknown = JSON.parse(localStorage.getItem('skillorbit:monitoring-work-input:v1') ?? '{}'); if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {}; return Object.fromEntries(Object.entries(saved).filter((entry): entry is [string, { evidence: string; rationale: string }] => { const value: unknown = entry[1]; return Boolean(value && typeof value === 'object' && 'evidence' in value && typeof value.evidence === 'string' && 'rationale' in value && typeof value.rationale === 'string'); })); } catch { return {}; } });
  const [assignedSupervisor, setAssignedSupervisor] = useState('Monitoring supervisor');
  const [routineReviewOn, setRoutineReviewOn] = useState('2026-10-21');
  const selectedRecord = state.records.find((item) => item.monitoringId === monitoringId);
  const [message, setMessage] = useState("");
  const [recoveryArchive, setRecoveryArchive] = useState<ComplianceRecoveryArchive | null>(() => { try { const saved = localStorage.getItem('skillorbit:compliance-recovery:v1'); return saved ? parseComplianceRecovery(saved) : null; } catch { return null; } });
  const evidenceReference = inputByRecord[monitoringId]?.evidence ?? "SUPERVISOR-OBS-18";
  const reviewRationale = inputByRecord[monitoringId]?.rationale ?? "Supervisor verified the observation against the current review.";
  const [rescheduledOn, setRescheduledOn] = useState("2026-10-25");
  const [dueReviewReason, setDueReviewReason] = useState("Supervisor evidence and acknowledgement require an extended review window.");
  const [replacementSupervisor, setReplacementSupervisor] = useState("Regional monitoring supervisor");
  const [availabilityReason, setAvailabilityReason] = useState("Assigned supervisor is unavailable for the scheduled evidence review.");
  const [transferCause, setTransferCause] = useState<'unavailable' | 'returned evidence'>('unavailable');
  const updateInput = (field: 'evidence' | 'rationale', value: string) => { setInputByRecord((current) => ({ ...current, [monitoringId]: { evidence: evidenceReference, rationale: reviewRationale, ...current[monitoringId], [field]: value } })); };
  useEffect(() => { localStorage.setItem('skillorbit:monitoring-work-input:v1', JSON.stringify(inputByRecord)); }, [inputByRecord]);
  const feedback = useRef<HTMLParagraphElement>(null);
  const portfolio = credentialMonitoringPortfolio(state.records, "2026-10-20");
  const recoveryPreview = recoveryArchive ? previewComplianceRecovery(state, recoveryArchive) : null;
  const captureRecovery = () => { try { const archive = exportComplianceRecovery(state, { id: crypto.randomUUID(), monitoringId, role, createdOn: '2026-10-29' }); localStorage.setItem('skillorbit:compliance-recovery:v1', JSON.stringify(archive)); setRecoveryArchive(archive); setMessage('Monitoring compliance recovery archive captured; learner progress is separate.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Recovery export failed.'); } queueMicrotask(() => feedback.current?.focus()); };
  const loadRecovery = async (file: File | undefined) => { if (!file) return; try { setRecoveryArchive(parseComplianceRecovery(await file.text())); setMessage('Compliance recovery archive loaded for review without changing learner progress.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Recovery archive could not be loaded.'); } queueMicrotask(() => feedback.current?.focus()); };
  const applyRecovery = () => { if (!recoveryArchive) return; try { setState(repository.importRecovery(recoveryArchive, { id: crypto.randomUUID(), expectedRevision: state.revision, role, importedBy: 'Compliance lead', importedOn: '2026-10-29' })); setMessage('Verified compliance history imported; learner progress was preserved.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Recovery import failed.'); } queueMicrotask(() => feedback.current?.focus()); };
  const monitoringView = queryMonitoringInterface(state, monitoringId, role);
  const supervisorQueue = querySupervisorReviewQueue(state, '2026-10-23');
  const currentReview = state.reviewHistory.filter((item) => item.monitoringId === monitoringId).at(-1);
  const currentNotice = state.scheduledNotices.find((item) => item.reviewId === currentReview?.id && item.audience === (role === "Learner" ? "learner" : "supervisor"));
  const currentAcknowledgement = state.noticeAcknowledgements.find((item) => item.noticeId === currentNotice?.id);
  const currentDueDecision = state.dueReviewDecisions.find((item) => item.reviewId === currentReview?.id);
  const decideDueReview = (outcome: 'completed' | 'deferred' | 'missed') => { try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, role, monitoringId, outcome, reason: dueReviewReason, nextReviewOn: outcome === 'completed' ? null : rescheduledOn, decidedBy: 'Compliance lead', decidedOn: [currentReview?.reviewOn ?? '2026-10-23', latestDecision?.reviewedOn ?? '', currentAcknowledgement?.acknowledgedOn ?? ''].sort().at(-1) ?? '2026-10-23' })); setMessage(outcome === 'completed' ? 'Due review completed against accepted evidence and current acknowledgements.' : `Due review ${outcome}; prior schedule and learner evidence remain preserved.`); } catch (error) { setMessage(error instanceof Error ? error.message : 'Due-review decision failed.'); } queueMicrotask(() => feedback.current?.focus()); };
  const reschedule = () => { try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, role, monitoringId, reviewOn: rescheduledOn, asOf: "2026-10-20", reason: "The supervisor observation window moved after learner availability changed." })); setMessage("Review rescheduled; prior notices remain historical and new cycle notices are prepared."); } catch (error) { setMessage(error instanceof Error ? error.message : "Review rescheduling failed."); } queueMicrotask(() => feedback.current?.focus()); };
  const reassignSupervisor = () => { try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, role, monitoringId, replacementSupervisor, reviewOn: rescheduledOn, asOf: transferCause === 'returned evidence' ? '2026-10-24' : '2026-10-20', cause: transferCause, reason: availabilityReason, approvalReference: "COMPLIANCE-SUPERVISOR-18", approvedBy: "Compliance lead" })); setMessage("Supervisor reassignment approved; current learner evidence and prior decisions remain available."); } catch (error) { setMessage(error instanceof Error ? error.message : "Supervisor reassignment failed."); } queueMicrotask(() => feedback.current?.focus()); };
  const acknowledgeNotice = () => { if (!currentNotice) return; try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, role, noticeId: currentNotice.id, actor: currentNotice.recipient, acknowledgedOn: "2026-10-21" })); setMessage("Current review-cycle notice acknowledged locally."); } catch (error) { setMessage(error instanceof Error ? error.message : "Notice acknowledgement failed."); } queueMicrotask(() => feedback.current?.focus()); };
  const schedule = () => {
    try {
      setState(
        repository.dispatch({
          id: crypto.randomUUID(),
          expectedRevision: state.revision,
          role,
          monitoringId,
          owner: "Senior compliance reviewer",
          reviewOn: "2026-10-21",
          asOf: "2026-10-20",
          evidenceRequested:
            "Provide supervisor observation for both failed credential uses.",
        }),
      );
      setMessage(
        "High-risk monitoring review reassigned with an evidence request.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Monitoring review failed.",
      );
    }
    queueMicrotask(() => feedback.current?.focus());
  };
  const scheduleDue = () => { try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, role, monitoringId, routineReview: true, supervisor: assignedSupervisor, owner: 'Senior compliance reviewer', reviewOn: routineReviewOn, asOf: '2026-10-20', evidenceRequested: `Provide current supervisor observation for the ${selectedRecord?.credential ?? 'credential'} monitoring period.` })); setMessage('Due monitoring review assigned with separate learner and supervisor notices.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Due monitoring assignment failed.'); } queueMicrotask(() => feedback.current?.focus()); };
  const latestSubmission = state.evidenceSubmissions.filter((item) => item.monitoringId === monitoringId).at(-1);
  const latestDecision = state.supervisorReviews.filter((item) => item.submissionId === latestSubmission?.id).at(-1);
  const carriedEvidenceNeedsReview = latestDecision?.decision === 'accepted' && latestDecision.reviewId !== currentReview?.id;
  const revalidateEvidence = (decision: "accepted" | "returned") => { try { if (!latestSubmission) throw new Error('Retained learner evidence is unavailable.'); setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, role, monitoringId, submissionId: latestSubmission.id, carryForwardReview: true, decision, rationale: reviewRationale, reviewer: currentReview?.assignedSupervisor ?? 'Monitoring supervisor', reviewedOn: currentReview?.reviewOn ?? '2026-10-25' })); setMessage(decision === 'accepted' ? 'Retained evidence revalidated for the current cycle; the original supervisor decision remains historical.' : 'Retained evidence returned for current-cycle correction; original acceptance and learner work remain historical.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Evidence revalidation failed.'); } queueMicrotask(() => feedback.current?.focus()); };
  const submitEvidence = () => { try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, role, monitoringId, learner: selectedRecord?.learner ?? "", evidenceReference, submittedOn: ["2026-10-22", currentReview?.reviewOn ?? "", latestDecision?.reviewedOn ?? ""].sort().at(-1) ?? "2026-10-22" })); setMessage("Learner monitoring evidence submitted for the active review."); } catch (error) { setMessage(error instanceof Error ? error.message : "Evidence submission failed."); } queueMicrotask(() => feedback.current?.focus()); };
  const reviewEvidence = (decision: "accepted" | "returned") => { try { if (!latestSubmission) throw new Error("No learner evidence is awaiting review."); setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, role, monitoringId, submissionId: latestSubmission.id, decision, rationale: reviewRationale, reviewer: currentReview?.assignedSupervisor ?? "Monitoring supervisor", reviewedOn: ["2026-10-23", latestSubmission.submittedOn].sort().at(-1) ?? "2026-10-23" })); setMessage(`Supervisor ${decision} learner evidence.`); } catch (error) { setMessage(error instanceof Error ? error.message : "Supervisor review failed."); } queueMicrotask(() => feedback.current?.focus()); };
  const [outcomeInputs, setOutcomeInputs] = useState<Record<string, { uses: string; reference: string; rationale: string }>>({});
  const outcomeInput = outcomeInputs[monitoringId] ?? { uses: '5', reference: '', rationale: 'Observed supervised uses satisfy the credential monitoring requirements.' };
  const observedUses = outcomeInput.uses, outcomeReference = outcomeInput.reference, outcomeRationale = outcomeInput.rationale;
  const updateOutcomeInput = (field: 'uses' | 'reference' | 'rationale', value: string) => { setOutcomeInputs((current) => ({ ...current, [monitoringId]: { ...outcomeInput, ...current[monitoringId], [field]: value } })); };
  const currentOutcome = state.supervisedOutcomes.filter((item) => item.monitoringId === monitoringId).at(-1);
  const recordOutcome = () => { try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, role, monitoringId, supervisedOutcome: true, successfulUses: Number(observedUses), evidenceReference: outcomeReference, rationale: outcomeRationale, recordedBy: currentReview?.assignedSupervisor ?? latestDecision?.reviewer ?? '', recordedOn: [latestDecision?.reviewedOn ?? '', currentOutcome?.recordedOn ?? '', selectedRecord?.endsOn ?? ''].sort().at(-1) ?? '2026-10-26' })); setMessage('Observed credential outcomes recorded with their exact supervisor review; independent compliance closure remains required.'); } catch(error) { setMessage(error instanceof Error ? error.message : 'Supervised outcome failed.'); } };
  const close = () => {
    try {
      const decisionId = crypto.randomUUID();
      setState(
        repository.dispatch({
          id: decisionId,
          expectedRevision: state.revision,
          role,
          monitoringId,
          acceptedEvidence: [latestSubmission?.evidenceReference ?? "SUPERVISOR-OBS-18"],
          supervisorApproval: currentOutcome?.id ?? latestDecision?.id ?? "SUP-APP-18",
          complianceApproval: decisionId,
          successfulUses: currentOutcome?.successfulUses ?? 5,
          closedBy: "Compliance lead",
          closedOn: ["2026-10-26", selectedRecord?.endsOn ?? "", currentOutcome?.recordedOn ?? ""].sort().at(-1) ?? "2026-10-26",
        }),
      );
      setMessage(
        "Credential monitoring completed with current learner evidence and independent approval.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Monitoring closure failed.",
      );
    }
    queueMicrotask(() => feedback.current?.focus());
  };
  return (
    <section className="card" aria-label="Credential monitoring portfolio">
      <h2>Credential monitoring portfolio</h2>
      <label>
        Monitoring role
        <select
          value={role}
          onChange={(event) => {
            setRole(event.target.value as MonitoringControlRole);
          }}
        >
          <option>Learner</option>
          <option>Supervisor</option>
          <option>Compliance Reviewer</option>
          <option>Compliance Lead</option>
        </select>
      </label>
      <label>Active monitoring record<select value={monitoringId} onChange={(event) => { setMonitoringId(event.target.value); setMessage(''); }}>{state.records.map((item) => <option key={item.monitoringId} value={item.monitoringId}>{item.monitoringId} · {item.learner}</option>)}</select></label>
      <p aria-label="Selected monitoring record">{selectedRecord?.learner} · {selectedRecord?.credential} · {monitoringId}</p>
      {!currentReview && <fieldset><legend>Assign due review</legend><label>Review supervisor<input value={assignedSupervisor} onChange={(event) => { setAssignedSupervisor(event.target.value); }} /></label><label>Due review date<input type="date" value={routineReviewOn} onChange={(event) => { setRoutineReviewOn(event.target.value); }} /></label><button disabled={role !== 'Compliance Lead' || state.closures.some((item) => item.monitoringId === monitoringId)} onClick={scheduleDue}>Assign due monitoring review</button></fieldset>}
      {portfolio.map((item) => (
        <p key={item.monitoringId}>
          {item.monitoringId} · {item.learner} · {item.risk} risk ·{" "}
          {item.remainingDays} days · evidence pending {item.evidencePending} ·
          owner {item.owner}
        </p>
      ))}
      <section aria-label="Monitoring compliance recovery"><h3>Compliance recovery</h3><p>Only review and compliance history can be imported. Current learner progress remains authoritative.</p><button disabled={role !== 'Compliance Lead'} onClick={captureRecovery}>Export monitoring compliance history</button><label>Import compliance archive<input type="file" accept="application/json,.json" onChange={(event) => { void loadRecovery(event.target.files?.[0]); }} /></label>{recoveryArchive && <><p aria-label="Compliance import preview">Archive {recoveryArchive.id} · learner {recoveryArchive.learner} · source revision {recoveryArchive.sourceRevision} · current revision {state.revision} · {recoveryPreview?.ready ? 'verified for import' : 'import blocked'}</p>{recoveryPreview?.reasons.map((reason) => <p role="alert" key={reason}>{reason}</p>)}<a download={`monitoring-${recoveryArchive.monitoringId}-${recoveryArchive.id}.json`} href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(recoveryArchive, null, 2))}`}>Download compliance archive</a><button disabled={role !== 'Compliance Lead' || !recoveryPreview?.ready} onClick={applyRecovery}>Import verified compliance history</button></>}<ol aria-label="Compliance recovery import history">{state.recoveryImports.map((item) => <li key={item.id}>{item.monitoringId} · {item.archiveId} · {item.importedBy}</li>)}</ol></section>
      {monitoringView?.persona === "learner" ? <p aria-label="Learner monitoring lineage">Monitoring {monitoringView.monitoringPeriod.startsOn} to {monitoringView.monitoringPeriod.endsOn} · {monitoringView.status} · review {monitoringView.upcomingReview ?? "not scheduled"} · successful uses {monitoringView.successfulUses} · evidence {monitoringView.submittedEvidence.map((item) => item.evidenceReference).join(", ") || "pending"}</p> : monitoringView && <p aria-label="Reviewer monitoring lineage">{monitoringView.status} · owner {monitoringView.owner} · previous failures {monitoringView.previousFailures} · review {monitoringView.upcomingReview ?? "not scheduled"} · decision {monitoringView.complianceDecision?.outcome ?? "pending"}</p>}
      {role === 'Supervisor' && <section aria-label="Supervisor review workload"><h3>Evidence review workload</h3><ol>{supervisorQueue.map((item) => <li key={item.monitoringId}><button aria-pressed={monitoringId === item.monitoringId} onClick={() => { setMonitoringId(item.monitoringId); setMessage(""); }}>Review {item.learner}</button> {item.learner} · {item.credential} · monitoring {item.monitoringPeriod.startsOn} to {item.monitoringPeriod.endsOn} · supervisor {item.supervisor} · notice {item.noticeAcknowledged ? "acknowledged" : "pending"} · {item.status} · due {item.dueOn}{item.overdue ? ' · overdue' : ''} · evidence {item.evidenceReference ?? item.requestedEvidence} · previous decision {item.previousDecision ?? 'none'}</li>)}</ol></section>}
      {monitoringView?.persona === 'learner' && <section aria-label="Learner review notices"><h3>Review notices</h3><ol>{monitoringView.notices.map((item) => <li key={item.id}>{item.decision === 'returned' ? 'Correction requested' : 'Evidence accepted'} · {item.evidenceReference} · {item.rationale}</li>)}</ol></section>}
      {currentReview && <section aria-label="Scheduled review communication"><h3>Scheduled evidence review</h3><p>Current cycle {currentReview.id} · due {currentReview.reviewOn}</p>{(role === "Learner" || role === "Supervisor") && currentNotice && <><p aria-label="Current review notice">{currentNotice.message} · {currentAcknowledgement ? "acknowledged" : "acknowledgement pending"}</p><button disabled={Boolean(currentAcknowledgement)} onClick={acknowledgeNotice}>Acknowledge current review notice</button></>}<ol aria-label="Review notice history">{state.scheduledNotices.filter((item) => item.monitoringId === currentReview.monitoringId && (role === "Learner" ? item.audience === "learner" : role === "Supervisor" ? item.audience === "supervisor" : false)).map((item) => <li key={item.id}>{item.reviewId} · due {item.dueOn} · {item.reviewId === currentReview.id ? "current" : "superseded"}</li>)}</ol></section>}
      {currentReview && <section aria-label="Due review decision"><h3>Due review completion</h3><p aria-label="Current assignment completion">{currentDueDecision ? `Current cycle ${currentDueDecision.outcome}` : `Current cycle due ${currentReview.reviewOn} · decision pending`} · supervisor {currentReview.assignedSupervisor ?? 'Monitoring supervisor'} · evidence {latestSubmission?.evidenceReference ?? 'missing'} · review {latestDecision?.decision ?? 'pending'}</p><label>Decision or extension reason<textarea value={dueReviewReason} onChange={(event) => { setDueReviewReason(event.target.value); }} /></label><button disabled={role !== 'Compliance Lead' || Boolean(currentDueDecision)} onClick={() => { decideDueReview('completed'); }}>Complete due review</button><button disabled={role !== 'Compliance Lead' || Boolean(currentDueDecision)} onClick={() => { decideDueReview('deferred'); }}>Defer due review</button><button disabled={role !== 'Compliance Lead' || Boolean(currentDueDecision)} onClick={() => { decideDueReview('missed'); }}>Escalate missed review</button><ol aria-label="Due review decision history">{state.dueReviewDecisions.filter((item) => item.monitoringId === monitoringId).map((item) => <li key={item.id}>{item.reviewId} · {item.outcome} · evidence {item.evidenceSubmissionId ?? 'incomplete'} · next {item.nextReviewId ?? 'none'} · {item.reason}</li>)}</ol></section>}
      <button
        disabled={role !== "Compliance Lead" || Boolean(currentReview) || portfolio.find((item) => item.monitoringId === monitoringId)?.risk !== "high"}
        onClick={schedule}
      >
        Schedule high-risk monitoring review
      </button>
      <label>Rescheduled review date<input type="date" value={rescheduledOn} onChange={(event) => { setRescheduledOn(event.target.value); }} /></label><button disabled={role !== "Compliance Lead" || !currentReview || state.closures.some((item) => item.monitoringId === monitoringId)} onClick={reschedule}>Reschedule evidence review</button>
      {currentReview && <section aria-label="Supervisor availability exception"><h3>Supervisor availability</h3><p>Current supervisor {currentReview.assignedSupervisor ?? 'Monitoring supervisor'} · learner evidence {state.evidenceSubmissions.filter((item) => item.monitoringId === monitoringId).length} submissions retained</p><label>Replacement supervisor<input value={replacementSupervisor} onChange={(event) => { setReplacementSupervisor(event.target.value); }} /></label><label>Transfer cause<select value={transferCause} onChange={(event) => { setTransferCause(event.target.value as typeof transferCause); }}><option value="unavailable">Supervisor unavailable</option><option value="returned evidence">Returned learner evidence</option></select></label><label>Availability exception reason<input value={availabilityReason} onChange={(event) => { setAvailabilityReason(event.target.value); }} /></label><button disabled={role !== 'Compliance Lead' || Boolean(currentDueDecision)} onClick={reassignSupervisor}>Approve supervisor reassignment</button><ol aria-label="Supervisor assignment history">{state.supervisorExceptions.filter((item) => item.monitoringId === monitoringId).map((item) => <li key={item.id}>{item.unavailableSupervisor} → {item.replacementSupervisor} · {item.cause ?? 'unavailable'}{item.returnedDecisionId ? ` · returned ${item.returnedDecisionId}` : ''} · review {item.reviewId} → {item.nextReviewId} · due {item.previousReviewOn} → {item.revisedReviewOn} · {item.reason}</li>)}</ol></section>}
      <label>Monitoring evidence reference <input value={evidenceReference} onChange={(event) => { updateInput("evidence", event.target.value); }} /></label>
      <button disabled={role !== "Learner" || !currentReview || (Boolean(latestSubmission) && latestDecision?.decision !== "returned")} onClick={submitEvidence}>Submit learner monitoring evidence</button>
      <label>Supervisor review rationale <input value={reviewRationale} onChange={(event) => { updateInput("rationale", event.target.value); }} /></label>
      {carriedEvidenceNeedsReview && <section aria-label="Retained evidence revalidation"><h3>Evidence carried into a new review cycle</h3><p>The original acceptance remains historical. Current-cycle supervisor confirmation is required for {latestSubmission?.evidenceReference}.</p><button disabled={role !== 'Supervisor' || Boolean(currentDueDecision)} onClick={() => { revalidateEvidence("accepted"); }}>Revalidate retained evidence</button><button disabled={role !== 'Supervisor' || Boolean(currentDueDecision)} onClick={() => { revalidateEvidence("returned"); }}>Return retained evidence</button></section>}
      <button disabled={role !== "Supervisor" || !latestSubmission || Boolean(latestDecision)} onClick={() => { reviewEvidence("accepted"); }}>Accept monitoring evidence</button>
      <button disabled={role !== "Supervisor" || !latestSubmission || Boolean(latestDecision)} onClick={() => { reviewEvidence("returned"); }}>Return monitoring evidence</button>
      {currentReview && role !== 'Learner' && <section aria-label="Supervised credential outcomes"><h3>Observed credential outcomes</h3><p>Record actual supervised use evidence before independent closure. Legacy closure history remains available.</p><label>Observed successful uses<input type="number" min="0" step="1" value={observedUses} onChange={(event) => { updateOutcomeInput('uses', event.target.value); }} /></label><label>Observed outcome evidence<input value={outcomeReference} onChange={(event) => { updateOutcomeInput('reference', event.target.value); }} /></label><label>Observed outcome rationale<textarea value={outcomeRationale} onChange={(event) => { updateOutcomeInput('rationale', event.target.value); }} /></label><button disabled={role !== 'Supervisor' || latestDecision?.decision !== 'accepted' || state.closures.some((item) => item.monitoringId === monitoringId)} onClick={recordOutcome}>Record supervised credential outcome</button><ol aria-label="Observed outcome history">{state.supervisedOutcomes.filter((item) => item.monitoringId === monitoringId).map((item) => <li key={item.id}>{item.successfulUses} successful uses · {item.evidenceReference} · reviewer {item.recordedBy} · cycle {item.reviewId} · {item.recordedOn}</li>)}</ol></section>}
      <button
        disabled={
          role !== "Compliance Lead" ||
          !currentReview ||
          (Boolean(latestSubmission) && latestDecision?.decision !== "accepted") ||
          state.closures.some((item) => item.monitoringId === monitoringId)
        }
        onClick={close}
      >
        Complete governed credential monitoring
      </button>
      {message && (
        <p ref={feedback} tabIndex={-1} role="status">
          {message}
        </p>
      )}
      <ol aria-label="Monitoring review history">
        {state.reviewHistory.filter((item) => item.monitoringId === monitoringId).map((item) => (
          <li key={item.id}>
            {item.monitoringId} · {item.previousOwner} to {item.owner} · review{" "}
            {item.reviewOn} · failed uses {item.failedUses}
          </li>
        ))}
      </ol>
      <ol aria-label="Learner monitoring evidence">{state.evidenceSubmissions.filter((item) => item.monitoringId === monitoringId).map((item) => <li key={item.id}>{item.evidenceReference} · submitted {item.submittedOn} · review {item.reviewId} · supersedes {item.supersedesSubmissionId ?? 'none'} · {state.supervisorReviews.filter((decision) => decision.submissionId === item.id).at(-1)?.decision ?? "awaiting supervisor review"}</li>)}</ol>
      {role !== "Learner" && <ol aria-label="Supervisor evidence decisions">{state.supervisorReviews.filter((item) => item.monitoringId === monitoringId).map((item) => <li key={item.id}>{item.decision} · {item.reviewer} · {item.rationale} · {item.reviewedOn}{item.revalidatedFromDecisionId ? ' · revalidates ' + item.revalidatedFromDecisionId + ' for ' + (item.reviewId ?? 'unknown cycle') : ''}</li>)}</ol>}
      <ol aria-label="Monitoring closure history">
        {state.closures.filter((item) => item.monitoringId === monitoringId).map((item) => (
          <li key={item.id}>
            {item.monitoringId} · {item.outcome} · successful uses{" "}
            {item.successfulUses} · prior failures {item.previousFailedUses}
          </li>
        ))}
      </ol>
    </section>
  );
}
