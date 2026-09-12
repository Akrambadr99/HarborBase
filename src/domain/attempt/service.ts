import type { Command, Product, Snapshot, Value } from '../../workspace/types';
import { execute } from '../../workspace/engine';
import { findAttempt } from './selectors';
export function createAttemptCommand(input: {
    id: string;
    actorId: string;
    revision: number;
    title: string;
    fields: Record<string, Value>;
}): Command { return { id: input.id, actorId: input.actorId, expectedRevision: input.revision, type: 'create', kind: 'attempt', title: input.title, input: input.fields }; }
export function applyAttemptCommand(state: Snapshot, command: Command, product: Product, at: string): Snapshot { return execute(state, command, product, at); }
export function requireAttempt(state: Snapshot, id: string) {
    const record = findAttempt(state.entities, id);
    if (!record)
        throw new Error('Attempt record was not found.');
    return record;
}
