`$persistentStore` 为抓包规则脚本提供一个小型键值存储,跨运行持久化。可用它在多次请求之间记住一个 token、一个计数器,或任意小段字符串。存在你自己指定的键下的值,所有抓包脚本都能看到;不带键存的那一个只属于你自己的脚本。它仅在[抓包规则脚本](capture_scripts/zh.md)中可用。

---

## 方法

```ts
$persistentStore.read(key?: string): string | null
$persistentStore.write(value: string | null, key?: string): boolean
$persistentStore.compareAndWrite(expected: string | null, value: string | null, key?: string): boolean
$persistentStore.remove(key?: string): boolean
```

* `read` 返回存储的字符串,键不存在时返回 `null`。
* `write` 存入一个字符串并返回 `true`;值的类型不受支持或超过大小上限时返回 `false` 且什么都不存(见「说明」)。值传 `null` 表示删除该键,与 `remove` 等价。
* `compareAndWrite` 只在该键此刻**正好**是 `expected` 时才写,并返回是否写成了。`expected` 传 `null` 表示「这个键还不该存在」。比较通过之后它的行为与 `write` 完全一致 —— 所以值传 `null` 就是一次条件删除。
* `remove` 删除该键并返回 `true`。

省略 `key` 时使用一个默认键。这个默认键属于**脚本本身**,而不属于装它进来的那个模块:跑同一个脚本的两条规则共用它 —— 包括分处两个不同模块、但指向同一个 `script-path` 的规则 —— 不同的脚本各有各的。想在不同脚本之间共享同一个值,请显式传 `key`。

只有一种例外:复制出来的模块副本,即使指向同一个脚本,也从一个属于它自己的空默认键开始。正因如此,同一个模块可以复制两份同时用(比如一份配一个账号)而互不覆盖。副本**内部**的多条规则之间照常共用。

---

## 并发读写

每次 `read`、`write` 和 `remove` 都同步完成。不同脚本执行共享当前存储值，但多次独立调用组成的代码**不是事务**：即使没有异步操作，别的脚本也可能在读取和写入之间修改该键。

**迁移说明：**旧版本共享执行环境，曾承诺同步的读取、比较、写入代码块不会被打断。独立脚本会话不再提供这项额外保证。条件更新和计数器请改用 `compareAndWrite`；仅把读取移到回调内部并不足以避免覆盖。

```js
// 比较和更新在一次原子操作中完成。
if ($persistentStore.compareAndWrite("5", "6", "revision")) {
  // 本次调用将 revision 从 5 改为 6。
}
```

`compareAndWrite` 是 Scripting 扩展。请处理返回 `false` 的情况，并像下面的示例一样限制重试次数。

---

## 提交一个在异步之前读到的值

当读到的那个值正是这次请求**要用的入参**时,「在回调里重读一遍」是没用的 —— 比如拿 revision 5 去服务端换一个新 token:等结果回来时你不能直接写下去,因为别人可能已经推进到了 revision 6,而你拿到的 token 是给一个不再是当前值的 revision 用的。

`compareAndWrite` 把这个前提一直带到写的那一刻:

```js
const seen = $persistentStore.read("revision")
$httpClient.get("https://example.com/token?rev=" + seen, (err, resp, data) => {
  if ($persistentStore.compareAndWrite(seen, data, "revision")) {
    // 请求在飞的这段时间里没人改过它。走到这里的只有这一次。
  } else {
    // 别人先提交了。拿回来的东西已经过期 —— 要么重来一次,要么放弃。
  }
  $done({})
})
```

`expected` 传 `null` 表示「这个键还不该存在」,可以让**恰好一个**脚本完成创建:

```js
// 抢着做这件事的所有脚本里,只有一个拿到 true。
if ($persistentStore.compareAndWrite(null, deviceID, "device-id")) { /* 是我们建的 */ }
```

**重试必须有次数上限。** `compareAndWrite` 返回 `false` 有两种原因,只有一种值得重试:

* 别人先写成功了。脚本日志里**不会**有任何记录 —— 这是并发下的正常结果。
* 值或键被拒了(对象、`undefined`、超过大小上限、保留前缀的键)。脚本日志里**会**有一条提示,而且再重试多少次都是同样的结果。

无限重试会持续占用执行时间和资源，并可能超时。请限制尝试次数:

```js
let committed = false
for (let attempt = 0; attempt < 5 && !committed; attempt++) {
  const seen = $persistentStore.read("counter")
  committed = $persistentStore.compareAndWrite(seen, String(Number(seen || "0") + 1), "counter")
}
```

**保证范围。** 条件写入比较的是更新当时的值，不会锁定这个键，也不能阻止后续编辑。存储值会在多次执行之间保留，普通脚本全局变量不会。

---

## 说明

* 值为字符串。数字和布尔会被转换;对象和数组会被**拒绝**(`write` 返回 `false`)—— 请先用 `JSON.stringify` 序列化,读出来时用 `JSON.parse` 解析。
* `write(undefined, key)` 同样会被拒绝,原有的值原封不动。这是有意的:`undefined` 通常来自一个不存在的头或字段,因为它把一个好好的值删掉,多半不是你的本意。真要删请传 `null`。
* 单个值最大 4 MB。超过时 `write` 返回 `false` 且不存任何东西,脚本日志里会有一条说明。
* 值会一直保留到被删除。重装 app 会清空。
* 键不能以 `scope:` 开头。这个前缀留给「不带键时每个脚本各自的那一格」,用它作键就能直接写进别的脚本的槽位。`read`、`write`、`remove` 遇到这样的键会拒绝执行,脚本日志里会有一条说明。
* 值以明文保存。可以放 session token 这类东西,但不要放你不希望别的脚本看到的内容 —— 任何脚本只要知道键名就能读到。

---

## 示例

```js
// 记住上一次看到的请求 URL。
const previous = $persistentStore.read("last")
$persistentStore.write($request.url, "last")
console.log("previous:", previous)
$done({})
```

```js
// 存取一个 JSON 对象。
$persistentStore.write(JSON.stringify({ count: 3 }), "state")
const state = JSON.parse($persistentStore.read("state") || "{}")
```

```js
// 删除一个值。下面两行等价。
$persistentStore.write(null, "state")
$persistentStore.remove("state")
```
