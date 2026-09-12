import type { Command, Product, Snapshot, Value } from '../../workspace/types';
import { execute } from '../../workspace/engine';
import { findCourse } from './selectors';
export function createCourseCommand(input: {
    id: string;
    actorId: string;
    revision: number;
    title: string;
    fields: Record<string, Value>;
}): Command { return { id: input.id, actorId: input.actorId, expectedRevision: input.revision, type: 'create', kind: 'course', title: input.title, input: input.fields }; }
export function applyCourseCommand(state: Snapshot, command: Command, product: Product, at: string): Snapshot { return execute(state, command, product, at); }
export function requireCourse(state: Snapshot, id: string) {
    const record = findCourse(state.entities, id);
    if (!record)
        throw new Error('Course record was not found.');
    return record;
}
