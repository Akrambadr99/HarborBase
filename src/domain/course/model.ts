import type { Entity } from '../../workspace/types';
export type CourseRecord = Entity & {
    kind: 'course';
};
export function isCourse(record: Entity): record is CourseRecord { return record.kind === 'course'; }
