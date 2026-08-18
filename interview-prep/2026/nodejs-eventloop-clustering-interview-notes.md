# Node.js Event Loop, Thread Pool & Clustering — Interview Notes

> A study-ready compilation covering the Node.js event loop internals, thread pool behavior, user-scale concepts, and multi-core scaling with the cluster module. Organized for revision, not strict chat order.

---

## Table of Contents

1. [Components of the Event Loop](#1-components-of-the-event-loop)
2. [Queues in the Event Loop](#2-queues-in-the-event-loop)
3. [What is DNS in the Thread Pool Context](#3-what-is-dns-in-the-thread-pool-context)
4. [Total Users vs Concurrent Users](#4-total-users-vs-concurrent-users)
5. [Advantages & Disadvantages of Multiple CPU Cores](#5-advantages--disadvantages-of-multiple-cpu-cores)
6. [Does a Worker Become Master After fork()?](#6-does-a-worker-become-master-after-fork)
7. [Plugging Cluster Code Into a Real Express App](#7-plugging-cluster-code-into-a-real-express-app)
8. [Walkthrough: What Happens When You Run `node cluster.js`](#8-walkthrough-what-happens-when-you-run-node-clusterjs)
9. [The Real Interview Questions Behind "Use Cluster"](#9-the-real-interview-questions-behind-use-cluster)

---

## 1. Components of the Event Loop

The event loop lets Node.js perform non-blocking I/O despite JavaScript being single-threaded.

### Core Components

- **Call Stack** — Executes synchronous code. The event loop only runs when the stack is empty.
- **Event Loop Phases** — The loop cycles through phases in a fixed order.
- **Microtask Queue** — Runs between every phase (highest priority).
- **Thread Pool (libuv)** — Handles expensive operations the OS can't do async (default 4 threads).

### Phase Order

```
   ┌───────────────────────────┐
┌─>│         timers            │  ← setTimeout, setInterval
│  ├───────────────────────────┤
│  │     pending callbacks     │  ← deferred I/O error callbacks
│  ├───────────────────────────┤
│  │       idle, prepare       │  ← internal use only
│  ├───────────────────────────┤
│  │           poll            │  ← retrieve new I/O events (MAIN phase)
│  ├───────────────────────────┤
│  │           check           │  ← setImmediate callbacks
│  ├───────────────────────────┤
└──┤      close callbacks      │  ← socket.on('close', ...)
   └───────────────────────────┘
```

| Phase | Description |
|---|---|
| **Timers** | Runs `setTimeout` / `setInterval` callbacks whose delay expired |
| **Pending Callbacks** | Runs I/O callbacks deferred from the previous iteration |
| **Idle / Prepare** | Internal to Node.js |
| **Poll** | Retrieves new I/O events; blocks here if queue is empty |
| **Check** | Runs `setImmediate()` callbacks |
| **Close Callbacks** | Handles `close` events |

### Execution Order Summary

```
synchronous code
  → process.nextTick()
    → Promise microtasks
      → timers (setTimeout/setInterval)
        → poll (I/O)
          → check (setImmediate)
            → close callbacks
```

### Example

```js
console.log('1 - sync');

setTimeout(() => console.log('2 - setTimeout'), 0);
setImmediate(() => console.log('3 - setImmediate'));

Promise.resolve().then(() => console.log('4 - Promise'));
process.nextTick(() => console.log('5 - nextTick'));

console.log('6 - sync');

// Output:
// 1 - sync
// 6 - sync
// 5 - nextTick
// 4 - Promise
// 2 - setTimeout
// 3 - setImmediate
```

---

## 2. Queues in the Event Loop

Node.js maintains multiple queues across two categories.

### Category 1: Microtask Queues (run between every phase)

Highest priority. Fully drained before moving to the next phase.

1. **`process.nextTick()` Queue** — Highest priority of all. Runs before Promises. Recursive calls can cause **starvation**.
2. **Promise Microtask Queue** — Holds `.then()` / `.catch()` / `async-await` continuations. Runs after the nextTick queue is empty.

### Category 2: Macrotask Queues (one phase processed at a time)

3. **Timers Queue** — `setTimeout` / `setInterval` callbacks.
4. **Pending I/O Callbacks Queue** — Deferred I/O error callbacks from the previous iteration.
5. **Poll Queue** — Main I/O queue (file reads, network, DB). Event loop blocks here if empty.
6. **Check Queue** — `setImmediate()` callbacks.
7. **Close Callbacks Queue** — `close` events like `socket.on('close')`.

### Priority Order

```
HIGHEST   1. process.nextTick() queue      ← Microtask
          2. Promise microtask queue        ← Microtask
          ─────────────────────────────────
          3. Timers queue                   ← setTimeout / setInterval
          4. Pending I/O callbacks queue    ← deferred I/O errors
          5. Poll queue                     ← main I/O
          6. Check queue (setImmediate)
LOWEST    7. Close callbacks queue          ← close events
```

> After **every** macrotask callback, Node.js drains **both** microtask queues before continuing.

### Key Rules

| Rule | Detail |
|---|---|
| Microtasks first | Both microtask queues drain between every phase |
| nextTick before Promises | `process.nextTick` outranks Promises |
| Poll blocks | Event loop waits at poll if nothing else is pending |
| setImmediate vs setTimeout(0) | Inside an I/O callback, `setImmediate` always wins |
| Starvation risk | Recursive `nextTick` / Promises can block the loop |

---

## 3. What is DNS in the Thread Pool Context

**DNS = Domain Name System** — translates hostnames into IP addresses.

```
"google.com"  →  DNS Lookup  →  "142.250.195.46"
```

### Why DNS uses the thread pool

DNS resolution via the OS resolver (`getaddrinfo()`) is **blocking** and cannot be made async by the OS. So libuv offloads it to the thread pool.

### The critical distinction — two DNS methods

| Feature | `dns.lookup()` | `dns.resolve()` |
|---|---|---|
| Uses thread pool | ✅ Yes | ❌ No |
| Blocking internally | ✅ Yes (via OS) | ❌ No |
| Respects `/etc/hosts` | ✅ Yes | ❌ No |
| Async network request | ❌ No | ✅ Yes |
| Risk of pool exhaustion | ✅ Yes | ❌ No |

```js
const dns = require('dns');

// Uses thread pool (OS getaddrinfo)
dns.lookup('google.com', (err, address) => console.log(address));

// Does NOT use thread pool (direct async network query)
dns.resolve4('google.com', (err, addresses) => console.log(addresses));
```

### Thread pool exhaustion risk

```js
// ⚠️ Only 4 run in parallel (default pool size), rest queue up → latency spikes
for (let i = 0; i < 100; i++) {
  dns.lookup('google.com', (err, addr) => console.log(addr));
}
```

**Fixes:**
```js
process.env.UV_THREADPOOL_SIZE = 8;  // must be set before any I/O
// OR use dns.resolve4() which skips the thread pool entirely
```

> In the thread pool context, "DNS" specifically means `dns.lookup()` — the blocking OS call that libuv runs on a background thread.

---

## 4. Total Users vs Concurrent Users

| Term | Meaning |
|---|---|
| **1M Total Users** | 1 million users have **ever** used your app (lifetime) |
| **1M Concurrent Users** | 1 million users using your app **at the same moment** |

### Analogy — a movie theatre

```
Total Users      →  everyone who EVER bought a ticket (over years)
Concurrent Users →  people SITTING INSIDE right now
```

### What each implies for a backend

```
Total Users      →  a STORAGE problem     (how many records in the DB?)
Concurrent Users →  a PERFORMANCE problem  (how much live traffic can we serve?)
```

- **1M total, ~5K concurrent** → a single well-optimized Node.js server can cope.
- **1M concurrent** → needs load balancers, horizontal scaling, Redis caching, CDN, connection pooling, many instances.

### Why Node.js handles concurrency well

```
Thread-per-user servers:  1M concurrent = 1M threads  ❌ crashes
Node.js event loop:       1M concurrent = 1 thread + async I/O  ✅
```

This holds only while operations are **non-blocking I/O**.

---

## 5. Advantages & Disadvantages of Multiple CPU Cores

Node.js uses only **1 core** by default. On an 8-core box, 7 cores sit idle unless you use the **cluster module** or **worker threads**.

### ✅ Advantages

1. **Full CPU utilization** — 1/8 → 8/8 cores used.
2. **Higher throughput & concurrency** — more workers serve more requests simultaneously.
3. **Better for CPU-intensive tasks** — image processing, encryption, compression spread across cores.
4. **Fault tolerance** — one worker crashes, others keep serving; master restarts the dead one.
5. **Zero-downtime restarts** — restart workers one at a time during deploys.

### ❌ Disadvantages

1. **No shared memory** — each worker is a separate process with its own memory. In-memory counters/caches diverge. *Fix: Redis.*
2. **Increased memory usage** — each worker loads the full app. 4 workers ≈ 4× RAM.
3. **Session complexity** — user may hit different workers per request. *Fix: Redis / DB-backed sessions.*
4. **Port-sharing complexity** — managed by master; OS-level distribution isn't perfectly even.
5. **Little benefit for I/O-bound apps** — the event loop already handles I/O concurrency; multi-core mainly helps CPU-bound work.

### Golden Rule

```
I/O bound  (APIs, DB calls)    →  event loop is enough, multi-core optional
CPU bound  (ML, video, crypto) →  multi-core is essential
```

---

## 6. Does a Worker Become Master After fork()?

**No. Workers never become master.**

### How fork() actually works

`cluster.fork()` does **not** create a blank process. It **re-runs the same file from line 1** in a new process — with `cluster.isPrimary` set to `false`.

```
cluster.isPrimary = true   → master (original process)
cluster.isPrimary = false  → every forked worker
```

### The guard

```js
if (cluster.isPrimary) {
  // ✅ Only MASTER enters here (isPrimary = true)
  cluster.fork();
} else {
  // ✅ Only WORKERS enter here (isPrimary = false)
  require('./server');
}
```

Workers hit the same `if`, but since `isPrimary` is `false`, they skip the fork loop and fall into `else`. This `if/else` guard is exactly what prevents **infinite forking**.

| Process | isPrimary | Behavior |
|---|---|---|
| Original process | `true` | Forks workers |
| Worker 1–N | `false` | Starts the server |

> Analogy: the owner (master) hires chefs (workers) and doesn't cook. Same job description (the file), different role flag (`isPrimary`).

---

## 7. Plugging Cluster Code Into a Real Express App

**Anti-pattern:** putting cluster code inside `app.js`, mixing app logic with process management. Keep them separate.

### Folder Structure

```
project/
├── app.js          ← Pure Express app (NO cluster code, NO listen())
├── cluster.js      ← ONLY cluster / process management
├── package.json
└── routes/
```

### `app.js` — keep it pure

```js
const express = require('express');
const app = express();

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Hello', pid: process.pid });
});

module.exports = app;   // ✅ export, do NOT call app.listen() here
```

> `listen()` is removed here on purpose. If `app.js` calls `listen()`, every process tries to bind the port → conflicts.

### `cluster.js` — process management only

```js
const cluster = require('cluster');
const os = require('os');

const numCPUs = os.cpus().length;

if (cluster.isPrimary) {
  console.log(`Master PID: ${process.pid}`);
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
  cluster.on('exit', (worker) => {
    console.log(`Worker ${worker.process.pid} died. Restarting...`);
    cluster.fork();   // auto-restart
  });
} else {
  const app = require('./app');
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Worker ${process.pid} on port ${PORT}`);
  });
}
```

### `package.json` Changes

```json
{
  "scripts": {
    "start": "node cluster.js",
    "dev": "nodemon app.js",
    "start:cluster": "node cluster.js"
  }
}
```

- `start` → `cluster.js` (production, all cores)
- `dev` → `app.js` directly (single process)

**Why `dev` avoids cluster:** nodemon watches files and restarts the process; combined with cluster's multiple forks it causes chaotic restarts and port conflicts. Run single-process in dev, cluster in prod.

---

## 8. Walkthrough: What Happens When You Run `node cluster.js`

**Key idea:** the master runs `cluster.js` top to bottom, and each worker **also** runs the entire file top to bottom. The `if/else` makes them diverge.

### Step 1 — Master starts

OS starts one process (the master). It reads the file from line 1. Node sets `cluster.isPrimary = true`.

### Step 2 — Master enters the `if`

```js
if (cluster.isPrimary) {   // TRUE → master enters, never touches else
```

### Step 3 — Fork loop runs

```js
for (let i = 0; i < numCPUs; i++) cluster.fork();
```

Each `fork()` tells the OS: "start a new Node process, run `cluster.js` from line 1, but set `isPrimary = false`."

```
Master (PID 1234)
   ├── fork() → Worker A
   ├── fork() → Worker B
   ├── fork() → Worker C
   └── fork() → Worker D
```

### Step 4 — Each worker runs the file from the top

Worker A re-reads `cluster.js` from line 1 with `isPrimary = false`.

### Step 5 — Worker skips `if`, enters `else`

```js
if (cluster.isPrimary) {      // FALSE → worker skips
} else {
  const app = require('./app');
  app.listen(3000);           // ✅ worker enters here
}
```

### Full Picture

```
node cluster.js
      │
      ▼
  MASTER (isPrimary=true) → forks 4 → supervises, never runs else
    │    │    │    │
    ▼    ▼    ▼    ▼
  A    B    C    D    ← each runs file from line 1, isPrimary=false, runs else, app.listen(3000)
```

### How can 4 workers listen on the same port 3000?

Workers do **not** bind the port themselves. When a worker calls `app.listen(3000)`, the cluster module intercepts it. The **master owns the port**, accepts connections, and hands them to workers (round-robin on Linux/macOS by default).

```
request → port 3000 → MASTER
                        ├──▶ Worker A
                        ├──▶ Worker B
                        ├──▶ Worker C
                        └──▶ Worker D
```

So `app.listen(3000)` in a worker means "I'm ready to receive connections," not "bind the port."

### Step 6 — Crash handling stays with master

```js
cluster.on('exit', (worker) => cluster.fork());
```

Only the master listens for worker deaths and forks replacements.

| Process | isPrimary | Runs `if`? | Runs `else`? | Job |
|---|---|---|---|---|
| Master | `true` | ✅ | ❌ | Forks + supervises |
| Worker A–D | `false` | ❌ | ✅ | Runs Express server |

---

## 9. The Real Interview Questions Behind "Use Cluster"

Interviewers rarely ask "how do you use all CPU cores" — that phrasing gives away the answer. They hide it inside symptoms and scenarios.

### Category 1: "Why is my app slow?" trap

- *"Deployed on an 8-core machine, but throughput matches a 1-core machine. Why?"* → Node is single-threaded by default; 7 cores idle. Fix: cluster / PM2 cluster mode.
- *"CPU never exceeds ~13% under load, but requests queue up. Why?"* → 13% ≈ 1/8 cores. One core maxed, rest idle. The CPU number is the tell — it's compute-bound, not I/O.

> Weak candidates jump to "add caching" or "optimize the DB." The CPU % rules those out.

### Category 2: Scaling / capacity

- *"Single 16-core server — handle more concurrent traffic without adding machines?"* → Vertical scaling within the box = cluster across cores.
- *"How do you scale a Node.js app?"* (open-ended) → Separate two axes: scale **out** (more machines + load balancer) and scale **up on one box** (cluster).

### Category 3: CPU-bound task

- *"An endpoint does image resizing / password hashing / PDF generation. Under load, all other endpoints slow down too. Why and how to fix?"* → The CPU-bound task blocks the single event loop, starving every request. Fix: cluster **or** worker threads. Knowing which to pick is the real test.

### Category 4: Resilience

- *"In your cluster setup, if one process crashes, what happens and how do you recover?"* → Others keep serving; master detects `exit` and forks a replacement. Tests cluster as fault isolation.

### The distinction actually being graded

Once you say "cluster," the follow-up is: **"Cluster or worker threads — when each?"**

| | Cluster | Worker Threads |
|---|---|---|
| Unit | Separate **processes** | Threads inside **one process** |
| Memory | Isolated per worker | Shared heap (SharedArrayBuffer) |
| Best for | Scaling **many concurrent requests** across cores | Offloading a **single CPU-heavy computation** |
| Communication | IPC (message passing) | Shared memory + messages |

### The diagnostic chain to rehearse

Don't rehearse "cluster uses all cores." Rehearse the reasoning path — that's the shape of the real question:

```
Symptom (slow / low CPU% / one bad endpoint)
   → I/O-bound or CPU-bound?
       → I/O-bound → event loop handles it; look at DB / network / caching
       → CPU-bound → one core saturated
             → many requests?  → cluster
             → one heavy task? → worker threads
```

"Use cluster" is just the last node in that chain. Lead with it and you've skipped the reasoning being graded.

---

*End of notes.*
