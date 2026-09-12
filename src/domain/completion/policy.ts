import type { Product } from '../../workspace/types';
export function completionStates(product: Product): readonly string[] { return product.kinds.find(kind => kind.key === 'completion')?.states ?? []; }
export function canEditCompletion(product: Product, role: string): boolean { return product.kinds.find(kind => kind.key === 'completion')?.editors.includes(role) ?? false; }
export function completionOperations(product: Product, role: string, state: string) { return product.operations.filter(operation => operation.kind === 'completion' && operation.roles.includes(role) && operation.from.includes(state)); }
