# Node.js runtime & I/O — senior interview notes

Covers two questions: *"How does Node.js work?"* and its follow-up *"What exactly do you mean by I/O?"*

---

## Part 1 — "How does Node.js work?"

### What the question is really testing

At senior level, reciting the six event loop phases is a mid-level answer with more words. The interviewer is checking three things:

1. Can you pick an abstraction level and hold it, going deeper only when asked?
2. Do you know the **consequences** of the architecture, or only the architecture?
3. Are you precise where it matters, or do you repeat folklore ("Node is single-threaded")?

### The opening answer (~60 seconds, then stop)

> Node is a runtime that pairs V8 for JavaScript execution with libuv for I/O. My mental model has three layers.
>
> **One:** your JavaScript runs on a single thread. Only one piece of your code executes at any moment.
>
> **Two:** when that code asks for I/O, Node doesn't wait. libuv hands the request to the operating system — epoll on Linux, kqueue on BSD, IOCP on Windows — and returns immediately.
>
> **Three:** when the OS signals completion, libuv queues your callback, and the event loop runs it the next time the JS thread is free.
>
> The practical consequence is that Node gives you **concurrency without parallelism**. One thread can hold tens of thousands of open sockets because it never blocks on any of them. The price is that any CPU-heavy work on that thread stops *everything* — including your health check endpoint, which is how a wedged Node process stays in the load balancer pool while serving nothing.
>
> That trade-off drives most of my architecture decisions in Node: keep the loop free, push CPU work off it.

Then **stop talking.** Let them steer. Silence after a tight answer reads as confidence; continuing to talk reads as anxiety.

### Three precision points that separate senior from mid

**1. "Single-threaded" is wrong as stated.**
The *JavaScript execution* is single-threaded. The *process* is not — libuv maintains a thread pool (default 4, `UV_THREADPOOL_SIZE`), and V8 runs its own threads for GC and JIT compilation.

**2. Not all async work is async the same way.**

- **Network I/O** (TCP, HTTP) → handed to the OS kernel. **No thread pool involvement.** This is why Node scales to huge socket counts.
- **File I/O, `dns.lookup()`, `crypto.pbkdf2`, `zlib`** → these go to the **libuv thread pool**, because the OS has no good async primitive for them.

Consequence: the pool is only 4 threads by default, so five concurrent `bcrypt` calls means the fifth one queues.

**3. Microtasks aren't a phase.**
`process.nextTick` and the promise microtask queue drain *between* callbacks, not as a loop phase. A recursive `process.nextTick` starves the event loop entirely — the loop never advances to the poll phase. Timers stop firing. Sockets stop being read.

### Follow-up map — prepare these, don't volunteer them

| They ask | They're really testing |
|---|---|
| "What happens with a CPU-heavy request?" | Whether you distinguish `cluster` from `worker_threads` |
| "`setTimeout(fn,0)` vs `setImmediate`" | Phase ordering, and that it's non-deterministic from the main module but deterministic inside an I/O callback |
| "How do you know the loop is blocked?" | Whether you've *operated* Node, not just written it |

Answer ready for the third one:

> I instrument event loop delay — `perf_hooks.monitorEventLoopDelay` histogram, exported to Prometheus, alert on p99 above ~50–100ms depending on the service. Loop lag is the leading indicator; latency and timeouts are the lagging ones. And I make the health check reflect loop health, not just process liveness, so a blocked process actually gets pulled from rotation.

### The trap

The failure mode for someone well-prepared is the opposite of underpreparing: knowing the internals well enough to want to show all of it. A senior answer is **layered and interruptible**. Give the 60-second version, then let them pull. Four minutes unprompted records as "couldn't self-edit," regardless of accuracy.

---

## Part 2 — "What exactly do you mean by I/O?"

They're not asking for a definition — they're checking whether you memorised a list. Most candidates answer "reading files and making network calls," which is examples, not a definition. The follow-up that kills that answer: *"is `crypto.pbkdf2` I/O?"*

### The one question that sorts everything

**Who is actually doing the work while your JavaScript is not running?**

There are only three possible answers, and everything in Node falls into one of them:

| Executor | What it means | Effect on the loop |
|---|---|---|
| **The kernel** | epoll / kqueue / IOCP owns the operation | Loop stays completely free |
| **A libuv pool thread** | One of 4 side threads runs it | Loop stays free, but pool slots are finite |
| **The main thread** | Your JS thread does the work itself | Loop is frozen |

### The five terms, defined so they stop overlapping

These are **not five parallel categories** — that is the usual source of confusion. They sit on three different axes.

#### 1. I/O — a *type of work*

Your process asks something **outside itself** to do work: the disk, the network card, another machine, another process. Your CPU is not doing it.

This says nothing about blocking. `fs.readFileSync` is I/O and it freezes your loop.

**Speed is not the definition — ownership is.** A database query might spend 200ms burning CPU on the database's machine; from your process's view it's still I/O, because it's not your CPU and not your thread.

#### 2. Async I/O — a *delivery mechanism*

I/O where the **kernel** takes ownership and notifies Node on completion. No Node thread waits. This is the good path.

| Task | Notes |
|---|---|
| `net.Socket` reads/writes | TCP |
| `http` / `https` server and client | built on `net` |
| `http2` | same |
| `dgram` | UDP |
| TLS socket data | handshake crypto still costs main-thread CPU |
| `child_process` stdio pipes | pipes are pollable |
| Cluster / IPC channel messages | pipes |
| `process.stdin` / `stdout` when a pipe or TTY | when redirected to a **file**, becomes blocking |
| `dns.resolve()` and all `dns.Resolver` methods | uses c-ares over a UDP socket |
| Server `accept()` of new connections | |
| OS signals (`SIGINT`, `SIGTERM`) | |
| `fs.watch` | on Linux uses inotify, kernel-notified |

This is why one Node process holds 50,000 sockets without difficulty.

#### 3. Thread pool — a *worker*, not a category of work

libuv keeps 4 real OS threads (`UV_THREADPOOL_SIZE`, max 1024).

**This is not "the I/O pool."** It is the *"we could not make this properly async, so run it on a side thread"* pool. Two very different kinds of task share those 4 slots.

**(a) Real I/O the OS won't do async:**

| Task | Notes |
|---|---|
| Every async `fs.*` — `readFile`, `writeFile`, `open`, `close`, `stat`, `readdir`, `rename`, `unlink`, `mkdir`, `copyFile`, `realpath` | |
| `fs.createReadStream` / `createWriteStream` | streams sit on top of these |
| `dns.lookup()` | calls blocking `getaddrinfo` — the one that surprises people |
| `dns.lookupService()` | `getnameinfo` |

**(b) Pure CPU work deliberately offloaded:**

| Task | Notes |
|---|---|
| `crypto.pbkdf2` | |
| `crypto.scrypt` | |
| `crypto.randomBytes` / `randomFill` (callback form) | |
| `crypto.generateKeyPair` | |
| `crypto.sign` / `verify` (callback form) | |
| All async `zlib` — `gzip`, `gunzip`, `deflate`, `brotliCompress` | |
| `bcrypt` (the popular npm package) | uses the same pool via N-API |

**The production failure mode worth naming:** five concurrent `pbkdf2` calls means the fifth waits for a free thread. And while those 4 threads are busy hashing passwords, **every `fs.readFile` and every `dns.lookup()` in your app queues behind them.** Password hashing starves your file reads.

#### 4. Blocking on the main thread — the danger zone

Not a queue, not a pool. Your JS thread does the work and nothing else moves.

| Task | Notes |
|---|---|
| Every `fs.*Sync` — `readFileSync`, `writeFileSync`, `existsSync` | **does not touch the thread pool** |
| `crypto.pbkdf2Sync`, `scryptSync`, `randomBytesSync` | |
| `zlib.gzipSync` and friends | |
| `child_process.execSync` / `spawnSync` | |
| `JSON.parse` / `JSON.stringify` on large payloads | |
| Catastrophic regex backtracking | |
| Large array `sort`, `map`, `filter` | |
| Template rendering, image manipulation in pure JS | |
| `require()` at runtime | it reads files synchronously |

#### 5. Timers — a *scheduling mechanism*

Not I/O at all. No kernel, no thread pool. Node holds your callback and checks a clock.

| Task | Where it runs |
|---|---|
| `setTimeout` | timers phase |
| `setInterval` | timers phase |
| `setImmediate` | check phase (a different phase, deliberately) |

The only guarantee is **"not before"** the delay, never "at" the delay. If the loop is busy, a 10ms timer fires at 800ms.

#### 6. Promises — a *delivery mechanism* (the key correction)

**A Promise is not a category of work. It never does anything.** It only decides *where your continuation is queued*.

Proof: `fs.promises.readFile()` and `fs.readFile()` use the exact same thread pool. Identical work, identical executor. The only difference is that one hands you the result via a callback in the poll phase, the other via a microtask.

So `await` can wrap any of the three executors:

| Code | Actual executor |
|---|---|
| `await fetch(url)` | kernel async I/O |
| `await fs.promises.readFile()` | thread pool |
| `await Promise.resolve(bigSyncFunction())` | **main thread, fully blocking** |

That third row is the trap. The `await` fools people into thinking it's async. It is not.

Microtasks — `Promise.then`, `await` resumption, `queueMicrotask`, and `process.nextTick` — drain **between every callback**, not as a loop phase. `process.nextTick` drains before promises.

### The two-axis table (worth memorising)

|  | **Doesn't block the loop** | **Blocks the loop** |
|---|---|---|
| **Real I/O** | `http.get`, socket reads (kernel-notified) | `fs.readFileSync`, `execSync` |
| **Not I/O** | `crypto.pbkdf2`, `zlib.gzip` (thread pool) | `JSON.parse` on 50MB, a tight loop |

Two payoffs: `readFileSync` is I/O and still destroys your loop; `pbkdf2` is pure CPU that behaves async. **"I/O" and "asynchronous" are two independent axes.**

### Have this ready — the likely next question

**"Why can't file reads use epoll like sockets do?"**

Because readiness-polling assumes something can be *not ready yet*. A socket has that state — no bytes have arrived. A regular file is always "ready" as far as `epoll` is concerned; it returns immediately, and then the actual read still blocks while the disk seeks. Readiness gives you nothing when there's no waiting state to report. So libuv fakes async by putting the blocking read on a pool thread.

Optional footnote showing you've kept up: Linux's `io_uring` provides genuine async file I/O, and libuv has been adopting it for some filesystem operations on recent kernels. Windows' IOCP was completion-based from the start, which is why this asymmetry is a Unix problem specifically.

### The one-paragraph version to say out loud

> Three things get confused here. **I/O** is *what* the work is — something outside my process does it. **Async I/O versus thread pool** is *who executes it*: sockets go to the kernel and cost me nothing, while file operations, `dns.lookup` and crypto go to libuv's 4-thread pool because the OS has no async version. **Timers and promises** aren't work at all — they're just scheduling: timers put a callback in a phase, promises put it in the microtask queue. So `await` tells you nothing about whether something blocks. What matters is which of those three executors is doing the work.

---

## Self-test — cover the answers

Can you answer these without looking?

1. Is `crypto.pbkdf2` I/O? Why or why not?
2. Which uses the libuv thread pool: `dns.lookup()` or `dns.resolve()`?
3. Does `fs.readFileSync` use the thread pool?
4. Name a case where `await` does not make something non-blocking.
5. Why can't file reads use `epoll`?
6. Your app hashes passwords with `bcrypt` under load and unrelated file reads get slow. Explain the mechanism.
7. What is the default `UV_THREADPOOL_SIZE`, and what breaks when you exceed it?
8. Is `process.nextTick` an event loop phase?
9. How would you detect a blocked event loop in production?
10. Why is a health check that only reports process liveness dangerous in Node?

<details>
<summary>Answer key</summary>

1. No — it is pure CPU work. It only *behaves* async because libuv runs it on a pool thread.
2. `dns.lookup()` (blocking `getaddrinfo`). `dns.resolve()` uses c-ares over a UDP socket — kernel async.
3. No. It blocks the main thread directly.
4. `await Promise.resolve(heavySyncWork())` — the work runs on the main thread before the promise ever settles.
5. Readiness polling needs a "not ready" state. A regular file is always reportedly ready; the block happens during the actual read.
6. `bcrypt` occupies libuv pool threads. Async `fs.*` shares the same 4 slots, so file reads queue behind the hashing.
7. 4 (max 1024). Beyond it, tasks queue — latency rises for *all* pool-backed work, not just the saturating one.
8. No. `nextTick` and microtasks drain between callbacks, at every phase boundary.
9. `perf_hooks.monitorEventLoopDelay` histogram → metrics backend → alert on p99 loop lag.
10. A blocked loop still has a live process. The instance stays in the load balancer pool while serving nothing.

</details>
