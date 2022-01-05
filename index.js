const fs = require("fs-extra");
const { join } = require("path");
const { createHash } = require("crypto");
const debounce = require("just-debounce");

const UNIT_BYTE = "byte";
const UNIT_FILE = "file";
const REGISTRY = "4eadc5713cd7b0c7c0673d765edb0249f7295a72.json";

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
        this.maxSizeUnit = options.maxSizeUnit || UNIT_FILE;
        this.registry = {};


        this.bouncedRemoveOutdated = debounce(this._removeOutdated, 1000, true, true);

        this._initPromise = this._init();
        setInterval(() => {

        }, 1000).unref();
    }
    async ready() {
        return this._initPromise;
    }
    async _init() {
        await fs.ensureDir(this.dir);
        if (this.options.clear) {
            await this.clear();
        };
        await this._removeOutdated();
        try {
            this.registry = await fs.readJson(join(this.dir, REGISTRY));
        } catch (error) {
            if (!(error.message && error.message.startsWith("ENOENT"))) {
                throw error;
            }
        }

    }
    async get(key) {
        const hash = this._hashKey(key);
        try {
            return await fs.readFile(join(this.dir, hash))
        } catch (error) {
            if (error.message && error.message.startsWith("ENOENT")) {
                return undefined;
            }
            throw error;
        }
    }
    async has(key) {
        const hash = this._hashKey(key);
        return await fs.pathExists(join(this.dir, hash));
    }
    async set(key, value) {
        const hash = this._hashKey(key);
        this.registry[key] = hash;
        await fs.writeFile(join(this.dir, hash), value);
        await this._removeOutdated();
        await this._updateFileRegistry();
    }
    async del(key) {
        const hash = this._hashKey(key);
        await fs.unlink(join(this.dir, hash));
    }
    async size() {
        return (await this._files()).length;
    }
    keys() {
        return Object.keys(this.registry);
    }
    async values() {

    }
    async entries() {

    }
    async clear() {
        await Promise.all((await this._files())
            .map(file => fs.unlink(file)));
        await fs.unlink(join(this.dir, REGISTRY));
    }
    async _files() {
        return await Promise.all((await fs.readdir(this.dir))
            .filter(file => !file.endsWith(".json"))
            .map(file => join(this.dir, file)));
    }
    async _removeOutdated() {
        const files = await Promise.all((await this._files())
            .map(async file => ({ file, stat: await fs.stat(file) })));
        if (this.maxSizeUnit === UNIT_BYTE) {
            const totalSize = files.map(f => f.stat.size).reduce((a, b) => a + b, 0);
            if (totalSize > this.maxSize) {
                files.sort((a, b) => a.stat.atimeMs - b.stat.atimeMs);
                const over = totalSize - this.maxSize;
                let count = 0;
                let filesToDelete = [];
                for (const f of files) {
                    filesToDelete.push(f.file);
                    count += f.stat.size;
                    if (count >= over) {
                        break;
                    }
                }
                await Promise.all(filesToDelete.map(f => fs.unlink(f)));
            }
        } else {
            if (files.length > this.maxSize) {
                files.sort((a, b) => a.stat.atimeMs - b.stat.atimeMs);
                await Promise.all(files.slice(0, files.length - this.maxSize)
                    .map(f => fs.unlink(f.file)));
            }
        }
    }
    async _updateFileRegistry() {
        await fs.writeJson(join(this.dir, REGISTRY), this.registry);
    }

    _hashKey(key) {
        return createHash("sha1")
            .update(key)
            .digest().toString("hex");
    }
}
module.exports = FileLRUCache;