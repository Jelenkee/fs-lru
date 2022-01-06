const { test } = require("tap");
const LRU = require("./index");
const { ensureDir } = require("fs-extra");
const { tmpdir } = require("os");
const { join } = require("path");

test("get", async t => {
    t.plan(2);

    const lru = new LRU({
        dir: await mkTmp(),
        maxSize: 12
    });
    await lru.ready();
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
    await lru.ready();
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
    await lru.ready();
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
    await lru1.ready();
    await lru1.set("one", "1");
    await lru1.set("two", "2");
    t.same(new Set(lru1.keys()), new Set(["one", "two"]));
    await lru1.set("three", "3");
    t.same(new Set(lru1.keys()), new Set(["one", "two", "three"]));
    const lru2 = new LRU({
        dir,
        maxSize: 12
    });
    await lru2.ready();
    await lru2.set("four", "4");
    t.same(new Set(lru2.keys()), new Set(["one", "two", "three", "four"]));
});

test("errors", async t => {
    t.plan(6);

    const dir = await mkTmp();
    t.throws(() => new LRU());
    t.throws(() => new LRU({ dir }));
    t.throws(() => new LRU({ maxSize: {} }));
    const lru = new LRU({
        dir: join(__dirname, "index.js"),
        maxSize: 12
    });
    t.rejects(lru.ready());
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
    t.rejects(brokenLru1.ready(), "1");
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
            await lru.set("2", "2");
            t.equal(await lru.size(), 2);
            await lru.set("3", "3");
            t.equal(await lru.size(), 2);
        }
    });
    t.test("byte", async t => {
        t.plan(4);

        const lru1 = new LRU({
            dir: await mkTmp(),
            maxSize: 10,
            maxSizeUnit: "byte",
        });
        await lru1.ready();
        await lru1.set("1", "1111");
        await lru1.set("2", "2222");
        t.equal(await lru1.size(), 2);
        await lru1.set("3", "3333");
        t.equal(await lru1.size(), 2);

        const lru2 = new LRU({
            dir: await mkTmp(),
            maxSize: 10,
            maxSizeUnit: "byte",
        });
        await lru2.ready();
        await lru2.set("0", Buffer.alloc(1, 0));
        await wait(100);
        await lru2.set("1", Buffer.alloc(100, 0));
        t.equal(await lru2.size(), 0);

        const lru3 = new LRU({
            dir: await mkTmp(),
            maxSize: 0,
            maxSizeUnit: "byte",
        });
        await lru3.ready();
        await lru3.set("1", Buffer.alloc(10000, 0));
        t.equal(await lru3.size(), 1);
    });
});

test("clear", async t => {
    t.plan(4);

    const dir = await mkTmp();

    const lru1 = new LRU({
        dir: dir,
        maxSize: 12
    });
    await lru1.set("test", "val");
    await lru1.set("test2", "val");
    t.equal(await lru1.size(), 2);

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
    t.equal(await lru3.size(), 2);
    await lru3.ready();
    t.equal(await lru3.size(), 0);
});

async function mkTmp() {
    return await ensureDir(join(tmpdir(), "tt-" + Buffer.from((Math.random() + "").slice(2)).toString("hex")));
}

async function wait(ms) {
    return new Promise(res => {
        setTimeout(() => {
            res();
        }, ms);
    });
}
