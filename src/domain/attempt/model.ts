import type { Entity } from '../../workspace/types';
export type AttemptRecord = Entity & {
    kind: 'attempt';
};
export function isAttempt(record: Entity): record is AttemptRecord { return record.kind === 'attempt'; }
