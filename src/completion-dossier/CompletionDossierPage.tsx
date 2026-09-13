import { useRef, useState } from 'react';
import { assessCompletionAttempt, CompletionRepository, issueCompletionCredential, openCompletionDossier, submitCompletionAttempt, verifyCompletionEligibility, type CompletionRole, type CompletionState } from './completion-dossier';
const actorIds: Record<CompletionRole, string> = { Learner: 'learner-a', Supervisor: 'supervisor', Assessor: 'assessor', 'Credential Admin': 'admin' };

export function CompletionDossierPage() {
  const [repository] = useState(() => new CompletionRepository(localStorage));
  const [state, setState] = useState<CompletionState>(() => repository.read());
  const [role, setRole] = useState<CompletionRole>('Learner');
  const [message, setMessage] = useState('');
  const feedback = useRef<HTMLParagraphElement>(null);
  const command = () => ({ id: crypto.randomUUID(), expectedRevision: state.revision, actor: { id: actorIds[role], role } });
  const run = (change: (value: CompletionState) => CompletionState, success: string) => {
    try { setState(repository.commit(state.revision, change)); setMessage(success); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : 'Completion action failed.'); }
    queueMicrotask(() => feedback.current?.focus());
  };

  return <main className="page">
    <header className="page-title"><p>Learning outcome assurance</p><h1>Completion and credential dossier</h1><p>Current course rules, prerequisites, accommodations, ordered attempts and independent assessment govern issuance.</p></header>
    <section className="workspace-toolbar"><label>Completion role<select value={role} onChange={(event) => { setRole(event.target.value as CompletionRole); }}>{Object.keys(actorIds).map((item) => <option key={item}>{item}</option>)}</select></label><button onClick={() => { setState(repository.read()); }}>Refresh completion dossier</button></section>
    {message && <p ref={feedback} tabIndex={-1} role="status">{message}</p>}
    <div className="cards">
      <section className="card"><h2>Course {state.course.id}</h2><p>Version {state.course.version} · passing {state.course.passingScore} · dossier {state.dossier?.status ?? 'none'}</p><p>Prerequisite {state.prerequisite.status} · accommodation {state.accommodation.status}</p>
        <button disabled={role !== 'Learner' || Boolean(state.dossier)} onClick={() => { run((value) => openCompletionDossier(value, command()), 'Completion dossier opened.'); }}>Open completion dossier</button>
        <button disabled={role !== 'Supervisor' || state.dossier?.status !== 'opened'} onClick={() => { run((value) => verifyCompletionEligibility(value, { ...command(), assessmentOn: '2026-09-20' }), 'Completion eligibility verified.'); }}>Verify completion eligibility</button>
        <button disabled={role !== 'Learner' || state.dossier?.status !== 'eligible'} onClick={() => { run((value) => submitCompletionAttempt(value, { ...command(), evidence: 'Completed scenario evidence covers every current course outcome.' }), 'Completion attempt submitted.'); }}>Submit completion attempt</button>
      </section>
      <section className="card"><h2>Assessment and credential</h2><p>{state.attempts.length} ordered attempts · credential {state.credential.status}</p><p>{state.attempts.map((attempt) => String(attempt.order) + ' ' + attempt.status).join(' · ')}</p>
        <button disabled={role !== 'Assessor' || state.dossier?.status !== 'submitted'} onClick={() => { run((value) => assessCompletionAttempt(value, { ...command(), score: 88, rationale: 'Submitted evidence demonstrates every required operational competency.' }), 'Completion attempt passed.'); }}>Assess completion attempt</button>
        <button disabled={role !== 'Credential Admin' || state.dossier?.status !== 'assessed'} onClick={() => { run((value) => issueCompletionCredential(value, command()), 'Completion credential issued.'); }}>Issue completion credential</button>
      </section>
    </div>
    <section aria-label="Completion dossier history"><h2>Completion dossier history</h2><ol>{state.events.toReversed().map((event) => <li key={event.id}>{event.action} · {event.actor} · {event.detail}</li>)}</ol></section>
  </main>;
}
