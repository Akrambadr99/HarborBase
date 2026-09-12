import type { Entity } from '../../workspace/types';
import { matchesSearch } from '../../core/search';
import { isAward } from './model';
export function selectAward(records: readonly Entity[]): Entity[] { return records.filter(isAward).toSorted((a, b) => a.title.localeCompare(b.title)); }
export function findAward(records: readonly Entity[], id: string): Entity | undefined { return records.find(record => isAward(record) && record.id === id); }
export function searchAward(records: readonly Entity[], query: string): Entity[] { return selectAward(records).filter(record => matchesSearch([record.id, record.title, record.status, ...Object.values(record.fields)], query)); }
export function countAwardByState(records: readonly Entity[]): ReadonlyMap<string, number> {
    const result = new Map<string, number>();
    for (const record of selectAward(records))
        result.set(record.status, (result.get(record.status) ?? 0) + 1);
    return result;
}
