import type { Entity } from '../../workspace/types';
export type CompletionRecord = Entity & {
    kind: 'completion';
};
export function isCompletion(record: Entity): record is CompletionRecord { return record.kind === 'completion'; }
