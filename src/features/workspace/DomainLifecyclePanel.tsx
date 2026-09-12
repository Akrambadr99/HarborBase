/* eslint-disable react-refresh/only-export-components, @typescript-eslint/no-confusing-void-expression */
import { useState } from 'react';
import type { Entity, Snapshot } from '../../workspace/types';
const numeric = (item: Entity, key: string) => { const value = item.fields[key]; return typeof value === 'number' ? value : 0; };
export function retakePlan(course: Entity | undefined, entities: Entity[], learner: string) {
    const blockers: string[] = [];
    if (!course)
        return { ready: false, blockers: ['Select a course.'], nextAttempt: 1 };
    const attempts = entities.filter((item) => item.kind === 'attempt' && item.fields['course'] === course.id && item.fields['learner'] === learner);
    if (course.status !== 'published')
        blockers.push('The course must be published.');
    if (learner.trim().length < 3)
        blockers.push('A learner identity is required.');
    if (attempts.some((item) => item.status === 'passed'))
        blockers.push('The learner already has passing evidence.');
    if (attempts.length >= 5)
        blockers.push('The five-attempt limit has been reached.');
    const numbers = attempts.map((item) => numeric(item, 'attempt')).sort((left, right) => left - right);
    if (numbers.some((value, index) => value !== index + 1))
        blockers.push('Existing attempt evidence has a sequence gap.');
    return { ready: blockers.length === 0, blockers, nextAttempt: attempts.length + 1 };
}
export function DomainLifecyclePanel({ snapshot }: { snapshot: Snapshot }) {
    const courses = snapshot.entities.filter((item) => item.kind === 'course');
    const [courseId, setCourseId] = useState(courses[0]?.id ?? '');
    const [learner, setLearner] = useState('Maya Hassan');
    const result = retakePlan(courses.find((item) => item.id === courseId), snapshot.entities, learner);
    return <section className="sub" aria-label="Assessment retake planner"><h3>Assessment retake planner <span>{result.ready ? 'eligible' : 'blocked'}</span></h3><div className="filters"><select aria-label="Retake course" value={courseId} onChange={(event) => setCourseId(event.target.value)}>{courses.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select><input aria-label="Retake learner" value={learner} onChange={(event) => setLearner(event.target.value)}/></div><p><b>Next attempt {result.nextAttempt}</b><small>{result.ready ? 'Published rules and attempt history allow another assessment.' : result.blockers.join(' ')}</small></p></section>;
}
