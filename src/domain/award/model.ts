import type { Entity } from '../../workspace/types';
export type AwardRecord = Entity & {
    kind: 'award';
};
export function isAward(record: Entity): record is AwardRecord { return record.kind === 'award'; }
