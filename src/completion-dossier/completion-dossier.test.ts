import { describe, expect, it } from 'vitest';
import { assessCompletionAttempt, initialCompletionState, issueCompletionCredential, openCompletionDossier, submitCompletionAttempt, verifyCompletionEligibility } from './completion-dossier';
const meta = (id: string, revision: number, actor: string, role: 'Learner' | 'Supervisor' | 'Assessor' | 'Credential Admin') => ({ id, expectedRevision: revision, actor: { id: actor, role } });

describe('completion dossier', () => {
  it('issues a credential from an ordered independently assessed attempt', () => {
    let state = openCompletionDossier(initialCompletionState, meta('open', 0, 'learner-a', 'Learner'));
    state = verifyCompletionEligibility(state, { ...meta('verify', 1, 'supervisor', 'Supervisor'), assessmentOn: '2026-09-20' });
    state = submitCompletionAttempt(state, { ...meta('submit', 2, 'learner-a', 'Learner'), evidence: 'Completed scenario evidence covers every current course outcome.' });
    state = assessCompletionAttempt(state, { ...meta('assess', 3, 'assessor', 'Assessor'), score: 88, rationale: 'Submitted evidence demonstrates every required operational competency.' });
    state = issueCompletionCredential(state, meta('issue', 4, 'admin', 'Credential Admin'));
    expect(state.attempts[1]).toMatchObject({ order: 2, status: 'passed', score: 88 });
    expect(state.credential).toMatchObject({ status: 'issued', version: 2, issuedFrom: 'submit-attempt' });
    expect(state.events).toHaveLength(5);
  });

  it('rejects submission after course rules change', () => {
    let state = openCompletionDossier(initialCompletionState, meta('open', 0, 'learner-a', 'Learner'));
    state = verifyCompletionEligibility(state, { ...meta('verify', 1, 'supervisor', 'Supervisor'), assessmentOn: '2026-09-20' });
    state.course.version += 1;
    expect(() => submitCompletionAttempt(state, { ...meta('submit', 2, 'learner-a', 'Learner'), evidence: 'Completed scenario evidence covers every current course outcome.' })).toThrow('Course rules changed');
    expect(state.attempts).toHaveLength(1);
  });
});
