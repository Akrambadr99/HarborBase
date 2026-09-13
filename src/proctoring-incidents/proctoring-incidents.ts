export type ProctoringRole = 'Proctor' | 'Learner' | 'Integrity Reviewer' | 'Learning Admin';
export interface ProctoringState {
  revision: number;
  learner: { id: string; version: number; activeAttemptId: string; retakeEligibility: 'unavailable' | 'pending' | 'eligible' | 'consumed' };
  attempts: { id: string; version: number; sequence: number; rulesVersion: number; status: 'in-progress' | 'paused' | 'invalidated' | 'authorized' | 'in-progress-retake'; supervised: boolean }[];
  incident: null | { id: string; status: 'reported' | 'responded' | 'decided' | 'applied' | 'retake-authorized' | 'recovered'; reporter: string; respondent: string | null; reviewer: string | null; evidenceHash: string; response: string | null; outcome: 'pending' | 'invalidate'; attemptVersion: number; learnerVersion: number; rulesVersion: number };
  decisions: { id: string; incidentId: string; outcome: 'invalidate'; reason: string; immutable: true }[];
  events: { id: string; action: string; actor: string; immutable: true }[];
}

export const initialProctoringState: ProctoringState = {
  revision: 0,
  learner: { id: 'LEARNER-18', version: 4, activeAttemptId: 'ATTEMPT-1', retakeEligibility: 'unavailable' },
  attempts: [{ id: 'ATTEMPT-1', version: 7, sequence: 1, rulesVersion: 3, status: 'in-progress', supervised: true }],
  incident: null,
  decisions: [],
  events: [],
};

interface Meta { id: string; expectedRevision: number; actor: { id: string; role: ProctoringRole } }
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function begin(state: ProctoringState, command: Meta) {
  assert(state.revision === command.expectedRevision, 'Proctoring state changed. Refresh before retrying.');
  assert(!state.events.some((event) => event.id === command.id), 'Proctoring command already applied.');
  return structuredClone(state);
}
function currentIncident(state: ProctoringState) { assert(state.incident, 'No proctoring incident exists.'); return state.incident; }
function activeAttempt(state: ProctoringState) {
  const attempt = state.attempts.find((item) => item.id === state.learner.activeAttemptId);
  assert(attempt, 'The learner active attempt is missing.');
  return attempt;
}
function assertCurrent(state: ProctoringState) {
  const incident = currentIncident(state), attempt = activeAttempt(state);
  assert(incident.attemptVersion === attempt.version, 'Assessment attempt changed after incident review began.');
  assert(incident.learnerVersion === state.learner.version, 'Learner eligibility changed after incident review began.');
  assert(incident.rulesVersion === attempt.rulesVersion, 'Assessment rules changed after incident review began.');
}
function sync(state: ProctoringState) {
  const incident = currentIncident(state), attempt = activeAttempt(state);
  incident.attemptVersion = attempt.version;
  incident.learnerVersion = state.learner.version;
  incident.rulesVersion = attempt.rulesVersion;
}
function finish(state: ProctoringState, command: Meta, action: string) {
  state.revision += 1;
  state.events.push({ id: command.id, action, actor: command.actor.id, immutable: true });
  return state;
}

export function reportProctoringIncident(state: ProctoringState, command: Meta & { evidenceHash: string }) {
  assert(command.actor.role === 'Proctor', 'Only proctors can report assessment incidents.');
  const next = begin(state, command), attempt = activeAttempt(next);
  assert(!next.incident && attempt.status === 'in-progress', 'An active attempt without an incident is required.');
  assert(command.evidenceHash === 'sha256:camera-44-event-9', 'Verified proctoring evidence is required.');
  attempt.status = 'paused';
  attempt.version += 1;
  next.learner.retakeEligibility = 'pending';
  next.learner.version += 1;
  next.incident = { id: 'INCIDENT-44', status: 'reported', reporter: command.actor.id, respondent: null, reviewer: null, evidenceHash: command.evidenceHash, response: null, outcome: 'pending', attemptVersion: attempt.version, learnerVersion: next.learner.version, rulesVersion: attempt.rulesVersion };
  return finish(next, command, 'proctoring-incident-reported');
}

export function submitLearnerResponse(state: ProctoringState, command: Meta & { response: string }) {
  assert(command.actor.role === 'Learner', 'Only the affected learner can respond to the incident.');
  const next = begin(state, command), incident = currentIncident(next);
  assert(command.actor.id === next.learner.id, 'The incident response must belong to the affected learner.');
  assert(incident.status === 'reported', 'A reported incident is required.');
  assertCurrent(next);
  assert(command.response.trim().length >= 20, 'The incident response must provide a meaningful explanation.');
  incident.status = 'responded';
  incident.respondent = command.actor.id;
  incident.response = command.response.trim();
  return finish(next, command, 'learner-incident-response-submitted');
}

export function decideProctoringIncident(state: ProctoringState, command: Meta & { reason: string }) {
  assert(command.actor.role === 'Integrity Reviewer', 'Only integrity reviewers can decide incidents.');
  const next = begin(state, command), incident = currentIncident(next);
  assert(incident.status === 'responded', 'A learner response is required before review.');
  assert(command.actor.id !== incident.reporter && command.actor.id !== incident.respondent, 'Incident review must be independent.');
  assertCurrent(next);
  assert(command.reason.trim().length >= 20, 'The integrity decision requires a documented reason.');
  incident.status = 'decided';
  incident.reviewer = command.actor.id;
  incident.outcome = 'invalidate';
  next.decisions.push({ id: `${command.id}-decision`, incidentId: incident.id, outcome: 'invalidate', reason: command.reason.trim(), immutable: true });
  return finish(next, command, 'proctoring-incident-decided');
}

export function applyIncidentDecision(state: ProctoringState, command: Meta) {
  assert(command.actor.role === 'Learning Admin', 'Only learning administrators can apply incident decisions.');
  const next = begin(state, command), incident = currentIncident(next), attempt = activeAttempt(next);
  assert(incident.status === 'decided' && incident.outcome === 'invalidate', 'A final invalidation decision is required.');
  assertCurrent(next);
  attempt.status = 'invalidated';
  attempt.version += 1;
  const retake = { id: 'ATTEMPT-2', version: 1, sequence: attempt.sequence + 1, rulesVersion: attempt.rulesVersion, status: 'authorized' as const, supervised: true };
  next.attempts.push(retake);
  next.learner.activeAttemptId = retake.id;
  next.learner.retakeEligibility = 'eligible';
  next.learner.version += 1;
  incident.status = 'applied';
  sync(next);
  return finish(next, command, 'incident-decision-applied');
}

export function authorizeSupervisedRetake(state: ProctoringState, command: Meta) {
  assert(command.actor.role === 'Proctor', 'Only proctors can authorize supervised retakes.');
  const next = begin(state, command), incident = currentIncident(next), attempt = activeAttempt(next);
  assert(incident.status === 'applied' && next.learner.retakeEligibility === 'eligible', 'An applied incident decision with retake eligibility is required.');
  assertCurrent(next);
  assert(attempt.sequence === 2 && attempt.supervised && attempt.rulesVersion === 3, 'The next ordered attempt must use current supervised rules.');
  incident.status = 'retake-authorized';
  return finish(next, command, 'supervised-retake-authorized');
}

export function startRecoveredAttempt(state: ProctoringState, command: Meta) {
  assert(command.actor.role === 'Learner', 'Only the affected learner can start the recovered attempt.');
  const next = begin(state, command), incident = currentIncident(next), attempt = activeAttempt(next);
  assert(command.actor.id === next.learner.id, 'The recovered attempt belongs to another learner.');
  assert(incident.status === 'retake-authorized', 'A proctor-authorized retake is required.');
  assertCurrent(next);
  attempt.status = 'in-progress-retake';
  attempt.version += 1;
  next.learner.retakeEligibility = 'consumed';
  next.learner.version += 1;
  incident.status = 'recovered';
  sync(next);
  return finish(next, command, 'recovered-attempt-started');
}

export class ProctoringRepository {
  static key = 'skillorbit:proctoring-incidents:v1';
  private storage: Pick<Storage, 'getItem' | 'setItem'>;
  constructor(storage: Pick<Storage, 'getItem' | 'setItem'>) { this.storage = storage; }
  read() { const raw = this.storage.getItem(ProctoringRepository.key); return raw ? JSON.parse(raw) as ProctoringState : structuredClone(initialProctoringState); }
  commit(expectedRevision: number, operation: (state: ProctoringState) => ProctoringState) {
    const state = this.read();
    assert(state.revision === expectedRevision, 'Another session changed the proctoring incident. Refresh before retrying.');
    const next = operation(state);
    this.storage.setItem(ProctoringRepository.key, JSON.stringify(next));
    return next;
  }
}
