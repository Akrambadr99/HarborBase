import type { Entity } from '../../workspace/types';
import { matchesSearch } from '../../core/search';
import { isCourse } from './model';
export function selectCourse(records: readonly Entity[]): Entity[] { return records.filter(isCourse).toSorted((a, b) => a.title.localeCompare(b.title)); }
export function findCourse(records: readonly Entity[], id: string): Entity | undefined { return records.find(record => isCourse(record) && record.id === id); }
export function searchCourse(records: readonly Entity[], query: string): Entity[] { return selectCourse(records).filter(record => matchesSearch([record.id, record.title, record.status, ...Object.values(record.fields)], query)); }
export function countCourseByState(records: readonly Entity[]): ReadonlyMap<string, number> {
    const result = new Map<string, number>();
    for (const record of selectCourse(records))
        result.set(record.status, (result.get(record.status) ?? 0) + 1);
    return result;
}
