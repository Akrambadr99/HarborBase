import type { Course } from './eligibility';
const positions: Record<string, [
    number,
    number
]> = { 'SAFE-100': [15, 50], 'RISK-210': [42, 30], 'AUDIT-240': [42, 70], 'LEAD-320': [75, 30] };
const positionFor = (id: string): [
    number,
    number
] => positions[id] ?? [50, 50];
export function PrerequisiteGraph({ courses, completed }: {
    courses: Course[];
    completed: Set<string>;
}) {
    return <figure className="prerequisite-graph"><figcaption><span>LEARNING PATH GRAPH</span><strong>Incident Response Lead</strong><small>Arrows represent eligibility dependencies</small></figcaption><svg viewBox="0 0 100 100" role="img" aria-label="Course prerequisite graph">{courses.flatMap((course) => course.requires.map((requirement) => { const from = positionFor(requirement); const to = positionFor(course.id); return <line key={`${requirement}-${course.id}`} x1={from[0] + 7} y1={from[1]} x2={to[0] - 7} y2={to[1]}/>; }))}{courses.map((course) => { const position = positionFor(course.id); return <g key={course.id} transform={`translate(${String(position[0])} ${String(position[1])})`} className={completed.has(course.id) ? 'complete' : ''}><circle r="8"/><text textAnchor="middle" y="1">{course.id.split('-')[0]}</text><title>{course.title}</title></g>; })}</svg><div className="graph-labels">{courses.map((course) => <div key={course.id} className={completed.has(course.id) ? 'complete' : ''}><strong>{course.id}</strong><span>{course.title}</span></div>)}</div></figure>;
}
