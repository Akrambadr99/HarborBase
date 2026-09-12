import { describe, expect, it } from 'vitest';
import type { Entity } from '../../workspace/types';
import { retakePlan } from './DomainLifecyclePanel';
const entity = (id: string, kind: string, status: string, fields: Entity['fields'] = {}): Entity => ({ id, kind, status, fields, title: id, revision: 1 });
describe('retakePlan', () => {
    it('blocks a learner who already passed', () => expect(retakePlan(entity('c', 'course', 'published'), [entity('a', 'attempt', 'passed', { course: 'c', learner: 'Maya', attempt: 1 })], 'Maya').blockers).toContain('The learner already has passing evidence.'));
    it('derives the next contiguous attempt', () => expect(retakePlan(entity('c', 'course', 'published'), [entity('a', 'attempt', 'failed', { course: 'c', learner: 'Maya', attempt: 1 })], 'Maya')).toMatchObject({ ready: true, nextAttempt: 2 }));
});
