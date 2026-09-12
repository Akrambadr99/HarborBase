import type { Entity } from '../../workspace/types';
import { matchesSearch } from '../../core/search';
import { isPrerequisite } from './model';
export function selectPrerequisite(records: readonly Entity[]): Entity[] { return records.filter(isPrerequisite).toSorted((a, b) => a.title.localeCompare(b.title)); }
export function findPrerequisite(records: readonly Entity[], id: string): Entity | undefined { return records.find(record => isPrerequisite(record) && record.id === id); }
export function searchPrerequisite(records: readonly Entity[], query: string): Entity[] { return selectPrerequisite(records).filter(record => matchesSearch([record.id, record.title, record.status, ...Object.values(record.fields)], query)); }
export function countPrerequisiteByState(records: readonly Entity[]): ReadonlyMap<string, number> {
    const result = new Map<string, number>();
    for (const record of selectPrerequisite(records))
        result.set(record.status, (result.get(record.status) ?? 0) + 1);
    return result;
}
