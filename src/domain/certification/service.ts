import type { Command, Product, Snapshot, Value } from '../../workspace/types';
import { execute } from '../../workspace/engine';
import { findCertification } from './selectors';
export function createCertificationCommand(input: {
    id: string;
    actorId: string;
    revision: number;
    title: string;
    fields: Record<string, Value>;
}): Command { return { id: input.id, actorId: input.actorId, expectedRevision: input.revision, type: 'create', kind: 'certification', title: input.title, input: input.fields }; }
export function applyCertificationCommand(state: Snapshot, command: Command, product: Product, at: string): Snapshot { return execute(state, command, product, at); }
export function requireCertification(state: Snapshot, id: string) {
    const record = findCertification(state.entities, id);
    if (!record)
        throw new Error('Certification record was not found.');
    return record;
}
