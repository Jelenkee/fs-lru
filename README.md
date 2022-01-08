# fs-lru
[![](https://badgen.net/npm/v/fs-lru)](https://www.npmjs.com/package/fs-lru)
[![](https://badgen.net/npm/dt/fs-lru)](https://www.npmjs.com/package/fs-lru)

File based LRU cache


## Usage

```js
const createLRU = require("fs-lru");

const lru = await createLRU({
    dir: "/tmp/cache",
    maxSize: 100,
    ttl: 3600
});

await lru.set("key1", "value");
await lru.set("fileContent", await fs.readFile("image.jpg"));
await lru.set("object", JSON.stringify(object));

await lru.get("key1");

await lru.clear();
```

## Options

#### `dir` (required)
* Type: `string`
* Path of the folder where the files are stored.
* ![](https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/OOjs_UI_icon_alert-warning.svg/14px-OOjs_UI_icon_alert-warning.svg.png) Do not use multiple caches with the same folder!

#### `maxSize` (required)
* Type: `number`
* Number of files/bytes that the cache can contain.

#### `maxSizeUnit`
* Values: `file` | `byte`
* Default: `file`
* Unit for the `maxSize`.

#### `ttl`
* Type: `number`
* Default: `0`
* Maximum time to live for cached items.

## Methods

All methods are `async`.

#### `lru.get(key)`
* Returns the content of the entry as `Buffer`. If entry found, `undefined` is returned.
* Updates expire time.

#### `lru.peek(key)`
* Returns the content of the entry as `Buffer`. If entry found, `undefined` is returned.
* Does not update expire time.

#### `lru.has(key)`
* Returns `true` if entry for given key exists.
* Does not update expire time.

#### `lru.set(key, value)`
* Sets the value for given key.
* `value` has to be type `string` or `Buffer`.

#### `lru.del(key)`
* Deletes the value for given key.

#### `lru.size(unit)`
* Returns the size of the cache.
* unit: `file` | `byte`

#### `lru.keys()`
* Returns the keys size of the cache sorted by expire time (least recently used keys last).

#### `lru.clear()`
* Clears the cache.
