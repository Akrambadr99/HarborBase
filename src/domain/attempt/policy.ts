import type { Product } from '../../workspace/types';
export function attemptStates(product: Product): readonly string[] { return product.kinds.find(kind => kind.key === 'attempt')?.states ?? []; }
export function canEditAttempt(product: Product, role: string): boolean { return product.kinds.find(kind => kind.key === 'attempt')?.editors.includes(role) ?? false; }
export function attemptOperations(product: Product, role: string, state: string) { return product.operations.filter(operation => operation.kind === 'attempt' && operation.roles.includes(role) && operation.from.includes(state)); }
