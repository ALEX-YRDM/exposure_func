export interface HistoryEntry {
    key: string;
    file: string;
    line: number;
    col: number;
    label: string;
}

interface CacheValue {
    result: any;
    entry: HistoryEntry;
}

/**
 * In-memory LRU cache of call chain analysis results, doubling as the
 * session history. Keyed by `file:line`. Most-recently used entries are
 * kept at the end of the Map (JS Maps preserve insertion order).
 */
export class CallChainCache {
    private map = new Map<string, CacheValue>();

    constructor(private capacity = 30) {}

    private makeKey(file: string, line: number): string {
        return `${file}:${line}`;
    }

    get(file: string, line: number): any | undefined {
        const key = this.makeKey(file, line);
        const value = this.map.get(key);
        if (!value) {
            return undefined;
        }
        // Touch: move to the most-recent position.
        this.map.delete(key);
        this.map.set(key, value);
        return value.result;
    }

    set(file: string, line: number, col: number, result: any): void {
        const key = this.makeKey(file, line);
        const entry: HistoryEntry = { key, file, line, col, label: extractLabel(result) };

        if (this.map.has(key)) {
            this.map.delete(key);
        }
        this.map.set(key, { result, entry });

        while (this.map.size > this.capacity) {
            const oldest = this.map.keys().next().value;
            if (oldest === undefined) {
                break;
            }
            this.map.delete(oldest);
        }
    }

    /** Drop every entry belonging to a file (its content changed). */
    invalidateFile(file: string): void {
        const prefix = `${file}:`;
        for (const key of [...this.map.keys()]) {
            if (key.startsWith(prefix)) {
                this.map.delete(key);
            }
        }
    }

    /** History, most-recent first. */
    getHistory(): HistoryEntry[] {
        return [...this.map.values()].map((v) => v.entry).reverse();
    }
}

function extractLabel(result: any): string {
    const root = result?.root;
    const node = result?.nodes?.find((n: any) => n.id === root);
    if (!node) {
        return root || 'unknown';
    }
    return node.class_name ? `${node.class_name}.${node.name}` : node.name;
}
