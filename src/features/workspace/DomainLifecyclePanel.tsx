/* eslint-disable react-refresh/only-export-components, @typescript-eslint/no-confusing-void-expression */
import { product } from '../../product/definition';
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
export function DomainLifecyclePanel({snapshot,actorId,onExecute}:{snapshot:Snapshot;actorId?:string;onExecute?:(operation:string,entityId:string)=>void}) {
 const courses=snapshot.entities.filter(item => item.kind === 'course');const [courseId,setCourseId]=useState(courses[0]?.id ?? '');
 const actor=product.actors.find(item => item.id === actorId);const course=courses.find(item => item.id === courseId);
 const attempts=snapshot.entities.filter(item => item.kind === 'attempt' && item.fields['course'] === courseId && (actor?.role !== 'Learner' || item.fields['learner'] === actor.name)).sort((a,b) => numeric(a,'attempt')-numeric(b,'attempt') || a.id.localeCompare(b.id));
 return <section className="sub" aria-label="Assessment retake planner"><h3>Saved assessment attempts</h3><label>Retake course<select value={courseId} onChange={event => setCourseId(event.target.value)}>{courses.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
 {attempts.map(item => <article key={item.id}><h4>{item.title}</h4><p>Attempt {numeric(item,'attempt')} - {item.status} - saved score {numeric(item,'score')}</p>
 {item.status === 'draft' && <p>{item.fields['ruleVersion'] === course?.fields['version'] ? 'Saved result has not been submitted.' : 'Assessment rules changed. Refresh rules to clear the old draft score before submitting a new result.'}</p>}
 {product.operations.filter(op => ['score','start-retake','save-retake-draft','submit-retake','refresh-retake','cancel-retake'].includes(op.key) && op.from.includes(item.status) && op.roles.includes(actor?.role ?? '') && item.fields['learner'] === actor?.name).map(op => <button key={op.key} onClick={() => onExecute?.(op.key,item.id)}>Run: {op.label}</button>)}
 </article>)}</section>;
}
