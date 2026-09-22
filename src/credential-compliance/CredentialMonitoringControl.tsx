import { useRef, useState } from "react";
import { credentialMonitoringPortfolio } from "./monitoring-portfolio";
import {
  BrowserMonitoringPersistence,
  MonitoringPortfolioRepository,
  queryMonitoringInterface,
  querySupervisorReviewQueue,
  type MonitoringControlRole,
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
  const [message, setMessage] = useState("");
  const [evidenceReference, setEvidenceReference] = useState("SUPERVISOR-OBS-18");
  const [reviewRationale, setReviewRationale] = useState("Supervisor verified the observation against the current review.");
  const [rescheduledOn, setRescheduledOn] = useState("2026-10-25");
  const [dueReviewReason, setDueReviewReason] = useState("Supervisor evidence and acknowledgement require an extended review window.");
  const [replacementSupervisor, setReplacementSupervisor] = useState("Regional monitoring supervisor");
  const [availabilityReason, setAvailabilityReason] = useState("Assigned supervisor is unavailable for the scheduled evidence review.");
  const feedback = useRef<HTMLParagraphElement>(null);
  const portfolio = credentialMonitoringPortfolio(state.records, "2026-10-20");
  const monitoringView = queryMonitoringInterface(state, "MON-AR-18", role);
  const supervisorQueue = querySupervisorReviewQueue(state, '2026-10-23');
  const currentReview = state.reviewHistory.filter((item) => item.monitoringId === "MON-AR-18").at(-1);
  const currentNotice = state.scheduledNotices.find((item) => item.reviewId === currentReview?.id && item.audience === (role === "Learner" ? "learner" : "supervisor"));
  const currentAcknowledgement = state.noticeAcknowledgements.find((item) => item.noticeId === currentNotice?.id);
  const currentDueDecision = state.dueReviewDecisions.find((item) => item.reviewId === currentReview?.id);
  const decideDueReview = (outcome: 'completed' | 'deferred' | 'missed') => { try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, role, monitoringId: 'MON-AR-18', outcome, reason: dueReviewReason, nextReviewOn: outcome === 'completed' ? null : rescheduledOn, decidedBy: 'Compliance lead', decidedOn: currentReview?.reviewOn ?? '2026-10-23' })); setMessage(outcome === 'completed' ? 'Due review completed against accepted evidence and current acknowledgements.' : `Due review ${outcome}; prior schedule and learner evidence remain preserved.`); } catch (error) { setMessage(error instanceof Error ? error.message : 'Due-review decision failed.'); } queueMicrotask(() => feedback.current?.focus()); };
  const reschedule = () => { try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, role, monitoringId: "MON-AR-18", reviewOn: rescheduledOn, asOf: "2026-10-20", reason: "The supervisor observation window moved after learner availability changed." })); setMessage("Review rescheduled; prior notices remain historical and new cycle notices are prepared."); } catch (error) { setMessage(error instanceof Error ? error.message : "Review rescheduling failed."); } queueMicrotask(() => feedback.current?.focus()); };
  const reassignSupervisor = () => { try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, role, monitoringId: "MON-AR-18", replacementSupervisor, reviewOn: rescheduledOn, asOf: "2026-10-20", reason: availabilityReason, approvalReference: "COMPLIANCE-SUPERVISOR-18", approvedBy: "Compliance lead" })); setMessage("Supervisor availability exception approved; current learner evidence remains available."); } catch (error) { setMessage(error instanceof Error ? error.message : "Supervisor reassignment failed."); } queueMicrotask(() => feedback.current?.focus()); };
  const acknowledgeNotice = () => { if (!currentNotice) return; try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, role, noticeId: currentNotice.id, actor: currentNotice.recipient, acknowledgedOn: "2026-10-21" })); setMessage("Current review-cycle notice acknowledged locally."); } catch (error) { setMessage(error instanceof Error ? error.message : "Notice acknowledgement failed."); } queueMicrotask(() => feedback.current?.focus()); };
  const schedule = () => {
    try {
      setState(
        repository.dispatch({
          id: crypto.randomUUID(),
          expectedRevision: state.revision,
          role,
          monitoringId: "MON-AR-18",
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
  const latestSubmission = state.evidenceSubmissions.at(-1);
  const latestDecision = state.supervisorReviews.find((item) => item.submissionId === latestSubmission?.id);
  const submitEvidence = () => { try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, role, monitoringId: "MON-AR-18", learner: "Amira Rahman", evidenceReference, submittedOn: "2026-10-22" })); setMessage("Learner monitoring evidence submitted for the active review."); } catch (error) { setMessage(error instanceof Error ? error.message : "Evidence submission failed."); } queueMicrotask(() => feedback.current?.focus()); };
  const reviewEvidence = (decision: "accepted" | "returned") => { try { if (!latestSubmission) throw new Error("No learner evidence is awaiting review."); setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, role, monitoringId: "MON-AR-18", submissionId: latestSubmission.id, decision, rationale: reviewRationale, reviewer: currentReview?.assignedSupervisor ?? "Monitoring supervisor", reviewedOn: "2026-10-23" })); setMessage(`Supervisor ${decision} learner evidence.`); } catch (error) { setMessage(error instanceof Error ? error.message : "Supervisor review failed."); } queueMicrotask(() => feedback.current?.focus()); };
  const close = () => {
    try {
      setState(
        repository.dispatch({
          id: crypto.randomUUID(),
          expectedRevision: state.revision,
          role,
          monitoringId: "MON-AR-18",
          acceptedEvidence: [latestSubmission?.evidenceReference ?? "SUPERVISOR-OBS-18"],
          supervisorApproval: "SUP-APP-18",
          complianceApproval: "COMP-APP-18",
          successfulUses: 5,
          closedBy: "Compliance lead",
          closedOn: "2026-10-26",
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
      {portfolio.map((item) => (
        <p key={item.monitoringId}>
          {item.monitoringId} · {item.learner} · {item.risk} risk ·{" "}
          {item.remainingDays} days · evidence pending {item.evidencePending} ·
          owner {item.owner}
        </p>
      ))}
      {monitoringView?.persona === "learner" ? <p aria-label="Learner monitoring lineage">Monitoring {monitoringView.monitoringPeriod.startsOn} to {monitoringView.monitoringPeriod.endsOn} · {monitoringView.status} · review {monitoringView.upcomingReview ?? "not scheduled"} · successful uses {monitoringView.successfulUses} · evidence {monitoringView.submittedEvidence.map((item) => item.evidenceReference).join(", ") || "pending"}</p> : monitoringView && <p aria-label="Reviewer monitoring lineage">{monitoringView.status} · owner {monitoringView.owner} · previous failures {monitoringView.previousFailures} · review {monitoringView.upcomingReview ?? "not scheduled"} · decision {monitoringView.complianceDecision?.outcome ?? "pending"}</p>}
      {role === 'Supervisor' && <section aria-label="Supervisor review workload"><h3>Evidence review workload</h3><ol>{supervisorQueue.map((item) => <li key={item.monitoringId}>{item.learner} · {item.credential} · monitoring {item.monitoringPeriod.startsOn} to {item.monitoringPeriod.endsOn} · supervisor {item.supervisor} · notice {item.noticeAcknowledged ? "acknowledged" : "pending"} · {item.status} · due {item.dueOn}{item.overdue ? ' · overdue' : ''} · evidence {item.evidenceReference ?? item.requestedEvidence} · previous decision {item.previousDecision ?? 'none'}</li>)}</ol></section>}
      {monitoringView?.persona === 'learner' && <section aria-label="Learner review notices"><h3>Review notices</h3><ol>{monitoringView.notices.map((item) => <li key={item.id}>{item.decision === 'returned' ? 'Correction requested' : 'Evidence accepted'} · {item.evidenceReference} · {item.rationale}</li>)}</ol></section>}
      {currentReview && <section aria-label="Scheduled review communication"><h3>Scheduled evidence review</h3><p>Current cycle {currentReview.id} · due {currentReview.reviewOn}</p>{(role === "Learner" || role === "Supervisor") && currentNotice && <><p aria-label="Current review notice">{currentNotice.message} · {currentAcknowledgement ? "acknowledged" : "acknowledgement pending"}</p><button disabled={Boolean(currentAcknowledgement)} onClick={acknowledgeNotice}>Acknowledge current review notice</button></>}<ol aria-label="Review notice history">{state.scheduledNotices.filter((item) => item.monitoringId === currentReview.monitoringId && (role === "Learner" ? item.audience === "learner" : role === "Supervisor" ? item.audience === "supervisor" : false)).map((item) => <li key={item.id}>{item.reviewId} · due {item.dueOn} · {item.reviewId === currentReview.id ? "current" : "superseded"}</li>)}</ol></section>}
      {currentReview && <section aria-label="Due review decision"><h3>Due review completion</h3><p aria-label="Current assignment completion">{currentDueDecision ? `Current cycle ${currentDueDecision.outcome}` : `Current cycle due ${currentReview.reviewOn} · decision pending`} · supervisor {currentReview.assignedSupervisor ?? 'Monitoring supervisor'} · evidence {latestSubmission?.evidenceReference ?? 'missing'} · review {latestDecision?.decision ?? 'pending'}</p><label>Decision or extension reason<textarea value={dueReviewReason} onChange={(event) => { setDueReviewReason(event.target.value); }} /></label><button disabled={role !== 'Compliance Lead' || Boolean(currentDueDecision)} onClick={() => { decideDueReview('completed'); }}>Complete due review</button><button disabled={role !== 'Compliance Lead' || Boolean(currentDueDecision)} onClick={() => { decideDueReview('deferred'); }}>Defer due review</button><button disabled={role !== 'Compliance Lead' || Boolean(currentDueDecision)} onClick={() => { decideDueReview('missed'); }}>Escalate missed review</button><ol aria-label="Due review decision history">{state.dueReviewDecisions.map((item) => <li key={item.id}>{item.reviewId} · {item.outcome} · evidence {item.evidenceSubmissionId ?? 'incomplete'} · next {item.nextReviewId ?? 'none'} · {item.reason}</li>)}</ol></section>}
      <button
        disabled={role !== "Compliance Lead" || state.reviewHistory.length > 0}
        onClick={schedule}
      >
        Schedule high-risk monitoring review
      </button>
      <label>Rescheduled review date<input type="date" value={rescheduledOn} onChange={(event) => { setRescheduledOn(event.target.value); }} /></label><button disabled={role !== "Compliance Lead" || !currentReview || Boolean(state.closures.length)} onClick={reschedule}>Reschedule evidence review</button>
      {currentReview && <section aria-label="Supervisor availability exception"><h3>Supervisor availability</h3><p>Current supervisor {currentReview.assignedSupervisor ?? 'Monitoring supervisor'} · learner evidence {state.evidenceSubmissions.length} submissions retained</p><label>Replacement supervisor<input value={replacementSupervisor} onChange={(event) => { setReplacementSupervisor(event.target.value); }} /></label><label>Availability exception reason<input value={availabilityReason} onChange={(event) => { setAvailabilityReason(event.target.value); }} /></label><button disabled={role !== 'Compliance Lead' || Boolean(currentDueDecision)} onClick={reassignSupervisor}>Approve supervisor reassignment</button><ol aria-label="Supervisor assignment history">{state.supervisorExceptions.map((item) => <li key={item.id}>{item.unavailableSupervisor} → {item.replacementSupervisor} · review {item.reviewId} → {item.nextReviewId} · due {item.previousReviewOn} → {item.revisedReviewOn} · {item.reason}</li>)}</ol></section>}
      <label>Monitoring evidence reference <input value={evidenceReference} onChange={(event) => { setEvidenceReference(event.target.value); }} /></label>
      <button disabled={role !== "Learner" || state.reviewHistory.length === 0 || (Boolean(latestSubmission) && latestDecision?.decision !== "returned")} onClick={submitEvidence}>Submit learner monitoring evidence</button>
      <label>Supervisor review rationale <input value={reviewRationale} onChange={(event) => { setReviewRationale(event.target.value); }} /></label>
      <button disabled={role !== "Supervisor" || !latestSubmission || Boolean(latestDecision)} onClick={() => { reviewEvidence("accepted"); }}>Accept monitoring evidence</button>
      <button disabled={role !== "Supervisor" || !latestSubmission || Boolean(latestDecision)} onClick={() => { reviewEvidence("returned"); }}>Return monitoring evidence</button>
      <button
        disabled={
          role !== "Compliance Lead" ||
          state.reviewHistory.length === 0 ||
          (Boolean(latestSubmission) && latestDecision?.decision !== "accepted") ||
          state.closures.length > 0
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
        {state.reviewHistory.map((item) => (
          <li key={item.id}>
            {item.monitoringId} · {item.previousOwner} to {item.owner} · review{" "}
            {item.reviewOn} · failed uses {item.failedUses}
          </li>
        ))}
      </ol>
      <ol aria-label="Learner monitoring evidence">{state.evidenceSubmissions.map((item) => <li key={item.id}>{item.evidenceReference} · submitted {item.submittedOn} · review {item.reviewId} · supersedes {item.supersedesSubmissionId ?? 'none'} · {state.supervisorReviews.find((decision) => decision.submissionId === item.id)?.decision ?? "awaiting supervisor review"}</li>)}</ol>
      {role !== "Learner" && <ol aria-label="Supervisor evidence decisions">{state.supervisorReviews.map((item) => <li key={item.id}>{item.decision} · {item.reviewer} · {item.rationale} · {item.reviewedOn}</li>)}</ol>}
      <ol aria-label="Monitoring closure history">
        {state.closures.map((item) => (
          <li key={item.id}>
            {item.monitoringId} · {item.outcome} · successful uses{" "}
            {item.successfulUses} · prior failures {item.previousFailedUses}
          </li>
        ))}
      </ol>
    </section>
  );
}
