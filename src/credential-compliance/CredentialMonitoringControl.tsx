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
  const feedback = useRef<HTMLParagraphElement>(null);
  const portfolio = credentialMonitoringPortfolio(state.records, "2026-10-20");
  const monitoringView = queryMonitoringInterface(state, "MON-AR-18", role);
  const supervisorQueue = querySupervisorReviewQueue(state, '2026-10-23');
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
  const reviewEvidence = (decision: "accepted" | "returned") => { try { if (!latestSubmission) throw new Error("No learner evidence is awaiting review."); setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, role, monitoringId: "MON-AR-18", submissionId: latestSubmission.id, decision, rationale: reviewRationale, reviewer: "Monitoring supervisor", reviewedOn: "2026-10-23" })); setMessage(`Supervisor ${decision} learner evidence.`); } catch (error) { setMessage(error instanceof Error ? error.message : "Supervisor review failed."); } queueMicrotask(() => feedback.current?.focus()); };
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
      {role === 'Supervisor' && <section aria-label="Supervisor review workload"><h3>Evidence review workload</h3><ol>{supervisorQueue.map((item) => <li key={item.monitoringId}>{item.learner} · {item.status} · due {item.dueOn}{item.overdue ? ' · overdue' : ''} · evidence {item.evidenceReference ?? item.requestedEvidence}</li>)}</ol></section>}
      {monitoringView?.persona === 'learner' && <section aria-label="Learner review notices"><h3>Review notices</h3><ol>{monitoringView.notices.map((item) => <li key={item.id}>{item.decision === 'returned' ? 'Correction requested' : 'Evidence accepted'} · {item.evidenceReference} · {item.rationale}</li>)}</ol></section>}
      <button
        disabled={role !== "Compliance Lead" || state.reviewHistory.length > 0}
        onClick={schedule}
      >
        Schedule high-risk monitoring review
      </button>
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
      <ol aria-label="Learner monitoring evidence">{state.evidenceSubmissions.map((item) => <li key={item.id}>{item.evidenceReference} · submitted {item.submittedOn} · review {item.reviewId} · {state.supervisorReviews.find((decision) => decision.submissionId === item.id)?.decision ?? "awaiting supervisor review"}</li>)}</ol>
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
