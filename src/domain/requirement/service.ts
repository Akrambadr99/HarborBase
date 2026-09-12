import type { Command, Product, Snapshot, Value } from '../../workspace/types';
import { execute } from '../../workspace/engine';
import { findRequirement } from './selectors';
export function createRequirementCommand(input: {
    id: string;
    actorId: string;
    revision: number;
    title: string;
    fields: Record<string, Value>;
}): Command { return { id: input.id, actorId: input.actorId, expectedRevision: input.revision, type: 'create', kind: 'requirement', title: input.title, input: input.fields }; }
export function applyRequirementCommand(state: Snapshot, command: Command, product: Product, at: string): Snapshot { return execute(state, command, product, at); }
export function requireRequirement(state: Snapshot, id: string) {
    const record = findRequirement(state.entities, id);
    if (!record)
        throw new Error('Requirement record was not found.');
    return record;
}
