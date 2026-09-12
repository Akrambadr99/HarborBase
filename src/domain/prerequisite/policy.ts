import type { Product } from '../../workspace/types';
export function prerequisiteStates(product: Product): readonly string[] { return product.kinds.find(kind => kind.key === 'prerequisite')?.states ?? []; }
export function canEditPrerequisite(product: Product, role: string): boolean { return product.kinds.find(kind => kind.key === 'prerequisite')?.editors.includes(role) ?? false; }
export function prerequisiteOperations(product: Product, role: string, state: string) { return product.operations.filter(operation => operation.kind === 'prerequisite' && operation.roles.includes(role) && operation.from.includes(state)); }
