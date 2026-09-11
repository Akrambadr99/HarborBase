import type { Completion } from './eligibility'
export interface Competency { id: string; name: string; courseIds: string[]; targetLevel: number }
export interface LearnerLevel { competencyId: string; completed: number; required: number; level: number; gap: number }
export function skillGaps(competencies: Competency[], completions: Completion[], learnerId: string): LearnerLevel[] {
  const completed = new Set(completions.filter((item) => item.learnerId === learnerId).map((item) => item.courseId))
  return competencies.map((competency) => {
    const count = competency.courseIds.filter((courseId) => completed.has(courseId)).length
    const level = competency.courseIds.length === 0 ? 0 : Math.round(count / competency.courseIds.length * competency.targetLevel * 10) / 10
    const gap = Math.round(Math.max(0, competency.targetLevel - level) * 10) / 10
    return { competencyId: competency.id, completed: count, required: competency.courseIds.length, level, gap }
  })
}
