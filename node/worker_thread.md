# Node.js Worker Threads Summary

## Introduction
Node.js is single-threaded, which means CPU-bound tasks (like image processing, data compression, or heavy math) can block the Event Loop, making your server unresponsive. To handle this, Node.js provides the **native** `worker_threads` module.

## Key Concepts
- **`worker_threads` (Native):** No `npm install` required. It allows you to run JavaScript in parallel on separate threads.
- **Isolation:** Each worker has its own memory space and V8 instance. They communicate via messaging, not by sharing variables.
- **Use Case:** Only use for **CPU-bound tasks**. For I/O-bound tasks (databases, APIs), use Node's native non-blocking I/O.

## Implementation Approaches

### 1. Manual `Worker` Class
Best for simple, one-off background tasks.
- **Main Thread:** Create a `new Worker('./worker.js')`.
- **Worker Thread:** Receive data via `workerData`, process it, and `parentPort.postMessage()` back to the main thread.

### 2. Thread Pool (Recommended for Production)
Creating a new thread for every request is expensive. A thread pool maintains a set of "warm" threads ready to execute tasks, improving performance and stability.
- **Library:** [Piscina](https://github.com/piscinajs/piscina) is the industry standard for this.
- **Benefits:**
    - **Latency Reduction:** No startup cost for threads.
    - **Load Control:** Prevents system resource exhaustion by limiting concurrent workers.
    - **Ease of Use:** Simplifies message passing and lifecycle management.

## Summary Comparison

| Feature | Manual Worker | Thread Pool (Piscina) |
| :--- | :--- | :--- |
| **Complexity** | High (Manages lifecycle) | Low (Handled by lib) |
| **Performance** | Lower (due to startup) | Higher (reused threads) |
| **Resource Usage** | Risk of exhaustion | Controlled |
| **Best For** | Simple background tasks | High-traffic Express servers |