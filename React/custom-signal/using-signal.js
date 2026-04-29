import { createNewSignal } from "./custom-signal.js";

const signal = createNewSignal([]);

const currentValues = signal.read();

signal.set([...currentValues, { count: 1 }]);

console.log(signal.read());
