import { describe, expect, it } from 'vitest';
import { applyIncidentDecision, authorizeSupervisedRetake, decideProctoringIncident, initialProctoringState, reportProctoringIncident, startRecoveredAttempt, submitLearnerResponse, type ProctoringRole, type ProctoringState } from './proctoring-incidents';
const meta = (id: string, revision: number, actor: string, role: ProctoringRole) => ({ id, expectedRevision: revision, actor: { id: actor, role } });
function decided() {
  let state = reportProctoringIncident(initialProctoringState, { ...meta('report', 0, 'proctor-a', 'Proctor'), evidenceHash: 'sha256:camera-44-event-9' });
  state = submitLearnerResponse(state, { ...meta('respond', 1, 'LEARNER-18', 'Learner'), response: 'I consulted printed notes after the assessment had begun.' });
  return decideProctoringIncident(state, { ...meta('decide', 2, 'reviewer-a', 'Integrity Reviewer'), reason: 'Verified camera evidence confirms prohibited material use.' });
}
describe('assessment proctoring incidents', () => {
  it('invalidates the affected attempt and starts one ordered supervised recovery', () => {
    let state = applyIncidentDecision(decided(), meta('apply', 3, 'admin-a', 'Learning Admin'));
    state = authorizeSupervisedRetake(state, meta('authorize', 4, 'proctor-a', 'Proctor'));
    state = startRecoveredAttempt(state, meta('start', 5, 'LEARNER-18', 'Learner'));
    expect(state.attempts).toMatchObject([{ sequence: 1, status: 'invalidated' }, { sequence: 2, status: 'in-progress-retake', supervised: true }]);
    expect(state.learner).toMatchObject({ activeAttemptId: 'ATTEMPT-2', retakeEligibility: 'consumed' });
    expect(state.decisions).toHaveLength(1);
    expect(state.incident?.status).toBe('recovered');
  });
  it('requires the affected learner to provide a meaningful response', () => {
    const state = reportProctoringIncident(initialProctoringState, { ...meta('report', 0, 'proctor-a', 'Proctor'), evidenceHash: 'sha256:camera-44-event-9' });
    expect(() => submitLearnerResponse(state, { ...meta('respond', 1, 'LEARNER-99', 'Learner'), response: 'This is a sufficiently long response from the wrong learner.' })).toThrow('affected learner');
  });
  it('rejects a decision when the assessment attempt has changed', () => {
    let state = reportProctoringIncident(initialProctoringState, { ...meta('report', 0, 'proctor-a', 'Proctor'), evidenceHash: 'sha256:camera-44-event-9' });
    state = submitLearnerResponse(state, { ...meta('respond', 1, 'LEARNER-18', 'Learner'), response: 'I consulted printed notes after the assessment had begun.' });
    const staleState: ProctoringState = structuredClone(state);
    staleState.attempts[0]!.version += 1;
    expect(() => decideProctoringIncident(staleState, { ...meta('decide', 2, 'reviewer-a', 'Integrity Reviewer'), reason: 'Verified camera evidence confirms prohibited material use.' })).toThrow('Assessment attempt changed');
  });
});
