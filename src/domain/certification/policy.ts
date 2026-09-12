import type { Product } from '../../workspace/types';
export function certificationStates(product: Product): readonly string[] { return product.kinds.find(kind => kind.key === 'certification')?.states ?? []; }
export function canEditCertification(product: Product, role: string): boolean { return product.kinds.find(kind => kind.key === 'certification')?.editors.includes(role) ?? false; }
export function certificationOperations(product: Product, role: string, state: string) { return product.operations.filter(operation => operation.kind === 'certification' && operation.roles.includes(role) && operation.from.includes(state)); }
