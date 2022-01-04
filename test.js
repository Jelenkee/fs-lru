const { test } = require("tap");
const LRU = require("./index");
const { mkdtemp } = require("fs/promises");
const { tmpdir } = require("os");
const { join } = require("path");

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

test("clear", async t => {
    t.plan(3);

    const dir=await mkTmp();

    const lru1 = new LRU({
        dir: dir,
        maxSize: 12
    });
    await lru1.set("test", "val");
    await lru1.set("test2", "val");
    t.equal(await lru1.size(),2);

    const lru2 = new LRU({
        dir: dir,
        maxSize: 12
    });
    t.equal(await lru2.size(),2);

    const lru3 = new LRU({
        dir: dir,
        maxSize: 12,
        clear: true
    });
    console.log(dir);
    //await lru3.clear();
    setImmediate(async ()=>{
        t.equal(await lru3.size(),0);
    });
});

async function mkTmp() {
    return await mkdtemp(join(tmpdir(), "tt-"));
}
