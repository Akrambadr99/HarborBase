import { useRef, useState } from 'react';
import { approveFunding, commitCohortFunding, draftFundingRequest, LearningFundingRepository, validateBudget, type FundingRole, type LearningFundingState } from './learning-funding';

const actors: Record<FundingRole, string> = {
  'Learning Partner': 'learning-partner',
  'Finance Analyst': 'finance-analyst',
  'Department Manager': 'department-manager',
  'Learning Admin': 'learning-admin',
};

export function LearningFundingPage() {
  const [repository] = useState(() => new LearningFundingRepository(localStorage));
  const [state, setState] = useState<LearningFundingState>(() => repository.read());
  const [role, setRole] = useState<FundingRole>('Learning Partner');
  const [message, setMessage] = useState('');
  const feedback = useRef<HTMLParagraphElement>(null);
  const meta = () => ({ id: crypto.randomUUID(), expectedRevision: state.revision, actor: { id: actors[role], role } });
  const run = (operation: (value: LearningFundingState) => LearningFundingState, success: string) => {
    try { setState(repository.commit(state.revision, operation)); setMessage(success); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Learning funding action failed.'); }
    queueMicrotask(() => feedback.current?.focus());
  };
  return <main className="page"><header className="page-title"><p>Learning operations</p><h1>Learning funding</h1><p>Validate cost-center budget, approve cohort seats and commit funding against current capacity.</p></header><section className="workspace-toolbar"><label>Funding role<select value={role} onChange={(event) => { setRole(event.target.value as FundingRole); }}>{Object.keys(actors).map((item) => <option key={item}>{item}</option>)}</select></label><button onClick={() => { setState(repository.read()); setMessage('Learning funding refreshed.'); }}>Refresh funding</button></section>{message && <p ref={feedback} tabIndex={-1} role="status">{message}</p>}<div className="cards"><section className="card"><h2>{state.costCenter.id}</h2><p>Budget ${state.costCenter.annualBudget.toLocaleString()} · committed ${state.costCenter.committed.toLocaleString()} · spent ${state.costCenter.spent.toLocaleString()}</p><p>{state.cohort.id} · funded {state.cohort.fundedSeats}/{state.cohort.capacity} seats</p><p>Request {state.request?.status ?? 'none'} · ${state.request?.estimatedCost.toLocaleString() ?? '0'}</p><button disabled={role !== 'Learning Partner' || Boolean(state.request)} onClick={() => { run((value) => draftFundingRequest(value, { ...meta(), seats: 4 }), 'Learning funding drafted.'); }}>Draft learning funding</button><button disabled={role !== 'Finance Analyst' || state.request?.status !== 'draft'} onClick={() => { run((value) => validateBudget(value, meta()), 'Learning budget validated.'); }}>Validate learning budget</button><button disabled={role !== 'Department Manager' || state.request?.status !== 'validated'} onClick={() => { run((value) => approveFunding(value, meta()), 'Learning funding approved.'); }}>Approve learning funding</button><button disabled={role !== 'Learning Admin' || state.request?.status !== 'approved'} onClick={() => { run((value) => commitCohortFunding(value, meta()), 'Cohort funding committed.'); }}>Commit cohort funding</button></section></div><section aria-label="Learning funding history"><h2>Funding history</h2><ol>{state.events.toReversed().map((event) => <li key={event.id}>{event.action} · {event.actor} · {event.detail}</li>)}</ol></section></main>;
}
