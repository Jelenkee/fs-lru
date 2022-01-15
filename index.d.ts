import { Buffer } from "buffer";

export default function createLRU(options: Options): Promise<LRU>;

export interface LRU {
    get(key: string): Promise<Buffer | undefined>;
    peek(key: string): Promise<Buffer | undefined>;
    has(key: string): Promise<boolean>;
    set(key: string, value: string | Buffer): Promise<void>;
    del(key: string): Promise<void>;
    size(unit?: Unit): Promise<number>;
    keys(): Promise<string[]>;
    clear(): Promise<void>;
}

export interface Options {
    dir: string;
    maxSize: number;
    maxSizeUnit?: Unit;
    ttl?: number;
}

export type Unit = "file" | "byte";