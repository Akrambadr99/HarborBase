import type { Command, Product, Snapshot, Value } from '../../workspace/types';
import { execute } from '../../workspace/engine';
import { findCompletion } from './selectors';
export function createCompletionCommand(input: {
    id: string;
    actorId: string;
    revision: number;
    title: string;
    fields: Record<string, Value>;
}): Command { return { id: input.id, actorId: input.actorId, expectedRevision: input.revision, type: 'create', kind: 'completion', title: input.title, input: input.fields }; }
export function applyCompletionCommand(state: Snapshot, command: Command, product: Product, at: string): Snapshot { return execute(state, command, product, at); }
export function requireCompletion(state: Snapshot, id: string) {
    const record = findCompletion(state.entities, id);
    if (!record)
        throw new Error('Completion record was not found.');
    return record;
}
