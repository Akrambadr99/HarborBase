import type { Entity } from '../../workspace/types';
export type RequirementRecord = Entity & {
    kind: 'requirement';
};
export function isRequirement(record: Entity): record is RequirementRecord { return record.kind === 'requirement'; }
