let nextId = 1;

export function newAstId(prefix: string): string {
	return `${prefix}_${nextId++}`;
}


