import type { Product } from '../../workspace/types';
export function courseStates(product: Product): readonly string[] { return product.kinds.find(kind => kind.key === 'course')?.states ?? []; }
export function canEditCourse(product: Product, role: string): boolean { return product.kinds.find(kind => kind.key === 'course')?.editors.includes(role) ?? false; }
export function courseOperations(product: Product, role: string, state: string) { return product.operations.filter(operation => operation.kind === 'course' && operation.roles.includes(role) && operation.from.includes(state)); }
