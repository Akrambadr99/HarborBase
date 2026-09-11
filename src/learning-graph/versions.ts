import type { Completion, Course } from './eligibility'

export interface RuleSnapshot { courseId: string; version: number; prerequisites: string[]; publishedAt: string }
export function publishCourseRule(course: Course, prerequisites: string[], snapshots: RuleSnapshot[], at: string) {
  if (prerequisites.includes(course.id)) throw new Error('A course cannot require itself.')
  const version = Math.max(course.version, ...snapshots.filter((snapshot) => snapshot.courseId === course.id).map((snapshot) => snapshot.version), 0) + 1
  return { course: { ...course, requires: [...prerequisites], version }, snapshot: { courseId: course.id, version, prerequisites: [...prerequisites], publishedAt: at } }
}

export function completionRule(completion: Completion, snapshots: RuleSnapshot[]): RuleSnapshot | undefined {
  return snapshots.find((snapshot) => snapshot.courseId === completion.courseId && snapshot.version === completion.ruleVersion)
}
