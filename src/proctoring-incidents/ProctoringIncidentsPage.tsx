import { useRef, useState } from 'react';
import { applyIncidentDecision, authorizeSupervisedRetake, decideProctoringIncident, ProctoringRepository, reportProctoringIncident, startRecoveredAttempt, submitLearnerResponse, type ProctoringRole, type ProctoringState } from './proctoring-incidents';
const actors: Record<ProctoringRole, string> = { Proctor: 'proctor-a', Learner: 'LEARNER-18', 'Integrity Reviewer': 'reviewer-a', 'Learning Admin': 'admin-a' };

export function ProctoringIncidentsPage() {
  const [repository] = useState(() => new ProctoringRepository(localStorage));
  const [state, setState] = useState<ProctoringState>(() => repository.read());
  const [role, setRole] = useState<ProctoringRole>('Proctor');
  const [message, setMessage] = useState('');
  const feedback = useRef<HTMLParagraphElement>(null);
  const meta = () => ({ id: crypto.randomUUID(), expectedRevision: state.revision, actor: { id: actors[role], role } });
  const run = (operation: (value: ProctoringState) => ProctoringState, success: string) => {
    try { setState(repository.commit(state.revision, operation)); setMessage(success); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Proctoring action failed.'); }
    queueMicrotask(() => feedback.current?.focus());
  };
  const activeAttempt = state.attempts.find((item) => item.id === state.learner.activeAttemptId);
  return <main className="page">
    <header className="page-title"><p>Assessment integrity</p><h1>Proctoring incident recovery</h1><p>Pause affected attempts, preserve an independent decision and recover through an ordered supervised retake.</p></header>
    <section className="workspace-toolbar"><label>Proctoring role<select value={role} onChange={(event) => { setRole(event.target.value as ProctoringRole); }}>{Object.keys(actors).map((item) => <option key={item}>{item}</option>)}</select></label></section>
    {message && <p ref={feedback} tabIndex={-1} role="status">{message}</p>}
    <section className="card">
      <h2>{state.learner.id} · {state.incident?.status ?? 'no incident'}</h2>
      <p>Active attempt {activeAttempt?.id} · sequence {activeAttempt?.sequence} · {activeAttempt?.status}</p>
      <p>Retake eligibility · {state.learner.retakeEligibility}</p>
      <p>Attempts {state.attempts.length} · immutable decisions {state.decisions.length}</p>
      <button disabled={role !== 'Proctor' || Boolean(state.incident)} onClick={() => { run((value) => reportProctoringIncident(value, { ...meta(), evidenceHash: 'sha256:camera-44-event-9' }), 'Incident reported and assessment paused.'); }}>Report proctoring incident</button>
      <button disabled={role !== 'Learner' || state.incident?.status !== 'reported'} onClick={() => { run((value) => submitLearnerResponse(value, { ...meta(), response: 'I consulted printed notes after the assessment had begun.' }), 'Learner incident response submitted.'); }}>Submit learner response</button>
      <button disabled={role !== 'Integrity Reviewer' || state.incident?.status !== 'responded'} onClick={() => { run((value) => decideProctoringIncident(value, { ...meta(), reason: 'Verified camera evidence confirms prohibited material use.' }), 'Independent incident decision recorded.'); }}>Decide proctoring incident</button>
      <button disabled={role !== 'Learning Admin' || state.incident?.status !== 'decided'} onClick={() => { run((value) => applyIncidentDecision(value, meta()), 'Incident decision applied and retake created.'); }}>Apply incident decision</button>
      <button disabled={role !== 'Proctor' || state.incident?.status !== 'applied'} onClick={() => { run((value) => authorizeSupervisedRetake(value, meta()), 'Supervised retake authorized.'); }}>Authorize supervised retake</button>
      <button disabled={role !== 'Learner' || state.incident?.status !== 'retake-authorized'} onClick={() => { run((value) => startRecoveredAttempt(value, meta()), 'Recovered assessment attempt started.'); }}>Start recovered attempt</button>
    </section>
    <section className="card" aria-label="Proctoring decisions"><h2>Immutable integrity decisions</h2>{state.decisions.map((decision) => <p key={decision.id}>{decision.outcome} · {decision.reason}</p>)}</section>
    <section className="card" aria-label="Proctoring history"><h2>Proctoring history</h2>{state.events.map((event) => <p key={event.id}>{event.action}</p>)}</section>
  </main>;
}
