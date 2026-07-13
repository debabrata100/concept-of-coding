const EventEmitter = require("events");

const emitter = new EventEmitter();

const eventListener = (data) => {
  console.log("Event received:", data);
};

emitter.once("events-created", eventListener);

emitter.emit("events-created", { message: "Hello, World!" });
emitter.emit("events-created", { message: "This will not be received." });

// remmove listener
emitter.off("events-created", eventListener);
