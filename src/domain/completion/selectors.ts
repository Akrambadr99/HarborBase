import type { Entity } from '../../workspace/types';
import { matchesSearch } from '../../core/search';
import { isCompletion } from './model';
export function selectCompletion(records: readonly Entity[]): Entity[] { return records.filter(isCompletion).toSorted((a, b) => a.title.localeCompare(b.title)); }
export function findCompletion(records: readonly Entity[], id: string): Entity | undefined { return records.find(record => isCompletion(record) && record.id === id); }
export function searchCompletion(records: readonly Entity[], query: string): Entity[] { return selectCompletion(records).filter(record => matchesSearch([record.id, record.title, record.status, ...Object.values(record.fields)], query)); }
export function countCompletionByState(records: readonly Entity[]): ReadonlyMap<string, number> {
    const result = new Map<string, number>();
    for (const record of selectCompletion(records))
        result.set(record.status, (result.get(record.status) ?? 0) + 1);
    return result;
}
