import type { Product } from '../../workspace/types';
export function awardStates(product: Product): readonly string[] { return product.kinds.find(kind => kind.key === 'award')?.states ?? []; }
export function canEditAward(product: Product, role: string): boolean { return product.kinds.find(kind => kind.key === 'award')?.editors.includes(role) ?? false; }
export function awardOperations(product: Product, role: string, state: string) { return product.operations.filter(operation => operation.kind === 'award' && operation.roles.includes(role) && operation.from.includes(state)); }
