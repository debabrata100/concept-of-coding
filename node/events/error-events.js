const EventEmitter = require("events");

const emitter = new EventEmitter();

// 1. Define the listener first
emitter.on("error", (err) => {
  console.log("Caught error:", err.message);
});

// 2. Emit the error after the listener is registered
emitter.emit("error", new Error("Db failed"));
