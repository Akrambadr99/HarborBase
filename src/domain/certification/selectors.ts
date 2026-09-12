import type { Entity } from '../../workspace/types';
import { matchesSearch } from '../../core/search';
import { isCertification } from './model';
export function selectCertification(records: readonly Entity[]): Entity[] { return records.filter(isCertification).toSorted((a, b) => a.title.localeCompare(b.title)); }
export function findCertification(records: readonly Entity[], id: string): Entity | undefined { return records.find(record => isCertification(record) && record.id === id); }
export function searchCertification(records: readonly Entity[], query: string): Entity[] { return selectCertification(records).filter(record => matchesSearch([record.id, record.title, record.status, ...Object.values(record.fields)], query)); }
export function countCertificationByState(records: readonly Entity[]): ReadonlyMap<string, number> {
    const result = new Map<string, number>();
    for (const record of selectCertification(records))
        result.set(record.status, (result.get(record.status) ?? 0) + 1);
    return result;
}
