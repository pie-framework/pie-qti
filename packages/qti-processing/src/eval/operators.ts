import type { DeclarationContext } from '../runtime/context.js';
import type { QtiValue } from '../runtime/types.js';

export type OperatorImpl = (ctx: DeclarationContext, args: QtiValue[]) => QtiValue;

export class OperatorRegistry {
	private ops = new Map<string, OperatorImpl>();

	register(name: string, impl: OperatorImpl): void {
		this.ops.set(name.toLowerCase(), impl);
	}

	get(name: string): OperatorImpl | undefined {
		return this.ops.get(name.toLowerCase());
	}
}


