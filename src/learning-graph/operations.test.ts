import { describe, expect, it } from 'vitest'
import { canStartAttempt, recordAttempt } from './attempts'
import { assessments, completions, courses } from './fixtures'
import { skillGaps } from './skills'
import { completionRule, publishCourseRule, type RuleSnapshot } from './versions'

describe('assessment attempts', () => {
  const policy = { maximumAttempts: 3, cooldownHours: 24, passingScore: 80 }
  it('enforces pass, limit, cooldown, sequence, and score rules', () => {
    expect(canStartAttempt(assessments, 'u1', 'LEAD-320', policy, '2027-03-12')).toMatchObject({ allowed: false, reason: 'Assessment is already passed.' })
    const failed = [{ ...assessments[0]!, score: 60 }]
    expect(canStartAttempt(failed, 'u1', 'LEAD-320', policy, '2027-03-10T12:00:00Z')).toMatchObject({ allowed: false, reason: 'Assessment cooldown is still active.' })
    expect(canStartAttempt(failed, 'u1', 'LEAD-320', policy, '2027-03-12')).toEqual({ allowed: true })
    expect(canStartAttempt([...failed, { ...failed[0]!, attempt: 2 }, { ...failed[0]!, attempt: 3 }], 'u1', 'LEAD-320', policy, '2027-03-20')).toMatchObject({ allowed: false, reason: 'Maximum assessment attempts reached.' })
    expect(recordAttempt([], { ...assessments[0]!, attempt: 1 })).toHaveLength(1)
    expect(() => recordAttempt([], { ...assessments[0]!, attempt: 2 })).toThrow(/Expected/)
    expect(() => recordAttempt([], { ...assessments[0]!, attempt: 1, score: 101 })).toThrow(/between/)
  })
})

describe('versioned prerequisites and skill gaps', () => {
  const snapshots: RuleSnapshot[] = [{ courseId: 'RISK-210', version: 2, prerequisites: ['SAFE-100'], publishedAt: '2026-01-01' }]
  it('publishes new rules without changing historical completion evidence', () => {
    const result = publishCourseRule(courses[1]!, ['SAFE-100', 'AUDIT-240'], snapshots, '2027-03-15')
    expect(result.course).toMatchObject({ version: 4, requires: ['SAFE-100', 'AUDIT-240'] })
    expect(completionRule(completions[1]!, snapshots)?.version).toBe(2)
    expect(completionRule(completions[0]!, snapshots)).toBeUndefined()
    expect(() => publishCourseRule(courses[1]!, ['RISK-210'], snapshots, '2027-03-15')).toThrow(/itself/)
  })
  it('derives learner levels from competency-linked completions', () => {
    expect(skillGaps([{ id: 'risk', name: 'Risk leadership', courseIds: ['SAFE-100', 'RISK-210', 'LEAD-320'], targetLevel: 5 }, { id: 'empty', name: 'New', courseIds: [], targetLevel: 3 }], completions, 'u1')).toEqual([
      { competencyId: 'risk', completed: 2, required: 3, level: 3.3, gap: 1.7 },
      { competencyId: 'empty', completed: 0, required: 0, level: 0, gap: 3 },
    ])
  })
})
