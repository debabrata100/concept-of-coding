# Use of cloures
A function plus live referenced from the scopre where it is defined, which is called lexical scope.

```
function memoize(fn) {
  const cache = new Map();
  return (n) => cache.has(n) ? cache.get(n) : (cache.set(n, fn(n)), cache.get(n));
}
```
```
function once(fn) {
  let done = false;
  let result;
  return (...args) => done ? result : (done = true, result = fn(args));
}
```