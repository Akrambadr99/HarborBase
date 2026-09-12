import type { Entity } from '../../workspace/types';
export type PrerequisiteRecord = Entity & {
    kind: 'prerequisite';
};
export function isPrerequisite(record: Entity): record is PrerequisiteRecord { return record.kind === 'prerequisite'; }
