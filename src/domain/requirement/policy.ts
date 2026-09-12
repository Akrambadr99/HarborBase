import type { Product } from '../../workspace/types';
export function requirementStates(product: Product): readonly string[] { return product.kinds.find(kind => kind.key === 'requirement')?.states ?? []; }
export function canEditRequirement(product: Product, role: string): boolean { return product.kinds.find(kind => kind.key === 'requirement')?.editors.includes(role) ?? false; }
export function requirementOperations(product: Product, role: string, state: string) { return product.operations.filter(operation => operation.kind === 'requirement' && operation.roles.includes(role) && operation.from.includes(state)); }
