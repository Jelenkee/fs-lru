const fs = require("fs-extra");
const { join } = require("path");
const { createHash } = require("crypto");

const UNIT_BYTE = "byte";
const UNIT_FILE = "file";
const SSOT = "SSOT.json";

class FileLRUCache {
    constructor(options = {}) {
        this.options = options;

        if (typeof options.dir !== "string") {
            throw new Error("option 'dir' is required");
        }
        this.dir = options.dir;

        if (typeof options.maxSize !== "number") {
            throw new Error("option 'maxSize' is required");
        }
        this.maxSize = options.maxSize;
        if (this.maxSize <= 0) {
            this.maxSize = Number.MAX_SAFE_INTEGER;
        }

        if (options.ttl != null && typeof options.ttl !== "number") {
            throw new Error("option 'ttl' has to be a number");
        }
        this.ttl = options.ttl;

        this.maxSizeUnit = options.maxSizeUnit || UNIT_FILE;
        this.ssot = {};

        this.initPromise = this._init();
    }
    async _init() {
        await fs.ensureDir(this.dir);
        try {
            this.ssot = await fs.readJson(join(this.dir, SSOT));
        } catch (error) {
            if (!(error.message && error.message.startsWith("ENOENT"))) {
                throw error;
            }
        }
        if (this.options.clear) {
            await this.clear();
        } else {
            await this._removeTooMuch();
            await this._removeOutdated();
        }
    }
    async get(key) {
        return this._get(key, true);
    }
    async peek(key) {
        return this._get(key, false);
    }
    async _get(key, update) {
        await this._removeOutdated(key);
        const hash = this._hashKey(key);
        try {
            const res = await fs.readFile(join(this.dir, hash));
            update && (this.ssot[key].lastAccess = new Date().getTime());
            await this._saveSSOT();
            return res;
        } catch (error) {
            if (error.message && error.message.startsWith("ENOENT")) {
                return;
            }
            throw error;
        }
    }
    async has(key) {
        await this._removeOutdated(key);
        return key in this.ssot;
    }
    async set(key, value) {
        if (typeof value === "string") {
            value = Buffer.from(value);
        }
        const hash = this._hashKey(key);
        await fs.writeFile(join(this.dir, hash), value);
        this.ssot[key] = {
            lastAccess: new Date().getTime(),
            size: value.length
        };
        await this._removeTooMuch();
    }
    async del(key) {
        await this._delFile(key);
        await this._saveSSOT();
    }
    async size(unit) {
        await this._removeOutdated();
        if (unit === UNIT_BYTE) {
            return Object.values(this.ssot).reduce((pv, cv) => pv + cv.size, 0);
        } else {
            return Object.keys(this.ssot).length;
        }
    }
    async keys() {
        await this._removeOutdated();
        return Object.entries(this.ssot)
            .sort((e1, e2) => e1[1].lastAccess - e2[1].lastAccess)
            .map(e => e[0]);
    }
    async clear() {
        const that = this;
        await Promise.all(Object.keys(this.ssot)
            .map(key => that._delFile(key)));
        await this._saveSSOT();
    }
    async _removeTooMuch() {
        const that = this;
        const entries = Object.entries(this.ssot);
        if (this.maxSizeUnit === UNIT_BYTE) {
            const totalSize = Object.values(this.ssot).reduce((pv, cv) => pv + cv.size, 0)
            if (totalSize > this.maxSize) {
                entries.sort((e1, e2) => e1[1].lastAccess - e2[1].lastAccess);
                const over = totalSize - this.maxSize;
                let count = 0;
                let keysToDelete = [];
                for (const e of entries) {
                    keysToDelete.push(e[0]);
                    count += e[1].size;
                    if (count >= over) {
                        break;
                    }
                }
                await Promise.all(keysToDelete.map(k => that._delFile(k)));
            }
        } else {
            if (entries.length > this.maxSize) {
                entries.sort((a, b) => a[1].lastAccess - b[1].lastAccess);
                await Promise.all(entries.slice(0, entries.length - this.maxSize)
                    .map(entry => that._delFile(entry[0])));
            }
        }
        await this._saveSSOT();
    }
    async _removeOutdated(key) {
        if (this.ttl && this.ttl > 0) {
            const that = this;
            const entries = key
                ? [[key, this.ssot[key] || 0]]
                : Object.entries(this.ssot);

            const time = new Date().getTime();
            await Promise.all(entries
                .map(async entry => {
                    if ((time - entry[1].lastAccess) / 1000 > that.ttl) {
                        await that._delFile(entry[0]);
                    }
                }));
            await this._saveSSOT();
        }
    }
    async _saveSSOT() {
        await fs.writeJson(join(this.dir, SSOT), this.ssot);
    }
    async _delFile(key) {
        const hash = this._hashKey(key);
        await fs.remove(join(this.dir, hash))
        delete this.ssot[key];
    }

    _hashKey(key) {
        return createHash("sha1")
            .update(key)
            .digest().toString("hex");
    }
}
module.exports = async function (options) {
    const lru = new FileLRUCache(options);
    await lru.initPromise;
    return lru;
};