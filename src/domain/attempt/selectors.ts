import type { Entity } from '../../workspace/types';
import { matchesSearch } from '../../core/search';
import { isAttempt } from './model';
export function selectAttempt(records: readonly Entity[]): Entity[] { return records.filter(isAttempt).toSorted((a, b) => a.title.localeCompare(b.title)); }
export function findAttempt(records: readonly Entity[], id: string): Entity | undefined { return records.find(record => isAttempt(record) && record.id === id); }
export function searchAttempt(records: readonly Entity[], query: string): Entity[] { return selectAttempt(records).filter(record => matchesSearch([record.id, record.title, record.status, ...Object.values(record.fields)], query)); }
export function countAttemptByState(records: readonly Entity[]): ReadonlyMap<string, number> {
    const result = new Map<string, number>();
    for (const record of selectAttempt(records))
        result.set(record.status, (result.get(record.status) ?? 0) + 1);
    return result;
}
