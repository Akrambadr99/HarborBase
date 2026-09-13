export type CompletionRole = 'Learner' | 'Supervisor' | 'Assessor' | 'Credential Admin';

export interface CompletionState {
  revision: number;
  course: { id: string; status: 'published'; version: number; passingScore: number; maxAttempts: number };
  prerequisite: { id: string; status: 'completed'; version: number; completedOn: string };
  accommodation: { status: 'applied'; version: number; extraMinutes: number; expiresOn: string };
  attempts: { id: string; order: number; status: 'draft' | 'submitted' | 'passed' | 'failed'; score?: number; evidence: string }[];
  credential: { status: 'not-issued' | 'issued'; version: number; issuedFrom?: string };
  dossier: {
    id: string;
    owner: string;
    status: 'opened' | 'eligible' | 'submitted' | 'assessed' | 'issued' | 'cancelled';
    courseVersion: number;
    prerequisiteVersion: number;
    accommodationVersion: number;
    attemptId?: string;
    reviewer?: string;
    assessor?: string;
  } | null;
  events: { id: string; action: string; actor: string; detail: string }[];
}

export const initialCompletionState: CompletionState = {
  revision: 0,
  course: { id: 'COURSE-SECOPS', status: 'published', version: 6, passingScore: 80, maxAttempts: 3 },
  prerequisite: { id: 'COURSE-FOUNDATIONS', status: 'completed', version: 3, completedOn: '2026-09-01' },
  accommodation: { status: 'applied', version: 4, extraMinutes: 30, expiresOn: '2026-10-01' },
  attempts: [{ id: 'ATTEMPT-1', order: 1, status: 'failed', score: 72, evidence: 'Initial supervised assessment evidence.' }],
  credential: { status: 'not-issued', version: 1 },
  dossier: null,
  events: [],
};

interface Meta { id: string; expectedRevision: number; actor: { id: string; role: CompletionRole } }
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function begin(state: CompletionState, command: Meta) {
  assert(state.revision === command.expectedRevision, 'Completion dossier changed. Refresh before retrying.');
  assert(!state.events.some((event) => event.id === command.id), 'Command already applied.');
  return structuredClone(state);
}
function finish(state: CompletionState, command: Meta, action: string, detail: string) {
  state.revision += 1;
  state.events.push({ id: command.id, action, actor: command.actor.id, detail });
  return state;
}
function dossier(state: CompletionState) {
  const current = state.dossier;
  assert(current, 'Completion dossier does not exist.');
  return current;
}
function assertVersions(state: CompletionState) {
  const current = dossier(state);
  assert(current.courseVersion === state.course.version, 'Course rules changed. Restart completion review.');
  assert(current.prerequisiteVersion === state.prerequisite.version, 'Prerequisite evidence changed. Recheck eligibility.');
  assert(current.accommodationVersion === state.accommodation.version, 'Accommodation changed. Recheck attempt conditions.');
}

export function openCompletionDossier(state: CompletionState, command: Meta) {
  assert(command.actor.role === 'Learner', 'Only learners can open completion dossiers.');
  const next = begin(state, command);
  assert(command.actor.id === 'learner-a', 'Only the enrolled learner can open this dossier.');
  assert(!next.dossier || ['issued', 'cancelled'].includes(next.dossier.status), 'An active completion dossier exists.');
  assert(next.attempts.length < next.course.maxAttempts, 'Maximum assessment attempts reached.');
  next.dossier = {
    id: command.id + '-completion', owner: command.actor.id, status: 'opened',
    courseVersion: next.course.version, prerequisiteVersion: next.prerequisite.version,
    accommodationVersion: next.accommodation.version,
  };
  return finish(next, command, 'completion-dossier-opened', next.course.id);
}

export function verifyCompletionEligibility(state: CompletionState, command: Meta & { assessmentOn: string }) {
  assert(command.actor.role === 'Supervisor', 'Only supervisors can verify completion eligibility.');
  const next = begin(state, command);
  const current = dossier(next);
  assert(current.status === 'opened', 'Opened completion dossier is required.');
  assertVersions(next);
  assert(command.actor.id !== current.owner, 'Eligibility review must be independent.');
  assert(next.prerequisite.completedOn <= command.assessmentOn, 'Prerequisite was completed after the assessment date.');
  assert(next.accommodation.expiresOn >= command.assessmentOn, 'Accommodation expires before the assessment date.');
  current.reviewer = command.actor.id;
  current.status = 'eligible';
  return finish(next, command, 'completion-eligibility-verified', command.assessmentOn);
}

export function submitCompletionAttempt(state: CompletionState, command: Meta & { evidence: string }) {
  assert(command.actor.role === 'Learner' && command.actor.id === 'learner-a', 'Only the enrolled learner can submit attempts.');
  const next = begin(state, command);
  const current = dossier(next);
  assert(current.status === 'eligible', 'Verified eligibility is required.');
  assertVersions(next);
  const evidence = command.evidence.trim();
  assert(evidence.length >= 20, 'Attempt evidence must contain at least 20 characters.');
  const order = next.attempts.length + 1;
  assert(order <= next.course.maxAttempts, 'Maximum assessment attempts reached.');
  const attempt = { id: command.id + '-attempt', order, status: 'submitted' as const, evidence };
  next.attempts.push(attempt);
  current.attemptId = attempt.id;
  current.status = 'submitted';
  return finish(next, command, 'completion-attempt-submitted', String(order));
}

export function assessCompletionAttempt(state: CompletionState, command: Meta & { score: number; rationale: string }) {
  assert(command.actor.role === 'Assessor', 'Only assessors can score completion attempts.');
  const next = begin(state, command);
  const current = dossier(next);
  assert(current.status === 'submitted' && current.attemptId, 'Submitted completion attempt is required.');
  assertVersions(next);
  assert(command.actor.id !== current.reviewer && command.actor.id !== current.owner, 'Assessment must be independently scored.');
  assert(Number.isInteger(command.score) && command.score >= 0 && command.score <= 100, 'Score must be a whole percentage.');
  assert(command.rationale.trim().length >= 20, 'Assessment rationale must contain at least 20 characters.');
  const attempt = next.attempts.find((item) => item.id === current.attemptId);
  assert(attempt?.status === 'submitted', 'Attempt changed before assessment.');
  attempt.score = command.score;
  attempt.status = command.score >= next.course.passingScore ? 'passed' : 'failed';
  current.assessor = command.actor.id;
  current.status = 'assessed';
  return finish(next, command, attempt.status === 'passed' ? 'completion-attempt-passed' : 'completion-attempt-failed', String(command.score));
}

export function issueCompletionCredential(state: CompletionState, command: Meta) {
  assert(command.actor.role === 'Credential Admin', 'Only credential administrators can issue credentials.');
  const next = begin(state, command);
  const current = dossier(next);
  assert(current.status === 'assessed' && current.attemptId, 'Assessed completion dossier is required.');
  assertVersions(next);
  assert(command.actor.id !== current.assessor && command.actor.id !== current.reviewer, 'Credential issuance must be independent.');
  const attempt = next.attempts.find((item) => item.id === current.attemptId);
  assert(attempt?.status === 'passed', 'Passing attempt is required for credential issuance.');
  assert(next.credential.status === 'not-issued', 'Credential was already issued.');
  next.credential = { status: 'issued', version: next.credential.version + 1, issuedFrom: attempt.id };
  current.status = 'issued';
  return finish(next, command, 'completion-credential-issued', attempt.id);
}

export class CompletionRepository {
  static key = 'skillorbit:completion-dossier:v1';
  private storage: Pick<Storage, 'getItem' | 'setItem'>;
  constructor(storage: Pick<Storage, 'getItem' | 'setItem'>) { this.storage = storage; }
  read() { const raw = this.storage.getItem(CompletionRepository.key); return raw ? JSON.parse(raw) as CompletionState : structuredClone(initialCompletionState); }
  commit(expectedRevision: number, change: (state: CompletionState) => CompletionState) {
    const current = this.read();
    assert(current.revision === expectedRevision, 'Another session changed completion. Refresh before retrying.');
    const next = change(current);
    this.storage.setItem(CompletionRepository.key, JSON.stringify(next));
    return next;
  }
}
