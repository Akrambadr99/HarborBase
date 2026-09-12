import type { Entity } from '../../workspace/types';
export type CertificationRecord = Entity & {
    kind: 'certification';
};
export function isCertification(record: Entity): record is CertificationRecord { return record.kind === 'certification'; }
