import { describe, expect, it } from 'vitest';
import { awardCertification, detectCycle, eligibility, prerequisiteClosure, renewalState } from './eligibility';
import { assessments, certification, completions, courses } from './fixtures';
describe('learning dependency graph', () => {
    it('computes transitive prerequisites and accepts an acyclic graph', () => {
        expect(prerequisiteClosure(courses, 'LEAD-320')).toEqual(['RISK-210', 'SAFE-100']);
        expect(prerequisiteClosure(courses, 'missing')).toEqual([]);
        expect(detectCycle(courses)).toEqual([]);
    });
    it('detects direct and transitive cycles', () => {
        expect(detectCycle([...courses, { id: 'BROKEN', title: 'Broken', requires: ['BROKEN'], version: 1 }])).toEqual(['BROKEN', 'BROKEN']);
        expect(detectCycle([{ id: 'A', title: 'A', requires: ['B'], version: 1 }, { id: 'B', title: 'B', requires: ['A'], version: 1 }])).toEqual(['A', 'B', 'A']);
    });
    it('keeps historical completion while applying current eligibility', () => {
        const missing = eligibility(certification, courses, completions, assessments, 'u1', true);
        expect(missing.missing).toEqual(['LEAD-320']);
        const complete = [...completions, { learnerId: 'u1', courseId: 'LEAD-320', completedAt: '2027-03-15', ruleVersion: 2 }];
        expect(eligibility(certification, courses, complete, assessments, 'u1', true).eligible).toBe(true);
        expect(eligibility(certification, courses, complete, [], 'u1', true).bestScore).toBe(0);
        expect(eligibility(certification, courses, complete, assessments, 'u1', false).needsSupervisor).toBe(true);
    });
    it('awards only eligible learners against the current rule version', () => {
        expect(() => awardCertification(certification, 'u1', '2027-03-15T00:00:00Z', false)).toThrow(/cannot/);
        const award = awardCertification(certification, 'u1', '2027-03-15T00:00:00Z', true);
        expect(award.ruleVersion).toBe(4);
        expect(award.expiresAt).toContain('2028-03-14');
    });
    it('distinguishes current, renewal-due, and expired awards', () => {
        const award = { learnerId: 'u1', certificationId: 'c', awardedAt: '2027-01-01', expiresAt: '2027-03-20', ruleVersion: 1 };
        expect(renewalState(award, '2027-01-01', 30)).toBe('current');
        expect(renewalState(award, '2027-03-15', 30)).toBe('renewal-due');
        expect(renewalState(award, '2027-03-21', 30)).toBe('expired');
    });
});
