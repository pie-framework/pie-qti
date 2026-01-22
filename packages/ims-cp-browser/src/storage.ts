/**
 * Storage backend abstraction for persisting package data
 */

export interface StorageBackend {
	store(key: string, data: any): Promise<void>;
	retrieve(key: string): Promise<any | null>;
	delete(key: string): Promise<void>;
	clear(): Promise<void>;
}

/**
 * SessionStorage backend (data persists until browser tab closes)
 */
export class SessionStorageBackend implements StorageBackend {
	async store(key: string, data: any): Promise<void> {
		try {
			sessionStorage.setItem(key, JSON.stringify(data));
		} catch (error) {
			throw new Error(`Failed to store data in sessionStorage: ${error}`);
		}
	}

	async retrieve(key: string): Promise<any | null> {
		try {
			const data = sessionStorage.getItem(key);
			return data ? JSON.parse(data) : null;
		} catch (error) {
			console.error(`Failed to retrieve data from sessionStorage: ${error}`);
			return null;
		}
	}

	async delete(key: string): Promise<void> {
		sessionStorage.removeItem(key);
	}

	async clear(): Promise<void> {
		sessionStorage.clear();
	}
}

/**
 * LocalStorage backend (data persists across browser sessions)
 */
export class LocalStorageBackend implements StorageBackend {
	async store(key: string, data: any): Promise<void> {
		try {
			localStorage.setItem(key, JSON.stringify(data));
		} catch (error) {
			throw new Error(`Failed to store data in localStorage: ${error}`);
		}
	}

	async retrieve(key: string): Promise<any | null> {
		try {
			const data = localStorage.getItem(key);
			return data ? JSON.parse(data) : null;
		} catch (error) {
			console.error(`Failed to retrieve data from localStorage: ${error}`);
			return null;
		}
	}

	async delete(key: string): Promise<void> {
		localStorage.removeItem(key);
	}

	async clear(): Promise<void> {
		localStorage.clear();
	}
}

/**
 * In-memory storage backend (useful for testing)
 */
export class MemoryStorageBackend implements StorageBackend {
	private data = new Map<string, any>();

	async store(key: string, data: any): Promise<void> {
		this.data.set(key, data);
	}

	async retrieve(key: string): Promise<any | null> {
		return this.data.get(key) ?? null;
	}

	async delete(key: string): Promise<void> {
		this.data.delete(key);
	}

	async clear(): Promise<void> {
		this.data.clear();
	}
}
