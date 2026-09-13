import { describe, expect, it } from 'vitest';
import { approveFunding, cancelFunding, commitCohortFunding, draftFundingRequest, initialLearningFundingState, reconcileFunding, validateBudget, type FundingRole } from './learning-funding';

const meta = (id: string, revision: number, actor: string, role: FundingRole) => ({ id, expectedRevision: revision, actor: { id: actor, role } });
function approved() { let state = draftFundingRequest(initialLearningFundingState, { ...meta('draft', 0, 'partner', 'Learning Partner'), seats: 4 }); state = validateBudget(state, meta('validate', 1, 'finance', 'Finance Analyst')); return approveFunding(state, meta('approve', 2, 'manager', 'Department Manager')); }

describe('learning funding', () => {
  it('commits approved seats and cost-center budget together', () => { const state = commitCohortFunding(approved(), meta('commit', 3, 'admin', 'Learning Admin')); expect(state.request?.status).toBe('committed'); expect(state.cohort.fundedSeats).toBe(6); expect(state.costCenter.committed).toBe(43200); });
  it('releases both seat and budget commitments when cancelled', () => { let state = commitCohortFunding(approved(), meta('commit', 3, 'admin', 'Learning Admin')); state = cancelFunding(state, meta('cancel', 4, 'admin', 'Learning Admin')); expect(state.request?.status).toBe('cancelled'); expect(state.cohort.fundedSeats).toBe(2); expect(state.costCenter.committed).toBe(24000); });
  it('reconciles delivered learning into actual spend', () => { let state = commitCohortFunding(approved(), meta('commit', 3, 'admin', 'Learning Admin')); state.cohort.status = 'delivered'; state = reconcileFunding(state, { ...meta('reconcile', 4, 'finance', 'Finance Analyst'), actualCost: 18800 }); expect(state.costCenter).toMatchObject({ committed: 24000, spent: 54800 }); expect(state.request?.status).toBe('reconciled'); });
  it('rejects validation against a stale cost-center budget', () => { const state = draftFundingRequest(initialLearningFundingState, { ...meta('draft', 0, 'partner', 'Learning Partner'), seats: 4 }); state.costCenter.version += 1; expect(() => validateBudget(state, meta('validate', 1, 'finance', 'Finance Analyst'))).toThrow('Cost-center budget changed'); });
});
