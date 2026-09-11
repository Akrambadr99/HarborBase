import type { Completion, Course } from './eligibility'

export function LearnerPath({ courses, completions }: { courses: Course[]; completions: Completion[] }) {
  const completed = new Map(completions.map((completion) => [completion.courseId, completion]))
  return <ol className="learner-path">{courses.map((course, index) => { const record = completed.get(course.id); return <li key={course.id} className={record ? 'complete' : index === completions.length ? 'current' : ''}><div>{record ? '✓' : String(index + 1)}</div><section><span>{course.id} · RULE v{course.version}</span><h2>{course.title}</h2><p>{record ? `Completed ${record.completedAt} under rule v${String(record.ruleVersion)}` : course.requires.length ? `Requires ${course.requires.join(', ')}` : 'Available now'}</p></section><b>{record ? 'complete' : 'not started'}</b></li> })}</ol>
}
