import { describe, expect, it } from 'vitest';
import type { Entity } from '../../workspace/types';
import { retakePlan } from './DomainLifecyclePanel';
const entity = (id: string, kind: string, status: string, fields: Entity['fields'] = {}): Entity => ({ id, kind, status, fields, title: id, revision: 1 });
describe('retakePlan', () => {
    it('blocks a learner who already passed', () => expect(retakePlan(entity('c', 'course', 'published'), [entity('a', 'attempt', 'passed', { course: 'c', learner: 'Maya', attempt: 1 })], 'Maya').blockers).toContain('The learner already has passing evidence.'));
    it('derives the next contiguous attempt', () => expect(retakePlan(entity('c', 'course', 'published'), [entity('a', 'attempt', 'failed', { course: 'c', learner: 'Maya', attempt: 1 })], 'Maya')).toMatchObject({ ready: true, nextAttempt: 2 }));
});

import { product } from '../../product/definition';
import { execute, fresh } from '../../workspace/engine';
import type { Snapshot, Value } from '../../workspace/types';
const run = (state: Snapshot, id: string, target: string, operation: string, actorId = 'actor-1', input: Record<string, Value> = {}) => execute(state, { id, entityId: target, operation, actorId, input, expectedRevision: state.revision, type: 'operate' }, product, '2026-09-12T10:00:00Z');
const failed = () => run(run(fresh(product), 'publish', 'course-1', 'publish', 'actor-0'), 'score', 'attempt-1', 'score');
const draft = () => run(failed(), 'retake', 'attempt-1', 'start-retake');
describe('versioned assessment retake execution', () => {
    it('creates an ordered retake and records passing completion without changing the original failure', () => {
        let state = draft();
        const original = structuredClone(state.entities.find(item => item.id === 'attempt-1'));
        state = run(state, 'submit', 'retake-1', 'submit-retake', 'actor-1', { score: 90 });
        expect(state.entities.find(item => item.id === 'retake-1')).toMatchObject({ status: 'passed', fields: { attempt: 2, ruleVersion: 1, score: 90 } });
        expect(state.entities.find(item => item.id === 'attempt-1')).toEqual(original);
        expect(state.entities.find(item => item.id === 'submit-1')).toMatchObject({ kind: 'completion', fields: { ruleVersion: 1, learner: 'Omar Saleh' } });
        expect(() => run(state, 'again', 'attempt-1', 'start-retake')).toThrow('already passed');
    });
    it('blocks stale rules, then accepts an explicitly refreshed retake', () => {
        let state = run(draft(), 'rules', 'course-1', 'revise-rules', 'actor-0', { passing: 95 });
        const before = structuredClone(state);
        expect(() => run(state, 'stale', 'retake-1', 'submit-retake', 'actor-1', { score: 90 })).toThrow('rules changed');
        expect(state).toEqual(before);
        state = run(state, 'refresh', 'retake-1', 'refresh-retake');
        state = run(state, 'submit', 'retake-1', 'submit-retake', 'actor-1', { score: 96 });
        expect(state.entities.find(item => item.id === 'submit-1')?.fields['ruleVersion']).toBe(2);
    });
    it('prevents duplicate drafts, enforces ownership and supports cancellation', () => {
        let state = draft();
        expect(() => run(state, 'duplicate', 'attempt-1', 'start-retake')).toThrow('pending assessment');
        expect(() => run(state, 'wrong-role', 'retake-1', 'submit-retake', 'actor-2', { score: 99 })).toThrow('role');
        state = run(state, 'cancel', 'retake-1', 'cancel-retake');
        expect(run(state, 'retry', 'attempt-1', 'start-retake').entities.find(item => item.id === 'retry-1')?.fields['attempt']).toBe(2);
    });
    it('blocks retakes when prerequisite evidence is missing', () => {
        const state = failed();
        state.entities.push({ id: 'course-2', kind: 'course', title: 'Required basics', status: 'published', revision: 1, fields: { code: 'BASICS', version: 1, passing: 80 } }, { id: 'prerequisite-1', kind: 'prerequisite', title: 'Basics first', status: 'active', revision: 1, fields: { course: 'course-1', requires: 'course-2' } });
        expect(() => run(state, 'retake', 'attempt-1', 'start-retake')).toThrow('prerequisite');
    });
});

it('saves an unfinished score without completion and requires current rules for submission',()=>{
 let state=run(draft(),'save','retake-1','save-retake-draft','actor-1',{score:90});
 expect(state.entities.find(item=>item.id==='retake-1')).toMatchObject({status:'draft',fields:{score:90}});expect(state.entities.filter(item=>item.kind==='completion')).toHaveLength(0);
 state=run(state,'rules','course-1','revise-rules','actor-0',{passing:95});
 expect(()=>run(state,'submit','retake-1','submit-retake','actor-1',{score:90})).toThrow('rules changed');
 state=run(state,'refresh','retake-1','refresh-retake');expect(state.entities.find(item=>item.id==='retake-1')?.fields['score']).toBe(0);
 state=run(state,'save-new','retake-1','save-retake-draft','actor-1',{score:96});state=run(state,'submit-new','retake-1','submit-retake','actor-1',{score:96});
 expect(state.entities.filter(item=>item.kind==='completion')).toHaveLength(1);
});
it('rejects unauthorized or stale previous-result draft changes',()=>{
 const state=draft();expect(()=>run(state,'wrong','retake-1','save-retake-draft','actor-0',{score:99})).toThrow('role');
 const previous=state.entities.find(item=>item.id==='attempt-1');if(!previous)throw new Error('Missing attempt');previous.revision+=1;
 expect(()=>run(state,'stale','retake-1','save-retake-draft','actor-1',{score:99})).toThrow('Previous result changed');
});

const renewalReady = () => {
 const state=run(draft(),'pass','retake-1','submit-retake','actor-1',{score:90});
 state.entities.push(entity('award-old','award','expired',{certification:'cert-1',learner:'Omar Saleh',expires:'2026-09-01'}));
 return state;
};
describe('versioned credential renewal',()=>{
 it('pins current completions and issues one linked replacement award',()=>{
  let state=run(renewalReady(),'request-renewal','award-old','request-recertification','actor-1');
  expect(state.entities.find(item=>item.id==='request-renewal-1')).toMatchObject({status:'requested',fields:{previous:'award-old',learner:'Omar Saleh'}});
  state=run(state,'issue-renewal','request-renewal-1','issue-recertification','actor-0');
  expect(state.entities.find(item=>item.id==='issue-renewal-1')).toMatchObject({status:'awarded',fields:{previousAward:'award-old',expires:'2027-09-12'}});
  expect(state.entities.find(item=>item.id==='award-old')?.status).toBe('expired');
  expect(()=>run(state,'duplicate','award-old','request-recertification','actor-1')).toThrow('already exists');
 });
 it('rejects changed course rules without partially issuing a credential',()=>{
  let state=run(renewalReady(),'request-renewal','award-old','request-recertification','actor-1');
  state=run(state,'rules','course-1','revise-rules','actor-0',{passing:90});const before=structuredClone(state);
  expect(()=>run(state,'stale','request-renewal-1','issue-recertification','actor-0')).toThrow('current rule version');
  expect(state).toEqual(before);expect(state.entities.filter(item=>item.kind==='award')).toHaveLength(1);
 });
});
