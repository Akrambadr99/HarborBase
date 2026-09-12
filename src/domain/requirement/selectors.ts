import type { Entity } from '../../workspace/types';
import { matchesSearch } from '../../core/search';
import { isRequirement } from './model';
export function selectRequirement(records: readonly Entity[]): Entity[] { return records.filter(isRequirement).toSorted((a, b) => a.title.localeCompare(b.title)); }
export function findRequirement(records: readonly Entity[], id: string): Entity | undefined { return records.find(record => isRequirement(record) && record.id === id); }
export function searchRequirement(records: readonly Entity[], query: string): Entity[] { return selectRequirement(records).filter(record => matchesSearch([record.id, record.title, record.status, ...Object.values(record.fields)], query)); }
export function countRequirementByState(records: readonly Entity[]): ReadonlyMap<string, number> {
    const result = new Map<string, number>();
    for (const record of selectRequirement(records))
        result.set(record.status, (result.get(record.status) ?? 0) + 1);
    return result;
}
