import { describe, expect, it } from 'vitest';
import { product } from '../product/definition';
import { execute, fresh } from '../workspace/engine';
import type { Snapshot, Value } from '../workspace/types';
const note = 'External course evidence covers the current learning outcomes.';
function act(state: Snapshot, operation: string, entityId: string, actorId: string, input: Record<string, Value> = {}) {
    return execute(state, { id: 'c-' + String(state.revision), expectedRevision: state.revision, actorId, type: 'operate', operation, entityId, input }, product, '2026-09-13T12:00:00Z');
}
function request() { return act(act(fresh(product), 'publish', 'course-1', 'actor-0'), 'recognition-request', 'course-1', 'actor-1', { reference: 'EXTERNAL-001', completedOn: '2026-09-01', note }); }
describe('prior-learning recognition', () => {
    it('issues one versioned completion following independent review', () => {
        const state = act(act(request(), 'recognition-review', 'c-1-1', 'actor-2', { note }), 'recognition-issue', 'c-1-1', 'actor-0');
        expect(state.entities.filter(item => item.kind === 'completion')).toHaveLength(1);
        expect(state.entities.find(item => item.kind === 'completion')?.fields).toEqual({ course: 'course-1', learner: 'Omar Saleh', ruleVersion: 1 });
        expect(() => act(state, 'recognition-issue', 'c-1-1', 'actor-0')).toThrow(/current state/);
    });
    it('requires fresh evidence after course rules change', () => {
        const state = act(request(), 'recognition-review', 'c-1-1', 'actor-2', { note });
        state.entities.find(item => item.id === 'course-1')!.fields['version'] = 2;
        expect(() => act(state, 'recognition-issue', 'c-1-1', 'actor-0')).toThrow(/Course rules changed/);
        expect(act(state, 'recognition-cancel', 'c-1-1', 'actor-1', { note }).entities.find(item => item.id === 'c-1-1')?.status).toBe('cancelled');
    });
    it('prevents learner approval and concurrent pending requests', () => {
        const state = request();
        expect(() => act(state, 'recognition-review', 'c-1-1', 'actor-1', { note })).toThrow(/role/);
        expect(() => act(state, 'recognition-request', 'course-1', 'actor-1', { reference: 'OTHER-001', completedOn: '2026-09-01', note })).toThrow(/already pending/);
    });
    it('does not duplicate completion issued by another evidence path', () => {
        const state = act(request(), 'recognition-review', 'c-1-1', 'actor-2', { note });
        state.entities.push({ id: 'existing', kind: 'completion', title: 'Assessment completion', status: 'verified', revision: 1, fields: { course: 'course-1', learner: 'Omar Saleh', ruleVersion: 1 } });
        expect(() => act(state, 'recognition-issue', 'c-1-1', 'actor-0')).toThrow(/already exists/);
        expect(state.entities.filter(item => item.kind === 'completion')).toHaveLength(1);
    });
});
