const { test } = require("tap");
const LRU = require("./index");
const { ensureDir } = require("fs-extra");
const { tmpdir } = require("os");
const { join } = require("path");
const { createHash } = require("crypto");

test("get", async t => {
    t.plan(2);

    const lru = new LRU({
        dir: await mkTmp(),
        maxSize: 12
    });
    t.equal(await lru.get("test"), undefined);
    await lru.set("test", "val");
    t.same(await lru.get("test"), Buffer.from("val"));
});

test("has", async t => {
    t.plan(2);

    const lru = new LRU({
        dir: await mkTmp(),
        maxSize: 12
    });
    t.notOk(await lru.has("test"));
    await lru.set("test", "val");
    t.ok(await lru.has("test"));
});

test("del", async t => {
    t.plan(2);

    const lru = new LRU({
        dir: await mkTmp(),
        maxSize: 12
    });
    await lru.set("test", "val");
    t.ok(await lru.has("test"));
    await lru.del("test");
    t.notOk(await lru.has("test"));
});

test("registry", async t => {
    t.plan(3);

    const dir = await mkTmp();
    const lru1 = new LRU({
        dir,
        maxSize: 12
    });
    await lru1.set("one", "1");
    await lru1.set("two", "2");
    t.same(new Set(await lru1.keys()), new Set(["one", "two"]));
    await lru1.set("three", "3");
    t.same(new Set(await lru1.keys()), new Set(["one", "two", "three"]));
    const lru2 = new LRU({
        dir,
        maxSize: 12
    });
    await lru2.set("four", "4");
    t.same(new Set(await lru2.keys()), new Set(["one", "two", "three", "four"]));
});

test("errors", async t => {
    t.plan(7);

    const dir = await mkTmp();
    t.throws(() => new LRU(), "option 'dir' is required");
    t.throws(() => new LRU({ dir }), "option 'maxSize' is required");
    t.throws(() => new LRU({ maxSize: {} }), "option 'maxSize' is required");
    t.throws(() => new LRU({ dir, maxSize: 4, ttl: [] }), "option 'ttl' has to be a number");
    const lru = new LRU({
        dir: join(__dirname, "index.js"),
        maxSize: 12
    });
    t.rejects(lru.size());
    const LRUReadError = t.mock("./index", {
        "fs-extra": {
            ...require("fs-extra"),
            readJson: () => { throw new Error("1") },
            readFile: () => { throw new Error("2") },
        }
    });
    const brokenLru1 = new LRUReadError({
        dir: await mkTmp(),
        maxSize: 2
    });
    t.rejects(brokenLru1.size(), "1");
    t.rejects(brokenLru1.get("f"), "2");

});

test("maxSize", async t => {
    t.plan(2);
    t.test("file", async t => {
        t.plan(4);

        const lru1 = new LRU({
            dir: await mkTmp(),
            maxSize: 2,
        });
        const lru2 = new LRU({
            dir: await mkTmp(),
            maxSize: 2,
            maxSizeUnit: "file",
        });
        for (const lru of [lru1, lru2]) {
            await lru.set("1", "1");
            await wait(10);
            await lru.set("2", "2");
            await wait(10);
            t.same(await lru.keys(), ["1", "2"]);
            await lru.set("3", "3");
            t.same(await lru.keys(), ["2", "3"]);
        }
    });
    t.test("byte", async t => {
        t.plan(4);

        const lru1 = new LRU({
            dir: await mkTmp(),
            maxSize: 10,
            maxSizeUnit: "byte",
        });
        await lru1.set("1", "1111");
        await wait(10);
        await lru1.set("2", "2222");
        await wait(10);
        t.same(await lru1.keys(), ["1", "2"]);
        await lru1.set("3", "3333");
        t.same(await lru1.keys(), ["2", "3"]);

        const lru2 = new LRU({
            dir: await mkTmp(),
            maxSize: 10,
            maxSizeUnit: "byte",
        });
        await lru2.set("0", Buffer.alloc(1, 0));
        await wait(100);
        await lru2.set("1", Buffer.alloc(100, 0));
        t.equal(await lru2.size(), 0);

        const lru3 = new LRU({
            dir: await mkTmp(),
            maxSize: 0,
            maxSizeUnit: "byte",
        });
        await lru3.set("1", Buffer.alloc(10000, 0));
        t.equal(await lru3.size(), 1);
    });
});

test("clear", async t => {
    t.plan(5);

    const dir = await mkTmp();

    const lru1 = new LRU({
        dir: dir,
        maxSize: 12
    });
    await lru1.set("test", "val");
    await lru1.set("test2", "val");
    t.equal(await lru1.size(), 2);
    t.equal(await lru1.size("file"), 2);
    t.equal(await lru1.size("byte"), 6);

    const lru2 = new LRU({
        dir: dir,
        maxSize: 12
    });
    t.equal(await lru2.size(), 2);

    const lru3 = new LRU({
        dir: dir,
        maxSize: 12,
        clear: true
    });
    t.equal(await lru3.size(), 0);
});
test("ttl", async t => {
    t.plan(6);

    const lru1 = new LRU({
        dir: await mkTmp(),
        maxSize: 12,
        ttl: -5
    });
    lru1.set("1", "a");
    lru1.set("2", "b");
    await wait(1500);
    t.same(await lru1.get("1"), Buffer.from("a"));
    t.equal(await lru1.size(), 2);

    const lru2 = new LRU({
        dir: await mkTmp(),
        maxSize: 12,
        ttl: 1
    });
    lru2.set("1", "a");
    lru2.set("2", "b");
    await wait(1500);
    t.notOk(await lru2.get("1"))
    t.equal(await lru2.size(), 0);

    const lru3 = new LRU({
        dir: await mkTmp(),
        maxSize: 12,
        ttl: 2
    });
    lru3.set("1", "a");
    lru3.set("2", "b");
    await wait(1500);
    t.same(await lru3.get("1"), Buffer.from("a"));
    t.equal(await lru3.size(), 2);
    lru3.get("0");
});

async function mkTmp() {
    const hash = createHash("sha1")
        .update(Math.random() + "")
        .digest()
        .toString("hex")
        .slice(0, 9);
    return await ensureDir(join(tmpdir(), "tt-" + hash));
}

async function wait(ms) {
    return new Promise(res => {
        setTimeout(() => {
            res();
        }, ms);
    });
}
