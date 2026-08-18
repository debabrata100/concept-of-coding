# Node.js internals — deep dive Q&A

A complete question-and-answer reference covering Node.js architecture, the event loop, libuv thread pool, HTTP request handling, and concurrency. Built from first-principles explanations.

---

## 1. Explain Node.js architecture — V8, libuv, thread pool, and how it all fits together

Node.js is not just JavaScript. It is made of four layers stacked on top of each other:

| Layer | What it does |
|---|---|
| Your JavaScript code | async/await, Promises, callbacks |
| Node.js standard library | http, fs, crypto, net, dns, zlib |
| Node.js C++ bindings | bridges JavaScript to the native C++ layer |
| V8 + libuv | V8 executes JS; libuv handles all async work |

**V8** compiles and runs your JavaScript on a single thread. It manages the heap, call stack, and garbage collection.

**libuv** is a C library that handles everything asynchronous. It decides whether a task goes to the OS kernel (networking) or the thread pool (file I/O, crypto). It owns the event loop.

**The event loop** is a continuous cycle libuv runs through 6 phases, picking up completed work and firing callbacks back into your JavaScript.

The C++ bindings are the glue — they allow your JavaScript (running in V8) to call into libuv and the OS without you having to write C.

---

## 2. Is task execution in the thread pool blocking or not?

Yes. Tasks inside the thread pool run in a **blocking, synchronous** way.

A thread pool worker picks up a task — for example, "read this file" — and sits there waiting until the task completes. That worker is blocked. It cannot do anything else during that time.

But here is the key distinction:

- Thread pool worker → **blocked** (doing the task)
- Main JavaScript thread → **not blocked** (free to handle other requests)

The entire point of the thread pool is to move blocking work off the main thread. The worker blocks so your main thread does not have to.

---

## 3. What is the use of the thread pool if the workers block?

The thread pool **protects the main thread**.

Some tasks — like reading a file from disk — cannot be made truly async at the OS level in all cases. If Node tried to do this on the main thread directly, your entire server would freeze until the file was read.

The thread pool takes that blocking work and hands it to a background worker. When the worker finishes, it notifies libuv, which queues the callback. The main thread never froze. The user never noticed.

---

## 4. Which tasks in Node.js are handled by the thread pool?

| Task | Example |
|---|---|
| File system operations | `fs.readFile`, `fs.writeFile`, `fs.stat` |
| DNS lookup (not resolve) | `dns.lookup` |
| Crypto operations | `crypto.pbkdf2`, `crypto.scrypt`, `crypto.randomBytes` |
| Compression | `zlib.gzip`, `zlib.deflate` |
| Native C++ addons | third-party packages that opt into it |

Everything **not** in this list — HTTP requests, database TCP connections, timers — goes directly to the OS and never touches the thread pool.

---

## 5. Does `fs.readFileSync` use the thread pool?

No. `fs.readFileSync` does **not** use the thread pool.

It blocks the main JavaScript thread directly. The "Sync" in the name is the tell — it runs the file read right there on the main thread, synchronously, start to finish.

| | `fs.readFile` | `fs.readFileSync` |
|---|---|---|
| Uses thread pool? | Yes | No |
| Blocks main thread? | No | Yes |
| Other requests served while running? | Yes | No — everything freezes |

```js
// BAD — blocks everything
app.get('/file', (req, res) => {
  const data = fs.readFileSync('./bigfile.txt') // main thread frozen
  res.send(data)
})

// GOOD — thread pool handles it, main thread stays free
app.get('/file', async (req, res) => {
  const data = await fs.promises.readFile('./bigfile.txt')
  res.send(data)
})
```

**Simple rule:** Any Node.js function with "Sync" in the name — `readFileSync`, `writeFileSync`, `execSync` — always runs on the main thread, always blocks, and never touches the thread pool.

---

## 6. How are Java threads different from libuv threads?

They are not doing the same job. Comparing them directly is like comparing a full-time employee to a specialist contractor.

### Java threads — one thread per request

In a typical Java web server (Tomcat), each incoming request gets one dedicated thread for the entire duration of that request — from reading the request to sending the response. That thread blocks while waiting for the database, the file system, or any external service.

```
Request 1 → Thread 1 (busy entire time, even waiting for DB)
Request 2 → Thread 2 (busy entire time)
Request 3 → Thread 3 (busy entire time)
Request 4 → waiting... no thread available
```

Each Java thread carries ~512KB–1MB of memory for its stack. At 10,000 concurrent connections, you need 10,000 threads — roughly 10GB of memory just for stacks, plus massive CPU context-switching overhead.

### libuv threads — specialist workers, not request handlers

libuv threads do not handle requests at all. They only exist to run specific blocking C tasks in the background — file reads, crypto, DNS lookup. They never touch your JavaScript. They never handle HTTP.

```
All 10,000 requests → ONE main JS thread (via OS async I/O)

fs.readFile called → one libuv worker handles it silently
                     main thread moves on immediately
```

### Side-by-side comparison

| | Java threads | libuv threads |
|---|---|---|
| Runs your application code? | Yes | No — only C/C++ code |
| Purpose | Handle entire requests | Handle one specific blocking task |
| Count | One per concurrent request | Fixed 4 (regardless of request count) |
| Handles HTTP? | Yes | Never |
| Blocks while waiting for DB? | Yes | No — DB connections bypass the thread pool |

### The real-world tradeoff

Node handles 10,000 concurrent connections with one main thread and 4 libuv workers. Memory stays low. No context switching between request handlers.

The tradeoff: if any one request does heavy CPU work in JavaScript, it blocks all other requests. Java does not have this problem because each request has its own thread.

This is why Node excels at I/O-heavy work (APIs, proxies, real-time systems) and struggles with CPU-heavy work (video encoding, ML inference, heavy computation).

---

## 7. When multiple HTTP requests arrive, do they wait in a queue before the event loop picks them?

Yes — but there are two queues at two completely different levels, and most people picture the wrong one.

### Queue 1: OS kernel TCP backlog (before Node knows about the request)

When multiple HTTP requests arrive simultaneously, the OS kernel handles the TCP three-way handshake and places established connections in a **backlog queue**. Node.js has not touched any of these yet.

```
Client 1 ──┐
Client 2 ──┤──→ OS kernel TCP backlog ──→ Node accepts when ready
Client 3 ──┘
```

Default backlog size in Node is 511. You can increase it:

```js
server.listen(3000)         // backlog defaults to 511
server.listen(3000, 1000)   // increased to 1000
```

If the backlog fills up completely, the OS starts **refusing** new connections outright — not queuing them.

### Queue 2: libuv callback queue (inside Node)

Once the OS has established connections ready, libuv uses `epoll`/`kqueue` to watch them. When multiple connections are ready, libuv collects all their callbacks and queues them. The event loop picks these callbacks one at a time.

```
Connection 1 callback ──┐
Connection 2 callback ──┤──→ event loop processes one at a time
Connection 3 callback ──┘
```

### The full flow

```
Requests arrive
     ↓
OS kernel TCP backlog (Queue 1 — temporary, microseconds)
     ↓
Node accepts → epoll/kqueue notifies libuv
     ↓
libuv callback queue (Queue 2 — libuv level)
     ↓
Event loop picks one callback at a time → runs on main JS thread
```

---

## 8. If the backlog only holds 511 connections, how does Node handle 10k+ connections?

The 511 backlog is not a limit on total connections Node can handle. It is only a limit on how many connections can be **waiting to be accepted** at one instant.

### The "revolving door" mental model

The backlog is like a revolving door, not a waiting room. Connections pass through it in microseconds:

1. OS finishes TCP handshake → connection enters backlog
2. Node calls `accept()` (extremely fast, happens continuously)
3. Connection moves to `epoll` watch list — **out of the backlog**

The backlog is only occupied for a tiny window between OS completing the handshake and Node calling `accept()`. That window is microseconds long.

### Where 10,000 connections actually live: the epoll watchlist

Once Node accepts a connection, it hands it to `epoll`/`kqueue`. The OS can watch tens of thousands of file descriptors simultaneously with almost no overhead. These connections sit idle, consuming almost no resources — just a kernel data structure. No thread is assigned to them.

```
epoll watchlist
──────────────────────────────────────────────────
conn1  conn2  conn3 ... conn9999  conn10000
(all idle, zero threads, waiting for data)

When conn4721 sends data:
OS signals libuv → callback queued → event loop handles it
```

### When does 511 actually become a problem?

Only if the main thread is completely frozen (from synchronous blocking code), so Node cannot call `accept()` fast enough. Backlog fills. OS starts rejecting new connections. This is another reason why blocking the main thread is catastrophic.

---

## 9. In what order does Node process connections and return responses?

Node does not guarantee a strict order. There is no FIFO line.

### What determines processing order

**Step 1 — epoll returns a batch of ready connections**

`epoll_wait()` returns connections that have data ready at that moment — in the order their data arrived at the OS network buffer, not in the order they connected.

```
epoll_wait() returns:
[conn47, conn12, conn891, conn3, conn204]
← all had data ready, in no guaranteed connection order
```

**Step 2 — libuv queues their callbacks**

libuv takes that batch and puts all callbacks in the I/O callback queue in the same order epoll returned them.

**Step 3 — Event loop picks them one by one**

One callback runs to completion, then the next starts.

### Summary table

| Priority | What determines order |
|---|---|
| 1st | Which connection's data arrived at OS first |
| 2nd | Order epoll returned them in the batch |
| 3rd | Sequential processing by the event loop |

Connection time is irrelevant. **Data arrival time is what matters.**

### Why fast callbacks feel simultaneous

If each callback completes in 1ms, five connections in a batch are all served in about 5ms total. From the client's perspective that feels instant.

```
cb_conn47   |■| 1ms
cb_conn12     |■| 1ms
cb_conn891      |■| 1ms
cb_conn3          |■| 1ms
cb_conn204          |■| 1ms
Total: ~5ms for all 5
```

But one slow synchronous operation destroys this:

```
cb_conn47   |■■■■■■■■■■■■■■■■■| 500ms  ← heavy sync work
cb_conn12                      |■| 1ms  ← waited 500ms unnecessarily
```

### Response order is independent per connection

When your handler calls `res.send()`, Node hands bytes to the OS TCP send buffer for that specific connection. The OS sends them to that specific client. It has nothing to do with other connections. `conn891` can receive its response before `conn47` even if `conn47` started processing first.

---

## 10. Key rules to always remember

### Thread pool
- Default size: 4 threads
- Max size: 1024 (set via `UV_THREADPOOL_SIZE`)
- Workers block while executing — that is the point
- If all 4 workers are busy, the 5th task queues and your callback waits

```bash
UV_THREADPOOL_SIZE=16 node server.js
```

### What uses the thread pool vs OS async I/O

| Uses thread pool | Uses OS async I/O |
|---|---|
| `fs.readFile` | TCP / HTTP connections |
| `crypto.pbkdf2` | Database connections |
| `dns.lookup` | `dns.resolve` |
| `zlib.gzip` | Unix domain sockets |

### Sync functions always block the main thread

```
fs.readFileSync    → main thread blocked, no thread pool
fs.writeFileSync   → main thread blocked, no thread pool
child_process.execSync → main thread blocked, no thread pool
```

### Event loop microtask priority order

```
process.nextTick()     ← runs first (before everything)
Promise microtasks     ← runs second
Event loop phase       ← then the actual phase callbacks
```

Recursively calling `process.nextTick()` starves the event loop permanently.

### The backlog rule

511 slots in the TCP backlog does not limit total connections. It only limits the momentary queue of connections waiting to be accepted. Node drains this in microseconds under normal conditions.

---

## Quick mental models to remember

**Thread pool** — 4 workers in a back room doing slow, blocking tasks so the main chef never has to stop cooking.

**epoll watchlist** — 10,000 people seated in a stadium. They wait silently with no resources. The moment one raises their hand (data arrives), the usher (libuv) is notified instantly.

**TCP backlog** — the stadium entrance door. 511 people max wait at the door, but the ticket checker moves so fast the door is almost always clear. The 10,000 inside are separate from the door.

**Event loop** — one doctor seeing patients one at a time, very fast. The order depends on who walked into the room, not who booked the appointment first.

**Java vs Node threads** — Java gives each customer a dedicated waiter who stands idle while the kitchen cooks. Node has one waiter serving all customers, handing orders to the kitchen and moving on.
